import { z } from 'zod';
import { APP_ACCESSES, APP_KINDS, APP_SLUG_PATTERN, BUCKET_OPERATIONS, localizedNameSchema, MODEL_OPERATIONS, NOTIFICATION_LIMITS, normalizedNotificationTriggerSchema, PERMISSION_PATTERN, } from "./manifest.js";
import { notificationStatusSchema } from "./notifications.js";
import { ORIGIN_HOST_PATTERN, providerOriginSchema } from "./origin.js";
import { realtimeManifestSchema } from "./realtime.js";
export { ORIGIN_HOST_PATTERN } from "./origin.js";
/** Project 専用オリジンのホスト名のラベル（preview.md §1.1。DB の `platform.origin_host` と同じ形） */
/**
 * `platform.gateway_resolve(...)` の応答（gateway.md §2）。Gateway はリクエストごとに 1 回呼ぶ。
 *
 * `active` 以外は DB 名・バケット・capability を持たない（判別 union）。止まっている Project の
 * 資格情報を Gateway のメモリに載せない。
 */
export const RESOLVE_STATUSES = [
    'active',
    /** Project / App / 環境が無い、または restricted で本人が使えない（存在を明かさない） */
    'not_found',
    /** 年齢区分・requiredPermission・チャットの閲覧権限が無い */
    'forbidden',
    /** projects / project_environments / runtime_compat のどれかが止まっている */
    'disabled',
    /** このミニアプリへの初回の同意が無い（compliance.md §5） */
    'consent_required',
];
const capabilitiesSchema = z.strictObject({
    models: z.record(z.string(), z.array(z.enum(MODEL_OPERATIONS))),
    buckets: z.record(z.string(), z.array(z.enum(BUCKET_OPERATIONS))),
    realtime: z
        .record(z.string(), z.array(z.enum(['broadcastReceive', 'broadcastSend', 'presenceRead', 'presenceTrack'])))
        .optional(),
    ai: z.strictObject({ chat: z.boolean() }).optional(),
});
const resolvedBucketSchema = z.strictObject({
    public: z.boolean(),
    maxBytes: z.int().positive(),
    contentTypes: z.array(z.string()),
    delivery: z.enum(['signed', 'proxy']),
    appScoped: z.boolean().optional(),
});
export const dbTargetSchema = z.strictObject({
    name: z.string().min(1),
    group: z.string().min(1),
    /** Main only. Compared inside the physical database transaction. */
    adoptionFence: z.uuid().nullable().optional(),
    migrationHash: z.string().nullable().optional(),
});
const activeSchema = z.strictObject({
    realtime: realtimeManifestSchema.optional(),
    status: z.literal('active'),
    versionId: z.uuid(),
    /** `project-registry` 内のスキーマ JSON のキー */
    schemaKey: z.string().min(1),
    schemaVersion: z.string().min(1),
    policyVersion: z.string().min(1),
    db: dbTargetSchema,
    storage: z.strictObject({
        /** R2 の prefix（`projects/{project_id}/{environment}[/{session}]`） */
        namespace: z.string().min(1),
        buckets: z.record(z.string(), resolvedBucketSchema),
        /**
         * Project（この環境の DB）のファイルの合計の上限（バイト）。所有アカウントのプランの
         * `storage.bytes_per_project`。未設定なら null（無制限。tasks/0490）。Gateway の begin が比べる
         */
        quotaBytes: z.int().positive().nullable(),
    }),
    app: z.strictObject({
        kind: z.enum(APP_KINDS),
        access: z.enum(APP_ACCESSES),
        requiredPermission: z.string().regex(PERMISSION_PATTERN).nullable(),
        capabilities: capabilitiesSchema,
        anonymous: z.strictObject({ allowed: z.boolean(), write: z.boolean() }),
        /**
         * CORS で許す Project 専用オリジンのホスト名のラベル（`{slug}-{id}[--main|--b-{s}|--pv-{p}]`。
         * preview.md §1.1）。アプリ用ドメインは Gateway の設定が持つ（DB に焼き込まない）。
         */
        originHost: z.string().regex(ORIGIN_HOST_PATTERN),
        providerOrigin: providerOriginSchema.nullable().optional(),
    }),
    user: z.strictObject({
        bootstrap: z.strictObject({
            eligible: z.boolean(),
            roles: z.array(z.string()),
            legacyRoles: z.array(z.string()),
        }),
        /** 本人（Platform の表示名）。exchange の bootstrap で Project の User の初期値にする */
        displayName: z.string().nullable(),
        /**
         * 本人がブロックした人（Platform の users.id。`user_blocks` は 1 人 1,000 件まで）。Gateway が Project 内の
         * User.id に写して `auth().blockedUserIds` に入れる（compliance.md §4）
         */
        blockedUserIds: z.array(z.uuid()).max(1000),
        /** 本人のこの Project の通知の許可（`GET /v1/notifications/status`。integrations.md §2.2） */
        notifications: notificationStatusSchema.default('default'),
    }),
    /**
     * この版の宣言的トリガー（manifest の `notifications.triggers`。integrations.md §2.4）。Gateway が `/v1/db` の
     * 書き込みの確定後に評価する。宣言が無ければ空
     */
    notificationTriggers: z
        .array(normalizedNotificationTriggerSchema)
        .max(NOTIFICATION_LIMITS.triggers)
        .optional(),
    /** 新しい Project 内 User に付ける Role（manifest の `defaultRoles`。gateway.md §5） */
    defaultRoles: z.array(z.string()),
    /** 同じ版の web の App（exchange の `session.apps`。canOpen は Gateway が Permission で決める） */
    apps: z.array(z.strictObject({
        slug: z.string().regex(APP_SLUG_PATTERN),
        kind: z.enum(APP_KINDS),
        access: z.enum(APP_ACCESSES),
        displayName: localizedNameSchema.nullable(),
        requiredPermission: z.string().regex(PERMISSION_PATTERN).nullable(),
        anonymousAllowed: z.boolean().optional(),
    })),
    revoked: z.boolean(),
    rateLimited: z.boolean(),
});
/**
 * 初回の同意で Host が 1 枚で示すもの（compliance.md §5。`platform.project_consent`）。`version` は共有範囲と
 * 送信先のハッシュで、同意したらこの値を `grant_project_consent` に渡す。
 */
