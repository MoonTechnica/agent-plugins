import { z } from 'zod';
export const DB_BATCH_MAX = 20;
export const DB_BATCH_DEADLINE_MS = 4_000;
export const DB_BATCH_WRITE_OPERATIONS = [
    'create',
    'createMany',
    'createManyAndReturn',
    'update',
    'updateMany',
    'updateManyAndReturn',
    'upsert',
    'delete',
    'deleteMany',
];
export const dbBatchRequestSchema = z
    .object({
    operations: z
        .array(z
        .object({
        model: z.string().regex(/^[A-Za-z][A-Za-z0-9_]*$/),
        operation: z.enum(DB_BATCH_WRITE_OPERATIONS),
        args: z.record(z.string(), z.unknown()),
    })
        .strict())
        .min(1)
        .max(DB_BATCH_MAX),
})
    .strict();
