import { z } from 'zod';
/**
 * ミニアプリの通知の許可（integrations.md §2.2・sdk.md §3.3b）。
 * - 既定は OFF（`default`）。利用者がスーパーアプリのシートで押したときだけ `granted`。止めたら `denied`
 * - 正は Platform の `project_notification_subscriptions`（Project DB ではない）
 * - ミニアプリには状態だけを返す。端末・OneSignal の購読の情報は渡さない
 */
export const NOTIFICATION_STATUSES = ['granted', 'denied', 'default'];
export const notificationStatusSchema = z.enum(NOTIFICATION_STATUSES);
/** `GET /v1/notifications/status` */
export const notificationStatusResponseSchema = z.strictObject({
    status: notificationStatusSchema,
});
/** bridge の `notifications.requestPermission` の reply の `result` */
export const notificationPermissionResultSchema = notificationStatusResponseSchema;
/** Worker 専用の送信。宛先は同じ Project の User.id。文面は承認済みテンプレートから描画する。 */
export const notificationSendRequestSchema = z.strictObject({
    template: z.string().regex(/^[a-z][a-z0-9_]{0,63}$/),
    to: z.array(z.string().min(1).max(255)).min(1).max(500),
    params: z.record(z.string().max(64), z.union([z.string().max(4096), z.number().finite(), z.boolean()])),
    dedupeKey: z
        .string()
        .regex(/^[A-Za-z0-9._:-]{1,128}$/)
        .optional(),
});
export const notificationSendResponseSchema = z.strictObject({
    recipients: z.int().nonnegative(),
});
