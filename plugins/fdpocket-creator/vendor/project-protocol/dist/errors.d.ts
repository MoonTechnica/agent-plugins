import { z } from 'zod';
/**
 * SDK のエラーコード（sdk.md §3.5）。Gateway が返し、SDK が `SdkError.code` に写す。
 * ユーザー向けの文言は持たない（i18n は App 側）。
 */
export declare const SDK_ERROR_CODES: readonly ["UNAUTHENTICATED", "SESSION_EXPIRED", "TOKEN_SCOPE_MISMATCH", "FORBIDDEN", "NOT_FOUND", "VALIDATION_FAILED", "POST_WRITE_READ_DENIED", "CONFLICT", "RATE_LIMITED", "QUOTA_EXCEEDED", "PAYLOAD_TOO_LARGE", "CONSENT_REQUIRED", "GATEWAY_UNAVAILABLE", "HOST_UNAVAILABLE", "REALTIME_DISABLED", "REALTIME_CAPACITY", "RESYNC_REQUIRED"];
export declare const sdkErrorCodeSchema: z.ZodEnum<{
    UNAUTHENTICATED: "UNAUTHENTICATED";
    SESSION_EXPIRED: "SESSION_EXPIRED";
    TOKEN_SCOPE_MISMATCH: "TOKEN_SCOPE_MISMATCH";
    FORBIDDEN: "FORBIDDEN";
    NOT_FOUND: "NOT_FOUND";
    VALIDATION_FAILED: "VALIDATION_FAILED";
    POST_WRITE_READ_DENIED: "POST_WRITE_READ_DENIED";
    CONFLICT: "CONFLICT";
    RATE_LIMITED: "RATE_LIMITED";
    QUOTA_EXCEEDED: "QUOTA_EXCEEDED";
    PAYLOAD_TOO_LARGE: "PAYLOAD_TOO_LARGE";
    CONSENT_REQUIRED: "CONSENT_REQUIRED";
    GATEWAY_UNAVAILABLE: "GATEWAY_UNAVAILABLE";
    HOST_UNAVAILABLE: "HOST_UNAVAILABLE";
    REALTIME_DISABLED: "REALTIME_DISABLED";
    REALTIME_CAPACITY: "REALTIME_CAPACITY";
    RESYNC_REQUIRED: "RESYNC_REQUIRED";
}>;
export type SdkErrorCode = z.infer<typeof sdkErrorCodeSchema>;
/**
 * Gateway が返す HTTP status。`FORBIDDEN` は App capability とポリシーのどちらで拒否したかを区別しない
 * （存在と権限の差を漏らさない）。`HOST_UNAVAILABLE` は bridge の中でしか起きない（参考値）。
 */
export declare const HTTP_STATUS_BY_ERROR: Readonly<Record<SdkErrorCode, number>>;
export declare function isRetryable(code: SdkErrorCode): boolean;
/**
 * 本文が読めない応答（Edge Runtime の 546 = CPU 超過、プロキシの 502 等）の status をコードにする。
 * 5xx は Gateway の判断ではないので、フェイルクローズの `GATEWAY_UNAVAILABLE`（retryable）。
 */
export declare function sdkErrorCodeForStatus(status: number): SdkErrorCode;
/** Gateway のエラー応答の本文 */
export declare const errorResponseSchema: z.ZodObject<{
    error: z.ZodObject<{
        code: z.ZodEnum<{
            UNAUTHENTICATED: "UNAUTHENTICATED";
            SESSION_EXPIRED: "SESSION_EXPIRED";
            TOKEN_SCOPE_MISMATCH: "TOKEN_SCOPE_MISMATCH";
            FORBIDDEN: "FORBIDDEN";
            NOT_FOUND: "NOT_FOUND";
            VALIDATION_FAILED: "VALIDATION_FAILED";
            POST_WRITE_READ_DENIED: "POST_WRITE_READ_DENIED";
            CONFLICT: "CONFLICT";
            RATE_LIMITED: "RATE_LIMITED";
            QUOTA_EXCEEDED: "QUOTA_EXCEEDED";
            PAYLOAD_TOO_LARGE: "PAYLOAD_TOO_LARGE";
            CONSENT_REQUIRED: "CONSENT_REQUIRED";
            GATEWAY_UNAVAILABLE: "GATEWAY_UNAVAILABLE";
            HOST_UNAVAILABLE: "HOST_UNAVAILABLE";
            REALTIME_DISABLED: "REALTIME_DISABLED";
            REALTIME_CAPACITY: "REALTIME_CAPACITY";
            RESYNC_REQUIRED: "RESYNC_REQUIRED";
        }>;
        message: z.ZodString;
        requestId: z.ZodOptional<z.ZodString>;
        retryable: z.ZodBoolean;
        committed: z.ZodOptional<z.ZodBoolean>;
        details: z.ZodOptional<z.ZodUnknown>;
    }, z.core.$strict>;
}, z.core.$strict>;
export type ErrorResponse = z.infer<typeof errorResponseSchema>;
