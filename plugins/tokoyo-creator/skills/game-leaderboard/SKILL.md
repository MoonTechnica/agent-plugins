---
name: game-leaderboard
description: ゲームにランキング（順位表）を付ける。manifest の leaderboards の決め方（並び・自己ベストか最新か・単位・season と自動リセット・range）、スコアを送る瞬間、自己申告と対戦で確定した記録（verified）の違い、順位表の表示と 5 つの状態、匿名の記録が一覧に出ないこと、10,000 位以下の見せ方を扱う。遊びの説明に「ランキング」「順位」「ハイスコア」「スコアアタック」「タイムアタック」「世界で何位」などがあるときに使う。leaderboard, ranking, high score, time attack, season.
---

# ランキング（`TokoyoApp.leaderboard`）

**API の正本は `<kit>/sdk/app-sdk/spec.md` §8.1**。先に読む。対戦で確定したスコアを載せるなら
`<kit>/sdk/app-server-sdk/spec.md` の `ctx.finish` の `scores` も読む。

順位表は App の中で閉じている（ほかの App と混ざらない）。記録は 1 人 1 行。Platform の App のページにも
同じ順位表が出るので、**App の中に順位表を作らなくても順位は見られる**。作るなら App の見た目で描く。

## 1. ボードを決める（`manifest.json` の `leaderboards`）

| 項目 | 決め方 |
|---|---|
| 名前（キー） | 何を競うかの英小文字（`score` / `time` / `distance`）。1 つの遊びで 1〜3 個が目安（最大 8） |
| `order` | 大きいほど良い（点数・距離）なら `"desc"`、小さいほど良い（タイム・手数）なら `"asc"` |
| `keep` | **既定は `"best"`**（自己ベスト）。毎日の記録のように「今の値」を競うときだけ `"latest"` |
| `unit` | `point` / `second`（タイムは秒。小数可）/ `meter` / `count` / `custom` |
| `season` | 既定 `"s1"`。**ルールや難しさを変えて前の記録と比べられなくなったら `"s2"` に上げる**（前の記録は消えずに別のボードになる） |
| `reset` | 既定 `"never"`。「今週のランキング」「今月の」が遊びにあるときだけ `"weekly"` / `"monthly"`（UTC で切り替わる） |
| `range` | **必ず書く**。その遊びで取りうる最小〜最大（理論上の最高点に少し余裕）。範囲外は受け付けられない（改造した画面からの大きすぎる値を止める粗い防波堤） |
| `verifiedOnly` | オンライン対戦のスコアだけで競うときに `true`（§3）。ソロの遊びでは `false` |

`capabilities` に `leaderboard.read`（見る）と `leaderboard.write`（送る）を足す。ボードを書いたのに
Capability が無い、または逆は静的検証が落とす。`sdkVersion` は `2`。

## 2. スコアを送る瞬間

- **1 回の遊びが終わったとき（リザルト画面に入るとき）に 1 回だけ** `TokoyoApp.leaderboard.submit(board, score)` を呼ぶ（契約は `app.leaderboard.submit`。結果は最後の `Callable` に `(ok, result_or_code)` で返る）。
  プレイ中に毎フレーム・毎得点で送らない（**毎分 12 回まで**。超えると `RATE_LIMITED`）。
- `requestId` は省いてよい（SDK が振り、届かなければ同じ id で送り直す）。自分で送り直すなら、同じ遊びの
  結果には**同じ `requestId`** を使う。
- `score` は有限の数。`NaN` や `Infinity` を送らない。タイムは秒（`12.34`）で送り、表示で整える。
- `payload` は表示の補助（使ったキャラ・コースなど）だけ。1 KiB まで。個人情報を入れない。
- 結果の `accepted` が `false` なら自己ベストを超えなかった。リザルトに「自己ベスト更新！」を出すのは
  `accepted === true` のときだけ。`rank` は今の順位（`null` は 10,000 位より下）。
- 送るのに失敗しても遊びは止めない。リザルトに「記録を送れませんでした」を出し、「もう一度送る」で同じ
  `requestId` を使って送り直せるようにする。

## 3. 自己申告と `verified`

- ソロの遊びのスコアは画面が計算するので、**改造すれば偽れる**（自己申告）。`range` で極端な値は止まるが、
  それ以上は止められない。順位表では `verified: false` の記録として出る。
- オンライン対戦（`$game-multiplayer`）の勝ち点・タイムは、サーバーの定義が `ctx.finish({ outcomes, scores })` の
  `scores`（slot → ボード → 数値）で送る。これは Platform が確定した記録（`verified: true`）として載り、
  画面から `submit` する必要は無い（してはいけない。`verifiedOnly` のボードへの `submit` は `FORBIDDEN`）。
- 対戦のスコアで競うボードは `verifiedOnly: true` にする。ソロと対戦で同じボードを使わない。
- 表示では `verified` の記録に印（チェックなど）を付けると、見る人が区別できる。

## 4. 順位表を描く

- 1 ページは `list(board, { limit: 20 })`。続きは「もっと見る」ボタンで `nextCursor` を渡して足す
  （`nextCursor` が `null` なら末尾）。**全件を一度に取らない**（`limit` は 50 まで）。
- 自分の位置は `me(board)`（無ければ `null` = まだ記録が無い）と `aroundMe(board, 3)`（自分の前後）。
  `rank` が `null` なら `rankOver`（10000）を使って「10,000 位以下」と出す。
- 各行は `rank`・`displayName`（空なら「名無し」など）・`score`（`unit` に合わせて整える）・アバター。
  facade（`TokoyoApp.leaderboard`）経由では `avatarUrl` は常に `null` なので、`displayName` の頭文字の丸などで描く。自分の行（`self`）は色を変える。
- **5 つの状態を全部作る**:

| 状態 | 見せ方 |
|---|---|
| 読み込み中 | 行の形の骨組み（点滅でよい）。前の表示を消さない |
| 追加の読み込み中 | 「もっと見る」の位置に小さな読み込み表示 |
| 空 | 「まだ記録がありません。最初の 1 人になろう」と遊びへ戻る導線 |
| エラー | 「順位表を読み込めませんでした」と「もう一度」ボタン（`retryable` なら少し待ってから） |
| 末尾 | 「ここまで」の表示（「もっと見る」を消す） |

- **匿名で遊んでいる人の記録は一覧に出ない**（本人の `me()` / `aroundMe()` には出る）。自分の記録が
  一覧に無いときは「ログインすると順位表に載ります」と案内する（責めない書き方で）。

## 5. チェック

- [ ] `manifest.json` に `leaderboards`（`order` / `range` を含む）と `leaderboard.read` / `leaderboard.write`
- [ ] `submit` は 1 回の遊びの終わりに 1 回だけ。失敗しても遊びが止まらない
- [ ] 自己ベスト更新の表示は `accepted` を見ている
- [ ] 順位表を作るなら 5 つの状態と「10,000 位以下」、`avatarUrl` が `null` のときの代わりの絵がある
- [ ] 対戦のスコアはサーバーの `scores` で送り、画面から `submit` していない
