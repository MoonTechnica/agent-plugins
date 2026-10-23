# 全体図から作る（2D・3D・広い世界）

プロの制作は「上から見た配置図で合意 → 図形で歩ける仮組み → 試遊で直す → 美術 → 光 → 仕上げ」の順で進む
（Bethesda・Skyrim のモジュール、BotW のフィールド、Hollow Knight の部屋の作り方）。この順に沿う。
配置の正本は **`design/world-map.json`** の 1 つだけにし、地形の生成・全体図・プレイヤー用の地図・検査が同じファイルを読む。
コンセプト画像は雰囲気の資料で、場所の配置の正本にしない。
出典はサービス側の調査記録（`docs/_research/2026-10-23-map-making-process.md`。作業環境には無い）。

**使う時**: 空間が遊びの中心の作品（探索・広い世界・ダンジョン・メトロイドヴァニア・RPG のフィールド・複数の部屋/ステージ・対戦マップ）の
新規制作と、配置を大きく変える依頼。単画面・エンドレス・パズル 1 面・空間を使わない作品は使わない。局所修正は変わる所だけ。

## 1. ツール

```bash
TOOL=<kit>/skills/game-level-design/assets/world.gd   # コピーしない。ゲームには入らない
godot --headless --path <source>/godot -s $TOOL -- build <source>               # 広い世界の地形を作る
godot --headless --path <source>/godot -s $TOOL -- overview <source> --concept  # 全体図と検査
```

`<source>` は `design/` と `godot/` を持つゲームのソースのディレクトリ（`$game-playtest` のルール検査と同じ固定版の Godot）。

- `build`（`kind: "open_world"` だけ）: `godot/terrain/height.bin`・`vegetation.bin`・`features.bin` を書く（§4）。1024² で数秒。
- `overview`: `design/overview.png`（検査の印つき）と `design/world-report.json`（数値と `warnings`）を書く。
  `--concept` を付けると利用者に見せる `design/concept/map.png`（印なし）も書く。GPU は使わない（データから描く）。
- 図の記号: ●＝主な場所（番号つき。大きい●は major）・▲＝目印・白い●＝開始地点・青＝川・黄土＝道・暗い線＝地域の境界・1 km（または指定）の格子。
  検査の図だけ、場所の無いマスを赤い斜線、道から見えない目印を赤い▲、行けない部屋を暗く、理由の無い行き止まりを斜線で示す。
  **番号の名前は `design/level-design.md` に同じ番号で並べる**（図には文字を描けない）。
- 同じファイルと `seed` なら同じ結果になる。直すときは `world-map.json` を直して作り直す。

## 2. 企画のターンで合意する（新規制作）

既存の企画のターン（`$game-art-direction` §2）に全体図を**同梱**する。承認待ちを増やさない。

1. 体験と核の仕掛けを決め（`$game-design`）、該当ジャンルの空間の手を選ぶ（[genre-spaces.md](genre-spaces.md)）。
2. `world-map.json` のスケッチ版を書く。粒度は「北の雪山が目印、川沿いに村、東に遺跡」程度。2D/部屋型は部屋のつながりと能力の順序。
3. `build`（広い世界のみ）→ `overview --concept`。`world-report.json` の `warnings` を見て、企画の段階で直せるもの
   （行けない部屋、道筋の途切れ、空白だらけ）は直してから出す。
4. `design/concept/map.png` を `key-art.png` / `hero.png` と一緒に置く。`level-design.md` に番号と名前・各地域の雰囲気・主な道筋を書く。
   利用者は雰囲気（コンセプト画像）と配置（全体図）を同時に承認・差し戻しできる。

## 3. 種類ごとの進め方

### 3.1 2D（部屋・ステージ・見下ろしのフィールド）

