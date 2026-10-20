import { type NotificationStatus } from '@workspace/project-protocol';
import type { Transport } from '../transport.ts';
import type { UiBridge } from '../ui/client.ts';
/**
 * 通知の許可（integrations.md §2.2・sdk.md §3.3b）。ミニアプリごとで既定は OFF。
 * **ブラウザ SDK からは送れない**（送るのは project.yaml のトリガーとサーバー SDK の `notifications.send()`）。
 */
export interface Notifications {
    /**
     * スーパーアプリの許可シートを出す。**利用者のタップの中から呼ぶ**（Host が user activation を確かめ、
     * 起動直後の自動表示などは `FORBIDDEN`）。返り値は利用者が選んだあとの状態。
     * 埋め込まれていなければ `HOST_UNAVAILABLE`
     */
    requestPermission(input: {
        reason: string;
    }): Promise<NotificationStatus>;
    /** `granted` / `denied`（止めた）/ `default`（まだ聞いていない） */
    status(): Promise<NotificationStatus>;
    /** スーパーアプリのこのミニアプリの通知設定を開く。埋め込まれていなければ `HOST_UNAVAILABLE` */
    openSettings(): Promise<void>;
}
export declare function createNotifications(transport: Transport, bridge: UiBridge): Notifications;
