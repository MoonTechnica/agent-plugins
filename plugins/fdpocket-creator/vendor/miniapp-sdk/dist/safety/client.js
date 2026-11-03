import { safetyBlocksResponse } from '@workspace/project-protocol';
import { SdkError } from "../errors.js";
export function createSafety(transport, bridge) {
    const blocks = async (send) => {
        const parsed = safetyBlocksResponse.wire.safeParse(await send);
        if (!parsed.success) {
            throw new SdkError('GATEWAY_UNAVAILABLE', 'unexpected safety response', { retryable: true });
        }
        return parsed.data.userIds;
    };
    return {
        report: async (input) => {
            await bridge.request('safety.report', input);
        },
        block: (userId) => blocks(transport.send('/v1/safety/blocks', { method: 'POST', body: { userId } })),
        blockedUserIds: () => blocks(transport.send('/v1/safety/blocks')),
    };
}
