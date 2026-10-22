import './zod-jitless.ts';
import { type Session } from '@workspace/project-protocol';
import type { SchemaDef } from '@zenstackhq/schema';
import { type Ai } from './ai/client.ts';
import type { DbClient } from './db/types.ts';
import { type Notifications } from './notifications/client.ts';
import { type Profile } from './profile/client.ts';
import { type Realtime, type RealtimeSocketFactory } from './realtime/client.ts';
import { type Safety } from './safety/client.ts';
import { type Storage } from './storage/client.ts';
import { type Ui } from './ui/client.ts';
import { type Workspaces } from './workspaces/client.ts';
/** bridge に要る window の最小の形（テストでは偽物を渡す） */
export interface HostWindow {
    parent: unknown;
    location?: {
        href: string;
        assign(url: string): void;
    };
    addEventListener(type: 'message', listener: (event: MessageEvent) => void): void;
    removeEventListener(type: 'message', listener: (event: MessageEvent) => void): void;
}
export interface ClientOptions {
    /** ルーティングのヒント。トークンの `aud` と一致しなければ `TOKEN_SCOPE_MISMATCH`（sdk.md §3.0） */
    projectId: string;
    /** この App の slug。トークンの `app` と一致しなければ `TOKEN_SCOPE_MISMATCH` */
    app: string;
    /** Gateway の URL（区画ごと。環境はトークンが持つ） */
    gateway: string;
    fetch?: typeof globalThis.fetch;
    webSocket?: RealtimeSocketFactory;
    window?: HostWindow;
}
export interface Auth {
    /** Direct access: show the trusted FDPocket account entry before sign-in. Embedded Apps receive the existing Host session. */
    signInWithSuperApp(): Promise<void>;
    /** スーパーアプリに埋め込まれているとき、Host から bridge でトークンを受け取る */
    fromHost(options?: {
        timeoutMs?: number;
    }): Promise<Session>;
    session(): Session | null;
    /** 変化（受け取り・更新・失効）を受ける。戻り値で購読をやめる */
    onChange(listener: (session: Session | null) => void): () => void;
    /**
     * **表示の補助だけ**（ボタンを出す / 出さない）。トークン発行時の写しで、認可には使わない。
     * サーバー（Gateway）が毎回 DB で判定する（sdk.md §3.1）
     */
    can(permission: string): boolean;
    /** Gateway で更新する（期限の 60 秒前に自動でも行う）。失効・期限切れは `SESSION_EXPIRED` */
    refresh(): Promise<Session>;
    /** 自分のトークンを失効する。スーパーアプリのセッションには触れない */
    signOut(): Promise<void>;
}
export interface ProjectClient<S extends SchemaDef = SchemaDef> {
    readonly projectId: string;
    readonly app: string;
    readonly auth: Auth;
    /** スーパーアプリの最新の本人の表示名・アバター（Project の User とは別） */
    readonly realtime: Realtime;
    readonly profile: Profile;
    /** Project の DB（ZenStack の query 契約。可否は Gateway が毎回判定する。sdk.md §3.2） */
    readonly db: DbClient<S>;
    /** 書き込みに `Idempotency-Key` を付ける（同じ key の 2 回目は 1 回目の応答。10 分） */
    idempotent(key: string): {
        readonly db: DbClient<S>;
    };
    /** ファイル（署名 URL への直接 PUT・ダウンロード・削除。sdk.md §3.3） */
    readonly storage: Storage;
    /** スーパーアプリとの連携（埋め込み時だけ。sdk.md §3.4） */
    readonly ui: Ui;
    /** 利用者の投稿の通報とブロック（compliance.md §4。sdk.md §3.4） */
    readonly safety: Safety;
    /** 通知の許可（ミニアプリごと・既定 OFF。送るのはトリガーとサーバー SDK だけ。sdk.md §3.3b） */
    readonly notifications: Notifications;
    /** Project 内 Workspace の作成・招待・受諾（gateway.md §5。sdk.md §3.4） */
    readonly workspaces: Workspaces;
    /** ミニアプリ内 AI（使った本人のクレジットから引く。project-ai.md §7） */
    readonly ai: Ai;
    /** Gateway の URL（`./react` が ZenStack のフックの endpoint に使う） */
    readonly gateway: string;
    /** 認証付きの fetch（ZenStack の TanStack Query フックの `fetch` に渡す）。失敗は `SdkError` を投げる */
    readonly fetch: (url: string, init?: RequestInit) => Promise<Response>;
}
/**
 * ブラウザ用の Project SDK（sdk.md §3）。トークンは**メモリだけ**に持つ
 * （localStorage / sessionStorage / cookie に置かない。XSS で持ち出せる場所を作らない）。
 */
export declare function createClient<S extends SchemaDef = SchemaDef>(options: ClientOptions): ProjectClient<S>;
