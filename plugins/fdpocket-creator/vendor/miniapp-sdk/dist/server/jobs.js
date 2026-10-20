import { jobCancelResponseSchema, jobScheduleRequestSchema, jobScheduleResponseSchema, } from '@workspace/project-protocol';
import { SdkError } from "../errors.js";
export function createJobs(send) {
    return {
        async schedule(input) {
            const body = jobScheduleRequestSchema.safeParse(input);
            if (!body.success)
                throw new SdkError('VALIDATION_FAILED', 'invalid job');
            const response = jobScheduleResponseSchema.safeParse(await send('/v1/jobs/schedule', body.data));
            if (!response.success)
                throw new SdkError('GATEWAY_UNAVAILABLE', 'invalid job response', { retryable: true });
            return response.data;
        },
        async cancel(id) {
            const response = jobCancelResponseSchema.safeParse(await send('/v1/jobs/cancel', { id }));
            if (!response.success)
                throw new SdkError('GATEWAY_UNAVAILABLE', 'invalid cancellation response', {
                    retryable: true,
                });
            return response.data;
        },
    };
}
