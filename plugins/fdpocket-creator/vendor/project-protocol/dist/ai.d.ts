import { z } from 'zod';
/**
 * ミニアプリ内 AI（`ai.chat`。docs/designs/app-platform/project-ai.md §3・§7）の Gateway との契約。
 * 添付は Storage の `fileId` だけで受ける（URL・本体は App から受けない。Gateway が read ポリシーで確かめる）。
 */
/** 1 ターンの添付の数と合計（Worker のメモリと 1 リクエストの大きさの保護。§3.2） */
export declare const AI_ATTACHMENTS_MAX = 4;
export declare const AI_ATTACHMENTS_MAX_BYTES: number;
/** 1 ターンの本文（UTF-8） */
export declare const AI_MESSAGE_MAX_BYTES: number;
/**
 * 埋め込み（`/v1/ai/openai/embeddings`。project-ai.md §3.7）。モデルを指定しなければ既定のモデルで、次元は 1536。
 * 1 回の要求の上限は、OpenRouter への 1 往復で読み切れ、費用が大きく跳ねない大きさにしてある
 */
export declare const AI_EMBEDDING_MODEL_DEFAULT = "openai/text-embedding-3-small";
export declare const AI_EMBEDDING_INPUTS_MAX = 64;
export declare const AI_EMBEDDING_INPUT_CHARS_MAX = 32000;
export declare const AI_EMBEDDING_TOTAL_CHARS_MAX = 200000;
/** `dimensions` の上限（ベクトル検索の `@@platform.vector` は 1536 まで。search.md §3.4） */
export declare const AI_EMBEDDING_DIMENSIONS_MAX = 3072;
/** 埋め込みの応答（OpenAI の形。SDK が `encoding_format: 'float'` で読む） */
export declare const aiEmbeddingsResponse: z.ZodObject<{
    object: z.ZodLiteral<"list">;
    data: z.ZodArray<z.ZodObject<{
        index: z.ZodInt;
        embedding: z.ZodArray<z.ZodNumber>;
    }, z.core.$loose>>;
    model: z.ZodString;
}, z.core.$loose>;
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
export declare const aiTurnResult: import("./contract.ts").Contract<z.ZodObject<{
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
}, z.core.$strip>>;
export type AiTurnResult = z.output<typeof aiTurnResult.exact>;
/** SSE の data（`stream: true`） */
export declare const aiTurnEvent: import("./contract.ts").Contract<z.ZodDiscriminatedUnion<[z.ZodObject<{
    type: z.ZodLiteral<"delta">;
    text: z.ZodString;
}, z.core.$strip>, z.ZodObject<{
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
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
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
        CONTRACT_UNSUPPORTED: "CONTRACT_UNSUPPORTED";
    }>;
    message: z.ZodString;
}, z.core.$strip>], "type">>;
export type AiTurnEvent = z.output<typeof aiTurnEvent.exact>;
/** `POST /v1/ai/conversations/{conversation}/reset` */
export declare const aiResetResponse: import("./contract.ts").Contract<z.ZodObject<{
    conversation: z.ZodString;
}, z.core.$strip>>;
