# タイルでマップを作る（2D の TileMapLayer・3D の GridMap）

格子に並ぶ地面・壁・床・道の作品は、1 枚絵や図形の並べ書きでなく **タイル（マップチップ）** で作る。
Godot 4.5 では 2D は **`TileMapLayer`**（`TileMap` ノードは非推奨。使わない）と `TileSet`、3D は **`GridMap`** と `MeshLibrary`。
タイルは描画がまとまって速く、当たり判定・ナビゲーション・タイルごとのデータを一緒に持て、素材を差し替えても地図はそのまま残る。
出典は Godot 4.5 の公式手順（Using TileSets / Using TileMaps）と `--doctool` の API 定義。

**使う時**: 横スクロール・見下ろし・ダンジョン・パズル盤面・3D の部屋や町など、地面や壁が格子に乗る作品。
1 枚の背景絵・曲面の地形（`$game-open-world` の高さ地形）・物理で動く足場はタイルにしない。

## 1. ツール（コピーしない。ゲームには入らない）

```bash
TOOL=<kit>/skills/game-level-design/assets/tiles.gd
godot --headless --path <source>/godot --import                 # 最初に（画像を資源として読み込む）
godot --headless --path <source>/godot -s $TOOL -- atlas <dir> --out res://tiles/<pack>.png [--columns N]
godot --headless --path <source>/godot -s $TOOL -- sheet res://tiles/<pack>.png [--tile WxH --margin X,Y --separation X,Y]
godot --headless --path <source>/godot -s $TOOL -- greybox res://tiles/greybox --tile 16 --terrains wall,grass
godot --headless --path <source>/godot -s $TOOL -- tileset <source>/design/tiles/<name>.json
godot --headless --path <source>/godot -s $TOOL -- paint <source>/design/tilemaps/<room>.json
godot --headless --path <source>/godot -s $TOOL -- meshlib res://kit/<dir または .glb> res://kit/<name>_library.tres [--collision box|convex|trimesh|none]
```

| コマンド | すること |
|---|---|
| `atlas` | 手元の 1 タイル 1 ファイルの画像を、ファイル名順に 1 枚のシートへまとめる。`<シート>.atlas.json` にファイル名→座標を残す（フリー素材はフォルダの取り込みが同じことをする） |
| `sheet` | シートの格子（タイルの大きさ・隙間）を推定し、拡大・格子線・行列番号つきの `<シート>.sheet.png` と、タイルごとの縁の判定（`sides_shape` / `corners_shape` / `full_shape`）を書いた `<シート>.sheet.json` を出す。**必ず `.sheet.png` を見てから**どのタイルを何に使うか決める |
| `greybox` | 色の板だけの「角と辺」47 枚のタイルセットと仕様を作る。素材の前の仮組みで、地形が自動でつながる |
| `tileset` | 仕様 JSON（§3）から `TileSet`（`.tres`）を作る。当たり判定・一方通行・タイルのデータ・地形のつながり方・出現率・アニメーション |
| `paint` | 文字の格子（§4）から `TileMapLayer`（または `GridMap`）を塗ってシーンに保存する。結果の絵（`<room>.png`）と、つながりの合わない場所の一覧（`<room>.report.json`）を出す |
| `meshlib` | 3D の部品（GLB）を 1 メッシュ 1 項目の `MeshLibrary` にし、当たり判定の形を付ける |

## 2. 進め方

1. **大きさを決める**: 主役の当たり判定とジャンプ・歩幅から 1 マスの大きさを決め（2D は 16/18/32 px、3D は 1〜2 m）、
   ステージをマス数で設計する（[world-layout.md](world-layout.md) の部屋の矩形もマス数で書く）。
2. **仮組み**: `greybox` の色タイルで `paint` し、遊べるか確かめる（ジャンプの届き・通路の幅・敵の巡回）。
3. **素材**: `$game-art-direction` の評価順でタイルの素材を選ぶ（スタイルガイドのパック 1 つ。生成はパックに無い形だけ）。
   - フリー素材のタイルは**フォルダごと 1 回で**取り込む（`import_stock_asset` に `…/Tiles/` のようなフォルダを渡す。`$game-asset-tools` §3.5）。
     返る `tileset.files` がファイル名とシートの [列, 行] の対応。シートは `godot/tiles/` に置く。
   - 利用者が上げた・生成した 1 タイル 1 ファイルの画像は、`design/tiles/src/<pack>/` に置いて `atlas` でまとめる（`godot/` の外に置くとゲームに入らない）。
   - 1 枚のシートの素材や生成した画像は `sheet` で格子を確かめる（推定が外れたら `--tile` と `--separation` を指定）。
