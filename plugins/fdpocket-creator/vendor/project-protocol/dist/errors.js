import { z } from 'zod';
/**
 * SDK のエラーコード（sdk.md §3.5）。Gateway が返し、SDK が `SdkError.code` に写す。
 * ユーザー向けの文言は持たない（i18n は App 側）。
 */
export const SDK_ERROR_CODES = [
    'UNAUTHENTICATED',
    'SESSION_EXPIRED',
    'TOKEN_SCOPE_MISMATCH',
    'FORBIDDEN',
    'NOT_FOUND',
    'VALIDATION_FAILED',
    'POST_WRITE_READ_DENIED',
    'CONFLICT',
    'RATE_LIMITED',
    'QUOTA_EXCEEDED',
    'PAYLOAD_TOO_LARGE',
    'CONSENT_REQUIRED',
    'GATEWAY_UNAVAILABLE',
    'HOST_UNAVAILABLE',
    'REALTIME_DISABLED',
    'REALTIME_CAPACITY',
    'RESYNC_REQUIRED',
];
export const sdkErrorCodeSchema = z.enum(SDK_ERROR_CODES);
/**
 * Gateway が返す HTTP status。`FORBIDDEN` は App capability とポリシーのどちらで拒否したかを区別しない
 * （存在と権限の差を漏らさない）。`HOST_UNAVAILABLE` は bridge の中でしか起きない（参考値）。
 */
export const HTTP_STATUS_BY_ERROR = {
    UNAUTHENTICATED: 401,
    SESSION_EXPIRED: 401,
    TOKEN_SCOPE_MISMATCH: 403,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    VALIDATION_FAILED: 422,
    POST_WRITE_READ_DENIED: 403,
    CONFLICT: 409,
    RATE_LIMITED: 429,
    QUOTA_EXCEEDED: 429,
    PAYLOAD_TOO_LARGE: 413,
    CONSENT_REQUIRED: 403,
    GATEWAY_UNAVAILABLE: 503,
    HOST_UNAVAILABLE: 503,
    REALTIME_DISABLED: 403,
    REALTIME_CAPACITY: 429,
    RESYNC_REQUIRED: 409,
};
const RETRYABLE = new Set([
    'REALTIME_CAPACITY',
    'CONFLICT',
    'RATE_LIMITED',
    'GATEWAY_UNAVAILABLE',
]);
export function isRetryable(code) {
    return RETRYABLE.has(code);
}
/**
 * 本文が読めない応答（Edge Runtime の 546 = CPU 超過、プロキシの 502 等）の status をコードにする。
 * 5xx は Gateway の判断ではないので、フェイルクローズの `GATEWAY_UNAVAILABLE`（retryable）。
 */
export function sdkErrorCodeForStatus(status) {
    if (status >= 500)
        return 'GATEWAY_UNAVAILABLE';
    switch (status) {
        case 401:
            return 'UNAUTHENTICATED';
        case 403:
            return 'FORBIDDEN';
        case 404:
            return 'NOT_FOUND';
        case 409:
            return 'CONFLICT';
        case 413:
            return 'PAYLOAD_TOO_LARGE';
        case 422:
        case 400:
            return 'VALIDATION_FAILED';
        case 429:
            return 'RATE_LIMITED';
        default:
            return 'GATEWAY_UNAVAILABLE';
    }
}
/** Gateway のエラー応答の本文 */
export const errorResponseSchema = z.strictObject({
    error: z.strictObject({
        code: sdkErrorCodeSchema,
        message: z.string(),
        requestId: z.string().optional(),
        retryable: z.boolean(),
        /** `POST_WRITE_READ_DENIED` のとき true（書き込みは保存済み。sdk.md §3.2） */
        committed: z.boolean().optional(),
        details: z.unknown().optional(),
    }),
});
