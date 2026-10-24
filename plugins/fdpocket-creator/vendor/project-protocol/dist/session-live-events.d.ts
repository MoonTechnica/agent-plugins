import type { PendingIntent } from './intent.ts';
import type { NormalizedProjectManifest } from './manifest.ts';
export declare const SESSION_LIVE_METADATA_MAX_BYTES: number;
export declare const SESSION_LIVE_WORKER_MAX_BYTES: number;
export declare const SESSION_LIVE_SOURCE_MAX_BYTES: number;
export declare const SESSION_LIVE_SOURCE_MAX_FILES = 2000;
export interface SessionSyncContext {
    revision: string | null;
    schemaSql: string;
}
export interface SessionSourceDescriptor {
    hash: string;
    sizeBytes: number;
}
export interface SessionSchemaPayload {
    baseRevision: string | null;
    destructiveWithoutIntent: boolean;
    deltaSql: string;
    desiredSql: string;
    migrations: {
        name: string;
        sql: string;
    }[];
    source?: SessionSourceDescriptor;
    hash: string;
    manifest: NormalizedProjectManifest;
    runtimeVersion: number;
    zmodelHash: string;
    generatedSql: string;
    dataSql: string;
    intent: PendingIntent | null;
    schemaJson: string;
}
export interface SessionWorkerPayload {
    hash: string;
    bundleHash: string;
    appSlug: string;
    kind: 'api' | 'jobs';
    sizeBytes: number;
    manifest: NormalizedProjectManifest;
}
export interface SessionPythonPayload {
    hash: string;
    sourceHash: string;
    sizeBytes: number;
    appSlug: string;
    manifest: NormalizedProjectManifest;
}
export interface SessionSyncJob {
    id: string;
    status: 'uploading' | 'pending' | 'running' | 'done' | 'failed' | 'replan';
    uploadUrl?: string;
    errorCode?: string | null;
}
export type SessionLiveNotification = {
    kind: 'schema';
    payload: SessionSchemaPayload;
} | {
    kind: 'worker';
    payload: SessionWorkerPayload;
} | {
    kind: 'python';
    payload: SessionPythonPayload;
};