4. **タイルセット**: `sheet.png` を見て仕様 JSON を書き、`tileset` で作る。出力の `terrain_shapes`（地形ごとのつながり方の数）と `problems` を見る。
5. **塗る**: 仮組みと同じ文字の格子のまま、仕様の `tileset` を本物に替えて `paint` し直す。地図の正本は文字の格子なので、
   素材を差し替えても地形は描き直しにならない。
6. **確かめる**: `<room>.png` を見る（境目・段差・縁取り）。`report.json` の `unmatched` が 0 でなければ §5。
   当たり判定と画面の見え方は、最後に実画面（`$game-playtest`）で確かめる。

## 3. タイルセットの仕様（`design/tiles/<name>.json`）

```json
{
  "version": 1,
  "image": "res://tiles/pixel_platformer.png",
  "tile_size": [18, 18],
  "margin": [0, 0],
  "separation": [0, 0],
  "output": "res://tiles/ground.tres",
  "physics_layers": [{"collision_layer": 1, "collision_mask": 1}],
  "custom_data": {"hazard": "bool", "friction": "float"},
  "terrain_sets": [{"mode": "sides", "terrains": [{"name": "dirt", "color": "#b07040", "fallback_tile": "4,0"}]}],
  "tiles": {
    "1,3": {"terrain": "dirt", "shape": ".##.", "collision": "solid"},
    "2,3": {"terrain": "dirt", "shape": ".###", "collision": "solid"},
    "4,0": {"terrain": "dirt", "shape": "####", "collision": "solid"},
    "5,1": {"terrain": "dirt", "shape": "####", "collision": "solid", "probability": 0.3},
    "8,3": {"collision": "bottom_half", "custom": {"hazard": true}},
    "11,7": {"animation": {"frames": 2, "duration": 0.3}}
  }
}
```

- 座標は `"列,行"`（`sheet.png` の番号）。複数のシートは `"atlases": [{"image", "tile_size", "margin", "separation", "tiles"}, …]`。
- `collision`: `solid`（全面）・`one_way`（上からだけ乗れる足場）・`top_half` / `bottom_half`・`slope_up` / `slope_down`（坂）・
  点の配列（タイル左上が原点の px）・`none`。床・壁・トゲなど、当たる物には必ず付ける。
- `custom`: タイルごとのデータ（ダメージ床・滑る床・壊せる壁など）。ゲームは `get_cell_tile_data(cell).get_custom_data("hazard")` で読む。
  当たったタイルは `get_coords_for_body_rid(collision.get_collider_rid())` で分かる。
- `probability`: 同じつながり方のタイルが複数あるとき、どれを選ぶかの重み（床の模様のばらつき）。
- `texture_padding`（既定 `true`）: タイルの周りに透明の 1px を足し、拡大・縮小時に隣のタイルの色がにじむのを防ぐ。外さない。
- ドット絵は `project.godot` の `[rendering] textures/canvas_textures/default_texture_filter=0`（Nearest）でぼかさない。
  カメラのズームは整数倍にし、`[rendering] 2d/snap/snap_2d_transforms_to_pixel=true` で描画位置を画素に揃えると、タイルの間に線が出にくい。

### 地形のつながり方（terrain set）

Godot の地形は、隣に同じ地形があるかでタイルを自動で選ぶ。`shape` は地形が続く向きを時計回りに `#`（続く）・`.`（続かない）・
別の地形の `key` で書く。

| `mode` | `shape` の順 | 全部つながるのに要る枚数 | 向いているもの |
|---|---|---|---|
| `sides` | 上・右・下・左（4 文字） | 16 | 横スクロールの足場、道、パイプ、柵 |
| `corners` | 左上・右上・右下・左下（4 文字） | 16 | 地面の境目（草と土）、見下ろしの地面。**幅 1 マスの壁や道は描けない**（角は 4 マスで共有されるので、2×2 以上の塊で塗る） |
| `corners_and_sides` | 左上・上・右上・右・右下・下・左下・左（8 文字） | 47 | 見下ろしのダンジョンの壁、細い壁も含む洞窟。`greybox` はこの形 |

