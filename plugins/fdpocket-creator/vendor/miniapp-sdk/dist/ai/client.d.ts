import { type AiTurnRequest, type Open, type AiTurnResult as ProtocolAiTurnResult } from '@workspace/project-protocol';
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
