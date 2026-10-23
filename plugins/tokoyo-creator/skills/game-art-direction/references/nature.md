# 屋外と自然（草・木・地面・水・空・光）: どこを見るか

草原・森・川・広い野外を見せる作品で読む。単色の地面に円錐の木を並べた画面で終えない。
手法はここに書き写さない。**公式の資料を読んで作り**、この文書は「どこを見るか」「資料に書いていない落とし穴」「すぐ使える部品」「重さの測り方」だけを持つ。
Web とスマホはどちらも Compatibility レンダラーで動く。公式の例が Forward+ 前提のことがあるので、§2 と照らしてから使う。

## 1. 見る場所

Sandbox では `${GODOT_TOOLCHAIN_DIR:-/opt/godot}/manual/` に固定版（4.5）の本文がある。まずそこを読み、足りなければ Web 検索で公式の同じ章や公式デモを調べる（`instructions.md` §7.1）。
手元では同じ章を `https://docs.godotengine.org/en/4.5/<パス>.html` で読める。
| 知りたいこと | 章（`manual/` からのパス、`.rst`） |
|---|---|
| Compatibility で使える機能・使えない機能 | `tutorials/rendering/renderers`・`tutorials/3d/3d_rendering_limitations` |
| 木の葉の作り方（頂点カラー R = 揺れ、両面、風の shader） | `tutorials/shaders/making_trees`（GPU Gems 3 第 16 章 Crysis の植生の揺れを推奨） |
| 大量の草・群れを 1 回で描く、頂点を shader で動かす | `tutorials/performance/using_multimesh`・`tutorials/3d/using_multi_mesh_instance`・`tutorials/performance/vertex_animation/animating_thousands_of_fish` |
| 透明の種類（葉は Alpha Scissor）、両面、頂点カラー、距離のフェード | `tutorials/3d/standard_material_3d` |
| shader の組み込み変数（`INSTANCE_CUSTOM`・`CAMERA_POSITION_WORLD`・`BACKLIGHT`・`ALPHA_SCISSOR_THRESHOLD`） | `tutorials/shaders/shader_reference/spatial_shader`・`canvas_item_shader`（2D） |
| 遠くを軽くする（段の切り替え、自動 LOD、隠れた物を省く） | `tutorials/3d/visibility_ranges`・`tutorials/3d/mesh_lod`・`tutorials/3d/occlusion_culling`・`tutorials/performance/optimizing_3d_performance` |
| 空・環境光・霧・トーンマップ・色調 | `tutorials/3d/environment_and_post_processing`・`tutorials/3d/high_dynamic_range` |
| 太陽と影（分割・最大距離・bias） | `tutorials/3d/lights_and_shadows` |
| GLB の取り込み設定（LOD・材質の差し替え） | `tutorials/assets_pipeline/importing_3d_scenes/import_configuration` |
| 型・メソッドの正確な名前 | `${GODOT_TOOLCHAIN_DIR:-/opt/godot}/api/doc/classes/<Class>.xml` |

公式のデモ（`github.com/godotengine/godot-demo-projects` の `3d/visibility_ranges`）は、木 1 本の高詳細 → 低詳細 → 16 本の群 → 消える、の 4 段で森を軽くしている。森を作るときの段の考え方はこれに合わせる。
Blender 側は Python API（`bpy.types.NormalEditModifier`・`bpy.ops.export_scene.gltf`）と glTF 書き出しの説明が正本。手順は `$game-3d-studio` の `assets/foliage_recipe.py` にまとめてある。

## 2. 資料に書いていない落とし穴（2026-10-23、Godot 4.5.1 のソースと実描画で確認）

