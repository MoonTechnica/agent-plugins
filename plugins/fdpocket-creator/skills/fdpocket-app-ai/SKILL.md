---
name: fdpocket-app-ai
description: ミニアプリに AI の機能（要約・下書き・分類・チャット・画像や PDF の読み取り・ツールを使うエージェント）を入れるときに使う。Mastra・LangChain・Vercel AI SDK・OpenAI SDK もそのまま使える。費用は使った利用者のクレジット。
---

# ミニアプリ内 AI（`client.ai`）

Platform が用意する AI を `client.ai.chat` か、OpenAI 互換の `client.ai.openai()` で呼ぶ（spec §3.8）。
**費用は使った本人のクレジット**から実際にかかった分だけ引かれる。作者の API キーは要らない。回数の制限は無く、上限はクレジットだけ。

## 1. 使うかどうか

| 頼まれたこと | 作り方 |
|---|---|
| 利用者の入力を要約・分類・下書き・翻訳する、画像や PDF を読ませる、相談相手のチャット | `client.ai.chat`（§3） |
| AI に道具（DB の検索・計算・外部 API）を使わせて何手か進めるエージェント、ストリーミングの UI、構造化出力をフレームワークで扱う | `client.ai.openai()` ＋ Mastra / Vercel AI SDK / LangChain.js を api の App で（§3a） |
| 作者が契約している特定の AI（自社のモデル・独自の API）を使う、費用を作者が持つ | 自分の API キーで api から呼ぶ（`$fdpocket-app-integrations`。`network.egress` と `secrets`） |
| AI が無くても成り立つ処理（並べ替え・集計・決まった文面） | AI を使わない（費用と待ち時間を利用者に負わせない） |

## 2. 宣言（`infra/project.yaml`）

```yaml
apps:
  web:
    kind: web
    capabilities:
      models: { note: [read, create, update] }
      ai: { chat: true }                 # AI を呼ぶ web App だけ
ai:
  model: auto                            # 省略可。auto（Jev Router が依頼ごとに選ぶ）/ fast / quality / モデル ID
  instructions: [note-helper]            # ai/note-helper.md
  schemas: [NoteSummary]                 # ai/schemas/NoteSummary.json
```

- **指示文**（`ai/<名前>.md`）: AI への役割・口調・守ること。利用者の入力をここに書かない（入力は `message`）。8 KiB・8 個まで。
- **Schema**（`ai/schemas/<名前>.json`）: 結果を JSON で受けたいときの JSON Schema（`type: object`・`required`・`additionalProperties: false`）。
  画面で項目ごとに使う結果（タイトル・タグ・点数など）は Schema にする。文章をそのまま見せるだけなら要らない。
- **モデル**: 基本は書かない（`auto`）。速さが要る短い処理は `fast`、難しい読解・長い文章は `quality`。モデル ID を直接書くのは
  利用者がモデルを指定したときだけ。
- `ai` を足すと、利用者の初回の同意に「AI の利用」が加わる（既に同意した人にも出し直す）。使わないのに足さない。

## 3. 呼び方

```ts
const result = await client.ai.chat({
  conversation: `note-${noteId}`,      // 会話の名前。続きを話すなら同じ名前、毎回独立なら別の名前
  message: text,
  instructions: 'note-helper',
  schema: 'NoteSummary',
  attachments: fileId ? [{ fileId }] : undefined,  // client.storage に上げたファイル（画像・PDF・音声・動画）
  onToken: (t) => setDraft((d) => d + t),          // 文章を少しずつ見せるとき
  signal: controller.signal,                       // 画面を離れたら待つのをやめる
})
if (result.finishReason === 'length') showCutOff()  // 途中で切れた。完成した答えとして扱わない
const summary = result.json                          // schema を指定し、正常に終わったときだけ
```

- 1 回の操作で 1 ターン。**画面を開いただけ・入力のたびに自動で呼ばない**（利用者が押したときだけ）。
- 続きの会話が要らない処理（要約・分類）は、`conversation` を対象ごとの名前にし、繰り返すなら `client.ai.reset` で切る。
- api から呼ぶときは利用者のリクエストを受けたときだけ。`asUser(request)` の戻り値の `ai` を使い、
  `servicePermissions: [ai.chat]` を宣言する。

