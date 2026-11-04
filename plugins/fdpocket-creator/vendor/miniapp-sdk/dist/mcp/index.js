import "../zod-jitless.js";
import { createMcpHandler, McpServer, } from '@modelcontextprotocol/server';
import { MCP_CATALOG_BINDING, MCP_CATALOG_PATH, MCP_SCOPE_HEADER, MCP_SCOPES, MCP_TOOL_NAME_PATTERN, MCP_TOOL_RESULT_MAX_CHARS, MCP_TOOL_RESULT_TRUNCATED, MCP_TOOLS_MAX, mcpProtectedResourceMetadataUrl, mcpToolAnnotationsSchema, parseMcpScopes, } from '@workspace/project-protocol';
import { SdkError } from "../errors.js";
import { createServerClient, } from "../server/index.js";
function definitionError(name, message) {
    return new SdkError('VALIDATION_FAILED', `mcp tool "${name}": ${message}`);
}
/**
 * ツールを定義する。§4.3 の検査のうち定義で分かるものはここで落とす（`kit build` が止まり、原因が名前で分かる）。
 * `ctx.server.db` を Project のモデルで型付けするなら `toolFor<SchemaType>()` で作った `tool` を使う
 */
export function tool(definition) {
    return defineTool(definition);
}
/** `const tool = toolFor<SchemaType>()`: `ctx.server.db.<model>` が Project のスキーマで型付けされる `tool` */
export function toolFor() {
    return (definition) => defineTool(definition);
}
function defineTool(definition) {
    const { name, title, description, scope, annotations } = definition;
    if (typeof name !== 'string' || !MCP_TOOL_NAME_PATTERN.test(name))
        throw definitionError(String(name), `name must match ${MCP_TOOL_NAME_PATTERN}`);
    if (typeof title !== 'string' || title.trim() === '')
        throw definitionError(name, 'title is required');
    if (typeof description !== 'string' || description.trim() === '')
        throw definitionError(name, 'description is required');
    if (!MCP_SCOPES.includes(scope))
        throw definitionError(name, `scope must be ${MCP_SCOPES.join(' | ')}`);
    if (!mcpToolAnnotationsSchema.safeParse(annotations).success)
        throw definitionError(name, 'annotations need readOnlyHint, destructiveHint, idempotentHint, openWorldHint (boolean)');
    if (annotations.readOnlyHint !== (scope === 'read'))
        throw definitionError(name, `readOnlyHint must be ${scope === 'read'} for scope ${scope}`);
    if (typeof definition.run !== 'function')
        throw definitionError(name, 'run is required');
    return { name, title, description, scope, annotations: { ...annotations }, definition };
}
/** origin が差し替えた Project トークンの `sub`（署名は Gateway が確かめる。ここは本人の id を読むだけ） */
function projectUserIdOf(token) {
    const payload = token.split('.')[1];
    if (!payload)
        return null;
    try {
        const claims = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(payload.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0))));
        const sub = claims?.sub;
        return typeof sub === 'string' && sub !== '' ? sub : null;
    }
    catch {
        // 形が JWT でないトークン: 本人を特定できないので断る（呼び出し側が 401 にする）
        return null;
    }
}
/** `authInfo.extra` に載せて、factory とツールの callback へ運ぶ */
const SCOPE_KEY = 'fdpocket';
function scopeOf(authInfo) {
    const scope = authInfo?.extra?.[SCOPE_KEY];
    return scope && typeof scope === 'object' ? scope : null;
}
function truncate(text) {
    return text.length > MCP_TOOL_RESULT_MAX_CHARS
        ? `${text.slice(0, MCP_TOOL_RESULT_MAX_CHARS)}${MCP_TOOL_RESULT_TRUNCATED}`
        : text;
}
function toolResult(hasOutput, value) {
    const text = typeof value === 'string' ? value : JSON.stringify(value ?? null);
    return {
        content: [{ type: 'text', text: truncate(text) }],
        ...(hasOutput ? { structuredContent: value } : {}),
    };
}
function errorResult(text) {
    return { isError: true, content: [{ type: 'text', text }] };
}
const json = (body, status, headers = {}) => Response.json(body, { status, headers: { 'cache-control': 'no-store', ...headers } });
/**
 * MCP の App を定義する（`apps/<slug>/src/index.ts` で `export default`）。1 つの Worker instance に
 * 1 つの handler で、リクエストごとに `McpServer` を組み立てる（stateless。セッションを持たない）。
 */
