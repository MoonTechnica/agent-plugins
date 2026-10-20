import type { Transport } from '../transport.ts';
/**
 * `client.db`（sdk.md §3.2）。ZenStack の RPC の形（`@zenstackhq/server` の RPCApiHandler・TanStack Query の
 * フックと同じ: 読み出しと削除は `?q=`、作成は POST、更新は PUT。値は SuperJSON で Date 等を往復）を
 * そのまま Gateway の `/v1/db/{model}/{op}` に送る。モデル・操作の可否は Gateway が判定する。
 */
export declare function createDbClient(transport: Transport, options?: {
    idempotencyKey?: string;
}): {};
