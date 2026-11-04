import { type Open, type UserInvitation as ProtocolUserInvitation, type UserInvitationResult as ProtocolUserInvitationResult, type UserInviteRequest } from '@workspace/project-protocol';
import type { Transport } from '../transport.ts';
/** 読む側の結果・招待。後から足された種類・状態も入りうる */
export type UserInvitationResult = Open<ProtocolUserInvitationResult>;
export type UserInvitation = Open<ProtocolUserInvitation>;
export interface UserInvitations {
    /** 自分が出した招待（新しい順に 50 件まで。宛先のメールはマスクされている） */
    list(): Promise<UserInvitation[]>;
}
/**
 * ミニアプリの中からの利用者招待（gateway.md §5。sdk.md §3.4）。業務 admin が、まだこのミニアプリを
 * 使えない人を**名指しして**招く（リンクで誘う招待は無い）。App の capability `users.invite` と、
 * アプリ内の Permission `users.invite`（`project.yaml` の `roles`）が要る。本番の環境だけ。
 * - `invite`: 宛先は Project 内の User.id（`userId`）かメール（`email`）のどちらか 1 つ。
 *   `workspace` を添えると、受諾した人にその Workspace の招待が届く（招く人がその owner / admin であること）。
 *   結果の `kind` は `invited`（招待を出した）・`workspace_invited`（既に使える人に Workspace の招待だけを出した）・
 *   `already_has_access`（既に使える人で、出すものが無い）
 * - `invitations.list`: 自分が出した招待の状態（pending / expired。受諾された招待は消える）
 */
export interface Users {
    invite(input: UserInviteRequest): Promise<UserInvitationResult>;
    readonly invitations: UserInvitations;
}
export declare function createUsers(transport: Transport): Users;
