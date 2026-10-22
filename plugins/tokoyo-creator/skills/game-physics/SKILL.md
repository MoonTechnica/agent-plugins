---
name: game-physics
description: Godotのローカル物理とSpaceの権威あるサーバー物理を分離する。固定tick・入力検査・状態同期・補間・卓終了時の解放を扱う。
---

# Godot物理と対戦サーバー

`$game-godot`、対戦なら`$game-multiplayer`も読む。ゲームの2D/3D描画とローカル物理はGodot 4.5.1。
CharacterBody2D/3D・RigidBody2D/3D・Area2D/3Dを用途で選び、`_physics_process(delta)`で進める。
描画frameと物理tickを混ぜない。collision layer/maskを対象別に分離し、シーン離脱時は`queue_free()`する。
Godot公式の固定版API定義を確認し、高速体の連続衝突・接地・積み重ね・復帰を実描画で確認する。

## 権威あるサーバー物理

Spaceの認可・参加・結果は既存Platformを維持する。ルールは`server/main.ts`の`defineSpace`へ書く。
3Dは`@workspace/app-server-sdk/physics`のBabylon NullEngine + Havok、2Dは固定Rapier deterministic 0.21.0。
これはheadless CPU物理であり、Godot側へJSエンジンを追加するための依存ではない。
APIの正本は`<kit>/sdk/app-server-sdk/spec.md`と同梱型。

- 3DのHavok初期化はSpace Server loaderが所有する。ゲームからWASMをfetchしない。
- `createPhysicsScene(gravity, timestep)`を卓ごとに作る。ノードはTransformNode、shapeは明示してMeshの境界へ依存しない。
- `step(ctx)`から`stepPhysics(scene, ctx.dt)`を一回呼ぶ。描画側やtimerで進めない。
- 数値の位置・四元数・速度だけをstateへ写す。内部Scene/bodyをstateへ入れない。
- SceneはstateをキーにしたWeakMapへ持ち、勝敗・退出・終了時に`disposePhysicsScene(scene)`でbody/shape/engineも破棄する。
- Rapier worldは卓ごとに作り、固定tickでstepし、終了時に`world.free()`する。
- 全入力の型・有限値・範囲・手番・終了済みをサーバーで検証する。時間はctx.dt、乱数はseed付き状態から作る。

`TokoyoSpace`が送るサーバー状態からGodotで描画し、表示だけを補間する。
GodotとHavok/Rapierは同じ物理結果になるとは限らない。クライアント予測・reconciler/rollback・練習モードは提供しない。
補間した表示位置から被弾・勝敗・成績を確定しない。
teleport/respawnでは補間履歴を捨てる。履歴には上限を置く。

## 検証

ルール単体検査に加え、同じArtifactのWebと組み込みnativeを同一Spaceへ接続する。
衝突・高速体・切断復帰・pause/再開・決着・終了後の入力・繰り返し卓作成/破棄を確認する。
入力遅延・物理tick時間・表示frame時間・メモリを同条件で測る。Simulatorと物理端末を区別して記録する。
