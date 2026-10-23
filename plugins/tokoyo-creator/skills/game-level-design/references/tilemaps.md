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
godot --headless --path <source>/godot -s $TOOL -- compose <source>/design/tiles/<name>.compose.json
godot --headless --path <source>/godot -s $TOOL -- tileset <source>/design/tiles/<name>.json
godot --headless --path <source>/godot -s $TOOL -- paint <source>/design/tilemaps/<room>.json
godot --headless --path <source>/godot -s $TOOL -- meshlib res://kit/<dir または .glb> res://kit/<name>_library.tres [--collision box|convex|trimesh|none]
```

| コマンド | すること |
|---|---|
| `atlas` | 手元の 1 タイル 1 ファイルの画像を、ファイル名順に 1 枚のシートへまとめる。`<シート>.atlas.json` にファイル名→座標を残す（フリー素材はフォルダの取り込みが同じことをする） |
| `sheet` | シートの格子（タイルの大きさ・隙間）を推定し、拡大・格子線・行列番号つきの `<シート>.sheet.png` と、タイルごとの縁の判定（`sides_shape` / `corners_shape` / `full_shape`）を書いた `<シート>.sheet.json` を出す。**必ず `.sheet.png` を見てから**どのタイルを何に使うか決める |
| `greybox` | 色の板だけの「角と辺」47 枚のタイルセットと仕様を作る。素材の前の仮組みで、地形が自動でつながる |
| `compose` | 地形ごとの塗りの模様（継ぎ目なしに直せる）と縁の帯（草の縁・岩の縁取り）から、47 枚のタイルとタイルセットの仕様を作る。コンセプトの画風で描いた模様をそのままつながるタイルにする（§3.1） |
| `tileset` | 仕様 JSON（§3）から `TileSet`（`.tres`）を作る。当たり判定・一方通行・タイルのデータ・地形のつながり方・出現率・アニメーション |
| `paint` | 文字の格子（§4）から `TileMapLayer`（または `GridMap`）を塗ってシーンに保存する。3D は隣を見て部品と向きを選ぶ。結果の絵（`<room>.png`。2D はタイル、3D は真上から見た部品。3D は斜め上から見た `<room>.angle.png` も。問題の場所は赤枠）と、問題の一覧（`<room>.report.json`。つながらない並び・床の穴・浮き・めり込み・重なり）を出す |
| `meshlib` | 3D キットの部品ごとに 1 項目の `MeshLibrary` を作り、当たり判定を付ける。部品を真上と正面から描いた一覧（`<name>_library.png`）と大きさ（`<name>_library.items.json`）、使っている色の画像（`textures`）を出す（§6） |

## 2. 進め方

マップの見た目の正本はコンセプト画像（`design/concept/key-art.png`）と、そこから作る**変換表**（`design/style-guide.md` の「マップへの変換表」と
`design/palette.json`。`$game-art-direction` references/concept-to-map.md）。タイルと部品は変換表に合わせて選び・直す。

1. **大きさを決める**: 主役の当たり判定とジャンプ・歩幅から 1 マスの大きさを決め（2D は 16/18/32 px、3D は 1〜2 m）、
   ステージをマス数で設計する（[world-layout.md](world-layout.md) の部屋の矩形もマス数で書く）。
2. **仮組み**: `greybox` の色タイル（3D は色の箱か素のキット）で `paint` し、遊べるか確かめる（ジャンプの届き・通路の幅・敵の巡回）。
3. **素材を決める**（変換表の地域ごとの地面・壁・縁・小物に対して、上から順に試す）:
   1. **フリー素材のパック**: 形と描き込みが変換表に合うパックを 1 つ選ぶ。色だけが違うなら `look.gd recolor` でコンセプトの色へ寄せ、
      `paint` の絵を `look.gd compare` でコンセプトと比べる。フリー素材のタイルは**フォルダごと 1 回で**取り込む
      （`import_stock_asset` に `…/Tiles/` のようなフォルダを渡す。`$game-asset-tools` §3.5）。返る `tileset.files` がファイル名と
      シートの [列, 行] の対応。シートは `godot/tiles/` に置く。
   2. **コンセプトの画風で作る**: 形・描き込み・質感がパックでは合わない（色を寄せてもコンセプトに見えない）ときは、
      地形ごとに**継ぎ目なしの模様 1 枚と縁の帯 1 本**を画像生成で作り（コンセプト画像を参照に渡す）、`compose` でタイルにする（§3.1）。
      タイルシートを丸ごと画像生成しない（格子がずれ、隣とつながらない）。木・樽・看板など 1 つずつの飾りは透過画像で作って `atlas` でまとめる。
   - 利用者が上げた・生成した 1 タイル 1 ファイルの画像は、`design/tiles/src/<pack>/` に置いて `atlas` でまとめる（`godot/` の外に置くとゲームに入らない）。
   - 1 枚のシートの素材や生成した画像は `sheet` で格子を確かめる（推定が外れたら `--tile` と `--separation` を指定）。
4. **タイルセット**: `sheet.png` を見て仕様 JSON を書き、`tileset` で作る（`compose` は仕様も書く）。出力の `terrain_shapes`（地形ごとのつながり方の数）と `problems` を見る。
5. **塗る**: 仮組みと同じ文字の格子のまま、仕様の `tileset` を本物に替えて `paint` し直す。地図の正本は文字の格子なので、
   素材を差し替えても地形は描き直しにならない。
6. **確かめる**: `<room>.png` を見る（境目・段差・縁取り・赤枠）。`report.json` の `unmatched` が 0 でなければ §5。
   当たり判定と画面の見え方は、最後に実画面（`$game-playtest`）で確かめ、**コンセプトと同じ視点の実画面を `look.gd compare` でコンセプトと並べ**、
   差（明るさ・色・密度・光）を局所的に直す（`$game-art-direction` references/concept-to-map.md §4）。

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

### 3.1 模様と縁からタイルを作る（`compose`。`design/tiles/<name>.compose.json`）

```json
{
  "output": "res://tiles/cave",
  "tile": 16,
  "pixel_art": true,
  "terrains": [
    {"name": "rock", "fill": "res://art/tiles/rock_fill.png", "seamless": true,
     "top": {"image": "res://art/tiles/moss_cap.png", "width": 4},
     "edge": {"color": "#2a2622", "width": 1}, "round": 2, "collision": "solid"},
    {"name": "dirt", "fill": "#5a4330", "edge": {"color": "#3a2a1e", "width": 2}}
  ]
}
```

- 出力は `<output>.png`（地形ごとに 47 枚）・`<output>.json`（`tileset` の仕様。`corners_and_sides`）。続けて `--import` → `tileset <output>.json`。
- `fill`: 塗りの模様（1 マスの大きさへ縮める）か色。タイルは何度も繰り返すので模様は継ぎ目なしにする。生成した模様は `"seamless": true` で縁をなじませる。
  模様の正方形の 1 辺はタイルの整数倍にし、細かすぎる模様は縮めると潰れる（16 px のタイルなら 32〜64 px の模様）。
- `edge`: 空きに面した縁の帯（`image` は横長の帯。上の行が外側。または `color`）と `width`（px）。`top` / `right` / `bottom` / `left` で向きごとに替えられる
  （横スクロールの草は `top` だけ、見下ろしの崖は `bottom` を厚く）。内側の角にも帯が回り込む。`round`: 外側の角を丸める px。
- 画像生成の頼み方: 「真上（横スクロールなら真横）から見た、光の向きが無い、継ぎ目なしに繰り返せる <素材> の模様。<コンセプトの画風・色>。文字・影・枠なし」。
  縁の帯は「横長の帯。上端が空気に触れる <草・苔・縁石>」。作ったら `look.gd compare` でコンセプトの色から外れていないか見る。

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
- 3D: 層に `"mesh_library": "res://kit/dungeon_library.tres"`・`"cell_size": [1, 1, 1]`・`"floor": 0`（高さの段）を書くと `GridMap` を塗る（§6）。
- 増えた敵の巡回: タイルのナビゲーションは公式が非推奨（性能と経路の質）。`NavigationRegion2D` に地面の層から焼いた
  ナビゲーションメッシュを使う。

## 5. 塗った結果の確かめ方

- `report.json` の `unmatched`: 隣と合わない場所。`<room>.png` では赤枠。2D の原因は (1) その向きのタイルが無い → `fallback_tile` か素材を足す、
  (2) `corners` で幅 1 マスの線を塗った → 2 マス以上にするか `corners_and_sides` にする、(3) `shape` の書き間違い → `sheet.png` と見比べる。
  3D は (1) `no piece connects like …` → その並びの部品が無い（袋小路・十字路など）。格子を直すか部品を足す、(2) `hole` → 床の穴、(3) 項目名の間違い、
  (4) `floating` → 部品の底が下の物の上面から離れている（層の `floor` の付け間違いが多い）、(5) `sunk` → 下の部品にめり込んでいる（`cell_size` の高さと部品の高さが合わない・
  同じ壁を 2 段に塗った）、(6) `overlap` → 別の層の部品と同じ場所を占めている（2D は 2 つの層の当たり判定が同じマスにある）。
- **`unmatched` が 0 になるまで直してから先へ進む。** 残すのは意図した物だけで、理由を `level-design.md` に書く。
  真上の絵は高さが見えないので、3D は必ず `<room>.angle.png` も見る（浮き・めり込み・二重の壁はこちらで見える）。
- `<room>.png`: 縁取りが内側に出ていないか、段差の上下が逆でないか、模様の繰り返しが目立たないか。3D は角や扉の向き、壁の内側の面が部屋に向いているか。
- 実画面: 主役が床に立つ・壁で止まる・一方通行の足場を下から抜ける・トゲのデータが読める。タイルの間の線やにじみが無い。
  コンセプトと同じ視点で撮って `look.gd compare` で並べる（§2 の 6）。

## 6. 3D の部品（GridMap）

1. **キットを取り込む**: フリー素材の 3D キットも**フォルダごと 1 回で**取り込む（`import_stock_asset` に `kenney:3d/castle/` のようなフォルダ）。
   1 つの GLB に、ファイルごとに 1 つのノード（名前はファイル名）がまとまって返る。手元の GLB はフォルダのまま `meshlib` に渡せる。
2. **`meshlib`**: 部品ごとに 1 項目（1 つの部品の複数のメッシュは 1 つにまとめる）。項目名は部品の名前。
   - `<name>_library.png` を**必ず見る**: 部品ごとに左が真上（上が北 = -Z、右が東 = +X）、右が正面（南から見る）。番号は `items.json` の `id`。
   - 当たり判定は既定で箱（床は 0.1 m の厚みを付ける）。坂や凹凸のある部品は `--collision convex`、形どおりが必要な動かない部品だけ `trimesh`（重い）。
   - 出力の `textures` がキットの色の画像。コンセプトの色へは `look.gd recolor` でこの画像を上書きし、`--import` してから `meshlib` をやり直す。
3. **部品のつながり方を書く**: 壁・柵・道・崖の縁のように隣とつながる部品は、`legend` に `pieces` を書くと、マスごとに隣を見て部品と向き（90 度ずつ）を選ぶ。

```json
{"node": "Walls", "mesh_library": "res://kit/castle_library.tres", "cell_size": [1, 1, 1], "floor": 0,
 "legend": {
   "W": {"joins": "D", "fallback": "wall-pillar", "pieces": [
     {"item": "wall", "sides": "#.#.", "front": "E"},
     {"item": "wall-corner", "sides": "..##"},
     {"item": "tower-square-base", "sides": "###."},
     {"item": "tower-square-base", "sides": "####"}]},
   "D": {"joins": "W", "pieces": [{"item": "wall-doorway", "sides": "#.#."}]}},
 "grid": ["WWWWW", "W...W", "W...W", "WWDWW"]}
