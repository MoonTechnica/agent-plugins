import { z } from 'zod';
/**
 * `kind: python` の App（python-backend.md §3）。GPU の AI 処理を Platform の Modal の Sandbox で動かす。
 * 値の範囲は Modal の上限（Sandbox の timeout は最大 24 時間・GPU は 1 container に 8 枚まで。A10 は 4 枚）と、
 * 課金額を決められること（GPU の fallback のリストを受けない）で決めた。
 */
export const PYTHON_VERSIONS = ['3.11', '3.12', '3.13'];
/**
 * 使える GPU の型（Modal の型の文字列）。単価表（`ai_price_list` の `provider = 'modal'`）にある型だけ。
 * 40 GB / 80 GB のどちらになるか決まらない `A100`、上位の型へ切り替わりうる `B200+` は課金額が決まらないので入れない
 */
export const PYTHON_GPU_TYPES = [
    'T4',
    'L4',
    'A10',
    'L40S',
    'A100-40GB',
    'A100-80GB',
    'RTX-PRO-6000',
    'H100',
    'H200',
    'B200',
];
/** 1 container の GPU の枚数の上限（Modal: A10 は 4、他は 8） */
export const PYTHON_GPU_COUNT_MAX = {
    T4: 8,
    L4: 8,
    A10: 4,
    L40S: 8,
    'A100-40GB': 8,
    'A100-80GB': 8,
    'RTX-PRO-6000': 8,
    H100: 8,
    H200: 8,
    B200: 8,
};
export const PYTHON_COMPUTE_DEFAULTS = { cpu: 1, memoryMiB: 4096 };
export const PYTHON_CPU_MIN = 0.25;
export const PYTHON_CPU_MAX = 16;
export const PYTHON_MEMORY_MIB_MIN = 512;
export const PYTHON_MEMORY_MIB_MAX = 131_072;
export const PYTHON_TASK_TIMEOUT_DEFAULT = 600;
export const PYTHON_TASK_TIMEOUT_MIN = 10;
/** Modal の Sandbox の `timeout` の上限 */
export const PYTHON_TASK_TIMEOUT_MAX = 86_400;
export const PYTHON_SERVER_IDLE_DEFAULT = 300;
export const PYTHON_SERVER_IDLE_MIN = 60;
export const PYTHON_SERVER_IDLE_MAX = 3600;
/**
 * サーバーの台数（2026-10-23 ユーザー決定）。宣言した台数まで、1 台あたりの同時の要求が目安を超えたら
 * Platform が足す。足した分の時間も Project の持ち主が払う（python-backend.md §4.3）
 */
export const PYTHON_SERVER_INSTANCES_DEFAULT = 1;
export const PYTHON_SERVER_INSTANCES_MAX = 10;
export const PYTHON_SERVER_TARGET_CONCURRENCY_DEFAULT = 4;
export const PYTHON_SERVER_TARGET_CONCURRENCY_MAX = 1000;
export const PYTHON_TASKS_MAX = 32;
/** タスクの入力・出力（JSON の UTF-8 のバイト数。python-backend.md §9） */
export const PYTHON_RUN_INPUT_MAX_BYTES = 256 * 1024;
export const PYTHON_RUN_OUTPUT_MAX_BYTES = 1024 * 1024;
/** Modal の資格情報の名前（python の App の secret に使えない） */
export const PYTHON_RESERVED_SECRET_PREFIX = 'MODAL_';
export const PYTHON_TASK_NAME_PATTERN = /^[a-z][a-z0-9_]{0,31}$/;
/** `module.path:attr`（apps/<slug>/src/ 配下の import 可能なモジュール） */
export const PYTHON_HANDLER_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*:[A-Za-z_][A-Za-z0-9_]*$/;
const GPU_PATTERN = /^([A-Z0-9-]+)(?::([1-9][0-9]*))?$/;
/** `"H100:2"` → `{ type: 'H100', count: 2 }`。使えない型・枚数は null */
export function parsePythonGpu(value) {
    const match = GPU_PATTERN.exec(value);
    if (!match)
        return null;
    const type = match[1];
    if (!PYTHON_GPU_TYPES.includes(type))
        return null;
    const count = match[2] ? Number(match[2]) : 1;
    return count <= PYTHON_GPU_COUNT_MAX[type] ? { type, count } : null;
}
/** Modal の `gpu` 引数の形（`"H100:2"`。1 枚なら型だけ） */
export function pythonGpuArgument(gpu) {
    return gpu.count === 1 ? gpu.type : `${gpu.type}:${gpu.count}`;
}
export const pythonComputeSchema = z.strictObject({
    gpu: z
        .string()
        .refine((value) => parsePythonGpu(value) !== null, {
        message: `gpu is one of ${PYTHON_GPU_TYPES.join(', ')} with an optional :count`,
    })
        .optional(),
    cpu: z.number().min(PYTHON_CPU_MIN).max(PYTHON_CPU_MAX).optional(),
    memoryMiB: z.number().int().min(PYTHON_MEMORY_MIB_MIN).max(PYTHON_MEMORY_MIB_MAX).optional(),
});
const handlerSchema = z.string().regex(PYTHON_HANDLER_PATTERN);
/**
 * タスクが終わったら（成功・失敗・時間切れ・キャンセル・停止）Platform が登録するジョブ（python-backend.md §4.2）。
 * 宛先は同じ Project の jobs の App（`jobs.consume`）。handler 名は jobs の `jobs.schedule` と同じ形
 */
