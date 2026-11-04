import { z } from 'zod';
import type { Contract } from './contract.ts';
import type { Direction } from './contract-evolution.ts';
/**
 * 凍結する契約の一覧（contract-compatibility.md §4.1）。公開済みのミニアプリ・ネイティブアプリと
 * Platform が通信で交わす形のうち、`contract()` で定義したものすべて。
 *
 * - `read`: Platform が書き、凍結された側が読む（応答・context・claims・event）
 * - `write`: 凍結された側が書き、Platform が読む（hello・op・exchange のリクエスト）
 *
 * ここに足し忘れると凍結の対象にならないので、`contracts.test.ts` が「`contract()` で定義した
 * 公開の名前はすべてここにある」ことを確かめる。
 */
export declare const CONTRACTS: {
    readonly 'ai.resetResponse': {
        readonly contract: Contract<z.ZodObject<{
            conversation: z.ZodString;
        }, z.core.$strip>>;
        readonly direction: "read";
    };
    readonly 'ai.turnEvent': {
        readonly contract: Contract<z.ZodDiscriminatedUnion<[z.ZodObject<{
            type: z.ZodLiteral<"delta">;
            text: z.ZodString;
        }, z.core.$strip>, z.ZodObject<{
            type: z.ZodLiteral<"done">;
            result: z.ZodObject<{
                text: z.ZodString;
                finishReason: z.ZodEnum<{
                    length: "length";
                    stop: "stop";
                    content_filter: "content_filter";
                    other: "other";
                }>;
                json: z.ZodOptional<z.ZodUnknown>;
                credits: z.ZodNumber;
                responseId: z.ZodString;
                model: z.ZodString;
            }, z.core.$strip>;
        }, z.core.$strip>, z.ZodObject<{
            type: z.ZodLiteral<"error">;
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
            message: z.ZodString;
        }, z.core.$strip>], "type">>;
        readonly direction: "read";
    };
    readonly 'ai.turnResult': {
        readonly contract: Contract<z.ZodObject<{
            text: z.ZodString;
            finishReason: z.ZodEnum<{
                length: "length";
                stop: "stop";
                content_filter: "content_filter";
                other: "other";
            }>;
            json: z.ZodOptional<z.ZodUnknown>;
            credits: z.ZodNumber;
            responseId: z.ZodString;
            model: z.ZodString;
        }, z.core.$strip>>;
        readonly direction: "read";
    };
    readonly 'bridge.context': {
        readonly contract: Contract<z.ZodObject<{
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
        readonly direction: "read";
    };
    readonly 'bridge.contextUpdate': {
        readonly contract: Contract<z.ZodObject<{
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
        readonly direction: "read";
    };
    readonly 'bridge.hello': {
        readonly contract: Contract<z.ZodObject<{
            type: z.ZodLiteral<"hello">;
            nonce: z.ZodString;
            contract: z.ZodInt;
        }, z.core.$strip>>;
        readonly direction: "write";
    };
    readonly 'bridge.init': {
        readonly contract: Contract<z.ZodObject<{
            type: z.ZodLiteral<"init">;
            nonce: z.ZodString;
            launchId: z.ZodUUID;
        }, z.core.$strip>>;
        readonly direction: "read";
    };
    readonly 'bridge.op': {
        readonly contract: Contract<z.ZodObject<{
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
        readonly direction: "write";
    };
    readonly 'bridge.reply': {
        readonly contract: Contract<z.ZodDiscriminatedUnion<[z.ZodObject<{
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
        readonly direction: "read";
    };
    readonly 'connections.callResult': {
        readonly contract: Contract<z.ZodObject<{
            result: z.ZodUnknown;
        }, z.core.$strip>>;
        readonly direction: "read";
    };
    readonly 'connections.grantResult': {
        readonly contract: Contract<z.ZodObject<{
            grantId: z.ZodUUID;
        }, z.core.$strip>>;
        readonly direction: "read";
    };
    readonly 'error.response': {
        readonly contract: Contract<z.ZodObject<{
            error: z.ZodObject<{
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
                message: z.ZodString;
                requestId: z.ZodOptional<z.ZodString>;
                retryable: z.ZodBoolean;
                committed: z.ZodOptional<z.ZodBoolean>;
                details: z.ZodOptional<z.ZodUnknown>;
            }, z.core.$strip>;
        }, z.core.$strip>>;
        readonly direction: "read";
    };
    readonly 'jobs.cancelResponse': {
        readonly contract: Contract<z.ZodObject<{
            cancelled: z.ZodBoolean;
        }, z.core.$strip>>;
        readonly direction: "read";
    };
    readonly 'jobs.scheduleResponse': {
        readonly contract: Contract<z.ZodObject<{
            id: z.ZodUUID;
            status: z.ZodEnum<{
                running: "running";
                failed: "failed";
                cancelled: "cancelled";
                done: "done";
                pending: "pending";
            }>;
        }, z.core.$strip>>;
        readonly direction: "read";
    };
    readonly 'notifications.sendResponse': {
        readonly contract: Contract<z.ZodObject<{
            recipients: z.ZodInt;
        }, z.core.$strip>>;
        readonly direction: "read";
    };
    readonly 'notifications.statusResponse': {
        readonly contract: Contract<z.ZodObject<{
            status: z.ZodEnum<{
                default: "default";
                granted: "granted";
                denied: "denied";
            }>;
        }, z.core.$strip>>;
        readonly direction: "read";
    };
    readonly 'profile.response': {
        readonly contract: Contract<z.ZodNullable<z.ZodObject<{
            displayName: z.ZodNullable<z.ZodString>;
            avatarUrl: z.ZodNullable<z.ZodURL>;
        }, z.core.$strip>>>;
        readonly direction: "read";
    };
    readonly 'python.run': {
        readonly contract: Contract<z.ZodObject<{
            runId: z.ZodUUID;
            app: z.ZodString;
            task: z.ZodString;
            status: z.ZodEnum<{
                queued: "queued";
                starting: "starting";
                running: "running";
                succeeded: "succeeded";
                failed: "failed";
                cancelled: "cancelled";
                timed_out: "timed_out";
                stopped: "stopped";
            }>;
            progress: z.ZodNullable<z.ZodNumber>;
            progressMessage: z.ZodNullable<z.ZodString>;
            output: z.ZodOptional<z.ZodUnknown>;
            error: z.ZodOptional<z.ZodNullable<z.ZodObject<{
                code: z.ZodString;
                message: z.ZodNullable<z.ZodString>;
            }, z.core.$strip>>>;
            createdAt: z.ZodString;
            startedAt: z.ZodNullable<z.ZodString>;
            finishedAt: z.ZodNullable<z.ZodString>;
        }, z.core.$strip>>;
        readonly direction: "read";
    };
    readonly 'python.runFinished': {
        readonly contract: Contract<z.ZodObject<{
            runId: z.ZodUUID;
            app: z.ZodString;
            task: z.ZodString;
            status: z.ZodEnum<{
                queued: "queued";
                starting: "starting";
                running: "running";
                succeeded: "succeeded";
                failed: "failed";
                cancelled: "cancelled";
                timed_out: "timed_out";
                stopped: "stopped";
            }>;
            error: z.ZodNullable<z.ZodObject<{
                code: z.ZodString;
                message: z.ZodNullable<z.ZodString>;
            }, z.core.$strip>>;
        }, z.core.$strip>>;
        readonly direction: "read";
    };
    readonly 'safety.blocksResponse': {
        readonly contract: Contract<z.ZodObject<{
            userIds: z.ZodArray<z.ZodString>;
        }, z.core.$strip>>;
        readonly direction: "read";
    };
    readonly 'storage.abortResponse': {
        readonly contract: Contract<z.ZodObject<{
            uploadId: z.ZodUUID;
            status: z.ZodEnum<{
                failed: "failed";
            }>;
        }, z.core.$strip>>;
        readonly direction: "read";
    };
    readonly 'storage.beginResponse': {
        readonly contract: Contract<z.ZodUnion<readonly [z.ZodObject<{
            url: z.ZodURL;
            headers: z.ZodObject<{
                'Content-Type': z.ZodString;
                'Content-Length': z.ZodString;
            }, z.core.$strip>;
            uploadId: z.ZodUUID;
            fileId: z.ZodUUID;
            expiresAt: z.ZodISODateTime;
        }, z.core.$strip>, z.ZodObject<{
            multipart: z.ZodObject<{
                r2UploadId: z.ZodString;
                partSize: z.ZodInt;
                partCount: z.ZodInt;
            }, z.core.$strip>;
            uploadId: z.ZodUUID;
            fileId: z.ZodUUID;
            expiresAt: z.ZodISODateTime;
        }, z.core.$strip>]>>;
        readonly direction: "read";
    };
    readonly 'storage.completeResponse': {
        readonly contract: Contract<z.ZodObject<{
            fileId: z.ZodUUID;
            file: z.ZodObject<{
                id: z.ZodUUID;
                bucket: z.ZodString;
                ownerId: z.ZodString;
                workspaceId: z.ZodNullable<z.ZodString>;
                visibility: z.ZodEnum<{
                    public: "public";
                    private: "private";
                    workspace: "workspace";
                }>;
                status: z.ZodEnum<{
                    failed: "failed";
                    initiated: "initiated";
                    uploading: "uploading";
                    validating: "validating";
                    active: "active";
                    deleting: "deleting";
                    deleted: "deleted";
                }>;
                originalName: z.ZodNullable<z.ZodString>;
                contentType: z.ZodNullable<z.ZodString>;
                sizeBytes: z.ZodNullable<z.ZodInt>;
                publicUrl: z.ZodNullable<z.ZodURL>;
                createdAt: z.ZodISODateTime;
            }, z.core.$strip>;
        }, z.core.$strip>>;
        readonly direction: "read";
    };
    readonly 'storage.deleteResponse': {
        readonly contract: Contract<z.ZodObject<{
            fileId: z.ZodUUID;
            status: z.ZodEnum<{
                deleting: "deleting";
                deleted: "deleted";
            }>;
        }, z.core.$strip>>;
        readonly direction: "read";
    };
    readonly 'storage.downloadResponse': {
        readonly contract: Contract<z.ZodObject<{
            url: z.ZodUnion<readonly [z.ZodURL, z.ZodString]>;
            expiresAt: z.ZodNullable<z.ZodISODateTime>;
        }, z.core.$strip>>;
        readonly direction: "read";
    };
    readonly 'storage.file': {
        readonly contract: Contract<z.ZodObject<{
            id: z.ZodUUID;
            bucket: z.ZodString;
            ownerId: z.ZodString;
            workspaceId: z.ZodNullable<z.ZodString>;
            visibility: z.ZodEnum<{
                public: "public";
                private: "private";
                workspace: "workspace";
            }>;
            status: z.ZodEnum<{
                failed: "failed";
                initiated: "initiated";
                uploading: "uploading";
                validating: "validating";
                active: "active";
                deleting: "deleting";
                deleted: "deleted";
            }>;
            originalName: z.ZodNullable<z.ZodString>;
            contentType: z.ZodNullable<z.ZodString>;
            sizeBytes: z.ZodNullable<z.ZodInt>;
            publicUrl: z.ZodNullable<z.ZodURL>;
            createdAt: z.ZodISODateTime;
        }, z.core.$strip>>;
        readonly direction: "read";
    };
    readonly 'storage.signPartsResponse': {
        readonly contract: Contract<z.ZodObject<{
            parts: z.ZodArray<z.ZodObject<{
                partNumber: z.ZodInt;
                url: z.ZodURL;
                headers: z.ZodObject<{
                    'Content-Length': z.ZodString;
                }, z.core.$strip>;
            }, z.core.$strip>>;
            expiresAt: z.ZodISODateTime;
        }, z.core.$strip>>;
        readonly direction: "read";
    };
    readonly 'token.claims': {
        readonly contract: Contract<z.ZodObject<{
            iss: z.ZodLiteral<"project-gateway">;
            sub: z.ZodString;
            gid: z.ZodString;
            aud: z.ZodUUID;
            app: z.ZodString;
            env: z.ZodEnum<{
                main: "main";
                session: "session";
                prod: "prod";
            }>;
            cv: z.ZodInt;
            envId: z.ZodUUID;
            actorId: z.ZodUUID;
            testIdentity: z.ZodOptional<z.ZodString>;
            testGrantId: z.ZodOptional<z.ZodUUID>;
            anon: z.ZodBoolean;
            jti: z.ZodUUID;
            iat: z.ZodInt;
            exp: z.ZodInt;
        }, z.core.$strip>>;
        readonly direction: "read";
    };
    readonly 'token.exchangeRequest': {
        readonly contract: Contract<z.ZodObject<{
            projectId: z.ZodUUID;
            app: z.ZodString;
            environment: z.ZodEnum<{
                main: "main";
                session: "session";
                prod: "prod";
            }>;
            environmentId: z.ZodOptional<z.ZodUUID>;
            testIdentity: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        readonly direction: "write";
    };
    readonly 'token.exchangeResponse': {
        readonly contract: Contract<z.ZodObject<{
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
        }, z.core.$strip>>;
        readonly direction: "read";
    };
    readonly 'token.serviceClaims': {
        readonly contract: Contract<z.ZodObject<{
            iss: z.ZodLiteral<"project-gateway">;
            typ: z.ZodLiteral<"service">;
            sub: z.ZodString;
            aud: z.ZodUUID;
            app: z.ZodString;
            env: z.ZodEnum<{
                main: "main";
                session: "session";
                prod: "prod";
            }>;
            cv: z.ZodInt;
            envId: z.ZodUUID;
            cid: z.ZodUUID;
            permissions: z.ZodArray<z.ZodString>;
            jti: z.ZodUUID;
            iat: z.ZodInt;
            exp: z.ZodInt;
        }, z.core.$strip>>;
        readonly direction: "read";
    };
    readonly 'token.serviceResponse': {
        readonly contract: Contract<z.ZodObject<{
            token: z.ZodString;
            expiresAt: z.ZodISODateTime;
        }, z.core.$strip>>;
        readonly direction: "read";
    };
    readonly 'token.session': {
        readonly contract: Contract<z.ZodObject<{
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
        readonly direction: "read";
    };
    readonly 'token.sessionApp': {
        readonly contract: Contract<z.ZodObject<{
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
        readonly direction: "read";
    };
    readonly 'users.invitation': {
        readonly contract: Contract<z.ZodObject<{
            invitationId: z.ZodUUID;
            status: z.ZodEnum<{
                pending: "pending";
                expired: "expired";
            }>;
            invitee: z.ZodNullable<z.ZodString>;
            appSlug: z.ZodNullable<z.ZodString>;
            expiresAt: z.ZodString;
            createdAt: z.ZodString;
        }, z.core.$strip>>;
        readonly direction: "read";
    };
    readonly 'users.invitationResult': {
        readonly contract: Contract<z.ZodObject<{
            kind: z.ZodEnum<{
                invited: "invited";
                workspace_invited: "workspace_invited";
                already_has_access: "already_has_access";
            }>;
            invitationId: z.ZodOptional<z.ZodUUID>;
            expiresAt: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        readonly direction: "read";
    };
    readonly 'users.invitations': {
        readonly contract: Contract<z.ZodObject<{
            invitations: z.ZodArray<z.ZodObject<{
                invitationId: z.ZodUUID;
                status: z.ZodEnum<{
                    pending: "pending";
                    expired: "expired";
                }>;
                invitee: z.ZodNullable<z.ZodString>;
                appSlug: z.ZodNullable<z.ZodString>;
                expiresAt: z.ZodString;
                createdAt: z.ZodString;
            }, z.core.$strip>>;
        }, z.core.$strip>>;
        readonly direction: "read";
    };
    readonly 'workspaces.invitation': {
        readonly contract: Contract<z.ZodObject<{
            invitationId: z.ZodUUID;
            workspaceId: z.ZodUUID;
            workspaceName: z.ZodNullable<z.ZodString>;
            role: z.ZodEnum<{
                admin: "admin";
                editor: "editor";
                viewer: "viewer";
            }>;
            invitedByUserId: z.ZodNullable<z.ZodString>;
            expiresAt: z.ZodString;
        }, z.core.$strip>>;
        readonly direction: "read";
    };
    readonly 'workspaces.invitationCreated': {
        readonly contract: Contract<z.ZodObject<{
            invitationId: z.ZodUUID;
            expiresAt: z.ZodString;
        }, z.core.$strip>>;
        readonly direction: "read";
    };
    readonly 'workspaces.invitations': {
        readonly contract: Contract<z.ZodObject<{
            invitations: z.ZodArray<z.ZodObject<{
                invitationId: z.ZodUUID;
                workspaceId: z.ZodUUID;
                workspaceName: z.ZodNullable<z.ZodString>;
                role: z.ZodEnum<{
                    admin: "admin";
                    editor: "editor";
                    viewer: "viewer";
                }>;
                invitedByUserId: z.ZodNullable<z.ZodString>;
                expiresAt: z.ZodString;
            }, z.core.$strip>>;
        }, z.core.$strip>>;
        readonly direction: "read";
    };
    readonly 'workspaces.membership': {
        readonly contract: Contract<z.ZodObject<{
            workspaceId: z.ZodUUID;
            role: z.ZodEnum<{
                admin: "admin";
                editor: "editor";
                viewer: "viewer";
                owner: "owner";
            }>;
        }, z.core.$strip>>;
        readonly direction: "read";
    };
    readonly 'workspaces.workspace': {
        readonly contract: Contract<z.ZodObject<{
            id: z.ZodUUID;
            name: z.ZodString;
        }, z.core.$strip>>;
        readonly direction: "read";
    };
};
export type ContractName = keyof typeof CONTRACTS;
/** 契約の JSON Schema（書く側の形 = `exact`。未知のキー・値を拒む形を凍結する） */
export declare function jsonSchemaOf(name: ContractName): unknown;
/** 全契約の JSON Schema（名前順。凍結ファイルの中身） */
export declare function frozenSchemas(): Record<string, {
    direction: Direction;
    schema: unknown;
}>;