## 3a. エージェント（フレームワークを使う）

`client.ai.openai()` は OpenAI 互換の接続先（`baseURL`・`apiKey`・`fetch`）を返す。Mastra・Vercel AI SDK・LangChain.js に
そのまま渡す。`model` は `auto`（Jev Router）か project.yaml の `ai.model`・許可一覧の ID。依存は普通の npm の追加
（`$fdpocket-app-dependencies`）。

**エージェントは api の App で動かす**（道具がサーバーの処理を持つ・Mastra と LangChain はサーバー向け）。web は
`client.fetch(apiPath('<api>', '/'))` で呼び、api は `asUser(request)` でその利用者として AI と DB を使う（払うのもその利用者）。
api の Worker は Node の組み込み（`node:async_hooks`・`node:fs` など）が使える（`nodejs_compat`）。

```yaml
# infra/project.yaml
apps:
  ask:
    kind: api
    routes: ["/api/*"]
    servicePermissions: [ai.chat]   # 利用者として AI を呼ぶ（web 側の capabilities.ai.chat も要る）
```

```ts
// apps/ask/src/index.ts（Mastra）
import { createOpenAI } from '@ai-sdk/openai'
import { Agent } from '@mastra/core/agent'
import { createTool } from '@mastra/core/tools'
import { createServerClient, type PlatformBindings } from '@workspace/miniapp-sdk/server'
import type { SchemaType } from '@workspace/sdk'
import { z } from 'zod'

export default {
  async fetch(request: Request, env: PlatformBindings) {
    const user = createServerClient<SchemaType>({ env }).asUser(request)
    const agent = new Agent({
      id: 'memo-agent',
      name: 'メモの助手',
      instructions: 'searchNotes で利用者のメモを探し、その内容だけを根拠に答える',
      model: createOpenAI(user.ai.openai()).chat('auto'),   // .chat（Chat Completions）を使う
      tools: {
        searchNotes: createTool({
          id: 'searchNotes',
          description: '利用者のメモを言葉で探す',
          inputSchema: z.object({ query: z.string() }),
          execute: async ({ query }) =>
            user.db.note.findMany({ where: { body: { contains: query } }, take: 5 }),
        }),
      },
    })
    const { question } = await request.json()
    const result = await agent.generate(question, { maxSteps: 5 })   // 手数を必ず区切る
    return Response.json({ answer: result.text })
  },
}
```

```ts
// Vercel AI SDK
import { generateText, stepCountIs, tool } from 'ai'
const { text } = await generateText({
  model: createOpenAI(user.ai.openai()).chat('auto'),
  system: '…',
  prompt: question,
  tools: { searchNotes: tool({ description: '…', inputSchema: z.object({ query: z.string() }), execute: searchNotes }) },
  stopWhen: stepCountIs(5),
})

// LangChain.js（ツールの呼び出しを自分で回す）
import { tool } from '@langchain/core/tools'
import { ChatOpenAI } from '@langchain/openai'
const { baseURL, apiKey, fetch } = user.ai.openai()
const search = tool(async (input) => JSON.stringify(await searchNotes(input)), { name: 'searchNotes', description: '…', schema: z.object({ query: z.string() }) })
const llm = new ChatOpenAI({ model: 'auto', apiKey, configuration: { baseURL, fetch } }).bindTools([search])
const messages = [{ role: 'system', content: '…' }, { role: 'user', content: question }]
for (let step = 0; step < 5; step++) {
  const reply = await llm.invoke(messages)
  messages.push(reply)
  if (!reply.tool_calls?.length) break
  for (const call of reply.tool_calls) messages.push(await search.invoke(call))
}
```

- api の応答のエラーは Gateway と同じ形（`{ error: { code, message, retryable } }` と状態コード）で返すと、web の
  `client.fetch` が `SdkError` にしてくれる（`QUOTA_EXCEEDED` は 429）。
- 道具（tool）は**その利用者の権限の範囲**で動く（ブラウザなら本人の `client.db`、api なら `asUser(request)` の `db`）。
  サービスの資格情報で利用者の代わりに読ませない。
