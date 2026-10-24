// 消去のテスト（lifecycle.md §3.3）。動的検証が seed の後の新しい DB で流す。erase(userId) は Platform の消去
// （本人の行を消し、onDelete の Cascade / SetNull を DB が実行する）。本人のデータが残らず、他人のデータが壊れないことを
// 業務モデルを足すたびに書き足す。失敗したら投げる。
import type { SchemaType } from "@workspace/sdk"
import type { ClientContract } from "@zenstackhq/orm"

function check(ok: boolean, message: string) {
  if (!ok) throw new Error(message)
}

export default async function eraseTest({
  db,
  erase,
}: {
  db: ClientContract<SchemaType>
  erase: (userId: string) => Promise<void>
}) {
  const alice = await db.user.findFirstOrThrow({ where: { globalUserId: { endsWith: ":alice" } } })
  const bob = await db.user.findFirstOrThrow({ where: { globalUserId: { endsWith: ":bob" } } })

  await erase(alice.id)

  check((await db.user.count({ where: { id: alice.id } })) === 0, "alice must be erased")
  check(
    (await db.membership.count({ where: { userId: alice.id } })) === 0,
    "alice's memberships must be erased"
  )
  // 他人のデータは残る（共有の Workspace と bob の参加）
  check((await db.user.count({ where: { id: bob.id } })) === 1, "bob must remain")
  check(
    (await db.membership.count({ where: { userId: bob.id } })) === 1,
    "bob's membership must remain"
  )
  check((await db.workspace.count()) === 1, "the shared workspace must remain")
}
