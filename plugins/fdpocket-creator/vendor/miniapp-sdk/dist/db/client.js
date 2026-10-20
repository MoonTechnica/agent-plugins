import { DB_TAKE_DEFAULT, DB_TAKE_MAX, dbBatchRequestSchema } from '@workspace/project-protocol';
import { deserialize, makeUrl, serialize } from '@zenstackhq/client-helpers/fetch';
import { SdkError } from "../errors.js";
import { DB_DELETE_OPERATIONS, DB_OPERATIONS, DB_READ_OPERATIONS, DB_UPDATE_OPERATIONS, } from "./types.js";
const READ = new Set(DB_READ_OPERATIONS);
const DELETE = new Set(DB_DELETE_OPERATIONS);
const PUT = new Set(DB_UPDATE_OPERATIONS);
/**
 * `client.db`（sdk.md §3.2）。ZenStack の RPC の形（`@zenstackhq/server` の RPCApiHandler・TanStack Query の
 * フックと同じ: 読み出しと削除は `?q=`、作成は POST、更新は PUT。値は SuperJSON で Date 等を往復）を
 * そのまま Gateway の `/v1/db/{model}/{op}` に送る。モデル・操作の可否は Gateway が判定する。
 */
export function createDbClient(transport, options = {}) {
    const models = new Map();
    return new Proxy({}, {
        get(_target, model) {
            if (model === 'batch')
                return async (operations) => {
                    const encoded = Array.isArray(operations)
                        ? operations.map((input) => ({ ...input, args: marshalled(input.args) }))
                        : operations;
                    const parsed = dbBatchRequestSchema.safeParse({ operations: encoded });
                    if (!parsed.success)
                        throw new SdkError('VALIDATION_FAILED', 'invalid batch');
                    const response = (await transport.send('/v1/db/batch', {
                        method: 'POST',
                        body: parsed.data,
                        headers: options.idempotencyKey
                            ? { 'idempotency-key': options.idempotencyKey }
                            : undefined,
                    }));
                    return response.results.map((result) => deserialize(result.data, result.meta?.serialization));
                };
            // `$queryRaw` 等の $ で始まる名前・then（await の判定）はモデルにしない
            if (typeof model !== 'string' || model.startsWith('$') || model === 'then')
                return undefined;
            let delegate = models.get(model);
            if (!delegate) {
                delegate = Object.fromEntries(DB_OPERATIONS.map((op) => [op, (args) => call(model, op, args)]));
                models.set(model, delegate);
            }
            return delegate;
        },
    });
    async function call(model, op, args) {
        const input = op === 'findMany' ? withTake(args) : args;
        const headers = options.idempotencyKey
            ? { 'idempotency-key': options.idempotencyKey }
            : undefined;
        const inQuery = READ.has(op) || DELETE.has(op);
        const path = makeUrl('/v1/db', model, op, inQuery ? input : undefined);
        const body = inQuery ? undefined : marshalled(input);
        // create* / upsert は POST
        const method = READ.has(op) ? 'GET' : DELETE.has(op) ? 'DELETE' : PUT.has(op) ? 'PUT' : 'POST';
        const response = (await transport.send(path, { method, body, headers }));
        return deserialize(response.data, response.meta?.serialization);
    }
}
/** `take` が無ければ既定（50）、多すぎれば最大（200）に（Gateway も同じくクランプする） */
function withTake(args) {
    const input = (args ?? {});
    const take = typeof input.take === 'number' ? input.take : DB_TAKE_DEFAULT;
    return { ...input, take: Math.sign(take) * Math.min(Math.abs(take), DB_TAKE_MAX) };
}
/** SuperJSON の形（ZenStack の `marshal` と同じ: 本文に `meta.serialization` を添える） */
function marshalled(args) {
    if (args === undefined)
        return undefined;
    const { data, meta } = serialize(args);
    return meta ? { ...data, meta: { serialization: meta } } : data;
}
