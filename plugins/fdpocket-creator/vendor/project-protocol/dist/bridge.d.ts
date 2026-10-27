import { z } from 'zod';
/**
 * Host（project-host）⇄ App（miniapp-sdk）の bridge（sdk.md §7）。
 *
 * 1. Host → iframe window: `init`（MessageChannel の port を渡す）
 * 2. App → Host: `hello`（protocol 版）
 * 3. Host → App: `context`（Project トークン・Session・Gateway の URL）
 * 4. Host → App: `context_update`（5 分ごとのトークン更新・セーフエリア）
 * 5. App → Host: `op` / Host → App: `reply`
 *
 * すべて strict。Supabase の JWT のような「渡してはいけないもの」はキーの時点で落ちる。
 */
export declare const nonceSchema: z.ZodString;
export declare const initMessageSchema: z.ZodObject<{
    type: z.ZodLiteral<"init">;
    nonce: z.ZodString;
    launchId: z.ZodUUID;
}, z.core.$strict>;
export type InitMessage = z.infer<typeof initMessageSchema>;
export declare const helloMessageSchema: z.ZodObject<{
    type: z.ZodLiteral<"hello">;
    nonce: z.ZodString;
    protocolVersion: z.ZodInt;
    runtimeVersion: z.ZodInt;
}, z.core.$strict>;
export type HelloMessage = z.infer<typeof helloMessageSchema>;
export declare const safeAreaInsetsSchema: z.ZodObject<{
    top: z.ZodNumber;
    right: z.ZodNumber;
    bottom: z.ZodNumber;
    left: z.ZodNumber;
}, z.core.$strict>;
export type SafeAreaInsets = z.infer<typeof safeAreaInsetsSchema>;
export declare const contextMessageSchema: z.ZodObject<{
    type: z.ZodLiteral<"context">;
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
        }, z.core.$strict>>;
    }, z.core.$strict>;
    gatewayUrl: z.ZodURL;
    host: z.ZodLiteral<"superapp">;
    locale: z.ZodEnum<{
        ja: "ja";
        en: "en";
    }>;
    safeArea: z.ZodObject<{
        top: z.ZodNumber;
        right: z.ZodNumber;
        bottom: z.ZodNumber;
        left: z.ZodNumber;
    }, z.core.$strict>;
}, z.core.$strict>;
export type ContextMessage = z.infer<typeof contextMessageSchema>;
export declare const contextUpdateMessageSchema: z.ZodObject<{
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
        }, z.core.$strict>>;
    }, z.core.$strict>>;
    safeArea: z.ZodOptional<z.ZodObject<{
        top: z.ZodNumber;
        right: z.ZodNumber;
        bottom: z.ZodNumber;
        left: z.ZodNumber;
    }, z.core.$strict>>;
}, z.core.$strict>;
export type ContextUpdateMessage = z.infer<typeof contextUpdateMessageSchema>;
export declare const BRIDGE_OPS: readonly ["ui.openShare", "ui.close", "ui.navigate", "ui.openCredits", "connections.requestPermission", "notifications.requestPermission", "notifications.status", "notifications.openSettings", "safety.report"];
export declare const bridgeOpNameSchema: z.ZodEnum<{
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
export type BridgeOpName = z.infer<typeof bridgeOpNameSchema>;
export declare const BRIDGE_OP_PAYLOAD_SCHEMAS: {
    readonly 'ui.openShare': z.ZodObject<{
        path: z.ZodString;
        text: z.ZodOptional<z.ZodString>;
    }, z.core.$strict>;
    readonly 'ui.close': z.ZodUndefined;
    readonly 'ui.navigate': z.ZodObject<{
        app: z.ZodString;
        path: z.ZodString;
    }, z.core.$strict>;
    readonly 'ui.openCredits': z.ZodUndefined;
    readonly 'connections.requestPermission': z.ZodObject<{
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
    }, z.core.$strict>;
    readonly 'notifications.requestPermission': z.ZodObject<{
        reason: z.ZodString;
    }, z.core.$strict>;
    readonly 'notifications.status': z.ZodUndefined;
    readonly 'notifications.openSettings': z.ZodUndefined;
    readonly 'safety.report': z.ZodObject<{
        target: z.ZodObject<{
            model: z.ZodString;
            id: z.ZodString;
        }, z.core.$strict>;
    }, z.core.$strict>;
};
export declare const bridgeOpMessageSchema: z.ZodObject<{
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
}, z.core.$strict>;
export type BridgeOpMessage = z.infer<typeof bridgeOpMessageSchema>;
export declare const replyMessageSchema: z.ZodDiscriminatedUnion<[z.ZodObject<{
    type: z.ZodLiteral<"reply">;
    requestId: z.ZodUUID;
    ok: z.ZodLiteral<true>;
    result: z.ZodOptional<z.ZodUnknown>;
}, z.core.$strict>, z.ZodObject<{
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
    }>;
    retryable: z.ZodBoolean;
}, z.core.$strict>], "ok">;
export type ReplyMessage = z.infer<typeof replyMessageSchema>;
