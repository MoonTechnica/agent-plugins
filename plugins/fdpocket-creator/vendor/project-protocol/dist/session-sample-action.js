import { z } from 'zod';
import { SESSION_SEED_SYSTEM_MODELS } from "./session-seed.js";
const model = z
    .string()
    .regex(/^[A-Za-z][A-Za-z0-9_]*$/)
    .refine((value) => !SESSION_SEED_SYSTEM_MODELS.some((system) => system.toLowerCase() === value.replaceAll('_', '').toLowerCase()), 'system models cannot be sampled');
const key = z.string().min(1).max(256);
const value = z.union([z.string(), z.number().finite(), z.boolean(), z.null()]);
/** An owner can inspect conflicts or decide one row; environment and operation are separate authority. */
export const sessionSampleActionSchema = z
    .discriminatedUnion('mode', [
    z.strictObject({ mode: z.literal('refresh') }),
    z.strictObject({
        mode: z.literal('list'),
        limit: z.number().int().min(1).max(50),
        cursor: z.strictObject({ model, key }).optional(),
    }),
    z.strictObject({
        mode: z.literal('resolve'),
        model,
        key,
        choice: z.enum(['keep', 'apply']),
        expectedCurrent: z.record(z.string().regex(/^[A-Za-z][A-Za-z0-9_]*$/), value),
    }),
])
    .refine((input) => new TextEncoder().encode(JSON.stringify(input)).byteLength <= 65_536, 'sample action is too large');
const cursor = z.strictObject({ model, key });
const fields = z.record(z.string().regex(/^[A-Za-z][A-Za-z0-9_]*$/), value);
export const sessionSampleConflictSchema = z.strictObject({
    model,
    key,
    kind: z.enum(['conflict', 'collision', 'dependency']),
    fields: z.array(z.string().regex(/^[A-Za-z][A-Za-z0-9_]*$/)),
    baseline: fields.nullable(),
    current: fields.nullable(),
    desired: fields,
});
export const sessionSampleActionResultSchema = z.discriminatedUnion('kind', [
    z.strictObject({ kind: z.literal('refresh') }),
    z.strictObject({
        kind: z.literal('list'),
        data: z.strictObject({
            items: z.array(sessionSampleConflictSchema).max(50),
            nextCursor: cursor.nullable(),
        }),
    }),
    z.strictObject({ kind: z.literal('resolve'), remaining: z.number().int().min(0).max(1000) }),
]);
