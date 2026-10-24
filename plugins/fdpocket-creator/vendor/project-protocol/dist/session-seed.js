import { z } from 'zod';
import { AI_INSTRUCTIONS_KEY_PATTERN, AI_PROMPT_MAX_BYTES, AI_PROMPTS_PER_KIND_MAX, AI_SCHEMA_KEY_PATTERN, } from "./manifest.js";
import { testIdentitySlotSchema } from "./token.js";
export const SESSION_SEED_MAX_OPERATIONS = 100;
export const SESSION_SEED_MAX_ROWS = 1000;
export const SESSION_SEED_PLAN_MAX_BYTES = 1024 * 1024;
export const SESSION_SEED_SCHEMA_MAX_BYTES = 2 * 1024 * 1024;
export const SESSION_SEED_BUNDLE_MAX_BYTES = 4 * 1024 * 1024;
export const SESSION_SEED_DEADLINE_MS = 15_000;
export const SESSION_SEED_OPERATIONS = ['create', 'createMany', 'upsert'];
export const SESSION_SEED_SYSTEM_MODELS = [
    'User',
    'ProjectRole',
    'RolePermission',
    'UserProjectRole',
    'AuditEvent',
    'StorageFile',
    'StorageGrant',
];
const bytes = (value) => new TextEncoder().encode(value).byteLength;
export const sessionSeedContextSchema = z
    .object({
    version: z.literal(1),
    environmentId: z.uuid(),
    resourceGeneration: z.uuid(),
    initializationId: z.uuid(),
    source: z.discriminatedUnion('kind', [
        z.strictObject({ kind: z.literal('commit'), oid: z.string().regex(/^[a-f0-9]{40}$/) }),
        z.strictObject({ kind: z.literal('snapshot'), sha256: z.string().regex(/^[a-f0-9]{64}$/) }),
    ]),
    initializedAt: z.iso.datetime(),
})
    .strict()
    .refine((value) => value.environmentId === value.resourceGeneration, 'session generation must match environment');
/** Compare the typed provenance as values, including after JSON persistence. */
export function sessionSeedContextMatches(expected, value) {
    if (!value || typeof value !== 'object')
        return false;
    const pick = (record) => Object.fromEntries(Object.keys(sessionSeedContextSchema.shape).map((key) => [
        key,
        record[key],
    ]));
    const actual = sessionSeedContextSchema.safeParse(pick(value));
    return (actual.success &&
        JSON.stringify(actual.data) === JSON.stringify(sessionSeedContextSchema.parse(pick(expected))));
}
export const sessionSeedIdentitySchema = z
    .object({
    slot: testIdentitySlotSchema.refine((slot) => !['admin', 'member', 'anonymous'].includes(slot), 'built-in slot is reserved'),
    roles: z
        .array(z.string().min(1).max(100))
        .max(32)
        .refine((roles) => new Set(roles).size === roles.length, 'roles must be unique'),
    displayName: z.string().min(1).max(100),
})
    .strict();
export const sessionSeedIdentitiesSchema = z
    .array(sessionSeedIdentitySchema)
    .max(32)
    .refine((identities) => new Set(identities.map((identity) => identity.slot)).size === identities.length, 'identity slots must be unique');
export const sessionSeedPlanSchema = z
    .object({
    version: z.literal(1),
    operations: z
        .array(z
        .object({
        model: z
            .string()
            .regex(/^[A-Za-z][A-Za-z0-9_]*$/)
            .refine((model) => !SESSION_SEED_SYSTEM_MODELS.some((system) => system.toLowerCase() === model.replaceAll('_', '').toLowerCase()), 'system models cannot be seeded directly'),
        operation: z.enum(SESSION_SEED_OPERATIONS),
        args: z.record(z.string(), z.unknown()),
    })
        .strict())
        .max(SESSION_SEED_MAX_OPERATIONS),
})
    .strict()
    .refine((plan) => bytes(JSON.stringify(plan)) <= SESSION_SEED_PLAN_MAX_BYTES, 'seed plan is too large')
    .refine((plan) => plan.operations.reduce((rows, operation) => rows +
    (operation.operation === 'createMany' && Array.isArray(operation.args.data)
        ? operation.args.data.length
        : 1), 0) <= SESSION_SEED_MAX_ROWS, 'seed row limit exceeded');
export const sessionAiPromptsSchema = z
    .array(z
    .object({
    kind: z.enum(['instructions', 'schema']),
    key: z.string(),
    content: z.string().refine((text) => bytes(text) <= AI_PROMPT_MAX_BYTES),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
})
    .strict()
    .refine((prompt) => (prompt.kind === 'instructions' ? AI_INSTRUCTIONS_KEY_PATTERN : AI_SCHEMA_KEY_PATTERN).test(prompt.key)))
    .max(AI_PROMPTS_PER_KIND_MAX * 2)
    .refine((prompts) => new Set(prompts.map((prompt) => `${prompt.kind}:${prompt.key}`)).size === prompts.length, 'prompt keys must be unique');
export const sessionSeedBundleSchema = z
    .object({
    version: z.literal(1),
    schemaJson: z.string().refine((text) => {
        if (bytes(text) > SESSION_SEED_SCHEMA_MAX_BYTES)
            return false;
        try {
            const value = JSON.parse(text);
            return typeof value === 'object' && value !== null && !Array.isArray(value);
        }
        catch {
            return false;
        }
    }, 'invalid seed schema'),
    aiPrompts: sessionAiPromptsSchema.optional().default([]),
    identities: sessionSeedIdentitiesSchema,
    plan: sessionSeedPlanSchema,
})
    .strict()
    .refine((bundle) => bytes(JSON.stringify(bundle)) <= SESSION_SEED_BUNDLE_MAX_BYTES, 'seed bundle is too large');
async function stableId(domain, namespace, label) {
    if (typeof label !== 'string' || !label || label.length > 256)
        throw new Error('seed ID label must contain 1 to 256 characters');
    const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify([domain, namespace, label]))));
    // RFC 9562 UUID version 8: deterministic application-defined SHA-256 payload.
    hash[6] = ((hash[6] ?? 0) & 0x0f) | 0x80;
    hash[8] = ((hash[8] ?? 0) & 0x3f) | 0x80;
    const hex = Array.from(hash.subarray(0, 16), (part) => part.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
export async function sessionSeedUserId(environmentId, slot) {
    z.uuid().parse(environmentId);
    testIdentitySlotSchema.parse(slot);
    return stableId('session-seed-user-v1', environmentId, slot);
}
export async function sessionSeedDataId(initializationId, label) {
    z.uuid().parse(initializationId);
    return stableId('session-seed-data-v1', initializationId, label);
}
export async function createSessionSeedContext(input, identities) {
    const data = sessionSeedContextSchema.parse(input);
    const extra = sessionSeedIdentitiesSchema.parse(identities);
    const users = {};
    for (const identity of [
        { slot: 'admin', displayName: 'Admin' },
        { slot: 'member', displayName: 'Member' },
        { slot: 'anonymous', displayName: 'Anonymous' },
        ...extra,
    ]) {
        users[identity.slot] = Object.freeze({
            id: await sessionSeedUserId(data.environmentId, identity.slot),
            globalUserId: `test:${data.environmentId}:${identity.slot}`,
            displayName: identity.displayName,
        });
    }
    return Object.freeze({
        ...data,
        users: Object.freeze(users),
        id: (label) => sessionSeedDataId(data.initializationId, label),
    });
}