| 落とし穴 | どうする |
|---|---|
| 「Making trees」の葉の透過 `SSS_TRANSMITTANCE_COLOR` は Compatibility では使われない（宣言だけ） | 透け感は `BACKLIGHT`（効く） |
| 「Making trees」の `depth_prepass_alpha` + `ALPHA` は透明の描画経路に入る（重い、並び替えの不具合） | 葉は `ALPHA_SCISSOR_THRESHOLD`（Alpha Scissor、不透明の経路。StandardMaterial の章も葉はこれを推奨） |
| Alpha antialiasing（alpha to coverage）は Compatibility で何もしない | 葉の画像の透明部分を葉の色で埋めてミップマップの黒ずみを防ぐ |
| 可視範囲のフェード（Self / Dependencies）と `transparency` は Forward+ だけ。Compatibility は即時に切り替わる | 切り替わりは霧・shader で縮める・2 段の密度で隠す |
| SSAO / SSIL / SSR / SDFGI / VoxelGI / 体積フォグ / Decal / 被写界深度 / FXAA / TAA は無い。Glow は簡易版 | 草の根元・葉の内側を shader で暗くする、Blender で AO を焼く、通常の霧 |
| `cull_disabled` は裏面の法線を反転してから `fragment()` に渡す。草の法線を上向きにしても裏面が暗くなる | `fragment()` で法線を書き直す（`grass.gdshader`） |
| 取り込んだ GLB に `COLOR_0` があると、Godot は頂点カラーを基本色に掛ける材質を作る（`vertex_color_use_as_albedo = true` を実測） | 揺れの重みを頂点カラーに入れた木は、幹も葉も材質を差し替える |
| Blender の glTF 書き出しは頂点カラーを既定で「材質が使う物だけ」出す（`export_vertex_color='MATERIAL'`）。揺れの重みは黙って消える | `export_vertex_color='ACTIVE'`（`foliage_recipe.py`） |
| PSSM 4 分割（既定）の影は、1 つの物を最大 5 回描く。地形が影を落とすと地形全体を何度も描く | 影は 2 分割・最大距離を短く・地形と草は影を落とさない（試作で草以外の三角形が 30 万 → 13 万） |
| 1 つの MultiMesh は丸ごと選別され、可視範囲は AABB の中心までの距離で決まる。区画が大きいと、中心が範囲内なら区画全体を描く | 草の区画は 8 m 程度（16 m より大幅に軽い） |
| 1 個ずつ `set_instance_transform` すると単一スレッドの Web で詰まる | `MultiMesh.buffer` に 1 回で渡す（1 個 = 変換 12 + 色 4 の float） |
| 自動 LOD（取り込んだメッシュ）は Compatibility でも効く（6.6 万三角形の球が約 2 千に）。ただし MultiMesh の全個体が同じ段 | 岩・建物・幹に使う。葉のカードと草は §3 の 2 段で軽くする |

## 3. すぐ使える部品（`<kit>/skills/game-art-direction/assets/nature/`）

上の資料の手法を組み合わせ、落とし穴を避けた形で実描画と計測まで確かめた部品。作品の `godot/nature/` に必要な物だけコピーし、以後はそのファイルを直す。
色は `source_color` の uniform で、`design/palette.json` から入れる。各ファイルの先頭に使い方とメッシュとの約束がある。

| ファイル | 中身 |
|---|---|
| `nature_scatter.gd` | 1 つのメッシュを地面に区画ごとの MultiMesh で撒く。密度・高さ・色の関数、描画距離、近景/遠景の 2 段（`far_fraction` / `far_mesh`）、`stream_radius` で周囲だけ（広い世界）、`buffer` で一括 |
| `nature_meshes.gd` | 草の株（1 本 5 三角形・透明なし）、葉のカードの木、岩、葉の画像を手続きで作る |
| `grass.gdshader` | 草（`UV.y` = 根元 0 → 先端 1）。流れる突風 + 個体ごとの揺れ、根元→先端の色と根元の暗さ、上向きの法線、`BACKLIGHT`、距離で地面へ縮む、踏むと倒れる（`trample`） |
| `foliage.gdshader` | 木・茂みの葉（`COLOR.r` = 揺れの強さ、無ければ `use_height_weight`）。Alpha Scissor、幹ごと傾く揺れ + 葉先の揺れ、樹冠の法線（`crown_normals`） |
| `ground.gdshader` | 地面。草/土/岩/砂を傾き・高さ・スプラットマップで混ぜ、急斜面は三方向投影、大きな色むらで単調さとタイルの繰り返しを消す |
| `water.gdshader` | 深度テクスチャを使わない水面（波、フレネル、地形の高さの画像から浅瀬と岸の泡） |
| `sway_2d.gdshader` | 2D の草・茂み・花の揺れ（根元固定、通った物で倒れる） |

