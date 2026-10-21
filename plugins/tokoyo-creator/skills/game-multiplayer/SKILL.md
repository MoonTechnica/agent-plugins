---
name: game-multiplayer
description: Godotの2〜8人オンライン対戦を作る。既存Spaceサーバーを正としてTokoyoSpaceから参加・入力・状態同期・切断復帰・決着を扱う。multiplayer・versus・対戦・協力と明示された遊びで使う。
---

# Godotオンライン対戦

`$game-godot`も読む。最小例は`<kit>/sdk/sample-godot-multiplayer/`。
Godotの描画・入力を既存Platform Spaceへ接続する。ルール・手番・勝敗はサーバーが決める。
GodotのRPC/ENet・独自WebSocket・直接HTTP・独自認証でPlatformを迂回しない。

## ソースとビルド

| ファイル | 役割 |
|---|---|
| `server/main.ts` | `@workspace/app-server-sdk`の`defineSpace`をdefault export。状態・入力・step・参加/離脱・決着。正本は`app-server-sdk/spec.md` |
| `godot/main.gd`・scene | 描画・入力・HUD。TokoyoSpaceのJSON状態を描く |
| `godot/tokoyo_space.gd` | 提供されたWeb/native facade。`project.godot`の`TokoyoSpace="*res://tokoyo_space.gd"`を維持する |

サーバーのルールと調整値は純粋関数へ分離し、権威ある判定をGDScriptにも複製しない。
`kit build`がWeb/nativeのPCK、固定`app.bundle.js`と`server.bundle.js`を作る。
ゲームのpackage.jsonにKitの`@workspace/app-sdk`と`@workspace/app-server-sdk`依存を維持する。
サーバーJSをPCKやネイティブHostで評価しない。ネイティブはサーバーの状態/入力の型情報から復元する。

```json
"space": {
  "server": "server.bundle.js",
  "participants": { "min": 2, "max": 2 },
  "maxDurationSec": 120,
  "practice": false
},
"capabilities": ["identity.read", "space.connect"]
```

人数は2〜8。依頼からmin/maxを決め、全人数で成立させる。非対称・チーム戦は`participants.roles`と`player.role`を使う。
slotは1起点（0は空）。ネイティブの練習シミュレーションは未対応なので、Web/native共通ゲームは`practice:false`にする。
CPU練習を実装済みと説明しない。招待・マッチング・待機室は既存Platformが用意する。

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

サーバーに数値/真偽値の`input` schemaと`step(ctx)`を定義する。
入力の中立値は数値`0`/真偽値`false`にし、schemaのdefaultもこの値に揃える。型反射では独自default値は送られないため、Hostは未初期化入力とpause時にこの中立値を使う。
Godotは最新操作を`TokoyoSpace.send_input({"moveX": axis, "attack": pressed})`で渡す。
Hostが最新入力を集約してサーバーtick間隔で送る。`send_message`はボタン・アイテム・降参など一回きりの操作に限定する。
既存の4KiB/60通毎秒制限を守る。数値は有限で範囲内へ丸め、サーバー側も不正値を捨てる。

サーバーが送った位置・向きから描画する。必要ならGodotで短いスナップショット履歴を持ち、表示だけを補間する。
teleport/respawnでは履歴をリセットする。勝敗・被弾・スコアを表示予測から確定しない。
**このfacadeはJSのPredict.reconciler/rollbackを公開しない。Godot物理とサーバー物理の決定的一致を前提にしない。**
高速対戦は入力遅延と補間遅延を実測し、作品固有の表示予測を必要時だけ別途検証する。
攻撃の予備動作と判定幅を通信遅延に合わせ、1フレーム目押しを勝敗の必須条件にしない。

サーバー物理が必要なら既存`app-server-sdk/physics`（3D Havok）または固定Rapier 2Dを使う。
サーバーの実装であり、Godot描画側へBabylon/Phaser/Rapierを追加しない。
物理Sceneは卓ごとに分離し、数値の位置/四元数/速度だけを同期、終了時に破棄する。

## サーバーの不変条件

- schemaの数値・真偽値・文字列は`.default(...)`を指定する。
- 卓の値は`ctx.state`、秘密はstateをキーにしたWeakMapと本人向け`ctx.send`へ置く。モジュール共有の可変状態を作らない。
- `onMessage`は形・範囲・手番・重複・終了済みを検査する。入力も信用しない。
- stepは`ctx.dt`・入力・seed付き状態で進める。`Date.now`・`Math.random`・timerを使わない。
- tickRateは通常20〜30。残り時間を状態に持ち、`maxDurationSec`より前に決着する。
- `ctx.finish({outcomes,ranks?})`を一度だけ呼ぶ。全slotの結果、3人以上は順位も含める。
- 切断猶予後のonLeaveで継続/敗北/終了を決める。再参加のonJoinで秘密情報も再送する。
- 画面の勝敗を成績記録に使わない。結果・認可・参加券・台帳は既存Platform経路を維持する。

## 完了条件

同じArtifactのWebと組み込みネイティブを同じSpaceへ参加させ、両端から入力して同じ状態・手番・席・決着を確認する。
切断/再接続、pause/復帰、手番違反・範囲外入力、退出・timeout、終了後の入力も確認する。
同時操作なら位置/向きの補間と入力集約も確認する。export/単体テスト成功を実対戦成功と扱わない。
端末・Simulator/物理端末の区別、Artifact hash、操作、結果、未検証範囲を記録する。