export const pythonTaskFinishSchema = z.strictObject({
    app: z.string(),
    handler: z.string().regex(/^[A-Za-z_$][A-Za-z0-9_$]{0,63}$/),
});
export const pythonTaskSchema = z.strictObject({
    handler: handlerSchema,
    onFinish: pythonTaskFinishSchema.optional(),
    timeoutSeconds: z
        .number()
        .int()
        .min(PYTHON_TASK_TIMEOUT_MIN)
        .max(PYTHON_TASK_TIMEOUT_MAX)
        .optional(),
    compute: pythonComputeSchema.optional(),
});
export const pythonServerSchema = z.strictObject({
    /** ASGI の app（Platform が uvicorn で起動する） */
    handler: handlerSchema,
    idleTimeoutSeconds: z
        .number()
        .int()
        .min(PYTHON_SERVER_IDLE_MIN)
        .max(PYTHON_SERVER_IDLE_MAX)
        .optional(),
    maxInstances: z.number().int().min(1).max(PYTHON_SERVER_INSTANCES_MAX).optional(),
    targetConcurrency: z.number().int().min(1).max(PYTHON_SERVER_TARGET_CONCURRENCY_MAX).optional(),
    compute: pythonComputeSchema.optional(),
});
/** App の既定 → タスク・サーバーの上書きの順に重ねる（キーごと） */
export function resolvePythonCompute(app, own) {
    const gpu = own?.gpu ?? app?.gpu;
    return {
        gpu: gpu === undefined ? null : parsePythonGpu(gpu),
        cpu: own?.cpu ?? app?.cpu ?? PYTHON_COMPUTE_DEFAULTS.cpu,
        memoryMiB: own?.memoryMiB ?? app?.memoryMiB ?? PYTHON_COMPUTE_DEFAULTS.memoryMiB,
    };
}
// ---------- Gateway との契約（python-backend.md §4.2・§5） ----------
export const PYTHON_RUN_STATUSES = [
    'queued',
    'starting',
    'running',
    'succeeded',
    'failed',
    'cancelled',
    'timed_out',
    'stopped',
];
/** 終わった状態（これ以上変わらない） */
export const PYTHON_RUN_FINAL_STATUSES = [
    'succeeded',
    'failed',
    'cancelled',
    'timed_out',
    'stopped',
];
const APP_SLUG = /^[a-z][a-z0-9-]{1,31}$/;
export const pythonRunRequestSchema = z.strictObject({
    app: z.string().regex(APP_SLUG),
    task: z.string().regex(PYTHON_TASK_NAME_PATTERN),
    /** JSON（256 KiB まで。DB が確かめる） */
    input: z.unknown(),
    /** 依頼の重複を防ぐ（同じキーの再送は同じ実行を返す） */
    idempotencyKey: z
        .string()
        .regex(/^[A-Za-z0-9_.:-]{1,128}$/)
        .optional(),
});
/** 依頼の受付（`POST /v1/python/runs` の 202） */
export const pythonRunAcceptedSchema = z.object({ runId: z.uuid(), status: z.string() });
/** 実行の id（`python.get(runId)` の引数） */
export const pythonRunIdSchema = z.uuid();
export const pythonRunSchema = z.strictObject({
    runId: z.uuid(),
    app: z.string(),
    task: z.string(),
    status: z.enum(PYTHON_RUN_STATUSES),
    progress: z.number().min(0).max(1).nullable(),
    progressMessage: z.string().nullable(),
    /** succeeded のときだけ */
    output: z.unknown().optional(),
    /** 失敗・停止・キャンセル・時間切れのとき（`code` は例外の型か理由） */
    error: z.strictObject({ code: z.string(), message: z.string().nullable() }).nullable().optional(),
    createdAt: z.string(),
    startedAt: z.string().nullable(),
    finishedAt: z.string().nullable(),
});
/**
 * タスクの `onFinish` で jobs に届くジョブの `payload`（Platform が登録する。python-backend.md §4.2）。
 * 出力は載せない（1 MiB まであり、ジョブの payload は 64 KiB まで）。`python.get(runId)` で読む
 */
export const pythonRunFinishedSchema = z.strictObject({
    runId: z.uuid(),
    app: z.string(),
    task: z.string(),
    status: z
        .enum(PYTHON_RUN_STATUSES)
        .refine((status) => PYTHON_RUN_FINAL_STATUSES.includes(status)),
    error: z.strictObject({ code: z.string(), message: z.string().nullable() }).nullable(),
});
/** ランナー（Sandbox の中）の資格情報。実行ごとの乱数で、Platform は SHA-256 の hex だけを持つ */
export const PYTHON_RUN_TOKEN_PATTERN = /^prt_[A-Za-z0-9_-]{43}$/;
export async function pythonRunTokenHash(token) {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
    return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
export const pythonRunnerInputSchema = z.strictObject({
    runId: z.uuid(),
    app: z.string(),
    task: z.string(),
    handler: z.string().regex(PYTHON_HANDLER_PATTERN),
    input: z.unknown(),
});
export const pythonRunnerProgressSchema = z.strictObject({
    progress: z.number().min(0).max(1).nullable(),
    message: z.string().max(200).optional(),
});
export const pythonRunnerFinishSchema = z.discriminatedUnion('succeeded', [
    z.strictObject({ succeeded: z.literal(true), output: z.unknown() }),
    z.strictObject({
        succeeded: z.literal(false),
        error: z.strictObject({ code: z.string().max(64), message: z.string().max(500).optional() }),
    }),
]);
