import { z } from 'zod';
import { isAppPath } from "./app-path.js";
import { connectionServiceSchema } from "./connections.js";
import { contract } from "./contract.js";
import { sdkErrorCode } from "./errors.js";
import { safetyReportTargetSchema } from "./safety.js";
import { appSlugSchema, session } from "./token.js";
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
export const nonceSchema = z.string().length(32);
export const initMessage = contract((o) => o.object({
    type: z.literal('init'),
    nonce: nonceSchema,
    launchId: z.uuid(),
}));
export const helloMessage = contract((o) => o.object({
    type: z.literal('hello'),
    nonce: nonceSchema,
    /** App が焼き込んだ契約番号。Host は対応する窓（SUPPORTED_CONTRACTS）と照合する */
    contract: z.int().min(1),
}));
export const safeAreaInsets = contract((o) => o.object({
    top: z.number().min(0),
    right: z.number().min(0),
    bottom: z.number().min(0),
    left: z.number().min(0),
}));
export const LOCALES = ['ja', 'en'];
/** Host が App に渡す起動の中身（`context` から `type` / `host` を除いたもの。ネイティブの Host も同じ形を運ぶ） */
export const hostContext = contract((o) => o.object({
    /** Project アクセストークン（Supabase JWT ではない） */
    token: z.string().min(1),
    expiresAt: z.iso.datetime(),
    session: session.in(o),
    gatewayUrl: z.url(),
    locale: o.enum(LOCALES),
    safeArea: safeAreaInsets.in(o),
}));
export const contextMessage = contract((o) => o.object({
    type: z.literal('context'),
    host: o.enum(['superapp']),
    ...hostContext.in(o).shape,
}));
export const contextUpdateMessage = contract((o) => o.object({
    type: z.literal('context_update'),
    token: z.string().min(1).optional(),
    expiresAt: z.iso.datetime().optional(),
    session: session.in(o).optional(),
    safeArea: safeAreaInsets.in(o).optional(),
}));
/** App 内のパス（同じオリジンの相対パスだけ。外部 URL で別サイトへ飛ばさせない） */
const appPathSchema = z.string().max(2048).refine(isAppPath);
export const BRIDGE_OPS = [
    'ui.openShare',
    'ui.close',
    'ui.navigate',
    'ui.openCredits',
    'connections.requestPermission',
    'notifications.requestPermission',
    'notifications.status',
    'notifications.openSettings',
    'safety.report',
];
export const bridgeOpName = contract((o) => o.enum(BRIDGE_OPS));
const none = contract(() => z.undefined());
/** op ごとの payload。App は送る前に `exact` で確かめ、Host は `wire` で読む */
export const BRIDGE_OP_PAYLOADS = {
    'ui.openShare': contract((o) => o.object({ path: appPathSchema, text: z.string().max(280).optional() })),
    'ui.close': none,
    'ui.navigate': contract((o) => o.object({ app: appSlugSchema, path: appPathSchema })),
    'ui.openCredits': none,
    'connections.requestPermission': contract((o) => o.object({ provider: connectionServiceSchema })),
    'notifications.requestPermission': contract((o) => o.object({ reason: z.string().min(1).max(200) })),
    'notifications.status': none,
    'notifications.openSettings': none,
    'safety.report': contract((o) => o.object({ target: safetyReportTargetSchema })),
};
/**
 * App → Host の op。`op` は Host が知っているものだけ（知らない op は答えられないので `wire` でも閉じる）。
 * payload はその op の契約で検査する
 */
export const bridgeOpMessage = contract((o) => o
    .object({
    type: z.literal('op'),
    requestId: z.uuid(),
    op: z.enum(BRIDGE_OPS),
    payload: z.unknown().optional(),
})
    .superRefine((message, ctx) => {
    if (!BRIDGE_OP_PAYLOADS[message.op].in(o).safeParse(message.payload).success) {
        ctx.addIssue({
            code: 'custom',
            path: ['payload'],
            message: `invalid payload for ${message.op}`,
        });
    }
}));
export const replyMessage = contract((o) => z.discriminatedUnion('ok', [
    o.object({
        type: z.literal('reply'),
        requestId: z.uuid(),
        ok: z.literal(true),
        result: z.unknown().optional(),
    }),
    o.object({
        type: z.literal('reply'),
        requestId: z.uuid(),
        ok: z.literal(false),
        code: sdkErrorCode.in(o),
        retryable: z.boolean(),
    }),
]));
