import { outboundPolicySchema } from "./network-mocks.js";
/**
 * Project オリジン（Cloudflare）→ dispatch Worker の転送に付ける Platform の署名（integrations.md §3.1）。
 *
 * - `x-platform-dispatch`: 宛先の user Worker・メソッド・パス・時刻・本文の sha256・外向き通信の allowlist・
 *   上限を JSON にして base64 にしたもの。`x-platform-signature`: その文字列の HMAC-SHA256（base64url）。
 * - dispatch Worker は鍵で検証し、時刻が ±60 秒・メソッドとパス・本文のハッシュが一致するときだけ転送する。
 *   宛先はクライアントの値ではなくここから決める（クライアントのヘッダは信用しない）。
 * - 鍵は Platform の secret（Project オリジンと dispatch Worker だけ）。user Worker には渡らない。
 *
 * 葉のモジュール（Web Crypto だけ。Node・Vercel・Workers・Deno で動く）。
 */
export const API_EXECUTION_MODE_HEADER = 'x-platform-execution-mode';
export const DISPATCH_HEADER = 'x-platform-dispatch';
export const DISPATCH_SIGNATURE_HEADER = 'x-platform-signature';
/** Cloudflare permits 128KiB total headers; leave half for ordinary request headers. */
export const DISPATCH_HEADERS_MAX_BYTES = 64 * 1024;
/** 署名の時刻の許容幅（秒）。再送の窓 */
export const DISPATCH_MAX_SKEW_SECONDS = 60;
/** HMAC の鍵の最短の長さ（文字） */
export const DISPATCH_SECRET_MIN_LENGTH = 32;
const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
export const USER_WORKER_SLUG = '[a-z][a-z0-9-]{1,31}';
const EXACT_UUID = new RegExp(`^${UUID}$`);
const EXACT_SLUG = new RegExp(`^${USER_WORKER_SLUG}$`);
const WORKER_NAME_PATTERN = new RegExp(`^(?:p-${UUID}-(?:main|prod)|p-s-[0-9a-f]{12})-(${USER_WORKER_SLUG})$`);
export function userWorkerName(target) {
    if (!EXACT_UUID.test(target.projectId) || !EXACT_SLUG.test(target.app))
        throw new Error('invalid user worker target');
    if (target.environment === 'session') {
        if (!EXACT_UUID.test(target.resourceGeneration ?? ''))
            throw new Error('session Worker requires a resource generation');
        return `p-s-${target.resourceGeneration.replaceAll('-', '').slice(0, 12)}-${target.app}`;
    }
    if (!['main', 'prod'].includes(target.environment) || target.resourceGeneration !== undefined)
        throw new Error('invalid user worker environment');
    return `p-${target.projectId}-${target.environment}-${target.app}`;
}
export function isUserWorkerName(name) {
    return WORKER_NAME_PATTERN.test(name);
}
export function userWorkerApp(name) {
    return WORKER_NAME_PATTERN.exec(name)?.[1] ?? null;
}
/** Defense in depth: trusted DB storage metadata must describe this exact Worker environment. */
export function workerStorageScope(worker) {
    if (!isUserWorkerName(worker))
        return null;
    const match = new RegExp(`^p-(${UUID})-(main|prod)-`).exec(worker);
    if (!match)
        return null;
    return {
        namespace: `projects/${match[1]}/${match[2]}`,
        tier: match[2] === 'prod' ? 'prod' : 'dev',
    };
}
export function isWorkerStorageScope(worker, value) {
    if (typeof value !== 'object' || value === null)
        return false;
    const actual = value;
    const session = /^p-s-([0-9a-f]{12})-/.exec(worker);
    if (session && isUserWorkerName(worker)) {
        if (actual.tier !== 'dev' || typeof actual.namespace !== 'string')
            return false;
        const scope = new RegExp(`^projects/(${UUID})/environments/(${UUID})$`).exec(actual.namespace);
        return scope !== null && scope[2].replaceAll('-', '').slice(0, 12) === session[1];
    }
    const expected = workerStorageScope(worker);
    return (expected !== null && expected.namespace === actual.namespace && expected.tier === actual.tier);
}
const encoder = new TextEncoder();
function bytesToBase64(bytes) {
    let binary = '';
    for (const byte of bytes)
        binary += String.fromCharCode(byte);
    return btoa(binary);
}
function base64UrlToBytes(value) {
    if (!/^[A-Za-z0-9_-]+$/.test(value))
        return null;
    const binary = atob(value.replaceAll('-', '+').replaceAll('_', '/'));
    return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}