| 段階 | 作るもの | 確かめること |
|---|---|---|
| 企画 | `world-map.json`（`kind: "areas"`。部屋の矩形・地域・つながり・能力のゲート・開始・主な道筋）と全体図 | 能力を得る順で全部屋に行けるか、主な道筋が実際のつながりを通るか（`overview`） |
| 仮組み | 部屋ごとのシーンに色の板のタイル（[tilemaps.md](tilemaps.md) の `greybox` → `paint`。地形が自動でつながる） | ジャンプ・落下の到達（`rules.gd`、[checks.md](checks.md) §4）、部屋の出入口が `world-map.json` のつながりと一致するか |
| 美術 | 素材のタイルセットを作り、同じ文字の格子で塗り直す・背景・飾り（[tilemaps.md](tilemaps.md)） | `report.json` のつながりの合わない場所、差し替え前後で当たり判定が同じか |
| 仕上げ | `world-map.json` を実際の部屋に合わせて更新し `overview` をもう一度 | 行き止まり・使われない部屋・セーブ地点の間隔 |

- 1 ステージ 1 仕掛けで「学ぶ → 応用 → ひねり → 習熟」（任天堂の起承転結）。メトロイドヴァニアは能力の順序と中心の地域から決め、
  地域どうしの接続を多めにして迷わせすぎない（Hollow Knight）。ローグライクは必ず解ける骨格を先に作り、部屋の部品で肉付けする（Spelunky / Dead Cells）。
- 部屋は 1 シーン（`TileMapLayer` 群と出入口のノード）にする。場所の切り替えは [transitions-and-map.md](transitions-and-map.md)。

### 3.2 3D 小〜中規模（部屋・ダンジョン・アリーナ・町）

| 段階 | 作るもの | 確かめること |
|---|---|---|
| 企画 | `world-map.json`（`kind: "areas"`。エリアの矩形・高さの違いは名前とメモ・つながり・目印・主な道筋）と全体図。`level-design.md` に寸法（体の大きさ・ジャンプ・通路幅） | つながりと主な道筋（`overview`）。対戦は線対称か・1 点から全部の要所を守れないか |
| 寸法見本 | 段差・隙間・通路幅を並べた小さなシーン | 操作で登れる・跳べる値（`rules.gd`） |
| 仮組み | CSG か GridMap（[tilemaps.md](tilemaps.md) の `meshlib` → `paint`）。部品は互いの倍数の大きさ、スナップは大きく、ピボットは床の中心（Skyrim のキットの規則） | コードで navmesh を焼いて歩ける範囲と孤立した床、出入口の幅 |
| 美術・光 | Blender スクリプトの部品か CC0 キットで置き換え、CSG はメッシュに変える | 当たり判定が仮組みと同じ範囲か |
| 仕上げ | `world-map.json` を実際に合わせて `overview` | 報酬・敵の偏り、使われない部屋 |

### 3.3 3D 広い世界（〜8 km）

| 段階 | 作るもの | 確かめること |
|---|---|---|
| 企画 | `world-map.json`（`kind: "open_world"`。地域・目印・川・道・主な場所・開始）→ `build` → `overview --concept` | 地域の重なり、開始から主な目印への道があるか |
| 地形 | `build` が作る高さ・植生・道/川（§4）。ゲームは `$game-open-world` の実装例で読む | 川が下り続けるか、道の勾配、町の平らさ、歩ける割合（`world-report.json`） |
| 配置 | 主な場所の小さな仮組み（建物の箱・野営地の囲い）を地域 pack に置く。植生は密度マップ×規則 | 場所の無いマス、道から遠い場所、等間隔すぎる配置 |
| 全体図の確認（1 回目） | `overview` | `warnings` を読み、**足りないマスへ場所や地形の変化を足し、そこだけ作り直す**。全体を作り直さない |
| 代表区間の仕上げ | 開始地点の周りを素材・光まで仕上げる | 実際の画面で、目印が霧や木に隠れていないか（`$game-playtest` の実画面の確認） |
| 仕上げ後の全体図（2 回目） | `overview` | 1 回目から直した所 |

- 大きな形と骨格（地域・山・谷・道・川）は意図して置き、細部（侵食・植生・岩）は規則で埋める（Far Cry 5 の手続きツール、
  Horizon Zero Dawn の描ける密度マップ、Unreal の道/川のスプライン）。
- **引力の連鎖**: 高い所や道から次の目印が見えるように置く（BotW）。`world-report.json` の `landmark_visibility` で確かめる。
- 密度・見通しの距離などの目標値は作品の brief から `targets` に書く。大作の数（祠 120、Skyrim のダンジョン数）を目標にしない。

