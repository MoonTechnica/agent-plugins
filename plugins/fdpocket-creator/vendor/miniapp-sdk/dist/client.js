import "./zod-jitless.js";
import { contextMessageSchema, contextUpdateMessageSchema, DIRECT_AUTH_START_PATH, initMessageSchema, PROTOCOL_VERSION, projectTokenClaimsSchema, RUNTIME_VERSION, tokenExchangeResponseSchema, } from '@workspace/project-protocol';
import { createAi } from "./ai/client.js";
import { createDbClient } from "./db/client.js";
import { SdkError } from "./errors.js";
import { createNotifications } from "./notifications/client.js";
import { createProfile } from "./profile/client.js";
import { createPython } from "./python/client.js";
import { createRealtime } from "./realtime/client.js";
import { createSafety } from "./safety/client.js";
import { createStorage } from "./storage/client.js";
import { createTransport, readResponse } from "./transport.js";
import { createUiBridge } from "./ui/client.js";
import { createWorkspaces } from "./workspaces/client.js";
/** 期限のこれだけ前に更新する */
const REFRESH_MARGIN_MS = 60_000;
/** Host の init を待つ時間の既定 */
const HOST_TIMEOUT_MS = 10_000;
/**
 * ブラウザ用の Project SDK（sdk.md §3）。トークンは**メモリだけ**に持つ
 * （localStorage / sessionStorage / cookie に置かない。XSS で持ち出せる場所を作らない）。
 */
