import type { DB_BATCH_WRITE_OPERATIONS, ModelOperation } from '@workspace/project-protocol';
import type { ModelOperations, ModelResult } from '@zenstackhq/orm';
import type { GetModels, SchemaDef } from '@zenstackhq/schema';
/** 読み出しの操作（Gateway の `/v1/db` が受けるもの。sdk.md §3.2） */
export declare const DB_READ_OPERATIONS: readonly ["findMany", "findUnique", "findFirst", "count", "aggregate", "groupBy", "exists"];
export declare const DB_CREATE_OPERATIONS: readonly ["create", "createMany", "createManyAndReturn"];
export declare const DB_UPDATE_OPERATIONS: readonly ["update", "updateMany", "updateManyAndReturn"];
export declare const DB_DELETE_OPERATIONS: readonly ["delete", "deleteMany"];
/**
 * SDK が出す操作のすべて。`$queryRaw` / `$executeRaw` / `$transaction` / `*OrThrow` は出さない
 * （任意 SQL を公開しない。Design Doc §2.4）
 */
export declare const DB_OPERATIONS: readonly ["findMany", "findUnique", "findFirst", "count", "aggregate", "groupBy", "exists", "create", "createMany", "createManyAndReturn", "update", "updateMany", "updateManyAndReturn", "delete", "deleteMany", "upsert"];
export type DbOperation = (typeof DB_OPERATIONS)[number];
type Delegate<S extends SchemaDef, M extends GetModels<S>, Ops extends string> = Pick<ModelOperations<S, M>, Extract<Ops, keyof ModelOperations<S, M>>>;
/** Project の全モデル × SDK が出す操作（ZenStack の型をそのまま使う） */
export type DbClient<S extends SchemaDef> = {
    [M in GetModels<S> as Uncapitalize<M>]: Delegate<S, M, DbOperation>;
} & BatchClient<S>;
type BatchWriteOperation = (typeof DB_BATCH_WRITE_OPERATIONS)[number];
export type DbBatchOperation<S extends SchemaDef> = {
    [M in GetModels<S>]: {
        [O in Extract<BatchWriteOperation, keyof ModelOperations<S, M>>]: {
            model: Uncapitalize<M>;
            operation: O;
            args: ModelOperations<S, M>[O] extends (...args: infer A) => unknown ? A[0] : never;
        };
    }[Extract<BatchWriteOperation, keyof ModelOperations<S, M>>];
}[GetModels<S>];
export type DbBatchResults<S extends SchemaDef, T extends readonly unknown[]> = {
    -readonly [K in keyof T]: T[K] extends {
        model: infer M;
        operation: infer O;
        args: infer A;
    } ? M extends string ? Capitalize<M> extends GetModels<S> ? O extends 'createMany' | 'updateMany' | 'deleteMany' ? {
        count: number;
    } : ModelResult<S, Capitalize<M>, A, {}, false, O extends 'createManyAndReturn' | 'updateManyAndReturn' ? true : false> : never : never : never;
};
type BatchClient<S extends SchemaDef> = {
    batch<const T extends readonly DbBatchOperation<S>[]>(operations: T): Promise<DbBatchResults<S, T>>;
};
/** `project.yaml` の `apps[].capabilities.models`（モデルのキー → 操作） */
export type ModelCapabilities<S extends SchemaDef> = {
    [M in GetModels<S> as Uncapitalize<M>]?: readonly ModelOperation[];
};
type OpsFor<C extends readonly ModelOperation[]> = ('read' extends C[number] ? (typeof DB_READ_OPERATIONS)[number] : never) | ('create' extends C[number] ? (typeof DB_CREATE_OPERATIONS)[number] : never) | ('update' extends C[number] ? (typeof DB_UPDATE_OPERATIONS)[number] : never) | ('delete' extends C[number] ? (typeof DB_DELETE_OPERATIONS)[number] : never) | ('create' extends C[number] ? ('update' extends C[number] ? 'upsert' : never) : never);
/**
 * App の capability に合わせて型を狭めた `db`（宣言に無いモデル・操作は型に出ない）。
 * **セキュリティではない**: Gateway が毎回 capability とポリシーで判定する（sdk.md §3.2）
 */
export type AppDbClient<S extends SchemaDef, C extends ModelCapabilities<S>> = {
    [M in GetModels<S> as Uncapitalize<M> extends keyof C ? Uncapitalize<M> : never]: Delegate<S, M, C[Uncapitalize<M> & keyof C] extends readonly ModelOperation[] ? OpsFor<C[Uncapitalize<M> & keyof C]> : never>;
} & {
    batch<const T extends readonly AppBatchOperation<S, C>[]>(operations: T): Promise<DbBatchResults<S, T>>;
};
type AppBatchOperation<S extends SchemaDef, C extends ModelCapabilities<S>> = {
    [M in keyof C]: C[M] extends readonly ModelOperation[] ? Extract<DbBatchOperation<S>, {
        model: M;
        operation: OpsFor<C[M]>;
    }> : never;
}[keyof C];
export {};
