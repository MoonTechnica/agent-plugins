import { BRIDGE_OP_PAYLOAD_SCHEMAS, replyMessageSchema, } from '@workspace/project-protocol';
import { SdkError } from "../errors.js";
const NO_INSETS = { top: 0, right: 0, bottom: 0, left: 0 };
/**
 * `client.ui`（sdk.md §3.4）。操作は bridge の `op` → `reply`（requestId で対応づける）。
 * standalone では no-op にせず `HOST_UNAVAILABLE`（App が分岐できるように）。
 * 利用者の操作（共有シート・権限の確認）を待つことがあるので、返事に期限は付けない。
 */
export function createUiBridge() {
    let port = null;
    let insets = NO_INSETS;
    let hostLocale = null;
    const listeners = new Set();
    const pending = new Map();
    function send(op, payload) {
        if (!port)
            return Promise.reject(new SdkError('HOST_UNAVAILABLE', 'not embedded in the super app'));
        if (!BRIDGE_OP_PAYLOAD_SCHEMAS[op].safeParse(payload).success) {
            return Promise.reject(new SdkError('VALIDATION_FAILED', `invalid input for ${op}`));
        }
        const requestId = crypto.randomUUID();
        const target = port;
        return new Promise((resolve, reject) => {
            pending.set(requestId, { resolve, reject });
            target.postMessage({ type: 'op', requestId, op, payload });
        });
    }
    return {
        request: send,
        ui: {
            host: () => (port ? 'superapp' : 'standalone'),
            locale: () => hostLocale ?? (globalThis.navigator?.language || 'en'),
            openShare: async (input) => {
                await send('ui.openShare', input);
            },
            close: async () => {
                await send('ui.close');
            },
            openCredits: async () => {
                await send('ui.openCredits');
            },
            navigate: async (input) => {
                await send('ui.navigate', input);
            },
            safeArea: () => insets,
            onSafeAreaChange(listener) {
                listeners.add(listener);
                return () => listeners.delete(listener);
            },
        },
        attach(next, safeArea, locale) {
            port = next;
            insets = safeArea;
            hostLocale = locale;
        },
        setSafeArea(next) {
            if (sameInsets(insets, next))
                return;
            insets = next;
            for (const listener of listeners)
                listener(next);
        },
        receive(data) {
            const reply = replyMessageSchema.safeParse(data);
            if (!reply.success)
                return false;
            const waiting = pending.get(reply.data.requestId);
            if (!waiting)
                return true;
            pending.delete(reply.data.requestId);
            if (reply.data.ok)
                waiting.resolve(reply.data.result);
            else {
                waiting.reject(new SdkError(reply.data.code, 'host rejected the operation', {
                    retryable: reply.data.retryable,
                }));
            }
            return true;
        },
        detach() {
            port = null;
            insets = NO_INSETS;
            hostLocale = null;
            for (const waiting of pending.values()) {
                waiting.reject(new SdkError('HOST_UNAVAILABLE', 'host bridge closed'));
            }
            pending.clear();
        },
    };
}
function sameInsets(a, b) {
    return a.top === b.top && a.right === b.right && a.bottom === b.bottom && a.left === b.left;
}
