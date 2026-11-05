import { z } from 'zod';
/**
 * マスタデータ（`packages/db-schema/masters.ts` の default export。docs/designs/app-platform/master-data.md）。
 * モデル名 → 行の一覧。行は明示した文字列の `id` とスカラーの値だけ。`kit db migrate` が migration の SQL にする。
 */
export declare const MASTER_DATA_MAX_ROWS = 1000;
export declare const masterDataSchema: z.ZodRecord<z.ZodString, z.ZodArray<z.ZodRecord<z.ZodString, z.ZodJSONSchema>>>;
export type MasterData = z.infer<typeof masterDataSchema>;
