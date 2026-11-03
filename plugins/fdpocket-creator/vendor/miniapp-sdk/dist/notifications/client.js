import { NOTIFICATION_STATUSES, notificationPermissionResult, notificationStatusResponse, } from '@workspace/project-protocol';
import { SdkError } from "../errors.js";
/** 知らない状態（後から足された値）は、許可されたとは扱わない */
function known(status) {
    return NOTIFICATION_STATUSES.includes(status)
        ? status
        : 'default';
}
export function createNotifications(transport, bridge) {
    return {
        async requestPermission(input) {
            const parsed = notificationPermissionResult.wire.safeParse(await bridge.request('notifications.requestPermission', input));
            if (!parsed.success) {
                throw new SdkError('HOST_UNAVAILABLE', 'unexpected permission result', { retryable: true });
            }
            return known(parsed.data.status);
        },
        async status() {
            const parsed = notificationStatusResponse.wire.safeParse(await transport.send('/v1/notifications/status'));
            if (!parsed.success) {
                throw new SdkError('GATEWAY_UNAVAILABLE', 'unexpected notifications response', {
                    retryable: true,
                });
            }
            return known(parsed.data.status);
        },
        async openSettings() {
            await bridge.request('notifications.openSettings');
        },
    };
}
