import { z } from 'zod';
import { type ConnectionCapabilities } from './connections.ts';
import { type NetworkMock } from './network-mocks.ts';
import { type NormalizedPythonApp } from './python.ts';
/**
 * `infra/project.yaml`（project-runtime.md §2）の正本。
 *
 * 取り込み・静的検証・`kit generate` が同じスキーマで検査する。YAML の読み込みは呼び出し側
 * （Kit / validator）が行い、ここは読んだ結果のオブジェクトだけを扱う。cron の UTC 検証は
 * タイマーを起動しない Croner（依存なし）を共有し、Node / Deno 固有 API を持ち込まない。
 * ZModel にモデルが存在するかの突合は validator（tasks/0428）が行う。
 */
export declare const PROJECT_MANIFEST_VERSION = 1;
/** API 契約の版（sdk.md §9） */
export declare const PROJECT_SDK_VERSION = 3;
/** App の slug（URL のパス・トークンの `app` claim） */
export declare const APP_SLUG_PATTERN: RegExp;
/** 論理バケット名（R2 の prefix に入る） */
export declare const BUCKET_NAME_PATTERN: RegExp;
/** Permission 名（例: `app.access.admin`） */
export declare const PERMISSION_PATTERN: RegExp;
/** Platform が使う Permission の名前空間。Project は宣言できない */
export declare const RESERVED_PERMISSION_PREFIX = "platform.";
/**
 * App の種類。`web` は静的サイト（admin も `access: restricted` の web）、
 * `api` / `jobs` は Workers for Platforms（P1。README Q5。integrations.md §3.1）、
 * `python` は Modal の Sandbox で動く GPU の Python（python-backend.md）。
 */
export declare const APP_KINDS: readonly ["web", "api", "jobs", "python"];
export type AppKind = (typeof APP_KINDS)[number];
/** 利用者の代わりに Gateway を呼ぶ App（capability を持たず、secrets・egress・servicePermissions を持つ） */
export declare const SERVER_APP_KINDS: readonly AppKind[];
/** Workers for Platforms に配備する App（TypeScript の Worker） */
export declare const WORKER_APP_KINDS: readonly AppKind[];
/** サーバーの App のサービストークンに付けられる権限（gateway.md §3.4。`notifications.send` は tasks/0476） */
export declare const SERVICE_PERMISSIONS: readonly ["notifications.send", "jobs.schedule", "jobs.consume", "ai.chat", "python.run"];
export type ServicePermission = (typeof SERVICE_PERMISSIONS)[number];
/** secret の名前（`env.<NAME>`）。Worker の binding の名前になる */
export declare const SECRET_NAME_PATTERN: RegExp;
/** Platform が Worker に付ける binding（Project の secret に使えない） */
export declare const RESERVED_SECRET_NAMES: readonly ["GATEWAY_URL"];
export declare const RESERVED_SECRET_PREFIX = "PLATFORM_";
/** 1 App の secret の数 */
export declare const SECRETS_PER_APP_MAX = 50;
/** 1 App の network の宣言の数（egress / browser それぞれ） */
export declare const NETWORK_HOSTS_MAX = 50;
export declare const APP_ACCESSES: readonly ["public", "restricted"];
export type AppAccess = (typeof APP_ACCESSES)[number];
export declare const MODEL_OPERATIONS: readonly ["read", "create", "update", "delete"];
export type ModelOperation = (typeof MODEL_OPERATIONS)[number];
export declare const BUCKET_OPERATIONS: readonly ["read", "write", "delete"];
export type BucketOperation = (typeof BUCKET_OPERATIONS)[number];
/**
 * App が宣言できない操作（project-runtime.md §2）。
 * User は bootstrap、StorageFile の作成・更新は Storage API、AuditEvent は Gateway だけが書く。
 */
