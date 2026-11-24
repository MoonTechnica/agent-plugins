import { z } from 'zod';
import { isAppPath } from "./app-path.js";
import { deliveryResponseSchema } from "./delivery.js";
import { appSlugSchema, environmentSchema, tokenExchangeResponse } from "./token.js";
/** OAuth-shaped handoff credentials are short-lived, target-bound and never platform JWTs. */
export const DIRECT_AUTH_TTL_SECONDS = 120;
export const DIRECT_AUTH_START_PATH = '/_platform/auth/start';
export const DIRECT_AUTH_CALLBACK_PATH = '/_platform/auth/callback';
export const PROJECT_AUTH_CALLBACK_PATH = '/_platform/auth/project/callback';
export const PROJECT_AUTH_EXCHANGE_PATH = '/_platform/auth/project/exchange';
export const PROJECT_AUTH_PENDING_KEY = 'fdpocket.project-auth';
export function projectAuthOrigin(environmentId, domain) {
    return `https://e${z.uuid().parse(environmentId).replaceAll('-', '').toLowerCase()}.${domain}`;
}
export const directAuthOpaqueSchema = z
    .string()
    .length(43)
    .regex(/^[A-Za-z0-9_-]{43}$/);
export const directAuthVerifierSchema = z.string().regex(/^[A-Za-z0-9._~-]{43,128}$(?![\s\S])/);
export const directAuthOriginSchema = z.string().refine((value) => {
    try {
        const url = new URL(value);
        return (url.origin === value &&
            !url.username &&
            !url.password &&
            (url.protocol === 'https:' ||
                (url.protocol === 'http:' &&
                    (url.hostname === 'localhost' ||
                        url.hostname.endsWith('.localhost') ||
                        url.hostname === '127.0.0.1'))));
    }
    catch {
        return false;
    }
});
export const directAuthPathSchema = z
    .string()
    .max(2048)
    .refine((value) => {
    if (!isAppPath(value))
        return false;
    const pathname = decodeURIComponent(value.split(/[?#]/, 1)[0] ?? '');
    return pathname !== '/_platform' && !pathname.startsWith('/_platform/');
});
export const directAuthRequestSchema = z
    .strictObject({
    projectId: z.uuid(),
    app: appSlugSchema,
    environment: environmentSchema,
    environmentId: z.uuid().optional(),
    origin: directAuthOriginSchema,
    path: directAuthPathSchema,
    state: directAuthOpaqueSchema,
    codeChallenge: directAuthOpaqueSchema,
})
    .superRefine((value, ctx) => {
    if (value.environment === 'session' && value.environmentId === undefined)
        ctx.addIssue({
            code: 'custom',
            path: ['environmentId'],
            message: 'session environment is required',
        });
});
export const directAuthExchangeSchema = z.strictObject({
    code: directAuthOpaqueSchema,
    codeVerifier: directAuthVerifierSchema,
    origin: directAuthOriginSchema,
    state: directAuthOpaqueSchema,
});
export const directAuthIssueResponseSchema = z.strictObject({
    code: directAuthOpaqueSchema,
    expiresAt: z.iso.datetime(),
});
export const directAuthResultSchema = tokenExchangeResponse.exact.extend({
    delivery: deliveryResponseSchema,
    deliveryLaunch: tokenExchangeResponse.exact,
    path: directAuthPathSchema,
    projectId: z.uuid(),
    app: appSlugSchema,
});
/**
 * Long-lived resume session behind the origin's `__Host-` HttpOnly cookie
 * (share-and-direct-access.md §3.3). Only origin Worker ↔ Gateway carry the secret; it never
 * reaches page script.
 */
export const DIRECT_SESSION_COOKIE = '__Host-fdp_session';
export const DIRECT_AUTH_RESUME_PATH = '/_platform/auth/resume';
export const DIRECT_AUTH_SIGNOUT_PATH = '/_platform/auth/signout';
export const directSessionSchema = z.strictObject({
    secret: directAuthOpaqueSchema,
    absoluteExpiresAt: z.iso.datetime({ offset: true }),
});
/** Gateway → origin Worker only. The Worker moves `session` into the cookie and strips it. */
export const directAuthExchangeResultSchema = directAuthResultSchema.extend({
    session: directSessionSchema,
});
export const directAuthResumeSchema = z.strictObject({
    secret: directAuthOpaqueSchema,
    origin: directAuthOriginSchema,
    path: directAuthPathSchema,
});
export const directAuthRevokeSchema = z.strictObject({
    secret: directAuthOpaqueSchema,
    origin: directAuthOriginSchema,
});
export async function pkceChallenge(verifier) {
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));
    return btoa(String.fromCharCode(...digest))
        .replaceAll('+', '-')
        .replaceAll('/', '_')
        .replaceAll('=', '');
}
export function directAuthRandom() {
    return btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))))
        .replaceAll('+', '-')
        .replaceAll('/', '_')
        .replaceAll('=', '');
}
/** Private Gateway response. The origin bootstrap uses the validated path after exchange. */
export const projectAuthExchangeResponseSchema = tokenExchangeResponse.exact.extend({
    path: directAuthPathSchema,
});
