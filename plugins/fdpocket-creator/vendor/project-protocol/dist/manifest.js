import { z } from 'zod';
import { isAppPath } from "./app-path.js";
import { PROJECT_BUCKETS_MAX, STORAGE_FILE_MAX_BYTES } from "./limits.js";
import { browserOriginIssue, egressDeclarationIssue } from "./network.js";
import { realtimeManifestSchema } from "./realtime.js";
import { validateSchedule } from "./schedules.js";
/**
 * `infra/project.yaml`（project-runtime.md §2）の正本。
 *
 * 取り込み・静的検証・`kit generate` が同じスキーマで検査する。YAML の読み込みは呼び出し側
 * （Kit / validator）が行い、ここは読んだ結果のオブジェクトだけを扱う。cron の UTC 検証は
 * タイマーを起動しない Croner（依存なし）を共有し、Node / Deno 固有 API を持ち込まない。
 * ZModel にモデルが存在するかの突合は validator（tasks/0428）が行う。
 */
export const PROJECT_MANIFEST_VERSION = 1;
/** API 契約の版（sdk.md §9） */
export const PROJECT_SDK_VERSION = 3;
/** App の slug（URL のパス・トークンの `app` claim） */
export const APP_SLUG_PATTERN = /^[a-z][a-z0-9-]{1,31}$/;
/** 論理バケット名（R2 の prefix に入る） */
export const BUCKET_NAME_PATTERN = /^[a-z][a-z0-9-]{1,31}$/;
/** Permission 名（例: `app.access.admin`） */
export const PERMISSION_PATTERN = /^[a-z]+(\.[a-z_]+)+$/;
/** Platform が使う Permission の名前空間。Project は宣言できない */
export const RESERVED_PERMISSION_PREFIX = 'platform.';
const ROLE_NAME_PATTERN = /^[a-z][a-z0-9_-]{0,31}$/;
/** ZModel のモデル名の camelCase（ZenStack の client のプロパティ名と同じ） */
const MODEL_KEY_PATTERN = /^[a-z][A-Za-z0-9]{0,63}$/;
const CONTENT_TYPE_PATTERN = /^[a-z]+\/([a-z0-9.+-]+|\*)$/;
/**
 * App の種類。`web` は静的サイト（admin も `access: restricted` の web）、
 * `api` / `jobs` は Workers for Platforms（P1。README Q5。integrations.md §3.1）。
 */
export const APP_KINDS = ['web', 'api', 'jobs'];
export const SERVER_APP_KINDS = ['api', 'jobs'];
/** サーバーの App のサービストークンに付けられる権限（gateway.md §3.4。`notifications.send` は tasks/0476） */
export const SERVICE_PERMISSIONS = [
    'notifications.send',
    'jobs.schedule',
    'jobs.consume',
    /** 利用者として（`X-Act-As`）ミニアプリ内 AI を呼ぶ。api だけ（jobs には払う利用者がいない。project-ai.md §3.3） */
    'ai.chat',
];
/** secret の名前（`env.<NAME>`）。Worker の binding の名前になる */
export const SECRET_NAME_PATTERN = /^[A-Z][A-Z0-9_]{0,63}$/;
/** Platform が Worker に付ける binding（Project の secret に使えない） */
export const RESERVED_SECRET_NAMES = ['GATEWAY_URL'];
export const RESERVED_SECRET_PREFIX = 'PLATFORM_';
/** 1 App の secret の数 */
export const SECRETS_PER_APP_MAX = 50;
/** 1 App の network の宣言の数（egress / browser それぞれ） */
export const NETWORK_HOSTS_MAX = 50;
export const APP_ACCESSES = ['public', 'restricted'];
export const MODEL_OPERATIONS = ['read', 'create', 'update', 'delete'];
export const BUCKET_OPERATIONS = ['read', 'write', 'delete'];
/**
 * App が宣言できない操作（project-runtime.md §2）。
 * User は bootstrap、StorageFile の作成・更新は Storage API、AuditEvent は Gateway だけが書く。
 */
