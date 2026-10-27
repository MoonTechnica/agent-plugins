---
name: game-ai
description: ゲーム内AI（NPC・会話・物語・選択肢・クエスト）のSDK呼び出しとmanifest、指示文、Structured Outputs、履歴、ストリーミング、フォールバックを扱う。通常のAI操作はHost所有の共通Controlを使い、予算や許可の追加画面・常設HUD・自動購入を作らない。年齢・データ送信同意は共通管理。ai, npc, chat, dialogue, llm, gpt.
---

# ゲーム内 AI（`TokoyoApp.ai`。契約は `app.ai`）

**API の正本は `<kit>/sdk/app-sdk/spec.md` §8.3**。先に読む。

AI は**遊びの味付け**に使う。返事が来なくても・遅くても・変でも、ゲームは最後まで遊べなければならない。
返事はPlatformが生成し、費用は実際の利用分だけ所持クレジットから引かれる。AI専用の許可画面・予算設定・常設HUDは設けない。通常のAI操作自体を共有Control `TokoyoAIAction` として配置し、Hostが描くクレジット消費表示付きのボタンを本人が押した1回だけ実行する。ゲームからの `ai.chat` や「操作済み」申告で消費を開始しない。

```gdscript
var ai_action = preload("res://tokoyo_ai_action.gd").new()
ai_action.custom_minimum_size = Vector2(240, 88)
ai_action.completed.connect(_show_ai_hint)
ai_action.failed.connect(_show_free_fallback)
container.add_child(ai_action)
ai_action.set_action({"kind": "hint", "conversation": "guide", "message": "key_found=true"})
```

`set_action` は入力を複製してHostへ登録するだけ。`started`, `token(text)`, `completed(result)`, `failed(code)`, `cancelled` を使う。UIを隠す/解放すると登録も解除する。直接の `TokoyoApp.ai.chat` は支出せず `FORBIDDEN`、旧予算画面APIは `RUNTIME_UNSUPPORTED`。失敗時は無料のヒントを残す。

## 1. 宣言する（`manifest.json`）

```jsonc
"sdkVersion": 2,
"capabilities": ["identity.read", "ai.chat"],
"ai": {
  "model": "default",          // 既定。速くて安い。上位が要るときだけ "quality"（おおむね 2 倍以上高い）
  "maxOutputTokens": 300,      // 1 回の返事の上限（1〜2000）。§4
  "instructionsKey": "npc",    // ai/npc.md（既定の指示文）
  "schema": null               // Structured Outputs を既定で使うなら "ai/schemas/<名前>.json"
}
```

- モデルの実名は書かない（Platform が差し替える）。書けるのは `default` / `quality` だけ。
- `ai.chat` と `device.camera` / `device.microphone` は**一緒に宣言できない**（顔や声を外へ出す経路を作らない。静的検証の `AI_WITH_CAPTURE`）。
- `ai.chat` を宣言したら `ai` を必ず書く（無いと `AI_PROMPT_MISSING`）。

## 2. 指示文を書く（`ai/<key>.md`）

- ゲームのソースの `ai/` に置く（`godot/` の中ではない）。`kit build` が `dist/ai/` へそのまま写す（`build.mjs` は書かない）。**1 ファイル 8 KiB・8 個まで**、名前は英小文字・数字・`_` `-`（`npc.md` / `merchant.md`）。
- 公開前の検証が DB に写し、**実行時は写しだけ**が使われる。ゲームの中から指示文を渡したり書き換えたりはできない（渡せるのは key だけ）。
- 書くこと: 役（誰として話すか）・口調・**返事の長さ**（「2 文以内」など。短いほど速くて安い）・知っていること（世界の設定・ゲームのルール）・**知らないことには知らないと答える**・話を逸らされたらゲームの話に戻す。
- 書かないこと: 秘密（指示文は遊ぶ人から見えない前提にしない）、ゲームの判定そのもの（§5）。
- 複数の役を出すなら役ごとにファイルを分け、`ai_action.set_action({"kind":"chat", "conversation":..., "message":..., "instructions":"merchant"})` で選ぶ。

## 3. Structured Outputs（選択肢・クエスト・問題を JSON で受け取る）

- `ai/schemas/<名前>.json` に JSON Schema を置き、`schema: '<名前>'` で呼ぶと結果に `json` が付く。
- Schema は **root を `object`**、**全フィールドを `required`**、**`additionalProperties: false`** にする（OpenAI の strict の条件）。任意にしたいフィールドは `["string", "null"]` のように null を許す。
- `json` は**信用しない**。形を確かめてから使い、合わなければ決まった内容に戻す（途中切れのときは `json` 自体が無い）。
- JSON Schema でないファイル・壊れた JSON は静的検証の `AI_SCHEMA_INVALID` で落ちる。

## 4. 費用とトークン

