import { z } from 'zod';
import { isAppPath } from "./app-path.js";
import { deliveryResponseSchema } from "./delivery.js";
import { appSlugSchema, environmentSchema, tokenExchangeResponseSchema } from "./token.js";
/** OAuth-shaped handoff credentials are short-lived, target-bound and never platform JWTs. */
export const DIRECT_AUTH_TTL_SECONDS = 120;
export const DIRECT_AUTH_START_PATH = '/_platform/auth/start';
export const DIRECT_AUTH_CALLBACK_PATH = '/_platform/auth/callback';
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
export const directAuthResultSchema = tokenExchangeResponseSchema.extend({
    delivery: deliveryResponseSchema,
    deliveryLaunch: tokenExchangeResponseSchema,
    path: directAuthPathSchema,
    projectId: z.uuid(),
    app: appSlugSchema,
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
