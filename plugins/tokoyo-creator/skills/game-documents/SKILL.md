---
name: game-documents
description: 相手と同時にいなくても進むゲーム（非同期対戦）と、時間をまたいで複数の人が持つ場を作る（TokoyoApp.documents。契約は app.documents）。documentSchema の決め方（members・write・read・join・maxBytes・ttlDays）、手番制、REVISION_CONFLICT の読み直し、subscribe と changed シグナル、招待とマッチング、決着（finish）、秘密を場に置かないこと、匿名の人の扱いを扱う。遊びの説明に「通信対局」「1 日 1 手」「交代で」「攻め合い」「友達の記録に挑戦」「みんなで育てる世界」などがあるときに使う。async multiplayer, turn-based, correspondence, shared world.
---

# 非同期対戦と共有の場（`TokoyoApp.documents`）

**API の正本は `<kit>/sdk/app-sdk/spec.md` §8.2**。先に読む。GDScript からは `TokoyoApp.documents` の facade を使う
（`create` / `join_open` / `fetch` / `list` / `update(record_id, patch, expected_revision)` / `finish` / `leave` / `subscribe` / `unsubscribe` /
`launch_record_id`。最後の引数の `Callable` に `(ok, result_or_code)` が返る。`$game-godot`）。下の文中の `joinOpen` / `get` / `onChange` /
`launchRecordId` は契約の名前で、facade ではそれぞれ `join_open` / `fetch` / `subscribe` + `changed` シグナル / `launch_record_id`。

場（Document）は App の中で閉じた 1 レコードで、**メンバー**（席に座った人）が時間をまたいで読み書きする。
Platform が守るのは「誰が読めるか・書けるか」「形（Schema）」「大きさ」「版（`revision`）」「手番」だけ。
**ルールと勝ち負けは画面（App）が判定する**。サーバーで App のコードは動かない。

| 置き場 | 何を置くか |
|---|---|
| Store（`TokoyoApp.save`） | その人だけのもの（設定・所持品・**相手に見せない手札**） |
| `TokoyoSpace` | 同時にいる人の状態（リアルタイム対戦。`$game-multiplayer`） |
| `TokoyoApp.documents` | **時間をまたいで複数人が持つもの**（通信対局の盤・攻め合いの拠点・挑戦の記録・協力して育てる世界） |

## 1. 形を選ぶ（`manifest.json` の `documentSchema`）

遊びに合う形を 1 つ選ぶ（複数のコレクションを持ってもよい。8 個まで）。

| 形 | 例 | Schema の要点 | 流れ |
|---|---|---|---|
| **1 対 1 のターン制** | チェス・将棋・オセロ・五目並べ | `members: { min: 2, max: 2 }`、`write: "turn"`、`join: "open"`（知らない人と）か `"invite"`（友達と） | `joinOpen` → 無ければ `create` → 相手が入ると `active` → 自分の番に `update(record_id, {"board": ..., "turn": 相手の席}, expected_revision)` → 決着で `update` のあと `finish` |
| **非同期の攻め合い** | 放置して拠点を攻め合う・塔の防衛と襲撃 | `members: { min: 2, max: 8 }`、`write: "member"` | 各自が好きなときに `update`。**自分の領域のキーだけ書く**（`{ players: { "2": {...} } }`）。衝突は `REVISION_CONFLICT` → 読み直し |
| **記録に挑戦** | 友達のスコア・ゴーストに挑む | `members: { min: 1, max: 8 }`、`read: "app"`、`write: "owner"` | 作った人が `create` してリプレイを置く。他の人は `list(collection, { open: true })` で探して読むだけ。挑んだ結果は各自の `TokoyoApp.leaderboard.submit()`（`$game-leaderboard`） |
| **協力して育てる世界** | みんなで建てる村・共有の畑 | `members: { min: 1, max: 8 }`、`write: "member"`、`maxBytes: 1048576`、`ttlDays: 365` | 世界の**差分**（seed + 変えたところ）だけを置く。一緒に遊ぶ間はリアルタイム対戦（`TokoyoSpace`）で同期し、終わるときに場へ書き戻す |

