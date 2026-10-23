---
name: game-3d-studio
description: Blender（bpy）で 3D の素材を作る「3D スタジオ」。手続き的なモデリング（小物・建物・地形・ローポリのキャラ）、GLB の手直し（大きさ・原点・向き・デシメート・結合）、人型・四足・鳥・魚・蛇・多脚のリグとアニメーション（体型に合う骨格・キーフレーム・自動ウェイト + フリー素材のクリップ + 生成したモーション〔FBX〕のリターゲット）、3D から 2D（8 方向スプライト・アイコン）、ベイク（AO・ライトマップ）に使う。GodotのNode/meshで組めない形の GLB が要るとき、3D モデルを動かしたいとき、2D のゲームに 3D から描いたスプライトが欲しいときに使う。Blender, bpy, GLB, glTF, rig, sprite sheet, bake.
---

# 3D スタジオ（Blender を使用）

モデルの調達は `$game-art-direction` §3 の「ライブラリ調査 → モデリング評価 → 生成AI」に従う。合う素材が無く、簡単に必要な品質まで作れる小物・建物などは、このSkillでモデリングする。複雑な重要キャラを粗い造形で済ませない。モデルの入手経路にかかわらず、不足するリグ・動きには対応する専用AIを優先できる。

GodotのNode/meshで組める形（箱・球・床・パーティクル）は、そのままコードで描くほうが安く速い。
**GLB が要る・リグやアニメーションを付ける・3D から 2D を描く・焼き込む**ときだけ使う。

手元の Blender（4.5 LTS 以上。無ければ blender.org から無料で入る）を
`blender -b --factory-startup -Y --python-exit-code 1 -P art/3d/<name>.py` で動かす。
書き出した GLB は `upload_asset`（`model_3d`。持ち込みの枠なので 3D 生成が閉じていても登録できる）、PNG は `upload_image` で素材に登録する。
ゲームが使う GLB は `source/godot/` の下に置く。手元の Godot Editor（`kit.mjs editor`）を開いていれば書き出すたびに読み込み直されるので、利用者にその場で見てもらえる。
Blender が無く、利用者が入れない場合は 3D スタジオを使わずに作る（コードのジオメトリ。ツール一覧にあれば 3D のフリー素材・`generate_model_3d`）。
画面の Blender で見せる・利用者が手直しするときは §6。

## 1. スクリプトはソースに置く

- 既存のスクリプト・原型・部品・骨格を確認し、必要な差分だけ作る。
  形/装備/リグ/モーション/撮影を分け、変更していない工程は完成素材を再利用する。
  繰り返す造形・配置・撮影は設定を先頭の一か所へ集めたレシピとして残す。
  同じ原型から必要な角度・動作をまとめて出力し、毎コマ別のモデルを生成しない。
  調達・基準画像・レシピの再利用手順は`$game-asset-tools` references/efficient-production.md。
  同じ実行内で再利用するときも入力/設定/Blender版と出力の一致を確認する。
- スクリプトは **`art/3d/<name>.py`** に置く（ソースの commit に入り、配信物には入らない）。
  「剣を長くして」のような直しは、このスクリプトの数値を変えて**もう一度実行**する。
  先頭に `# tokoyo: hand-finished <path>` の印があるスクリプトは実行しない（利用者が画面で仕上げた GLB がある）。
- `.blend` はソースに入れない（正本はスクリプトと書き出した GLB。Godot は `.blend` を Blender で読み込もうとし、Blender の無いビルドで止まる）。
- 同じ結果が出るようにする: 最初に `bpy.ops.wm.read_factory_settings(use_empty=True)` で空のシーンにし、
  乱数は `random.seed(<固定値>)`。時刻やファイルの一覧順に依存しない。
- 書き出し先は環境変数 `OUT` の下（`os.environ["OUT"]`）。入力の素材は `INPUTS` の下。
  手元では、スクリプトの先頭で `OUT` が無ければ `art/3d/out` を使うようにしておく。- 版で変わる API を使うときは `bpy.app.version` を見て分ける（5.x で名前が変わったものがある）。

## 2. 形の決まりごと

| 項目 | 決まり |
|---|---|
| 単位 | 1 = 1 m。キャラの身長は 1.6〜2.0 |
| 向き | 正面は -Y（Blender）。上は +Z。書き出し器が glTF の +Y up に直す |
| 原点 | 足元（地面に立つもの）・中心（浮くもの・回すもの） |
| 変形 | 書き出す前に大きさ・回転を適用する（`transform_apply`） |
| 三角形 | 小物 2,000 まで・キャラ 15,000 まで・背景 1 つ 30,000 まで |
| テクスチャ | 1024 px まで（スマートフォンのメモリ。KTX2 にするなら書き出した PNG を `convert_texture`） |
| マテリアル | Principled BSDF の基本色・粗さ・金属だけ（ほかのノードは glTF に出ない） |
| 1 ファイル | 8 MiB まで |

## 3. 書き出し