```

   - `sides`: 回していない部品がつながる向き。4 文字は北・東・南・西、8 文字は北西・北・北東・東・南東・南・南西・西（`#` つながる・`.` つながらない・`?` どちらでも）。
     真上の絵で、部品の帯がどの縁まで届いているかを見て書く。
   - 同じ文字のマスどうし、と `joins` に書いた文字のマスがつながる。同じつながり方の部品が複数あれば、マスの位置で混ぜる（模様違いの床）。
   - `front`: 部品の内側の面（飾りのある面）。部屋の内側を向くように回す。書かなければいちばん小さい回転。
   - 合う部品が無いマスは `fallback`（柱など）を置き、報告する。
   - **最初に小さな輪（`"WWW", "W.W", "WWW"` とまっすぐな 1 本）で試し**、`<room>.png` で角と向きが合ってから本番の格子に使う。
4. **床と階**: 床と壁は別の層（別の `GridMap`）に分け、同じ `floor` に置く（層が違えば同じマスに重ねられる。壁を `floor: 1` にすると 1 段浮く）。
   床の層に `"walkable": true` を書くと床の穴を報告する。上の階は `floor` を上げた層を足し、`cell_size` の高さを部品の高さに合わせる。
   部品は地図でいちばん低い面か、下の部品の上面に載っているかを確かめる。高さの地形（`$game-open-world`）に置く層は `"rests_on": "terrain"`、
   吊るす・飛ぶ飾りの層は `"rests_on": "nothing"` にすると浮きの確認から外れる。塗り直すと層は格子から作り直される（前の段の部品は残らない）。
5. **光と空気**: 部品の色を寄せても、光・霧・空が違えばコンセプトに見えない。`design/palette.json` の `suggest`（環境光・影・主光の色）と
   変換表の光・霧を `WorldEnvironment` と光源に入れ、実画面で比べる（`$game-art-direction` references/concept-to-map.md）。
