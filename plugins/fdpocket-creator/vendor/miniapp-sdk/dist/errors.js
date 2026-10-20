import { isRetryable } from '@workspace/project-protocol';
/**
 * SDK のエラー（sdk.md §3.5）。失敗を `null` / `[]` で誤魔化さず、必ずこれを throw する。
 * ユーザー向けの文言は持たない（`code` で App が出し分ける。i18n は App 側）。
 */
export class SdkError extends Error {
    code;
    retryable;
    requestId;
    status;
    details;
    /** `POST_WRITE_READ_DENIED` のとき true（書き込みは保存済み。sdk.md §3.2） */
    committed;
    constructor(code, message, options = {}) {
        super(message, options.cause === undefined ? undefined : { cause: options.cause });
        this.name = 'SdkError';
        this.code = code;
        this.retryable = options.retryable ?? isRetryable(code);
        if (options.requestId !== undefined)
            this.requestId = options.requestId;
        if (options.status !== undefined)
            this.status = options.status;
        if (options.details !== undefined)
            this.details = options.details;
        if (options.committed !== undefined)
            this.committed = options.committed;
    }
}
