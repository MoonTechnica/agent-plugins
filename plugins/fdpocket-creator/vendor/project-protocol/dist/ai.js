import { z } from 'zod';
import { SDK_ERROR_CODES } from "./errors.js";
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
export const aiTurnResultSchema = z.strictObject({
    text: z.string(),
    finishReason: z.enum(AI_FINISH_REASONS),
    /** Schema を指定したときの JSON（読めない・`finishReason` が `stop` 以外なら付かない） */
    json: z.unknown().optional(),
    /** このターンで引いたクレジット */
    credits: z.number().nonnegative(),
    /** OpenRouter の generation id */
    responseId: z.string(),
    /** 実際に使われたモデル（Jev Router なら選ばれたモデル） */
    model: z.string(),
});
/** SSE の data（`stream: true`） */
export const aiTurnEventSchema = z.discriminatedUnion('type', [
    z.strictObject({ type: z.literal('delta'), text: z.string() }),
    z.strictObject({ type: z.literal('done'), result: aiTurnResultSchema }),
    z.strictObject({ type: z.literal('error'), code: z.enum(SDK_ERROR_CODES), message: z.string() }),
]);
/** `POST /v1/ai/conversations/{conversation}/reset` */
export const aiResetResponseSchema = z.strictObject({ conversation: z.string() });
