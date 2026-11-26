# 3D のキャラを動かす（AI モーション・AnimationTree・足滑り・ルートモーション・IK）

目次: 1 クリップの集め方 / 2 AnimationTree の組み方 / 3 移動と足を合わせる / 4 ルートモーション / 5 手続きの足し算（視線・揺れ・IK）/ 6 検査

Godot 4.5.1 の範囲で書く。**4.5.1 に `TwoBoneIK3D` は無い**（4.6 から）。`SkeletonIK3D` は非推奨。
手足の IK が要るときは §5 の代わりの方法を使う。

## 1. クリップの集め方

### 1.1 どこから取るか

| クリップ | 第一候補 | 次 |
|---|---|---|
| 待機・歩き・走り・跳び・着地・被弾・死亡（人型） | アニメ付きのフリー素材（`search_stock_assets`。Quaternius UAL など。全部が同じ骨格でそろっている） | Meshy / Tripo のプリセット（`animate_model_3d`） |
| 固有の攻撃・技・感情の一発もの（人型） | `generate_motion`（HY-Motion）→ リターゲット | Blender でキー |
| 四足・多足・蛇・水棲の移動 | `rig_model_3d` → `animate_model_3d`（Tripo。プリセットは 5 個まで、`animate_in_place` で その場） | Blender |
| 人型以外の攻撃・待機 | Blender で 3〜4 姿勢 + 補間 | — |

**同じキャラのクリップは 1 つの骨格にそろえる**。違う出どころのクリップは `$game-3d-studio` §4.3.1 の手順で
同じ骨格（Godot の `SkeletonProfileHumanoid` の名前）へリターゲットしてから使う。

### 1.2 `generate_motion`（HY-Motion）の頼み方

- 指示は**英語、60 語以内**。体の部位と動きで書く: `"A person steps forward with the right foot and swings a sword
  diagonally from upper left to lower right with both hands, then returns to a guard stance."`
- 向き・速さ・力の入り方（`slowly`, `powerfully`, `staggers back`）を入れる。感情や物語の説明は効かない。
- **苦手**: ループ（歩きの周期）、その場で止まる動き、人型以外、物を持つ手の細かい形、2 人の絡み。これらは 1.1 の別の手を使う。
- 長さは 2〜5 秒。30fps で出る。攻撃なら前後に構えの姿勢を入れて頼むと、遷移で切りやすい。
- 候補を 2〜3 本出して選ぶ。足が地面に刺さる・浮く・関節が逆に曲がるものは捨てる。

### 1.3 整形の順番（どの出どころでも）

1. **大きさと基本姿勢**: 取り込みで縮尺をそろえ、`Retarget > Rest Fixer` の **Fix Silhouette**（A ポーズの素材を T ポーズの骨格に合わせる）、
   **Normalize Position Tracks**（身長差で足が浮く・沈むのを直す）を有効にする。
2. **リターゲット**: `BoneMap` に `SkeletonProfileHumanoid` を当て、名前を共通にする。
3. **足を地面に**: 接地中の足が動く・刺さるなら、Blender で足のキーを固定するか、§5 の足の補正を使う。
4. **ならす**: AI モーションの細かい震えはキーを間引く・曲線をならす。**当たる瞬間のキーはならさない**（打撃の鋭さが消える）。
5. **ループ**: ループするクリップは先頭と末尾の姿勢を合わせ、`loop_mode = LOOP_LINEAR`。最後のフレームが最初と同じならそのフレームを消す。
6. **その場か、移動か**: ゲームの移動をコードで行うなら、腰（ルート）の前進を消してその場にする。
   アニメの移動を使うならルートモーション（§4）。どちらにするかをクリップごとに決め、`design/motion.md` に書く。
7. 取り込み設定は `.glb.import` の `_subresources`（アニメの名前・ループ・保存先）で固定し、手で毎回直さない。

## 2. AnimationTree の組み方

`AnimationTree` の `tree_root` に `AnimationNodeStateMachine` を置き、`$game-motion` SKILL.md §2 の対応表から状態を作る。

```
StateMachine
├── Locomotion   (BlendSpace1D: 0=idle, walk_speed=walk, run_speed=run)
├── Jump         (Start → Air → Land)
├── Attack1..3   (一発もの)
├── Hit / Death
└── 上半身の重ね（必要なら BlendTree の Blend2 / OneShot + filter）
```

| 設定 | 値と理由 |
|---|---|
| `callback_mode_process` | **physics**（`CharacterBody3D` の移動と同じ拍で更新） |
| 遷移の `xfade_time` | **既定 0**。必ず設定する（下の表）。0 のままだと姿勢が跳ぶ |
| 遷移の `xfade_curve` | 入りの速い曲線（ease out）。Curve が無ければ線形でよい |
| `BlendSpace1D.sync` | **既定 false → true**。歩きと走りの足の周期をそろえる。クリップの長さと接地フレームを合わせておく |
| `BlendSpace1D.blend_mode` | 補間（既定）。ドット絵調で段を出したいときだけ離散 |
| 状態の移動 | `playback.travel(&"Attack1")`（途中の状態を通る）。即座に切りたい被弾は `playback.start(&"Hit")` |
| 攻撃の連段 | 遷移の `switch_mode = AT_END` + 条件、または `advance_expression`。受付は「操作が戻るフレーム」から |

