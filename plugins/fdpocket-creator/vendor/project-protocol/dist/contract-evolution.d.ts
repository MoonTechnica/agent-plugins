/**
 * 契約の JSON Schema の「追加のみ」の規則（AIP-180。contract-compatibility.md §4.2）。
 *
 * 同じ契約番号の中で、凍結した版（baseline）から今の版へ許す変更だけを通す。
 * JSON Schema は `z.toJSONSchema` が出す範囲（type・properties・required・items・enum・const・anyOf）だけを見る。
 * 数値・文字列の制限は見ない（緩和は許し、強化は別途レビューで見る）。
 *
 * | 向き | 誰が書き、誰が読むか | 許さない変更 |
 * |---|---|---|
 * | `read` | Platform が書き、凍結された側が読む（応答・context・claims） | 項目の削除・必須の解除・型の変更・enum 値の削除 |
 * | `write` | 凍結された側が書き、Platform が読む（リクエスト・hello・op） | 項目の削除・新しい必須項目・型の変更・enum 値の削除 |
 */
export type Direction = 'read' | 'write';
export interface Violation {
    path: string;
    reason: string;
}
export declare function violationsOf(before: unknown, after: unknown, direction: Direction): Violation[];
