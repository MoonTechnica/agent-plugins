/**
 * App の配信に付ける CSP（project-runtime.md §3・sdk.md §8）。Project オリジンの本番の配信と、検証 Sandbox の
 * 動的検証が同じ関数を使う（別々に書くと「検証では通ったのに本番で止まる」が起きる）。
 *
 * - 外への通信（`connect-src`）は Project Gateway と Storage の署名 URL の宛先（R2 の S3 API のオリジン）だけ
 * - `unsafe-eval` を付けない。style は shadcn / Radix の style 属性のため `unsafe-inline`
 * - 埋め込めるのはスーパーアプリのオリジンだけ（`frame-ancestors`）
 */
import { browserOriginIssue } from "./network.js";
function originOf(value) {
    const url = new URL(value);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
        throw new Error(`${value} is not an http(s) origin`);
    }
    return url.origin;
}
function exactOrigin(value) {
    const origin = originOf(value);
    if (origin !== value.replace(/\/+$/, ''))
        throw new Error(`${value} is not an origin`);
    return origin;
}
export function appContentSecurityPolicy(input) {
    const browser = (input.browserOrigins ?? []).map((value) => {
        if (browserOriginIssue(value))
            throw new Error('invalid browser network origin');
        return exactOrigin(value);
    });
    const gatewayOrigin = originOf(input.gatewayUrl);
    const connect = [gatewayOrigin, ...input.storageOrigins.map(exactOrigin), ...browser];
    const socket = new URL(gatewayOrigin);
    socket.protocol = socket.protocol === 'https:' ? 'wss:' : 'ws:';
    const socketConnect = [gatewayOrigin, socket.origin, ...connect.slice(1)];
    const ancestors = input.hostOrigins.map(exactOrigin);
    return [
        "default-src 'self'",
        "script-src 'self'",
        "style-src 'self' 'unsafe-inline'",
        `img-src 'self' blob: data: ${[...new Set(connect)].join(' ')}`,
        "media-src 'self' blob: https:",
        "font-src 'self' data:",
        `connect-src 'self' ${[...new Set(socketConnect)].join(' ')}`,
        `frame-ancestors ${ancestors.length > 0 ? ancestors.join(' ') : "'none'"}`,
        "object-src 'none'",
        `frame-src 'self' ${originOf(input.gatewayUrl)}`,
        "base-uri 'self'",
        "form-action 'self'",
    ].join('; ');
}