- GLB: `bpy.ops.export_scene.gltf` に `export_format="GLB"`・`export_meshopt_compression_enable=True`
  （Godot 4.5.1のimportが受理する形式で出し、圧縮後のimportと描画を確認する）。
  テクスチャは GLB に埋め込まれる（別ファイルにしない）。
- アニメーション: 1 動作 = 1 アクション。名前は `Idle` / `Walk` / `Run` / `Jump` / `Attack` のように英語の動詞。
  複数のアクションを出すときは NLA トラックに積んで `export_animation_mode="NLA_TRACKS"`。
- PNG: 背景を透明にするなら `scene.render.film_transparent = True`、形式は `PNG` / `RGBA`。

## 4. 作業ごとの手順

### 4.1 手続き的なモデリング

プリミティブ（立方体・円柱・円錐・ico 球）とモディファイア（ベベル・配列・ミラー）で組み、
使った色ごとにマテリアルを 1 つ作る。細かい形は頂点を増やさず、色と配置で見せる（ローポリ）。

### 4.2 手直し（生成した GLB・フリー素材）

調達/生成/加工する3Dモデルは先に [診断・修復・仕上げ](references/model-quality.md) を読む。
静止小物、硬い可動部、スキン変形するキャラで工程を選び、形状・陰影・ウェイトの原因を分けて直す。
`import_scene.gltf` で読む。
大きさ・原点・向きを揃え、正常な静止形状の減面には`DECIMATE`を候補にする。
比率は目安で、書き出し後の実三角形数と輪郭/UVを確認する。動くキャラは関節の面配置とウェイトを確認し、
必要箇所をリトポロジーする。高密度原型がある場合は必要な細部を低密度モデルへベイクできる。
正常な形状や既存リグを一律にボクセルリメッシュせず、最終GLBの実再生まで確認する。

### 4.3 リグとアニメーション

**人以外も動かす。** 人型のMeshy自動リグ・`generate_motion`（SMPL-H）は四足・鳥・魚・蛇・多脚に使わない。モデルの体型と関節を確認し、[非人型のリグと動作](references/non-humanoid.md) の手順で専用AIを優先し、未対応の形・動きにはBlenderスクリプトを作る。既存のアニメ付き素材が体型・動作とも合う場合は再利用できる。

非人型の完成GLBは `exports` に `require_rig: true` と `required_animations: ["Idle", "Walk"]` など、依頼された動作の名前を指定する。Platformは実際のGLBのスキン・ウェイト属性・骨へのアニメーションチャンネルを確認し、欠落時は `EXPORT_INVALID` として返す。動物に必要な動作を静止モデルで代用して終了しない。


- 人型は、フリー素材の Quaternius UAL（`search_stock_assets` で `universal animation`）の骨格とクリップに合わせるのが早い。
  体型/外見/動作が合う場合に再利用し、必要な素材だけ取り込む（`$game-asset-tools` §3.5）。
- 自分のメッシュに骨を付けるときは、骨を編集モードで作り、メッシュ → 骨の順に選んで
  `parent_set(type="ARMATURE_AUTO")`（自動ウェイト）。頂点グループが骨の数だけできたか確かめる。
- キーフレームは `pose.bones[<名前>].keyframe_insert(...)`。1 アクションずつ NLA トラックへ。

### 4.3.1 モーション（FBX）をキャラに付ける（リターゲット）

`generate_motion` の結果（骨格アニメーションだけ）と、利用者が上げた `motion`（Mixamo などの FBX。メッシュ付きのこともある）は、
そのままではゲームに入らない（配信物に FBX は入れられない）。ゲームで一般的な流れのとおり、
**キャラの骨格に移して、キャラの GLB のクリップとして書き出す**。

1. 付け先のキャラを決める: リグ付きの GLB（前に作ったキャラ・取り込めるならフリー素材の UAL のキャラ）。
   リグの無いメッシュ（`generate_model_3d` の結果など）は、先に §4.3 で骨を付ける。
2.    キャラは `import_scene.gltf`、モーションは `import_scene.fbx(filepath=..., automatic_bone_orientation=True)` で読む。
   `generate_motion` の FBX は SMPL-H 骨格（体の 22 関節）。
   **まず両方のアーマチュアの骨の名前を print してログで確かめてから**対応表を書く（名前を推測で書かない）。
3. 対応表の骨ごとに、付け先の骨へ **`COPY_ROTATION`**（ワールド空間）を付け、腰だけは **`COPY_LOCATION`** も付ける
   （移動量は身長の比で縮める）。これは姿勢と軸が合うリグの候補であり、
   休止姿勢/ローカル軸が違う場合は補正を入れる。指・ねじれ骨など対応の無い骨は動かさない。
   両者の休止姿勢（T ポーズ / A ポーズ）が違うと腕がずれるので、付け先を元の休止姿勢に合わせてから付けるか、
   プレビューで腕の角度を見て補正する。
