import { z } from 'zod';
import { testIdentitySlotSchema, tokenExchangeResponseSchema } from "./token.js";
export const LIVE_HOST_BRIDGE_VERSION = 1;
export const liveHostNonceSchema = z.string().regex(/^[a-f0-9]{32}$/);
export const liveHostInitSchema = z
    .object({
    type: z.literal('kit-session-init'),
    version: z.literal(1),
    nonce: liveHostNonceSchema,
    environmentId: z.uuid(),
    controls: z.literal('studio'),
    selectedIdentity: testIdentitySlotSchema.nullable(),
    identities: z
        .array(z.object({ slot: testIdentitySlotSchema, displayName: z.string().min(1).max(100) }).strict())
        .max(35),
})
    .strict()
    .refine((data) => data.selectedIdentity === null ||
    data.identities.some((identity) => identity.slot === data.selectedIdentity), { message: 'Selected identity must be declared by Studio' });
export const liveHostExchangeRequestSchema = z
    .object({
    type: z.literal('kit-session-request'),
    version: z.literal(1),
    nonce: liveHostNonceSchema,
    requestId: z.uuid(),
    environmentId: z.uuid(),
    app: z.string().regex(/^[a-z][a-z0-9-]{1,31}$/),
    testIdentity: testIdentitySlotSchema.nullable(),
})
    .strict();
export const liveHostExchangeReplySchema = z.discriminatedUnion('ok', [
    z
        .object({
        type: z.literal('kit-session-reply'),
        version: z.literal(1),
        nonce: liveHostNonceSchema,
        requestId: z.uuid(),
        environmentId: z.uuid(),
        app: z.string(),
        testIdentity: testIdentitySlotSchema.nullable(),
        ok: z.literal(true),
        session: tokenExchangeResponseSchema,
    })
        .strict(),
    z
        .object({
        type: z.literal('kit-session-reply'),
        version: z.literal(1),
        nonce: liveHostNonceSchema,
        requestId: z.uuid(),
        environmentId: z.uuid(),
        app: z.string(),
        testIdentity: testIdentitySlotSchema.nullable(),
        ok: z.literal(false),
        code: z.enum(['forbidden', 'signed_out', 'consent_required', 'unavailable']),
    })
        .strict(),
]);
export const liveJobRunsSchema = z
    .array(z
    .object({
    id: z.uuid(),
    app: z.string().max(32),
    handler: z.string().max(128),
    status: z.string().max(64),
    attempts: z.int().nonnegative(),
    lastError: z.string().max(1024).nullable(),
    createdAt: z.string().max(64),
})
    .strict())
    .max(20);
export const liveSessionInspectionSchema = z
    .object({
    jobRuns: liveJobRunsSchema.optional(),
    events: z
        .array(z
        .object({
        id: z.uuid(),
        kind: z.string().max(128),
        payload: z.unknown(),
        createdAt: z.string().max(64),
    })
        .strict())
        .max(20),
    jobs: z
        .array(z
        .object({
        app: z.string().regex(/^[a-z][a-z0-9-]{1,31}$/),
        handler: z.string().regex(/^[A-Za-z_$][A-Za-z0-9_$]*$/),
        cron: z.string().max(128),
    })
        .strict())
        .max(512),
})
    .strict();
const managementScope = {
    type: z.literal('kit-session-manage'),
    version: z.literal(1),
    nonce: liveHostNonceSchema,
    requestId: z.uuid(),
    environmentId: z.uuid(),
};
export const liveHostManagementRequestSchema = z.discriminatedUnion('operation', [
    z.object({ ...managementScope, operation: z.literal('inspect') }).strict(),
    z
        .object({
        ...managementScope,
        operation: z.literal('run_job'),
        app: z.string().regex(/^[a-z][a-z0-9-]{1,31}$/),
        handler: z.string().regex(/^[A-Za-z_$][A-Za-z0-9_$]*$/),
        testIdentity: testIdentitySlotSchema.nullable(),
    })
        .strict(),
]);
export const liveHostManagementReplySchema = z
    .object({
    type: z.literal('kit-session-managed'),
    version: z.literal(1),
    nonce: liveHostNonceSchema,
    requestId: z.uuid(),
    environmentId: z.uuid(),
    result: z.discriminatedUnion('operation', [
        z.object({ operation: z.literal('inspect'), view: liveSessionInspectionSchema }).strict(),
        z
            .object({ operation: z.literal('run_job'), id: z.uuid(), status: z.string().max(64) })
            .strict(),
        z
            .object({ operation: z.literal('error'), code: z.enum(['forbidden', 'unavailable']) })
            .strict(),
    ]),
})
    .strict();
export const liveHostUpdateSchema = z
    .object({
    type: z.literal('kit-session-updated'),
    version: z.literal(1),
    nonce: liveHostNonceSchema,
    environmentId: z.uuid(),
    status: z.enum(['active', 'degraded']),
    view: liveSessionInspectionSchema.optional(),
})
    .strict();
export const liveHostWaitingSchema = z
    .object({
    type: z.literal('kit-session-waiting'),
    version: z.literal(1),
    nonce: liveHostNonceSchema,
    requestId: z.uuid(),
    environmentId: z.uuid(),
    app: z.string(),
    testIdentity: testIdentitySlotSchema.nullable(),
})
    .strict();
