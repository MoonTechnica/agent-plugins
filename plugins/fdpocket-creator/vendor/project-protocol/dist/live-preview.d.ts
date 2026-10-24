/**
 * ライブプレビュー（preview.md §2）の決まり。`kit dev --live`（Kit）・App に差し込むスクリプト（SDK）・
 * Studio（スーパーアプリ）が同じ値を使う。
 *
 * - 能力 URL: Sandbox の公開ポートの `/lp/{token}/` の下だけを通す（token は Sandbox ごとに backend-py が発行）
 * - 知らせ: App と Host ページは Studio に `postMessage` で「操作があった（種類だけ）」「HMR が切れた / つながった」を伝える。
 *   座標・キー・入力内容は送らない（受け取った側も `parseLiveMessage` で形を落とす）
 */
/** 推測できない token（32 バイトの base64url = 43 文字。余裕を持って 32〜128） */
export declare const LIVE_TOKEN_PATTERN: RegExp;
export declare const LIVE_MESSAGE_TYPE = "kit-live";
/** 延長の理由として数える操作（preview.md §2.2） */
export declare const LIVE_ACTIVITY_KINDS: readonly ["pointerdown", "keydown", "wheel", "touchstart"];
export type LiveActivityKind = (typeof LIVE_ACTIVITY_KINDS)[number];
export type LiveMessage = {
    type: typeof LIVE_MESSAGE_TYPE;
    event: 'activity';
    kind: LiveActivityKind;
} | {
    type: typeof LIVE_MESSAGE_TYPE;
    event: 'connected' | 'disconnected' | 'ready';
};
/**
 * `kit dev --live` が App の Vite に渡す環境変数。Vite の `base` を `/lp/{token}/` の下にし、
 * HMR の WebSocket を Sandbox の公開ポート（wss・443）でつなぐ。
 */
export declare const KIT_LIVE_ENV: {
    /** `/lp/{token}/`（App ごとの `/<slug>/` は SDK が足す） */
    readonly base: "MINIAPP_LIVE_BASE";
    readonly sessionOrigin: "MINIAPP_SESSION_ORIGIN";
    readonly token: "MINIAPP_SESSION_LIVE_TOKEN";
    /** この App の Vite の公開ポートのホスト名（`sb-….vercel.run`） */
    readonly hmrHost: "MINIAPP_LIVE_HMR_HOST";
};
export declare function livePrefix(token: string): string;
/** token が一致すれば prefix を剥がしたパス（`/` 始まり）、違えば null */
export declare function stripLivePrefix(pathname: string, token: string): string | null;
export declare function parseLiveMessage(data: unknown): LiveMessage | null;
