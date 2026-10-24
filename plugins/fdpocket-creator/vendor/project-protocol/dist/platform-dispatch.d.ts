import { type OutboundPolicy } from './network-mocks.ts';
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
export declare const API_EXECUTION_MODE_HEADER = "x-platform-execution-mode";
export declare const DISPATCH_HEADER = "x-platform-dispatch";
export declare const DISPATCH_SIGNATURE_HEADER = "x-platform-signature";
/** Cloudflare permits 128KiB total headers; leave half for ordinary request headers. */
export declare const DISPATCH_HEADERS_MAX_BYTES: number;
/** 署名の時刻の許容幅（秒）。再送の窓 */
export declare const DISPATCH_MAX_SKEW_SECONDS = 60;
/** HMAC の鍵の最短の長さ（文字） */
export declare const DISPATCH_SECRET_MIN_LENGTH = 32;
export type DispatchEnvironment = 'main' | 'session' | 'prod';
export interface UserWorkerTarget {
    projectId: string;
    environment: DispatchEnvironment;
    resourceGeneration?: string;
    app: string;
}
export declare const USER_WORKER_SLUG = "[a-z][a-z0-9-]{1,31}";
export declare function userWorkerName(target: UserWorkerTarget): string;
export declare function isUserWorkerName(name: string): boolean;
export declare function userWorkerApp(name: string): string | null;
export interface DispatchLimits {
    cpuMs: number;
    subRequests: number;
}
export interface DispatchStorage {
    namespace: string;
    tier: 'dev' | 'prod';
}
/** Defense in depth: trusted DB storage metadata must describe this exact Worker environment. */
export declare function workerStorageScope(worker: string): DispatchStorage | null;
export declare function isWorkerStorageScope(worker: string, value: unknown): value is DispatchStorage;
export interface DispatchEnvelope {
    v: 1;
    worker: string;
    method: string;
    /** pathname + search */
    path: string;
    /** UNIX 秒 */
    ts: number;
    /** 本文の sha256（hex。本文が無ければ空の sha256） */
    bodySha256: string;
    /** user Worker の `network.egress`（outbound Worker に渡す） */
    egress: string[];
    policy: OutboundPolicy;
    /** 顧客別の上限（dispatch の custom limits） */
    limits?: DispatchLimits;
    storage?: DispatchStorage;
}
export type DispatchRejectReason = 'missing' | 'malformed' | 'signature' | 'expired' | 'request' | 'body';
export type DispatchVerification = {
    ok: true;
    envelope: DispatchEnvelope;
} | {
    ok: false;
    reason: DispatchRejectReason;
};
export declare function sha256Hex(body: Uint8Array): Promise<string>;
/** 転送する側（Project オリジン・Platform の cron）が付けるヘッダ */
export declare function signDispatch(input: {
    secret: string;
    worker: string;
    method: string;
    url: string;
    body: Uint8Array | null;
    egress: readonly string[];
    policy: OutboundPolicy;
    limits?: DispatchLimits;
    storage?: DispatchStorage;
    now?: Date;
}): Promise<Record<string, string>>;
/** dispatch Worker が検証する（本文は読み終えたバイト列を渡す） */
export declare function verifyDispatch(input: {
    secret: string;
    method: string;
    url: string;
    headers: Headers;
    body: Uint8Array;
    now?: Date;
}): Promise<DispatchVerification>;
export declare function isWorkerOutboundPolicy(worker: string, value: unknown): value is OutboundPolicy;