export function defineMcpApp(config) {
    const tools = [...config.tools];
    if (tools.length > MCP_TOOLS_MAX)
        throw new SdkError('VALIDATION_FAILED', `at most ${MCP_TOOLS_MAX} mcp tools (got ${tools.length})`);
    const names = new Set();
    for (const entry of tools) {
        if (names.has(entry.name))
            throw new SdkError('VALIDATION_FAILED', `mcp tool "${entry.name}" is defined twice`);
        names.add(entry.name);
    }
    const serverInfo = { name: config.name ?? 'fdpocket-app', version: config.version ?? '1.0.0' };
    // Worker instance ごとに 1 つ（サービストークンの取り直しを共有する）。env は isolate の中で同じ object
    const clients = new WeakMap();
    const serverClientOf = (env) => {
        const held = clients.get(env);
        if (held)
            return held;
        const client = createServerClient({ env });
        clients.set(env, client);
        return client;
    };
    const handler = createMcpHandler(({ authInfo }) => {
        const server = new McpServer(serverInfo, {
            ...(config.instructions ? { instructions: config.instructions } : {}),
            // 一覧は本人によらず同じ（scope が足りないツールも載せ、呼ぶと 403）。5 分は共有キャッシュでよい
            cacheHints: { 'tools/list': { ttlMs: 300_000, cacheScope: 'public' } },
        });
        for (const entry of tools) {
            const { definition } = entry;
            server.registerTool(entry.name, {
                title: entry.title,
                description: entry.description,
                inputSchema: definition.input,
                ...(definition.output ? { outputSchema: definition.output } : {}),
                annotations: { ...entry.annotations },
                // scope が足りなければ SDK が 403 + WWW-Authenticate: Bearer error="insufficient_scope" を返す
                scopeChallenge: ({ authInfo: caller }) => caller?.scopes.includes(entry.scope) ? undefined : { scopes: [entry.scope] },
            }, async (args, ctx) => {
                const scope = scopeOf(ctx.http?.authInfo ?? authInfo);
                if (!scope)
                    return errorResult('UNAUTHENTICATED: no user');
                console.info('mcp tool call', { mcpTool: entry.name });
                try {
                    // ZenStack の型を S ごとに比べると TypeScript が深さの上限に当たるので、組み立てた文脈は型を通さない
                    const context = {
                        server: scope.server.asUser(scope.token),
                        env: scope.env,
                        request: scope.request,
                        scopes: scope.scopes,
                        userId: scope.userId,
                        signal: ctx.mcpReq.signal,
                    };
                    const value = await definition.run(args, context);
                    return toolResult(definition.output !== undefined, value);
                }
                catch (error) {
                    if (error instanceof SdkError) {
                        console.info('mcp tool refused', { mcpTool: entry.name, code: error.code });
                        return errorResult(`${error.code}: ${error.message}`);
                    }
                    console.error('mcp tool failed', {
                        mcpTool: entry.name,
                        name: error instanceof Error ? error.name : 'unknown',
                    });
                    return errorResult('INTERNAL: the tool failed; try again or tell the user');
                }
            });
        }
        return server;
    }, {
        legacy: 'stateless',
        onerror: (error) => console.error('mcp handler', { name: error.name }),
    });
    /** `tools/list` をそのまま目録にする（クライアントが見る形と同じ JSON Schema） */
    async function catalog() {
        const request = new Request('https://catalog.invalid/mcp', {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                accept: 'application/json, text/event-stream',
            },
            body: JSON.stringify({ jsonrpc: '2.0', id: 'catalog', method: 'tools/list', params: {} }),
        });
        const response = await handler.fetch(request, {
            authInfo: {
                token: 'catalog',
                clientId: 'kit-build',
                scopes: [...MCP_SCOPES],
                extra: { [SCOPE_KEY]: null },
            },
        });
        const text = await response.text();
        const payload = response.headers.get('content-type')?.includes('text/event-stream')
            ? text
                .split('\n')
                .filter((line) => line.startsWith('data:'))
                .map((line) => line.slice(5).trim())
                .at(-1)
            : text;
        const parsed = JSON.parse(payload ?? 'null');
        const listed = parsed?.result?.tools;
        if (!listed)
            throw new Error(`mcp catalog: tools/list failed: ${parsed?.error?.message ?? text}`);
        return tools.map((entry) => {
            const wire = listed.find((item) => item.name === entry.name);
            if (!wire)
                throw new Error(`mcp catalog: tools/list did not list ${entry.name}`);
            return {
                name: entry.name,
                title: entry.title,
                description: entry.description,
                scope: entry.scope,
                annotations: { ...entry.annotations },
                inputSchema: wire.inputSchema,
                ...(wire.outputSchema !== undefined
                    ? { outputSchema: wire.outputSchema }
                    : {}),
            };
        });
    }
    return {
        async fetch(request, env) {
            const url = new URL(request.url);
            if (request.method === 'GET' && url.pathname === MCP_CATALOG_PATH) {
                if (env[MCP_CATALOG_BINDING] !== '1')
                    return json({ error: 'not found' }, 404);
                return json({ tools: await catalog() }, 200);
            }
            if (request.method !== 'POST')
                return json({ error: 'method not allowed' }, 405, { allow: 'POST' });
            const token = /^Bearer\s+(\S+)$/i.exec(request.headers.get('authorization') ?? '')?.[1];
            const scopeHeader = request.headers.get(MCP_SCOPE_HEADER);
            const userId = token ? projectUserIdOf(token) : null;
            if (!token || scopeHeader === null || !userId) {
                // origin Worker が必ず付ける。無いのは配線ミス（OAuth の 401 は origin が返す）
                return json({ error: { code: 'UNAUTHENTICATED', message: 'missing project token or scope' } }, 401);
            }
            const scopes = parseMcpScopes(scopeHeader);
            const host = request.headers.get('host') ?? url.host;
            const scope = {
                token,
                scopes,
                userId,
                request,
                env,
                server: serverClientOf(env),
            };
            return handler.fetch(request, {
                authInfo: {
                    token,
                    clientId: 'fdpocket-platform',
                    scopes: [...scopes],
                    resourceMetadataUrl: mcpProtectedResourceMetadataUrl(host),
                    extra: { [SCOPE_KEY]: scope },
                },
            });
        },
    };
}
