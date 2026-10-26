import '../zod-jitless.ts';
import { type NotificationSendRequest, type NotificationSendResponse } from '@workspace/project-protocol';
import type { SchemaDef } from '@zenstackhq/schema';
import { type Ai, type OpenAiCompatible } from '../ai/client.ts';
import { type Connections } from '../connections/client.ts';
import type { DbClient } from '../db/types.ts';
import { type Python } from '../python/client.ts';
import { type Storage } from '../storage/client.ts';
import { createJobs } from './jobs.ts';
export interface PlatformBindings {
    readonly GATEWAY_URL: string;
    readonly PLATFORM_SERVICE_CREDENTIAL: string;
}
export interface ServerDataClient<S extends SchemaDef = SchemaDef> {
    readonly db: DbClient<S>;
    readonly storage: Storage;
    idempotent(key: string): {
        readonly db: DbClient<S>;
    };
}
export interface ServerClient<S extends SchemaDef = SchemaDef> extends ServerDataClient<S> {
    readonly jobs: ReturnType<typeof createJobs>;
    readonly notifications: {
        send(input: NotificationSendRequest): Promise<NotificationSendResponse>;
    };
    /** 利用者の Project token を渡す。受信した Request の Authorization も受け付ける。 */
    asUser(token: string | Request): ServerUserClient<S>;
    /**
     * jobs の App の queue / scheduled のイベントを渡す。今配送中の実行として AI を呼ぶ（tasks/0537）。
     * 払うのは、`asUser(...).jobs.schedule` で登録したジョブならその利用者、project.yaml の cron なら
     * Project の持ち主、python のタスクが `ctx.jobs` で登録したジョブならそのタスクの払う人。
     * 利用者の無い `jobs.schedule`（サーバーとしての登録）のジョブは AI を使えない
     */
    forJob(event: JobRun): {
        readonly ai: {
            openai(): OpenAiCompatible;
        };
        /** python の App のタスクを依頼する（払うのはこのジョブの払う人。python-backend.md §5） */
        readonly python: Python;
    };
}
/** queue のイベント（`id`）か scheduled のイベント（`id` と `cron`） */
export interface JobRun {
    readonly id: string;
    readonly cron?: string;
}
export interface ServerUserClient<S extends SchemaDef = SchemaDef> extends ServerDataClient<S> {
    readonly connections: Pick<Connections, 'read'>;
    /**
     * その利用者としてミニアプリ内 AI を呼ぶ（その利用者のクレジットから引く。project-ai.md §2）。
     * App の `servicePermissions` に `ai.chat` が要る
     */
    readonly ai: Ai;
    /** その利用者として登録する（ジョブの中の AI はこの利用者のクレジットから引く。tasks/0537） */
    readonly jobs: ReturnType<typeof createJobs>;
    /**
     * その利用者として python の App のタスクを依頼する（その利用者のクレジットから引く。python-backend.md §5）。
     * App の `servicePermissions` に `python.run` が要る
     */
    readonly python: Python;
}
/** Worker 専用。資格情報は Worker の binding に保ち、10 分の token だけを Gateway に送る。 */
export declare function createServerClient<S extends SchemaDef = SchemaDef>(options: {
    env: PlatformBindings;
    fetch?: typeof globalThis.fetch;
    now?: () => number;
}): ServerClient<S>;
export type { JobCancelResponse, JobDelivery, JobScheduleRequest, JobScheduleResponse, PythonRun, PythonRunFinished, } from '@workspace/project-protocol';
/** onFinish で届いたジョブの payload を確かめる（python-backend.md §4.2） */
export { pythonRunFinishedSchema } from '@workspace/project-protocol';
export type { Ai, AiChatInput, OpenAiCompatible } from '../ai/client.ts';
export { SdkError } from '../errors.ts';
export type { Python, PythonRunHandle } from '../python/client.ts';
