import { z } from 'zod';
export declare const sessionSamplePlanSchema: z.ZodObject<{
    version: z.ZodLiteral<2>;
    rows: z.ZodArray<z.ZodObject<{
        model: z.ZodString;
        key: z.ZodString;
        data: z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodNull]>>;
    }, z.core.$strict>>;
}, z.core.$strict>;
export type SessionSamplePlan = z.infer<typeof sessionSamplePlanSchema>;
export declare const sessionSampleBundleSchema: z.ZodObject<{
    version: z.ZodLiteral<2>;
    schemaJson: z.ZodString;
    identities: z.ZodArray<z.ZodObject<{
        slot: z.ZodString;
        roles: z.ZodArray<z.ZodString>;
        displayName: z.ZodString;
    }, z.core.$strict>>;
    plan: z.ZodNullable<z.ZodObject<{
        version: z.ZodLiteral<2>;
        rows: z.ZodArray<z.ZodObject<{
            model: z.ZodString;
            key: z.ZodString;
            data: z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodNull]>>;
        }, z.core.$strict>>;
    }, z.core.$strict>>;
}, z.core.$strict>;
export type SessionSampleBundle = z.infer<typeof sessionSampleBundleSchema>;
