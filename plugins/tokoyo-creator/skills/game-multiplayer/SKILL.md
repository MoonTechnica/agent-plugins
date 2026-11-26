---
name: game-multiplayer
description: Godotの2〜8人オンライン対戦を作る。既存Spaceサーバーを正としてTokoyoSpaceから参加・入力・状態同期・切断復帰・決着を扱う。multiplayer・versus・対戦・協力と明示された遊びで使う。
---

# Godotオンライン対戦

`$game-godot`も読む。最小例は`<kit>/sdk/sample-godot-multiplayer/`。
Godotの描画・入力を既存Platform Spaceへ接続する。ルール・手番・勝敗はサーバーが決める。
GodotのRPC/ENet・独自WebSocket・直接HTTP・独自認証でPlatformを迂回しない。

## ソースとビルド（新しいゲームはGodotのサーバー）

対戦のルールは**GDScriptで書き、`server.pck`として書き出す**。Platformが卓ごとにGodotのdedicated serverで実行する。

| ファイル | 役割 |
|---|---|
| `godot/server/rules.gd` | `extends TokoyoRules`。入力の宣言・`setup`・`step`・`on_join`・`on_leave`・`on_message`。権威ある判定はここだけ |
| `godot/main.gd`・scene | 描画・入力・HUD。TokoyoSpaceの状態を描く |
| `godot/tokoyo_rules.gd`・`tokoyo_server.gd`・`tokoyo_space_context.gd` | 提供済み。接続・席・上限・状態の送信・結果の報告を持つ。**編集しない**（`TokoyoServer` autoloadも消さない） |
| `godot/tokoyo_space.gd` | 提供されたWeb/native facade。`project.godot`の`TokoyoSpace="*res://tokoyo_space.gd"`を維持する |

`kit build`がWeb/nativeのPCKと`server.pck`を作る。manifestは次のとおり。

```json
"space": {
  "server": "server.pck",
  "participants": { "min": 2, "max": 2 },
  "maxDurationSec": 120
},
"capabilities": ["identity.read", "space.connect"]
```

```gdscript
extends TokoyoRules

func _init() -> void:
    tick_rate = 20  # 10〜60。通常20〜30

func input_fields() -> Array:  # 入力の宣言。k = "f"（数値）/ "b"（真偽）。中立値をdに置く
    return [{"n": "moveX", "k": "f", "d": 0.0}, {"n": "attack", "k": "b", "d": false}]

func setup(ctx: TokoyoSpaceContext) -> void:
    ctx.state = {"hp": [100, 100], "timeLeftMs": 90000}  # 数・真偽・文字列・配列・Dictionary・Packed*Arrayだけ

func step(ctx: TokoyoSpaceContext) -> void:
    var move := float(ctx.input(1).get("moveX", 0.0))  # 範囲を丸め、不正値を捨てる
    ...
    if ctx.state.timeLeftMs <= 0:
        ctx.finish({1: "draw", 2: "draw"})  # 一度だけ。3人以上はranksも

func on_message(ctx, player: Dictionary, type: String, payload: Variant) -> void:
    ...  # 形・範囲・手番・重複・終了済みを検査する
```

- 規則は`ctx.state`（全員へ送られる）と`ctx.input(slot)`・`ctx.dt`・`ctx.tick`だけで進める。秘密は`ctx.send_to(slot, ...)`で本人へ送り、stateに載せない。
- ルールのインスタンスは**卓ごと**。メンバー変数に卓の値を置いてよい（モジュール共有のstaticは使わない）。
- 乱数は卓ごとの`RandomNumberGenerator`にseedを与える。時刻・`randf()`の大域乱数・`await`・Timerに依存しない。
- 物理は**ノードを作らず`PhysicsServer2D`/`PhysicsServer3D`**で卓ごとのspaceを持つ（`space_create`＋`space_set_active(true)`）。RIDは自動で解放されないので、`_notification(NOTIFICATION_PREDELETE)`でbody・shape・spaceを`free_rid`する。tickごとに位置・速度を数値で`ctx.state`へ入れる。
- サーバーには画面もファイルも外部通信も無い。`OS.execute`・`create_process`・`load`の外部pack・GDExtensionを使わない（`kit check`が検出する）。
- 人数は2〜8。非対称・チーム戦は`participants.roles`と`player.role`。slotは1起点（0は空）。
- Platformの練習モードは無い。CPU練習を実装済みと説明しない。招待・マッチング・待機室はPlatformが用意する。
- 1 Sandboxは約10卓・1 vCPU。物理ありで1卓あたり約0.6%（8人以下・20Hz）が目安。`step`で重い処理（全探索・大きな配列の毎tick生成）を避ける。

