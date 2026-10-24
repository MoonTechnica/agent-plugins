import type { SESSION_SEED_OPERATIONS, SESSION_SEED_SYSTEM_MODELS, SessionSeedContext, SessionSeedIdentity } from '@workspace/project-protocol';
import type { ModelOperations } from '@zenstackhq/orm';
import type { GetModels, SchemaDef } from '@zenstackhq/schema';
/** Pure model initialization data. Kit serializes arguments using the RPC format. */
export type SeedOperation<S extends SchemaDef> = {
    [M in Exclude<GetModels<S>, (typeof SESSION_SEED_SYSTEM_MODELS)[number]>]: {
        [O in Extract<(typeof SESSION_SEED_OPERATIONS)[number], keyof ModelOperations<S, M>>]: {
            model: Uncapitalize<M>;
            operation: O;
            args: ModelOperations<S, M>[O] extends (...args: infer A) => unknown ? A[0] : never;
        };
    }[Extract<(typeof SESSION_SEED_OPERATIONS)[number], keyof ModelOperations<S, M>>];
}[Exclude<GetModels<S>, (typeof SESSION_SEED_SYSTEM_MODELS)[number]>];
export interface SeedPlan<S extends SchemaDef> {
    version: 1;
    operations: readonly SeedOperation<S>[];
}
export type SeedContext = SessionSeedContext;
export type TestIdentity = SessionSeedIdentity;
