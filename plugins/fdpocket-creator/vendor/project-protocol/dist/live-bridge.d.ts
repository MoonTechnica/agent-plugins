import { z } from 'zod';
export declare const LIVE_HOST_BRIDGE_VERSION = 1;
export declare const liveHostNonceSchema: z.ZodString;
export declare const liveHostInitSchema: z.ZodObject<{
    type: z.ZodLiteral<"kit-session-init">;
    version: z.ZodLiteral<1>;
    nonce: z.ZodString;
    environmentId: z.ZodUUID;
    controls: z.ZodLiteral<"studio">;
    selectedIdentity: z.ZodNullable<z.ZodString>;
    identities: z.ZodArray<z.ZodObject<{
        slot: z.ZodString;
        displayName: z.ZodString;
    }, z.core.$strict>>;
}, z.core.$strict>;
export declare const liveHostExchangeRequestSchema: z.ZodObject<{
    type: z.ZodLiteral<"kit-session-request">;
    version: z.ZodLiteral<1>;
    nonce: z.ZodString;
    requestId: z.ZodUUID;
    environmentId: z.ZodUUID;
    app: z.ZodString;
    testIdentity: z.ZodNullable<z.ZodString>;
}, z.core.$strict>;
export declare const liveHostExchangeReplySchema: z.ZodDiscriminatedUnion<[z.ZodObject<{
    type: z.ZodLiteral<"kit-session-reply">;
    version: z.ZodLiteral<1>;
    nonce: z.ZodString;
    requestId: z.ZodUUID;
    environmentId: z.ZodUUID;
    app: z.ZodString;
    testIdentity: z.ZodNullable<z.ZodString>;
    ok: z.ZodLiteral<true>;
    session: z.ZodObject<{
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
    }, z.core.$strict>;
}, z.core.$strict>, z.ZodObject<{
    type: z.ZodLiteral<"kit-session-reply">;
    version: z.ZodLiteral<1>;
    nonce: z.ZodString;
    requestId: z.ZodUUID;
    environmentId: z.ZodUUID;
    app: z.ZodString;
    testIdentity: z.ZodNullable<z.ZodString>;
    ok: z.ZodLiteral<false>;
    code: z.ZodEnum<{
        forbidden: "forbidden";
        signed_out: "signed_out";
        consent_required: "consent_required";
        unavailable: "unavailable";
    }>;
}, z.core.$strict>], "ok">;
export type LiveHostExchangeRequest = z.infer<typeof liveHostExchangeRequestSchema>;
export type LiveHostExchangeReply = z.infer<typeof liveHostExchangeReplySchema>;
export declare const liveJobRunsSchema: z.ZodArray<z.ZodObject<{
    id: z.ZodUUID;
    app: z.ZodString;
    handler: z.ZodString;
    status: z.ZodString;
    attempts: z.ZodInt;
    lastError: z.ZodNullable<z.ZodString>;
    createdAt: z.ZodString;
}, z.core.$strict>>;
export declare const liveSessionInspectionSchema: z.ZodObject<{
    jobRuns: z.ZodOptional<z.ZodArray<z.ZodObject<{
        id: z.ZodUUID;
        app: z.ZodString;
        handler: z.ZodString;
        status: z.ZodString;
        attempts: z.ZodInt;
        lastError: z.ZodNullable<z.ZodString>;
        createdAt: z.ZodString;
    }, z.core.$strict>>>;
    events: z.ZodArray<z.ZodObject<{
        id: z.ZodUUID;
        kind: z.ZodString;
        payload: z.ZodUnknown;
        createdAt: z.ZodString;
    }, z.core.$strict>>;
    jobs: z.ZodArray<z.ZodObject<{
        app: z.ZodString;
        handler: z.ZodString;
        cron: z.ZodString;
    }, z.core.$strict>>;
}, z.core.$strict>;
export type LiveSessionInspection = z.infer<typeof liveSessionInspectionSchema>;
export declare const liveHostManagementRequestSchema: z.ZodDiscriminatedUnion<[z.ZodObject<{
    operation: z.ZodLiteral<"inspect">;
    type: z.ZodLiteral<"kit-session-manage">;
    version: z.ZodLiteral<1>;
    nonce: z.ZodString;
    requestId: z.ZodUUID;
    environmentId: z.ZodUUID;
}, z.core.$strict>, z.ZodObject<{
    operation: z.ZodLiteral<"run_job">;
    app: z.ZodString;
    handler: z.ZodString;
    testIdentity: z.ZodNullable<z.ZodString>;
    type: z.ZodLiteral<"kit-session-manage">;
    version: z.ZodLiteral<1>;
    nonce: z.ZodString;
    requestId: z.ZodUUID;
    environmentId: z.ZodUUID;
}, z.core.$strict>], "operation">;
export declare const liveHostManagementReplySchema: z.ZodObject<{
    type: z.ZodLiteral<"kit-session-managed">;
    version: z.ZodLiteral<1>;
    nonce: z.ZodString;
    requestId: z.ZodUUID;
    environmentId: z.ZodUUID;
    result: z.ZodDiscriminatedUnion<[z.ZodObject<{
        operation: z.ZodLiteral<"inspect">;
        view: z.ZodObject<{
            jobRuns: z.ZodOptional<z.ZodArray<z.ZodObject<{
                id: z.ZodUUID;
                app: z.ZodString;
                handler: z.ZodString;
                status: z.ZodString;
                attempts: z.ZodInt;
                lastError: z.ZodNullable<z.ZodString>;
                createdAt: z.ZodString;
            }, z.core.$strict>>>;
            events: z.ZodArray<z.ZodObject<{
                id: z.ZodUUID;
                kind: z.ZodString;
                payload: z.ZodUnknown;
                createdAt: z.ZodString;
            }, z.core.$strict>>;
            jobs: z.ZodArray<z.ZodObject<{
                app: z.ZodString;
                handler: z.ZodString;
                cron: z.ZodString;
            }, z.core.$strict>>;
        }, z.core.$strict>;
    }, z.core.$strict>, z.ZodObject<{
        operation: z.ZodLiteral<"run_job">;
        id: z.ZodUUID;
        status: z.ZodString;
    }, z.core.$strict>, z.ZodObject<{
        operation: z.ZodLiteral<"error">;
        code: z.ZodEnum<{
            forbidden: "forbidden";
            unavailable: "unavailable";
        }>;
    }, z.core.$strict>], "operation">;
}, z.core.$strict>;
export type LiveHostManagementReply = z.infer<typeof liveHostManagementReplySchema>;
export declare const liveHostUpdateSchema: z.ZodObject<{
    type: z.ZodLiteral<"kit-session-updated">;
    version: z.ZodLiteral<1>;
    nonce: z.ZodString;
    environmentId: z.ZodUUID;
    status: z.ZodEnum<{
        active: "active";
        degraded: "degraded";
    }>;
    view: z.ZodOptional<z.ZodObject<{
        jobRuns: z.ZodOptional<z.ZodArray<z.ZodObject<{
            id: z.ZodUUID;
            app: z.ZodString;
            handler: z.ZodString;
            status: z.ZodString;
            attempts: z.ZodInt;
            lastError: z.ZodNullable<z.ZodString>;
            createdAt: z.ZodString;
        }, z.core.$strict>>>;
        events: z.ZodArray<z.ZodObject<{
            id: z.ZodUUID;
            kind: z.ZodString;
            payload: z.ZodUnknown;
            createdAt: z.ZodString;
        }, z.core.$strict>>;
        jobs: z.ZodArray<z.ZodObject<{
            app: z.ZodString;
            handler: z.ZodString;
            cron: z.ZodString;
        }, z.core.$strict>>;
    }, z.core.$strict>>;
}, z.core.$strict>;
export declare const liveHostWaitingSchema: z.ZodObject<{
    type: z.ZodLiteral<"kit-session-waiting">;
    version: z.ZodLiteral<1>;
    nonce: z.ZodString;
    requestId: z.ZodUUID;
    environmentId: z.ZodUUID;
    app: z.ZodString;
    testIdentity: z.ZodNullable<z.ZodString>;
}, z.core.$strict>;
export type LiveHostWaiting = z.infer<typeof liveHostWaitingSchema>;
