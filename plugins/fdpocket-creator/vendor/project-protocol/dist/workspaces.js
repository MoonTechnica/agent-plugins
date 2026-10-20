import { z } from 'zod';
/**
 * Project 内 Workspace の作成・招待・受諾（gateway.md §5。tasks/0487）。
 * - 作成: Workspace と作った人の `Membership`（owner）を Gateway が 1 つの書き込みで作る（`workspace.create` の Permission）
 * - 招待: Workspace の owner / admin が、**宛先の人を名指しして**招待する（Project 内の User.id かアカウント名）。
 *   リンクを知っているだけでは参加できない。招待の正は Platform の `project_invitations`（7 日で切れる）
 * - 受諾: 宛先の本人が Project トークンで受ける。Gateway が `Membership` を作る（所属の正は Project DB）
 */
/** 招待で付けられる Workspace の役割（`Membership.role`。owner は作った人だけ） */
export const WORKSPACE_INVITE_ROLES = ['admin', 'editor', 'viewer'];
export const workspaceInviteRoleSchema = z.enum(WORKSPACE_INVITE_ROLES);
/** Workspace の役割（`Membership.role`） */
export const workspaceRoleSchema = z.enum(['owner', ...WORKSPACE_INVITE_ROLES]);
/** `POST /v1/workspaces` */
export const workspaceCreateRequestSchema = z.strictObject({
    name: z.string().trim().min(1).max(100),
});
export const workspaceSchema = z.strictObject({ id: z.uuid(), name: z.string() });
/** `POST /v1/workspaces/{id}/invitations`（宛先はどちらか 1 つ） */
export const workspaceInviteRequestSchema = z
    .strictObject({
    /** Project 内の User.id（この Project を使ったことのある人） */
    userId: z.string().min(1).max(255).optional(),
    /** スーパーアプリのアカウント名（`/@name`。まだこの Project を使ったことの無い人） */
    accountName: z.string().trim().min(1).max(64).optional(),
    role: workspaceInviteRoleSchema.default('editor'),
})
    .refine((value) => (value.userId === undefined) !== (value.accountName === undefined), {
    message: 'exactly one of userId or accountName is required',
});
export const workspaceInvitationCreatedSchema = z.strictObject({
    invitationId: z.uuid(),
    expiresAt: z.string(),
});
/** 本人宛ての招待（`GET /v1/workspaces/invitations`。この Project・環境だけ） */
export const workspaceInvitationSchema = z.strictObject({
    invitationId: z.uuid(),
    workspaceId: z.uuid(),
    /** Workspace が消えていれば null */
    workspaceName: z.string().nullable(),
    role: workspaceInviteRoleSchema,
    /** 招待した人の Project 内 User.id（この Project の User が居なければ null） */
    invitedByUserId: z.string().nullable(),
    expiresAt: z.string(),
});
export const workspaceInvitationsResponseSchema = z.strictObject({
    invitations: z.array(workspaceInvitationSchema),
});
/** `POST /v1/workspaces/{id}/accept` / `.../decline` */
export const workspaceAnswerRequestSchema = z.strictObject({ invitationId: z.uuid() });
/** 受諾の応答（作られた / 既にあった `Membership`） */
export const workspaceMembershipSchema = z.strictObject({
    workspaceId: z.uuid(),
    role: workspaceRoleSchema,
});