export const FORBIDDEN_MODEL_OPERATIONS = {
    user: ['create'],
    storageFile: ['create', 'update'],
    auditEvent: ['create', 'update', 'delete'],
};
function uniqueList(item) {
    return z
        .array(item)
        .min(1)
        .refine((list) => new Set(list).size === list.length, { message: 'duplicate entries' });
}
const permissionSchema = z.string().regex(PERMISSION_PATTERN);
/** App の表示名（Platform が返すときは長さを問わない。宣言の検証は appSchema が持つ） */
export const localizedNameSchema = z.strictObject({ ja: z.string(), en: z.string() });
const localizedDescription = z.strictObject({
    ja: z.string().trim().min(1).max(200),
    en: z.string().trim().min(1).max(200),
});
/** 名前と説明だけ（値は作者が画面で入れる。integrations.md §3.2） */
const secretSchema = z.strictObject({
    name: z.string(),
    description: localizedDescription.optional(),
    required: z.boolean().optional(),
});
/**
 * App の宣言。`access` と `capabilities` は web には必須（refine で `required`）、サーバーの App には書けない
 * （api / jobs は利用者の代わりに `asUser` で Gateway を呼び、その利用者の App の capability で判定される）。
 */
const appSchema = z.strictObject({
    kind: z.enum(APP_KINDS),
    access: z.enum(APP_ACCESSES).optional(),
    displayName: z
        .strictObject({ ja: z.string().min(1).max(60), en: z.string().min(1).max(60) })
        .optional(),
    requiredPermission: permissionSchema.optional(),
    capabilities: z
        .strictObject({
        models: z.record(z.string(), uniqueList(z.enum(MODEL_OPERATIONS))).optional(),
        buckets: z.record(z.string(), uniqueList(z.enum(BUCKET_OPERATIONS))).optional(),
        realtime: z
            .record(z.string(), uniqueList(z.enum(['broadcastReceive', 'broadcastSend', 'presenceRead', 'presenceTrack'])))
            .optional(),
        /** ミニアプリ内 AI（project-ai.md §4）。費用は使った利用者本人 */
        ai: z.strictObject({ chat: z.boolean() }).optional(),
    })
        .optional(),
    anonymous: z.strictObject({ allowed: z.boolean(), write: z.boolean() }).optional(),
    /** 外向き通信（integrations.md §3.1・§3.3）。egress はサーバーの App、browser は web */
    network: z
        .strictObject({
        egress: uniqueList(z.string()).max(NETWORK_HOSTS_MAX).optional(),
        browser: uniqueList(z.string()).max(NETWORK_HOSTS_MAX).optional(),
    })
        .optional(),
    secrets: z.array(secretSchema).min(1).max(SECRETS_PER_APP_MAX).optional(),
    servicePermissions: uniqueList(z.enum(SERVICE_PERMISSIONS)).optional(),
    /** API routing is fixed to the Project origin's /api/* namespace. */
    schedules: z
        .array(z.strictObject({
        cron: z.string().refine(validateSchedule, {
            message: 'UTC schedules require at least five minutes between executions',
        }),
        handler: z.string().regex(/^[A-Za-z_$][A-Za-z0-9_$]*$/),
    }))
        .optional(),
    routes: z.array(z.literal('/api/*')).length(1).optional(),
});
const bucketSchema = z
    .strictObject({
    public: z.boolean(),
    maxBytes: z.number().int().positive().max(STORAGE_FILE_MAX_BYTES),
    contentTypes: uniqueList(z.string().regex(CONTENT_TYPE_PATTERN)),
    delivery: z.enum(['signed', 'proxy']).optional(),
    appScoped: z.boolean().optional(),
})
    .refine((bucket) => !bucket.public || (!bucket.appScoped && bucket.delivery !== 'proxy'), {
    message: 'App-scoped or proxy buckets cannot use public delivery',
    path: ['public'],
});
/**
 * 通知のテンプレート（integrations.md §2.3）。文面はテンプレート + パラメータだけで、DB が送信時に描画する
 * （93_project_notifications.sql。上限も同じ値）。
 */
