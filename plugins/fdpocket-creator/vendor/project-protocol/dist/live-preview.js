/**
 * ライブプレビュー（preview.md §2）の決まり。`kit dev --live`（Kit）・App に差し込むスクリプト（SDK）・
 * Studio（スーパーアプリ）が同じ値を使う。
 *
 * - 能力 URL: Sandbox の公開ポートの `/lp/{token}/` の下だけを通す（token は Sandbox ごとに backend-py が発行）
 * - 知らせ: App と Host ページは Studio に `postMessage` で「操作があった（種類だけ）」「HMR が切れた / つながった」を伝える。
 *   座標・キー・入力内容は送らない（受け取った側も `parseLiveMessage` で形を落とす）
 */
/** 推測できない token（32 バイトの base64url = 43 文字。余裕を持って 32〜128） */
export const LIVE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{32,128}$/;
export const LIVE_MESSAGE_TYPE = 'kit-live';
/** 延長の理由として数える操作（preview.md §2.2） */
export const LIVE_ACTIVITY_KINDS = ['pointerdown', 'keydown', 'wheel', 'touchstart'];
export function parseLivePreviewDiagnostic(data) {
    if (typeof data !== 'object' || data === null)
        return null;
    const { category, code } = data;
    if (category === 'runtime' && (code === 'RUNTIME_ERROR' || code === 'UNHANDLED_REJECTION')) {
        return { category, code };
    }
    if (category === 'build' && code === 'BUILD_ERROR')
        return { category, code };
    if (category === 'unknown' && code === 'PREVIEW_FAILED')
        return { category, code };
    return null;
}
/**
 * `kit dev --live` が App の Vite に渡す環境変数。Vite の `base` を `/lp/{token}/` の下にし、
 * HMR の WebSocket を Sandbox の公開ポート（wss・443）でつなぐ。
 */
export const KIT_LIVE_ENV = {
    /** `/lp/{token}/`（App ごとの `/<slug>/` は SDK が足す） */
    base: 'MINIAPP_LIVE_BASE',
    sessionOrigin: 'MINIAPP_SESSION_ORIGIN',
    token: 'MINIAPP_SESSION_LIVE_TOKEN',
    /** この App の Vite の公開ポートのホスト名（`sb-….vercel.run`） */
    hmrHost: 'MINIAPP_LIVE_HMR_HOST',
};
export function livePrefix(token) {
    if (!LIVE_TOKEN_PATTERN.test(token))
        throw new Error('invalid live preview token');
    return `/lp/${token}/`;
}
/** token が一致すれば prefix を剥がしたパス（`/` 始まり）、違えば null */
export function stripLivePrefix(pathname, token) {
    const prefix = livePrefix(token);
    if (pathname === prefix.slice(0, -1))
        return '/';
    if (!pathname.startsWith(prefix))
        return null;
    return `/${pathname.slice(prefix.length)}`;
}
export function parseLiveMessage(data) {
    if (typeof data !== 'object' || data === null)
        return null;
    const { type, event, kind } = data;
    if (type !== LIVE_MESSAGE_TYPE)
        return null;
    if (event === 'connected' || event === 'disconnected' || event === 'ready')
        return { type, event };
    if (event === 'error') {
        const diagnostic = parseLivePreviewDiagnostic(data.diagnostic);
        return diagnostic ? { type, event, diagnostic } : null;
    }
    if (event === 'activity' && LIVE_ACTIVITY_KINDS.includes(kind)) {
        return { type, event, kind: kind };
    }
    return null;
}
