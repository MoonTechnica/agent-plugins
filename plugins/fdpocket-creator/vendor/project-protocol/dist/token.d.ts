import { z } from 'zod';
/**
 * Project の環境（lifecycle.md §1.1）。環境 = Turso DB の単位。
 * 区画（tier）は資格情報の境界で、main と branch は同じ dev 区画。
 */
export declare const ENVIRONMENTS: readonly ["main", "branch", "preview", "prod"];
export declare const environmentSchema: z.ZodEnum<{
    main: "main";
    branch: "branch";
    preview: "preview";
    prod: "prod";
}>;
export type Environment = z.infer<typeof environmentSchema>;
export declare const TIERS: readonly ["dev", "preview", "prod"];
export type Tier = (typeof TIERS)[number];
export declare function tierOf(environment: Environment): Tier;
export declare const appSlugSchema: z.ZodString;
/** Project トークンの発行者（`iss`） */
export declare const PROJECT_TOKEN_ISSUER = "project-gateway";
/**
 * Gateway が発行する Project アクセストークンの claims（gateway.md §3.2）。
 * strict なので Supabase JWT の claim（`role` 等）が混ざったトークンは受け付けない。
 * Permission はトークンに入れない（判定は毎回 DB）。
 */
export declare const projectTokenClaimsSchema: z.ZodObject<{
    iss: z.ZodLiteral<"project-gateway">;
    sub: z.ZodString;
    gid: z.ZodString;
    aud: z.ZodUUID;
    app: z.ZodString;
    env: z.ZodEnum<{
        main: "main";
        branch: "branch";
        preview: "preview";
        prod: "prod";
    }>;
    br: z.ZodOptional<z.ZodUUID>;
    pv: z.ZodOptional<z.ZodUUID>;
    anon: z.ZodBoolean;
    jti: z.ZodUUID;
    iat: z.ZodInt;
    exp: z.ZodInt;
}, z.core.$strict>;
export type ProjectTokenClaims = z.infer<typeof projectTokenClaimsSchema>;
/** サービストークンの寿命（Project トークンと同じ 10 分。SDK が期限の前に取り直す） */
export declare const SERVICE_TOKEN_TTL_SECONDS: number;
/** api / jobs が利用者として Gateway を呼ぶときに、その利用者の Project トークンを載せるヘッダ */
export declare const ACT_AS_HEADER = "x-act-as";
/** 配備ジョブが作る資格情報（Worker の secret binding `PLATFORM_SERVICE_CREDENTIAL` の値） */
export declare const SERVICE_CREDENTIAL_PATTERN: RegExp;
/** Worker に資格情報を渡す binding の名前（Project の secret には使えない。manifest の RESERVED_SECRET_PREFIX） */
export declare const SERVICE_CREDENTIAL_BINDING = "PLATFORM_SERVICE_CREDENTIAL";
/**
 * サービストークンの claims。`typ: service` と `cid`（資格情報の ID）を持ち、`gid` / `anon` を持たない。
 * Project トークンの schema（strict）とは互いに通らないので、利用者のルートにサービストークンを出しても
 * `UNAUTHENTICATED` になる（サービストークンだけで利用者のデータは読めない。`X-Act-As` が要る）。
 */
