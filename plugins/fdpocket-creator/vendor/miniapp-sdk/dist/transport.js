import { errorResponseSchema, sdkErrorCodeForStatus, } from '@workspace/project-protocol';
import { SdkError } from "./errors.js";
/**
 * Gateway への送信（sdk.md §3.5）。Project トークンを付け、失敗はすべて `SdkError` にする。
 * - 5xx・届かない（ネットワーク）は本文に関係なく `GATEWAY_UNAVAILABLE`（retryable。フェイルクローズ）
 * - 4xx は Gateway のエラー本文のコードをそのまま（読めなければ status から）
 * - 401 はセッションを捨てる合図（`onUnauthenticated`）。キャッシュで成功を装わない
 */
export function createTransport(options) {
    const base = options.gateway.replace(/\/+$/, '');
    async function forward(url, init = {}) {
        const token = await options.token();
        if (!token)
            throw new SdkError('UNAUTHENTICATED', 'no project session');
        const headers = new Headers(init.headers);
        headers.set('authorization', `Bearer ${token}`);
        let response;
        try {
            response = await options.fetch(url, { ...init, headers });
        }
        catch (cause) {
            throw new SdkError('GATEWAY_UNAVAILABLE', 'gateway is unreachable', {
                retryable: true,
                cause,
            });
        }
        if (response.status === 401) {
            await readResponse(response.clone(), options.onUnauthenticated).catch(() => { });
        }
        return response;
    }
    async function authorizedFetch(url, init = {}) {
        const response = await forward(url, init);
        if (!response.ok)
            await readResponse(response, options.onUnauthenticated);
        return response;
    }
    return {
        async send(path, { method = 'GET', body, headers = {} } = {}) {
            const response = await authorizedFetch(`${base}${path}`, {
                method,
                headers: {
                    ...headers,
                    ...(body === undefined ? {} : { 'content-type': 'application/json' }),
                },
                body: body === undefined ? undefined : JSON.stringify(body),
            });
            return readResponse(response, options.onUnauthenticated);
        },
        fetch: authorizedFetch,
        forward,
    };
}
/** Gateway の応答を値か `SdkError` にする（トークン無しで呼ぶ refresh / revoke も同じ規則で読む） */
export async function readResponse(response, onUnauthenticated = () => { }) {
    const text = await response.text();
    if (response.ok) {
        if (text === '')
            return undefined;
        try {
            return JSON.parse(text);
        }
        catch (cause) {
            throw new SdkError('GATEWAY_UNAVAILABLE', 'gateway returned a non-JSON body', {
                retryable: true,
                status: response.status,
                cause,
            });
        }
    }
    const parsed = parseErrorBody(text);
    if (response.status >= 500) {
        throw new SdkError('GATEWAY_UNAVAILABLE', 'gateway is unavailable', {
            retryable: true,
            status: response.status,
            ...(parsed?.requestId === undefined ? {} : { requestId: parsed.requestId }),
        });
    }
    const code = parsed?.code ?? sdkErrorCodeForStatus(response.status);
    if (response.status === 401)
        onUnauthenticated(code);
    throw new SdkError(code, parsed?.message ?? `gateway responded ${response.status}`, {
        retryable: parsed?.retryable,
        status: response.status,
        requestId: parsed?.requestId,
        details: parsed?.details,
        committed: parsed?.committed,
    });
}
function parseErrorBody(text) {
    try {
        const parsed = errorResponseSchema.safeParse(JSON.parse(text));
        return parsed.success ? parsed.data.error : null;
    }
    catch {
        // JSON でない本文（プロキシの HTML 等）。status からコードを決める
        return null;
    }
}