| 項目 | 決め方 |
|---|---|
| コレクション名 | 英小文字（`matches` / `raids` / `worlds`）。`^[a-z][a-z0-9_]{0,31}$` |
| `fields` | `storeSchema` と同じ型（`string` / `number` / `boolean` / `object` / `array` / `blob`）か `json`（形を縛らない）と既定値。盤や世界のように形が込み入るものは `json` にして、**読むときに画面で形を確かめる**（§4）。**`create` / `update` で書くキーは全部ここに宣言する**（宣言していないキーは `INVALID_ACTION`。決着の `winner` も） |
| `members` | 遊べる人数（1〜8）。`min` がそろうまで `open`（募集中）、そろうと `active` |
| `roles` | 先手・後手のように役割の名前が遊びに要るときだけ。無ければ**席番号（1 起点）**で区別する |
| `write` | `turn`（手番の席の人だけ。ターン制）/ `member`（誰でも。既定）/ `owner`（作った人だけ） |
| `read` | 既定 `member`（メンバーだけ）。公開の一覧から選ばせるときだけ `app` |
| `join` | 既定 `invite`（招待リンクだけ）。知らない人と遊ぶ（非同期のマッチング）なら `open` |
| `maxBytes` | 既定 64 KiB。足りないときだけ上げる（上限 1 MiB）。**履歴を無限に積まない**（最後の数手だけ残す） |
| `ttlDays` | 最後に書いてから何日で終わりにするか（既定 30、最大 365）。1 日 1 手の遊びなら 14〜30 |

`capabilities` に `documents.read`（読む）と `documents.write`（作る・入る・書く）を足す。`sdkVersion` は `2`。
フィールドは**足すだけ**。削る・名前を変える・型を変えるときは `documentSchemaVersion` を上げる（静的検証が見る）。

## 2. 手番制（`write: "turn"`）の規律

- `fields.turn`（`number`。今の手番の**席番号**）が要る。既定値は先手の席（ふつう `1`）。
- **自分の番の人だけ**が `update` できる（ほかは `FORBIDDEN`）。1 回の `update` で `turn` を**自分以外の、今も座っている席**に
  変えなければならない（同じ席のままや空いた席は `INVALID_ACTION`）。「1 手 = 1 回の `update`」にする。
- 定員がそろう（`status: 'active'`）まで最初の手は打てない。`open` の間は「相手を待っています」と出す。
- 手を打つ前に**画面で合法手かを確かめる**（ルールの関数は純粋関数にしてファイルを分ける）。改造した画面からの
  書き込みは Platform では止まらないので、**読むときも形と中身を確かめ**、壊れていたら「この対局は続けられません」と出す。
- 決着の手は `update(record_id, {"board": ..., "turn": 相手, "winner": ...}, expected_revision)` で盤を書いてから、返ってきた `revision` を使って
  `finish(record_id, revision, {"winner": ...})` する。

## 3. 書き込みと衝突（`REVISION_CONFLICT`）

- 書くときは必ず `expectedRevision`（最後に読んだ `revision`）を渡す。違えば `REVISION_CONFLICT` になる——
  **`get` で読み直し、画面を描き直してから**（手番制なら「相手が先に指しました」）もう一度操作させる。黙って上書きしない。
- `update` の `patch` は JSON Merge Patch（オブジェクトは入れ子まで合わさる、`null` はキーを消す、配列は丸ごと置き換え）。
  `write: "member"` の形では、**他の人のキーに触れない patch** にすれば衝突しても読み直して同じ patch を送れる。
- `requestId` は省いてよい（SDK が振り、届かなければ同じ id で送り直す）。
- 書く回数は**毎分 30 回まで**（`RATE_LIMITED`）。ドラッグ中などに書かない。手を確定したときだけ書く。
- 場を作るのは**毎時 30 回まで**（超えると `RATE_LIMITED`。少し待って作り直す）、**参加中の場は同時に 20 件まで**（超えると `QUOTA_EXCEEDED`）。
  `QUOTA_EXCEEDED` なら「終わった対局を片付けてください」と自分の一覧を出す（`leave` で抜けられる）。

## 4. 変化を知る（`subscribe` と `changed`）と起動

