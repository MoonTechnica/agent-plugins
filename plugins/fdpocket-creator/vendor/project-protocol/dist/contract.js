import { z } from 'zod';
const WIRE = {
    mode: 'wire',
    object: (shape) => z.object(shape),
    // 型は閉じた enum のまま。読む側の型は Contract.wire が Open<> で開く
    enum: (_values) => z.string(),
    invariant: (schema) => schema,
};
const EXACT = {
    mode: 'exact',
    object: (shape) => z.strictObject(shape),
    enum: (values) => z.enum(values),
    invariant: (schema, check) => schema.superRefine(check),
};
/** 契約を 1 回定義して、読む形と書く形の両方を得る */
export function contract(build) {
    const wire = build(WIRE);
    const exact = build(EXACT);
    return {
        wire,
        exact,
        in: (shape) => (shape.mode === 'wire' ? wire : exact),
    };
}