## GodotのAPI

```gdscript
func _ready() -> void:
    TokoyoSpace.state_changed.connect(_draw_state)
    TokoyoSpace.players_changed.connect(_draw_players)
    TokoyoSpace.connection_changed.connect(_connection)
    TokoyoSpace.finished.connect(_finish)
    TokoyoSpace.failed.connect(_failure)
    TokoyoSpace.join_space(["notice"]) # 作品固有message名。不要なら引数なし

func choose_cell(cell: int) -> void:
    if TokoyoSpace.connected and int(TokoyoSpace.state.get("turn", 0)) == TokoyoSpace.slot:
        TokoyoSpace.send_message("move", {"cell": cell})
```

- `join_space(message_types=[])`は非同期。`joined`後に`slot`・`mode`・`state`・`players`・`connected`・`input`を利用できる。
- `state_changed(Dictionary)`がサーバー状態。配列はArray、mapのキーは文字列として読む。
- `players_changed(Array)`で名前・役割・接続中かを表示し、自分のslotには「あなた」を付ける。
- `message_received(type,payload)`はjoin時に列挙した作品固有messageを受信する。Platform予約messageを購読しない。
- `connection_changed(false)`では再接続中を表示して操作を止める。SDKが復帰し、trueで現在状態から描き直す。
- `finished(Dictionary)`の`outcomes[str(TokoyoSpace.slot)]`がwin/lose/draw。`ranks`は1位=1、同順位可。
  `outcomes:null`なら結果なし終了として表示し、勝敗を捏造しない。
- `failed(code,message)`は作品のUIに表示する。加入失敗は再試行、進行中の失敗は退出導線を用意する。
- `leave_space()`は明示退出。scene切替だけでは自動退出しないため、ゲーム全体の終了操作で呼ぶ。
- 切断・pause中は入力を止める。バックグラウンド復帰後は最新状態を確認する。

## 同時操作と物理

サーバーに`input_fields()`（数値`f`/真偽値`b`）と`step(ctx)`を定義する。
入力の中立値は数値`0`/真偽値`false`にし、宣言の`d`もこの値に揃える。Hostは未初期化入力とpause時にこの中立値を使う。
Godotは最新操作を`TokoyoSpace.send_input({"moveX": axis, "attack": pressed})`で渡す。
Hostが最新入力を集約してサーバーtick間隔で送る。`send_message`はボタン・アイテム・降参など一回きりの操作に限定する。
既存の4KiB/60通毎秒制限を守る。数値は有限で範囲内へ丸め、サーバー側も不正値を捨てる。

サーバーが送った位置・向きから描画する。必要ならGodotで短いスナップショット履歴を持ち、表示だけを補間する。
teleport/respawnでは履歴をリセットする。勝敗・被弾・スコアを表示予測から確定しない。
**このfacadeはJSのPredict.reconciler/rollbackを公開しない。Godot物理とサーバー物理の決定的一致を前提にしない。**
高速対戦は入力遅延と補間遅延を実測し、作品固有の表示予測を必要時だけ別途検証する。
攻撃の予備動作と判定幅を通信遅延に合わせ、1フレーム目押しを勝敗の必須条件にしない。

サーバー物理は上記の`PhysicsServer2D/3D`。Godot描画側へBabylon/Phaser/Rapierを追加しない。
物理は卓ごとに分離し、数値の位置/四元数/速度だけを同期、終了時に破棄する。

## サーバーの不変条件

