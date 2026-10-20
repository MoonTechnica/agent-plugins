import { z } from 'zod';
export declare const jobScheduleRequestSchema: z.ZodObject<{
    app: z.ZodString;
    handler: z.ZodString;
    payload: z.ZodJSONSchema;
    idempotencyKey: z.ZodString;
    runAt: z.ZodOptional<z.ZodISODateTime>;
}, z.core.$strict>;
export type JobScheduleRequest = z.infer<typeof jobScheduleRequestSchema>;
export declare const jobScheduleResponseSchema: z.ZodObject<{
    id: z.ZodUUID;
    status: z.ZodEnum<{
        pending: "pending";
        running: "running";
        done: "done";
        failed: "failed";
        cancelled: "cancelled";
    }>;
}, z.core.$strict>;
export type JobScheduleResponse = z.infer<typeof jobScheduleResponseSchema>;
export declare const jobCancelRequestSchema: z.ZodObject<{
    id: z.ZodUUID;
}, z.core.$strict>;
export declare const jobCancelResponseSchema: z.ZodObject<{
    cancelled: z.ZodBoolean;
}, z.core.$strict>;
export type JobCancelResponse = z.infer<typeof jobCancelResponseSchema>;
export interface JobDelivery {
    readonly id: string;
    readonly handler: string;
    readonly payload: JobScheduleRequest['payload'];
    readonly attempt: number;
    readonly scheduledTime: number;
    noRetry(): void;
}
