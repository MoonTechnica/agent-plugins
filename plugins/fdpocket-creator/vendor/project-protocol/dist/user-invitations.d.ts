import { z } from 'zod';
/**
 * ミニアプリの中からの利用者招待（user-invitations.md §3.3.3。gateway.md §5）。
 * 業務 admin が、まだこのミニアプリを使えない人を**宛先を名指しして**招く（リンクだけの招待は無い）。
 * - 宛先: Project 内の User.id（この Project を使ったことのある人）かメール（まだ FDPocket に居ない人も含む）
 * - 受諾された人には `use` が付き、`workspace` を添えていれば Workspace の招待が本人に届く
 * - 既に使える人には招待を作らない（`already_has_access`。`workspace` があれば従来の Workspace 招待だけ出す）
 * - 本番（prod）環境だけ。App の capability `users.invite` と、アプリ内の Permission `users.invite` が要る
 */
/** 招待に添える Workspace（招待する人がその owner / admin であること。受諾時に Membership の招待が届く） */
export declare const userInviteWorkspaceSchema: z.ZodObject<{
    id: z.ZodUUID;
    role: z.ZodDefault<z.ZodEnum<{
        admin: "admin";
        editor: "editor";
        viewer: "viewer";
    }>>;
}, z.core.$strict>;
/** `POST /v1/project/user-invitations`（宛先はどちらか 1 つ） */
export declare const userInviteRequestSchema: z.ZodObject<{
    userId: z.ZodOptional<z.ZodString>;
    email: z.ZodOptional<z.ZodString>;
    workspace: z.ZodOptional<z.ZodObject<{
        id: z.ZodUUID;
        role: z.ZodDefault<z.ZodEnum<{
            admin: "admin";
            editor: "editor";
            viewer: "viewer";
        }>>;
    }, z.core.$strict>>;
}, z.core.$strict>;
export type UserInviteRequest = z.input<typeof userInviteRequestSchema>;
/** 結果の種類（後から足してよい。読む側は知らない値を受け流す） */
export declare const USER_INVITATION_KINDS: readonly ["invited", "workspace_invited", "already_has_access"];
/**
 * - `invited`: 利用者の招待を出した（`invitationId` / `expiresAt`）
 * - `workspace_invited`: 既に使える人に Workspace の招待だけを出した（同上）
 * - `already_has_access`: 既に使える人で、出すものが無い
 */
export declare const userInvitationResult: import("./contract.ts").Contract<z.ZodObject<{
    kind: z.ZodEnum<{
        invited: "invited";
        workspace_invited: "workspace_invited";
        already_has_access: "already_has_access";
    }>;
    invitationId: z.ZodOptional<z.ZodUUID>;
    expiresAt: z.ZodOptional<z.ZodString>;
}, z.core.$strip>>;
export type UserInvitationResult = z.output<typeof userInvitationResult.exact>;
export declare const USER_INVITATION_STATUSES: readonly ["pending", "expired"];
/** 自分が出した招待（`GET /v1/project/user-invitations`。新しい順に 50 件まで） */
export declare const userInvitation: import("./contract.ts").Contract<z.ZodObject<{
    invitationId: z.ZodUUID;
    status: z.ZodEnum<{
        pending: "pending";
        expired: "expired";
    }>;
    invitee: z.ZodNullable<z.ZodString>;
    appSlug: z.ZodNullable<z.ZodString>;
    expiresAt: z.ZodString;
    createdAt: z.ZodString;
}, z.core.$strip>>;
export type UserInvitation = z.output<typeof userInvitation.exact>;
export declare const userInvitationsResponse: import("./contract.ts").Contract<z.ZodObject<{
    invitations: z.ZodArray<z.ZodObject<{
        invitationId: z.ZodUUID;
        status: z.ZodEnum<{
            pending: "pending";
            expired: "expired";
        }>;
        invitee: z.ZodNullable<z.ZodString>;
        appSlug: z.ZodNullable<z.ZodString>;
        expiresAt: z.ZodString;
        createdAt: z.ZodString;
    }, z.core.$strip>>;
}, z.core.$strip>>;
export type UserInvitationsResponse = z.output<typeof userInvitationsResponse.exact>;
