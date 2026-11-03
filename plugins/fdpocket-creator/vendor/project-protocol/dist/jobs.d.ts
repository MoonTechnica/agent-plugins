import { z } from 'zod';
export declare const jobScheduleRequestSchema: z.ZodObject<{
    app: z.ZodString;
    handler: z.ZodString;
    payload: z.ZodJSONSchema;
    idempotencyKey: z.ZodString;
    runAt: z.ZodOptional<z.ZodISODateTime>;
}, z.core.$strict>;
export type JobScheduleRequest = z.infer<typeof jobScheduleRequestSchema>;
export declare const jobScheduleResponse: import("./contract.ts").Contract<z.ZodObject<{
    id: z.ZodUUID;
    status: z.ZodEnum<{
        running: "running";
        failed: "failed";
        cancelled: "cancelled";
        done: "done";
        pending: "pending";
    }>;
}, z.core.$strip>>;
export type JobScheduleResponse = z.output<typeof jobScheduleResponse.exact>;
export declare const jobCancelRequestSchema: z.ZodObject<{
    id: z.ZodUUID;
}, z.core.$strict>;
export declare const jobCancelResponse: import("./contract.ts").Contract<z.ZodObject<{
    cancelled: z.ZodBoolean;
}, z.core.$strip>>;
export type JobCancelResponse = z.output<typeof jobCancelResponse.exact>;
export interface JobDelivery {
    readonly id: string;
    readonly handler: string;
    readonly payload: JobScheduleRequest['payload'];
    readonly attempt: number;
    readonly scheduledTime: number;
    noRetry(): void;
}
/**
 * サーバーの App が今配送中の実行として Gateway を呼ぶときに添えるヘッダ（`queue:<job id>` / `schedule:<schedule id>` /
 * `python:<run id>`）。払う人は Platform が決める（登録した利用者・cron は Project の持ち主・python の実行はその実行の
 * 払う人。tasks/0537・python-backend.md §5）
 */
export declare const RUN_CONTEXT_HEADER = "x-fdpocket-run";
