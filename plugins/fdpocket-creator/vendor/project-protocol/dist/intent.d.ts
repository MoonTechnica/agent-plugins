import { z } from 'zod';
export declare const pendingIntentSchema: z.ZodArray<z.ZodUnion<readonly [z.ZodObject<{
    rename: z.ZodObject<{
        table: z.ZodString;
        from: z.ZodString;
        to: z.ZodString;
    }, z.core.$strict>;
}, z.core.$strict>, z.ZodObject<{
    drop: z.ZodObject<{
        table: z.ZodString;
        column: z.ZodOptional<z.ZodString>;
    }, z.core.$strict>;
}, z.core.$strict>, z.ZodObject<{
    retype: z.ZodObject<{
        table: z.ZodString;
        column: z.ZodString;
        to: z.ZodString;
    }, z.core.$strict>;
}, z.core.$strict>, z.ZodObject<{
    contract: z.ZodObject<{
        table: z.ZodString;
        column: z.ZodOptional<z.ZodString>;
    }, z.core.$strict>;
}, z.core.$strict>]>>;
export type PendingIntent = z.infer<typeof pendingIntentSchema>;
export type PendingIntentItem = PendingIntent[number];
