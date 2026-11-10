---
name: fdpocket-app-search
description: ミニアプリに全文検索（キーワードで探す）とベクトル検索（意味で探す）を入れる。モデルに @@platform.search / @@platform.vector を書き、ftsMatch / ftsRank / vecMatch / vecDistance で引く。検索ボックス・「探す」・キーワード検索・横断検索・類似検索・おすすめを頼まれたとき、データが増えて一覧の絞り込みだけでは探せないときに使う。
---

# 全文検索

## 1. いつ使うか

| 頼まれたこと | 使うもの |
|---|---|
| 「キーワードで探したい」「検索ボックス」「投稿・資料・顧客を横断して探す」 | **このスキル**（全文検索） |
| 状態・担当者・日付で絞り込みたい | `where` の絞り込みで足りる。検索は要らない |
| 並べ替え・件数が少ない（数十件）一覧 | 画面側の絞り込みで足りる。検索を足さない |
| 「似たものを探す」「意味で探す」 | ベクトル検索（§6） |

検索を足すと、そのモデルの書き込みのたびに索引も更新される。**探す必要のないモデルには足さない**。

## 2. 宣言する（`packages/db-schema/schema.zmodel`）

```zmodel
model Post with PlatformSearch {
  id    String @id @default(cuid())
  title String
  body  String?
  // …

  @@platform.search([title, body])
  @@allow('read', workspace.members?[userId == auth().id])   // 検索結果にもこのポリシーが効く
}
```

- **`with PlatformSearch` と `@@platform.search([…])` は組で書く**（片方だけだと `kit check` が止める）。
- 対象は**文字列（`String`）の列だけ**。1〜8 個。配列・数値・日付・リレーションは入れない。
- 検索するのは「人が読む本文」の列（題名・本文・名前・メモ）。ID・状態・URL は入れない。
- 1 モデルに検索は 1 つ。モデルを分けて検索したいなら、画面で別々に引く。

## 3. migration（SQL は書かない）

```bash
node <kit>/scripts/kit.mjs generate
node <kit>/scripts/kit.mjs db migrate --slug add_post_search
```

`kit db migrate` が、検索の仮想表（`_platform_fts_<モデル名>`）と、書き込みに追従するトリガーと、既存の行の取り込みを
migration に足す。宣言を変える（列を足す・外す）と作り直し、宣言を消すと DROP の migration を足す。

- **`_platform_` で始まる表・トリガーを SQL で触らない**。`pending/data.sql` に書かない。
- 表が作り直される変更（列を省略可能にするなど）でも、同じ migration で検索を作り直す。何もしなくてよい。
- 差分に FTS の表が出ることはない。出たら `kit generate` をやり直す。

## 4. 画面から引く

```tsx
import { useClientQueries } from '@workspace/miniapp-sdk/react'
import { schema } from '@workspace/sdk'

function PostSearch({ q }: { q: string }) {
  const hooks = useClientQueries(schema)
  const { data, isLoading, error } = hooks.post.useFindMany(
    {
      where: { ftsMatch: { args: { q }, equals: true } },
      orderBy: [{ ftsRank: { args: { q }, sort: 'asc' } }, { id: 'asc' }],   // 関連が高い順
      take: 20,
    },
    { enabled: q.trim() !== '' }                                              // 空のときは引かない
  )
  // …
}
```

- **`q` は利用者の入力をそのまま渡す。** 語の分割・引用・エスケープは Gateway がする。自分で `"` や `*` を足さない。
- 空白で区切った語は **AND**。`東京 出張` は両方を含む行。
- 3 文字以上の語は索引で引き、**3 文字未満の語（「東京」「出張」）は文字列の部分一致**で引く（その分だけ少し重い）。
- `ftsMatch` を `where` に置くだけで、他の条件（`workspaceId` など）とも `AND` で組める。
- **ページングは `take` と `skip`**。関連度順は `cursor` で次のページを引けない（`useInfiniteFindMany` の `getNextPageParam` は
  `{ ...args, skip: 評価済みの件数 }` にする）。
- 関連度の値が要るときは `select: { id: true, ftsRank: { args: { q } } }`（小さいほど関連が高い）。
- 検索結果の**総件数は出さない**（権限のない行を数えない）。「全 N 件」ではなく「もっと見る」にする。

## 5. 画面の状態（全部そろえる）

