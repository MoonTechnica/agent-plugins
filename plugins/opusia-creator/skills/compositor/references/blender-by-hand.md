# Blender（bpy）で 3D の演出を作る

プリビズの文書（three.js）では作れない 3D —— **物理**（崩れる・散らばる・転がる）、**粒子**、
**ジオメトリノード**、布・煙、Blender の材質と輪郭線（Freestyle）—— を、Python の `bpy`
（Blender をモジュールとして使う公式パッケージ）で組み、**透過付きの動画**に書き出して
composition に重ねる。型は [blender_template.py](blender_template.py)。

**サーバーの GPU は使わない。** `bpy` は**エージェントの作業環境**（デスクトップの手元のエージェントなら
利用者の Mac / PC、クラウドのエージェントならその作業環境）で動かし、書き出した動画を素材に戻す
（director の references/local-vs-server.md と同じ往復）。

## 1. 使ってよいとき

| 状況 | 使うもの |
|---|---|
| キャラ・小物・カメラワーク・板・2D のカード | プリビズの文書（`place_previz_clip` で置く）。こちらが先 |
| 物理・粒子・ジオメトリノード・布・煙・Blender の材質で見せる 3D | **これ（bpy）** |
| プリビズで組んだ場面を、被写界深度・グロー・厚みのある文字で仕上げる | **これの §7（橋）** |
| 字が奥行きへ散る・押し出した立体文字（短い・軽い） | three.js の直書き（[three-by-hand.md](three-by-hand.md)）でも bpy でもよい。物理が要るなら bpy |

- **手元のエージェントでもクラウドのエージェントでも動く**（クラウドでも `bpy` が動いたことを利用者が
  確認、2026-11-12）。ただし描く速さは作業環境で大きく違う（GPU の有無・CPU の数）。**本番の前に必ず
  `--preview` で 1 秒ぶん描いて所要時間を測り**、全体の時間を見積もってから本番の解像度で書く。
  遅すぎるなら区間に割るか、手元のエージェント（GPU のある Mac / PC）で続けるよう利用者に相談する
- 書き出しは 1 つの手続きで 1 本の動画を作る（HyperFrames のように並列のワーカーが飛び飛びの時刻を
  描くわけではない）。物理は書き出す前に焼くので、同じスクリプトから同じ動きが出る。GPU の都合で
  数画素・数値 1 程度の差が出ることはある（目には見えない。2026-11-11 実測）

## 2. 手順

```
1. 道具を確かめる     uv --version（無ければ利用者に入れてもらう。勝手に入れない）
2. 型を写す           references/blender_template.py を作業場所へ。build() だけを書き換える
3. 半分の解像度で試す  uv run --no-project --python 3.13 --with bpy==5.3.0 python scene.py \
                        --out out.webm --width 1920 --height 1080 --fps 24 --seconds 4 --preview
4. 見る               ffmpeg で数コマを PNG に抜き、明るい地に重ねて見る（透過・輪郭線・動き）
5. 本番の解像度で書く  --preview を外す
6. 素材に戻す         create_upload_ticket → PUT → register_upload（§4）
7. composition に置く  <video> のクリップ、またはプリビズの 2D のカードの中身（§5）
```

- 初回は `bpy`（数百 MB）の取得に数分かかる（手元の Mac で実測 約 8 分）。2 回目からはキャッシュで数秒
- `bpy` は **Python 3.13 専用**（Blender の版ごとに 1 つ）。`--python 3.13` は外さない。版は固定する（`==5.3.0`）
- 重さの目安: EEVEE・トゥーン・輪郭線・剛体 65 個で、640×360 の 48 コマが約 31 秒（Apple Silicon の Mac）。
  1080p は画素が 9 倍。長い・重い場面は区間（`frame_start` / `frame_end`）に割って書く

## 3. 型が守っていること（消さない）

| 守ること | 外すと |
|---|---|
| `film_transparent = True` と RGBA の WebM（VP9 + アルファ）を Blender が直に書く | 背景が塗られ、composition の 2D が透けない |
| 書き出す前に物理を焼く（`ptcache.bake_all`）。乱数は種を決める（`random.seed`、粒子の `seed`） | 区間ごとに書いたときや書き直したときに動きが変わる |
| 輪郭線は線のセットを**自分で作る**（`freestyle_settings.linesets.new`） | `use_freestyle` だけでは線が 1 本も出ない（実測） |
| トゥーンは `Shader to RGB` → 段の `ColorRamp`（`CONSTANT`）→ 放射 | EEVEE 専用。Cycles では `Shader to RGB` が使えない |
| 日時・描画時間を画像に書き込まない（`use_stamp_*`） | 同じ場面から違うファイルが出る |
| 工場出荷の設定・空の場面から組む（型の `setup()`） | 作業環境の Blender の設定が混ざる |
| 解像度と fps は**シーンの composition と同じ** | 重ねたときに位置・速さがずれる |

プリビズのカメラに合わせるなら `previz_camera()`（three.js の Y 上 → Blender の Z 上は
`(x, y, z) → (x, -z, y)`、縦の画角は `sensor_fit = VERTICAL` と `lens = (sensor_h / 2) / tan(fov / 2)`）。
カメラが動く場面は、プリビズの文書のカメラのキー（`keys.translation` と注視点）を同じ式で変換し、Blender のキーとして打つ。