- `sheet.json` の `*_shape` は縁の色と透明度からの**推定**（内側と同じ色・不透明の縁を「続く」とみなす）。辺の推定は当たりやすく、角は外れやすい。
  `sheet.png` と見比べて直してから使う。
- パックが全部の向きを描いているとは限らない（多くの横スクロール用パックは下端や横の壁が無い）。地形に `fallback_tile`（模様だけの塗りのタイル）を
  指定すると、どのタイルも無い向きにはそのタイルが選ばれる（代わりのタイルが自動で作られる）。縁取りが要る所だけ素材を足す。
- 同じ地形の別の見た目（ひびの入った床など）は、同じ `shape` のタイルを複数登録して `probability` で混ぜる。

## 4. 塗る（`design/tilemaps/<room>.json`）

```json
{
  "scene": "res://rooms/cave_01.tscn",
  "tileset": "res://tiles/ground.tres",
  "layers": [
    {"node": "Ground", "grid": [
      "....................",
      "......dddd..........",
      "dddd........dddddd..",
      "dddddddddddddddddddd"],
     "legend": {"d": {"terrain": "dirt"}}},
    {"node": "Props", "z_index": 1, "collision": false, "grid": [
      "....................",
      ".......c..c.........",
      "...........^^......."],
     "legend": {"c": {"tile": "11,7"}, "^": {"tile": "8,3"}}}
  ]
}
```

- 1 行が 1 マスの行。`.` と空白は空き。`terrain` は地形でつなぎ（`set_cells_terrain_connect`）、`tile` はそのタイルを置く（`"source"` / `"alternative"` も指定可）。
- **層を分ける**: 当たる地面（`Ground`）・飾りや背景（`Back`。`collision: false`）・手前に重なる物（`Front`。`z_index` を上げる）。
  見下ろしで木や柱の裏に回り込む作品は、その層と主役の親で `y_sort: true` にする。1 層は 1 マスに 1 タイルしか置けない。
- 既存のシーンを指定すると、同じ名前の層だけ塗り直す（ほかのノードは残る）。部屋のシーンを作ってから、出入口・敵・仕掛けのノードを足す。
- 3D: 層に `"mesh_library": "res://kit/dungeon_library.tres"`・`"cell_size": [1, 1, 1]`・`"floor": 0`（高さの段）を書くと `GridMap` を塗る。
  `legend` は `{"item": "wall/wall", "rotate": 90}`（項目名は `meshlib` の出力）。階は `floor` を変えた層を重ねる。
- 増えた敵の巡回: タイルのナビゲーションは公式が非推奨（性能と経路の質）。`NavigationRegion2D` に地面の層から焼いた
  ナビゲーションメッシュを使う。

## 5. 塗った結果の確かめ方

- `report.json` の `unmatched`: 隣のタイルと縁が合わない場所。原因は (1) その向きのタイルが無い → `fallback_tile` か素材を足す、
  (2) `corners` で幅 1 マスの線を塗った → 2 マス以上にするか `corners_and_sides` にする、(3) `shape` の書き間違い → `sheet.png` と見比べる。
- `<room>.png`: 縁取りが内側に出ていないか、段差の上下が逆でないか、模様の繰り返しが目立たないか。
- 実画面: 主役が床に立つ・壁で止まる・一方通行の足場を下から抜ける・トゲのデータが読める。タイルの間の線やにじみが無い。

## 6. 3D の部品（GridMap）

- 部品は同じ大きさの格子に合わせる（Kenney の 3D キットは 1 m）。1 つの GLB に 1 メッシュ。複数メッシュの GLB はメッシュごとに別の項目になる。
- `meshlib` の当たり判定は既定で箱（床は 0.1 m の厚みを付ける）。坂や凹凸のある部品は `--collision convex`、
  形どおりが必要な動かない部品だけ `trimesh`（重い）。
- `GridMap` は `cell_size` を部品に合わせ、壁の向きは `rotate` で 90 度ずつ。床と壁は別の層に分けると塗り直しやすい。
