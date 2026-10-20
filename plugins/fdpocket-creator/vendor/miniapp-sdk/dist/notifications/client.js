import { notificationPermissionResultSchema, notificationStatusResponseSchema, } from '@workspace/project-protocol';
import { SdkError } from "../errors.js";
export function createNotifications(transport, bridge) {
    return {
        async requestPermission(input) {
            const parsed = notificationPermissionResultSchema.safeParse(await bridge.request('notifications.requestPermission', input));
            if (!parsed.success) {
                throw new SdkError('HOST_UNAVAILABLE', 'unexpected permission result', { retryable: true });
            }
            return parsed.data.status;
        },
        async status() {
            const parsed = notificationStatusResponseSchema.safeParse(await transport.send('/v1/notifications/status'));
            if (!parsed.success) {
                throw new SdkError('GATEWAY_UNAVAILABLE', 'unexpected notifications response', {
                    retryable: true,
                });
            }
            return parsed.data.status;
        },
        async openSettings() {
            await bridge.request('notifications.openSettings');
        },
    };
}