```gdscript
const NatureMeshes := preload("res://nature/nature_meshes.gd")
const NatureScatter := preload("res://nature/nature_scatter.gd")

var grass := NatureScatter.new()
grass.mesh = NatureMeshes.grass_clump()
grass.material = grass_material                # grass.gdshader。fade_end ≈ draw_distance - chunk_size / 2
grass.height_at = terrain.height_at            # Callable(x, z) -> float。描画と同じ高さ
grass.density_at = func(x: float, z: float) -> float: return 0.0 if on_path(x, z) else 1.0
grass.area = Rect2(-60, -60, 120, 120)
grass.chunk_size = 8.0
grass.per_square_metre = 7.0
grass.draw_distance = 40.0
grass.lod_distance = 15.0
grass.far_fraction = 0.5
add_child(grass)
```

見た目で効いたこと（試作で比較）: 地面の草の色を草の根元と先端の中間よりやや暗くする（遠くで株がまばらでも地面が透けない）、
道・水際は地面のスプラットと草の `density_at` を同じ規則から作る、草と木の風向きをそろえる、屋外は空の環境光だけで十分で明るすぎたら `ambient_light_energy` を下げる、
霧で遠景と段の切り替わりを隠しカメラの `far` も縮める。素材の木の葉の板がチラつくなら `crown_normals = 1.0` と `crown_center`。

## 4. 重さ: 測って、原因の大きい物から直す

試作（Godot 4.5.1 Compatibility、Mac、1280×720、同じカメラ。**スマホ実機では未測定**）:

| 版 | 描画呼び出し | 三角形（影を含む） |
|---|---|---|
| 以前の作り（単色の地面・円錐の木・単色の水） | 160 | 15.4 万 |
| 部品をそのまま（草 16 m 区画・描画 45 m、影 4 分割・地形も影） | 143 | 82.5 万 |
| 影 2 分割・地形は影なし、草 8 m 区画・2 段・描画 40 m、遠くは葉の少ない木 | 97 | 23.7 万 |

出発点の予算: スマホの Web で画面内の三角形 30 万以下・描画呼び出し 150 以下、草はそのうち 15 万以下。実機で測って直す。
削る順: ① 影（分割・最大距離・影を落とす物）② 草（密度 → 描画距離 → 遠景の割合 → 株の本数）③ 木（遠景の段を早める・遠景の木は枚数を減らして板を大きく〔`tree(…, cards = 10, card_size = 1.7)`〕・遠い森を板や塊に）
④ 霧を濃くしてカメラの `far` を縮める ⑤ 解像度（`$game-design` references/performance-risk.md）。見た目を一律に下げない。

測り方: 代表場面で `Performance.RENDER_TOTAL_DRAW_CALLS_IN_FRAME`・`RENDER_TOTAL_PRIMITIVES_IN_FRAME`・`TIME_PROCESS`・`RENDER_VIDEO_MEM_USED` を取り、
`TokoyoApp.report` で記録する。変更前後を同じカメラ・解像度で比べる。PC の数値をスマホの保証にしない。

## 5. 実画面で確かめる

`$game-playtest` references/visual-observation.md の代表場面で、草が地面から生えているか（浮く・道に生える）、草原が 1 枚の均一な面に見えないか、
遠くで地面が透けないか、樹冠がチラつかないか、素材の木が赤・黒く染まっていないか、白く浮いていないか、を見る。
風は静止画では分からないので、数フレーム離した 2 枚で動いた場所を比べる（根元が動かず先端が動く）。
