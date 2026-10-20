import { type SdkErrorCode } from '@workspace/project-protocol';
/**
 * SDK のエラー（sdk.md §3.5）。失敗を `null` / `[]` で誤魔化さず、必ずこれを throw する。
 * ユーザー向けの文言は持たない（`code` で App が出し分ける。i18n は App 側）。
 */
export declare class SdkError extends Error {
    readonly code: SdkErrorCode;
    readonly retryable: boolean;
    readonly requestId?: string;
    readonly status?: number;
    readonly details?: unknown;
    /** `POST_WRITE_READ_DENIED` のとき true（書き込みは保存済み。sdk.md §3.2） */
    readonly committed?: boolean;
    constructor(code: SdkErrorCode, message: string, options?: {
        retryable?: boolean;
        requestId?: string;
        status?: number;
        details?: unknown;
        committed?: boolean;
        cause?: unknown;
    });
}
