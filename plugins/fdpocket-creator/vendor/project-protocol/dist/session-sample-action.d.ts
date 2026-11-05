import { z } from 'zod';
/** An owner can inspect conflicts or decide one row; environment and operation are separate authority. */
export declare const sessionSampleActionSchema: z.ZodDiscriminatedUnion<[z.ZodObject<{
    mode: z.ZodLiteral<"refresh">;
}, z.core.$strict>, z.ZodObject<{
    mode: z.ZodLiteral<"list">;
    limit: z.ZodNumber;
    cursor: z.ZodOptional<z.ZodObject<{
        model: z.ZodString;
        key: z.ZodString;
    }, z.core.$strict>>;
}, z.core.$strict>, z.ZodObject<{
    mode: z.ZodLiteral<"resolve">;
    model: z.ZodString;
    key: z.ZodString;
    choice: z.ZodEnum<{
        keep: "keep";
        apply: "apply";
    }>;
    expectedCurrent: z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodNull]>>;
}, z.core.$strict>], "mode">;
export type SessionSampleAction = z.infer<typeof sessionSampleActionSchema>;
export declare const sessionSampleConflictSchema: z.ZodObject<{
    model: z.ZodString;
    key: z.ZodString;
    kind: z.ZodEnum<{
        conflict: "conflict";
        collision: "collision";
        dependency: "dependency";
    }>;
    fields: z.ZodArray<z.ZodString>;
    baseline: z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodNull]>>>;
    current: z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodNull]>>>;
    desired: z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodNull]>>;
}, z.core.$strict>;
export declare const sessionSampleActionResultSchema: z.ZodDiscriminatedUnion<[z.ZodObject<{
    kind: z.ZodLiteral<"refresh">;
}, z.core.$strict>, z.ZodObject<{
    kind: z.ZodLiteral<"list">;
    data: z.ZodObject<{
        items: z.ZodArray<z.ZodObject<{
            model: z.ZodString;
            key: z.ZodString;
            kind: z.ZodEnum<{
                conflict: "conflict";
                collision: "collision";
                dependency: "dependency";
            }>;
            fields: z.ZodArray<z.ZodString>;
            baseline: z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodNull]>>>;
            current: z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodNull]>>>;
            desired: z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodNull]>>;
        }, z.core.$strict>>;
        nextCursor: z.ZodNullable<z.ZodObject<{
            model: z.ZodString;
            key: z.ZodString;
        }, z.core.$strict>>;
    }, z.core.$strict>;
}, z.core.$strict>, z.ZodObject<{
    kind: z.ZodLiteral<"resolve">;
    remaining: z.ZodNumber;
}, z.core.$strict>], "kind">;
export type SessionSampleConflict = z.infer<typeof sessionSampleConflictSchema>;
export type SessionSampleActionResult = z.infer<typeof sessionSampleActionResultSchema>;
