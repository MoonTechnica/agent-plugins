import { type RealtimeChange, type RealtimeSubscription } from '@workspace/project-protocol';
import type { Transport } from '../transport.ts';
export type RealtimeStatus = 'SUBSCRIBED' | 'TIMED_OUT' | 'CLOSED' | 'CHANNEL_ERROR';
export type ChangeFilter = RealtimeSubscription;
export interface ChannelOptions {
    key?: string;
    broadcast?: {
        self?: boolean;
        ack?: boolean;
    };
}
export interface RealtimeSnapshot {
    model: string;
    rows: Record<string, unknown>[];
}
export type { RealtimeChange } from '@workspace/project-protocol';
export interface BroadcastMessage {
    event: string;
    payload: unknown;
}
export type PresenceState = Record<string, unknown[]>;
export interface RealtimeSocket {
    readonly readyState: number;
    readonly bufferedAmount: number;
    send(value: string): void;
    close(code?: number, reason?: string): void;
    addEventListener(type: string, callback: (event: {
        data?: unknown;
        code?: number;
    }) => void): void;
}
export type RealtimeSocketFactory = (url: string) => RealtimeSocket;
export interface RealtimeChannel {
    on(type: 'db_changes', filter: ChangeFilter, callback: (payload: RealtimeChange) => void): RealtimeChannel;
    on(type: 'broadcast', filter: {
        event: string;
    }, callback: (payload: BroadcastMessage) => void): RealtimeChannel;
    on(type: 'presence', filter: {
        event: 'sync' | 'join' | 'leave';
    }, callback: (payload: unknown) => void): RealtimeChannel;
    subscribe(callback?: (status: RealtimeStatus, error?: Error) => void): RealtimeChannel;
    send(message: BroadcastMessage & {
        type: 'broadcast';
    }): Promise<'ok'>;
    track(payload: Record<string, unknown>): Promise<'ok'>;
    untrack(): Promise<'ok'>;
    snapshot(): RealtimeSnapshot[];
    presenceState(): PresenceState;
    unsubscribe(): Promise<'ok'>;
}
export interface Realtime {
    channel(name: string, options?: ChannelOptions): RealtimeChannel;
    removeChannel(channel: RealtimeChannel): Promise<'ok'>;
    removeAllChannels(): Promise<'ok'[]>;
}
/** One socket per authorized room; ephemeral commands are never replayed after disconnect. */
export declare function createRealtime(transport: Transport, gateway: string, socketFactory?: RealtimeSocketFactory): Realtime & {
    reauthenticate(): void;
};