- **ループの回数を必ず区切る**（`stopWhen` / `maxIterations`）。1 手ごとに利用者のクレジットが減る。
- Storage のファイルは画像などの場所に `fdpocket-file:<fileId>` と書く（read ポリシーで確かめて渡す）。
- 使えるのは Chat Completions だけ。Responses API（AI SDK の既定の `fdpocket('auto')`）・Embeddings・画像生成は無い。
- 失敗は OpenAI の形のエラーで、本文の `error.code` が `SdkErrorCode`（§4 の表どおりに出す）。

**jobs から**（重い処理・定期の処理）: `servicePermissions: [jobs.consume, ai.chat]` を宣言し、受け取ったイベントを
`createServerClient({ env }).forJob(event).ai.openai()` に渡す。払うのは:
- api が `asUser(request).jobs.schedule(...)` で**利用者として登録したジョブ** → その利用者
- project.yaml の **cron** → Project の持ち主
- python のタスクが `ctx.jobs.schedule(...)` で登録したジョブ → そのタスクの払う人（`$fdpocket-app-python`）
- サーバーとして登録したジョブ → 払う人がいないので使えない（`FORBIDDEN`）

利用者の操作で始まる AI の重い処理は、api で `asUser(request).jobs.schedule` に回せば、その利用者が払う。

## 4. 画面で必ずすること

1. **費用を伝える**: AI を使うボタンの近くに「AI を使います（クレジットを消費します）」と分かる表示を置く。
   結果の `credits` を出してもよい。
2. **待っている間**: 押したボタンを止め、進み具合（`onToken` の文章か、読み込み中の表示）を出す。止める操作を置く。
3. **失敗を必ず出す**（`SdkError` の `code`）:

   | code | 画面 |
   |---|---|
   | `QUOTA_EXCEEDED` | 「クレジットが足りません」＋ `client.ui.openCredits()` を開くボタン（埋め込まれていないときは出さない） |
   | `RATE_LIMITED` | AI のサービスが混んでいる。「少し待ってから」。もう一度押せるようにする |
   | `FORBIDDEN` | ログインしていない人には AI のボタンを出さない（匿名は使えない） |
   | `VALIDATION_FAILED` / `NOT_FOUND` | 添付が読めない・扱えない種類。添付を外して試せるようにする |
   | `GATEWAY_UNAVAILABLE` | 「AI に接続できませんでした」＋ 再試行 |

4. **AI が無くても使える**: AI の結果は下書き・提案として見せ、利用者が直してから保存する。AI が失敗しても、
   手で入力・保存する道を残す。AI の出力をそのまま他の人へ送ったり、確認なしで DB に書いたりしない。
5. **送る内容**: 利用者が AI に送ると分かるものだけを送る。他の人のデータ・パスワード・決済の情報を勝手に足さない。

## 5. 試し方

`kit dev` の AI は手元の**無料モック**。OpenRouter を呼ばず、費用は引かない。文章は模擬の応答と入力の繰り返し、
Schema を指定すれば Schema に沿う見本の JSON が返る。経路・宣言・添付の確かめ・失敗のコードを確認できる。

本物を確かめるときは `$fdpocket-dev` の `kit.mjs dev --connect` で自分のセッション環境に接続する。生成ターンでは
Platform が `kit dev --live` を起動する。どちらも通常の Project Gateway を通し、チャット所有者のクレジットを使う。
利用者の同意は信頼済み Host で明示的に行う。鍵や OAuth token をソース・設定ファイル・ブラウザーへ渡さない。

使い分けは自分で判断する:
- 画面の状態（待ち・結果・切れた・失敗）を作り込む・何度も繰り返す確認 → 手元のモック
- 指示文・Schema が狙いどおりの応答を返すか・応答の長さや見え方 → 接続したセッションで本物（数回に絞る）
- 残高不足（`QUOTA_EXCEEDED`）は本物でも起きる。そのときは接続を終了し、手元のモックで画面の確認を続ける

指示文・Schema のファイルは手元では毎ターン読み直す。接続中の作業ツリーは同期され、built / main / 公開版は実際の配備に固定される。
