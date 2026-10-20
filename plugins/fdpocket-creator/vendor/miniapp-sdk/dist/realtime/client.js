import { REALTIME_LIMITS, realtimeJoinSchema, sdkErrorCodeSchema, } from '@workspace/project-protocol';
import { deserialize } from '@zenstackhq/client-helpers/fetch';
import { SdkError } from "../errors.js";
const error = (message) => new SdkError('GATEWAY_UNAVAILABLE', message, { retryable: true });
function decodeRealtime(input) {
    if (!input || typeof input !== 'object' || !('meta' in input))
        return input;
    const { meta, ...data } = input;
    const serialization = meta
        ?.serialization;
    return deserialize(data, serialization);
}
/** One socket per authorized room; ephemeral commands are never replayed after disconnect. */
export function createRealtime(transport, gateway, socketFactory = (url) => new WebSocket(url)) {
    const channels = new Set();
    const reconnectors = new Map();
    const realtime = {
        reauthenticate() {
            for (const reconnect of reconnectors.values())
                reconnect();
        },
        channel(name, options = {}) {
            if (channels.size >= REALTIME_LIMITS.channels)
                throw new SdkError('RATE_LIMITED', 'maximum 10 realtime channels');
            const listeners = [];
            let statusCallback;
            let socket;
            let active = false;
            let connected = false;
            let attempt = 0;
            let generation = 0;
            let ref = 0;
            let snapshot = [];
            let presence = {};
            let reconnect;
            let deadline;
            let heartbeat;
            const seen = new Set();
            const pending = new Map();
            const notify = (status, failure) => failure ? statusCallback?.(status, failure) : statusCallback?.(status);
            function dispatch(type, payload, event, model) {
                for (const listener of listeners) {
                    if (listener.type !== type)
                        continue;
                    if (listener.filter.event !== '*' && listener.filter.event !== event)
                        continue;
                    if ('model' in listener.filter && listener.filter.model !== model)
                        continue;
                    listener.callback(payload);
                }
            }
            function clearConnection(failure) {
                connected = false;
                presence = {};
                snapshot = [];
                clearTimeout(deadline);
                clearTimeout(reconnect);
                clearInterval(heartbeat);
                for (const request of pending.values()) {
                    clearTimeout(request.timer);
                    request.reject(failure);
                }
                pending.clear();
            }
            function fail(failure, retry) {
                generation++;
                clearConnection(failure);
                const previous = socket;
                socket = undefined;
                previous?.close(1000);
                notify('CHANNEL_ERROR', failure);
                if (active && retry)
                    reconnect = setTimeout(() => void connect(), Math.min(30000, 1000 * 2 ** attempt++) * (0.75 + Math.random() * 0.5));
                else
                    active = false;
            }
            function command(type, payload) {
                if (!connected || socket?.readyState !== 1)
                    return Promise.reject(error('realtime channel is not subscribed'));
                if (socket.bufferedAmount > 262144)
                    return Promise.reject(error('realtime send buffer is full'));
                if (pending.size >= 100)
                    return Promise.reject(new SdkError('RATE_LIMITED', 'too many pending realtime commands'));
                const id = String(++ref);
                let encoded;
                try {
                    encoded = JSON.stringify({ version: 1, ref: id, type, payload });
                }
                catch (cause) {
                    console.error('Realtime payload encoding failed');
                    return Promise.reject(new SdkError('VALIDATION_FAILED', 'realtime payload must be JSON', { cause }));
                }
                if (new TextEncoder().encode(encoded).byteLength > REALTIME_LIMITS.frameBytes)
                    return Promise.reject(new SdkError('VALIDATION_FAILED', 'realtime frame is too large'));
                return new Promise((resolve, reject) => {
                    const timer = setTimeout(() => {
                        pending.delete(id);
                        reject(error('realtime command timed out'));
                    }, 10000);
                    pending.set(id, { resolve, reject, timer });
                    try {
                        socket?.send(encoded);
                    }
                    catch (cause) {
                        console.error('Realtime command failed');
                        clearTimeout(timer);
                        pending.delete(id);
                        reject(cause instanceof Error ? cause : error('realtime command failed'));
                    }
                });
            }
            async function connect() {
                const current = ++generation;
                deadline = setTimeout(() => {
                    if (!active || current !== generation)
                        return;
                    notify('TIMED_OUT', error('realtime subscribe timed out'));
                    fail(error('realtime subscribe timed out'), true);
                }, 10000);
                try {
                    const body = realtimeJoinSchema.safeParse({
                        channel: name,
                        ...options,
                        changes: listeners.filter((l) => l.type === 'db_changes').map((l) => l.filter),
                    });
                    if (!body.success)
                        throw new SdkError('VALIDATION_FAILED', 'invalid realtime channel or subscription');
                    const result = await transport.send('/v1/realtime/tickets', {
                        method: 'POST',
                        body: body.data,
                    });
                    if (!active || current !== generation)
                        return;
                    if (!result ||
                        typeof result !== 'object' ||
                        !('ticket' in result) ||
                        typeof result.ticket !== 'string' ||
                        !('socketUrl' in result) ||
                        typeof result.socketUrl !== 'string')
                        throw error('invalid realtime ticket response');
                    const url = new URL(result.socketUrl);
                    const expected = new URL(gateway);
                    expected.protocol = expected.protocol === 'https:' ? 'wss:' : 'ws:';
                    if (url.origin !== expected.origin ||
                        url.pathname !==
                            `${new URL(gateway).pathname.replace(/\/+$/, '')}/v1/realtime/socket` ||
                        url.username ||
                        url.password ||
                        url.hash ||
                        [...url.searchParams.keys()].some((key) => key !== 'room'))
                        throw error('invalid realtime socket URL');
                    const ws = socketFactory(url.href);
                    socket = ws;
                    ws.addEventListener('open', () => {
                        if (socket === ws)
                            ws.send(JSON.stringify({
                                version: 1,
                                ref: String(++ref),
                                type: 'authenticate',
                                payload: { ticket: result.ticket },
                            }));
                    });
                    ws.addEventListener('message', (event) => {
                        if (socket !== ws)
                            return;
                        try {
                            const frame = JSON.parse(String(event.data));
                            if (frame.version !== 1 || typeof frame.type !== 'string')
                                throw error('invalid realtime frame');
                            if (frame.type === 'error') {
                                const code = sdkErrorCodeSchema.safeParse(frame.payload?.code);
                                const failure = new SdkError(code.success ? code.data : 'GATEWAY_UNAVAILABLE', typeof frame.payload?.message === 'string'
                                    ? frame.payload.message
                                    : 'realtime server error', { retryable: frame.payload?.retryable === true });
                                fail(failure, failure.retryable || failure.code === 'RESYNC_REQUIRED');
                            }
                            else if (frame.type === 'ack') {
                                if (frame.payload?.status === 'SUBSCRIBED' && !connected) {
                                    clearTimeout(deadline);
                                    connected = true;
                                    seen.clear();
                                    attempt = 0;
                                    if (!Array.isArray(frame.payload.snapshot) ||
                                        !frame.payload.presence ||
                                        typeof frame.payload.presence !== 'object')
                                        throw error('invalid realtime subscription snapshot');
                                    snapshot = frame.payload.snapshot.map((group) => decodeRealtime(group));
                                    presence = frame.payload.presence;
                                    notify('SUBSCRIBED');
                                    dispatch('presence', { event: 'sync' }, 'sync');
                                    heartbeat = setInterval(() => {
                                        void command('heartbeat', {}).catch((cause) => {
                                            console.error('Realtime heartbeat failed');
                                            if (active && socket === ws)
                                                fail(cause, true);
                                        });
                                    }, REALTIME_LIMITS.heartbeatMs);
                                }
                                else {
                                    const request = pending.get(frame.ref);
                                    if (request) {
                                        clearTimeout(request.timer);
                                        pending.delete(frame.ref);
                                        if (frame.payload?.status !== 'ok')
                                            request.reject(error('invalid realtime command acknowledgement'));
                                        else
                                            request.resolve('ok');
                                    }
                                }
                            }
                            else if (connected && frame.type === 'db_changes') {
                                frame.payload = decodeRealtime(frame.payload);
                                if (!seen.has(frame.payload.eventId)) {
                                    seen.add(frame.payload.eventId);
                                    if (seen.size > 1000)
                                        seen.delete(seen.values().next().value);
                                    dispatch('db_changes', frame.payload, frame.payload.eventType, frame.payload.model);
                                }
                            }
                            else if (connected && frame.type === 'broadcast')
                                dispatch('broadcast', frame.payload, frame.payload.event);
                            else if (connected && frame.type === 'presence_sync') {
                                const before = presence;
                                if (!frame.payload?.state || typeof frame.payload.state !== 'object')
                                    throw error('invalid realtime presence state');
                                presence = frame.payload.state;
                                const difference = (left, right) => {
                                    const remaining = right.map((meta) => JSON.stringify(meta));
                                    return left.filter((meta) => {
                                        const index = remaining.indexOf(JSON.stringify(meta));
                                        if (index < 0)
                                            return true;
                                        remaining.splice(index, 1);
                                        return false;
                                    });
                                };
                                for (const key of new Set([...Object.keys(before), ...Object.keys(presence)])) {
                                    const joined = difference(presence[key] ?? [], before[key] ?? []);
                                    const left = difference(before[key] ?? [], presence[key] ?? []);
                                    if (joined.length)
                                        dispatch('presence', { key, newPresences: joined }, 'join');
                                    if (left.length)
                                        dispatch('presence', { key, leftPresences: left }, 'leave');
                                }
                                dispatch('presence', { event: 'sync' }, 'sync');
                            }
                        }
                        catch (cause) {
                            console.error('Realtime frame failed');
                            fail(cause instanceof Error ? cause : error('invalid realtime frame'), false);
                        }
                    });
                    ws.addEventListener('close', (event) => {
                        if (socket === ws && active)
                            fail(error('realtime connection closed'), event.code !== 1008);
                    });
                    ws.addEventListener('error', () => {
                        if (socket === ws && active)
                            fail(error('realtime connection failed'), true);
                    });
                }
                catch (cause) {
                    console.error('Realtime connection failed');
                    if (active && current === generation)
                        fail(cause instanceof Error ? cause : error('realtime connection failed'), cause instanceof SdkError && cause.retryable);
                }
            }
            const channel = {
                on(type, filter, callback) {
                    if (active)
                        throw new SdkError('VALIDATION_FAILED', 'register realtime listeners before subscribing');
                    listeners.push({ type, filter, callback });
                    return channel;
                },
                subscribe(callback) {
                    if (active)
                        throw new SdkError('VALIDATION_FAILED', 'channel is already subscribed');
                    if (!channels.has(channel))
                        throw new SdkError('VALIDATION_FAILED', 'create a new channel after unsubscribe');
                    active = true;
                    statusCallback = callback;
                    void connect();
                    return channel;
                },
                send: ({ event, payload }) => command('broadcast', { event, payload }),
                track: (payload) => command('track', payload),
                untrack: () => command('untrack', {}),
                snapshot: () => structuredClone(snapshot),
                presenceState: () => structuredClone(presence),
                async unsubscribe() {
                    active = false;
                    generation++;
                    clearTimeout(reconnect);
                    clearConnection(error('realtime channel unsubscribed'));
                    const previous = socket;
                    socket = undefined;
                    previous?.close(1000);
                    channels.delete(channel);
                    reconnectors.delete(channel);
                    seen.clear();
                    notify('CLOSED');
                    return 'ok';
                },
            };
            reconnectors.set(channel, () => {
                if (!active)
                    return;
                generation++;
                clearConnection(error('realtime session refreshed'));
                const previous = socket;
                socket = undefined;
                previous?.close(1000);
                void connect();
            });
            channels.add(channel);
            return channel;
        },
        async removeChannel(channel) {
            return channel.unsubscribe();
        },
        async removeAllChannels() {
            return Promise.all([...channels].map((channel) => channel.unsubscribe()));
        },
    };
    return realtime;
}
