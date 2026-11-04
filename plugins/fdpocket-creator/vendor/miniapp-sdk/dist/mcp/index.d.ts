import '../zod-jitless.ts';
import { type StandardSchemaWithJSON } from '@modelcontextprotocol/server';
import { type McpScope, type McpToolAnnotations, type McpToolCatalogEntry } from '@workspace/project-protocol';
import type { SchemaDef } from '@zenstackhq/schema';
import { type PlatformBindings, type ServerUserClient } from '../server/index.ts';
/**
 * ミニアプリの MCP サーバ（miniapp-mcp.md §4.2・§14.2）。生成 Agent が書くのはツールだけで、プロトコル
 * （`@modelcontextprotocol/server` v2。2026-07-28 と 2025-11-25 以前の両方を stateless で受ける）・認証・scope の
 * 検査はここが持つ。
 *
 * 届くリクエストの `Authorization` は origin Worker が差し替えた **Project トークン**（OAuth のトークンは
 * ミニアプリに届かない）、`x-platform-mcp-scope` は許可された scope。ツールは `ctx.server`
 * （`createServerClient(env).asUser(request)`）で本人として Gateway を呼ぶので、画面と同じ認可（capability ∩
 * Role ∩ ZenStack）と上限が効く。
 */
export type { McpScope, McpToolAnnotations, McpToolCatalogEntry };
/** mcp の Worker の binding（Platform の 2 つと、`kit build` の目録用） */
export interface McpBindings extends PlatformBindings {
    /** `kit build` の Miniflare だけが `'1'` を付ける（本番の Worker には無い） */
    readonly PLATFORM_MCP_CATALOG?: string;
}
/** ツールの本体に渡す文脈 */
export interface McpToolContext<S extends SchemaDef = SchemaDef> {
    /** 接続した本人として Gateway を呼ぶ（`server.asUser(request)`） */
    readonly server: ServerUserClient<S>;
    readonly env: McpBindings;
    /** 届いた HTTP リクエスト（Host・ヘッダ。本文は読み終わっている） */
    readonly request: Request;
    /** 許可された scope（`read` / `read write`） */
    readonly scopes: readonly McpScope[];
    /** Project 内の User.id（Project トークンの `sub`） */
    readonly userId: string;
    /** クライアントが呼び出しを取り消したら abort される */
    readonly signal: AbortSignal;
}
type InferInput<T> = T extends StandardSchemaWithJSON ? StandardSchemaWithJSON.InferInput<T> : never;
type InferOutput<T> = T extends StandardSchemaWithJSON ? StandardSchemaWithJSON.InferOutput<T> : never;
/** `tool({...})` に渡す定義（§14.2 の形） */
export interface McpToolDefinition<Input extends StandardSchemaWithJSON, Output extends StandardSchemaWithJSON | undefined = undefined, S extends SchemaDef = SchemaDef> {
    /** `[A-Za-z0-9_.-]{1,64}`。Project の中で一意 */
    name: string;
    title: string;
    /** 狭く正確に。システム指示やほかのツールの呼び出し指示は書かない（審査基準） */
    description: string;
    /** `read` = 読むだけ、`write` = 書く。`annotations.readOnlyHint` と一致させる */
    scope: McpScope;
    /** 4 つとも明示する */
    annotations: McpToolAnnotations;
    /** 引数（zod の object） */
    input: Input;
    /** 結果の形。書くと `structuredContent` と JSON の本文の両方を返す */
    output?: Output;
    run(args: InferOutput<Input>, ctx: McpToolContext<S>): Promise<Output extends StandardSchemaWithJSON ? InferInput<Output> : unknown>;
}
/** 実行時に要る形（型引数を落とす。ZenStack の型を S ごとに比べると TypeScript が深さの上限に当たる） */
interface ToolRuntime {
    readonly input: StandardSchemaWithJSON;
    readonly output?: StandardSchemaWithJSON;
    run(args: unknown, ctx: McpToolContext): Promise<unknown>;
}
/** 定義済みのツール（`defineMcpApp` の `tools` に並べる） */
export interface McpTool {
    readonly name: string;
    readonly title: string;
    readonly description: string;
    readonly scope: McpScope;
    readonly annotations: McpToolAnnotations;
    /** @internal */
    readonly definition: ToolRuntime;
}
export interface McpAppConfig {
    /** サーバの名前（`server/discover` / `initialize` の serverInfo。既定は listing の表示名を Kit が入れる） */
    name?: string;
    version?: string;
    /** クライアントに渡す使い方の説明 */
    instructions?: string;
    tools: readonly McpTool[];
}
/** Workers の `ExecutionContext`（型の依存を持ち込まない最小の形） */
export interface McpExecutionContext {
    waitUntil(promise: Promise<unknown>): void;
}
/** `export default` する Worker（`ExportedHandler<McpBindings>`） */
export interface McpApp {
    fetch(request: Request, env: McpBindings, ctx?: McpExecutionContext): Promise<Response>;
}
/**
 * ツールを定義する。§4.3 の検査のうち定義で分かるものはここで落とす（`kit build` が止まり、原因が名前で分かる）。
 * `ctx.server.db` を Project のモデルで型付けするなら `toolFor<SchemaType>()` で作った `tool` を使う
 */
export declare function tool<Input extends StandardSchemaWithJSON, Output extends StandardSchemaWithJSON | undefined = undefined>(definition: McpToolDefinition<Input, Output>): McpTool;
/** `const tool = toolFor<SchemaType>()`: `ctx.server.db.<model>` が Project のスキーマで型付けされる `tool` */
export declare function toolFor<S extends SchemaDef>(): <Input extends StandardSchemaWithJSON, Output extends StandardSchemaWithJSON | undefined = undefined>(definition: McpToolDefinition<Input, Output, S>) => McpTool;
/**
 * MCP の App を定義する（`apps/<slug>/src/index.ts` で `export default`）。1 つの Worker instance に
 * 1 つの handler で、リクエストごとに `McpServer` を組み立てる（stateless。セッションを持たない）。
 */
export declare function defineMcpApp(config: McpAppConfig): McpApp;
