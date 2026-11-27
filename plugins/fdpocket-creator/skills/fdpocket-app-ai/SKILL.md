---
name: fdpocket-app-ai
description: ミニアプリに AI の機能（要約・下書き・分類・チャット・画像や PDF の読み取り・音声の文字起こし・読み上げ（音声合成）・PDF の読み取り方式の選択・Web 検索で最新情報を調べて答える・検索結果の並べ替え・ベクトル検索用の埋め込み・ツールを使うエージェント）を入れるときに使う。Mastra・LangChain・Vercel AI SDK・OpenAI SDK もそのまま使える。費用は使った利用者のクレジット。
---

# ミニアプリ内 AI（`client.ai`）

Platform が用意する AI を `client.ai.chat`・`client.ai.transcribe`・`client.ai.speak`・`client.ai.rerank`・`client.ai.embed` か、OpenAI 互換の `client.ai.openai()` で呼ぶ（spec §3.8）。
**費用は使った本人のクレジット**から実際にかかった分だけ引かれる。作者の API キーは要らない。回数の制限は無く、上限はクレジットだけ。

## 1. 使うかどうか

| 頼まれたこと | 作り方 |
|---|---|
| 利用者の入力を要約・分類・下書き・翻訳する、画像や PDF を読ませる、相談相手のチャット | `client.ai.chat`（§3） |
| 録音・音声ファイルの**文字起こし**（議事録・音声メモ・問い合わせ電話・動画の字幕の元）、話者ごとの書き起こし | `client.ai.transcribe`（§3c）。**チャットに音声を添えて「文字にして」と頼まない**（遅く、高く、不正確。録音の形式の対応も狭い） |
| 最新のニュース・価格・法令・製品情報など、**モデルが知らない最近の情報**を調べて答える | `client.ai.chat({ ..., webSearch: true })`（§3f）。結果の `sources` に出典の URL が付く |
| 文章の**読み上げ**・音声案内・音声つきの教材・通知の読み上げ | `client.ai.speak`（§3e）。ブラウザの `speechSynthesis` は端末ごとに声も日本語の品質も違うので、AI の音声が要るときだけこちら（作者が声を選べる） |
| 検索の結果を**関連の強い順に並べ直す**（社内文書・FAQ・問い合わせの類似）、おすすめの上位の決定 | `client.ai.rerank`（§3d）。全文検索・ベクトル検索で多めに取り、これで上位を決める |
| 意味が近いものを探す（類似資料・問い合わせ・おすすめ） | `client.ai.embed` ＋ `$fdpocket-app-search`（§3b） |
| AI に道具（DB の検索・計算・外部 API）を使わせて何手か進めるエージェント、ストリーミングの UI、構造化出力をフレームワークで扱う | `client.ai.openai()` ＋ Mastra / Vercel AI SDK / LangChain.js を api の App で（§3a） |
| 作者が契約している特定の AI（自社のモデル・独自の API）を使う、費用を作者が持つ | 自分の API キーで api から呼ぶ（`$fdpocket-app-integrations`。`network.egress` と `secrets`） |
| AI が無くても成り立つ処理（並べ替え・集計・決まった文面） | AI を使わない（費用と待ち時間を利用者に負わせない） |

AI の結果を使わずに次の操作へ進めるなら、その操作を読み取りや生成の完了まで待たせない。
書類の取り込み・要約・翻訳・分類・下書きでは、受付を先に表示し、結果は対象ごとに確認できるようにする。
画面を閉じても続ける依頼は、受付と状態を保存できる実行方式を選ぶ（`$fdpocket-app-integrations`）。
チャットのように応答をその場で読む操作では、生成された分から表示し、中止できるようにする。

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
  利用者がモデルを指定したときだけ。許可しているチャットのモデル: `openai/gpt-6.1-sol`・`openai/gpt-6.2-astra`・
  `anthropic/claude-haiku-5.5`（安い）・`claude-sonnet-5.5`・`claude-opus-5.5`・`claude-fable-5.2`（最上位）・
  `google/gemini-3.8-flash`（速い）・`gemini-4-hydrogen`・`gemini-4-neon`・`gemini-4-argon`（音声・動画も読める）・
  `mistralai/mistral-small-2603`（安い・保持なし）・`mistral-large-4-0`・`x-ai/grok-4.7`。文字起こし・音声合成・rerank・埋め込みは
  別のモデルの族で、チャットには使えない（`VALIDATION_FAILED`）。
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

