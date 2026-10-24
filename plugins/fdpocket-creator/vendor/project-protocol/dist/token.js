import { z } from 'zod';
import { PROJECT_TOKEN_TTL_SECONDS } from "./limits.js";
import { APP_ACCESSES, APP_KINDS, APP_SLUG_PATTERN, localizedNameSchema } from "./manifest.js";
/**
 * Project の環境（lifecycle.md §1.1）。環境 = Turso DB の単位。
 * 区画（tier）は資格情報の境界で、main と session は同じ dev 区画。
 */
export const ENVIRONMENTS = ['main', 'session', 'prod'];
export const environmentSchema = z.enum(ENVIRONMENTS);
export const TIERS = ['dev', 'prod'];
export function tierOf(environment) {
    return environment === 'main' || environment === 'session' ? 'dev' : environment;
}
export const testIdentitySlotSchema = z.string().regex(/^[a-z][a-z0-9_-]{0,31}$/);
export const appSlugSchema = z.string().regex(APP_SLUG_PATTERN);
/** Project トークンの発行者（`iss`） */
export const PROJECT_TOKEN_ISSUER = 'project-gateway';
/**
 * Gateway が発行する Project アクセストークンの claims（gateway.md §3.2）。
 * strict なので Supabase JWT の claim（`role` 等）が混ざったトークンは受け付けない。
 * Permission はトークンに入れない（判定は毎回 DB）。
 */
export const projectTokenClaimsSchema = z
    .strictObject({
    iss: z.literal(PROJECT_TOKEN_ISSUER),
    /** Project 内の User.id。サービストークンは `service:{projectId}:{app}`（P1） */
    sub: z.string().min(1).max(255),
    /** `{Supabase iss}:{Supabase sub}` */
    gid: z.string().min(1).max(512),
    aud: z.uuid(),
    app: appSlugSchema,
    env: environmentSchema,
    /** Concrete physical environment, including main and prod. */
    envId: z.uuid(),
    /** Real Platform principal; gid may be a session-local synthetic identity. */
    actorId: z.uuid(),
    testIdentity: testIdentitySlotSchema.optional(),
    testGrantId: z.uuid().optional(),
    anon: z.boolean(),
    jti: z.uuid(),
    iat: z.int().nonnegative(),
    exp: z.int().positive(),
})
    .superRefine((c, ctx) => {
    if (c.gid.startsWith('test:') && c.testIdentity === undefined)
        ctx.addIssue({
            code: 'custom',
            path: ['testIdentity'],
            message: 'synthetic identity requires a test slot',
        });
    if (c.testIdentity !== undefined) {
        if (c.env !== 'session' || c.gid !== `test:${c.envId}:${c.testIdentity}`)
            ctx.addIssue({
                code: 'custom',
                path: ['testIdentity'],
                message: 'test identity scope mismatch',
            });
        if (c.anon !== (c.testIdentity === 'anonymous'))
            ctx.addIssue({
                code: 'custom',
                path: ['anon'],
                message: 'test identity anonymity mismatch',
            });
    }
    if (c.testGrantId !== undefined && (c.env !== 'session' || c.testIdentity === undefined))
        ctx.addIssue({
            code: 'custom',
            path: ['testGrantId'],
            message: 'grant requires a session test identity',
        });
    const ttl = c.exp - c.iat;
    if (ttl <= 0 || ttl > PROJECT_TOKEN_TTL_SECONDS) {
        ctx.addIssue({ code: 'custom', path: ['exp'], message: 'token lifetime out of range' });
    }
});
// ---------- サービストークン（api / jobs。gateway.md §3.4・tasks/0478） ----------
/** サービストークンの寿命（Project トークンと同じ 10 分。SDK が期限の前に取り直す） */
export const SERVICE_TOKEN_TTL_SECONDS = PROJECT_TOKEN_TTL_SECONDS;
/** api / jobs が利用者として Gateway を呼ぶときに、その利用者の Project トークンを載せるヘッダ */
export const ACT_AS_HEADER = 'x-act-as';
/** 配備ジョブが作る資格情報（Worker の secret binding `PLATFORM_SERVICE_CREDENTIAL` の値） */
export const SERVICE_CREDENTIAL_PATTERN = /^psc_[A-Za-z0-9_-]{43}$/;
/** Worker に資格情報を渡す binding の名前（Project の secret には使えない。manifest の RESERVED_SECRET_PREFIX） */
export const SERVICE_CREDENTIAL_BINDING = 'PLATFORM_SERVICE_CREDENTIAL';
/**
 * サービストークンの claims。`typ: service` と `cid`（資格情報の ID）を持ち、`gid` / `anon` を持たない。
 * Project トークンの schema（strict）とは互いに通らないので、利用者のルートにサービストークンを出しても
 * `UNAUTHENTICATED` になる（サービストークンだけで利用者のデータは読めない。`X-Act-As` が要る）。
 */