- `input_fields()`の項目は`d`（既定値）を必ず書く。範囲外・不正値は`step`で丸めるか捨てる。
- 卓の値は`ctx.state`とルールのメンバー変数に置く。秘密は`ctx.send_to`で本人へ送り、stateに載せない。
  `ctx.state`に入れてよいのは数・真偽・文字列・配列・Dictionary・Packed配列だけ（Vector2・Object・NaN・無限大は送れない）。256KiBまで。
- `on_message`は形・範囲・手番・重複・終了済みを検査する。入力も信用しない。
- `step`は`ctx.dt`・入力・seed付き状態で進める。`Time`・大域の乱数・`await`・Timerを使わない。
  乱数は**`ctx.seed`（サーバーが卓ごとに渡す）を`RandomNumberGenerator.seed`へ入れて**使う。`randi()`・`randomize()`・時刻で種を作らない（再現も再生検証もできない）。
- `tick_rate`は通常20〜30。残り時間を状態に持ち、`maxDurationSec`より前に決着する。
  `maxDurationSec`に達すると、Platformが結果なし（`outcomes:null`・timeout）で終わらせる。
- **時計は卓の登録から進む**（`setup`は席が埋まる前に呼ばれ、`step`も参加を待たない）。カウントダウン・制限時間・「全員そろったら開始」は、`on_join`で参加席を数えて、そろってから動かす。
- `ctx.players[i].connected`が接続中かを表す。`on_leave`は**切断から60秒の猶予後**にしか呼ばれないので、アバターを即座に消す処理は`connected`を見て`step`で行う。
- `ctx.finish(outcomes, ranks?, scores?)`を一度だけ呼ぶ。`outcomes`のキーは**整数の席番号**で、全slotに`"win"`/`"lose"`/`"draw"`を入れる。3人以上は順位（`ranks`。同順位は同じ値）も含める。
  `scores`は`{席: {ランキング名: 数値}}`で、manifestの`leaderboards`に宣言した名前だけが記録される。
- 切断猶予後の`on_leave`で継続/敗北/終了を決める。再参加の`on_join`で秘密情報も再送する。
- 画面の勝敗を成績記録に使わない。結果・認可・参加券・台帳はPlatformの経路を維持する。
- 直線の弾のような単純な動きは、物理サーバーを使わず数式でよい（`Geometry2D`など）。`PhysicsServer`を使うなら終了時にRIDを解放する。

## サーバーのルールの自己試遊

`<kit>/skills/game-playtest/assets/`の`playtest_server.gd`と`playtest_server.sh`を`scripts/`にコピーし、`scripts/playtest_server.sh`を実行する
（席数を変えるときは`scripts/playtest_server.sh res://server/rules.gd 4`）。書き換えは要らない。`playtest_rules.gd`は1人用のstatic関数のルール用で、`TokoyoRules`には使えない。
状態が送れる形か・極端な入力・決着の形（全席分・1回だけ）・離脱・変なmessageで壊れないかを、実サーバーと同じ順（`setup`→`on_join`→`step`）で確かめる。
**`SCRIPT ERROR`が1行でも出たら失敗**（GDScriptの実行時エラーはGodotを止めない）。`.sh`はそこまで見て終了コードにする。
画面側の`main.gd`のパースエラーは、サーバーが`--path`でプロジェクト全体を読むと出るだけで、サーバー検査は通る。`main.gd`も別に起動して確かめる。
`_draw`・`_process`・`_input`などはGodotの予約名なので、自作の関数名に使わない（`_draw_state`のように別名にする）。

## 完了条件

同じArtifactのWebと組み込みネイティブを同じSpaceへ参加させ、両端から入力して同じ状態・手番・席・決着を確認する。
切断/再接続、pause/復帰、手番違反・範囲外入力、退出・timeout、終了後の入力も確認する。
同時操作なら位置/向きの補間と入力集約も確認する。export/単体テスト成功を実対戦成功と扱わない。
端末・Simulator/物理端末の区別、Artifact hash、操作、結果、未検証範囲を記録する。