export const NOTIFICATION_LIMITS = {
    title: 60,
    body: 120,
    param: 100,
    path: 256,
    templates: 50,
    triggers: 50,
};
const TEMPLATE_KEY_PATTERN = /^[a-z][a-z0-9_]{0,63}$/;
const PARAM_NAME_PATTERN = /^[A-Za-z][A-Za-z0-9_]{0,31}$/;
const NOTIFICATION_CATEGORY_PATTERN = /^[a-z][a-z0-9_-]{0,31}$/;
const PLACEHOLDER_PATTERN = /\{\{([A-Za-z][A-Za-z0-9_]{0,31})\}\}/g;
/** ミニアプリ内の相対パスだけ（外部 URL・`//`・空白・バックスラッシュ不可） */
export function isNotificationPath(path) {
    return (isAppPath(path) &&
        !path.startsWith('//') &&
        !path.includes('://') &&
        !/[\s\\]/.test(path) &&
        ![...path].some((char) => {
            const code = char.charCodeAt(0);
            return code < 0x20 || code === 0x7f;
        }) &&
        path.length <= NOTIFICATION_LIMITS.path);
}
const localizedText = (max) => z.strictObject({
    ja: z.string().trim().min(1).max(max),
    en: z.string().trim().min(1).max(max),
});
const notificationTemplateSchema = z.strictObject({
    app: z.string().regex(APP_SLUG_PATTERN).optional(),
    category: z.string().regex(NOTIFICATION_CATEGORY_PATTERN).optional(),
    title: localizedText(NOTIFICATION_LIMITS.title),
    body: localizedText(NOTIFICATION_LIMITS.body),
    params: z
        .record(z.string().regex(PARAM_NAME_PATTERN), z.strictObject({ maxLength: z.number().int().min(1).max(NOTIFICATION_LIMITS.param) }))
        .optional(),
    path: z.string().optional(),
});
/**
 * 宣言的トリガー（integrations.md §2.3・§2.4。tasks/0475）。Gateway が `/v1/db` の書き込みの確定後に評価する。
 * 発火するのは単一行の op（create / update / delete）だけ（updateMany 等は宣言できない。2026-10-16 決定 §6）。
 */
export const NOTIFICATION_TRIGGER_OPS = ['create', 'update', 'delete'];
/** 行の列（ZModel のフィールド名） */
const TRIGGER_FIELD_PATTERN = /^[A-Za-z][A-Za-z0-9_]{0,63}$/;
/** パラメータの値の参照（`$row.<列>` / `$actor.id` / `$actor.displayName`）。`$` で始まらなければ固定の文字列 */
export const TRIGGER_VALUE_PATTERN = /^\$(?:row\.[A-Za-z][A-Za-z0-9_]{0,63}|actor\.(?:id|displayName))$/;
const triggerField = z.string().regex(TRIGGER_FIELD_PATTERN);
const notificationTriggerSchema = z.strictObject({
    on: z.strictObject({
        model: z.string().regex(MODEL_KEY_PATTERN),
        op: z.enum(NOTIFICATION_TRIGGER_OPS),
        when: z
            .strictObject({ changed: z.union([triggerField, z.array(triggerField).min(1).max(10)]) })
            .optional(),
    }),
    template: z.string(),
    /** 宛先（Project の User.id が入った列）。relation path は P2 */
    to: z.strictObject({ field: triggerField }),
    params: z.record(z.string().regex(PARAM_NAME_PATTERN), z.string().min(1).max(200)).optional(),
    /** 自分の操作では自分に送らない */
    except: z.literal('actor').optional(),
});
const notificationsSchema = z.strictObject({
    templates: z.record(z.string(), notificationTemplateSchema),
    triggers: z.array(notificationTriggerSchema).max(NOTIFICATION_LIMITS.triggers).optional(),
});
/**
 * ロック画面に出るので、パスワード・金額・個人情報を通知に入れさせない（integrations.md §2.3）。
 * 名前で見当を付けるだけなので警告にとどめる。
 */
