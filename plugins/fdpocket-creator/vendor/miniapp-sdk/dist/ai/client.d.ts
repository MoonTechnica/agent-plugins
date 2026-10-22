import { type AiTurnRequest, type AiTurnResult } from '@workspace/project-protocol';
import { type Transport } from '../transport.ts';
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
}
export declare function createAi(transport: Transport, gateway: string): Ai;