- 起動したら**最初に `TokoyoApp.documents.launch_record_id()`** を見る。招待リンク・「続きから」から来たときはその場の id が入っている。
  あればその場を開き、無ければタイトル（自分の場の一覧 `list(collection)` と「相手を探す」「友達を誘う」）を出す。
- 場を開いている間は `subscribe(record_id)` して `changed(record_id, revision, kind)` シグナルを受け、届いたら `fetch` で読み直して描き直す（通知に中身は載らない）。
  画面を離れるときは `unsubscribe(record_id)` する。通知は届かないことがあるが、SDK が 60 秒ごとに `revision` を確かめて知らせるので、
  **自前のポーリングは書かない**。
- `kind` が `left` なら相手が抜けた。どう扱うか（勝ちにする・待つ）は遊びで決め、終わらせるなら `finish` する。
- ページを開いていない相手には Platform がベルで「あなたの番です」を知らせる（App が通知を送る API は無い）。

## 5. 招待とマッチング

- 知らない人と: `join_open(collection)` で空き席に入る。**`null` なら `create(collection, 初期データ)`** で新しく立てて待つ。
- 友達と: `create` のあと `TokoyoApp.ui.open_invite(record_id)` で Platform の招待画面を出す
  （招待の URL を App が作ったり表示したりしない）。
- **匿名の人は場を作れず `join_open` もできない**（`FORBIDDEN`）。招待リンクから来た場には入れる。
  `FORBIDDEN` を受けたら「ログインすると相手を探せます。友達の招待からなら今すぐ遊べます」と案内する（責めない書き方で）。

## 6. 置いてはいけないもの・Platform がしないこと

- **秘密の情報を場に置かない**。メンバーは全員 `data` を読める。相手に見せない手札・伏せたカード・隠した配置は本人の
  Store（`TokoyoApp.save`）に置き、**見せる時点で場へ写す**。
- 名前・メールなどの個人情報を `data` に入れない（表示名は `fetch` の `members[].displayName` を使う）。
- **勝ち負けは Platform の対戦成績に入らない**（画面の判定なので）。順位を残すなら各自が `TokoyoApp.leaderboard.submit()` する。
- `finish` した場には書けない（`INVALID_ACTION`）。結果の画面を出し、「もう一局」は新しい場で始める。
  最後に書いてから `ttlDays` 日たった場は `finished`（`result` は `{ reason: 'timeout' }`）になるので、その表示も用意する。

## 7. 画面（5 つの状態）

自分の場の一覧（`list(collection)`。20 件ずつ、続きは「もっと見る」で `nextCursor`）と、場を開いた画面の両方で:

| 状態 | 見せ方 |
|---|---|
| 読み込み中 | 盤や一覧の形の骨組み。前の表示を消さない |
| 空 | 「まだ対局がありません」と「相手を探す」「友達を誘う」 |
| エラー | 「読み込めませんでした」と「もう一度」（`retryable` なら少し待ってから） |
| 待ち | `open`（相手を待っている）・相手の番（「相手の番です。来たらお知らせします」） |
| 決着 | 勝ち・負け・引き分け・時間切れ（`result.reason === 'timeout'`）と「もう一局」 |

自分の番は色や動きで目立たせる（一覧でも `myTurn` の場を上に）。

## 8. チェック

- [ ] `manifest.json` に `documentSchemaVersion` / `documentSchema` と `documents.read` / `documents.write`、`sdkVersion: 2`
- [ ] 手番制なら `fields.turn` があり、1 回の `update` で `turn` を相手の席に変えている
- [ ] `create` / `update` で書くキー（`winner` など）が全部 `fields` に宣言してある
- [ ] 書くたびに `expectedRevision` を渡し、`REVISION_CONFLICT` で読み直している
- [ ] 起動時に `launch_record_id()` を見ている。`subscribe` / `changed` で読み直し、自前のポーリングが無い
- [ ] `join_open` が `null` のとき `create` している。匿名の `FORBIDDEN` を案内している
- [ ] 秘密の情報・個人情報を場に置いていない。読んだ `data` の形を確かめている
- [ ] 決着は `update` → `finish`。`finished`（時間切れを含む）の表示がある
