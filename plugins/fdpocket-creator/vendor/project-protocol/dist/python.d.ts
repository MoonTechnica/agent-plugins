import { z } from 'zod';
/**
 * `kind: python` の App（python-backend.md §3）。GPU の AI 処理を Platform の Modal の Sandbox で動かす。
 * 値の範囲は Modal の上限（Sandbox の timeout は最大 24 時間・GPU は 1 container に 8 枚まで。A10 は 4 枚）と、
 * 課金額を決められること（GPU の fallback のリストを受けない）で決めた。
 */
export declare const PYTHON_VERSIONS: readonly ["3.11", "3.12", "3.13"];
export type PythonVersion = (typeof PYTHON_VERSIONS)[number];
/**
 * 使える GPU の型（Modal の型の文字列）。単価表（`ai_price_list` の `provider = 'modal'`）にある型だけ。
 * 40 GB / 80 GB のどちらになるか決まらない `A100`、上位の型へ切り替わりうる `B200+` は課金額が決まらないので入れない
 */
export declare const PYTHON_GPU_TYPES: readonly ["T4", "L4", "A10", "L40S", "A100-40GB", "A100-80GB", "RTX-PRO-6000", "H100", "H200", "B200"];
export type PythonGpuType = (typeof PYTHON_GPU_TYPES)[number];
/** 1 container の GPU の枚数の上限（Modal: A10 は 4、他は 8） */
export declare const PYTHON_GPU_COUNT_MAX: Readonly<Record<PythonGpuType, number>>;
export declare const PYTHON_COMPUTE_DEFAULTS: {
    readonly cpu: 1;
    readonly memoryMiB: 4096;
};
export declare const PYTHON_CPU_MIN = 0.25;
export declare const PYTHON_CPU_MAX = 16;
export declare const PYTHON_MEMORY_MIB_MIN = 512;
export declare const PYTHON_MEMORY_MIB_MAX = 131072;
export declare const PYTHON_TASK_TIMEOUT_DEFAULT = 600;
export declare const PYTHON_TASK_TIMEOUT_MIN = 10;
/** Modal の Sandbox の `timeout` の上限 */
export declare const PYTHON_TASK_TIMEOUT_MAX = 86400;
export declare const PYTHON_SERVER_IDLE_DEFAULT = 300;
export declare const PYTHON_SERVER_IDLE_MIN = 60;
export declare const PYTHON_SERVER_IDLE_MAX = 3600;
/**
 * サーバーの台数（2026-10-23 ユーザー決定）。宣言した台数まで、1 台あたりの同時の要求が目安を超えたら
 * Platform が足す。足した分の時間も Project の持ち主が払う（python-backend.md §4.3）
 */
export declare const PYTHON_SERVER_INSTANCES_DEFAULT = 1;
export declare const PYTHON_SERVER_INSTANCES_MAX = 10;
export declare const PYTHON_SERVER_TARGET_CONCURRENCY_DEFAULT = 4;
export declare const PYTHON_SERVER_TARGET_CONCURRENCY_MAX = 1000;
export declare const PYTHON_TASKS_MAX = 32;
/** タスクの入力・出力（JSON の UTF-8 のバイト数。python-backend.md §9） */
export declare const PYTHON_RUN_INPUT_MAX_BYTES: number;
export declare const PYTHON_RUN_OUTPUT_MAX_BYTES: number;
/** Modal の資格情報の名前（python の App の secret に使えない） */
export declare const PYTHON_RESERVED_SECRET_PREFIX = "MODAL_";
export declare const PYTHON_TASK_NAME_PATTERN: RegExp;
/** `module.path:attr`（apps/<slug>/src/ 配下の import 可能なモジュール） */
export declare const PYTHON_HANDLER_PATTERN: RegExp;
export interface PythonGpu {
    type: PythonGpuType;
    count: number;
}
/** `"H100:2"` → `{ type: 'H100', count: 2 }`。使えない型・枚数は null */
export declare function parsePythonGpu(value: string): PythonGpu | null;
/** Modal の `gpu` 引数の形（`"H100:2"`。1 枚なら型だけ） */
export declare function pythonGpuArgument(gpu: PythonGpu): string;
export declare const pythonComputeSchema: z.ZodObject<{
    gpu: z.ZodOptional<z.ZodString>;
    cpu: z.ZodOptional<z.ZodNumber>;
    memoryMiB: z.ZodOptional<z.ZodNumber>;
}, z.core.$strict>;
export type PythonComputeInput = z.output<typeof pythonComputeSchema>;
/**
 * タスクが終わったら（成功・失敗・時間切れ・キャンセル・停止）Platform が登録するジョブ（python-backend.md §4.2）。
 * 宛先は同じ Project の jobs の App（`jobs.consume`）。handler 名は jobs の `jobs.schedule` と同じ形
 */