export function createClient(options) {
    const fetchImpl = options.fetch ?? globalThis.fetch.bind(globalThis);
    const base = options.gateway.replace(/\/+$/, '');
    const listeners = new Set();
    let held = null;
    let timer;
    let refreshing = null;
    let stopHost;
    const bridge = createUiBridge();
    function set(next) {
        held = next;
        clearTimeout(timer);
        timer = undefined;
        if (next) {
            // 失敗は refresh() が session を捨てて通知する。ここで拾うのは未処理の reject を残さないため
            timer = setTimeout(() => void refresh().catch(() => undefined), Math.max(0, next.expiresAt - REFRESH_MARGIN_MS - Date.now()));
        }
        else {
            stopHost?.();
            stopHost = undefined;
        }
        const session = next?.session ?? null;
        for (const listener of listeners)
            listener(session);
    }
    /** トークンの claims を読み、この Project・App のものかを確かめる（署名は Gateway が毎回検証する） */
    function accept(token, expiresAt, session) {
        const claims = projectTokenClaimsSchema.safeParse(decodePayload(token));
        if (!claims.success)
            throw new SdkError('UNAUTHENTICATED', 'malformed project token');
        if (claims.data.aud !== options.projectId || claims.data.app !== options.app) {
            throw new SdkError('TOKEN_SCOPE_MISMATCH', 'token is for another project or app');
        }
        return { token, expiresAt: Date.parse(expiresAt), session };
    }
    function refresh() {
        refreshing ??= (async () => {
            const current = held;
            if (!current)
                throw new SdkError('UNAUTHENTICATED', 'no project session');
            let response;
            try {
                response = await fetchImpl(`${base}/v1/token/refresh`, {
                    method: 'POST',
                    headers: { authorization: `Bearer ${current.token}` },
                });
            }
            catch (cause) {
                throw new SdkError('GATEWAY_UNAVAILABLE', 'gateway is unreachable', {
                    retryable: true,
                    cause,
                });
            }
            try {
                const parsed = tokenExchangeResponseSchema.safeParse(await readResponse(response));
                if (!parsed.success) {
                    throw new SdkError('GATEWAY_UNAVAILABLE', 'unexpected refresh response', {
                        retryable: true,
                    });
                }
                const next = accept(parsed.data.token, parsed.data.expiresAt, parsed.data.session);
                set(next);
                return next.session;
            }
            catch (error) {
                if (error instanceof SdkError && error.code === 'GATEWAY_UNAVAILABLE')
                    throw error;
                // 失効・期限切れ・別のスコープ: 持っているトークンはもう使えない
                set(null);
                if (error instanceof SdkError && error.code === 'TOKEN_SCOPE_MISMATCH')
                    throw error;
                throw new SdkError('SESSION_EXPIRED', 'project session could not be refreshed', {
                    retryable: false,
                    cause: error,
                });
            }
        })().finally(() => {
            refreshing = null;
        });
        return refreshing;
    }
    const auth = {
        async signInWithSuperApp() {
            if (held)
                return;
            const win = options.window ?? globalThis.window;
            if (!win)
                throw new SdkError('HOST_UNAVAILABLE', 'browser is unavailable');
            if (win.parent && win.parent !== win) {
                await auth.fromHost();
                return;
            }
            if (!win.location)
                throw new SdkError('HOST_UNAVAILABLE', 'browser navigation is unavailable');
            const current = new URL(win.location.href);
            const target = new URL(DIRECT_AUTH_START_PATH, current.origin);
            target.searchParams.set('app', options.app);
            const appPrefix = `/${options.app}`;
            const pathname = options.app !== 'web' &&
                (current.pathname === appPrefix || current.pathname.startsWith(`${appPrefix}/`))
                ? current.pathname.slice(appPrefix.length) || '/'
                : current.pathname;
            target.searchParams.set('path', `${pathname}${current.search}${current.hash}`);
            win.location.assign(target.href);
        },
        fromHost({ timeoutMs = HOST_TIMEOUT_MS } = {}) {
            const win = options.window ?? globalThis.window;
            if (!win || win.parent === win || win.parent == null) {
                return Promise.reject(new SdkError('HOST_UNAVAILABLE', 'not embedded in the super app'));
            }
            return new Promise((resolve, reject) => {
                let port;
                const fail = (error) => {
                    cleanup();
                    port?.close();
                    reject(error);
                };
                const deadline = setTimeout(() => fail(new SdkError('HOST_UNAVAILABLE', 'host did not respond')), timeoutMs);
                const cleanup = () => {
                    clearTimeout(deadline);
                    win.removeEventListener('message', onInit);
                };
                function onInit(event) {
                    // Host（親の窓）からの init だけを受ける。MessagePort の上で以後を話す
                    if (event.source !== win?.parent)
                        return;
                    const init = initMessageSchema.safeParse(event.data);
                    const received = event.ports?.[0];
                    if (!init.success || !received)
                        return;
                    win?.removeEventListener('message', onInit);
                    port = received;
                    port.addEventListener('message', (message) => {
                        if (bridge.receive(message.data))
                            return;
                        const context = contextMessageSchema.safeParse(message.data);
                        if (context.success && !held) {
                            try {
                                const next = accept(context.data.token, context.data.expiresAt, context.data.session);
                                clearTimeout(deadline);
                                const connected = received;
                                bridge.attach(connected, context.data.safeArea, context.data.locale);
                                stopHost = () => {
                                    bridge.detach();
                                    connected.close();
                                };
                                set(next);
                                resolve(next.session);
                            }
                            catch (error) {
                                fail(error);
                            }
                            return;
                        }
                        const update = contextUpdateMessageSchema.safeParse(message.data);
                        if (update.success && held && update.data.safeArea) {
                            bridge.setSafeArea(update.data.safeArea);
                        }
                        if (update.success && held && update.data.token && update.data.expiresAt) {
                            try {
                                set(accept(update.data.token, update.data.expiresAt, update.data.session ?? held.session));
                            }
                            catch {
                                // 別のスコープのトークンは受け取らない（今のトークンを捨てる）
                                set(null);
                            }
                        }
                    });
                    port.start();
                    port.postMessage({
                        type: 'hello',
                        nonce: init.data.nonce,
                        protocolVersion: PROTOCOL_VERSION,
                        runtimeVersion: RUNTIME_VERSION,
                    });
                }
                win.addEventListener('message', onInit);
            });
        },
        session: () => held?.session ?? null,
        onChange(listener) {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
        can: (permission) => held?.session.permissions.includes(permission) ?? false,
        refresh,
        async signOut() {
            const current = held;
            set(null);
            if (!current)
                return;
            let response;
            try {
                response = await fetchImpl(`${base}/v1/token/revoke`, {
                    method: 'POST',
                    headers: { authorization: `Bearer ${current.token}` },
                });
            }
            catch (cause) {
                throw new SdkError('GATEWAY_UNAVAILABLE', 'gateway is unreachable', {
                    retryable: true,
                    cause,
                });
            }
            await readResponse(response);
        },
    };
    // 期限を過ぎたトークンは送らずに更新を試みる。401 はセッションを捨てる
    const transport = createTransport({
        gateway: base,
        fetch: fetchImpl,
        token: async () => {
            if (!held)
                return null;
            if (held.expiresAt <= Date.now())
                await refresh();
            return held?.token ?? null;
        },
        onUnauthenticated: () => set(null),
    });
    const realtime = createRealtime(transport, base, options.webSocket);
    listeners.add((session) => {
        if (!session)
            void realtime.removeAllChannels();
        else
            realtime.reauthenticate();
    });
    return {
        realtime,
        projectId: options.projectId,
        app: options.app,
        auth,
        profile: createProfile(transport),
        db: createDbClient(transport),
        idempotent: (key) => ({
            db: createDbClient(transport, { idempotencyKey: key }),
        }),
        storage: createStorage(transport, fetchImpl, base),
        ui: bridge.ui,
        safety: createSafety(transport, bridge),
        notifications: createNotifications(transport, bridge),
        workspaces: createWorkspaces(transport),
        ai: createAi(transport, base),
        python: createPython(transport),
        gateway: base,
        fetch: transport.fetch,
    };
}
/** JWT の payload（base64url の JSON）。読めなければ null */
function decodePayload(token) {
    const part = token.split('.')[1];
    if (!part)
        return null;
    try {
        const binary = atob(part.replaceAll('-', '+').replaceAll('_', '/'));
        return JSON.parse(new TextDecoder().decode(Uint8Array.from(binary, (c) => c.charCodeAt(0))));
    }
    catch {
        // 形の壊れたトークン。呼び出し側が UNAUTHENTICATED にする
        return null;
    }
}
