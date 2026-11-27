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
/**
 * OpenRouter の「Chat 以外の入口」（project-ai.md §3.8）。許可モデル（`ai_models.operations`）が持つ種類と同じ綴り。
 * 新しい入口（音声合成・画像生成など）は、この一覧・許可モデルの行・Gateway の入口を足すだけで増やす
 */
export declare const AI_OPERATIONS: readonly ["chat", "embedding", "transcription", "speech", "rerank"];
export type AiOperation = (typeof AI_OPERATIONS)[number];
/**
 * 文字起こし（`/v1/ai/openai/audio/transcriptions`。project-ai.md §3.8）。モデルを指定しなければ既定のモデル。
 * 音声は Worker のメモリ（base64 にして OpenRouter へ渡す）に収まる大きさまで。長い録音は区切って送る
 */
export declare const AI_TRANSCRIPTION_MODEL_DEFAULT = "openai/gpt-4o-mini-transcribe";
export declare const AI_TRANSCRIPTION_MAX_BYTES: number;
export declare const AI_TRANSCRIPTION_KEYTERMS_MAX = 100;
export declare const AI_TRANSCRIPTION_PROMPT_MAX_CHARS = 2000;
/** 文字起こしに渡せる音声の形式（OpenRouter の `input_audio.format`。拡張子と同じ綴り） */
export declare const AI_TRANSCRIPTION_FORMATS: readonly ["wav", "mp3", "m4a", "mp4", "ogg", "webm", "flac", "aac"];
export type AiTranscriptionFormat = (typeof AI_TRANSCRIPTION_FORMATS)[number];
/**
 * Content-Type（付帯情報は無視）か、無ければファイル名の拡張子から音声の形式を決める。
 * ブラウザの録音（MediaRecorder）は webm / ogg / mp4 なので、wav・mp3 だけでは足りない
 */
export declare function aiTranscriptionFormatOf(contentType: string, filename?: string): AiTranscriptionFormat | null;
/** 文字起こしの応答（OpenAI の形。`usage.cost` は USD。SDK が読む項目だけを型にし、知らない項目は通す） */
export declare const aiTranscriptionResponse: z.ZodObject<{
    text: z.ZodString;
    language: z.ZodOptional<z.ZodString>;
    duration: z.ZodOptional<z.ZodNumber>;
    segments: z.ZodOptional<z.ZodArray<z.ZodObject<{
        start: z.ZodOptional<z.ZodNumber>;
        end: z.ZodOptional<z.ZodNumber>;
        text: z.ZodOptional<z.ZodString>;
        speaker: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
    }, z.core.$loose>>>;
    words: z.ZodOptional<z.ZodArray<z.ZodObject<{}, z.core.$loose>>>;
    usage: z.ZodOptional<z.ZodObject<{
        cost: z.ZodOptional<z.ZodNumber>;
        seconds: z.ZodOptional<z.ZodNumber>;
    }, z.core.$loose>>;
}, z.core.$loose>;
/**
 * 音声合成（`/v1/ai/openai/audio/speech`。project-ai.md §3.8）。文を音声にする。1 回の入力は費用が跳ねない長さまで
 * （既定のモデルは 1,000 文字あたり約 4 セント）。出力の形式はモデルごとに違う（ElevenLabs は mp3・pcm、Gemini は wav・pcm）。
 * 声の名前もモデルごとに違うので、Gateway は確かめずに OpenRouter に任せる（合わなければ 400 → `VALIDATION_FAILED`）
 */
export declare const AI_SPEECH_MODEL_DEFAULT = "elevenlabs/eleven-flash-v2.5";
export declare const AI_SPEECH_INPUT_CHARS_MAX = 5000;
export declare const AI_SPEECH_INSTRUCTIONS_CHARS_MAX = 1000;
export declare const AI_SPEECH_FORMATS: readonly ["mp3", "wav", "pcm"];
export type AiSpeechFormat = (typeof AI_SPEECH_FORMATS)[number];
/**
 * 並べ替え（rerank。`/v1/ai/openai/rerank`）。検索で取れた候補を、問いとの関連の強さで並べ直す
 * （ベクトル検索・全文検索の後段に置く。search.md）。1 回の要求の大きさは費用が跳ねない範囲
 */
export declare const AI_RERANK_MODEL_DEFAULT = "cohere/rerank-4-fast";
export declare const AI_RERANK_DOCUMENTS_MAX = 200;
export declare const AI_RERANK_DOCUMENT_CHARS_MAX = 16000;
export declare const AI_RERANK_QUERY_CHARS_MAX = 2000;
export declare const AI_RERANK_TOTAL_CHARS_MAX = 400000;
export declare const aiRerankResponse: z.ZodObject<{
    model: z.ZodOptional<z.ZodString>;
    results: z.ZodArray<z.ZodObject<{
        index: z.ZodInt;
        relevance_score: z.ZodNumber;
        document: z.ZodOptional<z.ZodObject<{
            text: z.ZodOptional<z.ZodString>;
        }, z.core.$loose>>;
    }, z.core.$loose>>;
    usage: z.ZodOptional<z.ZodObject<{
        cost: z.ZodOptional<z.ZodNumber>;
    }, z.core.$loose>>;
}, z.core.$loose>;
/**
 * PDF の読み取り方式（OpenRouter の `file-parser` プラグインの `pdf.engine`。project-ai.md §3.10）。
 * 指定しなければ OpenRouter が選ぶ（モデルが PDF を直接読めるなら `native`、読めなければ有料の OCR）。
 * - `text`: 無料のテキスト抽出（`cloudflare-ai`）。いちばん安いが、図・表・スキャンは読めず、文字が欠けることがある
 * - `ocr`: スキャンした PDF・画像の多い PDF 向け（`mistral-ocr`）。1 ページ 0.2 クレジット
 * - `native`: モデルに PDF を直接読ませる（入力トークンで課金。モデルが対応しているときだけ）
 */
export declare const AI_PDF_ENGINES: {
    readonly text: "cloudflare-ai";
    readonly ocr: "mistral-ocr";
    readonly native: "native";
};
export declare const AI_PDF_ENGINE_KEYS: readonly ["text", "ocr", "native"];
export type AiPdfEngine = (typeof AI_PDF_ENGINE_KEYS)[number];
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
    webSearch: z.ZodOptional<z.ZodBoolean>;
    pdfEngine: z.ZodOptional<z.ZodEnum<{
        text: "text";
        native: "native";
        ocr: "ocr";
    }>>;
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
    sources: z.ZodOptional<z.ZodArray<z.ZodObject<{
        url: z.ZodString;
        title: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>>;
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
        sources: z.ZodOptional<z.ZodArray<z.ZodObject<{
            url: z.ZodString;
            title: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>>;
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
