---
name: fdpocket-app-ai
description: ミニアプリに AI の機能（要約・下書き・分類・チャット・画像や PDF の読み取り）を入れるときに使う。費用は使った利用者のクレジット。
---

# ミニアプリ内 AI（`client.ai`）

Platform が用意する AI を `client.ai.chat` で呼ぶ（spec §3.8）。**費用は使った本人のクレジット**から実際にかかった分だけ
引かれる。作者の API キーは要らない。

## 1. 使うかどうか

| 頼まれたこと | 作り方 |
|---|---|
| 利用者の入力を要約・分類・下書き・翻訳する、画像や PDF を読ませる、相談相手のチャット | `client.ai`（このスキル） |
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
  `servicePermissions: [ai.chat]` を宣言する。jobs からは呼べない（利用者がいないので払う人がいない）。

## 4. 画面で必ずすること

1. **費用を伝える**: AI を使うボタンの近くに「AI を使います（クレジットを消費します）」と分かる表示を置く。
   結果の `credits` を出してもよい。
2. **待っている間**: 押したボタンを止め、進み具合（`onToken` の文章か、読み込み中の表示）を出す。止める操作を置く。
3. **失敗を必ず出す**（`SdkError` の `code`）:

   | code | 画面 |
   |---|---|
   | `QUOTA_EXCEEDED` | 「クレジットが足りません」＋ `client.ui.openCredits()` を開くボタン（埋め込まれていないときは出さない） |
   | `RATE_LIMITED` | 「前の AI の処理が終わってから」か「少し待ってから」。もう一度押せるようにする |
   | `FORBIDDEN` | ログインしていない人には AI のボタンを出さない（匿名は使えない） |
   | `VALIDATION_FAILED` / `NOT_FOUND` | 添付が読めない・扱えない種類。添付を外して試せるようにする |
   | `GATEWAY_UNAVAILABLE` | 「AI に接続できませんでした」＋ 再試行 |

4. **AI が無くても使える**: AI の結果は下書き・提案として見せ、利用者が直してから保存する。AI が失敗しても、
   手で入力・保存する道を残す。AI の出力をそのまま他の人へ送ったり、確認なしで DB に書いたりしない。
5. **送る内容**: 利用者が AI に送ると分かるものだけを送る。他の人のデータ・パスワード・決済の情報を勝手に足さない。

## 5. 試し方

`kit dev` とライブプレビューの AI は**模擬の応答**（OpenRouter を呼ばず、費用 0）。文章は「kit dev の模擬の応答」と
入力の繰り返し、Schema を指定すれば Schema に沿う見本の JSON が返る。経路・宣言・添付の確かめ・失敗のコードは本番と同じなので、
画面の状態（待ち・結果・切れた・失敗）はここで作り込める。応答の中身の良し悪しは公開した版で確かめる。

指示文・Schema のファイルは `kit dev` では毎ターン読み直す。本番は版に固定される（公開後にファイルを変えても効かない）。
