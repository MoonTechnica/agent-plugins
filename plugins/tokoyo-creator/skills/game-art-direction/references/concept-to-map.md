# コンセプトの雰囲気をマップへ移す

コンセプト画像（`design/concept/key-art.png`）は 1 場面の完成イメージで、マップは歩き回る場所全体。
そのままでは「どの地面・どの壁・どの光か」が決まらないので、コンセプトを**変換表**に書き下ろし、マップの素材・照明・小物は変換表を正にして作る。
最後に、実画面をコンセプトと並べて差を直す。並べて確かめた範囲だけを「コンセプトに近い」と言う。1 枚の絵と完全に同じには見えない。

## 1. ツール（コピーしない。ゲームには入らない）

```bash
LOOK=<kit>/skills/game-art-direction/assets/look.gd   # 画像をファイルのまま読む。--import も GPU も要らない
godot --headless --path <source>/godot -s $LOOK -- palette <source>/design/concept/key-art.png --out <source>/design/palette.json
godot --headless --path <source>/godot -s $LOOK -- compare <source>/design/concept/key-art.png <実画面.png> [--out <比較.png>]
godot --headless --path <source>/godot -s $LOOK -- recolor res://<画像>.png --palette <source>/design/palette.json --out res://<画像>.png [--mode transfer|map] [--strength 0.7]
godot --headless --path <source>/godot -s $LOOK -- recolor-kit res://kit/<name>_library.tres --palette <source>/design/palette.json [--strength 0.7]
```

| コマンド | すること |
|---|---|
| `palette` | コンセプトの主な色と面積、明るさ（平均・暗部・明部・コントラスト）、鮮やかさ、暖かさ、環境光・影・主光の色の提案を `palette.json` に書き、色の帯の絵（`palette.png`）を出す |
| `compare` | コンセプトと実画面を色の帯つきで並べた絵と、差（明るい / 暗い、コントラスト、鮮やかさ、暖かさ、コンセプトにあって画面に無い色、画面で大きいのにコンセプトに無い色）を出す |
| `recolor-kit` | 3D キットの材質の色（色の画像の無い材質だけ）を同じ方法で寄せ、MeshLibrary を上書きする。色の画像がある材質はその画像を `recolor` する |
| `recolor` | 画像をコンセプトの色へ寄せる。`transfer` は色の傾向だけを合わせて描き込みを残す（既定）。`map` は明るさの順にパレットの色で塗り直す（ドット絵向き・強い）。透明は保つ。`--strength` で寄せ具合 |

## 2. 変換表（企画のターン、コンセプトを作った直後）

`palette` を走らせ、`design/style-guide.md` に「マップへの変換表」を書く。地域（または部屋の種類）ごとに 1 行。

```markdown
## マップへの変換表（正: design/concept/key-art.png・design/palette.json）
| 地域 | 地面 | 壁・縁 | 色（palette の番号） | 小物と密度 | 光・霧・空 | 見通し |
|---|---|---|---|---|---|---|
| 城の外郭 | 湿った石畳、継ぎ目に苔 | 灰青の石壁、上端だけ明るい | 1 3 4（暗く冷たい） / 灯り 8 | 松明 4 マスに 1、樽は門の周りだけ | 夜、霧は濃い青、窓と松明だけ暖色 | 門から中庭が見え、奥は霧で隠れる |
| 中庭 | ... | ... | ... | ... | ... | ... |
```

- 書くのはコンセプト画像に**見えているもの**と、そこから自然に続くもの。画像に無い地域は、同じ色と光の規則で決めて「推測」と書く。
- `palette.json` の `light`（暗部・明部・コントラスト）と `suggest`（環境光・影・主光）は照明の出発点。数値をそのまま合格線にしない。
- 空間の作り（見通し・圧縮と解放・目印）は `$game-level-design` references/genre-spaces.md、配置は world-layout.md。変換表は見た目の正本。

## 3. 素材を変換表に合わせる（上から順に試す）

1. **パックを選ぶ**: 形・描き込み・視点・比率が変換表に合うパックを 1 つ（2D は `$game-level-design` references/tilemaps.md §2、
   3D はキットのフォルダ取り込み）。色を見て決めない。色はあとで寄せられるが、形と描き込みは寄せられない。
2. **色を寄せる**: パックのシート（2D）やキットの色の画像（3D。`meshlib` の出力の `textures`）を `recolor` で上書きする。
   色の画像が無く材質の色だけで塗ったキットは `recolor-kit` で MeshLibrary の材質の色を寄せる。
   まず `transfer`、ドット絵で色数を揃えたいときは `map`。寄せすぎて読みにくくなったら `--strength` を下げる。
   `--import` してから塗り直し、`paint` の絵を `compare` でコンセプトと並べる。
3. **コンセプトの画風で作る**: 形や質感がどのパックでも合わない（色を寄せてもコンセプトに見えない）とき。
   - 2D: 地形ごとに継ぎ目なしの模様と縁の帯を画像生成で作り、`tiles.gd compose` でタイルにする（tilemaps.md §3.1）。
   - 3D: 地面・壁は単純な形（キットや `$game-3d-studio` のモデリング）に、生成した模様を材質として貼る。
     目印になる建物・主役級の物だけを画像→3D で作る（`$game-3d-studio`）。
   - どちらも生成はコンセプト画像を元にする: `generate_image` は参照の画像を受け取らないので、コンセプト画像の素材に `edit_image` で
     「この絵の画風と色で <模様・部品> を描く」と頼む。指示には style-guide の 5 行と変換表の行を入れる。費用は SKILL §4 の素材一覧の予算に入れる。
4. 混ぜた素材は `asset-manifest.md` に **採用 / 加工して採用 / 置換** と理由を書く（SKILL §5）。

## 4. 光・空気・小物

- 3D: `WorldEnvironment` の背景（空・霧の色）・環境光・トーンマップ・露出、主光の色と向きを変換表の「光・霧・空」から決める。
  `palette.json` の `suggest` を起点に、実画面で調整する（references/visual-direction.md §5）。
- 2D: `CanvasModulate`・背景の層・光（`PointLight2D`）で全体の明るさと色を合わせる（§4）。
- 小物は変換表の密度で置く。同じ小物を等間隔に並べず、話のある所（門・角・行き止まり）に寄せる（`$game-level-design` §1「場所で語る」）。

## 5. 並べて直す

1. **データの段階**（安い。いつでも）: `paint` の絵（2D のタイル、3D の真上の絵）を `compare` に渡し、色の外れを早めに見つける。
   3D の真上の絵には空や光が無いので、明るさ・空の色の差はここでは見ない。
2. **実画面**（新規制作・見た目の方向の変更・利用者の依頼の時。`$game-playtest` references/visual-observation.md の代表場面）:
   コンセプトと**同じ視点・同じ時間帯**の場面で撮り、`compare` で並べる。`gaps` と並べた絵を見て、
   - 明るさ・コントラスト → 露出・環境光・トーンマップ・光の強さ
   - 色の外れ（コンセプトに無い大きい色）→ その素材を `recolor`、または材質の色
   - コンセプトの色が無い → 空・霧・灯りの色、小物
   - 密度・見通しの差 → 小物の数と配置、霧の距離
   の順に局所的に直し、同じ視点で撮り直す。直した事と残った差を `design/playtest.md` に書く。
3. 数値の差が小さくても、並べた絵で雰囲気が違えば直す。数値だけで「コンセプトどおり」にしない。
