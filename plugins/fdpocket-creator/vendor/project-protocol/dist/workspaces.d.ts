import { z } from 'zod';
/**
 * Project 内 Workspace の作成・招待・受諾（gateway.md §5。tasks/0487）。
 * - 作成: Workspace と作った人の `Membership`（owner）を Gateway が 1 つの書き込みで作る（`workspace.create` の Permission）
 * - 招待: Workspace の owner / admin が、**宛先の人を名指しして**招待する（Project 内の User.id かアカウント名）。
 *   リンクを知っているだけでは参加できない。招待の正は Platform の `project_invitations`（7 日で切れる）
 * - 受諾: 宛先の本人が Project トークンで受ける。Gateway が `Membership` を作る（所属の正は Project DB）
 */
/** 招待で付けられる Workspace の役割（`Membership.role`。owner は作った人だけ） */
export declare const WORKSPACE_INVITE_ROLES: readonly ["admin", "editor", "viewer"];
export declare const workspaceInviteRoleSchema: z.ZodEnum<{
    admin: "admin";
    editor: "editor";
    viewer: "viewer";
}>;
export type WorkspaceInviteRole = z.infer<typeof workspaceInviteRoleSchema>;
/** Workspace の役割（`Membership.role`） */
export declare const workspaceRoleSchema: z.ZodEnum<{
    admin: "admin";
    editor: "editor";
    viewer: "viewer";
    owner: "owner";
}>;
export type WorkspaceRole = z.infer<typeof workspaceRoleSchema>;
/** `POST /v1/workspaces` */
export declare const workspaceCreateRequestSchema: z.ZodObject<{
    name: z.ZodString;
}, z.core.$strict>;
export type WorkspaceCreateRequest = z.infer<typeof workspaceCreateRequestSchema>;
export declare const workspaceSchema: z.ZodObject<{
    id: z.ZodUUID;
    name: z.ZodString;
}, z.core.$strict>;
export type Workspace = z.infer<typeof workspaceSchema>;
/** `POST /v1/workspaces/{id}/invitations`（宛先はどちらか 1 つ） */
export declare const workspaceInviteRequestSchema: z.ZodObject<{
    userId: z.ZodOptional<z.ZodString>;
    accountName: z.ZodOptional<z.ZodString>;
    role: z.ZodDefault<z.ZodEnum<{
        admin: "admin";
        editor: "editor";
        viewer: "viewer";
    }>>;
}, z.core.$strict>;
export type WorkspaceInviteRequest = z.input<typeof workspaceInviteRequestSchema>;
export declare const workspaceInvitationCreatedSchema: z.ZodObject<{
    invitationId: z.ZodUUID;
    expiresAt: z.ZodString;
}, z.core.$strict>;
export type WorkspaceInvitationCreated = z.infer<typeof workspaceInvitationCreatedSchema>;
/** 本人宛ての招待（`GET /v1/workspaces/invitations`。この Project・環境だけ） */
export declare const workspaceInvitationSchema: z.ZodObject<{
    invitationId: z.ZodUUID;
    workspaceId: z.ZodUUID;
    workspaceName: z.ZodNullable<z.ZodString>;
    role: z.ZodEnum<{
        admin: "admin";
        editor: "editor";
        viewer: "viewer";
    }>;
    invitedByUserId: z.ZodNullable<z.ZodString>;
    expiresAt: z.ZodString;
}, z.core.$strict>;
export type WorkspaceInvitation = z.infer<typeof workspaceInvitationSchema>;
export declare const workspaceInvitationsResponseSchema: z.ZodObject<{
    invitations: z.ZodArray<z.ZodObject<{
        invitationId: z.ZodUUID;
        workspaceId: z.ZodUUID;
        workspaceName: z.ZodNullable<z.ZodString>;
        role: z.ZodEnum<{
            admin: "admin";
            editor: "editor";
            viewer: "viewer";
        }>;
        invitedByUserId: z.ZodNullable<z.ZodString>;
        expiresAt: z.ZodString;
    }, z.core.$strict>>;
}, z.core.$strict>;
export type WorkspaceInvitationsResponse = z.infer<typeof workspaceInvitationsResponseSchema>;
/** `POST /v1/workspaces/{id}/accept` / `.../decline` */
export declare const workspaceAnswerRequestSchema: z.ZodObject<{
    invitationId: z.ZodUUID;
}, z.core.$strict>;
export type WorkspaceAnswerRequest = z.infer<typeof workspaceAnswerRequestSchema>;
/** 受諾の応答（作られた / 既にあった `Membership`） */
export declare const workspaceMembershipSchema: z.ZodObject<{
    workspaceId: z.ZodUUID;
    role: z.ZodEnum<{
        admin: "admin";
        editor: "editor";
        viewer: "viewer";
        owner: "owner";
    }>;
}, z.core.$strict>;
export type WorkspaceMembership = z.infer<typeof workspaceMembershipSchema>;
