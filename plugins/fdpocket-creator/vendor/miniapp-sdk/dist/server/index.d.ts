import '../zod-jitless.ts';
import { type NotificationSendRequest, type NotificationSendResponse } from '@workspace/project-protocol';
import type { SchemaDef } from '@zenstackhq/schema';
import { type Ai } from '../ai/client.ts';
import type { DbClient } from '../db/types.ts';
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
}
export interface ServerUserClient<S extends SchemaDef = SchemaDef> extends ServerDataClient<S> {
    /**
     * その利用者としてミニアプリ内 AI を呼ぶ（その利用者のクレジットから引く。project-ai.md §2）。
     * App の `servicePermissions` に `ai.chat` が要る
     */
    readonly ai: Ai;
}
/** Worker 専用。資格情報は Worker の binding に保ち、10 分の token だけを Gateway に送る。 */
export declare function createServerClient<S extends SchemaDef = SchemaDef>(options: {
    env: PlatformBindings;
    fetch?: typeof globalThis.fetch;
    now?: () => number;
}): ServerClient<S>;
export type { JobCancelResponse, JobDelivery, JobScheduleRequest, JobScheduleResponse, } from '@workspace/project-protocol';
export type { Ai, AiChatInput } from '../ai/client.ts';
export { SdkError } from '../errors.ts';
