import { z } from 'zod';
import { contract } from "./contract.js";
import { sdkErrorCode } from "./errors.js";
import { AI_INSTRUCTIONS_KEY_PATTERN, AI_SCHEMA_KEY_PATTERN } from "./manifest.js";
/**
 * ミニアプリ内 AI（`ai.chat`。docs/designs/app-platform/project-ai.md §3・§7）の Gateway との契約。
 * 添付は Storage の `fileId` だけで受ける（URL・本体は App から受けない。Gateway が read ポリシーで確かめる）。
 */
/** 1 ターンの添付の数と合計（Worker のメモリと 1 リクエストの大きさの保護。§3.2） */
export const AI_ATTACHMENTS_MAX = 4;
export const AI_ATTACHMENTS_MAX_BYTES = 20 * 1024 * 1024;
/** 1 ターンの本文（UTF-8） */
export const AI_MESSAGE_MAX_BYTES = 32 * 1024;
/**
 * 埋め込み（`/v1/ai/openai/embeddings`。project-ai.md §3.7）。モデルを指定しなければ既定のモデルで、次元は 1536。
 * 1 回の要求の上限は、OpenRouter への 1 往復で読み切れ、費用が大きく跳ねない大きさにしてある
 */
export const AI_EMBEDDING_MODEL_DEFAULT = 'openai/text-embedding-3-small';
export const AI_EMBEDDING_INPUTS_MAX = 64;
export const AI_EMBEDDING_INPUT_CHARS_MAX = 32_000;
export const AI_EMBEDDING_TOTAL_CHARS_MAX = 200_000;
/** `dimensions` の上限（ベクトル検索の `@@platform.vector` は 1536 まで。search.md §3.4） */
export const AI_EMBEDDING_DIMENSIONS_MAX = 3072;
/** 埋め込みの応答（OpenAI の形。SDK が `encoding_format: 'float'` で読む） */
export const aiEmbeddingsResponse = z.looseObject({
    object: z.literal('list'),
    data: z.array(z.looseObject({ index: z.int().min(0), embedding: z.array(z.number()) })),
    model: z.string(),
});
export const AI_ATTACHMENT_KINDS = ['image', 'file', 'audio', 'video'];
const ATTACHMENT_KINDS = {
    'image/png': 'image',
    'image/jpeg': 'image',
    'image/webp': 'image',
    'image/gif': 'image',
    'application/pdf': 'file',
    'audio/wav': 'audio',
    'audio/x-wav': 'audio',
    'audio/mpeg': 'audio',
    'audio/mp3': 'audio',
    'video/mp4': 'video',
    'video/webm': 'video',
    'video/quicktime': 'video',
};
/** Content-Type（付帯情報は無視）→ 添付の種類。扱わない種類は null */
export function aiAttachmentKindOf(contentType) {
    return ATTACHMENT_KINDS[contentType.split(';')[0]?.trim().toLowerCase() ?? ''] ?? null;
}
/** `POST /v1/ai/turns` */
export const aiTurnRequestSchema = z.strictObject({
    conversation: z.string().regex(/^[A-Za-z0-9_.:-]{1,64}$/),
    message: z
        .string()
        .min(1)
        .refine((text) => new TextEncoder().encode(text).byteLength <= AI_MESSAGE_MAX_BYTES, 'message is too long'),
    attachments: z
        .array(z.strictObject({ fileId: z.uuid() }))
        .max(AI_ATTACHMENTS_MAX)
        .optional(),
    instructions: z.string().regex(AI_INSTRUCTIONS_KEY_PATTERN).optional(),
    schema: z.string().regex(AI_SCHEMA_KEY_PATTERN).optional(),
    /** 別名か許可したモデル ID。省略は版の宣言（無ければ Jev Router） */
    model: z.string().min(1).max(160).optional(),
    /** true なら SSE（`delta` → `done`）、false なら完了後に JSON */
    stream: z.boolean().optional(),
});
/**
 * 応答の終わり方（OpenRouter の正規化済み `finish_reason`）。`length` は出力の上限で切れた
 * （推論するモデルでは推論のトークンも上限に含まれる）。tool_calls 等は `other`
 */
export const AI_FINISH_REASONS = ['stop', 'length', 'content_filter', 'other'];
export const aiTurnResult = contract((o) => o.object({
    text: z.string(),
    finishReason: o.enum(AI_FINISH_REASONS),
    /** Schema を指定したときの JSON（読めない・`finishReason` が `stop` 以外なら付かない） */
    json: z.unknown().optional(),
    /** このターンで引いたクレジット */
    credits: z.number().nonnegative(),
    /** OpenRouter の generation id */
    responseId: z.string(),
    /** 実際に使われたモデル（Jev Router なら選ばれたモデル） */
    model: z.string(),
}));
/** SSE の data（`stream: true`） */
export const aiTurnEvent = contract((o) => z.discriminatedUnion('type', [
    o.object({ type: z.literal('delta'), text: z.string() }),
    o.object({ type: z.literal('done'), result: aiTurnResult.in(o) }),
    o.object({ type: z.literal('error'), code: sdkErrorCode.in(o), message: z.string() }),
]));
/** `POST /v1/ai/conversations/{conversation}/reset` */
export const aiResetResponse = contract((o) => o.object({ conversation: z.string() }));