## 4. `design/world-map.json`

座標は m。広い世界は世界の中心が原点（`x` 東、`z` 南）。部屋型は任意の単位（タイル数など）。

```json
{
  "version": 1,
  "kind": "open_world",
  "size": [8192, 8192],
  "height_scale": 400,
  "seed": 7,
  "start": [-2600, 2400],
  "regions": [
    {"id": "meadow", "name": "南の草原", "polygon": [[-4096, 600], [4096, 600], [4096, 4096], [-4096, 4096]],
     "base_height": 40, "roughness": 0.3, "vegetation": 0.6}
  ],
  "landmarks": [{"id": "snow_peak", "name": "白い峰", "at": [2600, -2400], "shape": "cone", "radius": 900, "height": 220}],
  "rivers": [{"id": "silver", "points": [[2200, -1800], [600, 600], [-3400, 3600]], "width": 36, "depth": 6}],
  "roads": [{"id": "main", "points": [[-2600, 2400], [400, 300], [2300, -1700]], "width": 14, "max_grade": 0.12}],
  "pois": [{"id": "village", "name": "川辺の村", "kind": "town", "at": [-2600, 2400], "radius": 140, "major": true}],
  "targets": {"poi_cell_size": 1024, "max_poi_road_distance": 400, "landmark_view_distance": 2000, "max_walk_slope": 0.7}
}
```

- `regions`: 多角形で塗り分け。`base_height`（m）・`roughness`（0〜1。起伏）・`vegetation`（0〜1。木の密度）は境界でなめらかにつながる。
- `landmarks.shape`: `cone`（三角形の山。BotW の大きい三角）・`dome`（丘）・`plateau`（台地）・`spire`（尖塔岩）。
- `rivers` は**水源から河口の順**に点を並べる。川床は下流へ下がり続けるよう掘られる。`roads` は勾配が `max_grade` を超えないよう均される。
- `pois.kind`: `town` / `camp` / `ruin` / `shrine` / `boss` は色分けされる（ほかの名前も使える）。周り `radius` が平らになり木が生えない。
- `build` の流れ: 地域の高さと起伏 → 目印の盛り上げ → 川を掘る → 道を均す → 場所を平らに → 軽い侵食（道・川・町は除く）→ 植生の密度
  （傾き・雪線・道/川/町からの除外）。`erosion_passes`（既定 4）と `targets.snow_line` で調整できる。

部屋・エリア型（`kind: "areas"`）:

```json
{
  "version": 1,
  "kind": "areas",
  "start": "crossroads",
  "critical_path": ["crossroads", "caves", "dash_shrine", "caves", "crossroads", "cliffs", "throne"],
  "areas": [
    {"id": "crossroads", "name": "分かれ道", "rect": [0, 0, 4, 3], "region": "hub", "role": "hub"},
    {"id": "dash_shrine", "name": "ダッシュの祠", "rect": [-9, 6, 3, 2], "region": "caves", "grants": ["dash"]},
    {"id": "throne", "name": "王座", "rect": [10, -6, 3, 3], "region": "cliffs", "role": "goal"}
  ],
  "links": [{"from": "crossroads", "to": "cliffs", "gate": "dash"}, {"from": "ledge", "to": "pit", "one_way": true}]
}
```

- `grants` はその部屋で得る能力、`gate` はその能力が要るつながり、`one_way` は片道。`role` に `goal` / `reward` / `hub` などを書くと、
  行き止まりの理由として扱われる。
- 検査: 能力を得る順に辿って行けない部屋、理由の無い行き止まり、主な道筋の途切れ。

## 5. 検査の結果の使い方

- `world-report.json` の `warnings` は**直す候補**で、合否の自動判定ではない。作品の意図で残す場合（荒野の空白、秘密の場所）は
  `level-design.md` に理由を書く。
- 直すときは `world-map.json` を変えて `build` / `overview` をやり直す。手で `height.bin` を書き換えない。
- 全体図はデータの図で、実際の画面の見え方（霧・植生・光）の証拠ではない。見え方は代表区間の実画面で確かめる。
- 返事には「どんな配置にしたか」「全体図で確かめたこと・残る warnings とその理由」を短く書く。