function toHex(buffer) {
    return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
export async function sha256Hex(body) {
    return toHex(await crypto.subtle.digest('SHA-256', body));
}
async function hmacKey(secret, usage) {
    if (secret.length < DISPATCH_SECRET_MIN_LENGTH)
        throw new Error('dispatch secret is too short');
    return crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [usage]);
}
function pathOf(url) {
    const parsed = new URL(url);
    return `${parsed.pathname}${parsed.search}`;
}
/** 転送する側（Project オリジン・Platform の cron）が付けるヘッダ */
export async function signDispatch(input) {
    if (!isUserWorkerName(input.worker))
        throw new Error(`invalid user worker: ${input.worker}`);
    if (input.storage && !isWorkerStorageScope(input.worker, input.storage))
        throw new Error('invalid Worker storage scope');
    if (!isWorkerOutboundPolicy(input.worker, input.policy))
        throw new Error('invalid Worker outbound scope');
    const envelope = {
        v: 1,
        worker: input.worker,
        method: input.method.toUpperCase(),
        path: pathOf(input.url),
        ts: Math.floor((input.now ?? new Date()).getTime() / 1000),
        bodySha256: await sha256Hex(input.body ?? new Uint8Array()),
        egress: [...input.egress],
        policy: input.policy,
        ...(input.limits ? { limits: input.limits } : {}),
        ...(input.storage ? { storage: input.storage } : {}),
    };
    const encoded = bytesToBase64(encoder.encode(JSON.stringify(envelope)));
    if (!dispatchHeadersFit(encoded, 'x'.repeat(43)))
        throw new Error('dispatch header budget exceeded');
    const key = await hmacKey(input.secret, 'sign');
    const signature = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(encoded)));
    return {
        [DISPATCH_HEADER]: encoded,
        [DISPATCH_SIGNATURE_HEADER]: bytesToBase64(signature)
            .replaceAll('+', '-')
            .replaceAll('/', '_')
            .replace(/=+$/, ''),
    };
}
function dispatchHeadersFit(encoded, signature) {
    // Include names, colon-space separators and CRLF, not only the base64 value.
    return (encoder.encode(encoded).byteLength +
        encoder.encode(signature).byteLength +
        DISPATCH_HEADER.length +
        DISPATCH_SIGNATURE_HEADER.length +
        8 <=
        DISPATCH_HEADERS_MAX_BYTES);
}
function parseEnvelope(encoded) {
    try {
        const value = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0))));
        if (typeof value !== 'object' || value === null)
            return null;
        const e = value;
        const limits = e.limits;
        const valid = e.v === 1 &&
            typeof e.worker === 'string' &&
            isUserWorkerName(e.worker) &&
            typeof e.method === 'string' &&
            typeof e.path === 'string' &&
            e.path.startsWith('/') &&
            Number.isInteger(e.ts) &&
            typeof e.bodySha256 === 'string' &&
            /^[0-9a-f]{64}$/.test(e.bodySha256) &&
            isWorkerOutboundPolicy(e.worker, e.policy) &&
            Array.isArray(e.egress) &&
            e.egress.every((host) => typeof host === 'string') &&
            (e.storage === undefined || isWorkerStorageScope(e.worker, e.storage)) &&
            (limits === undefined ||
                (Number.isInteger(limits.cpuMs) && Number.isInteger(limits.subRequests)));
        return valid ? value : null;
    }
    catch {
        // base64 / JSON として読めない: 呼び出し側が malformed で拒否する
        return null;
    }
}
/** dispatch Worker が検証する（本文は読み終えたバイト列を渡す） */
export async function verifyDispatch(input) {
    const encoded = input.headers.get(DISPATCH_HEADER);
    const signature = input.headers.get(DISPATCH_SIGNATURE_HEADER);
    if (!encoded || !signature)
        return { ok: false, reason: 'missing' };
    if (!dispatchHeadersFit(encoded, signature))
        return { ok: false, reason: 'malformed' };
    const signatureBytes = base64UrlToBytes(signature);
    if (!signatureBytes)
        return { ok: false, reason: 'malformed' };
    const key = await hmacKey(input.secret, 'verify');
    // crypto.subtle.verify は定数時間で比べる
    const valid = await crypto.subtle.verify('HMAC', key, signatureBytes, encoder.encode(encoded));
    if (!valid)
        return { ok: false, reason: 'signature' };
    const envelope = parseEnvelope(encoded);
    if (!envelope)
        return { ok: false, reason: 'malformed' };
    const now = Math.floor((input.now ?? new Date()).getTime() / 1000);
    if (Math.abs(now - envelope.ts) > DISPATCH_MAX_SKEW_SECONDS)
        return { ok: false, reason: 'expired' };
    if (envelope.method !== input.method.toUpperCase() || envelope.path !== pathOf(input.url)) {
        return { ok: false, reason: 'request' };
    }
    if (envelope.bodySha256 !== (await sha256Hex(input.body)))
        return { ok: false, reason: 'body' };
    return { ok: true, envelope };
}
export function isWorkerOutboundPolicy(worker, value) {
    if (!isUserWorkerName(worker))
        return false;
    const parsed = outboundPolicySchema.safeParse(value);
    if (!parsed.success)
        return false;
    const generation = /^p-s-([a-f0-9]{12})-/.exec(worker);
    return generation
        ? parsed.data.resourceGeneration !== null &&
            parsed.data.resourceGeneration.replaceAll('-', '').slice(0, 12) === generation[1]
        : parsed.data.mode === 'real' && parsed.data.resourceGeneration === null;
}