- 1 ターンの費用 = `入力トークン × 入力単価 + キャッシュ読みトークン × キャッシュ単価 + 出力トークン × 出力単価`（1 USD = 100 クレジット）。
  入力は「指示文 + それまでの会話 + 今回の発話」。**単価の正は Platform の `ai_price_list`**（ここに書く数値は 2026-09-26 時点の目安）。
- 目安（`default`、2026-09-26 の単価: 入力 $0.10 / キャッシュ $0.01 / 出力 $0.50 per 1M トークン）:
  入力 1,500 + 出力 150 トークンで **約 0.0225 クレジット**（1,500 × 0.10 / 1,000,000 + 150 × 0.50 / 1,000,000 = 0.000225 USD）。
  実際に使えるのは通常コイン残高の範囲。履歴・出力・単価で費用は変わるため利用回数を保証せず、**無駄に呼ばない**。
- `maxOutputTokens` の決め方: 台詞なら 150〜300、選択肢や短いクエストの JSON なら 300〜600、物語の 1 場面でも 1000 以下。上限に当たると `incomplete: true`（**その分も課金される**）。
- 呼ぶのは**遊ぶ人の操作があったときだけ**。毎フレーム・タイマーで勝手に呼ばない。同時に 1 本・毎分 20 回まで（超えると `RATE_LIMITED`）。
- 同じ遊びの中では同じ `conversation` を使う（Platform が履歴を持つ。App は履歴を送らない）。場面が変わったら別の key にするか `TokoyoApp.ai.reset(key)`。

## 5. 進行を AI に依存させない（必須）

- 勝ち負け・正解・所持品・次のステージへ進めるかは**ゲームのコードが決める**。AI の返事で判定しない（言いくるめられる・毎回違う）。
- AI を呼ぶ場面には**必ず決まった台詞（フォールバック）を用意**し、失敗・拒否・途中切れのときはそれを出して先へ進める。
- 返事を待つ間もゲームは止めない（「考え中…」を出す。ストリーミングなら届いた分から表示）。
- 返事は表示する前に長さを切る（画面からあふれない。`stream: true` なら `token(request_id, text)` シグナルの差分をつないで吹き出しに出す）。

## 6. エラーの見せ方（必ず表示する）

| コード | 起きること | 見せ方 |
|---|---|---|
| `QUOTA_EXCEEDED` | 通常コインが足りない、または安全な利用上限に達した | 無料の台詞へ戻す。本人が購入を選んだ場合だけ共通購入を使い、自動で購入画面を開かない |
| `RATE_LIMITED` | 同時・毎分の上限 | 「少し待ってからもう一度」。自動で連打しない |
| `INVALID_ACTION` | 発話の形が不正、または内容が安全性の検査で止められた（理由は返らない） | 「その言葉には答えられません」+ フォールバックの台詞 |
| `FORBIDDEN` | 本登録でない・年齢確認がまだ・信頼されたHostのAI操作がない・有効な前景Hostがない | フォールバックの台詞。通常のHost操作だけを使い、背景の自動呼出しや自動再試行はしない |
| `INTERNAL` | Platform / AI の都合 | 「うまく聞き取れなかった」+ フォールバックの台詞。`retryable` なら「もう一度」 |

エラーの台詞もその作品の口調で書いてよいが、**何が起きたかは分かるように**する（黙って何も出さない、は不可）。

## 7. ゲームの外で済むこと（ゲームに書かない）

- **匿名の人は `ai.chat` を宣言した App を開けない**。Host が本登録を案内する（ゲームが起動する前）。
- 本登録でも**初回は年齢の確認**（13 歳以上 / 18 歳未満は保護者の同意）を Host が出し、済むまでゲームは起動しない。
- AIの支出は通常のHost所有ボタンの本人操作で開始する。ゲーム別の許可・予算画面や常設消費HUDは不要。年齢確認・第三者AIへの送信同意は別の共通要件として維持する。
- だから App の中に「ログインしてください」「年齢を入力してください」を作らない。

## 8. チェック

- [ ] `capabilities` に `ai.chat`、`ai` の 4 項目、`ai/<instructionsKey>.md` が Artifact に入っている（ビルドで `dist/ai/` へ写す）
- [ ] 指示文に役・口調・返事の長さ・知らないときの答え方がある。8 KiB 以内
- [ ] AI を呼ぶ全部の場面にフォールバックの台詞がある。AI の返事で勝敗・正解を決めていない
- [ ] エラーをフォールバックで扱う。`QUOTA_EXCEEDED`/Host操作がない時は無料の代替を示し、自動のコイン購入・追加・確認連打をしない
- [ ] 呼ぶのは操作があったときだけ。`maxOutputTokens` は用途に合った小さい値
- [ ] `stream: true` なら届いた分から表示し、失敗したら出した差分を消してフォールバックに差し替える
- [ ] `device.camera` / `device.microphone` を宣言していない
- [ ] ログイン・年齢確認・購入の画面をゲームの中に作っていない
