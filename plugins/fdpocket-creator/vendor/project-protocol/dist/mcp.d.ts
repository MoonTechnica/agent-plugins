import { z } from 'zod';
/**
 * ミニアプリの MCP サーバ（`kind: mcp` の App。miniapp-mcp.md §4・§14）。origin Worker（RS）が OAuth の
 * アクセストークンを Project トークンに差し替えて user Worker へ転送し、SDK がツールの scope を確かめる。
 * ここにあるのは Kit・SDK・origin が共有する定数と、`kit build` が書くツールの目録の形。
 */
/** OAuth の scope（`read` = 読むだけのツール、`write` = 書くツール。miniapp-mcp.md §1.2 R8） */
export declare const MCP_SCOPES: readonly ["read", "write"];
export type McpScope = (typeof MCP_SCOPES)[number];
/** origin Worker が user Worker へ付ける、許可された scope（空白区切り。`read` / `read write`） */
export declare const MCP_SCOPE_HEADER = "x-platform-mcp-scope";
/** `kit build` の Miniflare だけが付ける binding。`'1'` のときだけ SDK が目録を返す（本番の Worker には無い） */
export declare const MCP_CATALOG_BINDING = "PLATFORM_MCP_CATALOG";
/** 目録の経路（binding が無ければ 404） */
export declare const MCP_CATALOG_PATH = "/_platform/mcp/catalog";
/** PRM（RFC 9728）の経路。origin Worker が `https://{host}` の下で返す */
export declare const MCP_PROTECTED_RESOURCE_PATH = "/.well-known/oauth-protected-resource/mcp";
export declare function mcpProtectedResourceMetadataUrl(host: string): string;
/**
 * `kit build` が目録を置くファイル名。`dist/<mcp slug>/mcp-tools.json`（App のディレクトリ直下。artifact index は
 * App の外のファイルを受け付けない）と `.kit/generated/mcp-tools.json`（`kit check` が読む）の 2 か所に同じ内容
 */
export declare const MCP_TOOLS_FILE = "mcp-tools.json";
export declare function mcpToolsDistPath(slug: string): string;
/** 1 Project（= 1 mcp App）のツールの数 */
export declare const MCP_TOOLS_MAX = 64;
/** ツールの名前（MCP の仕様の推奨。Claude / ChatGPT の審査が受け付ける形） */
export declare const MCP_TOOL_NAME_PATTERN: RegExp;
/** ツールの結果の本文（Claude hosted の上限。超えた分は SDK が切り詰める。miniapp-mcp.md §6.3） */
export declare const MCP_TOOL_RESULT_MAX_CHARS = 150000;
/** 切り詰めた印（末尾に付く） */
export declare const MCP_TOOL_RESULT_TRUNCATED = "\n[truncated]";
/** scope ヘッダを読む（知らない値は読み飛ばす。無ければ空） */
export declare function parseMcpScopes(header: string | null | undefined): McpScope[];
/** MCP の tool annotations（4 つとも明示。miniapp-mcp.md §4.3） */
export declare const mcpToolAnnotationsSchema: z.ZodObject<{
    readOnlyHint: z.ZodBoolean;
    destructiveHint: z.ZodBoolean;
    idempotentHint: z.ZodBoolean;
    openWorldHint: z.ZodBoolean;
}, z.core.$strict>;
export type McpToolAnnotations = z.infer<typeof mcpToolAnnotationsSchema>;
/** 目録の 1 ツール（`tools/list` が返す形に scope を添えたもの） */
export declare const mcpToolCatalogEntrySchema: z.ZodObject<{
    name: z.ZodString;
    title: z.ZodString;
    description: z.ZodString;
    scope: z.ZodEnum<{
        read: "read";
        write: "write";
    }>;
    annotations: z.ZodObject<{
        readOnlyHint: z.ZodBoolean;
        destructiveHint: z.ZodBoolean;
        idempotentHint: z.ZodBoolean;
        openWorldHint: z.ZodBoolean;
    }, z.core.$strict>;
    inputSchema: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    outputSchema: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, z.core.$strict>;
export type McpToolCatalogEntry = z.infer<typeof mcpToolCatalogEntrySchema>;
/**
 * `kit build` が workerd 上で評価して書く `.kit/generated/mcp-tools.json`（miniapp-mcp.md §14.3）。
 * 取り込みの検証が版に記録し（`project_version_mcp_tools`）、アプリ詳細の「AI 連携」タブが表示する。
 */
export declare const mcpToolsCatalogSchema: z.ZodObject<{
    app: z.ZodString;
    tools: z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        title: z.ZodString;
        description: z.ZodString;
        scope: z.ZodEnum<{
            read: "read";
            write: "write";
        }>;
        annotations: z.ZodObject<{
            readOnlyHint: z.ZodBoolean;
            destructiveHint: z.ZodBoolean;
            idempotentHint: z.ZodBoolean;
            openWorldHint: z.ZodBoolean;
        }, z.core.$strict>;
        inputSchema: z.ZodRecord<z.ZodString, z.ZodUnknown>;
        outputSchema: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, z.core.$strict>>;
}, z.core.$strict>;
export type McpToolsCatalog = z.infer<typeof mcpToolsCatalogSchema>;
