// 初期化計画。DB client は受け取らず、モデルの create/createMany/upsert だけを返す。
// testIdentities の slot は admin/member/anonymous 以外。利用者とロールは Platform が作る。
import type { SchemaType, SeedContext, SeedPlan, TestIdentity } from "@workspace/sdk"

export const testIdentities = [
  { slot: "alice", roles: [], displayName: "Alice" },
  { slot: "bob", roles: [], displayName: "Bob" },
] satisfies TestIdentity[]

export default async function seed(context: SeedContext): Promise<SeedPlan<SchemaType>> {
  const workspaceId = await context.id("sample-workspace")
  return {
    version: 1,
    operations: [
      { model: "workspace", operation: "create", args: { data: { id: workspaceId, name: "サンプルのチーム" } } },
      { model: "membership", operation: "createMany", args: { data: [
        { workspaceId, userId: context.users.alice!.id, role: "owner" },
        { workspaceId, userId: context.users.bob!.id, role: "editor" },
      ] } },
    ],
  }
}
