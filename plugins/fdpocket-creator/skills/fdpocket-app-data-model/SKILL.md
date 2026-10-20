---
name: fdpocket-app-data-model
description: ミニアプリのデータを ZModel（packages/db-schema/schema.zmodel）で設計する。deny by default のポリシー、所有者と Workspace の分け方、保護する列の post-update の対、Role と Permission、一覧の index、利用者の削除の方針（onDelete・@@platform.retain・erase.test.ts）、migration（kit generate → kit db diff → pending/、破壊的な変更の intent.yaml と data.sql）、seed.ts の書き方。モデルを足す・変えるときに使う。
---

# データモデルと migration

複数書き込みは `client.db.batch([{ model: 'task', operation: 'create', args: { data: ... } }, ...])`。最大20操作、書き込みのみ。必要なIDは先に用意する。拒否・制約・応答上限・4秒期限超過で全体をrollbackし、通知はcommit後だけ。モデル名 `Batch` / `batch` はSDKの予約名なので使わない。`$transaction`・raw SQLは公開されない。

## 1. 置き場と基底

- 書くのは `packages/db-schema/schema.zmodel` だけ。`import "platform"` と `datasource` / `plugin policy` はテンプレートのまま残す。
- `platform.zmodel`（Kit が置く。編集しない）が基底を持つ: `PlatformUser`（`User` の mixin）・`PlatformWorkspace`（`Workspace` の mixin）・
  `Membership`（Workspace の参加。role は `owner` / `admin` / `editor` / `viewer`）・`ProjectRole` / `RolePermission` / `UserProjectRole`
  （Project 全体の Role）・`AppUserState`・`StorageFile` / `StorageGrant`・`AuditEvent`。
- `model User with PlatformUser { … }` / `model Workspace with PlatformWorkspace { … }` には**逆向きの relation だけ**を足す。

```zmodel
model User with PlatformUser {
  tasks    Task[]
}

model Workspace with PlatformWorkspace {
  tasks    Task[]
}

model Task {
  id          String    @id @default(uuid())
  title       String
  done        Boolean   @default(false)
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  ownerId     String
  owner       User      @relation(fields: [ownerId], references: [id], onDelete: Cascade)
  workspaceId String
  workspace   Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)

  @@index([workspaceId, createdAt, id])

  @@allow('read', workspace.members?[userId == auth().id])
  @@allow('create', workspace.members?[userId == auth().id && role in ['owner', 'admin', 'editor']] && ownerId == auth().id)
  @@allow('update', ownerId == auth().id || workspace.members?[userId == auth().id && role in ['owner', 'admin']])
  @@allow('delete', ownerId == auth().id || auth().permissions?[name == 'tasks.manage'])
  @@allow('post-update', true)
  @@deny('post-update', before().ownerId != ownerId || before().workspaceId != workspaceId)
}
```

## 2. ポリシー（既定は拒否）

- `@@allow` の無い操作は誰にもできない。操作は `read` / `create` / `update` / `delete`（`'read,update'` のようにまとめてよい）。
- 条件は次の 3 つの形を組み合わせて書く:
  - 本人: `auth().id == ownerId`（`create` では `ownerId == auth().id` で他人名義の作成を防ぐ）
  - Workspace: `workspace.members?[userId == auth().id]`（役割を絞るなら `&& role in ['owner', 'admin']`）
  - Permission: `auth().permissions?[name == 'tasks.manage']`
- 使えないもの: `has(auth().permissions, …)`（SQLite で動かない）、`auth().appSlug`（App で分けない。分けるのは project.yaml の capability）。
- 匿名の利用者は `auth().isAnonymous` が true。読み取りだけ許すなら条件に `!auth().isAnonymous` を足して書き込みを閉じる。
- 他人の表示名は `User` の基底ポリシーで読める（Project 内の全員）。メールなどの個人情報は User に足さない。
- **利用者の投稿（誰でも読める・User に紐づくモデル）には、ブロックした人の行を隠す deny を必ず書く**:
  `@@deny('read', authorId in auth().blockedUserIds)`。`auth().blockedUserIds` は Gateway が毎回入れる
  （ブロックした人の User.id）。無いと検証が `UGC_BLOCK_FILTER_MISSING` を出す。通報とブロックの入口は spec.md §3.5。

## 3. 保護する列（post-update の対）

作った後に変えさせない列（`ownerId` / `workspaceId` / 状態の遷移の元など）は、**必ず対で**書く:

```zmodel
@@allow('post-update', true)
@@deny('post-update', before().ownerId != ownerId)
```

`@@deny('post-update', …)` だけでは拒否されない（ZenStack の仕様）。`@@deny('update', …)` では「変えた後の値」を比べられない。
状態の遷移を縛るなら `@@deny('post-update', before().status == 'closed' && status != 'closed')` のように書く。

## 4. Role と Permission