4. `bpy.ops.nla.bake(frame_start=..., frame_end=..., only_selected=False, visual_keying=True,
   clear_constraints=True, bake_types={"POSE"})` で付け先のアクションに焼き込み、名前を英語の動詞（`Run`）にして NLA トラックへ積む。
   モーションのアーマチュアとメッシュは消す。
5. 動作ごとに 2〜4 を繰り返し、キャラの GLB を 1 つ書き出す（§3。`export_animation_mode="NLA_TRACKS"`）。
   ゲームでは Godot `AnimationPlayer` / `AnimationTree` にクリップ名で渡す（`$game-3d-and-bundles`）。
6. **プレビューで必ず確かめる**: 足が床を突き抜けない・腕がねじれていない・向きが -Y のまま。
   ループさせる動き（待機・歩き）は最初と最後の姿勢が合っているか。
   継ぎ目・接地・ひねりだけの問題は既存動作を局所修正し、全動作の再生成で代用しない。

### 4.4 3D から 2D（スプライト）

正射影カメラ（`ORTHO`）を斜め上 30〜60° に置き、物を 45° ずつ回して 8 枚描く。
描画は **Cycles（CPU）**、サンプル 16〜32、解像度はゲームで表示する大きさ（64〜256 px）。
背景は透明。できた PNG を GodotのSpriteFramesへ登録する（`$game-godot`）。

### 4.4.1 草・木・茂み

`<kit>/skills/game-3d-studio/assets/foliage_recipe.py` を `art/3d/` にコピーして数値を直す（草の株・葉のカードの木）。
葉の法線は Normal Edit の `RADIAL`（樹冠の楕円体から外向き）、草は `DIRECTIONAL`（上向き）、揺れの重みは色の属性 `wind` を
`export_vertex_color="ACTIVE"` で `COLOR_0` に出す（既定の `MATERIAL` では黙って消える）。葉の alpha は Math の ROUND を通して MASK にする。
Godot では取り込んだ材質が頂点カラーを基本色に掛けるので、葉と幹の材質は差し替える（`$game-art-direction` references/nature.md）。

### 4.5 ベイク

高密度原型から軽量モデルへ法線/色を移すときは references/model-quality.md §3 を使う。
UVと投射を確定してから焼き、形状/UVを変更したら影響するベイクを更新する。
AO やライトを Cycles でテクスチャに焼き込むと、Godot側でライトを減らせる。
UV を展開（`smart_project`）→ 画像テクスチャのノードを作って選択 → `bpy.ops.object.bake(type="AO")` → PNG で保存。
1024 px・32 サンプルで数秒〜十数秒。

## 6. 画面の Blender（手元）

**見せる**（「Blender で開いて」）: `node <kit>/scripts/kit.mjs blender --script art/3d/<name>.py` でスクリプトを画面なしで実行して書き出した GLB を、
`--model source/godot/<path>.glb` で GLB を、利用者の Blender の画面に開く。スクリプトの書き出しは一時ディレクトリに向くので、ゲームのファイルは変わらない。
スクリプトが失敗したら画面は開かず、Blender の出力の末尾が返るので直してやり直す。
画面での変更はそのままではゲームに残らないこと、`.blend` を `source/` に保存しないこと（Kit は git に入れず、`pack` が断る。§1）を伝える。

**手直しを残す**: 利用者に、手直しした結果を glTF Binary で `art/3d/out/<name>.edited.glb` に書き出してもらい、スクリプトの GLB と比べる。

```
blender -b --factory-startup -Y --python-exit-code 1 -P <kit>/skills/game-3d-studio/assets/glb_compare.py -- <スクリプトの GLB> art/3d/out/<name>.edited.glb
```

1. `writable_back: true`（どのオブジェクトも位置・大きさ・回転の違いだけ）なら、**スクリプトに書き戻す**:
   `size_ratio`（軸ごとの倍率）・`edited.center`・`edited.rotation` をスクリプトの数値に反映して実行し直し、同じ比較で全部が `changed: false` になるまで直す。終わったら `edited.glb` を消す。
2. `writable_back: false`（頂点を動かした・オブジェクトを足した/消した・回転を適用した）なら、利用者に確かめてから**手で仕上げた GLB として残す**:
   書き出した GLB をゲームが参照している同じパスに置き、スクリプトの 1 行目に `# tokoyo: hand-finished <source/ からの GLB のパス>` を書いて両方を commit する。
   以後このスクリプトは実行しない（仕上げる前の形に戻る。`kit.mjs blender --script` は代わりに仕上げた GLB を開く）。数値での直しを頼まれたら、
   画面の Blender で直してもらうか、利用者が手直しを捨ててよいと言ったときだけ印を外してスクリプトから作り直す。
3. どちらも §2 の上限と §3 の形式に合わせる（仕上げた GLB も検証器が確かめる）。

専用AI優先: 非人型は形の生成後に`rig_model_3d`→`animate_model_3d`を使い、未対応の体型・動作のみBlenderで補う。対応presetとキー未設定時の経路はgame-3d-studio/references/non-humanoid.mdを参照。
