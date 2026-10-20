import { type SafetyReportTarget } from '@workspace/project-protocol';
import type { Transport } from '../transport.ts';
import type { UiBridge } from '../ui/client.ts';
/**
 * 利用者の投稿の通報とブロック（compliance.md §4。App Store 4.7.1 / 1.2）。
 * 利用者が互いの投稿を読めるミニアプリは、投稿ごとに通報とブロックの入口を置く。
 */
export interface Safety {
    /**
     * スーパーアプリの通報画面を開く（運営の窓口への案内と、対象のコピー）。理由は窓口で書いてもらう。
     * 埋め込まれていなければ `HOST_UNAVAILABLE`
     */
    report(input: {
        target: SafetyReportTarget;
    }): Promise<void>;
    /**
     * その人をブロックする（スーパーアプリ全体で共通。外すのはスーパーアプリの設定から）。
     * 返り値はブロックしている人の User.id。読み取りは ZModel の `@@deny('read', authorId in auth().blockedUserIds)` が隠す
     */
    block(userId: string): Promise<string[]>;
    /** ブロックしている人の User.id（この Project を使ったことのある人だけ） */
    blockedUserIds(): Promise<string[]>;
}
export declare function createSafety(transport: Transport, bridge: UiBridge): Safety;