- Permission の名前は `<対象>.<操作>`（`tasks.manage`, `reports.read`）。`platform.` で始まる名前は予約。
- Role は `infra/project.yaml` の `roles` に Permission の一覧で宣言し、`defaultRoles`（初めて使った人）と `ownerBootstrap`（作者）を決める。
  管理画面の `requiredPermission`（例: `app.access.admin`）もこの中の Permission。
- 基底の Permission: `workspace.create`（Workspace を作れる）/ `roles.manage`（Role を編集）/ `users.manage`（人に Role を付ける）/ `audit.read`（監査を読む）。
- Workspace の中の役割（owner / admin / editor / viewer）は `Membership.role` で、Project 全体の Role とは別。
- **共有（家族・チーム）を作るなら**: Workspace の作成・招待・受諾は `client.workspaces`（spec.md §3.6）を使う。
  `client.db.workspace.create` / `client.db.membership.create` では最初の owner を入れられない。`defaultRoles` の Role に
  `workspace.create` を入れ、画面には「スペースを作る」「招待する（名指し）」「届いた招待（参加する / 断る）」を置く。
  招待リンクを配る形は作らない（Platform に無い）。

## 5. 一覧と index

- 一覧のモデルには `createdAt` と `id` を持たせ、`orderBy: [{ createdAt: 'desc' }, { id: 'desc' }]` で並べる（一意列を最後に）。
- 絞り込みの列 + 並び順で `@@index([workspaceId, createdAt, id])` を置く。ポリシーの条件に使う列（`ownerId` / `workspaceId`）にも index。
- 件数の表示が要らなければ `count` を呼ばない。

## 6. 利用者の削除（必須項目）

利用者がアカウントを消す・「このミニアプリから自分のデータを消す」と、Platform が Project の DB からその `User` を消す
（本人のファイルも消える）。何が一緒に消え何が残るかは **`User` への relation の `onDelete` で決まる**。業務モデルを足すたびに、
**理由つきで**次のどれかを選んで書く（`design/data-model.md` にも 1 行残す）。迷ったら「共有されているなら匿名化、本人だけのものなら削除」。

| 選ぶもの | 書き方 | 例 |
|---|---|---|
| 本人と一緒に消える | `onDelete: Cascade` | 本人のメモ・下書き・設定 |
| 行は残し、名義だけ外す | 列を `String?`・relation を `User?` にして `onDelete: SetNull` | 共有の Workspace の文書・コメント（他の人の業務を壊さない） |
| 法令・会計で残す | `SetNull` に加えてモデルに `@@platform.retain(reason: '…', days: N)`（N は 1〜3650） | 取引の記録 |

保持期間は本人データ消去時から数える（複数User参照は最後の参照が消える時）。期限はPlatform内部で記録し、作成日時を起点に代用しない。他人・子行の参照が残る行は期限削除を保留する。業務列の追加は期限を引き継ぎ、主キー・User参照の非互換変更は定期処理のエラーになる。期限不明行を推測で掃除しない。

- 書かない・`Restrict` / `NoAction` / `SetDefault` は検証が拒否する（`USER_RELATION_ON_DELETE_MISSING` / `_INVALID`。消去が外部キーで止まる）。
  `@@platform.retain` のモデルが `Cascade` なら `RETAIN_CASCADES`。
- 本人のファイル（`StorageFile`）は消去で必ず消える。共有のファイルとして残したいなら、所有者を Workspace に移す設計にする。
- Workspace への relation（`onDelete: Cascade` が普通）は利用者の削除とは別に決めてよい。

### 消去のテスト（`packages/db-schema/erase.test.ts`）

動的検証が、`seed.ts` を流した新しい DB でこのテストを流す。`erase(userId)` は Platform の消去そのもの。
モデルを足したら、そのモデルの「本人の行が残らない・他人の行が壊れない」を書き足す。失敗したら投げる（検証は `ERASE_TEST_FAILED`）。

```ts
import type { ClientContract } from '@zenstackhq/orm'
import type { SchemaType } from '@workspace/sdk'

export default async function eraseTest({ db, erase }: {
  db: ClientContract<SchemaType>
  erase: (userId: string) => Promise<void>
}) {
  const alice = await db.user.findUniqueOrThrow({ where: { globalUserId: 'seed:alice' } })
  const bob = await db.user.findUniqueOrThrow({ where: { globalUserId: 'seed:bob' } })
  await erase(alice.id)
  if ((await db.task.count({ where: { ownerId: alice.id } })) !== 0) throw new Error("alice's tasks remain")
  if ((await db.task.count({ where: { ownerId: bob.id } })) === 0) throw new Error("bob's tasks are gone")
}
```

- テストが無いと検証は `ERASE_TEST_MISSING` の警告を出す。seed に権限の違う利用者を 2 人以上入れておく（片方を消し、もう片方で壊れていないことを見る）。

## 7. migration の流れ

