import "../zod-jitless.js";
import { ACT_AS_HEADER, notificationSendRequestSchema, notificationSendResponseSchema, RUN_CONTEXT_HEADER, SERVICE_CREDENTIAL_PATTERN, serviceTokenResponseSchema, } from '@workspace/project-protocol';
import { createAi } from "../ai/client.js";
import { createDbClient } from "../db/client.js";
import { SdkError } from "../errors.js";
import { createPython } from "../python/client.js";
import { createStorage } from "../storage/client.js";
import { createTransport } from "../transport.js";
import { createJobs } from "./jobs.js";
/** Worker 専用。資格情報は Worker の binding に保ち、10 分の token だけを Gateway に送る。 */
export function createServerClient(options) {
    const { GATEWAY_URL: gateway, PLATFORM_SERVICE_CREDENTIAL: credential } = options.env;
    if (!SERVICE_CREDENTIAL_PATTERN.test(credential)) {
        throw new SdkError('UNAUTHENTICATED', 'invalid service credential');
    }
    const base = new URL(gateway).href.replace(/\/+$/, '');
    const fetchImpl = options.fetch ?? globalThis.fetch.bind(globalThis);
    const now = options.now ?? Date.now;
    let held = null;
    let pending = null;
    const credentials = createTransport({
        gateway: base,
        fetch: fetchImpl,
        token: async () => credential,
        onUnauthenticated: () => {
            held = null;
        },
    });
    async function serviceToken() {
        if (held && held.expiresAt - 60_000 > now())
            return held.token;
        pending ??= (async () => {
            const result = serviceTokenResponseSchema.safeParse(await credentials.send('/v1/token/service', { method: 'POST' }));
            if (!result.success || Date.parse(result.data.expiresAt) <= now()) {
                throw new SdkError('GATEWAY_UNAVAILABLE', 'invalid service token response', {
                    retryable: true,
                });
            }
            held = { token: result.data.token, expiresAt: Date.parse(result.data.expiresAt) };
            return held.token;
        })().finally(() => {
            pending = null;
        });
        return pending;
    }
    /** サービストークンで送る。`extra` は利用者（X-Act-As）・実行中のジョブ（x-fdpocket-run） */
    function serviceTransport(extra = {}) {
        return createTransport({
            gateway: base,
            token: serviceToken,
            fetch: (input, init) => {
                const headers = new Headers(init?.headers);
                for (const [name, value] of Object.entries(extra))
                    headers.set(name, value);
                return fetchImpl(input, { ...init, headers });
            },
            onUnauthenticated: () => {
                held = null;
            },
        });
    }
    const transportFor = (userToken) => serviceTransport(userToken ? { [ACT_AS_HEADER]: userToken } : {});
    function dataClient(userToken) {
        const transport = transportFor(userToken);
        return {
            db: createDbClient(transport),
            storage: createStorage(transport, fetchImpl, base),
            idempotent: (key) => ({
                db: createDbClient(transport, { idempotencyKey: key }),
            }),
        };
    }
    return {
        ...dataClient(),
        jobs: createJobs((path, body) => serviceTransport().send(path, { method: 'POST', body })),
        notifications: {
            async send(input) {
                const parsed = notificationSendRequestSchema.safeParse(input);
                if (!parsed.success)
                    throw new SdkError('VALIDATION_FAILED', 'invalid notification request');
                const body = parsed.data;
                const result = notificationSendResponseSchema.safeParse(await serviceTransport().send('/v1/notifications/send', { method: 'POST', body }));
                if (!result.success)
                    throw new SdkError('GATEWAY_UNAVAILABLE', 'invalid notification response', {
                        retryable: true,
                    });
                return result.data;
            },
        },
        asUser(input) {
            const token = typeof input === 'string'
                ? input
                : /^Bearer\s+(\S+)$/i.exec(input.headers.get('authorization') ?? '')?.[1];
            if (!token || /\s/.test(token))
                throw new SdkError('UNAUTHENTICATED', 'missing user token');
            const transport = transportFor(token);
            return {
                ...dataClient(token),
                ai: createAi(transport, base),
                jobs: createJobs((path, body) => transport.send(path, { method: 'POST', body })),
                python: createPython(transport),
            };
        },
        forJob(event) {
            const run = `${event.cron === undefined ? 'queue' : 'schedule'}:${event.id}`;
            const transport = serviceTransport({ [RUN_CONTEXT_HEADER]: run });
            return {
                ai: { openai: () => createAi(transport, base).openai() },
                python: createPython(transport),
            };
        },
    };
}
/** onFinish で届いたジョブの payload を確かめる（python-backend.md §4.2） */
export { pythonRunFinishedSchema } from '@workspace/project-protocol';
export { SdkError } from "../errors.js";
