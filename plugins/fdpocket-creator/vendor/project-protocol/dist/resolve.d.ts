import { z } from 'zod';
import type { SdkErrorCode } from './errors.ts';
export { ORIGIN_HOST_PATTERN } from './origin.ts';
/** Project 専用オリジンのホスト名のラベル（preview.md §1.1。DB の `platform.origin_host` と同じ形） */
/**
 * `platform.gateway_resolve(...)` の応答（gateway.md §2）。Gateway はリクエストごとに 1 回呼ぶ。
 *
 * `active` 以外は DB 名・バケット・capability を持たない（判別 union）。止まっている Project の
 * 資格情報を Gateway のメモリに載せない。
 */
export declare const RESOLVE_STATUSES: readonly ["active", "not_found", "forbidden", "disabled", "consent_required"];
export type ResolveStatus = (typeof RESOLVE_STATUSES)[number];
export declare const dbTargetSchema: z.ZodObject<{
    name: z.ZodString;
    group: z.ZodString;
    adoptionFence: z.ZodOptional<z.ZodNullable<z.ZodUUID>>;
    migrationHash: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, z.core.$strict>;
declare const activeSchema: z.ZodObject<{
    realtime: z.ZodOptional<z.ZodObject<{
        models: z.ZodDefault<z.ZodArray<z.ZodString>>;
        channels: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodObject<{
            scope: z.ZodDefault<z.ZodLiteral<"app">>;
            model: z.ZodString;
            key: z.ZodString;
            events: z.ZodOptional<z.ZodArray<z.ZodString>>;
            actions: z.ZodObject<{
                broadcastReceive: z.ZodString;
                broadcastSend: z.ZodString;
                presenceRead: z.ZodString;
                presenceTrack: z.ZodString;
            }, z.core.$strict>;
        }, z.core.$strict>>>;
    }, z.core.$strict>>;
    status: z.ZodLiteral<"active">;
    versionId: z.ZodUUID;
    schemaKey: z.ZodString;
    schemaVersion: z.ZodString;
    policyVersion: z.ZodString;
    db: z.ZodObject<{
        name: z.ZodString;
        group: z.ZodString;
        adoptionFence: z.ZodOptional<z.ZodNullable<z.ZodUUID>>;
        migrationHash: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, z.core.$strict>;
    storage: z.ZodObject<{
        namespace: z.ZodString;
        buckets: z.ZodRecord<z.ZodString, z.ZodObject<{
            public: z.ZodBoolean;
            maxBytes: z.ZodInt;
            contentTypes: z.ZodArray<z.ZodString>;
            delivery: z.ZodEnum<{
                signed: "signed";
                proxy: "proxy";
            }>;
            appScoped: z.ZodOptional<z.ZodBoolean>;
        }, z.core.$strict>>;
        quotaBytes: z.ZodNullable<z.ZodInt>;
    }, z.core.$strict>;
    app: z.ZodObject<{
        kind: z.ZodEnum<{
            web: "web";
            api: "api";
            jobs: "jobs";
        }>;
        access: z.ZodEnum<{
            public: "public";
            restricted: "restricted";
        }>;
        requiredPermission: z.ZodNullable<z.ZodString>;
        capabilities: z.ZodObject<{
            models: z.ZodRecord<z.ZodString, z.ZodArray<z.ZodEnum<{
                read: "read";
                create: "create";
                update: "update";
                delete: "delete";
            }>>>;
            buckets: z.ZodRecord<z.ZodString, z.ZodArray<z.ZodEnum<{
                read: "read";
                delete: "delete";
                write: "write";
            }>>>;
            realtime: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodArray<z.ZodEnum<{
                broadcastReceive: "broadcastReceive";
                broadcastSend: "broadcastSend";
                presenceRead: "presenceRead";
                presenceTrack: "presenceTrack";
            }>>>>;
            ai: z.ZodOptional<z.ZodObject<{
                chat: z.ZodBoolean;
            }, z.core.$strict>>;
        }, z.core.$strict>;
        anonymous: z.ZodObject<{
            allowed: z.ZodBoolean;
            write: z.ZodBoolean;
        }, z.core.$strict>;
        originHost: z.ZodString;
        providerOrigin: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, z.core.$strict>;
    user: z.ZodObject<{
        bootstrap: z.ZodObject<{
            eligible: z.ZodBoolean;
            roles: z.ZodArray<z.ZodString>;
            legacyRoles: z.ZodArray<z.ZodString>;
        }, z.core.$strict>;
        displayName: z.ZodNullable<z.ZodString>;
        blockedUserIds: z.ZodArray<z.ZodUUID>;
        notifications: z.ZodDefault<z.ZodEnum<{
            default: "default";
            granted: "granted";
            denied: "denied";
        }>>;
    }, z.core.$strict>;
    notificationTriggers: z.ZodOptional<z.ZodArray<z.ZodObject<{
        model: z.ZodString;
        op: z.ZodEnum<{
            create: "create";
            update: "update";
            delete: "delete";
        }>;
        changed: z.ZodArray<z.ZodString>;
        template: z.ZodString;
        to: z.ZodString;
        params: z.ZodRecord<z.ZodString, z.ZodString>;
        exceptActor: z.ZodBoolean;
    }, z.core.$strict>>>;
    defaultRoles: z.ZodArray<z.ZodString>;
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
        requiredPermission: z.ZodNullable<z.ZodString>;
        anonymousAllowed: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$strict>>;
    revoked: z.ZodBoolean;
    rateLimited: z.ZodBoolean;
}, z.core.$strict>;
/**
 * 初回の同意で Host が 1 枚で示すもの（compliance.md §5。`platform.project_consent`）。`version` は共有範囲と
 * 送信先のハッシュで、同意したらこの値を `grant_project_consent` に渡す。
 */
export declare const projectConsentSchema: z.ZodObject<{
    version: z.ZodString;
    shares: z.ZodArray<z.ZodEnum<{
        display_name: "display_name";
        avatar: "avatar";
    }>>;
    network: z.ZodObject<{
        egress: z.ZodArray<z.ZodString>;
        browser: z.ZodArray<z.ZodString>;
    }, z.core.$strict>;
    notifications: z.ZodBoolean;
    ai: z.ZodOptional<z.ZodLiteral<true>>;
    privacySummary: z.ZodNullable<z.ZodObject<{
        ja: z.ZodString;
        en: z.ZodString;
    }, z.core.$strict>>;
}, z.core.$strict>;
export type ProjectConsent = z.infer<typeof projectConsentSchema>;
export declare const gatewayResolveResultSchema: z.ZodDiscriminatedUnion<[z.ZodObject<{
    realtime: z.ZodOptional<z.ZodObject<{
        models: z.ZodDefault<z.ZodArray<z.ZodString>>;
        channels: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodObject<{
            scope: z.ZodDefault<z.ZodLiteral<"app">>;
            model: z.ZodString;
            key: z.ZodString;
            events: z.ZodOptional<z.ZodArray<z.ZodString>>;
            actions: z.ZodObject<{
                broadcastReceive: z.ZodString;
                broadcastSend: z.ZodString;
                presenceRead: z.ZodString;
                presenceTrack: z.ZodString;
            }, z.core.$strict>;
        }, z.core.$strict>>>;
    }, z.core.$strict>>;
    status: z.ZodLiteral<"active">;
    versionId: z.ZodUUID;
    schemaKey: z.ZodString;
    schemaVersion: z.ZodString;
    policyVersion: z.ZodString;
    db: z.ZodObject<{
        name: z.ZodString;
        group: z.ZodString;
        adoptionFence: z.ZodOptional<z.ZodNullable<z.ZodUUID>>;
        migrationHash: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, z.core.$strict>;
    storage: z.ZodObject<{
        namespace: z.ZodString;
        buckets: z.ZodRecord<z.ZodString, z.ZodObject<{
            public: z.ZodBoolean;
            maxBytes: z.ZodInt;
            contentTypes: z.ZodArray<z.ZodString>;
            delivery: z.ZodEnum<{
                signed: "signed";
                proxy: "proxy";
            }>;
            appScoped: z.ZodOptional<z.ZodBoolean>;
        }, z.core.$strict>>;
        quotaBytes: z.ZodNullable<z.ZodInt>;
    }, z.core.$strict>;
    app: z.ZodObject<{
        kind: z.ZodEnum<{
            web: "web";
            api: "api";
            jobs: "jobs";
        }>;
        access: z.ZodEnum<{
            public: "public";
            restricted: "restricted";
        }>;
        requiredPermission: z.ZodNullable<z.ZodString>;
        capabilities: z.ZodObject<{
            models: z.ZodRecord<z.ZodString, z.ZodArray<z.ZodEnum<{
                read: "read";
                create: "create";
                update: "update";
                delete: "delete";
            }>>>;
            buckets: z.ZodRecord<z.ZodString, z.ZodArray<z.ZodEnum<{
                read: "read";
                delete: "delete";
                write: "write";
            }>>>;
            realtime: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodArray<z.ZodEnum<{
                broadcastReceive: "broadcastReceive";
                broadcastSend: "broadcastSend";
                presenceRead: "presenceRead";
                presenceTrack: "presenceTrack";
            }>>>>;
            ai: z.ZodOptional<z.ZodObject<{
                chat: z.ZodBoolean;
            }, z.core.$strict>>;
        }, z.core.$strict>;
        anonymous: z.ZodObject<{
            allowed: z.ZodBoolean;
            write: z.ZodBoolean;
        }, z.core.$strict>;
        originHost: z.ZodString;
        providerOrigin: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, z.core.$strict>;
    user: z.ZodObject<{
        bootstrap: z.ZodObject<{
            eligible: z.ZodBoolean;
            roles: z.ZodArray<z.ZodString>;
            legacyRoles: z.ZodArray<z.ZodString>;
        }, z.core.$strict>;
        displayName: z.ZodNullable<z.ZodString>;
        blockedUserIds: z.ZodArray<z.ZodUUID>;
        notifications: z.ZodDefault<z.ZodEnum<{
            default: "default";
            granted: "granted";
            denied: "denied";
        }>>;
    }, z.core.$strict>;
    notificationTriggers: z.ZodOptional<z.ZodArray<z.ZodObject<{
        model: z.ZodString;
        op: z.ZodEnum<{
            create: "create";
            update: "update";
            delete: "delete";
        }>;
        changed: z.ZodArray<z.ZodString>;
        template: z.ZodString;
        to: z.ZodString;
        params: z.ZodRecord<z.ZodString, z.ZodString>;
        exceptActor: z.ZodBoolean;
    }, z.core.$strict>>>;
    defaultRoles: z.ZodArray<z.ZodString>;
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
        requiredPermission: z.ZodNullable<z.ZodString>;
        anonymousAllowed: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$strict>>;
    revoked: z.ZodBoolean;
    rateLimited: z.ZodBoolean;
}, z.core.$strict>, z.ZodObject<{
    status: z.ZodLiteral<"consent_required">;
    consent: z.ZodObject<{
        version: z.ZodString;
        shares: z.ZodArray<z.ZodEnum<{
            display_name: "display_name";
            avatar: "avatar";
        }>>;
        network: z.ZodObject<{
            egress: z.ZodArray<z.ZodString>;
            browser: z.ZodArray<z.ZodString>;
        }, z.core.$strict>;
        notifications: z.ZodBoolean;
        ai: z.ZodOptional<z.ZodLiteral<true>>;
        privacySummary: z.ZodNullable<z.ZodObject<{
            ja: z.ZodString;
            en: z.ZodString;
        }, z.core.$strict>>;
    }, z.core.$strict>;
    revoked: z.ZodBoolean;
    rateLimited: z.ZodBoolean;
}, z.core.$strict>, z.ZodObject<{
    status: z.ZodEnum<{
        not_found: "not_found";
        forbidden: "forbidden";
        disabled: "disabled";
    }>;
    revoked: z.ZodBoolean;
    rateLimited: z.ZodBoolean;
}, z.core.$strict>], "status">;
export type GatewayResolveResult = z.infer<typeof gatewayResolveResultSchema>;
export type ActiveResolveResult = z.infer<typeof activeSchema>;
/** `active` 以外の status を SDK のエラーにする。`active` は null（通す） */
export declare function errorCodeForResolveStatus(status: ResolveStatus): SdkErrorCode | null;
/**
 * `platform.project_origin_resolve(p_host)` の応答（project-runtime.md §3・preview.md §1.1）。
 * project-origin がホスト名のラベルから環境・active な版・web の App の入口を引く（30 秒キャッシュ）。
 * 静的な配信物だけを決める（データは Gateway を通る）。
 */
export declare const originResolveResultSchema: z.ZodDiscriminatedUnion<[z.ZodObject<{
    status: z.ZodLiteral<"active">;
    projectId: z.ZodUUID;
    environment: z.ZodEnum<{
        main: "main";
        branch: "branch";
        preview: "preview";
        prod: "prod";
    }>;
    branchSessionId: z.ZodOptional<z.ZodNullable<z.ZodUUID>>;
    previewSessionId: z.ZodOptional<z.ZodNullable<z.ZodUUID>>;
    versionId: z.ZodUUID;
    noindex: z.ZodBoolean;
    apps: z.ZodArray<z.ZodObject<{
        slug: z.ZodString;
        kind: z.ZodLiteral<"web">;
        entry: z.ZodString;
        deliveryPublic: z.ZodDefault<z.ZodBoolean>;
        browserOrigins: z.ZodOptional<z.ZodArray<z.ZodString>>;
    }, z.core.$strict>>;
}, z.core.$strict>, z.ZodObject<{
    status: z.ZodEnum<{
        not_found: "not_found";
        disabled: "disabled";
    }>;
}, z.core.$strict>], "status">;
export type OriginResolveResult = z.infer<typeof originResolveResultSchema>;