1. `schema.zmodel` を変える。
2. `node <kit>/scripts/kit.mjs generate`（型 `packages/sdk/src/zenstack/` と `.kit/generated/` を作り直す。エラーは ZModel の行で出る）。
3. `node <kit>/scripts/kit.mjs db diff` → `pending/generated.sql` が作り直される（手で書かない・直さない）。結果を読む:
   - `changes`: 変更の一覧（`kind` と表・列）。`destructive`: データを壊しうる変更があるか。
   - `destructive: true` なら `pending/intent.yaml` に意図を書く（spec §6）。変更ごとに対応する意図が要る: 削除は `drop`、
     型・NOT NULL 化・一意制約の追加は対象の列の `retype`。名前の変更は ZenStack から見ると「削除 + 追加」なので、
     必ず `rename` と書く（値は合流で Platform が表の作り直しの写しに足して移す。`data.sql` では写せない）。
   - **公開中の版が使っている列**を消す・名前を変えるときは 2 段に分ける: 今回は新しい列を足して両方に書き（`data.sql` で
     `UPDATE "Task" SET "name" = "title";` のように埋める）、古い列は残して `- contract: { table: Task, column: title }` を書く。
     古い列の削除は、新しい版の公開の後に Platform が起票するターン（作者が承認したときだけ動く）で行う。
     そのターンでは、公開中の版がまだ古い列を読んでいるなら、先に古い列を `@omit` にしてコードから外した版を作る
     （公開中の版が読む列は消せない。その版が公開されてから消す）。
   - NOT NULL・既定値の無い列を既存の表に足すと、行があると落ちる。既定値を付けるか、NULL 可で足して `data.sql` で埋める。
4. `packages/sdk/src/zenstack/`・`pending/` を commit する。**`migrations/` は Platform だけが書く**（変えると `kit check` が落ちる）。
5. `kit dev` を起動し直す（ZModel を変えたら必ず。DB は作り直され、`seed.ts` が流れる）。

`kit check` は `begin_build` の前にも走り、`pending/generated.sql` が古い・`migrations/` を変えた・`platform.zmodel` を変えたときに終了コード 2 で止める。

### 本番の値を変えるとき

利用者へSQLや検証条件を書かせない。Agentが変更を作り、Platformが本番の隔離コピーと本番transaction内で検査する。
列のrename/drop・String/Int間の型変更は、上の`intent.yaml`からPlatformが宣言を確定SQLに含める。
既存の値の一対一の名称変更や行削除は、`pending/migration-policy.json`を用意する（確定後は消える）。例:

```json
{"transforms":[{"table":"Task","column":"status","kind":"map","forward":{"open":"todo"},"reverse":{"todo":"open"}}],"deletions":[]}
```

`data.sql`には対応する実際の変更を書く。mapは逆表が厳密に一致する一対一の変更だけで、空文字化・NULL化や既存値との衝突は通らない。
宣言と実際の結果が一致し、対象外の値と重複件数が保たれる場合だけ自動公開できる。
行削除は`deletions:[{"table":"Task","drop_columns":[],"drop_table":false}]`を宣言する。
削除・列削除・表削除は本番コピーで実測した影響をオーナー/管理者に示し、承認まで公開を止める。
`migration`・`max_rows`や承認済みフラグを宣言しない。これらはPlatformが管理し、Agentによる自己承認はできない。
検証不可・ユーザーが問題ありとしたときは公開を進めず、チャットの指摘に沿って修正する。本番値はAgentへ渡されない。

## 8. 試用データ（`packages/db-schema/seed.ts`）

`kit dev`（と Platform の影の DB・ブランチ DB）が、DB を作ったときに 1 回だけ流す。本番には流れない。失敗すると `kit dev` は起動しない。

```ts
import type { ClientContract } from '@zenstackhq/orm'
import type { SchemaType } from '@workspace/sdk'

export default async function seed(db: ClientContract<SchemaType>) {
  const alice = await db.user.create({
    data: { id: crypto.randomUUID(), globalUserId: 'seed:alice', displayName: 'Alice' },
  })
  const team = await db.workspace.create({ data: { name: 'サンプルのチーム' } })
  await db.membership.create({ data: { workspaceId: team.id, userId: alice.id, role: 'owner' } })
  await db.task.createMany({
    data: Array.from({ length: 25 }, (_, i) => ({ title: `タスク ${i + 1}`, ownerId: alice.id, workspaceId: team.id })),
  })
}
```

- import は**型だけ**（`import type`）。`@workspace/sdk` の実体はビルド時の定数が要るので実行時に読めない。
- `db` はポリシーの無い client（User も作れる）。基底の `User.id` は既定値が無いので自分で渡す。`globalUserId` は一意な値にする。
- 一覧のページングが確かめられる件数（20 件以上）と、権限の違う役割の利用者を入れる。`kit dev` の admin の主体は Kit が別に作る。
