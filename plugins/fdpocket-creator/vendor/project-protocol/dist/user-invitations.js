import { z } from 'zod';
import { contract } from "./contract.js";
import { workspaceInviteRoleSchema } from "./workspaces.js";
/**
 * ミニアプリの中からの利用者招待（user-invitations.md §3.3.3。gateway.md §5）。
 * 業務 admin が、まだこのミニアプリを使えない人を**宛先を名指しして**招く（リンクだけの招待は無い）。
 * - 宛先: Project 内の User.id（この Project を使ったことのある人）かメール（まだ FDPocket に居ない人も含む）
 * - 受諾された人には `use` が付き、`workspace` を添えていれば Workspace の招待が本人に届く
 * - 既に使える人には招待を作らない（`already_has_access`。`workspace` があれば従来の Workspace 招待だけ出す）
 * - 本番（prod）環境だけ。App の capability `users.invite` と、アプリ内の Permission `users.invite` が要る
 */
/** 招待に添える Workspace（招待する人がその owner / admin であること。受諾時に Membership の招待が届く） */
export const userInviteWorkspaceSchema = z.strictObject({
    id: z.uuid(),
    role: workspaceInviteRoleSchema.default('editor'),
});
/** `POST /v1/project/user-invitations`（宛先はどちらか 1 つ） */
export const userInviteRequestSchema = z
    .strictObject({
    /** Project 内の User.id */
    userId: z.string().min(1).max(255).optional(),
    email: z.string().trim().max(254).email().optional(),
    workspace: userInviteWorkspaceSchema.optional(),
})
    .refine((value) => (value.userId === undefined) !== (value.email === undefined), {
    message: 'exactly one of userId or email is required',
});
/** 結果の種類（後から足してよい。読む側は知らない値を受け流す） */
export const USER_INVITATION_KINDS = ['invited', 'workspace_invited', 'already_has_access'];
/**
 * - `invited`: 利用者の招待を出した（`invitationId` / `expiresAt`）
 * - `workspace_invited`: 既に使える人に Workspace の招待だけを出した（同上）
 * - `already_has_access`: 既に使える人で、出すものが無い
 */
export const userInvitationResult = contract((o) => o.object({
    kind: o.enum(USER_INVITATION_KINDS),
    invitationId: z.uuid().optional(),
    expiresAt: z.string().optional(),
}));
export const USER_INVITATION_STATUSES = ['pending', 'expired'];
/** 自分が出した招待（`GET /v1/project/user-invitations`。新しい順に 50 件まで） */
export const userInvitation = contract((o) => o.object({
    invitationId: z.uuid(),
    status: o.enum(USER_INVITATION_STATUSES),
    /** アカウント名か、マスクしたメール（`a***@example.com`）。平文のメールは返さない */
    invitee: z.string().nullable(),
    appSlug: z.string().nullable(),
    expiresAt: z.string(),
    createdAt: z.string(),
}));
export const userInvitationsResponse = contract((o) => o.object({ invitations: z.array(userInvitation.in(o)) }));
