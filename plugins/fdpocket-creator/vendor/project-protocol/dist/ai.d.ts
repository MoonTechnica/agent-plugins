import { z } from 'zod';
/**
 * ミニアプリ内 AI（`ai.chat`。docs/designs/app-platform/project-ai.md §3・§7）の Gateway との契約。
 * 添付は Storage の `fileId` だけで受ける（URL・本体は App から受けない。Gateway が read ポリシーで確かめる）。
 */
/** 1 ターンの添付の数と合計（Worker のメモリと 1 リクエストの大きさの保護。§3.2） */
/**
 * jobs の App が AI を呼ぶときに添える、今配送中の実行（`queue:<job id>` か `schedule:<schedule id>`）。
 * 払う人は Platform が決める（登録した利用者・cron は Project の持ち主。tasks/0537）
 */
export declare const AI_RUN_HEADER = "x-fdpocket-run";
export declare const AI_ATTACHMENTS_MAX = 4;
export declare const AI_ATTACHMENTS_MAX_BYTES: number;
/** 1 ターンの本文（UTF-8） */
export declare const AI_MESSAGE_MAX_BYTES: number;
export declare const AI_ATTACHMENT_KINDS: readonly ["image", "file", "audio", "video"];
export type AiAttachmentKind = (typeof AI_ATTACHMENT_KINDS)[number];
/** Content-Type（付帯情報は無視）→ 添付の種類。扱わない種類は null */
export declare function aiAttachmentKindOf(contentType: string): AiAttachmentKind | null;
/** `POST /v1/ai/turns` */
export declare const aiTurnRequestSchema: z.ZodObject<{
    conversation: z.ZodString;
    message: z.ZodString;
    attachments: z.ZodOptional<z.ZodArray<z.ZodObject<{
        fileId: z.ZodUUID;
    }, z.core.$strict>>>;
    instructions: z.ZodOptional<z.ZodString>;
    schema: z.ZodOptional<z.ZodString>;
    model: z.ZodOptional<z.ZodString>;
    stream: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strict>;
export type AiTurnRequest = z.infer<typeof aiTurnRequestSchema>;
/**
 * 応答の終わり方（OpenRouter の正規化済み `finish_reason`）。`length` は出力の上限で切れた
 * （推論するモデルでは推論のトークンも上限に含まれる）。tool_calls 等は `other`
 */
export declare const AI_FINISH_REASONS: readonly ["stop", "length", "content_filter", "other"];
export type AiFinishReason = (typeof AI_FINISH_REASONS)[number];
export declare const aiTurnResultSchema: z.ZodObject<{
    text: z.ZodString;
    finishReason: z.ZodEnum<{
        length: "length";
        stop: "stop";
        content_filter: "content_filter";
        other: "other";
    }>;
    json: z.ZodOptional<z.ZodUnknown>;
    credits: z.ZodNumber;
    responseId: z.ZodString;
    model: z.ZodString;
}, z.core.$strict>;
export type AiTurnResult = z.infer<typeof aiTurnResultSchema>;
/** SSE の data（`stream: true`） */
export declare const aiTurnEventSchema: z.ZodDiscriminatedUnion<[z.ZodObject<{
    type: z.ZodLiteral<"delta">;
    text: z.ZodString;
}, z.core.$strict>, z.ZodObject<{
    type: z.ZodLiteral<"done">;
    result: z.ZodObject<{
        text: z.ZodString;
        finishReason: z.ZodEnum<{
            length: "length";
            stop: "stop";
            content_filter: "content_filter";
            other: "other";
        }>;
        json: z.ZodOptional<z.ZodUnknown>;
        credits: z.ZodNumber;
        responseId: z.ZodString;
        model: z.ZodString;
    }, z.core.$strict>;
}, z.core.$strict>, z.ZodObject<{
    type: z.ZodLiteral<"error">;
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
}, z.core.$strict>], "type">;
export type AiTurnEvent = z.infer<typeof aiTurnEventSchema>;
/** `POST /v1/ai/conversations/{conversation}/reset` */
export declare const aiResetResponseSchema: z.ZodObject<{
    conversation: z.ZodString;
}, z.core.$strict>;