| 状態 | 表示 |
|---|---|
| 入力が空 | 引かない。最近の項目や案内を出す |
| 検索中 | スケルトン（入力欄を動かさない）。入力ごとに引かず、300ms ほど待つ（debounce） |
| 0 件 | 「『◯◯』に合うものがありません」と、語を減らす・別の言い方を案内する |
| エラー | 再試行の導線 |
| 続きがある | 「もっと見る」ボタン |

## 6. ベクトル検索（意味で探す）

キーワードが合わなくても**意味が近いもの**を探したいとき（類似する資料・問い合わせ・おすすめ）に使う。
**キーワードで探せるなら全文検索（§2〜§5）を先に作る。**ベクトルは埋め込みの生成が要り、手間も費用も大きい。

### 6.1 宣言する

```zmodel
model Article with PlatformSearch, PlatformVector {
  id        String  @id @default(cuid())
  title     String
  body      String
  embedding String?          // 埋め込みを JSON の配列の文字列（'[0.12, -0.03, …]'）で持つ。省略可能な String

  @@platform.search([title, body])
  @@platform.vector(embedding, dims: 1536)      // 次元数は埋め込みのモデルと同じ（1〜1536）
  @@allow('read', workspace.members?[userId == auth().id])
}
```

- `with PlatformVector` と `@@platform.vector(列, dims: N)` は組で書く（`kit check` が止める）。列は `String`（配列でない）。
- migration は §3 と同じ（`kit generate` → `kit db migrate`）。副表（`_platform_vec_<モデル名>`）・近似索引・同期のトリガーが入る。
  **SQL を書かない。内部表を触らない。**
- 埋め込みを持たない行（`null`）は検索に出ない。

### 6.2 埋め込みを作って保存する

**Platform の AI（`client.ai`）は埋め込みを作れない**（チャットだけ）。埋め込みは次のどちらかで作る。

| 方法 | 使う場面 |
|---|---|
| python の App（`$fdpocket-app-python`） | 自前のモデルで作る（多言語の sentence-transformers など）。画像・音声の埋め込みもここ |
| api の App から外部の埋め込み API（`$fdpocket-app-integrations`） | OpenAI などの API を呼ぶ。`network.egress` に宛先を宣言し、鍵は `secrets` に置く |

保存するときは `embedding: JSON.stringify(vector)`（数の配列）。**`dims` と同じ長さ**にする（違うと書き込みが失敗する）。
記事を作る・更新する処理の中で、本文から埋め込みを作り直して書く（本文を変えたのに古い埋め込みを残さない）。

### 6.3 近いものを引く

```tsx
const { data } = hooks.article.useFindMany({
  where: { vecMatch: { args: { v: JSON.stringify(queryVector), k: 50 }, equals: true } },
  orderBy: [{ vecDistance: { args: { v: JSON.stringify(queryVector) }, sort: 'asc' } }, { id: 'asc' }],
  take: 10,
})
```

- `v` は検索したい文の埋め込み（`dims` 個の数の配列を JSON にした文字列）。次元数が違う・数でない値は入力エラー（`VALIDATION_FAILED`）。
- `vecMatch` は**近い順の上位 `k` 件**（既定の目安 50、最大 500）を選ぶ近似検索。`vecDistance` はコサイン距離（0 が同じ、2 が反対）。
- **ポリシーは `k` 件を選んだ後に効く。** 権限のない行が上位にいると、結果は `k` 件より少なくなる（`take` に満たない）。
  `k` は `take` の 5 倍ほどにする。見える行が全体のごく一部のアプリ（行ごとに持ち主が違う個人データなど）には、ベクトル検索を勧めない。
- キーワードも併用したいときは、`where` に `ftsMatch` と `vecMatch` の両方を書くと **AND（両方に合うもの）** になる。
  「どちらかに合う」が欲しいなら、2 回引いて画面で重複を除いて並べる。

## 7. 守ること

- 検索の列を増やしすぎない。`body` のような長い列は、本当に探すときだけ。
- 埋め込みは本文を変えるたびに作り直す。作り直しは重いので、保存の処理（api / jobs）に寄せ、画面から毎回作らない。
- 全件を検索結果に出さない。`take` は 20 前後で、必ずページングする。
- 検索のテストは「別の Workspace の行が結果に出ない」ことを必ず入れる（`$fdpocket-app-testing`）。