## 3b. 埋め込み（ベクトル検索に使う）

意味が近いものを探す（類似する資料・問い合わせ・おすすめ）には、文を**埋め込み**（数のベクトル）にして `@@platform.vector` の列に保存し、
検索のときも検索文を埋め込みにして引く（手順は `$fdpocket-app-search` §6）。

```ts
const { embeddings, model } = await client.ai.embed(['東京オフィスの移転について', '経費精算のルール'], { model: 'openai/text-embedding-3-small', dimensions: 1536 })
const embedding = JSON.stringify(embeddings[0])     // @@platform.vector の列（JSON の配列の文字列）に保存する
```

- **`model` を明示し、返る `model` を保存する**（`embeddingModel` 列。`@@platform.vector` の `modelField`）。モデルが違うベクトルは次元数が同じでも比べられない。検索する文の埋め込みにも同じ `model` を使う（`$fdpocket-app-search` §6.2）。
- **`dimensions` はベクトル検索の `dims` と同じにする**（既定のモデルは 1536 次元）。違うと保存か検索が失敗する。
- 1 回に 64 件まで（1 件 32,000 字まで）。保存済みの行を読み書きするなら、利用者の権限でページごとに処理する（`$fdpocket-app-search` §6.2）。
- 本文を書き換えたら、埋め込みも作り直して保存する（古い埋め込みを残さない）。画面から入力のたびに作らない（利用者が検索を押したときだけ）。
- 費用は使った本人のクレジット（チャットと同じ財布。1 件あたりの費用は小さい）。許可は `ai.chat` に含まれる。
- `kit dev` の埋め込みは**費用 0 の模擬**（文字の 3 グラムを次元に散らす。言葉が重なる文は近くなるが、意味は分からない）。本物の意味の近さはライブプレビュー・本番で確かめる。
- フレームワーク: Vercel AI SDK は `createOpenAI(client.ai.openai()).textEmbeddingModel('embedding')`、LangChain は `new OpenAIEmbeddings({ model: 'embedding', apiKey, configuration: { baseURL, fetch } })`。

## 3c. 文字起こし（音声を文字にする）

録音や音声ファイルを文字にする専用の入口。**ブラウザの録音（`MediaRecorder`）をそのまま渡せる**（webm・ogg・mp4）。

```ts
// 録音 → 文字起こし（画面で押したときだけ）
const recorder = new MediaRecorder(stream)           // stream は getUserMedia の音声
const chunks: Blob[] = []
recorder.ondataavailable = (e) => chunks.push(e.data)
recorder.onstop = async () => {
  const audio = new Blob(chunks, { type: recorder.mimeType })
  const { text, segments } = await client.ai.transcribe({ audio, language: 'ja', signal })
  setDraft(text)                                     // 下書きとして見せ、利用者が直してから保存する
}

// 話者ごとに分ける・用語を寄せる（対応するモデルだけ）
await client.ai.transcribe({
  audio: { fileId },                                 // client.storage に上げた音声
  model: 'elevenlabs/scribe-v2',
  diarize: true,                                     // segments[].speaker に話者が付く
  keyterms: ['FDPocket', '田中部長'],
  prompt: '営業会議の録音。製品名が多い',
})
```

- 音声は **12 MiB まで**（圧縮された録音なら約 50 分）。長い録音は区切って送る（区切りの境目の言葉が欠けないよう数秒重ねる）。
- 形式: wav・mp3・m4a・mp4・ogg・webm・flac・aac。Blob の `type` か、`File` の名前の拡張子で判定する。
- モデルは基本書かない（既定は `transcribe`）。話者の分離・`keyterms` は `elevenlabs/scribe-v2` など一部のモデルだけで、
  対応しないモデルに渡すと `VALIDATION_FAILED`。長い会議・専門用語が多いときは `openai/gpt-4o-transcribe`。
- **結果は下書きとして見せる**（聞き取りの間違いはある）。固有名詞・数字は利用者が確認してから保存できるようにする。
- 費用は音声の長さで決まる（短い会話で 0.01 クレジット前後。長さの目安を押す前に出してよい）。ボタンを押したときだけ呼ぶ。
- 受付後も続ける大きな処理（多数の録音を順に処理する）は、api の `asUser(request).jobs.schedule` に回し、jobs の
  `forJob(event).ai.transcribe(...)` で文字にして結果を DB に保存する（§3a の jobs と同じ。音声は `Blob` で渡す）。
