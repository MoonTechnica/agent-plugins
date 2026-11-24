import { z } from 'zod';
export declare const SESSION_SEED_MAX_OPERATIONS = 100;
export declare const SESSION_SEED_MAX_ROWS = 1000;
export declare const SESSION_SEED_PLAN_MAX_BYTES: number;
export declare const SESSION_SEED_SCHEMA_MAX_BYTES: number;
export declare const SESSION_SEED_BUNDLE_MAX_BYTES: number;
export declare const SESSION_SEED_DEADLINE_MS = 15000;
export declare const SESSION_SEED_OPERATIONS: readonly ["create", "createMany", "upsert"];
export declare const SESSION_SEED_SYSTEM_MODELS: readonly ["User", "ProjectRole", "RolePermission", "UserProjectRole", "AuditEvent", "StorageFile", "StorageGrant"];
export declare const sessionSeedContextSchema: z.ZodObject<{
    version: z.ZodLiteral<1>;
    environmentId: z.ZodUUID;
    resourceGeneration: z.ZodUUID;
    initializationId: z.ZodUUID;
    source: z.ZodDiscriminatedUnion<[z.ZodObject<{
        kind: z.ZodLiteral<"commit">;
        oid: z.ZodString;
    }, z.core.$strict>, z.ZodObject<{
        kind: z.ZodLiteral<"snapshot">;
        sha256: z.ZodString;
    }, z.core.$strict>], "kind">;
    initializedAt: z.ZodISODateTime;
}, z.core.$strict>;
export type SessionSeedContextData = z.infer<typeof sessionSeedContextSchema>;
/** Compare the typed provenance as values, including after JSON persistence. */
export declare function sessionSeedContextMatches(expected: SessionSeedContextData, value: unknown): boolean;
export declare const sessionSeedIdentitySchema: z.ZodObject<{
    slot: z.ZodString;
    roles: z.ZodArray<z.ZodString>;
    displayName: z.ZodString;
}, z.core.$strict>;
export type SessionSeedIdentity = z.infer<typeof sessionSeedIdentitySchema>;
export declare const sessionSeedIdentitiesSchema: z.ZodArray<z.ZodObject<{
    slot: z.ZodString;
    roles: z.ZodArray<z.ZodString>;
    displayName: z.ZodString;
}, z.core.$strict>>;
export declare const sessionSeedPlanSchema: z.ZodObject<{
    version: z.ZodLiteral<1>;
    operations: z.ZodArray<z.ZodObject<{
        model: z.ZodString;
        operation: z.ZodEnum<{
            create: "create";
            createMany: "createMany";
            upsert: "upsert";
        }>;
        args: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    }, z.core.$strict>>;
}, z.core.$strict>;
export type SessionSeedPlan = z.infer<typeof sessionSeedPlanSchema>;
export declare const sessionAiPromptsSchema: z.ZodArray<z.ZodObject<{
    kind: z.ZodEnum<{
        instructions: "instructions";
        schema: "schema";
    }>;
    key: z.ZodString;
    content: z.ZodString;
    sha256: z.ZodString;
}, z.core.$strict>>;
export declare const sessionSeedBundleSchema: z.ZodObject<{
    version: z.ZodLiteral<1>;
    schemaJson: z.ZodString;
    aiPrompts: z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodObject<{
        kind: z.ZodEnum<{
            instructions: "instructions";
            schema: "schema";
        }>;
        key: z.ZodString;
        content: z.ZodString;
        sha256: z.ZodString;
    }, z.core.$strict>>>>;
    identities: z.ZodArray<z.ZodObject<{
        slot: z.ZodString;
        roles: z.ZodArray<z.ZodString>;
        displayName: z.ZodString;
    }, z.core.$strict>>;
    plan: z.ZodObject<{
        version: z.ZodLiteral<1>;
        operations: z.ZodArray<z.ZodObject<{
            model: z.ZodString;
            operation: z.ZodEnum<{
                create: "create";
                createMany: "createMany";
                upsert: "upsert";
            }>;
            args: z.ZodRecord<z.ZodString, z.ZodUnknown>;
        }, z.core.$strict>>;
    }, z.core.$strict>;
}, z.core.$strict>;
export type SessionSeedBundle = z.infer<typeof sessionSeedBundleSchema>;
export interface SessionSeedUser {
    id: string;
    globalUserId: string;
    displayName: string;
}
export interface SessionSeedContext extends SessionSeedContextData {
    id(label: string): Promise<string>;
    users: Readonly<Record<string, SessionSeedUser>>;
}
export declare function sessionSeedUserId(environmentId: string, slot: string): Promise<string>;
export declare function sessionSeedDataId(initializationId: string, label: string): Promise<string>;
export declare function createSessionSeedContext(input: SessionSeedContextData, identities: readonly SessionSeedIdentity[]): Promise<SessionSeedContext>;