const SENSITIVE_NAME_PATTERN = /pass(?:word|code)?|secret|token|api_?key|credential|e?mail|phone|tel(?:ephone)?|address|birth|card|cvv|ssn|amount|price|salary|balance|bank|iban/i;
const placeholdersOf = (text) => [...(text ?? '').matchAll(PLACEHOLDER_PATTERN)].map((m) => m[1]);
/** 指示文（`ai/<key>.md`）・Schema（`ai/schemas/<key>.json`）の名前。DB の CHECK と同じ形 */
export const AI_INSTRUCTIONS_KEY_PATTERN = /^[a-z0-9][a-z0-9_-]{0,31}$/;
export const AI_SCHEMA_KEY_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
export const AI_PROMPTS_PER_KIND_MAX = 8;
export const AI_PROMPT_MAX_BYTES = 8192;
/**
 * 1 ターンの出力の上限（OpenRouter の `max_tokens`。推論するモデルでは推論のトークンも含む）。
 * 既定は推論しても普通の応答が切れない量、上限は許可したモデルの最小の出力上限
 * （2026-10-22 の OpenRouter のモデル一覧で Gemini 3.8 Flash の 65,536。他は 128,000 以上）。
 * 課金は実際に使った分だけで、この値は 1 ターンの最大額を抑える
 */
export const AI_MAX_OUTPUT_TOKENS_DEFAULT = 16_384;
export const AI_MAX_OUTPUT_TOKENS_LIMIT = 65_536;
/** 別名（auto / fast / quality）か、Platform が許可した OpenRouter のモデル ID（許可は DB が確かめる） */
const aiModelSchema = z
    .string()
    .regex(/^(?:[a-z][a-z0-9-]{0,31}|~?[a-z0-9][a-z0-9._-]*\/[A-Za-z0-9][A-Za-z0-9._:-]{0,127})$/);
