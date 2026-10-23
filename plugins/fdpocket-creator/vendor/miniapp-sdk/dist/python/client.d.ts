import { type PythonRun } from '@workspace/project-protocol';
import type { Transport } from '../transport.ts';
/**
 * `client.python`（python-backend.md §4.2）: 同じ Project の python の App のタスク（GPU の AI 処理など）を依頼し、
 * 終わるまで待つ。費用は依頼した本人（画面）・その利用者（api の asUser）・ジョブの払う人（forJob）のクレジット。
 */
export interface PythonRunHandle {
    readonly runId: string;
    get(): Promise<PythonRun>;
    cancel(): Promise<PythonRun>;
    /**
     * 終わるまで（succeeded / failed / cancelled / timed_out / stopped）問い合わせる。失敗も結果として返す
     * （`status` と `error` を見る）。`timeoutMs` を過ぎたら待つのをやめる（実行は続く）
     */
    wait(options?: {
        timeoutMs?: number;
        intervalMs?: number;
        onProgress?: (run: PythonRun) => void;
    }): Promise<PythonRun>;
}
export interface Python {
    /** 依頼済みの実行を読む（onFinish で届いたジョブが `payload.runId` の結果を読む。依頼した本人か同じ環境のサービスだけ） */
    get(runId: string): Promise<PythonRun>;
    run(app: string, task: string, input: unknown, options?: {
        idempotencyKey?: string;
    }): Promise<PythonRunHandle>;
}
export declare function createPython(transport: Transport, sleep?: (ms: number) => Promise<void>): Python;
