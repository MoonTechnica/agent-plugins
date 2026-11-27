# フリーのモーション素材（CC0）を探して使う

人型の標準的な動き（待機・歩き・走り・跳び・被弾・死亡・簡単な攻撃）は、作らずに**フリー素材から取り込む**のが最初の手。
`generate_motion` は固有の一発ものだけに使う（`references/3d-animation.md` §1.1）。

## 1. 探す → 取り込む → 確かめる

1. `search_stock_assets`（`kind: model_3d`）に英語で `sword attack` / `pistol reload` / `jog` / `bow` / `dash` などを渡す。
   Quaternius UAL と KayKit の行は説明文に**全クリップ名**があるので、動作名で引っかかる。語は**すべて含む行**だけが返る。
   探したい動きの語は 1〜2 個にする（`humanoid sword attack animation` のように足すと外れる）。
2. `import_stock_asset`（`stock` の枠 1）で GLB に取り込む。結果の `animations` が**実際のクリップ名**。名前を推測しない。
3. Godot では GLB を import し、`AnimationPlayer` のクリップ名を確かめる。ループは名前の `_Loop` で判断できる。
4. 自分のキャラへ使うときは `SkeletonProfileHumanoid` の `BoneMap` でリターゲットする（`references/3d-animation.md` §1.3）。
5. `design/motion.md` の状態表にクリップ名を書く。使わないクリップは GLB から外すか、読み込まない（メモリ。`$game-3d-and-bundles`）。

## 2. UAL（Standard）に入っているクリップ

名前の末尾が `_Loop` ならループ、`_RM` は腰の移動を含む（ルートモーション。`references/3d-animation.md` §4）。

| 用途 | クリップ |
|---|---|
| 待機・基本姿勢 | `A_TPose` `Idle_Loop` `Idle_Talking_Loop` `Idle_Torch_Loop` |
| 移動 | `Walk_Loop` `Walk_Formal_Loop` `Jog_Fwd_Loop` `Sprint_Loop` `Crouch_Fwd_Loop` `Crouch_Idle_Loop` `Push_Loop` `Swim_Fwd_Loop` `Swim_Idle_Loop` |
| 跳び・回避 | `Jump_Start` `Jump_Loop` `Jump_Land` `Roll` `Roll_RM` |
| 近接 | `Sword_Idle` `Sword_Attack` `Sword_Attack_RM` `Punch_Jab` `Punch_Cross` `Punch_Enter` |
| 射撃 | `Pistol_Idle_Loop` `Pistol_Aim_Neutral` `Pistol_Aim_Up` `Pistol_Aim_Down` `Pistol_Shoot` `Pistol_Reload` |
| 魔法 | `Spell_Simple_Enter` `Spell_Simple_Idle_Loop` `Spell_Simple_Shoot` `Spell_Simple_Exit` |
| 被弾・死亡 | `Hit_Chest` `Hit_Head` `Death01` |
| 操作・日常 | `Interact` `PickUp_Table` `Fixing_Kneeling` `Driving_Loop` `Dance_Loop` `Sitting_Enter` `Sitting_Idle_Loop` `Sitting_Talking_Loop` `Sitting_Exit` |

**足りない動き**（盾・両手剣・ライフル持ち・ゾンビ歩きなど。弓は §2.1 の KayKit にある）は、無理に似たクリップで代用せず、
`generate_motion` で作り、`$game-3d-studio` §4.3.1 の手順でキャラへ移す。

## 2.1 KayKit Character Animations（30 クリップ。`search_stock_assets` で `kaykit character animations`）

`Idle` `Walk` `Run` `Jump` `Hop` `Roll` `DashFront` `DashBack` `DashLeft` `DashRight`（移動）/
`Attack(1h)` `AttackCombo` `AttackSpinning` `HeavyAttack` `Block`（近接）/
`Shoot(1h)` `Shoot(2h)` `Shoot(2h)Bow` `Shooting(1h)` `Shooting(2h)` `Throw`（射撃・投擲）/
`Interact` `PickUp` `Climbing` `LayingDownIdle`（操作）/ `Cheer` `Dance` `Wave` `Defeat` `BasePose`（感情・基本）。
UAL とは別の骨格。UAL のキャラに使うときは `SkeletonProfileHumanoid` でそろえてから（`3d-animation.md` §1.3）。

## 3. 使い方の注意

- **その場か移動か**: `Walk_Loop` などはその場のクリップ。移動はコード、再生速度は実際の速さに合わせる（`3d-animation.md` §3）。
  `_RM` はルートモーションの状態でだけ使い、その場のクリップと同じブレンドに混ぜない。
- **攻撃の判定**はクリップのメソッドトラックかマーカーで出す。`Sword_Attack` の当たるフレームを実際に再生して決める。
- **段階のクリップ**（`Jump_Start` → `Jump_Loop` → `Jump_Land`、`Spell_Simple_Enter` → `Idle` → `Shoot` → `Exit`）は
  AnimationTree の状態に 1 つずつ置く。
- ライセンスは CC0。クレジットはゲームのページに自動で出る。