const aiSchema = z.strictObject({
    model: aiModelSchema.optional(),
    maxOutputTokens: z.number().int().min(1).max(AI_MAX_OUTPUT_TOKENS_LIMIT).optional(),
    instructions: uniqueList(z.string().regex(AI_INSTRUCTIONS_KEY_PATTERN))
        .max(AI_PROMPTS_PER_KIND_MAX)
        .optional(),
    schemas: uniqueList(z.string().regex(AI_SCHEMA_KEY_PATTERN))
        .max(AI_PROMPTS_PER_KIND_MAX)
        .optional(),
});
const baseSchema = z.strictObject({
    version: z.literal(PROJECT_MANIFEST_VERSION),
    sdkVersion: z.literal(PROJECT_SDK_VERSION),
    apps: z.record(z.string(), appSchema),
    buckets: z.record(z.string(), bucketSchema).optional(),
    roles: z.record(z.string(), uniqueList(permissionSchema)).optional(),
    defaultRoles: uniqueList(z.string()).optional(),
    ownerBootstrap: uniqueList(z.string()).optional(),
    notifications: notificationsSchema.optional(),
    realtime: realtimeManifestSchema.optional(),
    ai: aiSchema.optional(),
});
function report(ctx, path, code, message) {
    ctx.addIssue({ code: 'custom', path, message, params: { code } });
}
function checkPermission(ctx, path, permission) {
    if (permission.startsWith(RESERVED_PERMISSION_PREFIX)) {
        report(ctx, path, 'reserved_permission', `"${RESERVED_PERMISSION_PREFIX}*" is reserved`);
    }
}
function refineServerFields(ctx, slug, app) {
    const server = SERVER_APP_KINDS.includes(app.kind);
    const path = ['apps', slug];
    if (app.schedules !== undefined && app.kind !== 'jobs')
        report(ctx, [...path, 'schedules'], 'not_allowed', 'only jobs apps declare schedules');
    if (app.routes !== undefined && app.kind !== 'api') {
        report(ctx, [...path, 'routes'], 'not_allowed', 'only api apps declare routes');
    }
    if (!server) {
        if (app.access === undefined)
            report(ctx, [...path, 'access'], 'required', 'web apps need access');
        if (app.capabilities === undefined) {
            report(ctx, [...path, 'capabilities'], 'required', 'web apps need capabilities');
        }
    }
    else {
        // サーバーの App は利用者の代わりに呼ぶだけ（自分の capability・匿名・restricted を持たない）
        for (const key of ['capabilities', 'anonymous', 'requiredPermission', 'displayName']) {
            if (app[key] !== undefined) {
                report(ctx, [...path, key], 'not_allowed', `${app.kind} apps cannot declare ${key}`);
            }
        }
        if (app.access !== undefined && app.access !== 'public') {
            report(ctx, [...path, 'access'], 'not_allowed', `${app.kind} apps are not restricted`);
        }
    }
    if (app.kind === 'jobs' && app.servicePermissions?.includes('ai.chat')) {
        report(ctx, [...path, 'servicePermissions'], 'not_allowed', 'jobs have no user to pay for ai.chat');
    }
    for (const key of ['secrets', 'servicePermissions']) {
        if (!server && app[key] !== undefined) {
            report(ctx, [...path, key], 'not_allowed', `only api / jobs apps take ${key}`);
        }
    }
    if (!server && app.network?.egress !== undefined) {
        report(ctx, [...path, 'network', 'egress'], 'not_allowed', 'only api / jobs apps take egress');
    }
    if (server && app.network?.browser !== undefined) {
        report(ctx, [...path, 'network', 'browser'], 'not_allowed', 'only web apps take browser');
    }
    for (const [i, host] of (app.network?.egress ?? []).entries()) {
        const issue = egressDeclarationIssue(host);
        if (issue)
            report(ctx, [...path, 'network', 'egress', i], issue, `"${host}" cannot be an egress host`);
    }
    for (const [i, origin] of (app.network?.browser ?? []).entries()) {
        const issue = browserOriginIssue(origin);
        if (issue)
            report(ctx, [...path, 'network', 'browser', i], issue, `"${origin}" cannot be a browser origin`);
    }
    const names = new Set();
    for (const [i, secret] of (app.secrets ?? []).entries()) {
        const at = [...path, 'secrets', i];
        if (!SECRET_NAME_PATTERN.test(secret.name)) {
            report(ctx, at, 'invalid_secret_name', 'secret names are [A-Z][A-Z0-9_]{0,63}');
        }
        else if (RESERVED_SECRET_NAMES.includes(secret.name) ||
            secret.name.startsWith(RESERVED_SECRET_PREFIX)) {
            report(ctx, at, 'reserved_secret_name', `"${secret.name}" is reserved by the platform`);
        }
        if (names.has(secret.name))
            report(ctx, at, 'duplicate', `secret "${secret.name}" is declared twice`);
        names.add(secret.name);
    }
}
function refineManifest(m, ctx) {
    let aiUsed = false;
    if (Object.keys(m.apps).length === 0)
        report(ctx, ['apps'], 'required', 'at least one App is required');
    const buckets = m.buckets ?? {};
    const bucketNames = Object.keys(buckets);
    if (bucketNames.length > PROJECT_BUCKETS_MAX) {
        report(ctx, ['buckets'], 'too_many_buckets', `at most ${PROJECT_BUCKETS_MAX} buckets`);
    }
    for (const name of bucketNames) {
        if (!BUCKET_NAME_PATTERN.test(name)) {
            report(ctx, ['buckets', name], 'invalid_bucket_name', 'bucket names are [a-z][a-z0-9-]{1,31}');
        }
    }
    const roles = m.roles ?? {};
    for (const [role, permissions] of Object.entries(roles)) {
        if (!ROLE_NAME_PATTERN.test(role)) {
            report(ctx, ['roles', role], 'invalid_role_name', 'role names are [a-z][a-z0-9_-]{0,31}');
        }
        for (const [i, p] of permissions.entries())
            checkPermission(ctx, ['roles', role, i], p);
    }
    for (const key of ['defaultRoles', 'ownerBootstrap']) {
        for (const [i, role] of (m[key] ?? []).entries()) {
            if (!(role in roles))
                report(ctx, [key, i], 'unknown_role', `role "${role}" is not declared`);
        }
    }
    const templates = Object.entries(m.notifications?.templates ?? {});
    if (templates.length > NOTIFICATION_LIMITS.templates) {
        report(ctx, ['notifications', 'templates'], 'not_allowed', `at most ${NOTIFICATION_LIMITS.templates} templates`);
    }
    for (const [key, template] of templates) {
        const path = ['notifications', 'templates', key];
        if ((template.path !== undefined && !template.app) ||
            (template.app && m.apps[template.app]?.kind !== 'web')) {
            report(ctx, [...path, 'app'], 'required', 'notification paths must identify a declared web App');
        }
        if (!TEMPLATE_KEY_PATTERN.test(key)) {
            report(ctx, path, 'invalid_template_key', 'template keys are [a-z][a-z0-9_]{0,63}');
        }
        if (template.path !== undefined && !isNotificationPath(template.path)) {
            report(ctx, [...path, 'path'], 'invalid_notification_path', 'path must be relative to the app');
        }
        const declared = new Set(Object.keys(template.params ?? {}));
        const used = [
            template.title.ja,
            template.title.en,
            template.body.ja,
            template.body.en,
            template.path,
        ].flatMap(placeholdersOf);
        if (used.some((name) => !declared.has(name))) {
            report(ctx, path, 'undeclared_notification_param', 'every {{name}} must be declared in params');
        }
    }
    for (const [i, trigger] of (m.notifications?.triggers ?? []).entries()) {
        const path = ['notifications', 'triggers', i];
        const template = m.notifications?.templates[trigger.template];
        if (!template) {
            report(ctx, [...path, 'template'], 'unknown_notification_template', 'no such template');
        }
        else {
            const declared = Object.keys(template.params ?? {}).sort();
            const given = Object.keys(trigger.params ?? {}).sort();
            if (declared.join() !== given.join()) {
                report(ctx, [...path, 'params'], 'notification_params_mismatch', 'params must match the template params');
            }
        }
        if (trigger.on.when && trigger.on.op !== 'update') {
            report(ctx, [...path, 'on', 'when'], 'not_allowed', 'when.changed is only for update');
        }
        for (const [name, value] of Object.entries(trigger.params ?? {})) {
            if (value.startsWith('$') && !TRIGGER_VALUE_PATTERN.test(value)) {
                report(ctx, [...path, 'params', name], 'invalid_trigger_value', 'use $row.<field>, $actor.id, $actor.displayName or a fixed text');
            }
        }
    }
    // Slugs identify Apps; several Apps may use the same execution kind.
    for (const [slug, app] of Object.entries(m.apps).sort(([a], [b]) => byKey(a, b))) {
        if (!APP_SLUG_PATTERN.test(slug)) {
            report(ctx, ['apps', slug], 'invalid_slug', 'app slugs are [a-z][a-z0-9-]{1,31}');
        }
        if (slug === 'api' && app.kind === 'web') {
            report(ctx, ['apps', slug], 'reserved_slug', 'api is reserved for the API namespace; use another web App slug');
        }
        refineServerFields(ctx, slug, app);
        if (usesAi(app))
            aiUsed = true;
        if (app.access === 'restricted' && !app.requiredPermission) {
            report(ctx, ['apps', slug, 'requiredPermission'], 'required', 'restricted apps need requiredPermission');
        }
        if (app.access === 'public' && app.requiredPermission) {
            report(ctx, ['apps', slug, 'requiredPermission'], 'not_allowed', 'only restricted apps take requiredPermission');
        }
        if (app.requiredPermission) {
            checkPermission(ctx, ['apps', slug, 'requiredPermission'], app.requiredPermission);
        }
        if (app.anonymous?.write && !app.anonymous.allowed) {
            report(ctx, ['apps', slug, 'anonymous', 'write'], 'anonymous_write_without_access', 'write needs allowed');
        }
        for (const [model, ops] of Object.entries(app.capabilities?.models ?? {})) {
            const path = ['apps', slug, 'capabilities', 'models', model];
            if (!MODEL_KEY_PATTERN.test(model)) {
                report(ctx, path, 'invalid_model_name', 'model keys are the camelCase model names');
            }
            const forbidden = FORBIDDEN_MODEL_OPERATIONS[model] ?? [];
            if (ops.some((op) => forbidden.includes(op))) {
                report(ctx, path, 'forbidden_operation', `${model} cannot be declared with ${forbidden.join('/')}`);
            }
        }
        for (const bucket of Object.keys(app.capabilities?.buckets ?? {})) {
            if (!(bucket in buckets)) {
                report(ctx, ['apps', slug, 'capabilities', 'buckets', bucket], 'unknown_bucket', `bucket "${bucket}" is not declared`);
            }
        }
    }
    if (m.ai && !aiUsed) {
        report(ctx, ['ai'], 'not_allowed', 'no App uses ai.chat (capabilities.ai.chat or servicePermissions)');
    }
}
function usesAi(app) {
    return app.capabilities?.ai?.chat === true || (app.servicePermissions ?? []).includes('ai.chat');
}
export const projectManifestSchema = baseSchema.superRefine(refineManifest);
export function parseProjectManifest(input) {
    const result = projectManifestSchema.safeParse(input);
    if (!result.success) {
        return {
            success: false,
            errors: result.error.issues.map((issue) => ({
                path: issue.path.map(String).join('.'),
                code: issue.code === 'custom' && typeof issue.params?.code === 'string'
                    ? issue.params.code
                    : issue.code,
                message: issue.message,
            })),
        };
    }
    const warnings = Object.entries(result.data.apps)
        .filter(([, app]) => app.anonymous?.write)
        .map(([slug]) => ({
        path: `apps.${slug}.anonymous.write`,
        code: 'anonymous_write',
        message: 'anonymous users can write through this app',
    }));
    for (const [i, trigger] of (result.data.notifications?.triggers ?? []).entries()) {
        for (const [name, value] of Object.entries(trigger.params ?? {})) {
            const field = value.startsWith('$row.') ? value.slice('$row.'.length) : null;
            if (SENSITIVE_NAME_PATTERN.test(name) || (field && SENSITIVE_NAME_PATTERN.test(field))) {
                warnings.push({
                    path: `notifications.triggers.${i}.params.${name}`,
                    code: 'sensitive_notification_param',
                    message: 'notifications show on the lock screen; do not include passwords, amounts or personal data',
                });
            }
        }
    }
    return { success: true, manifest: result.data, warnings };
}
/** 正規化したトリガー（`project_versions.manifest` に入り、`gateway_resolve` が Gateway へ返す） */
export const normalizedNotificationTriggerSchema = z.strictObject({
    model: z.string().regex(MODEL_KEY_PATTERN),
    op: z.enum(NOTIFICATION_TRIGGER_OPS),
    /** 空なら列の変化を問わない（update でも） */
    changed: z.array(triggerField).max(10),
    template: z.string().regex(TEMPLATE_KEY_PATTERN),
    to: triggerField,
    params: z.record(z.string().regex(PARAM_NAME_PATTERN), z.string().min(1).max(200)),
    exceptActor: z.boolean(),
});
const byKey = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
function sortedRecord(record, map) {
    return Object.fromEntries(Object.keys(record ?? {})
        .sort(byKey)
        .map((key) => [key, map(record[key])]));
}
const sorted = (list) => [...(list ?? [])].sort(byKey);
function entryOf(slug, kind) {
    return kind === 'web' ? `dist/${slug}/index.html` : `dist/${slug}/index.js`;
}
/**
 * 検証済みの manifest を、宣言の順序に依らない形にする（同じ宣言 → 同じ JSON）。
 * `apps` は `project_version_apps` の行（slug 順）。
 */