export declare const pythonTaskFinishSchema: z.ZodObject<{
    app: z.ZodString;
    handler: z.ZodString;
}, z.core.$strict>;
export declare const pythonTaskSchema: z.ZodObject<{
    handler: z.ZodString;
    onFinish: z.ZodOptional<z.ZodObject<{
        app: z.ZodString;
        handler: z.ZodString;
    }, z.core.$strict>>;
    timeoutSeconds: z.ZodOptional<z.ZodNumber>;
    compute: z.ZodOptional<z.ZodObject<{
        gpu: z.ZodOptional<z.ZodString>;
        cpu: z.ZodOptional<z.ZodNumber>;
        memoryMiB: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strict>>;
}, z.core.$strict>;
export declare const pythonServerSchema: z.ZodObject<{
    handler: z.ZodString;
    idleTimeoutSeconds: z.ZodOptional<z.ZodNumber>;
    maxInstances: z.ZodOptional<z.ZodNumber>;
    targetConcurrency: z.ZodOptional<z.ZodNumber>;
    compute: z.ZodOptional<z.ZodObject<{
        gpu: z.ZodOptional<z.ZodString>;
        cpu: z.ZodOptional<z.ZodNumber>;
        memoryMiB: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strict>>;
}, z.core.$strict>;
/** 正規化した資源（Sandbox を作るときの値。課金は request = limit のこの値で決まる） */
export interface NormalizedPythonCompute {
    gpu: PythonGpu | null;
    cpu: number;
    memoryMiB: number;
}
export interface NormalizedPythonApp {
    version: PythonVersion;
    cache: boolean;
    tasks: Record<string, {
        handler: string;
        timeoutSeconds: number;
        compute: NormalizedPythonCompute;
        onFinish?: {
            app: string;
            handler: string;
        };
    }>;
    server?: {
        handler: string;
        idleTimeoutSeconds: number;
        maxInstances: number;
        targetConcurrency: number;
        compute: NormalizedPythonCompute;
    };
}
/** App の既定 → タスク・サーバーの上書きの順に重ねる（キーごと） */
export declare function resolvePythonCompute(app: PythonComputeInput | undefined, own: PythonComputeInput | undefined): NormalizedPythonCompute;
export declare const PYTHON_RUN_STATUSES: readonly ["queued", "starting", "running", "succeeded", "failed", "cancelled", "timed_out", "stopped"];
export type PythonRunStatus = (typeof PYTHON_RUN_STATUSES)[number];
/** 終わった状態（これ以上変わらない） */
export declare const PYTHON_RUN_FINAL_STATUSES: readonly PythonRunStatus[];
export declare const pythonRunRequestSchema: z.ZodObject<{
    app: z.ZodString;
    task: z.ZodString;
    input: z.ZodUnknown;
    idempotencyKey: z.ZodOptional<z.ZodString>;
}, z.core.$strict>;
export type PythonRunRequest = z.infer<typeof pythonRunRequestSchema>;
export declare const pythonRunSchema: z.ZodObject<{
    runId: z.ZodUUID;
    app: z.ZodString;
    task: z.ZodString;
    status: z.ZodEnum<{
        queued: "queued";
        starting: "starting";
        running: "running";
        succeeded: "succeeded";
        failed: "failed";
        cancelled: "cancelled";
        timed_out: "timed_out";
        stopped: "stopped";
    }>;
    progress: z.ZodNullable<z.ZodNumber>;
    progressMessage: z.ZodNullable<z.ZodString>;
    output: z.ZodOptional<z.ZodUnknown>;
    error: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        code: z.ZodString;
        message: z.ZodNullable<z.ZodString>;
    }, z.core.$strict>>>;
    createdAt: z.ZodString;
    startedAt: z.ZodNullable<z.ZodString>;
    finishedAt: z.ZodNullable<z.ZodString>;
}, z.core.$strict>;
export type PythonRun = z.infer<typeof pythonRunSchema>;
/**
 * タスクの `onFinish` で jobs に届くジョブの `payload`（Platform が登録する。python-backend.md §4.2）。
 * 出力は載せない（1 MiB まであり、ジョブの payload は 64 KiB まで）。`python.get(runId)` で読む
 */
export declare const pythonRunFinishedSchema: z.ZodObject<{
    runId: z.ZodUUID;
    app: z.ZodString;
    task: z.ZodString;
    status: z.ZodEnum<{
        queued: "queued";
        starting: "starting";
        running: "running";
        succeeded: "succeeded";
        failed: "failed";
        cancelled: "cancelled";
        timed_out: "timed_out";
        stopped: "stopped";
    }>;
    error: z.ZodNullable<z.ZodObject<{
        code: z.ZodString;
        message: z.ZodNullable<z.ZodString>;
    }, z.core.$strict>>;
}, z.core.$strict>;
export type PythonRunFinished = z.infer<typeof pythonRunFinishedSchema>;
/** ランナー（Sandbox の中）の資格情報。実行ごとの乱数で、Platform は SHA-256 の hex だけを持つ */
export declare const PYTHON_RUN_TOKEN_PATTERN: RegExp;
export declare function pythonRunTokenHash(token: string): Promise<string>;
export declare const pythonRunnerInputSchema: z.ZodObject<{
    runId: z.ZodUUID;
    app: z.ZodString;
    task: z.ZodString;
    handler: z.ZodString;
    input: z.ZodUnknown;
}, z.core.$strict>;
export declare const pythonRunnerProgressSchema: z.ZodObject<{
    progress: z.ZodNullable<z.ZodNumber>;
    message: z.ZodOptional<z.ZodString>;
}, z.core.$strict>;
export declare const pythonRunnerFinishSchema: z.ZodDiscriminatedUnion<[z.ZodObject<{
    succeeded: z.ZodLiteral<true>;
    output: z.ZodUnknown;
}, z.core.$strict>, z.ZodObject<{
    succeeded: z.ZodLiteral<false>;
    error: z.ZodObject<{
        code: z.ZodString;
        message: z.ZodOptional<z.ZodString>;
    }, z.core.$strict>;
}, z.core.$strict>], "succeeded">;
export type PythonRunnerFinish = z.infer<typeof pythonRunnerFinishSchema>;
