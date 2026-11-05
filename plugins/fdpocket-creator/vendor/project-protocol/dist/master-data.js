import { z } from 'zod';
import { SESSION_SEED_SYSTEM_MODELS } from "./session-seed.js";
/**
 * マスタデータ（`packages/db-schema/masters.ts` の default export。docs/designs/app-platform/master-data.md）。
 * モデル名 → 行の一覧。行は明示した文字列の `id` とスカラーの値だけ。`kit db migrate` が migration の SQL にする。
 */
export const MASTER_DATA_MAX_ROWS = 1000;
const modelSchema = z
    .string()
    .regex(/^[A-Za-z][A-Za-z0-9_]*$/)
    .refine((model) => !SESSION_SEED_SYSTEM_MODELS.some((system) => system.toLowerCase() === model.toLowerCase()), 'Platform models cannot hold master data');
const rowSchema = z
    .record(z.string().regex(/^[A-Za-z][A-Za-z0-9_]*$/), z.json())
    .refine((row) => typeof row.id === 'string' && row.id.length > 0 && row.id.length <= 256, {
    message: 'each master row needs a string id (1-256 characters)',
});
export const masterDataSchema = z
    .record(modelSchema, z.array(rowSchema))
    .refine((data) => Object.values(data).every((rows) => new Set(rows.map((row) => row.id)).size === rows.length), 'master ids must be unique within a model')
    .refine((data) => Object.values(data).reduce((sum, rows) => sum + rows.length, 0) <= MASTER_DATA_MAX_ROWS, `master data is limited to ${MASTER_DATA_MAX_ROWS} rows`);
