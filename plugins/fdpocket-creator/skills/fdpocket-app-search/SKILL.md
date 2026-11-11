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
  embeddingModel String?     // その埋め込みを作ったモデル名（必ず記録する。§6.2）

  @@platform.search([title, body])
  @@platform.vector(embedding, dims: 1536, modelField: embeddingModel)   // 次元数は埋め込みのモデルと同じ（1〜1536）
  @@allow('read', workspace.members?[userId == auth().id])
}
```

- `with PlatformVector` と `@@platform.vector(列, dims: N)` は組で書く（`kit check` が止める）。列は `String`（配列でない）。
- **`modelField` は必ず書く**（埋め込みを作ったモデル名を持つ `String` 列。無いと `kit check` が警告する）。§6.2。
- 索引の調整（`maxNeighbors` / `compress` / `searchL` / `insertL` / `alpha`）は §6.4。最初は書かない（Turso の既定で始める）。
- migration は §3 と同じ（`kit generate` → `kit db migrate`）。副表（`_platform_vec_<モデル名>`）・近似索引・同期のトリガーが入る。
  **SQL を書かない。内部表を触らない。**
- 埋め込みを持たない行（`null`）は検索に出ない。

### 6.2 埋め込みを作って保存する

**`client.ai.embed(...)`（Platform の AI。`$fdpocket-app-ai` §3b）で作る。** 費用は使った本人のクレジット。

```ts
// api の App（利用者のリクエストを受けたとき）。jobs なら forJob(event).ai.embed(...)
const user = createServerClient<SchemaType>({ env }).asUser(request)
const { embeddings, model } = await user.ai.embed(article.body, { model: EMBEDDING_MODEL, dimensions: 1536 })
await user.db.article.update({
  where: { id },
  data: { embedding: JSON.stringify(embeddings[0]), embeddingModel: model },   // モデル名も一緒に保存する
})
```

**モデルは 1 つの定数（`EMBEDDING_MODEL`）で決め、保存にも検索にも同じものを使う。** 理由と手順:

- 埋め込みは**モデルごとに別の空間**のベクトルで、次元数が同じでも混ぜて比べられない（比べても距離は意味を持たず、結果が静かに悪くなる）。
  だから保存した行に `embeddingModel` を残し、**検索する文の埋め込みも同じモデルで作る**。
- モデルを変えるときは、**全行を作り直す**（古い行と新しい行を混ぜたまま運用しない）。作り直す行は
  `where: { OR: [{ embeddingModel: null }, { embeddingModel: { not: EMBEDDING_MODEL } }] }` で見つかる。jobs で分けて作り直し、
  終わるまでは古いモデルのまま検索する（切り替えは全行が終わってから `EMBEDDING_MODEL` を変える）。
- `embed` が返す `model` は提供元が実際に使ったモデル名。`model` を指定しなければ Platform の既定になり、既定が変わると混ざる。**必ず `model` を明示する。**

- `dimensions` は `@@platform.vector` の `dims` と同じにする（既定のモデルは 1536 次元）。
- 記事を作る・更新する処理の中で、本文から埋め込みを作り直して書く（本文を変えたのに古い埋め込みを残さない）。
  既存の大量のデータは jobs で分けて作る（1 回 64 件まで）。
- 自前のモデルで作りたいとき（画像・音声の埋め込み、多言語の専用モデル）は python の App（`$fdpocket-app-python`）や、
  api から外部の API（`$fdpocket-app-integrations`）でもよい。

### 6.3 近いものを引く

```tsx
const { data } = hooks.article.useFindMany({
  where: { vecMatch: { args: { v: JSON.stringify(queryVector), k: 50 }, equals: true } },
  orderBy: [{ vecDistance: { args: { v: JSON.stringify(queryVector) }, sort: 'asc' } }, { id: 'asc' }],
  take: 10,
})
```

- `v` は検索したい文の埋め込み（`client.ai.embed(検索文)` の結果を `JSON.stringify` した文字列。`dims` 個の数）。次元数が違う・数でない値は入力エラー（`VALIDATION_FAILED`）。
- `vecMatch` は**近い順の上位 `k` 件**（既定の目安 50、最大 500）を選ぶ近似検索。`vecDistance` はコサイン距離（0 が同じ、2 が反対）。
- **ポリシーは `k` 件を選んだ後に効く。** 権限のない行が上位にいると、結果は `k` 件より少なくなる（`take` に満たない）。
  `k` は `take` の 5 倍ほどにする。見える行が全体のごく一部のアプリ（行ごとに持ち主が違う個人データなど）には、ベクトル検索を勧めない。
- キーワードも併用したいときは、`where` に `ftsMatch` と `vecMatch` の両方を書くと **AND（両方に合うもの）** になる。
  「どちらかに合う」が欲しいなら、2 回引いて画面で重複を除いて並べる。

### 6.4 精度を上げる

出典を分けて書く。**効果は実データで測ってから決める**（§6.5）。

**A. Turso 公式の調整**（docs.turso.tech/features/ai-and-embeddings。`@@platform.vector` の引数。指定しなければ Turso の既定）

| 引数 | 意味 | 精度を上げたいとき |
|---|---|---|
| `maxNeighbors` | 各ノードが持つ近傍数（既定は 3√次元数） | 大きくする（容量・挿入時間が増える） |
| `searchL` | 検索時に訪れる近傍数の上限（既定 200） | 大きくする（検索が遅くなる） |
| `insertL` | 挿入時に訪れる近傍数の上限（既定 70） | 大きくする（挿入が遅くなる） |
| `alpha` | グラフの密度（既定 1.2。1 以上） | 大きくする（容量が増える） |
| `compress` | 近傍の保存に使う型（`float32` / `float16` / `floatb16` / `float8` / `float1bit`） | 圧縮しない（既定）。容量が問題になったときだけ圧縮する |

- 公式の推奨は「FLOAT32 から始める」。**行数が多く容量が問題になるまで、圧縮（`compress`）や `maxNeighbors` の縮小はしない**（どちらも精度が下がる）。
- 近似検索（DiskANN）は最適でない近傍を返すことがある。取りこぼしを減らすには `k` を多めに取る（§6.3）。
- 調整を変えると索引を作り直す migration が出る（`kit generate` → `kit db migrate`）。範囲外の値は `kit check` が止める。
- 公式に**書かれていない**もの: 圧縮型ごとの精度の落ち幅、RAG 向けの推奨設定、ハイブリッド検索。ここは次の B と §6.5 で補う。

**B. 一般的な RAG の精度向上策**（Turso 公式ではない。広く使われる方法。効果は題材で変わる）

1. **ハイブリッド（キーワード + ベクトル）を第一候補にする。** 型番・固有名詞はキーワード、言い換えはベクトルが強い。
   2 回引いて**順位を足し合わせる**（Reciprocal Rank Fusion。各結果の `1 / (60 + 順位)` を ID ごとに足して並べ直す）:

   ```ts
   function fuse(lists: string[][], take: number): string[] {
     const score = new Map<string, number>()
     for (const ids of lists) ids.forEach((id, rank) => score.set(id, (score.get(id) ?? 0) + 1 / (60 + rank + 1)))
     return [...score].sort((a, b) => b[1] - a[1]).slice(0, take).map(([id]) => id)
   }
   // fuse([ftsIds, vecIds], 10)  → その ID の行を取り直して、この順に並べる
   ```

2. **長い文書は分けて埋め込む（チャンク）。** 1 つのベクトルに長文を詰めると意味が薄まる。目安は 200〜500 トークン、前後を 10〜20% 重ねる。
   チャンクを別モデル（`ArticleChunk`: `articleId`・`position`・`text`・`embedding`・`embeddingModel`）にし、結果は親の記事にまとめて出す。
3. **各チャンクの先頭に文脈を足してから埋め込む**（文書のタイトル・節の見出し）。「この節は何の文書の何の話か」がベクトルにも FTS にも入る。
4. **上位を並べ直す（リランク）。** 上位 20 件ほどを `client.ai.chat` に渡して関連の強い順に 5 件へ絞る。費用が増えるので、精度が足りないときだけ。
5. **`k` は表示件数の 3〜5 倍**（近似とポリシーによる目減りを吸収する。§6.3）。
6. **クエリを整える。** 利用者の短い入力は、そのまま埋め込むより、検索向けの文に書き直して（`client.ai.chat`）から埋め込むと当たりやすい。費用が増えるので任意。

### 6.5 測って決める（評価）

精度は感覚で決めず、**小さな評価セット**で測る。

- 「質問」と「正解の文書 ID」の組を 20〜50 件、`tests/` に置く（実際の利用者の言い方で）。
- 指標は **recall@k**（正解が上位 k 件に入る割合）と **MRR**（正解の順位の逆数の平均）。
- 変更（チャンクの長さ・ハイブリッド・`searchL` など）の前後で同じセットを回し、**良くなったものだけ**残す。
- 埋め込みのモデルを変えたときも、再生成の前後で測る。

## 7. 守ること

- 検索の列を増やしすぎない。`body` のような長い列は、本当に探すときだけ。
- 埋め込みは本文を変えるたびに作り直す。作り直すときはモデル名（`embeddingModel`）も更新する。作り直しは重いので、保存の処理（api / jobs）に寄せ、画面から毎回作らない。
- 全件を検索結果に出さない。`take` は 20 前後で、必ずページングする。
- 検索のテストは「別の Workspace の行が結果に出ない」ことを必ず入れる（`$fdpocket-app-testing`）。
