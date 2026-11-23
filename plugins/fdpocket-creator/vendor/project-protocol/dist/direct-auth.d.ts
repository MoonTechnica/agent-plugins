import { z } from 'zod';
/** OAuth-shaped handoff credentials are short-lived, target-bound and never platform JWTs. */
export declare const DIRECT_AUTH_TTL_SECONDS = 120;
export declare const DIRECT_AUTH_START_PATH = "/_platform/auth/start";
export declare const DIRECT_AUTH_CALLBACK_PATH = "/_platform/auth/callback";
export declare const directAuthOpaqueSchema: z.ZodString;
export declare const directAuthVerifierSchema: z.ZodString;
export declare const directAuthOriginSchema: z.ZodString;
export declare const directAuthPathSchema: z.ZodString;
export declare const directAuthRequestSchema: z.ZodObject<{
    projectId: z.ZodUUID;
    app: z.ZodString;
    environment: z.ZodEnum<{
        main: "main";
        session: "session";
        prod: "prod";
    }>;
    environmentId: z.ZodOptional<z.ZodUUID>;
    origin: z.ZodString;
    path: z.ZodString;
    state: z.ZodString;
    codeChallenge: z.ZodString;
}, z.core.$strict>;
export type DirectAuthRequest = z.infer<typeof directAuthRequestSchema>;
export declare const directAuthExchangeSchema: z.ZodObject<{
    code: z.ZodString;
    codeVerifier: z.ZodString;
    origin: z.ZodString;
    state: z.ZodString;
}, z.core.$strict>;
export declare const directAuthIssueResponseSchema: z.ZodObject<{
    code: z.ZodString;
    expiresAt: z.ZodISODateTime;
}, z.core.$strict>;
export declare const directAuthResultSchema: z.ZodObject<{
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
                python: "python";
                mcp: "mcp";
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
        }, z.core.$strip>>;
    }, z.core.$strip>;
    delivery: z.ZodObject<{
        token: z.ZodString;
        expiresAt: z.ZodISODateTime;
    }, z.core.$strict>;
    deliveryLaunch: z.ZodObject<{
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
                    python: "python";
                    mcp: "mcp";
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
            }, z.core.$strip>>;
        }, z.core.$strip>;
    }, z.core.$strip>;
    path: z.ZodString;
    projectId: z.ZodUUID;
    app: z.ZodString;
}, z.core.$strip>;
export type DirectAuthResult = z.infer<typeof directAuthResultSchema>;
/**
 * Long-lived resume session behind the origin's `__Host-` HttpOnly cookie
 * (share-and-direct-access.md §3.3). Only origin Worker ↔ Gateway carry the secret; it never
 * reaches page script.
 */
export declare const DIRECT_SESSION_COOKIE = "__Host-fdp_session";
export declare const DIRECT_AUTH_RESUME_PATH = "/_platform/auth/resume";
export declare const DIRECT_AUTH_SIGNOUT_PATH = "/_platform/auth/signout";
export declare const directSessionSchema: z.ZodObject<{
    secret: z.ZodString;
    absoluteExpiresAt: z.ZodISODateTime;
}, z.core.$strict>;
export type DirectSession = z.infer<typeof directSessionSchema>;
/** Gateway → origin Worker only. The Worker moves `session` into the cookie and strips it. */
export declare const directAuthExchangeResultSchema: z.ZodObject<{
    token: z.ZodString;
    expiresAt: z.ZodISODateTime;
    delivery: z.ZodObject<{
        token: z.ZodString;
        expiresAt: z.ZodISODateTime;
    }, z.core.$strict>;
    deliveryLaunch: z.ZodObject<{
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
                    python: "python";
                    mcp: "mcp";
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
            }, z.core.$strip>>;
        }, z.core.$strip>;
    }, z.core.$strip>;
    path: z.ZodString;
    projectId: z.ZodUUID;
    app: z.ZodString;
    session: z.ZodObject<{
        secret: z.ZodString;
        absoluteExpiresAt: z.ZodISODateTime;
    }, z.core.$strict>;
}, z.core.$strip>;
export declare const directAuthResumeSchema: z.ZodObject<{
    secret: z.ZodString;
    origin: z.ZodString;
    path: z.ZodString;
}, z.core.$strict>;
export declare const directAuthRevokeSchema: z.ZodObject<{
    secret: z.ZodString;
    origin: z.ZodString;
}, z.core.$strict>;
export declare function pkceChallenge(verifier: string): Promise<string>;
export declare function directAuthRandom(): string;
