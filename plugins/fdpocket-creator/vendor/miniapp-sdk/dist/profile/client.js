import { platformProfileResponseSchema } from '@workspace/project-protocol';
import { SdkError } from "../errors.js";
export function createProfile(transport) {
    return {
        async get() {
            const parsed = platformProfileResponseSchema.safeParse(await transport.send('/v1/profile'));
            if (!parsed.success) {
                throw new SdkError('GATEWAY_UNAVAILABLE', 'unexpected profile response', {
                    retryable: true,
                });
            }
            return parsed.data;
        },
    };
}