export declare const FORBIDDEN_MODEL_OPERATIONS: Readonly<Record<string, readonly ModelOperation[]>>;
/** 取り込みを止めずに作者・Agent へ返す注意 */
export type ProjectManifestIssueCode = 'invalid_network_mock' | 'invalid_slug' | 'reserved_slug' | 'invalid_bucket_name' | 'invalid_role_name' | 'invalid_model_name' | 'required' | 'not_allowed' | 'too_many_buckets' | 'unknown_bucket' | 'unknown_role' | 'reserved_permission' | 'forbidden_operation' | 'anonymous_write_without_access' | 'duplicate' | 'invalid_template_key' | 'invalid_notification_path' | 'undeclared_notification_param' | 'unknown_notification_template' | 'notification_params_mismatch' | 'invalid_trigger_value' | 'invalid_host' | 'invalid_origin' | 'ip_literal' | 'internal_host' | 'platform_host' | 'invalid_secret_name' | 'reserved_secret_name' | 'invalid_task_name' | 'unknown_python_task' | 'unknown_finish_target' | 'missing_permission';
export type ProjectManifestWarningCode = 'anonymous_write' | 'sensitive_notification_param';
/** App の表示名（Platform が返すときは長さを問わない。宣言の検証は appSchema が持つ） */
export declare const localizedNameSchema: z.ZodObject<{
    ja: z.ZodString;
    en: z.ZodString;
}, z.core.$strict>;
/**
 * 通知のテンプレート（integrations.md §2.3）。文面はテンプレート + パラメータだけで、DB が送信時に描画する
 * （93_project_notifications.sql。上限も同じ値）。
 */
export declare const NOTIFICATION_LIMITS: {
    readonly title: 60;
    readonly body: 120;
    readonly param: 100;
    readonly path: 256;
    readonly templates: 50;
    readonly triggers: 50;
};
/** ミニアプリ内の相対パスだけ（外部 URL・`//`・空白・バックスラッシュ不可） */
export declare function isNotificationPath(path: string): boolean;
/**
 * 宣言的トリガー（integrations.md §2.3・§2.4。tasks/0475）。Gateway が `/v1/db` の書き込みの確定後に評価する。
 * 発火するのは単一行の op（create / update / delete）だけ（updateMany 等は宣言できない。2026-10-16 決定 §6）。
 */
export declare const NOTIFICATION_TRIGGER_OPS: readonly ["create", "update", "delete"];
export type NotificationTriggerOp = (typeof NOTIFICATION_TRIGGER_OPS)[number];
/** パラメータの値の参照（`$row.<列>` / `$actor.id` / `$actor.displayName`）。`$` で始まらなければ固定の文字列 */
export declare const TRIGGER_VALUE_PATTERN: RegExp;
/** 指示文（`ai/<key>.md`）・Schema（`ai/schemas/<key>.json`）の名前。DB の CHECK と同じ形 */
export declare const AI_INSTRUCTIONS_KEY_PATTERN: RegExp;
export declare const AI_SCHEMA_KEY_PATTERN: RegExp;
export declare const AI_PROMPTS_PER_KIND_MAX = 8;
export declare const AI_PROMPT_MAX_BYTES = 8192;
/**
 * 1 ターンの出力の上限（OpenRouter の `max_tokens`。推論するモデルでは推論のトークンも含む）。
 * 既定は推論しても普通の応答が切れない量、上限は許可したモデルの最小の出力上限
 * （2026-10-22 の OpenRouter のモデル一覧で Gemini 3.8 Flash の 65,536。他は 128,000 以上）。
 * 課金は実際に使った分だけで、この値は 1 ターンの最大額を抑える
 */
