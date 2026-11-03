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
const isObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
const asStrings = (value) => Array.isArray(value) ? value.filter((item) => typeof item === 'string') : [];
export function violationsOf(before, after, direction) {
    const violations = [];
    compare(before, after, direction, '$', violations);
    return violations;
}
function compare(before, after, direction, path, out) {
    if (!isObject(before) || !isObject(after))
        return;
    const branches = before.anyOf ?? before.oneOf;
    if (Array.isArray(branches)) {
        const next = after.anyOf ?? after.oneOf;
        const candidates = Array.isArray(next) ? next : [after];
        branches.forEach((branch, index) => {
            const compatible = candidates.some((candidate) => {
                const inner = [];
                compare(branch, candidate, direction, path, inner);
                return inner.length === 0;
            });
            if (!compatible)
                out.push({ path, reason: `union branch removed: #${index}` });
        });
        return;
    }
    if (before.const !== undefined) {
        if (after.const !== before.const && !asStrings(after.enum).includes(String(before.const)))
            out.push({ path, reason: `const changed: ${String(before.const)}` });
        return;
    }
    if (typeof before.type === 'string' && typeof after.type === 'string') {
        if (before.type !== after.type) {
            out.push({ path, reason: `type changed: ${before.type} -> ${after.type}` });
            return;
        }
    }
    const oldEnum = asStrings(before.enum);
    if (oldEnum.length > 0) {
        const newEnum = asStrings(after.enum);
        // 新しい側に enum が無ければ、値の制限が外れただけ（受ける値は増える）
        if (newEnum.length > 0)
            for (const value of oldEnum)
                if (!newEnum.includes(value))
                    out.push({ path, reason: `enum value removed: ${value}` });
    }
    if (isObject(before.properties)) {
        const oldRequired = new Set(asStrings(before.required));
        const newProperties = isObject(after.properties) ? after.properties : {};
        const newRequired = new Set(asStrings(after.required));
        for (const [name, schema] of Object.entries(before.properties)) {
            const child = `${path}.${name}`;
            if (!(name in newProperties)) {
                out.push({ path: child, reason: 'property removed' });
                continue;
            }
            if (direction === 'read' && oldRequired.has(name) && !newRequired.has(name))
                out.push({ path: child, reason: 'required property became optional' });
            compare(schema, newProperties[name], direction, child, out);
        }
        if (direction === 'write')
            for (const name of newRequired)
                if (!oldRequired.has(name) && !(name in before.properties))
                    out.push({ path: `${path}.${name}`, reason: 'new required property' });
    }
    if (before.items !== undefined)
        compare(before.items, after.items, direction, `${path}[]`, out);
}