クロスフェードの出発点（秒）:

| 遷移 | 時間 |
|---|---|
| 待機 ⇄ 移動 | 0.15〜0.25 |
| 移動 → 跳び | 0.05〜0.1（遅いと押してから浮くまでが鈍い） |
| 着地 → 移動 | 0.1〜0.15 |
| → 攻撃 | 入り 0.05〜0.1 / 攻撃 → 待機 0.15〜0.25 |
| → 被弾 | 0〜0.05（即座に） |
| → 死亡 | 0.1〜0.2 |

**上半身だけ別の動き**（走りながら撃つ・振る）: `BlendTree` に `OneShot`（または `Blend2`）を置き、`filters` で
背骨より上の骨だけを通す。`OneShot` は `fadein_time` / `fadeout_time` が**既定 0**なので 0.05〜0.15 を入れる。
発火は `tree.set("parameters/OneShot/request", AnimationNodeOneShot.ONE_SHOT_REQUEST_FIRE)`、止めるのは `ABORT`、
フェードで止めるのは `FADE_OUT`。

アニメに合わせた出来事（判定・音・粒子）は、クリップのメソッドトラックかアニメの `marker` で出す。
コードの `await` で秒数を数えない（再生速度を変えるとずれる）。

## 3. 移動と足を合わせる（足滑りを消す）

足滑り = 接地している足が地面の上を動いて見えること。原因は「移動の速さ」と「クリップの歩幅 × 再生速度」の食い違い。

1. クリップごとに**地面に対する速さ**を測る（1 周期で腰が進む距離 ÷ 周期の秒数。その場のクリップなら、足の接地中の後退速度）。
   `tuning.gd` に `WALK_CLIP_SPEED` / `RUN_CLIP_SPEED` として置く。
2. `BlendSpace1D` の点をその速さに置く（0 / 歩きの速さ / 走りの速さ）。ブレンドの値には実際の水平速度を入れる。
3. 点の間・外では `TimeScale` ノードで再生速度を `実際の速さ / クリップの速さ` にし、**0.7〜1.3 に抑える**
   （それを越えるならクリップを足すか、移動の速さを見直す）。
4. 向きの変更が速いゲームは、体の向きを `Motion.Spring` か `lerp_angle` で追わせ、足が横滑りして見える時間を短くする。

## 4. ルートモーション

アニメの腰の移動を、キャラの移動に使う方法。攻撃の踏み込み・回避・重い敵の歩きのように「動きと距離を一致させたい」ときに使う。
操作の手触りが大事なプレイヤーの通常移動はコードの移動（その場のクリップ）のほうが反応がよい。

```gdscript
# AnimationTree.root_motion_track = NodePath("Skeleton3D:Hips")（腰の骨）
func _physics_process(delta: float) -> void:
    var motion := tree.get_root_motion_position()
    var rotation := tree.get_root_motion_rotation()
    quaternion = quaternion * rotation
    velocity = (quaternion * motion) / delta
    velocity.y += gravity_y(delta)   # 重力はコードで足す
    move_and_slide()
```

- ルートモーションのクリップは腰の前進を**残す**。その場のクリップと混ぜるとブレンド中に移動が半分になるので、
  使う状態をはっきり分ける。
- 壁・崖で止まるのは `move_and_slide` に任せる（アニメの位置をそのまま `position` に足さない）。

## 5. 手続きの足し算（視線・揺れ・IK）

| 目的 | 4.5.1 で使うもの |
|---|---|
| 頭・目が敵や会話の相手を見る | `LookAtModifier3D`（角度の上限と、戻りの時間を設定） |
| 髪・尻尾・布・耳・武器の房 | `SpringBoneSimulator3D`（揺れの強さは控えめに。主動作より目立たせない） |
| 体の傾き（加速・旋回） | `Motion.Spring` で求めた量を背骨の回転に足す（`SkeletonModifier3D` を自作するか、ボーンの姿勢を上書き） |
| 足を坂・段差に合わせる | 足首の下へ `RayCast3D` を 2 本。差の分だけ腰を下げ、足首を地面の向きに回す。膝の曲げは小さな段差なら不要 |
| 手を取っ手・武器に合わせる | アニメ側で合わせる（Blender）。4.5.1 では 2 本の骨の IK ノードが無いので、手続きでは手首の向きだけ直す |

**`TwoBoneIK3D` を使うコードを書かない**（4.6 で入るノード。4.5.1 では読み込めない）。`SkeletonIK3D` も新しく使わない。

## 6. 検査

- [ ] 全部のクリップが 1 つの骨格の名前にそろい、Rest Fixer の設定を `.glb.import` に残した
- [ ] `generate_motion` は一発ものだけに使い、ループとその場の動きは素材かプリセットから取った
- [ ] ループするクリップの継ぎ目でつっかえない。当たる瞬間のキーをならしていない
- [ ] AnimationTree の遷移と OneShot のフェードに 0 秒のものが無い（被弾など意図したものを除く）
- [ ] `BlendSpace1D.sync` を true にし、点の位置がクリップの実測の速さになっている
- [ ] 再生速度の補正が 0.7〜1.3 に収まり、足滑りが見えない
- [ ] 判定・音・粒子はクリップの中の出来事で出し、秒数の `await` で出していない
- [ ] `TwoBoneIK3D` / `SkeletonIK3D` を使っていない
