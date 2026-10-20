import { type Workspace, type WorkspaceInvitation, type WorkspaceInvitationCreated, type WorkspaceInviteRequest, type WorkspaceMembership } from '@workspace/project-protocol';
import type { Transport } from '../transport.ts';
/**
 * Project 内 Workspace の共有（gateway.md §5。sdk.md §3.4）。家族・チーム・顧客ごとのデータの単位。
 * - `create`: Workspace を作り、作った人を owner にする（`workspace.create` の Permission が要る）
 * - `invite`: owner / admin が**宛先の人を名指しして**招待する（リンクで誘う招待は無い）。宛先に通知が届く
 * - `invitations` / `accept` / `decline`: 本人宛ての招待を一覧し、受ける・断る（7 日で切れる）
 *
 * 読み書きの可否は ZModel の `workspace.members?[userId == auth().id]` で決まる（Membership は Gateway が作る）。
 */
export interface Workspaces {
    create(input: {
        name: string;
    }): Promise<Workspace>;
    /** 宛先は Project 内の User.id（`userId`）かスーパーアプリのアカウント名（`accountName`）のどちらか */
    invite(workspaceId: string, input: WorkspaceInviteRequest): Promise<WorkspaceInvitationCreated>;
    /** 本人宛ての未受諾の招待（この Project・環境。新しい順に 50 件まで） */
    invitations(): Promise<WorkspaceInvitation[]>;
    accept(workspaceId: string, invitationId: string): Promise<WorkspaceMembership>;
    decline(workspaceId: string, invitationId: string): Promise<void>;
}
export declare function createWorkspaces(transport: Transport): Workspaces;
