import { z } from 'zod';
export const REALTIME_PLATFORM_MODELS = [
    'User',
    'Workspace',
    'Membership',
    'AppUserState',
    'ProjectRole',
    'RolePermission',
    'UserProjectRole',
    'AuditEvent',
    'StorageFile',
    'StorageGrant',
];
export const REALTIME_LIMITS = {
    serverFrameBytes: 256 * 1024,
    connectionStateBytes: 64 * 1024,
    captureBytes: 10 * 1024 * 1024,
    captureRows: 10000,
    roomMessagesPerSecond: 20,
    environmentMessagesPerSecond: 100,
    environmentFanoutPerSecond: 1000,
    environmentBytesPerSecond: 8 * 1024 * 1024,
    channels: 10,
    connections: 200,
    snapshot: 200,
    batch: 100,
    broadcastBytes: 16 * 1024,
    presenceBytes: 1024,
    frameBytes: 20 * 1024,
    ticketMs: 30_000,
    authenticateMs: 5_000,
    heartbeatMs: 25_000,
    timeoutMs: 60_000,
    recoveryMs: 30_000,
    retentionMs: 60 * 60 * 1000,
};
const name = z.string().regex(/^[a-z][A-Za-z0-9_]{0,63}$/);
const field = z.string().regex(/^[A-Za-z][A-Za-z0-9_]{0,63}$/);
const scalar = z.union([z.string().max(1024), z.number().finite(), z.boolean(), z.null()]);
export const realtimeFilterSchema = z
    .strictObject({
    field,
    op: z.enum(['eq', 'neq', 'lt', 'lte', 'gt', 'gte', 'in']),
    value: z.union([scalar, z.array(scalar).min(1).max(20)]),
})
    .refine((v) => (v.op === 'in') === Array.isArray(v.value), {
    message: 'in requires an array; other operators require a scalar',
});
export const realtimeSubscriptionSchema = z.strictObject({
    event: z.enum(['*', 'INSERT', 'UPDATE', 'DELETE']),
    model: name,
    filter: realtimeFilterSchema.optional(),
    select: z.array(field).min(1).max(50).optional(),
});
export const realtimeJoinSchema = z.strictObject({
    channel: name,
    key: z.string().min(1).max(256).optional(),
    broadcast: z
        .strictObject({ ack: z.boolean().optional(), self: z.boolean().optional() })
        .optional(),
    changes: z
        .array(realtimeSubscriptionSchema)
        .max(REALTIME_LIMITS.channels)
        .default([])
        .refine((changes) => new Set(changes.map((change) => change.model)).size === changes.length, {
        message: 'one subscription per model per channel',
    }),
});
const action = z.string().regex(/^(?:read|[a-z]+(?:\.[a-z_]+)+)$/);
export const realtimeChannelSchema = z.strictObject({
    scope: z.literal('app').default('app'),
    model: name,
    key: field,
    events: z
        .array(z.string().regex(/^[a-zA-Z][a-zA-Z0-9_.:-]{0,63}$/))
        .min(1)
        .max(50)
        .optional(),
    actions: z.strictObject({
        broadcastReceive: action,
        broadcastSend: action,
        presenceRead: action,
        presenceTrack: action,
    }),
});
export const realtimeManifestSchema = z.strictObject({
    models: z.array(name).max(50).default([]),
    channels: z.record(name, realtimeChannelSchema).default({}),
});
export const realtimeFrameSchema = z.strictObject({
    version: z.literal(1),
    ref: z.string().min(1).max(64),
    type: z.enum(['authenticate', 'broadcast', 'track', 'untrack', 'heartbeat', 'leave', 'refresh']),
    payload: z.unknown(),
});
