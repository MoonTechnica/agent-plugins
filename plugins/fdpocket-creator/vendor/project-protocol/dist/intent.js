import { z } from 'zod';
/**
 * `packages/db-schema/pending/intent.yaml`（lifecycle.md §2.3。Agent が破壊的な変更のときだけ書く）。
 * 合流が「意図して消す・名前を変える・型を変える」と読めるように形を決める（profile の spec §6 と同じ）。
 *
 * ```yaml
 * - rename: { table: Task, from: title, to: name }
 * - drop: { table: Task, column: legacy }   # column を省けば表ごと
 * - retype: { table: Task, column: priority, to: Int }
 * - contract: { table: Task, column: title }   # 公開中の版が使う列。次の公開の後に消す予約（2 段の後半）
 * ```
 *
 * `rename` は Platform が表の作り直しの写し（`INSERT INTO "new_X" … SELECT …`）に `from → to` を足して値を移す。
 * `contract` は今回の変更ではなく、公開の完了後に Agent のターンとして起票する予約（`project_followups`。tasks/0469）。
 */
const name = z.string().min(1).max(128);
export const pendingIntentSchema = z
    .array(z.union([
    z.strictObject({ rename: z.strictObject({ table: name, from: name, to: name }) }),
    z.strictObject({ drop: z.strictObject({ table: name, column: name.optional() }) }),
    z.strictObject({ retype: z.strictObject({ table: name, column: name, to: name }) }),
    z.strictObject({ contract: z.strictObject({ table: name, column: name.optional() }) }),
]))
    .min(1);
