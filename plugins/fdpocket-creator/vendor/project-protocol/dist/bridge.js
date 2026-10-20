import { z } from 'zod';
import { isAppPath } from "./app-path.js";
import { sdkErrorCodeSchema } from "./errors.js";
import { safetyReportTargetSchema } from "./safety.js";
import { appSlugSchema, sessionSchema } from "./token.js";
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
export const nonceSchema = z.string().length(32);
export const initMessageSchema = z.strictObject({
    type: z.literal('init'),
    nonce: nonceSchema,
    launchId: z.uuid(),
});
export const helloMessageSchema = z.strictObject({
    type: z.literal('hello'),
    nonce: nonceSchema,
    protocolVersion: z.int().min(1),
    runtimeVersion: z.int().min(1),
});
export const safeAreaInsetsSchema = z.strictObject({
    top: z.number().min(0),
    right: z.number().min(0),
    bottom: z.number().min(0),
    left: z.number().min(0),
});
export const contextMessageSchema = z.strictObject({
    type: z.literal('context'),
    /** Project アクセストークン（Supabase JWT ではない） */
    token: z.string().min(1),
    expiresAt: z.iso.datetime(),
    session: sessionSchema,
    gatewayUrl: z.url(),
    host: z.literal('superapp'),
    locale: z.enum(['ja', 'en']),
    safeArea: safeAreaInsetsSchema,
});
export const contextUpdateMessageSchema = z.strictObject({
    type: z.literal('context_update'),
    token: z.string().min(1).optional(),
    expiresAt: z.iso.datetime().optional(),
    session: sessionSchema.optional(),
    safeArea: safeAreaInsetsSchema.optional(),
});
/** App 内のパス（同じオリジンの相対パスだけ。外部 URL で別サイトへ飛ばさせない） */
const appPathSchema = z.string().max(2048).refine(isAppPath);
export const BRIDGE_OPS = [
    'ui.openShare',
    'ui.close',
    'ui.navigate',
    'notifications.requestPermission',
    'notifications.status',
    'notifications.openSettings',
    'safety.report',
];
export const bridgeOpNameSchema = z.enum(BRIDGE_OPS);
export const BRIDGE_OP_PAYLOAD_SCHEMAS = {
    'ui.openShare': z.strictObject({ path: appPathSchema, text: z.string().max(280).optional() }),
    'ui.close': z.undefined(),
    'ui.navigate': z.strictObject({ app: appSlugSchema, path: appPathSchema }),
    'notifications.requestPermission': z.strictObject({ reason: z.string().min(1).max(200) }),
    'notifications.status': z.undefined(),
    'notifications.openSettings': z.undefined(),
    'safety.report': z.strictObject({ target: safetyReportTargetSchema }),
};
export const bridgeOpMessageSchema = z
    .strictObject({
    type: z.literal('op'),
    requestId: z.uuid(),
    op: bridgeOpNameSchema,
    payload: z.unknown().optional(),
})
    .superRefine((message, ctx) => {
    if (!BRIDGE_OP_PAYLOAD_SCHEMAS[message.op].safeParse(message.payload).success) {
        ctx.addIssue({
            code: 'custom',
            path: ['payload'],
            message: `invalid payload for ${message.op}`,
        });
    }
});
export const replyMessageSchema = z.discriminatedUnion('ok', [
    z.strictObject({
        type: z.literal('reply'),
        requestId: z.uuid(),
        ok: z.literal(true),
        result: z.unknown().optional(),
    }),
    z.strictObject({
        type: z.literal('reply'),
        requestId: z.uuid(),
        ok: z.literal(false),
        code: sdkErrorCodeSchema,
        retryable: z.boolean(),
    }),
]);
