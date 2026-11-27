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
/**
 * OpenRouter の「Chat 以外の入口」（project-ai.md §3.8）。許可モデル（`ai_models.operations`）が持つ種類と同じ綴り。
 * 新しい入口（音声合成・画像生成など）は、この一覧・許可モデルの行・Gateway の入口を足すだけで増やす
 */
export const AI_OPERATIONS = ['chat', 'embedding', 'transcription', 'speech', 'rerank'];
/**
 * 文字起こし（`/v1/ai/openai/audio/transcriptions`。project-ai.md §3.8）。モデルを指定しなければ既定のモデル。
 * 音声は Worker のメモリ（base64 にして OpenRouter へ渡す）に収まる大きさまで。長い録音は区切って送る
 */
export const AI_TRANSCRIPTION_MODEL_DEFAULT = 'openai/gpt-4o-mini-transcribe';
export const AI_TRANSCRIPTION_MAX_BYTES = 12 * 1024 * 1024;
export const AI_TRANSCRIPTION_KEYTERMS_MAX = 100;
export const AI_TRANSCRIPTION_PROMPT_MAX_CHARS = 2_000;
/** 文字起こしに渡せる音声の形式（OpenRouter の `input_audio.format`。拡張子と同じ綴り） */
export const AI_TRANSCRIPTION_FORMATS = [
    'wav',
    'mp3',
    'm4a',
    'mp4',
    'ogg',
    'webm',
    'flac',
    'aac',
];
const TRANSCRIPTION_CONTENT_TYPES = {
    'audio/wav': 'wav',
    'audio/x-wav': 'wav',
    'audio/wave': 'wav',
    'audio/mpeg': 'mp3',
    'audio/mp3': 'mp3',
    'audio/mp4': 'm4a',
    'audio/x-m4a': 'm4a',
    'audio/m4a': 'm4a',
    'video/mp4': 'mp4',
    'audio/ogg': 'ogg',
    'audio/opus': 'ogg',
    'audio/webm': 'webm',
    'video/webm': 'webm',
    'audio/flac': 'flac',
    'audio/x-flac': 'flac',
    'audio/aac': 'aac',
};
/**
 * Content-Type（付帯情報は無視）か、無ければファイル名の拡張子から音声の形式を決める。
 * ブラウザの録音（MediaRecorder）は webm / ogg / mp4 なので、wav・mp3 だけでは足りない
 */
export function aiTranscriptionFormatOf(contentType, filename) {
    const byType = TRANSCRIPTION_CONTENT_TYPES[contentType.split(';')[0]?.trim().toLowerCase() ?? ''];
    if (byType)
        return byType;
    const extension = filename?.split('.').pop()?.toLowerCase();
    return AI_TRANSCRIPTION_FORMATS.includes(extension ?? '')
        ? extension
        : null;
}
/** 文字起こしの応答（OpenAI の形。`usage.cost` は USD。SDK が読む項目だけを型にし、知らない項目は通す） */
export const aiTranscriptionResponse = z.looseObject({
    text: z.string(),
    language: z.string().optional(),
    duration: z.number().optional(),
    segments: z
        .array(z.looseObject({
        start: z.number().optional(),
        end: z.number().optional(),
        text: z.string().optional(),
        speaker: z.union([z.string(), z.number()]).optional(),
    }))
        .optional(),
    words: z.array(z.looseObject({})).optional(),
    usage: z.looseObject({ cost: z.number().optional(), seconds: z.number().optional() }).optional(),
});
/**
 * 音声合成（`/v1/ai/openai/audio/speech`。project-ai.md §3.8）。文を音声にする。1 回の入力は費用が跳ねない長さまで
 * （既定のモデルは 1,000 文字あたり約 4 セント）。出力の形式はモデルごとに違う（ElevenLabs は mp3・pcm、Gemini は wav・pcm）。
 * 声の名前もモデルごとに違うので、Gateway は確かめずに OpenRouter に任せる（合わなければ 400 → `VALIDATION_FAILED`）
 */
export const AI_SPEECH_MODEL_DEFAULT = 'elevenlabs/eleven-flash-v2.5';
export const AI_SPEECH_INPUT_CHARS_MAX = 5_000;
export const AI_SPEECH_INSTRUCTIONS_CHARS_MAX = 1_000;
export const AI_SPEECH_FORMATS = ['mp3', 'wav', 'pcm'];
/**
 * 並べ替え（rerank。`/v1/ai/openai/rerank`）。検索で取れた候補を、問いとの関連の強さで並べ直す
 * （ベクトル検索・全文検索の後段に置く。search.md）。1 回の要求の大きさは費用が跳ねない範囲
 */
export const AI_RERANK_MODEL_DEFAULT = 'cohere/rerank-4-fast';
export const AI_RERANK_DOCUMENTS_MAX = 200;
export const AI_RERANK_DOCUMENT_CHARS_MAX = 16_000;
export const AI_RERANK_QUERY_CHARS_MAX = 2_000;
export const AI_RERANK_TOTAL_CHARS_MAX = 400_000;
export const aiRerankResponse = z.looseObject({
    model: z.string().optional(),
    results: z.array(z.looseObject({
        index: z.int().min(0),
        relevance_score: z.number(),
        document: z.looseObject({ text: z.string().optional() }).optional(),
    })),
    usage: z.looseObject({ cost: z.number().optional() }).optional(),
});
/**
 * PDF の読み取り方式（OpenRouter の `file-parser` プラグインの `pdf.engine`。project-ai.md §3.10）。
 * 指定しなければ OpenRouter が選ぶ（モデルが PDF を直接読めるなら `native`、読めなければ有料の OCR）。
 * - `text`: 無料のテキスト抽出（`cloudflare-ai`）。いちばん安いが、図・表・スキャンは読めず、文字が欠けることがある
 * - `ocr`: スキャンした PDF・画像の多い PDF 向け（`mistral-ocr`）。1 ページ 0.2 クレジット
 * - `native`: モデルに PDF を直接読ませる（入力トークンで課金。モデルが対応しているときだけ）
 */
export const AI_PDF_ENGINES = {
    text: 'cloudflare-ai',
    ocr: 'mistral-ocr',
    native: 'native',
};
export const AI_PDF_ENGINE_KEYS = ['text', 'ocr', 'native'];
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
    /** true なら、モデルが必要と判断したときに Web を検索して答える（1 回 約 0.7 セント。回数・結果数に上限。引用は `sources`） */
    webSearch: z.boolean().optional(),
    /** 添付の PDF の読み取り方式（省略は OpenRouter が選ぶ）。費用と精度の違いは `AI_PDF_ENGINES` */
    pdfEngine: z.enum(AI_PDF_ENGINE_KEYS).optional(),
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
    /** Web 検索で使った出典（`webSearch` のときだけ。無ければ付かない） */
    sources: z.array(z.object({ url: z.string(), title: z.string().optional() })).optional(),
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