export declare const AI_MAX_OUTPUT_TOKENS_DEFAULT = 16384;
export declare const AI_MAX_OUTPUT_TOKENS_LIMIT = 65536;
declare const baseSchema: z.ZodObject<{
    version: z.ZodLiteral<1>;
    sdkVersion: z.ZodLiteral<3>;
    apps: z.ZodRecord<z.ZodString, z.ZodObject<{
        kind: z.ZodEnum<{
            web: "web";
            api: "api";
            jobs: "jobs";
            python: "python";
        }>;
        access: z.ZodOptional<z.ZodEnum<{
            public: "public";
            restricted: "restricted";
        }>>;
        displayName: z.ZodOptional<z.ZodObject<{
            ja: z.ZodString;
            en: z.ZodString;
        }, z.core.$strict>>;
        requiredPermission: z.ZodOptional<z.ZodString>;
        capabilities: z.ZodOptional<z.ZodObject<{
            models: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodArray<z.ZodEnum<{
                read: "read";
                create: "create";
                update: "update";
                delete: "delete";
            }>>>>;
            buckets: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodArray<z.ZodEnum<{
                read: "read";
                delete: "delete";
                write: "write";
            }>>>>;
            realtime: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodArray<z.ZodEnum<{
                broadcastReceive: "broadcastReceive";
                broadcastSend: "broadcastSend";
                presenceRead: "presenceRead";
                presenceTrack: "presenceTrack";
            }>>>>;
            ai: z.ZodOptional<z.ZodObject<{
                chat: z.ZodBoolean;
            }, z.core.$strict>>;
            connections: z.ZodOptional<z.ZodRecord<z.ZodEnum<{
                "google-drive": "google-drive";
                "google-mail": "google-mail";
                "google-calendar": "google-calendar";
                "google-contacts": "google-contacts";
                "microsoft-files": "microsoft-files";
                "microsoft-mail": "microsoft-mail";
                "microsoft-calendar": "microsoft-calendar";
                "microsoft-contacts": "microsoft-contacts";
            }> & z.core.$partial, z.ZodArray<z.ZodLiteral<"fdpocket-read">>>>;
            python: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodArray<z.ZodString>>>;
        }, z.core.$strict>>;
        anonymous: z.ZodOptional<z.ZodObject<{
            allowed: z.ZodBoolean;
            write: z.ZodBoolean;
        }, z.core.$strict>>;
        network: z.ZodOptional<z.ZodObject<{
            egress: z.ZodOptional<z.ZodArray<z.ZodString>>;
            browser: z.ZodOptional<z.ZodArray<z.ZodString>>;
            mocks: z.ZodOptional<z.ZodArray<z.ZodObject<{
                host: z.ZodString;
                status: z.ZodInt;
                headers: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                body: z.ZodOptional<z.ZodString>;
            }, z.core.$strict>>>;
        }, z.core.$strict>>;
        secrets: z.ZodOptional<z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            description: z.ZodOptional<z.ZodObject<{
                ja: z.ZodString;
                en: z.ZodString;
            }, z.core.$strict>>;
            required: z.ZodOptional<z.ZodBoolean>;
        }, z.core.$strict>>>;
        servicePermissions: z.ZodOptional<z.ZodArray<z.ZodEnum<{
            "notifications.send": "notifications.send";
            "jobs.schedule": "jobs.schedule";
            "jobs.consume": "jobs.consume";
            "ai.chat": "ai.chat";
            "python.run": "python.run";
        }>>>;
        schedules: z.ZodOptional<z.ZodArray<z.ZodObject<{
            cron: z.ZodString;
            handler: z.ZodString;
        }, z.core.$strict>>>;
        routes: z.ZodOptional<z.ZodArray<z.ZodLiteral<"/api/*">>>;
        python: z.ZodOptional<z.ZodEnum<{
            3.11: "3.11";
            3.12: "3.12";
            3.13: "3.13";
        }>>;
        compute: z.ZodOptional<z.ZodObject<{
            gpu: z.ZodOptional<z.ZodString>;
            cpu: z.ZodOptional<z.ZodNumber>;
            memoryMiB: z.ZodOptional<z.ZodNumber>;
        }, z.core.$strict>>;
        tasks: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodObject<{
            handler: z.ZodString;
            onFinish: z.ZodOptional<z.ZodObject<{
                app: z.ZodString;
                handler: z.ZodString;
            }, z.core.$strict>>;
            timeoutSeconds: z.ZodOptional<z.ZodNumber>;
            compute: z.ZodOptional<z.ZodObject<{
                gpu: z.ZodOptional<z.ZodString>;
                cpu: z.ZodOptional<z.ZodNumber>;
                memoryMiB: z.ZodOptional<z.ZodNumber>;
            }, z.core.$strict>>;
        }, z.core.$strict>>>;
        server: z.ZodOptional<z.ZodObject<{
            handler: z.ZodString;
            idleTimeoutSeconds: z.ZodOptional<z.ZodNumber>;
            maxInstances: z.ZodOptional<z.ZodNumber>;
            targetConcurrency: z.ZodOptional<z.ZodNumber>;
            compute: z.ZodOptional<z.ZodObject<{
                gpu: z.ZodOptional<z.ZodString>;
                cpu: z.ZodOptional<z.ZodNumber>;
                memoryMiB: z.ZodOptional<z.ZodNumber>;
            }, z.core.$strict>>;
        }, z.core.$strict>>;
        cache: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$strict>>;
    buckets: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodObject<{
        public: z.ZodBoolean;
        maxBytes: z.ZodNumber;
        contentTypes: z.ZodArray<z.ZodString>;
        delivery: z.ZodOptional<z.ZodEnum<{
            signed: "signed";
            proxy: "proxy";
        }>>;
        appScoped: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$strict>>>;
    roles: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodArray<z.ZodString>>>;
    defaultRoles: z.ZodOptional<z.ZodArray<z.ZodString>>;
    ownerBootstrap: z.ZodOptional<z.ZodArray<z.ZodString>>;
    notifications: z.ZodOptional<z.ZodObject<{
        templates: z.ZodRecord<z.ZodString, z.ZodObject<{
            app: z.ZodOptional<z.ZodString>;
            category: z.ZodOptional<z.ZodString>;
            title: z.ZodObject<{
                ja: z.ZodString;
                en: z.ZodString;
            }, z.core.$strict>;
            body: z.ZodObject<{
                ja: z.ZodString;
                en: z.ZodString;
            }, z.core.$strict>;
            params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodObject<{
                maxLength: z.ZodNumber;
            }, z.core.$strict>>>;
            path: z.ZodOptional<z.ZodString>;
        }, z.core.$strict>>;
        triggers: z.ZodOptional<z.ZodArray<z.ZodObject<{
            on: z.ZodObject<{
                model: z.ZodString;
                op: z.ZodEnum<{
                    create: "create";
                    update: "update";
                    delete: "delete";
                }>;
                when: z.ZodOptional<z.ZodObject<{
                    changed: z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>;
                }, z.core.$strict>>;
            }, z.core.$strict>;
            template: z.ZodString;
            to: z.ZodObject<{
                field: z.ZodString;
            }, z.core.$strict>;
            params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
            except: z.ZodOptional<z.ZodLiteral<"actor">>;
        }, z.core.$strict>>>;
    }, z.core.$strict>>;
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
    ai: z.ZodOptional<z.ZodObject<{
        model: z.ZodOptional<z.ZodString>;
        maxOutputTokens: z.ZodOptional<z.ZodNumber>;
        instructions: z.ZodOptional<z.ZodArray<z.ZodString>>;
        schemas: z.ZodOptional<z.ZodArray<z.ZodString>>;
    }, z.core.$strict>>;
}, z.core.$strict>;
export type ProjectManifestInput = z.input<typeof baseSchema>;
export type ProjectManifest = z.output<typeof baseSchema>;
export declare const projectManifestSchema: z.ZodObject<{
    version: z.ZodLiteral<1>;
    sdkVersion: z.ZodLiteral<3>;
    apps: z.ZodRecord<z.ZodString, z.ZodObject<{
        kind: z.ZodEnum<{
            web: "web";
            api: "api";
            jobs: "jobs";
            python: "python";
        }>;
        access: z.ZodOptional<z.ZodEnum<{
            public: "public";
            restricted: "restricted";
        }>>;
        displayName: z.ZodOptional<z.ZodObject<{
            ja: z.ZodString;
            en: z.ZodString;
        }, z.core.$strict>>;
        requiredPermission: z.ZodOptional<z.ZodString>;
        capabilities: z.ZodOptional<z.ZodObject<{
            models: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodArray<z.ZodEnum<{
                read: "read";
                create: "create";
                update: "update";
                delete: "delete";
            }>>>>;
            buckets: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodArray<z.ZodEnum<{
                read: "read";
                delete: "delete";
                write: "write";
            }>>>>;
            realtime: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodArray<z.ZodEnum<{
                broadcastReceive: "broadcastReceive";
                broadcastSend: "broadcastSend";
                presenceRead: "presenceRead";
                presenceTrack: "presenceTrack";
            }>>>>;
            ai: z.ZodOptional<z.ZodObject<{
                chat: z.ZodBoolean;
            }, z.core.$strict>>;
            connections: z.ZodOptional<z.ZodRecord<z.ZodEnum<{
                "google-drive": "google-drive";
                "google-mail": "google-mail";
                "google-calendar": "google-calendar";
                "google-contacts": "google-contacts";
                "microsoft-files": "microsoft-files";
                "microsoft-mail": "microsoft-mail";
                "microsoft-calendar": "microsoft-calendar";
                "microsoft-contacts": "microsoft-contacts";
            }> & z.core.$partial, z.ZodArray<z.ZodLiteral<"fdpocket-read">>>>;
            python: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodArray<z.ZodString>>>;
        }, z.core.$strict>>;
        anonymous: z.ZodOptional<z.ZodObject<{
            allowed: z.ZodBoolean;
            write: z.ZodBoolean;
        }, z.core.$strict>>;
        network: z.ZodOptional<z.ZodObject<{
            egress: z.ZodOptional<z.ZodArray<z.ZodString>>;
            browser: z.ZodOptional<z.ZodArray<z.ZodString>>;
            mocks: z.ZodOptional<z.ZodArray<z.ZodObject<{
                host: z.ZodString;
                status: z.ZodInt;
                headers: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                body: z.ZodOptional<z.ZodString>;
            }, z.core.$strict>>>;
        }, z.core.$strict>>;
        secrets: z.ZodOptional<z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            description: z.ZodOptional<z.ZodObject<{
                ja: z.ZodString;
                en: z.ZodString;
            }, z.core.$strict>>;
            required: z.ZodOptional<z.ZodBoolean>;
        }, z.core.$strict>>>;
        servicePermissions: z.ZodOptional<z.ZodArray<z.ZodEnum<{
            "notifications.send": "notifications.send";
            "jobs.schedule": "jobs.schedule";
            "jobs.consume": "jobs.consume";
            "ai.chat": "ai.chat";
            "python.run": "python.run";
        }>>>;
        schedules: z.ZodOptional<z.ZodArray<z.ZodObject<{
            cron: z.ZodString;
            handler: z.ZodString;
        }, z.core.$strict>>>;
        routes: z.ZodOptional<z.ZodArray<z.ZodLiteral<"/api/*">>>;
        python: z.ZodOptional<z.ZodEnum<{
            3.11: "3.11";
            3.12: "3.12";
            3.13: "3.13";
        }>>;
        compute: z.ZodOptional<z.ZodObject<{
            gpu: z.ZodOptional<z.ZodString>;
            cpu: z.ZodOptional<z.ZodNumber>;
            memoryMiB: z.ZodOptional<z.ZodNumber>;
        }, z.core.$strict>>;
        tasks: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodObject<{
            handler: z.ZodString;
            onFinish: z.ZodOptional<z.ZodObject<{
                app: z.ZodString;
                handler: z.ZodString;
            }, z.core.$strict>>;
            timeoutSeconds: z.ZodOptional<z.ZodNumber>;
            compute: z.ZodOptional<z.ZodObject<{
                gpu: z.ZodOptional<z.ZodString>;
                cpu: z.ZodOptional<z.ZodNumber>;
                memoryMiB: z.ZodOptional<z.ZodNumber>;
            }, z.core.$strict>>;
        }, z.core.$strict>>>;
        server: z.ZodOptional<z.ZodObject<{
            handler: z.ZodString;
            idleTimeoutSeconds: z.ZodOptional<z.ZodNumber>;
            maxInstances: z.ZodOptional<z.ZodNumber>;
            targetConcurrency: z.ZodOptional<z.ZodNumber>;
            compute: z.ZodOptional<z.ZodObject<{
                gpu: z.ZodOptional<z.ZodString>;
                cpu: z.ZodOptional<z.ZodNumber>;
                memoryMiB: z.ZodOptional<z.ZodNumber>;
            }, z.core.$strict>>;
        }, z.core.$strict>>;
        cache: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$strict>>;
    buckets: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodObject<{
        public: z.ZodBoolean;
        maxBytes: z.ZodNumber;
        contentTypes: z.ZodArray<z.ZodString>;
        delivery: z.ZodOptional<z.ZodEnum<{
            signed: "signed";
            proxy: "proxy";
        }>>;
        appScoped: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$strict>>>;
    roles: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodArray<z.ZodString>>>;
    defaultRoles: z.ZodOptional<z.ZodArray<z.ZodString>>;
    ownerBootstrap: z.ZodOptional<z.ZodArray<z.ZodString>>;
    notifications: z.ZodOptional<z.ZodObject<{
        templates: z.ZodRecord<z.ZodString, z.ZodObject<{
            app: z.ZodOptional<z.ZodString>;
            category: z.ZodOptional<z.ZodString>;
            title: z.ZodObject<{
                ja: z.ZodString;
                en: z.ZodString;
            }, z.core.$strict>;
            body: z.ZodObject<{
                ja: z.ZodString;
                en: z.ZodString;
            }, z.core.$strict>;
            params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodObject<{
                maxLength: z.ZodNumber;
            }, z.core.$strict>>>;
            path: z.ZodOptional<z.ZodString>;
        }, z.core.$strict>>;
        triggers: z.ZodOptional<z.ZodArray<z.ZodObject<{
            on: z.ZodObject<{
                model: z.ZodString;
                op: z.ZodEnum<{
                    create: "create";
                    update: "update";
                    delete: "delete";
                }>;
                when: z.ZodOptional<z.ZodObject<{
                    changed: z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>;
                }, z.core.$strict>>;
            }, z.core.$strict>;
            template: z.ZodString;
            to: z.ZodObject<{
                field: z.ZodString;
            }, z.core.$strict>;
            params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
            except: z.ZodOptional<z.ZodLiteral<"actor">>;
        }, z.core.$strict>>>;
    }, z.core.$strict>>;
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
    ai: z.ZodOptional<z.ZodObject<{
        model: z.ZodOptional<z.ZodString>;
        maxOutputTokens: z.ZodOptional<z.ZodNumber>;
        instructions: z.ZodOptional<z.ZodArray<z.ZodString>>;
        schemas: z.ZodOptional<z.ZodArray<z.ZodString>>;
    }, z.core.$strict>>;
}, z.core.$strict>;
export interface ProjectManifestIssue {
    /** `apps.admin.requiredPermission` のようなドット区切り */
    path: string;
    /** 上の `ProjectManifestIssueCode`、または zod の issue code（`invalid_type` 等） */
    code: string;
    message: string;
}
export interface ProjectManifestWarning {
    path: string;
    code: ProjectManifestWarningCode;
    message: string;
}
export type ParseProjectManifestResult = {
    success: true;
    manifest: ProjectManifest;
    warnings: ProjectManifestWarning[];
} | {
    success: false;
    errors: ProjectManifestIssue[];
};
export declare function parseProjectManifest(input: unknown): ParseProjectManifestResult;
/** 検証済み Artifact から写す指示文・Schema の本文（版に固定。project-ai.md §3.1） */
export interface AiPrompt {
    kind: 'instructions' | 'schema';
    key: string;
    content: string;
    sha256: string;
}
export interface NormalizedAppCapabilities {
    models: Record<string, ModelOperation[]>;
    buckets: Record<string, BucketOperation[]>;
    ai?: {
        chat: boolean;
    };
    connections?: ConnectionCapabilities;
    /** python の App → 依頼できるタスク（名前順） */
    python?: Record<string, string[]>;
    realtime?: Record<string, ('broadcastReceive' | 'broadcastSend' | 'presenceRead' | 'presenceTrack')[]>;
}
export interface NormalizedSecret {
    name: string;
    description: {
        ja: string;
        en: string;
    } | null;
    required: boolean;
}
export interface NormalizedProjectApp {
    slug: string;
    kind: AppKind;
    access: AppAccess;
    displayName: {
        ja: string;
        en: string;
    } | null;
    /** 配信物の入口（`dist/<slug>/…`） */
    entry: string;
    requiredPermission: string | null;
    capabilities: NormalizedAppCapabilities;
    anonymous: {
        allowed: boolean;
        write: boolean;
    };
    /** egress はサーバーの App、browser は web だけが持つ（もう一方は空） */
    network: {
        egress: string[];
        browser: string[];
        mocks?: NetworkMock[];
    };
    /** 名前順。値は project_secrets（Vault）。tasks/0479 */
    secrets: NormalizedSecret[];
    servicePermissions: ServicePermission[];
    schedules?: {
        cron: string;
        handler: string;
    }[];
    /** python の App だけ（python-backend.md §3。資源は App の既定で埋めた値） */
    python?: NormalizedPythonApp;
}
export interface NormalizedBucket {
    public: boolean;
    maxBytes: number;
    contentTypes: string[];
    delivery: 'signed' | 'proxy';
    appScoped?: boolean;
}
export interface NormalizedNotificationTemplate {
    app?: string;
    category?: string;
    title: {
        ja: string;
        en: string;
    };
    body: {
        ja: string;
        en: string;
    };
    params: Record<string, {
        maxLength: number;
    }>;
    path?: string;
}
/** 正規化したトリガー（`project_versions.manifest` に入り、`gateway_resolve` が Gateway へ返す） */
export declare const normalizedNotificationTriggerSchema: z.ZodObject<{
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
}, z.core.$strict>;
export type NormalizedNotificationTrigger = z.infer<typeof normalizedNotificationTriggerSchema>;
export interface NormalizedProjectManifest {
    realtime?: import('./realtime.ts').RealtimeManifest;
    version: typeof PROJECT_MANIFEST_VERSION;
    sdkVersion: typeof PROJECT_SDK_VERSION;
    apps: Record<string, NormalizedProjectApp>;
    buckets: Record<string, NormalizedBucket>;
    roles: Record<string, string[]>;
    defaultRoles: string[];
    ownerBootstrap: string[];
    /**
     * AI を使う App があるときだけ持つ（project-ai.md §4）。`model` は省略で Jev Router（別名 auto）。
     * 初回の同意（21_project_consents.sql）は AI への送信とクレジットの消費をこの有無で示し、同意の版にも入る。
     * 検証器は指示文・Schema の本文を `prompts` に足し、`apply_validated_manifest` が `project_ai_prompts` に写す
     */
    ai?: {
        model?: string;
        maxOutputTokens: number;
        instructions: string[];
        schemas: string[];
        prompts?: AiPrompt[];
    };
    /**
     * 宣言したときだけ持つ。初回の同意（21_project_consents.sql）は「通知を送ることがあります」を
     * この有無で決め、同意の版（ハッシュ）にも入る。テンプレートの中身は入らない。
     */
    notifications?: {
        templates: Record<string, NormalizedNotificationTemplate>;
        /** 宣言したときだけ持つ（宣言の順） */
        triggers?: NormalizedNotificationTrigger[];
    };
}
/** App の配信物の入口（`dist/` からの相対。web は index.html、Worker は index.js、python は pyproject.toml） */
export declare function appEntryOf(slug: string, kind: AppKind): string;
/**
 * 検証済みの manifest を、宣言の順序に依らない形にする（同じ宣言 → 同じ JSON）。
 * `apps` は `project_version_apps` の行（slug 順）。
 */
export declare function normalizeProjectManifest(manifest: ProjectManifest): {
    manifest: NormalizedProjectManifest;
    apps: NormalizedProjectApp[];
};
export {};