export declare const serviceTokenClaimsSchema: z.ZodObject<{
    iss: z.ZodLiteral<"project-gateway">;
    typ: z.ZodLiteral<"service">;
    sub: z.ZodString;
    aud: z.ZodUUID;
    app: z.ZodString;
    env: z.ZodEnum<{
        main: "main";
        branch: "branch";
        preview: "preview";
        prod: "prod";
    }>;
    br: z.ZodOptional<z.ZodUUID>;
    pv: z.ZodOptional<z.ZodUUID>;
    cid: z.ZodUUID;
    permissions: z.ZodArray<z.ZodString>;
    jti: z.ZodUUID;
    iat: z.ZodInt;
    exp: z.ZodInt;
}, z.core.$strict>;
export type ServiceTokenClaims = z.infer<typeof serviceTokenClaimsSchema>;
/** `POST /v1/token/service` の応答（Authorization は資格情報） */
export declare const serviceTokenResponseSchema: z.ZodObject<{
    token: z.ZodString;
    expiresAt: z.ZodISODateTime;
}, z.core.$strict>;
export type ServiceTokenResponse = z.infer<typeof serviceTokenResponseSchema>;
/** `gateway_service_credential` の結果（使えない資格情報は null） */
export declare const serviceCredentialSchema: z.ZodObject<{
    credentialId: z.ZodUUID;
    projectId: z.ZodUUID;
    environment: z.ZodEnum<{
        main: "main";
        branch: "branch";
        preview: "preview";
        prod: "prod";
    }>;
    sessionId: z.ZodNullable<z.ZodUUID>;
    previewSessionId: z.ZodNullable<z.ZodUUID>;
    appSlug: z.ZodString;
    servicePermissions: z.ZodArray<z.ZodString>;
}, z.core.$strict>;
export type ServiceCredential = z.infer<typeof serviceCredentialSchema>;
/** `POST /v1/token/exchange` の本文（Authorization は Supabase の access token） */
export declare const tokenExchangeRequestSchema: z.ZodObject<{
    projectId: z.ZodUUID;
    app: z.ZodString;
    environment: z.ZodEnum<{
        main: "main";
        branch: "branch";
        preview: "preview";
        prod: "prod";
    }>;
    previewSessionId: z.ZodOptional<z.ZodUUID>;
    branchSessionId: z.ZodOptional<z.ZodUUID>;
}, z.core.$strict>;
export type TokenExchangeRequest = z.infer<typeof tokenExchangeRequestSchema>;
/** 本人が開ける（または一覧に出る）同じ Project の App */
export declare const sessionAppSchema: z.ZodObject<{
    slug: z.ZodString;
    kind: z.ZodEnum<{
        web: "web";
        api: "api";
        jobs: "jobs";
    }>;
    access: z.ZodEnum<{
        public: "public";
        restricted: "restricted";
    }>;
    displayName: z.ZodNullable<z.ZodObject<{
        ja: z.ZodString;
        en: z.ZodString;
    }, z.core.$strict>>;
    canOpen: z.ZodBoolean;
}, z.core.$strict>;
export type SessionApp = z.infer<typeof sessionAppSchema>;
/**
 * 現在の主体（sdk.md §3.1）。`permissions` は発行時の写しで、表示の補助にだけ使う。
 * Supabase の JWT は載せない（strict）。
 */
export declare const sessionSchema: z.ZodObject<{
    userId: z.ZodString;
    globalUserId: z.ZodString;
    displayName: z.ZodNullable<z.ZodString>;
    isAnonymous: z.ZodBoolean;
    permissions: z.ZodArray<z.ZodString>;
    expiresAt: z.ZodISODateTime;
    apps: z.ZodArray<z.ZodObject<{
        slug: z.ZodString;
        kind: z.ZodEnum<{
            web: "web";
            api: "api";
            jobs: "jobs";
        }>;
        access: z.ZodEnum<{
            public: "public";
            restricted: "restricted";
        }>;
        displayName: z.ZodNullable<z.ZodObject<{
            ja: z.ZodString;
            en: z.ZodString;
        }, z.core.$strict>>;
        canOpen: z.ZodBoolean;
    }, z.core.$strict>>;
}, z.core.$strict>;
export type Session = z.infer<typeof sessionSchema>;
export declare const tokenExchangeResponseSchema: z.ZodObject<{
    token: z.ZodString;
    expiresAt: z.ZodISODateTime;
    session: z.ZodObject<{
        userId: z.ZodString;
        globalUserId: z.ZodString;
        displayName: z.ZodNullable<z.ZodString>;
        isAnonymous: z.ZodBoolean;
        permissions: z.ZodArray<z.ZodString>;
        expiresAt: z.ZodISODateTime;
        apps: z.ZodArray<z.ZodObject<{
            slug: z.ZodString;
            kind: z.ZodEnum<{
                web: "web";
                api: "api";
                jobs: "jobs";
            }>;
            access: z.ZodEnum<{
                public: "public";
                restricted: "restricted";
            }>;
            displayName: z.ZodNullable<z.ZodObject<{
                ja: z.ZodString;
                en: z.ZodString;
            }, z.core.$strict>>;
            canOpen: z.ZodBoolean;
        }, z.core.$strict>>;
    }, z.core.$strict>;
}, z.core.$strict>;
export type TokenExchangeResponse = z.infer<typeof tokenExchangeResponseSchema>;
/** `GET /v1/me` */
export declare const meResponseSchema: z.ZodObject<{
    userId: z.ZodString;
    globalUserId: z.ZodString;
    displayName: z.ZodNullable<z.ZodString>;
    isAnonymous: z.ZodBoolean;
    permissions: z.ZodArray<z.ZodString>;
    expiresAt: z.ZodISODateTime;
    apps: z.ZodArray<z.ZodObject<{
        slug: z.ZodString;
        kind: z.ZodEnum<{
            web: "web";
            api: "api";
            jobs: "jobs";
        }>;
        access: z.ZodEnum<{
            public: "public";
            restricted: "restricted";
        }>;
        displayName: z.ZodNullable<z.ZodObject<{
            ja: z.ZodString;
            en: z.ZodString;
        }, z.core.$strict>>;
        canOpen: z.ZodBoolean;
    }, z.core.$strict>>;
}, z.core.$strict>;
export type MeResponse = Session;