- OpenAI SDK・Vercel AI SDK からも同じ入口が使える: `new OpenAI(client.ai.openai()).audio.transcriptions.create({ file, model: 'transcribe' })`、
  `experimental_transcribe({ model: createOpenAI(client.ai.openai()).transcription('transcribe'), audio })`。

## 3d. 並べ替え（rerank）

検索で取れた候補を、問いとの関連の強さで並べ直す。全文検索・ベクトル検索は「それらしいもの」を速く集めるのが得意で、
**上位の順番の精度**は rerank のほうが高い。

```ts
const found = await db.article.findMany({ /* 全文検索・ベクトル検索で 30〜50 件 */ })
const { results } = await client.ai.rerank({
  query: question,
  documents: found.map((a) => `${a.title}\n${a.body.slice(0, 2000)}`),   // 1 件 16,000 字まで
  topN: 5,
})
const top = results.map((r) => found[r.index])        // index は渡した documents の位置
```

- 候補は 200 件まで。多めに取って絞るほど効く（数件しかないときは要らない）。
- 費用は 1 回で 0.2 クレジット前後。入力のたびに呼ばない（検索を押したときだけ）。
- `kit dev` の rerank は言葉の重なりで並べる模擬（意味は分からない）。順番の精度は本物（ライブプレビュー・本番）で確かめる。

## 3e. 音声合成（文を声にする）

```ts
const { audio } = await client.ai.speak({ text: article.summary, voice: 'sarah', signal })   // 押したときだけ
const url = URL.createObjectURL(audio)                 // 既定は mp3。<audio src> でそのまま鳴る
player.src = url
player.onended = () => URL.revokeObjectURL(url)        // 鳴らし終えたら解放する
await player.play()                                    // 再生は利用者の操作の中で呼ぶ（自動再生は止められる）
```

- 入力は **5,000 字まで**。長い文章は段落で区切り、順に呼んで続けて鳴らす（1 回ごとに精算される）。
- **声とモデル**: 声の名前はモデルごとに違う。既定（`speech`＝`elevenlabs/eleven-flash-v2.5`。速くて安い。mp3）は
  `sarah`・`george`・`alice`・`adam`・`bella`・`liam` など。表現力が要るなら `google/gemini-3.8-flash-tts`
  （`Kore`・`Puck`・`Zephyr` など。**`format: 'wav'` を指定**。`instructions: '落ち着いた声で'` で話し方を指示できる）、
  `elevenlabs/eleven-multilingual-v2`（多言語の品質）。声がモデルに合わないと `VALIDATION_FAILED`。
- 費用は文字数で決まる（既定のモデルで 1,000 字あたり約 4 セント＝約 4 クレジット）。**精算は少し遅れる**
  （OpenRouter が確定額を出してから引くので、残高の反映は数分〜数十分後）。画面に「読み上げます（クレジットを消費します）」を出し、
  **同じ文を何度も作り直さない**（作った音声は Storage に保存して使い回す。`client.storage`）。入力のたびに自動で呼ばない。
- 自動で読み上げ続ける作りにしない（利用者が押したときだけ。止める操作・再生の進み具合を置く）。
- `kit dev` の音声合成は**無音の wav**（長さは文字数に比例）。経路・宣言・再生の画面の組み立ては確かめられるが、声は本物（ライブプレビュー・本番）で確かめる。
- jobs の `forJob(event).ai.speak(...)` で、受付後に続ける処理（多数の文書の読み上げの作成）にも使える。結果は Storage に保存する。
- OpenAI SDK・Vercel AI SDK からも同じ入口: `new OpenAI(client.ai.openai()).audio.speech.create({ model: 'speech', voice: 'sarah', input })`。

## 3f. Web 検索（最新の情報を調べて答える）

```ts
const result = await client.ai.chat({
  conversation: `news-${topicId}`,
  message: `${topic} の最新の動きを 3 点で`,
  webSearch: true,                       // モデルが必要と判断したときだけ検索する
})
result.text                              // 検索結果を踏まえた答え
result.sources                           // [{ url, title? }] 出典。画面に必ずリンクで出す
```

- **費用**: 検索 1 回で約 0.7 セント（約 0.7 クレジット）がモデルの費用に加わる。1 回の要求で検索できるのは **3 回・結果 15 件まで**
  （Platform が強制する上限。増やせない）。毎回自動で検索しない（利用者が「調べる」を押したときだけ）。