export const projectConsentSchema = z.strictObject({
    version: z.string().regex(/^[0-9a-f]{64}$/),
    /** 共有するもの（本登録は表示名・アバター、匿名は無し） */
    shares: z.array(z.enum(['display_name', 'avatar'])),
    /** 外部への送信先（manifest の network） */
    network: z.strictObject({ egress: z.array(z.string()), browser: z.array(z.string()) }),
    /** 「通知を送ることがあります」 */
    notifications: z.boolean(),
    /**
     * ミニアプリ内 AI を使う版だけ true（入力を OpenRouter と選ばれたモデルの提供元へ送り、利用者の
     * クレジットを消費する。project-ai.md §1）。使わない版には無い（既存の同意を取り直させない）
     */
    ai: z.literal(true).optional(),
    /**
     * python の App（GPU の計算）がある版だけ true（タスクを Platform の Modal で動かし、依頼した利用者の
     * クレジットを消費する。python-backend.md §5）。無い版には無い
     */
    compute: z.literal(true).optional(),
    /** 審査 Agent のデータの扱いの要約（{ ja, en }。審査の前・要約が使えなかった版は null。tasks/0464） */
    privacySummary: localizedNameSchema.nullable(),
});
const consentRequiredSchema = z.strictObject({
    status: z.literal('consent_required'),
    consent: projectConsentSchema,
    revoked: z.boolean(),
    rateLimited: z.boolean(),
});
const inactiveSchema = z.strictObject({
    status: z.enum(RESOLVE_STATUSES.filter((s) => s !== 'active' && s !== 'consent_required')),
    revoked: z.boolean(),
    rateLimited: z.boolean(),
});
export const gatewayResolveResultSchema = z.discriminatedUnion('status', [
    activeSchema,
    consentRequiredSchema,
    inactiveSchema,
]);
/** `active` 以外の status を SDK のエラーにする。`active` は null（通す） */
export function errorCodeForResolveStatus(status) {
    switch (status) {
        case 'active':
            return null;
        case 'not_found':
            return 'NOT_FOUND';
        case 'consent_required':
            return 'CONSENT_REQUIRED';
        case 'forbidden':
        case 'disabled':
            return 'FORBIDDEN';
    }
}
/**
 * `platform.project_origin_resolve(p_host)` の応答（project-runtime.md §3・preview.md §1.1）。
 * project-origin がホスト名のラベルから環境・active な版・web の App の入口を引く（30 秒キャッシュ）。
 * 静的な配信物だけを決める（データは Gateway を通る）。
 */
export const originResolveResultSchema = z.discriminatedUnion('status', [
    z.strictObject({
        status: z.literal('active'),
        projectId: z.uuid(),
        environment: z.enum(['main', 'branch', 'preview', 'prod']),
        branchSessionId: z.uuid().nullable().optional(),
        previewSessionId: z.uuid().nullable().optional(),
        versionId: z.uuid(),
        /** prod 以外は検索に載せない */
        noindex: z.boolean(),
        apps: z.array(z.strictObject({
            slug: z.string().regex(APP_SLUG_PATTERN),
            kind: z.literal('web'),
            /** `dist/` からの相対パス（`web/index.html`） */
            entry: z.string().min(1),
            /** Only public production Apps permit unauthenticated static delivery. */
            deliveryPublic: z.boolean().default(false),
            browserOrigins: z.array(z.string()).optional(),
        })),
    }),
    z.strictObject({ status: z.enum(['not_found', 'disabled']) }),
]);
