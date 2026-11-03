import { z } from 'zod';
import { type Open } from './contract.ts';
/**
 * SDK のエラーコード（sdk.md §3.5）。Gateway が返し、SDK が `SdkError.code` に写す。
 * ユーザー向けの文言は持たない（i18n は App 側）。
 *
 * 読む側（凍結された SDK）は知らないコードも受ける（`Open<SdkErrorCode>`）。Platform は後からコードを
 * 足してよいが、消してはいけない（contract-compatibility.md §4.2）。
 */
export declare const SDK_ERROR_CODES: readonly ["UNAUTHENTICATED", "SESSION_EXPIRED", "TOKEN_SCOPE_MISMATCH", "FORBIDDEN", "NOT_FOUND", "VALIDATION_FAILED", "POST_WRITE_READ_DENIED", "CONFLICT", "RATE_LIMITED", "QUOTA_EXCEEDED", "PAYLOAD_TOO_LARGE", "CONSENT_REQUIRED", "GATEWAY_UNAVAILABLE", "HOST_UNAVAILABLE", "REALTIME_DISABLED", "REALTIME_CAPACITY", "RESYNC_REQUIRED", "CONTRACT_UNSUPPORTED"];
export declare const sdkErrorCode: import("./contract.ts").Contract<z.ZodEnum<{
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
    CONTRACT_UNSUPPORTED: "CONTRACT_UNSUPPORTED";
}>>;
export type SdkErrorCode = z.output<typeof sdkErrorCode.exact>;
/** 読む側が受け取るコード。定義時に知らなかったものも含む */
export type WireSdkErrorCode = Open<SdkErrorCode>;
/**
 * Gateway が返す HTTP status。`FORBIDDEN` は App capability とポリシーのどちらで拒否したかを区別しない
 * （存在と権限の差を漏らさない）。`HOST_UNAVAILABLE` は bridge の中でしか起きない（参考値）。
 */
export declare const HTTP_STATUS_BY_ERROR: Readonly<Record<SdkErrorCode, number>>;
/** 知らないコードは再試行しない（送る側が `retryable` を付けるので、読む側はそれを優先する） */
export declare function isRetryable(code: WireSdkErrorCode): boolean;
/**
 * 本文が読めない応答（Edge Runtime の 546 = CPU 超過、プロキシの 502 等）の status をコードにする。
 * 5xx は Gateway の判断ではないので、フェイルクローズの `GATEWAY_UNAVAILABLE`（retryable）。
 */
export declare function sdkErrorCodeForStatus(status: number): SdkErrorCode;
/** Gateway のエラー応答の本文 */
export declare const errorResponse: import("./contract.ts").Contract<z.ZodObject<{
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
            CONTRACT_UNSUPPORTED: "CONTRACT_UNSUPPORTED";
        }>;
        message: z.ZodString;
        requestId: z.ZodOptional<z.ZodString>;
        retryable: z.ZodBoolean;
        committed: z.ZodOptional<z.ZodBoolean>;
        details: z.ZodOptional<z.ZodUnknown>;
    }, z.core.$strip>;
}, z.core.$strip>>;
export type ErrorResponse = z.output<typeof errorResponse.exact>;