- **出典を必ず見せる**: `sources` を画面にリンクで出し、「Web 検索の結果をもとにしています」と分かるようにする。検索で得た内容は
  間違っていることがあるので、そのまま保存・送信・実行に使わない（下書きとして見せる）。
- 検索の問い（クエリ）は外部の検索サービスに送られる。**他の人の個人情報・秘密を問いに入れない**（`message` に入れた内容がそのまま検索の手がかりになりうる）。
- OpenAI 互換（`client.ai.openai()`）でも同じ: `tools: [{ type: 'openrouter:web_search', parameters: { max_uses: 1, max_results: 3, allowed_domains: ['example.com'] } }]`。
  使える道具は **`function`（自分で実行する道具）・`openrouter:web_search`・`openrouter:web_fetch`（`allowed_domains` が必須）・
  `openrouter:datetime`** だけ。それ以外（`openrouter:fusion`・`advisor`・`subagent`・`files`・`shell` など）は `VALIDATION_FAILED`。
- 特定のサイトだけを調べさせるなら `allowed_domains`。URL の中身を読ませるなら `openrouter:web_fetch`（対象のドメインを必ず指定する）。
- `kit dev` の模擬は検索しない（`webSearch` を付けても通常の模擬の応答）。実際の検索はライブプレビュー・本番で確かめる。

## 3g. PDF を読ませる（読み取り方式で費用と精度を選ぶ）

PDF は `attachments: [{ fileId }]` で渡せば読める（§3）。**読み取り方式を `pdfEngine` で選べる**:

```ts
const result = await client.ai.chat({
  conversation: `doc-${docId}`,
  message: 'この契約書の支払条件を要約して',
  attachments: [{ fileId }],
  pdfEngine: 'text',                    // 'text' | 'ocr' | 'native'（省略は Platform が選ぶ）
})
```

| `pdfEngine` | 向いている PDF | 費用（2 ページの実測。Claude Haiku 5.5） | 注意 |
|---|---|---|---|
| `text` | 文字が入った PDF（報告書・規約・論文）。**まず試す** | 約 0.005 クレジット（既定の約 6 分の 1） | 無料のテキスト抽出。図・表・スキャンは読めず、**文字や桁が欠けることがある**（合成した PDF で末尾の数字が落ちた） |
| `ocr` | スキャンした PDF・画像が中心の PDF | 約 0.4 クレジット（**1 ページ 0.2 クレジット**の OCR 料金） | ページ数に比例して高くなる。文字の PDF には使わない |
| `native` | 図表を含む・正確さが要る PDF | 約 0.03 クレジット（入力トークンで課金） | PDF を直接読めるモデルだけ（OpenAI・Anthropic・Google・xAI の許可モデル）。Mistral のモデルは不可 |
| 省略 | — | モデルが直接読めれば `native`、読めなければ有料の OCR | 読めないモデルでは気づかないうちに OCR 料金が掛かる |

- 数字・固有名詞・金額を扱うなら、`text` の結果は**そのまま使わない**（利用者が確認できる画面にする）。正確さが要るなら `native`。
- 添付は 1 ターン 4 件・合計 20 MiB まで。**過去のターンの添付は次のターンで送り直さない**ので、続きの質問でも PDF を見せたいときは
  毎回 `attachments` に同じ `fileId` を付ける（`text` なら読み取りの費用は掛からない）。
- OpenAI 互換（`client.ai.openai()`）では `plugins: [{ id: 'file-parser', pdf: { engine: 'cloudflare-ai' | 'mistral-ocr' | 'native' } }]`。
  **読み取りの結果は返事の `annotations`（`type: 'file'`）に入る**。続きの質問でその返事（`annotations` つき）をそのまま履歴に入れて送り返すと、
  **再び読み取らない**（`mistral-ocr` でも OCR 料金が掛からないことを確かめた）。フレームワークが `annotations` を落とすなら、`text` を使う。
- `plugins` に通せるのは `file-parser` だけ。それ以外（`auto-router`・`web` など）は `VALIDATION_FAILED`。
- `kit dev` の模擬は PDF を読まない（通常の模擬の応答）。読み取りの精度・費用は本物（ライブプレビュー・本番）で確かめる。

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

