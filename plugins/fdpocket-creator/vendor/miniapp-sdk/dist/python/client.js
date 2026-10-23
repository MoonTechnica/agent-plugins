import { PYTHON_RUN_FINAL_STATUSES, pythonRunAcceptedSchema, pythonRunIdSchema, pythonRunRequestSchema, pythonRunSchema, } from '@workspace/project-protocol';
import { SdkError } from "../errors.js";
const WAIT_DEFAULT_MS = 60 * 60 * 1000;
const INTERVAL_DEFAULT_MS = 2000;
export function createPython(transport, sleep = (ms) => new Promise((r) => setTimeout(r, ms))) {
    const read = async (path, method = 'GET') => parse(pythonRunSchema, await transport.send(path, { method }));
    function handle(runId) {
        const get = () => read(`/v1/python/runs/${runId}`);
        return {
            runId,
            get,
            cancel: () => read(`/v1/python/runs/${runId}/cancel`, 'POST'),
            async wait(options = {}) {
                const deadline = Date.now() + (options.timeoutMs ?? WAIT_DEFAULT_MS);
                for (;;) {
                    const run = await get();
                    options.onProgress?.(run);
                    if (PYTHON_RUN_FINAL_STATUSES.includes(run.status))
                        return run;
                    if (Date.now() >= deadline)
                        throw new SdkError('GATEWAY_UNAVAILABLE', `run ${runId} is still ${run.status}`, {
                            retryable: true,
                        });
                    await sleep(options.intervalMs ?? INTERVAL_DEFAULT_MS);
                }
            },
        };
    }
    return {
        async get(runId) {
            if (!pythonRunIdSchema.safeParse(runId).success)
                throw new SdkError('VALIDATION_FAILED', 'invalid python run id');
            return read(`/v1/python/runs/${runId}`);
        },
        async run(app, task, input, options = {}) {
            const body = pythonRunRequestSchema.safeParse({
                app,
                task,
                input,
                ...(options.idempotencyKey === undefined ? {} : { idempotencyKey: options.idempotencyKey }),
            });
            if (!body.success)
                throw new SdkError('VALIDATION_FAILED', 'invalid python run request');
            const accepted = parse(pythonRunAcceptedSchema, await transport.send('/v1/python/runs', { method: 'POST', body: body.data }));
            return handle(accepted.runId);
        },
    };
}
// zod は SDK の依存に無い（生成した Project で解決できない）ので、schema の形だけを受ける
function parse(schema, value) {
    const result = schema.safeParse(value);
    if (!result.success)
        throw new SdkError('GATEWAY_UNAVAILABLE', 'invalid python response', { retryable: true });
    return result.data;
}
