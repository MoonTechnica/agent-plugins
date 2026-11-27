import { type AiSpeechFormat, type AiTurnRequest, type Open, type AiTurnResult as ProtocolAiTurnResult } from '@workspace/project-protocol';
import { type GatewayUrl, type Transport } from '../transport.ts';
export interface AiChatInput extends Omit<AiTurnRequest, 'stream'> {
    /** 渡すと SSE で受け、届いた分から順に呼ぶ（無ければ完了後にまとめて返す） */
    onToken?: (text: string) => void;
    /**
     * 待つのをやめる。始まったターンは Gateway が最後まで読み、使った分のクレジットを引く
     * （止めても費用は戻らない）
     */
    signal?: AbortSignal;
}
/**
 * ミニアプリ内 AI（project-ai.md §7）。費用は使った本人のクレジットから引く。
 * 失敗は `SdkError`（`QUOTA_EXCEEDED` なら `client.ui.openCredits()` で購入の導線を開ける）。
 */
export interface Ai {
    chat(input: AiChatInput): Promise<AiTurnResult>;
    /** 会話を切る（次のターンから履歴を送らない） */
    reset(conversation: string): Promise<void>;
    /**
     * OpenAI 互換の接続先（tasks/0537）。LangChain（`ChatOpenAI`）・Mastra / Vercel AI SDK（`createOpenAI`）・
     * OpenAI SDK に `baseURL`・`apiKey`・`fetch` をそのまま渡すと、ツール呼び出し・構造化出力・ストリーミングを
     * 含めて使える。費用・許可モデル・ファイル（`fdpocket-file:<fileId>`）の扱いは chat と同じ。
     * `model` は `auto`（Jev Router）か project.yaml の許可一覧の ID
     */
    openai(): OpenAiCompatible;
    /**
     * 文を埋め込み（意味を表す数のベクトル）にする（project-ai.md §3.7）。ベクトル検索（`@@platform.vector`）に保存・検索する値を作る。
     * 入力と同じ順のベクトルを返す（1 回 64 件まで）。`model` を省略すると既定の埋め込みモデル（1536 次元）。
     * 費用は使った本人のクレジットから引く（chat と同じ）。`dimensions` はベクトル検索の `dims` に合わせる
     */
    embed(input: string | readonly string[], options?: {
        model?: string;
        dimensions?: number;
        signal?: AbortSignal;
    }): Promise<{
        embeddings: number[][];
        model: string;
    }>;
    /**
     * 音声を文字にする（project-ai.md §3.8）。チャットに音声を添えるより、文字起こし専用のモデルのほうが
     * 正確で安い（日本語の短い音声で約 0.01 クレジット）。録音は 12 MiB まで（長い録音は区切って送る）。
     * 費用は使った本人のクレジットから引く（chat と同じ）
     */
    transcribe(input: AiTranscribeInput): Promise<AiTranscription>;
    /**
     * 文を音声にする（project-ai.md §3.8）。読み上げ・音声案内・音声つきの教材に使う。入力は 5,000 字まで。
     * 費用は文字数で決まり（既定のモデルで 1,000 字あたり約 4 セント）、使った本人のクレジットから**少し遅れて**引かれる
     * （OpenRouter が確定額を出してから精算する。残高の確認は呼ぶ前に行う）。利用者が押したときだけ呼ぶ
     */
    speak(input: AiSpeakInput): Promise<AiSpeech>;
    /**
     * 検索で取れた候補を、問いとの関連の強さで並べ直す（project-ai.md §3.8）。結果は関連が強い順で、
     * `index` は渡した `documents` の位置。ベクトル検索・全文検索の後段に置くと、上位の精度が上がる
     */
    rerank(input: AiRerankInput): Promise<{
        results: {
            index: number;
            score: number;
        }[];
        model: string;
    }>;
}
/** 文字起こしの入力。録音した `Blob` / `File`（ブラウザの `MediaRecorder` の webm・ogg・mp4 もそのまま）か、Storage の音声ファイル */
export interface AiTranscribeInput {
    audio: Blob | {
        fileId: string;
    };
    /** 話している言語（ISO 639-1。例 `ja`）。省略すると自動で判定する */
    language?: string;
    /** 固有名詞・専門用語などの手がかり（文章で渡す） */
    prompt?: string;
    /** 認識を寄せたい単語（人名・製品名など）。対応するモデル（例 `elevenlabs/scribe-v2`）だけ */
    keyterms?: string[];
    /** 話者ごとに分ける（`segments` に話者が付く）。対応するモデルだけ */
    diarize?: boolean;
    /** 省略すると既定のモデル。別名 `transcribe` か許可一覧の文字起こしモデルの ID */
    model?: string;
    signal?: AbortSignal;
}
export interface AiTranscription {
    text: string;
    language?: string;
    /** 音声の長さ（秒） */
    duration?: number;
    /** 区切りごとの文章と時刻（`diarize` なら話者つき）。対応するモデルだけ */
    segments?: {
        start?: number;
        end?: number;
        text?: string;
        speaker?: string | number;
    }[];
}
export interface AiSpeakInput {
    /** 読み上げる文（5,000 字まで。長い文章は区切って送る） */
    text: string;
    /** 声の名前。モデルごとに違う（`elevenlabs/eleven-flash-v2.5` は `sarah`・`george`・`alice` など、`google/gemini-3.8-flash-tts` は `Kore`・`Puck` など） */
    voice: string;
    /** 省略すると既定のモデル（別名 `speech`）。許可一覧の音声合成モデルの ID */
    model?: string;
    /** 出力の形式。省略は `mp3`（ブラウザの `<audio>` でそのまま鳴る）。Gemini は `mp3` が無いので `wav` を指定する */
    format?: AiSpeechFormat;
    /** 読む速さ（1 が標準。モデルごとに範囲が違う） */
    speed?: number;
    /** 話し方の指示（例「落ち着いた声で」）。対応するモデルだけ */
    instructions?: string;
    signal?: AbortSignal;
}
export interface AiSpeech {
    /** 音声。`URL.createObjectURL(audio)` を `<audio src>` に渡すと鳴る（鳴らし終えたら `URL.revokeObjectURL`） */
    audio: Blob;
    contentType: string;
}
export interface AiRerankInput {
    /** 探している内容（検索の問い） */
    query: string;
    /** 並べ替える候補（文字列。1 回 200 件まで） */
    documents: readonly string[];
    /** 上位だけ返す件数。省略すると全件 */
    topN?: number;
    /** 省略すると既定のモデル。別名 `rerank` か許可一覧の rerank モデルの ID */
    model?: string;
    signal?: AbortSignal;
}
export interface OpenAiCompatible {
    baseURL: string;
    /** SDK が必須にする値（中身は使わない。認証は fetch が付ける） */
    apiKey: string;
    fetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
}
export declare function createAi(transport: Transport, gateway: GatewayUrl): Ai;
/** 読む側の結果。後から足された終わり方も入りうる */
export type AiTurnResult = Open<ProtocolAiTurnResult>;
