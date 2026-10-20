/** 読み出しの操作（Gateway の `/v1/db` が受けるもの。sdk.md §3.2） */
export const DB_READ_OPERATIONS = [
    'findMany',
    'findUnique',
    'findFirst',
    'count',
    'aggregate',
    'groupBy',
    'exists',
];
export const DB_CREATE_OPERATIONS = ['create', 'createMany', 'createManyAndReturn'];
export const DB_UPDATE_OPERATIONS = ['update', 'updateMany', 'updateManyAndReturn'];
export const DB_DELETE_OPERATIONS = ['delete', 'deleteMany'];
/**
 * SDK が出す操作のすべて。`$queryRaw` / `$executeRaw` / `$transaction` / `*OrThrow` は出さない
 * （任意 SQL を公開しない。Design Doc §2.4）
 */
export const DB_OPERATIONS = [
    ...DB_READ_OPERATIONS,
    ...DB_CREATE_OPERATIONS,
    ...DB_UPDATE_OPERATIONS,
    ...DB_DELETE_OPERATIONS,
    'upsert',
];
