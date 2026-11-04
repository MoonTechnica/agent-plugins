import { z } from 'zod';
import { APP_SLUG_PATTERN } from "./manifest.js";
/**
 * ミニアプリの MCP サーバ（`kind: mcp` の App。miniapp-mcp.md §4・§14）。origin Worker（RS）が OAuth の
 * アクセストークンを Project トークンに差し替えて user Worker へ転送し、SDK がツールの scope を確かめる。
 * ここにあるのは Kit・SDK・origin が共有する定数と、`kit build` が書くツールの目録の形。
 */
/** OAuth の scope（`read` = 読むだけのツール、`write` = 書くツール。miniapp-mcp.md §1.2 R8） */
export const MCP_SCOPES = ['read', 'write'];
/** origin Worker が user Worker へ付ける、許可された scope（空白区切り。`read` / `read write`） */
export const MCP_SCOPE_HEADER = 'x-platform-mcp-scope';
/** `kit build` の Miniflare だけが付ける binding。`'1'` のときだけ SDK が目録を返す（本番の Worker には無い） */
export const MCP_CATALOG_BINDING = 'PLATFORM_MCP_CATALOG';
/** 目録の経路（binding が無ければ 404） */
export const MCP_CATALOG_PATH = '/_platform/mcp/catalog';
/** PRM（RFC 9728）の経路。origin Worker が `https://{host}` の下で返す */
export const MCP_PROTECTED_RESOURCE_PATH = '/.well-known/oauth-protected-resource/mcp';
export function mcpProtectedResourceMetadataUrl(host) {
    return `https://${host}${MCP_PROTECTED_RESOURCE_PATH}`;
}
/**
 * `kit build` が目録を置くファイル名。`dist/<mcp slug>/mcp-tools.json`（App のディレクトリ直下。artifact index は
 * App の外のファイルを受け付けない）と `.kit/generated/mcp-tools.json`（`kit check` が読む）の 2 か所に同じ内容
 */
export const MCP_TOOLS_FILE = 'mcp-tools.json';
export function mcpToolsDistPath(slug) {
    return `${slug}/${MCP_TOOLS_FILE}`;
}
/** 1 Project（= 1 mcp App）のツールの数 */
export const MCP_TOOLS_MAX = 64;
/** ツールの名前（MCP の仕様の推奨。Claude / ChatGPT の審査が受け付ける形） */
export const MCP_TOOL_NAME_PATTERN = /^[A-Za-z0-9_.-]{1,64}$/;
/** ツールの結果の本文（Claude hosted の上限。超えた分は SDK が切り詰める。miniapp-mcp.md §6.3） */
export const MCP_TOOL_RESULT_MAX_CHARS = 150_000;
/** 切り詰めた印（末尾に付く） */
export const MCP_TOOL_RESULT_TRUNCATED = '\n[truncated]';
/** scope ヘッダを読む（知らない値は読み飛ばす。無ければ空） */
export function parseMcpScopes(header) {
    const seen = new Set();
    for (const part of (header ?? '').split(/\s+/)) {
        if (MCP_SCOPES.includes(part))
            seen.add(part);
    }
    return [...seen];
}
/** MCP の tool annotations（4 つとも明示。miniapp-mcp.md §4.3） */
export const mcpToolAnnotationsSchema = z.strictObject({
    readOnlyHint: z.boolean(),
    destructiveHint: z.boolean(),
    idempotentHint: z.boolean(),
    openWorldHint: z.boolean(),
});
const jsonSchema = z.record(z.string(), z.unknown());
/** 目録の 1 ツール（`tools/list` が返す形に scope を添えたもの） */
export const mcpToolCatalogEntrySchema = z.strictObject({
    name: z.string().regex(MCP_TOOL_NAME_PATTERN),
    title: z.string().trim().min(1),
    description: z.string().trim().min(1),
    scope: z.enum(MCP_SCOPES),
    annotations: mcpToolAnnotationsSchema,
    inputSchema: jsonSchema,
    outputSchema: jsonSchema.optional(),
});
/**
 * `kit build` が workerd 上で評価して書く `.kit/generated/mcp-tools.json`（miniapp-mcp.md §14.3）。
 * 取り込みの検証が版に記録し（`project_version_mcp_tools`）、アプリ詳細の「AI 連携」タブが表示する。
 */
export const mcpToolsCatalogSchema = z.strictObject({
    app: z.string().regex(APP_SLUG_PATTERN),
    tools: z.array(mcpToolCatalogEntrySchema).max(MCP_TOOLS_MAX),
});
