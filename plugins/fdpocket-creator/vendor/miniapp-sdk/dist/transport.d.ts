import { type SdkErrorCode } from '@workspace/project-protocol';
export interface SendOptions {
    method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
    /** JSON にして送る */
    body?: unknown;
    headers?: Record<string, string>;
}
export interface Transport {
    /** Gateway の `path` へ送り、JSON の本文を返す */
    send(path: string, options?: SendOptions): Promise<unknown>;
    /**
     * 認証付きの fetch（ZenStack の TanStack Query フックの `fetch` に渡す）。失敗は応答を返さず
     * `SdkError` を投げる（フック側の「読み返せない書き込みを黙って undefined にする」分岐に入らない）
     */
    fetch(url: string, init?: RequestInit): Promise<Response>;
}
/**
 * Gateway への送信（sdk.md §3.5）。Project トークンを付け、失敗はすべて `SdkError` にする。
 * - 5xx・届かない（ネットワーク）は本文に関係なく `GATEWAY_UNAVAILABLE`（retryable。フェイルクローズ）
 * - 4xx は Gateway のエラー本文のコードをそのまま（読めなければ status から）
 * - 401 はセッションを捨てる合図（`onUnauthenticated`）。キャッシュで成功を装わない
 */
export declare function createTransport(options: {
    gateway: string;
    fetch: typeof globalThis.fetch;
    /** 送る直前のトークン（期限が近ければ更新してから返す。無ければ null） */
    token: () => Promise<string | null>;
    onUnauthenticated: (code: SdkErrorCode) => void;
}): Transport;
/** Gateway の応答を値か `SdkError` にする（トークン無しで呼ぶ refresh / revoke も同じ規則で読む） */
export declare function readResponse(response: Response, onUnauthenticated?: (code: SdkErrorCode) => void): Promise<unknown>;