## 4. 素材に戻す

- `create_upload_ticket` → 返った `curl` で PUT（`content_type: "video/webm"`）→ `register_upload`
- `name` は何の演出か分かる名前（`S3 積み木が崩れる (blender)`）
- `params` に作り方を残す: `{"type": "blender", "tool": "bpy 5.3.0", "engine": "BLENDER_EEVEE",
  "frames": 96, "fps": 24, "script": "<build() の要点を 1〜2 行>"}`。元の素材（プリビズ・絵）から
  作ったなら `source_asset_id`
- スクリプトは作業場所に残し、直すときは同じスクリプトを直して書き直す（書き出した動画を加工しない）

## 5. composition に置く

- **2D の上に重ねる**: `<video id=… data-start data-duration data-track-index … muted playsinline>` を
  `data-var-src` で素材に束ねる。透過のまま重なる（HyperFrames 0.9.30 の書き出しで、奥の 2D が
  透けることを確認）。`crossorigin` は付けない（プレビューの規則）
- **3D の空間に置く**: `<video>` を `<div data-previz-card>` で包み、プリビズの 2D のカードにする
  （[illustration-mv.md](illustration-mv.md) §3）。プリビズのカメラで動く
- 音は付けない（Blender で音を扱わない。音はタイムラインが持つ）

## 6. やらないこと

- Blender（GPL）をアプリに同梱しない・サービスのサーバーに置かない。作業環境で、その都度 `uv` が取ってくる
- 写真のようなリアルさのために Cycles で長時間描かない（作業時間を食う。必要なら利用者に相談）
- 書き出した動画を見ずに戻さない

## 7. プリビズの文書を Blender で描く（橋）

構図とカメラはプリビズのエディタで決め（その場で見られ、`probe_previz_scene` で測れる）、**仕上げだけを Blender で描く**。
被写界深度・グロー・文字の厚み・Blender の材質が、モデル・板・カードに一様に掛かる。
同じ文書から「速い下見（three.js）」と「仕上げ（Blender）」の 2 通りが出る。

```
1. get_previz_scene → 返りの doc を doc.json に保存する
2. node <previz の SKILL_DIR>/scripts/previz_sample.mjs doc.json --out frames.json
     （プレイヤーと同じ evaluate でコマごとの値にする。動きを Python で計算し直さない）
3. 素材を落とす: get_asset_preview(<素材 id>).url を curl -L -o（GLB・画像。VRM は扱わない）
4. uv run --no-project --python 3.13 --with bpy==5.3.0 \
     python <SKILL_DIR>/references/previz_to_blender.py --frames frames.json --out shot.webm \
     --asset <素材 id>=<パス>（モデル・画像の数だけ） --card <カードの名前>=<透過の動画か連番 PNG> \
     --font sans=<ttf> [--text-depth 0.05] [--focus <ノード id> --fstop 2] [--glow 0.8] --preview
5. 見て直す（§2 の 4）→ --preview を外して本番 → 素材に戻す（§4）→ composition に重ねる（§5）
```

| 文書 | Blender での扱い |
|---|---|
| 位置・回転・大きさ・見え隠れ・カメラ（`aim` / `follow_path` / 曲線の経路 / カットの切り替え） | コマごとのキー（evaluate の値そのまま） |
| `render.look`（previz / toon / flat）・`steps`・`outline` | 材質（toon は Shader to RGB の段）と Freestyle の線 |
| `render.post.bloom` | 合成の Glare（Bloom）。`--glow` で強さを上書き |
| 画像の板・文字の板・カード | 光を受けず輪郭線を引かない板（プレイヤーと同じ） |
| 芝居（`motion`） | GLB のクリップを NLA に置き、時刻をキーで打つ（`loop: repeat` はクリップの長さで回す） |
| 光 | 太陽・点・スポット・環境光（強さは目安の換算。見て直す） |

- **被写界深度**は `--focus <ノード id>`（そのノードに焦点）と `--fstop`（小さいほどぼける）。文書には持たない
- **文字の太さ**: Blender は可変フォントの太さを選べない。太さごとの静的なフォント（例: Noto Sans CJK JP の Black）を `--font` に渡す
- **カード**の中身は透過の動画か連番 PNG（`--card`）。シーンの頭からの同じ尺で作る。composition の 2D
  （パペット・歌詞の組版）なら、背景を塗らない composition（`html` / `body` / root に背景色を書かない）にして
  `render_composition(composition_id, video_format="webm")` で透過の WebM に書き出し、
  `get_asset_preview(<出力の素材>).url` を落として渡す（単価は mp4 と同じ。4k の composition は透過で書けない）
- `render.post` の色調・周辺減光は写さない（Blender の合成で足すなら見て決める）。`front` は使わない（Blender は奥行きで正しく隠し合う）
- **EEVEE が起動しない環境**（GPU の無い作業環境で落ちる・真っ黒になる）は `--engine cycles`（CPU。トゥーンは平らな塗り）
- 2026-11-11 に検証: 鉄骨の前後・映像のカード・画像の板・文字の板（厚み付き）・クリップ付きの GLB・曲線の経路・
  焦点・グロー・トゥーンと輪郭線を 640×360 の 73 コマで描き（Mac で約 100 秒）、透過の WebM になった