- **確かめたフレームワーク**（2026-11-28。Gateway 経由で本物の OpenRouter に通した）: OpenAI SDK（chat・ストリーム・埋め込み・文字起こし・音声合成）、
  Vercel AI SDK（`generateText`・`streamText`・ツール・`embed`・`transcribe`・`generateSpeech`）、LangChain.js（`ChatOpenAI` の
  `invoke`・`stream`・`bindTools`、`OpenAIEmbeddings`、`modelKwargs.tools` での Web 検索）。LangChain には文字起こし・音声合成の
  標準の部品が無いので、その 2 つは `client.ai.transcribe` / `client.ai.speak` か OpenAI SDK を使う。
- api の応答のエラーは Gateway と同じ形（`{ error: { code, message, retryable } }` と状態コード）で返すと、web の
  `client.fetch` が `SdkError` にしてくれる（`QUOTA_EXCEEDED` は 429）。
- 道具（tool）は**その利用者の権限の範囲**で動く（ブラウザなら本人の `client.db`、api なら `asUser(request)` の `db`）。
  サービスの資格情報で利用者の代わりに読ませない。
- **ループの回数を必ず区切る**（`stopWhen` / `maxIterations`）。1 手ごとに利用者のクレジットが減る。
- Storage のファイルは画像などの場所に `fdpocket-file:<fileId>` と書く（read ポリシーで確かめて渡す）。チャットの添付にできる音声は wav と mp3 だけ。**音声を文字にしたいだけなら添付ではなく `transcribe`（§3c）**。
- 使えるのは Chat Completions（Web 検索・ツール呼び出しを含む。§3f）と、文字起こし・音声合成・rerank・Embeddings の入口（§3b〜§3e）。Responses API（AI SDK の既定の `fdpocket('auto')`）・画像生成は無い。
- 失敗は OpenAI の形のエラーで、本文の `error.code` が `SdkErrorCode`（§4 の表どおりに出す）。

**jobs から**（重い処理・定期の処理）: `servicePermissions: [jobs.consume, ai.chat]` を宣言し、受け取ったイベントを
`createServerClient({ env }).forJob(event).ai.openai()` に渡す。払うのは:
- api が `asUser(request).jobs.schedule(...)` で**利用者として登録したジョブ** → その利用者
- project.yaml の **cron** → Project の持ち主
- python のタスクが `ctx.jobs.schedule(...)` で登録したジョブ → そのタスクの払う人（`$fdpocket-app-python`）
- サーバーとして登録したジョブ → 払う人がいないので使えない（`FORBIDDEN`）

要約、翻訳、読み取りなどを受付後も独立して続けるなら、所要時間にかかわらず api の `asUser(request).jobs.schedule` に回す。
本文・画像を利用者の権限で読み、結果を保存するジョブには `jobs.data` も宣言する。画像は `fdpocket-file:<fileId>` で渡し、
結果は `forJob` の `db` で保存する。応答が次の会話の入力になるチャットは通常の AI ストリームを使う（`$fdpocket-app-integrations` と spec §3.2a）。

## 4. 画面で必ずすること

1. **費用を伝える**: AI を使うボタンの近くに「AI を使います（クレジットを消費します）」と分かる表示を置く。
   結果の `credits` を出してもよい。
2. **待っている間**: 同じ依頼の二重送信を防ぎ、対象ごとに進み具合（`onToken` の文章か、読み込み中の表示）を出す。
   中止できる処理には止める操作を置く。別の入力や資料の取り込みなど、処理結果に依存しない操作は続けられるようにする。
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

文字起こし・rerank の模擬は固定の文・言葉の重なりの並べ替え。経路・宣言・Storage の確かめ・失敗のコードの確認に使い、聞き取りや並びの精度は本物で確かめる。

本物を確かめるときは `$fdpocket-dev` の `kit.mjs dev --connect` で自分のセッション環境に接続する。生成ターンでは
Platform が `kit dev --live` を起動する。どちらも通常の Project Gateway を通し、チャット所有者のクレジットを使う。
利用者の同意は信頼済み Host で明示的に行う。鍵や OAuth token をソース・設定ファイル・ブラウザーへ渡さない。

使い分けは自分で判断する:
- 画面の状態（待ち・結果・切れた・失敗）を作り込む・何度も繰り返す確認 → 手元のモック
- 指示文・Schema が狙いどおりの応答を返すか・応答の長さや見え方 → 接続したセッションで本物（数回に絞る）
- 残高不足（`QUOTA_EXCEEDED`）は本物でも起きる。そのときは接続を終了し、手元のモックで画面の確認を続ける

指示文・Schema のファイルは手元では毎ターン読み直す。接続中の作業ツリーは同期され、built / main / 公開版は実際の配備に固定される。
