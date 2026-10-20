// 試用データ（lifecycle.md §2.5）。kit dev・Platform の影の DB・動的検証が、DB を作ったときに 1 回だけ流す。本番には流れない。
// db はポリシーの無い client（User も作れる）。import は型だけ（@workspace/sdk の実体は実行時に読めない）。
import type { SchemaType } from "@workspace/sdk"
import type { ClientContract } from "@zenstackhq/orm"

export default async function seed(db: ClientContract<SchemaType>) {
  const [alice, bob] = await Promise.all(
    ["alice", "bob"].map((name) =>
      db.user.create({
        data: { id: crypto.randomUUID(), globalUserId: `seed:${name}`, displayName: name },
      })
    )
  )
  const team = await db.workspace.create({ data: { name: "サンプルのチーム" } })
  await db.membership.createMany({
    data: [
      { workspaceId: team.id, userId: alice.id, role: "owner" },
      { workspaceId: team.id, userId: bob.id, role: "editor" },
    ],
  })
}
