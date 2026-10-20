import { z } from 'zod';
export declare const DB_BATCH_MAX = 20;
export declare const DB_BATCH_DEADLINE_MS = 4000;
export declare const DB_BATCH_WRITE_OPERATIONS: readonly ["create", "createMany", "createManyAndReturn", "update", "updateMany", "updateManyAndReturn", "upsert", "delete", "deleteMany"];
export declare const dbBatchRequestSchema: z.ZodObject<{
    operations: z.ZodArray<z.ZodObject<{
        model: z.ZodString;
        operation: z.ZodEnum<{
            create: "create";
            update: "update";
            delete: "delete";
            createMany: "createMany";
            createManyAndReturn: "createManyAndReturn";
            updateMany: "updateMany";
            updateManyAndReturn: "updateManyAndReturn";
            upsert: "upsert";
            deleteMany: "deleteMany";
        }>;
        args: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    }, z.core.$strict>>;
}, z.core.$strict>;
