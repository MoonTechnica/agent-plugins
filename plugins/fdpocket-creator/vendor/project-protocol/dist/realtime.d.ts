import { z } from 'zod';
export declare const REALTIME_PLATFORM_MODELS: readonly ["User", "Workspace", "Membership", "AppUserState", "ProjectRole", "RolePermission", "UserProjectRole", "AuditEvent", "StorageFile", "StorageGrant"];
export declare const REALTIME_LIMITS: {
    readonly serverFrameBytes: number;
    readonly connectionStateBytes: number;
    readonly captureBytes: number;
    readonly captureRows: 10000;
    readonly roomMessagesPerSecond: 20;
    readonly environmentMessagesPerSecond: 100;
    readonly environmentFanoutPerSecond: 1000;
    readonly environmentBytesPerSecond: number;
    readonly channels: 10;
    readonly connections: 200;
    readonly snapshot: 200;
    readonly batch: 100;
    readonly broadcastBytes: number;
    readonly presenceBytes: 1024;
    readonly frameBytes: number;
    readonly ticketMs: 30000;
    readonly authenticateMs: 5000;
    readonly heartbeatMs: 25000;
    readonly timeoutMs: 60000;
    readonly recoveryMs: 30000;
    readonly retentionMs: number;
};
export declare const realtimeFilterSchema: z.ZodObject<{
    field: z.ZodString;
    op: z.ZodEnum<{
        in: "in";
        eq: "eq";
        neq: "neq";
        lt: "lt";
        lte: "lte";
        gt: "gt";
        gte: "gte";
    }>;
    value: z.ZodUnion<readonly [z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodNull]>, z.ZodArray<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodNull]>>]>;
}, z.core.$strict>;
export declare const realtimeSubscriptionSchema: z.ZodObject<{
    event: z.ZodEnum<{
        "*": "*";
        INSERT: "INSERT";
        UPDATE: "UPDATE";
        DELETE: "DELETE";
    }>;
    model: z.ZodString;
    filter: z.ZodOptional<z.ZodObject<{
        field: z.ZodString;
        op: z.ZodEnum<{
            in: "in";
            eq: "eq";
            neq: "neq";
            lt: "lt";
            lte: "lte";
            gt: "gt";
            gte: "gte";
        }>;
        value: z.ZodUnion<readonly [z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodNull]>, z.ZodArray<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodNull]>>]>;
    }, z.core.$strict>>;
    select: z.ZodOptional<z.ZodArray<z.ZodString>>;
}, z.core.$strict>;
export declare const realtimeJoinSchema: z.ZodObject<{
    channel: z.ZodString;
    key: z.ZodOptional<z.ZodString>;
    broadcast: z.ZodOptional<z.ZodObject<{
        ack: z.ZodOptional<z.ZodBoolean>;
        self: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$strict>>;
    changes: z.ZodDefault<z.ZodArray<z.ZodObject<{
        event: z.ZodEnum<{
            "*": "*";
            INSERT: "INSERT";
            UPDATE: "UPDATE";
            DELETE: "DELETE";
        }>;
        model: z.ZodString;
        filter: z.ZodOptional<z.ZodObject<{
            field: z.ZodString;
            op: z.ZodEnum<{
                in: "in";
                eq: "eq";
                neq: "neq";
                lt: "lt";
                lte: "lte";
                gt: "gt";
                gte: "gte";
            }>;
            value: z.ZodUnion<readonly [z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodNull]>, z.ZodArray<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodNull]>>]>;
        }, z.core.$strict>>;
        select: z.ZodOptional<z.ZodArray<z.ZodString>>;
    }, z.core.$strict>>>;
}, z.core.$strict>;
export declare const realtimeChannelSchema: z.ZodObject<{
    scope: z.ZodDefault<z.ZodLiteral<"app">>;
    model: z.ZodString;
    key: z.ZodString;
    events: z.ZodOptional<z.ZodArray<z.ZodString>>;
    actions: z.ZodObject<{
        broadcastReceive: z.ZodString;
        broadcastSend: z.ZodString;
        presenceRead: z.ZodString;
        presenceTrack: z.ZodString;
    }, z.core.$strict>;
}, z.core.$strict>;
export declare const realtimeManifestSchema: z.ZodObject<{
    models: z.ZodDefault<z.ZodArray<z.ZodString>>;
    channels: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodObject<{
        scope: z.ZodDefault<z.ZodLiteral<"app">>;
        model: z.ZodString;
        key: z.ZodString;
        events: z.ZodOptional<z.ZodArray<z.ZodString>>;
        actions: z.ZodObject<{
            broadcastReceive: z.ZodString;
            broadcastSend: z.ZodString;
            presenceRead: z.ZodString;
            presenceTrack: z.ZodString;
        }, z.core.$strict>;
    }, z.core.$strict>>>;
}, z.core.$strict>;
export declare const realtimeFrameSchema: z.ZodObject<{
    version: z.ZodLiteral<1>;
    ref: z.ZodString;
    type: z.ZodEnum<{
        broadcast: "broadcast";
        authenticate: "authenticate";
        track: "track";
        untrack: "untrack";
        heartbeat: "heartbeat";
        leave: "leave";
        refresh: "refresh";
    }>;
    payload: z.ZodUnknown;
}, z.core.$strict>;
export type RealtimeJoinRequest = z.infer<typeof realtimeJoinSchema>;
export type RealtimeSubscription = z.infer<typeof realtimeSubscriptionSchema>;
export type RealtimeManifest = z.infer<typeof realtimeManifestSchema>;
export type RealtimeAction = keyof z.infer<typeof realtimeChannelSchema>['actions'] | 'join';
export interface RealtimeChange {
    eventId: string;
    eventType: 'INSERT' | 'UPDATE' | 'DELETE';
    model: string;
    primaryKey: Record<string, unknown>;
    new: Record<string, unknown>;
    old: Record<string, unknown>;
    capturedAt: string;
    cursor: string;
    dataMode: 'current' | 'key_only';
}