export function normalizeProjectManifest(manifest) {
    const apps = Object.keys(manifest.apps)
        .sort(byKey)
        .map((slug) => {
        const app = manifest.apps[slug];
        return {
            slug,
            kind: app.kind,
            access: app.access ?? 'public',
            displayName: app.displayName ?? null,
            entry: entryOf(slug, app.kind),
            requiredPermission: app.requiredPermission ?? null,
            capabilities: {
                models: sortedRecord(app.capabilities?.models, sorted),
                buckets: sortedRecord(app.capabilities?.buckets, sorted),
                ...(app.capabilities?.realtime
                    ? { realtime: sortedRecord(app.capabilities.realtime, sorted) }
                    : {}),
                ...(app.capabilities?.ai ? { ai: { chat: app.capabilities.ai.chat } } : {}),
            },
            anonymous: app.anonymous ?? { allowed: false, write: false },
            network: {
                egress: sorted(app.network?.egress),
                browser: sorted(app.network?.browser),
            },
            secrets: [...(app.secrets ?? [])]
                .sort((a, b) => byKey(a.name, b.name))
                .map((secret) => ({
                name: secret.name,
                description: secret.description
                    ? { ja: secret.description.ja, en: secret.description.en }
                    : null,
                required: secret.required ?? false,
            })),
            servicePermissions: sorted(app.servicePermissions),
            ...(app.schedules
                ? {
                    schedules: app.schedules.map((s) => ({
                        cron: s.cron.trim().replace(/\s+/g, ' '),
                        handler: s.handler,
                    })),
                }
                : {}),
        };
    });
    return {
        manifest: {
            version: manifest.version,
            sdkVersion: manifest.sdkVersion,
            apps: Object.fromEntries(apps.map((app) => [app.slug, app])),
            buckets: sortedRecord(manifest.buckets, (b) => ({
                public: b.public,
                maxBytes: b.maxBytes,
                contentTypes: [...b.contentTypes],
                delivery: b.delivery ?? 'signed',
                ...(b.appScoped ? { appScoped: true } : {}),
            })),
            roles: sortedRecord(manifest.roles, sorted),
            defaultRoles: sorted(manifest.defaultRoles),
            ownerBootstrap: sorted(manifest.ownerBootstrap),
            ...(manifest.realtime
                ? {
                    realtime: {
                        models: sorted(manifest.realtime.models),
                        channels: sortedRecord(manifest.realtime.channels, (channel) => ({
                            ...channel,
                            ...(channel.events ? { events: sorted(channel.events) } : {}),
                        })),
                    },
                }
                : {}),
            ...(Object.values(manifest.apps).some(usesAi)
                ? {
                    ai: {
                        ...(manifest.ai?.model ? { model: manifest.ai.model } : {}),
                        maxOutputTokens: manifest.ai?.maxOutputTokens ?? AI_MAX_OUTPUT_TOKENS_DEFAULT,
                        instructions: sorted(manifest.ai?.instructions),
                        schemas: sorted(manifest.ai?.schemas),
                    },
                }
                : {}),
            ...(manifest.notifications
                ? {
                    notifications: {
                        templates: sortedRecord(manifest.notifications.templates, (t) => ({
                            ...(t.app ? { app: t.app } : {}),
                            ...(t.category ? { category: t.category } : {}),
                            title: { ja: t.title.ja, en: t.title.en },
                            body: { ja: t.body.ja, en: t.body.en },
                            params: sortedRecord(t.params, (p) => ({ maxLength: p.maxLength })),
                            ...(t.path !== undefined ? { path: t.path } : {}),
                        })),
                        ...(manifest.notifications.triggers
                            ? { triggers: manifest.notifications.triggers.map(normalizeTrigger) }
                            : {}),
                    },
                }
                : {}),
        },
        apps,
    };
}
function normalizeTrigger(trigger) {
    const changed = trigger.on.when?.changed;
    return {
        model: trigger.on.model,
        op: trigger.on.op,
        changed: [...new Set(typeof changed === 'string' ? [changed] : (changed ?? []))].sort(byKey),
        template: trigger.template,
        to: trigger.to.field,
        params: sortedRecord(trigger.params, (value) => value),
        exceptActor: trigger.except === 'actor',
    };
}
