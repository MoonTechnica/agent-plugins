import { z } from 'zod';
import { type Contract } from './contract.ts';
/**
 * Host（project-host）⇄ App（miniapp-sdk）の bridge（sdk.md §7）。
 *
 * 1. Host → iframe window: `init`（MessageChannel の port を渡す）
 * 2. App → Host: `hello`（protocol 版）
 * 3. Host → App: `context`（Project トークン・Session・Gateway の URL）
 * 4. Host → App: `context_update`（5 分ごとのトークン更新・セーフエリア）
 * 5. App → Host: `op` / Host → App: `reply`
 *
 * 送る側は `exact` で組み立て直してから送る（Supabase の JWT のような「渡してはいけないもの」は
 * キーの時点で落ちる）。受け取る側は `wire` で読む（相手が後から足したものは捨てる）。
 */
export declare const nonceSchema: z.ZodString;
export declare const initMessage: Contract<z.ZodObject<{
    type: z.ZodLiteral<"init">;
    nonce: z.ZodString;
    launchId: z.ZodUUID;
}, z.core.$strip>>;
export type InitMessage = z.output<typeof initMessage.exact>;
export declare const helloMessage: Contract<z.ZodObject<{
    type: z.ZodLiteral<"hello">;
    nonce: z.ZodString;
    contract: z.ZodInt;
}, z.core.$strip>>;
export type HelloMessage = z.output<typeof helloMessage.exact>;
export declare const safeAreaInsets: Contract<z.ZodObject<{
    top: z.ZodNumber;
    right: z.ZodNumber;
    bottom: z.ZodNumber;
    left: z.ZodNumber;
}, z.core.$strip>>;
export type SafeAreaInsets = z.output<typeof safeAreaInsets.exact>;
export declare const LOCALES: readonly ["ja", "en"];
/** Host が App に渡す起動の中身（`context` から `type` / `host` を除いたもの。ネイティブの Host も同じ形を運ぶ） */
export declare const hostContext: Contract<z.ZodObject<{
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
    gatewayUrl: z.ZodURL;
    locale: z.ZodEnum<{
        ja: "ja";
        en: "en";
    }>;
    safeArea: z.ZodObject<{
        top: z.ZodNumber;
        right: z.ZodNumber;
        bottom: z.ZodNumber;
        left: z.ZodNumber;
    }, z.core.$strip>;
}, z.core.$strip>>;
export type HostContext = z.output<typeof hostContext.exact>;
export declare const contextMessage: Contract<z.ZodObject<{
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
    gatewayUrl: z.ZodURL;
    locale: z.ZodEnum<{
        ja: "ja";
        en: "en";
    }>;
    safeArea: z.ZodObject<{
        top: z.ZodNumber;
        right: z.ZodNumber;
        bottom: z.ZodNumber;
        left: z.ZodNumber;
    }, z.core.$strip>;
    type: z.ZodLiteral<"context">;
    host: z.ZodEnum<{
        superapp: "superapp";
    }>;
}, z.core.$strip>>;
export type ContextMessage = z.output<typeof contextMessage.exact>;
export declare const contextUpdateMessage: Contract<z.ZodObject<{
    type: z.ZodLiteral<"context_update">;
    token: z.ZodOptional<z.ZodString>;
    expiresAt: z.ZodOptional<z.ZodISODateTime>;
    session: z.ZodOptional<z.ZodObject<{
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
    }, z.core.$strip>>;
    safeArea: z.ZodOptional<z.ZodObject<{
        top: z.ZodNumber;
        right: z.ZodNumber;
        bottom: z.ZodNumber;
        left: z.ZodNumber;
    }, z.core.$strip>>;
}, z.core.$strip>>;
export type ContextUpdateMessage = z.output<typeof contextUpdateMessage.exact>;
export declare const BRIDGE_OPS: readonly ["ui.openShare", "ui.close", "ui.navigate", "ui.openCredits", "connections.requestPermission", "notifications.requestPermission", "notifications.status", "notifications.openSettings", "safety.report"];
export declare const bridgeOpName: Contract<z.ZodEnum<{
    "ui.openShare": "ui.openShare";
    "ui.close": "ui.close";
    "ui.navigate": "ui.navigate";
    "ui.openCredits": "ui.openCredits";
    "connections.requestPermission": "connections.requestPermission";
    "notifications.requestPermission": "notifications.requestPermission";
    "notifications.status": "notifications.status";
    "notifications.openSettings": "notifications.openSettings";
    "safety.report": "safety.report";
}>>;
export type BridgeOpName = z.output<typeof bridgeOpName.exact>;
/** op ごとの payload。App は送る前に `exact` で確かめ、Host は `wire` で読む */
export declare const BRIDGE_OP_PAYLOADS: {
    readonly 'ui.openShare': Contract<z.ZodObject<{
        path: z.ZodString;
        text: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    readonly 'ui.close': Contract<z.ZodUndefined>;
    readonly 'ui.navigate': Contract<z.ZodObject<{
        app: z.ZodString;
        path: z.ZodString;
    }, z.core.$strip>>;
    readonly 'ui.openCredits': Contract<z.ZodUndefined>;
    readonly 'connections.requestPermission': Contract<z.ZodObject<{
        provider: z.ZodEnum<{
            "google-drive": "google-drive";
            "google-mail": "google-mail";
            "google-calendar": "google-calendar";
            "google-contacts": "google-contacts";
            "microsoft-files": "microsoft-files";
            "microsoft-mail": "microsoft-mail";
            "microsoft-calendar": "microsoft-calendar";
            "microsoft-contacts": "microsoft-contacts";
            slack: "slack";
            notion: "notion";
            dropbox: "dropbox";
            box: "box";
            salesforce: "salesforce";
            hubspot: "hubspot";
        }>;
    }, z.core.$strip>>;
    readonly 'notifications.requestPermission': Contract<z.ZodObject<{
        reason: z.ZodString;
    }, z.core.$strip>>;
    readonly 'notifications.status': Contract<z.ZodUndefined>;
    readonly 'notifications.openSettings': Contract<z.ZodUndefined>;
    readonly 'safety.report': Contract<z.ZodObject<{
        target: z.ZodObject<{
            model: z.ZodString;
            id: z.ZodString;
        }, z.core.$strict>;
    }, z.core.$strip>>;
};
/**
 * App → Host の op。`op` は Host が知っているものだけ（知らない op は答えられないので `wire` でも閉じる）。
 * payload はその op の契約で検査する
 */
export declare const bridgeOpMessage: Contract<z.ZodObject<{
    type: z.ZodLiteral<"op">;
    requestId: z.ZodUUID;
    op: z.ZodEnum<{
        "ui.openShare": "ui.openShare";
        "ui.close": "ui.close";
        "ui.navigate": "ui.navigate";
        "ui.openCredits": "ui.openCredits";
        "connections.requestPermission": "connections.requestPermission";
        "notifications.requestPermission": "notifications.requestPermission";
        "notifications.status": "notifications.status";
        "notifications.openSettings": "notifications.openSettings";
        "safety.report": "safety.report";
    }>;
    payload: z.ZodOptional<z.ZodUnknown>;
}, z.core.$strip>>;
export type BridgeOpMessage = z.output<typeof bridgeOpMessage.exact>;
export declare const replyMessage: Contract<z.ZodDiscriminatedUnion<[z.ZodObject<{
    type: z.ZodLiteral<"reply">;
    requestId: z.ZodUUID;
    ok: z.ZodLiteral<true>;
    result: z.ZodOptional<z.ZodUnknown>;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"reply">;
    requestId: z.ZodUUID;
    ok: z.ZodLiteral<false>;
    code: z.ZodEnum<{
        UNAUTHENTICATED: "UNAUTHENTICATED";
        SESSION_EXPIRED: "SESSION_EXPIRED";
        TOKEN_SCOPE_MISMATCH: "TOKEN_SCOPE_MISMATCH";
        FORBIDDEN: "FORBIDDEN";
        NOT_FOUND: "NOT_FOUND";
        VALIDATION_FAILED: "VALIDATION_FAILED";
        POST_WRITE_READ_DENIED: "POST_WRITE_READ_DENIED";
        CONFLICT: "CONFLICT";
        RATE_LIMITED: "RATE_LIMITED";
        QUOTA_EXCEEDED: "QUOTA_EXCEEDED";
        PAYLOAD_TOO_LARGE: "PAYLOAD_TOO_LARGE";
        CONSENT_REQUIRED: "CONSENT_REQUIRED";
        GATEWAY_UNAVAILABLE: "GATEWAY_UNAVAILABLE";
        HOST_UNAVAILABLE: "HOST_UNAVAILABLE";
        REALTIME_DISABLED: "REALTIME_DISABLED";
        REALTIME_CAPACITY: "REALTIME_CAPACITY";
        RESYNC_REQUIRED: "RESYNC_REQUIRED";
        CONTRACT_UNSUPPORTED: "CONTRACT_UNSUPPORTED";
    }>;
    retryable: z.ZodBoolean;
}, z.core.$strip>], "ok">>;
export type ReplyMessage = z.output<typeof replyMessage.exact>;