export const serviceTokenClaimsSchema = z
    .strictObject({
    iss: z.literal(PROJECT_TOKEN_ISSUER),
    typ: z.literal('service'),
    /** `service:{projectId}:{app}` */
    sub: z.string().min(1).max(255),
    aud: z.uuid(),
    app: appSlugSchema,
    env: environmentSchema,
    envId: z.uuid(),
    cid: z.uuid(),
    /** 発行時の写し。認可には現在の manifest を照会する。 */
    permissions: z.array(z.string()),
    jti: z.uuid(),
    iat: z.int().nonnegative(),
    exp: z.int().positive(),
})
    .superRefine((c, ctx) => {
    if (c.sub !== `service:${c.aud}:${c.app}`) {
        ctx.addIssue({ code: 'custom', path: ['sub'], message: 'sub must be service:{aud}:{app}' });
    }
    const ttl = c.exp - c.iat;
    if (ttl <= 0 || ttl > SERVICE_TOKEN_TTL_SECONDS) {
        ctx.addIssue({ code: 'custom', path: ['exp'], message: 'token lifetime out of range' });
    }
});
/** `POST /v1/token/service` の応答（Authorization は資格情報） */
export const serviceTokenResponseSchema = z.strictObject({
    token: z.string().min(1),
    expiresAt: z.iso.datetime(),
});
/** `gateway_service_credential` の結果（使えない資格情報は null） */
export const serviceCredentialSchema = z.strictObject({
    credentialId: z.uuid(),
    projectId: z.uuid(),
    environment: environmentSchema,
    environmentId: z.uuid(),
    appSlug: appSlugSchema,
    servicePermissions: z.array(z.string()),
});
/** `POST /v1/token/exchange` の本文（Authorization は Supabase の access token） */
export const tokenExchangeRequestSchema = z
    .strictObject({
    projectId: z.uuid(),
    app: appSlugSchema,
    environment: environmentSchema,
    environmentId: z.uuid().optional(),
    testIdentity: testIdentitySlotSchema.optional(),
})
    .superRefine((r, ctx) => {
    if (r.environment === 'session' && r.environmentId === undefined)
        ctx.addIssue({
            code: 'custom',
            path: ['environmentId'],
            message: 'session requires environmentId',
        });
    if (r.testIdentity !== undefined && r.environment !== 'session')
        ctx.addIssue({
            code: 'custom',
            path: ['testIdentity'],
            message: 'test identity requires session',
        });
});
/** 本人が開ける（または一覧に出る）同じ Project の App */
export const sessionAppSchema = z.strictObject({
    slug: appSlugSchema,
    kind: z.enum(APP_KINDS),
    access: z.enum(APP_ACCESSES),
    displayName: localizedNameSchema.nullable(),
    /** restricted の App を開ける Permission があるか（Host の「管理画面を開く」の表示判定） */
    canOpen: z.boolean(),
});
/**
 * 現在の主体（sdk.md §3.1）。`permissions` は発行時の写しで、表示の補助にだけ使う。
 * Supabase の JWT は載せない（strict）。
 */
export const sessionSchema = z.strictObject({
    userId: z.string().min(1),
    globalUserId: z.string().min(1),
    displayName: z.string().nullable(),
    isAnonymous: z.boolean(),
    permissions: z.array(z.string()),
    expiresAt: z.iso.datetime(),
    apps: z.array(sessionAppSchema),
});
export const tokenExchangeResponseSchema = z.strictObject({
    token: z.string().min(1),
    expiresAt: z.iso.datetime(),
    session: sessionSchema,
});
/** `GET /v1/me` */
export const meResponseSchema = sessionSchema;
