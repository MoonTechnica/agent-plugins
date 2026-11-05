import { z } from 'zod';
import { SESSION_SEED_BUNDLE_MAX_BYTES, SESSION_SEED_MAX_ROWS, SESSION_SEED_PLAN_MAX_BYTES, SESSION_SEED_SCHEMA_MAX_BYTES, SESSION_SEED_SYSTEM_MODELS, sessionSeedIdentitiesSchema, } from "./session-seed.js";
const sampleModelSchema = z
    .string()
    .regex(/^[A-Za-z][A-Za-z0-9_]*$/)
    .refine((model) => !SESSION_SEED_SYSTEM_MODELS.some((system) => system.toLowerCase() === model.replaceAll('_', '').toLowerCase()), 'system models cannot be sampled');
const sampleValueSchema = z.union([z.string(), z.number().finite(), z.boolean(), z.null()]);
export const sessionSamplePlanSchema = z
    .strictObject({
    version: z.literal(2),
    rows: z
        .array(z.strictObject({
        model: sampleModelSchema,
        key: z.string().min(1).max(256),
        data: z
            .record(z.string().regex(/^[A-Za-z][A-Za-z0-9_]*$/), sampleValueSchema)
            .refine((data) => !Object.keys(data).some((key) => key.toLowerCase() === 'id'), 'sample ID is assigned by the platform'),
    }))
        .max(SESSION_SEED_MAX_ROWS),
})
    .refine((plan) => {
    const keys = plan.rows.map((row) => JSON.stringify([row.model.toLowerCase(), row.key]));
    return new Set(keys).size === keys.length;
}, 'sample keys must be unique within a model')
    .refine((plan) => new TextEncoder().encode(JSON.stringify(plan)).byteLength <= SESSION_SEED_PLAN_MAX_BYTES, 'sample plan is too large');
export const sessionSampleBundleSchema = z
    .strictObject({
    version: z.literal(2),
    schemaJson: z.string().refine((text) => {
        if (new TextEncoder().encode(text).length > SESSION_SEED_SCHEMA_MAX_BYTES)
            return false;
        try {
            const schema = JSON.parse(text);
            return schema !== null && typeof schema === 'object' && !Array.isArray(schema);
        }
        catch {
            return false;
        }
    }, 'invalid sample schema'),
    identities: sessionSeedIdentitiesSchema,
    plan: sessionSamplePlanSchema.nullable(),
})
    .refine((bundle) => new TextEncoder().encode(JSON.stringify(bundle)).length <= SESSION_SEED_BUNDLE_MAX_BYTES, 'sample bundle is too large');
