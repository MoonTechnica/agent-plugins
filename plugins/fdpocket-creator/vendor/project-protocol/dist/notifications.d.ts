import { z } from 'zod';
/**
 * ミニアプリの通知の許可（integrations.md §2.2・sdk.md §3.3b）。
 * - 既定は OFF（`default`）。利用者がスーパーアプリのシートで押したときだけ `granted`。止めたら `denied`
 * - 正は Platform の `project_notification_subscriptions`（Project DB ではない）
 * - ミニアプリには状態だけを返す。端末・OneSignal の購読の情報は渡さない
 */
export declare const NOTIFICATION_STATUSES: readonly ["granted", "denied", "default"];
export declare const notificationStatusSchema: z.ZodEnum<{
    default: "default";
    granted: "granted";
    denied: "denied";
}>;
export type NotificationStatus = z.infer<typeof notificationStatusSchema>;
/** `GET /v1/notifications/status` */
export declare const notificationStatusResponseSchema: z.ZodObject<{
    status: z.ZodEnum<{
        default: "default";
        granted: "granted";
        denied: "denied";
    }>;
}, z.core.$strict>;
export type NotificationStatusResponse = z.infer<typeof notificationStatusResponseSchema>;
/** bridge の `notifications.requestPermission` の reply の `result` */
export declare const notificationPermissionResultSchema: z.ZodObject<{
    status: z.ZodEnum<{
        default: "default";
        granted: "granted";
        denied: "denied";
    }>;
}, z.core.$strict>;
export type NotificationPermissionResult = NotificationStatusResponse;
/** Worker 専用の送信。宛先は同じ Project の User.id。文面は承認済みテンプレートから描画する。 */
export declare const notificationSendRequestSchema: z.ZodObject<{
    template: z.ZodString;
    to: z.ZodArray<z.ZodString>;
    params: z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean]>>;
    dedupeKey: z.ZodOptional<z.ZodString>;
}, z.core.$strict>;
export type NotificationSendRequest = z.infer<typeof notificationSendRequestSchema>;
export declare const notificationSendResponseSchema: z.ZodObject<{
    recipients: z.ZodInt;
}, z.core.$strict>;
export type NotificationSendResponse = z.infer<typeof notificationSendResponseSchema>;
