import { z } from 'zod';
import { appSlugSchema } from "./token.js";
export const jobScheduleRequestSchema = z
    .strictObject({
    app: appSlugSchema,
    handler: z
        .string()
        .regex(/^[A-Za-z_$][A-Za-z0-9_$]*$/)
        .max(64),
    payload: z.json(),
    idempotencyKey: z.string().min(1).max(128),
    runAt: z.iso.datetime().optional(),
})
    .refine((input) => new TextEncoder().encode(JSON.stringify(input.payload)).length <= 65_536, {
    message: 'job payload exceeds 64 KiB',
});
export const jobScheduleResponseSchema = z.strictObject({
    id: z.uuid(),
    status: z.enum(['pending', 'running', 'done', 'failed', 'cancelled']),
});
export const jobCancelRequestSchema = z.strictObject({ id: z.uuid() });
export const jobCancelResponseSchema = z.strictObject({ cancelled: z.boolean() });
/**
 * サーバーの App が今配送中の実行として Gateway を呼ぶときに添えるヘッダ（`queue:<job id>` / `schedule:<schedule id>` /
 * `python:<run id>`）。払う人は Platform が決める（登録した利用者・cron は Project の持ち主・python の実行はその実行の
 * 払う人。tasks/0537・python-backend.md §5）
 */
export const RUN_CONTEXT_HEADER = 'x-fdpocket-run';
