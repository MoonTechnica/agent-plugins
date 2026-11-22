# レイヤーで付ける二次運動（髪・服・リボン・マント・旗）

1 枚のイラストを**揺れるパーツ**と**動かない体**のレイヤーに分け、パーツだけを
WebGL の網（PixiJS の `MeshPlane`）で曲げる。After Effects のパペットツールと同じ考え方で、
「根元（ピン）を固定し、先へ行くほど大きく・遅れて動く」を式で書く。動画生成を
使わないので、**絵が一切崩れず、何度書き出しても同じフレームになる**。

使う場面: 「髪をなびかせて」「スカート / 裾 / マントを風で揺らして」「リボンを揺らして」
「旗をはためかせて」「立ち絵を少し動かして」「パペットみたいに」。
使わない場面: 人物が歩く・振り向く・表情が変わる（パーツの揺れでは足りない。動画生成へ）。

型は [layer-rig.html](layer-rig.html)、パーツの設定は `scripts/rig_parts.py` が出す。

## 1. 手順

```
1. 絵を用意する              # 既にある立ち絵でよい。新しく描くなら §2 のとおり描かせる
2. レイヤーに分ける           # generate_asset: seedream-5-layerize (task image_layerize)
3. 分かれ方を見る             # get_asset_preview で 1 枚ずつ。足りなければ prompt を変えて 2 をやり直す
4. 位置と重なり順を写す       # get_asset(<どれか 1 枚>) の asset_versions[-1].meta.layers を layers.json へ
5. パーツの設定を出す         # python3 <SKILL_DIR>/scripts/rig_parts.py --layers layers.json --size WxH --part ... --json
6. HTML を組む                # layer-rig.html を写し、3 か所だけ書き換える（§4）
7. put_composition_bundle → bind_composition_variable（パーツの数だけ）→ いつもの検査（SKILL.md §2）
```

### 2. の指示（layerize の prompt）

**分けたいものを名指しし、残りは 1 枚にまとめさせる。** 名前は出力の `name` に
そのまま返ってくる（`--part` に書く名前）。

```
Separate the parts that should sway in the wind as their own layers: the left twin tail,
the right twin tail, and the pleated skirt. Keep the rest of the character (face, bangs,
head, blazer, arms, legs) as one layer.
```

返り値は「ベース + 最大 16 レイヤー」。**ベース（z_index 0）は背景**で、キャラは全部
レイヤー側に入る。背景を抜く手間（透過の生成・背景除去）は要らない。
課金は**レイヤー 1 枚ごと**なので、分けるものは揺らすものだけにする。

## 2. 絵の描かせ方（新しく描くとき）

- **揺らすパーツは体から離して垂らす**（ツインテールが肩・腕の外側に垂れる、マントが
  体の後ろに広がる）。layerize は隠れていた部分を描き足すが、重なりが少ないほど崩れない
- 正面〜斜め前、腕は体の横。パーツの根元（結び目・ウエスト・肩）が見えていること
- 1 人だけ、小物なし。背景は単色でよい（ベースとして分かれる）

## 3. パーツの種類（`--part "<name>=<kind>"`）

| kind | 揺れ方（mode） | 支点の既定 | 向くもの |
|---|---|---|---|
| `hair-strand` | swing（根元で回る） | 上端の中央 | ツインテール・ポニーテール・横の房・三つ編み |
| `hair-bangs` | swing（小さく速く） | 上端の中央 | 前髪・触角毛 |
| `hair-back` | shear（横へずらす） | 上端 | 幅のある後ろ髪 |
| `ribbon` | swing（大きく速く） | 上端の中央 | リボンの垂れ・ネクタイの先・紐 |
| `skirt` | shear | 上端（ウエスト） | スカート |
| `coat-hem` | shear（小さく） | 上端 | コート・ブレザーの裾 |
| `cape` | wave（波打つ） | 上端（肩） | マント・ケープ・長いスカーフ |
| `flag` | wave（横に） | 左端 | 旗・のれん・横になびく布 |

- `--part` に無いレイヤーは**動かさない**（体・顔）
- 支点が上端の中央に無いとき（結び目が右寄り）は `--pin "<name>=0.8,0.05"`（左上からの比率）
- **肩の後ろに垂れる房は `--back "<name>"`** で一番奥へ回す。layerize の重ね順は
  **止まった絵の順**なので、揺れて体の前へ回り込むと服の手前に描かれる（実測: 突風で
  右の房がスカートの前に出た）。前に垂らした髪（胸の前の房）には付けない
- 尺は `--duration`。既定の風は尺の 25〜37% で突風が来て 62〜80% で収まる。
  ずっと穏やかにするなら `--wind breeze`
- 種類が合わなければ一番近いものを選び、書き出したコマを見てから JSON の
  `amp`（swing はラジアン、shear / wave は長さに対する比率）/ `speed` / `lag` / `drift` を直す

## 4. HTML の書き換え（3 か所だけ）

1. root の `data-composition-id`（キャラごとに `rig-<名前>`）/ `data-width` / `data-height` /
   `data-duration`（尺は `--duration` と同じ値）
2. 素材の `<img data-rig-part="N" data-var-src="<変数id>">` を **parts の数だけ**。
   **N は parts の並び順**（描く順）。その変数には **layerize の出力のうち
   `parts[N].index` 番目の素材**を束ねる（`--back` で描く順が変わっても index は変わらない）。
   出力の素材名は `<label>`（index 0 = ベース）、`<label> (2)`、`<label> (3)`… の順で、
   **index i が `(i+1)`**。束ねる前に `get_asset_preview` で絵柄を確かめる。
   `<html data-composition-variables>` にも**同じ数・同じ id** の宣言（`type: "string"`、
   `default: ""`）を並べる。宣言が無いと lint が `unknown_variable_binding` を出し、
   束ねても差し込まれない
3. `<script type="application/json" data-rig>` の中身を `rig_parts.py --json` の出力に差し替える

動きの式（`place` / `deform`）は**触らない**。揺れ方は JSON の値で変える。

## 5. 守ること（外すと壊れる。どれも実測で踏んだもの）

| 守ること | 外すと |
|---|---|
| **レイヤー画像は bounding box の寸法へ縮めて貼る**（型がやっている。消さない） | layerize は小さいパーツを**高い解像度**で返す（スカートは bbox 534×221 に対して画像 1109×460）。そのまま貼ると 2 倍に広がる |
| **分解した後のレイヤーだけを使う**（元の絵と混ぜない） | layerize は**描き直し**。組み直すと元の絵とほぼ同じだが、リボンの形や毛束は少し違う |
| 描くのは `hf-seek` を受けたときだけ・入力は時刻 t だけ | `requestAnimationFrame` / `performance.now()` / 前のフレームからの積み上げで動かすと、シークと書き出しで絵が変わる |
| 素材を読み始めるのは**最初の `hf-seek`**（型がやっている） | ランタイムが変数を `<img>` に差し込むのは script の実行より後。読み込み時に `src` を見ると空で、書き出しが `rig: could not load` で落ちる（実測: `GET /null`） |
| root に `data-duration` と `data-no-timeline` | 長さが分からず書き出しが落ちる / 書き出しのたびにタイムラインを 45 秒待つ |
| `querySelector` にテンプレートリテラル（`` `${n}` ``）を使わない | lint の error（公式バンドラの CSS パーサが落ちる） |
| 型の先頭コメントにタグを書かない | JSON の貼り込みの置換がコメントの中で効き、root が壊れる |
| `crossOrigin` は**自分で作った `Image`** にだけ（型がやっている） | WebGL のテクスチャは CORS が要る。プレビューの `<audio>` / `<video>` には付けない（別の規則） |
| 素材の `<img>` は表示しない（`display: none`） | 元の絵が網の下に重なって二重に見える |

## 6. 確かめ方

- `put_composition_bundle` の lint が 0 error であること（素材を束ねる前は同じ空の
  `src` が並ぶので `duplicate_media_discovery_risk` の warning が出る。無害で、束ねれば消える）
- 書き出したら、**突風の山（尺の 30〜45%）と静かなところ**のコマを見る。
  見るのは: 根元に段差が無いか / パーツが体の前へ回り込んでいないか（→ `--back`）/
  スカートが広がりすぎていないか（→ `amp`）/ 輪郭の外に欠片が残っていないか
- 2026-11-11 時点で**ローカルの HyperFrames 0.9.30 の書き出しでは**、変数経由
  （`--variables` で素材を差し込み）でも、同じ composition を 2 回書き出して全フレームの
  ハッシュが一致した（720×1080・8 秒・髪 2 + スカート 1 で約 6 秒）。
  **Studio のプレビューと `render_composition`（Cloud）での実機確認はまだ**なので、
  初回は書き出したものを必ず `get_asset_preview` で見る。テクスチャが読めないとき
  （コンソールに `rig: could not load` / WebGL の SecurityError）は素材の URL の CORS を疑う

## 7. 3D のカードに貼る（キャラが何人もいる・3D の空間に並べる）

絵は 1 枚とは限らない。**キャラ 1 人（絵 1 枚）につき rig を 1 つ**作り、プリビズの場面に 2D のカードとして
並べる（previz の references/look.md §2.1。全体の段取りは [illustration-mv.md](illustration-mv.md)）。
型は id を使わず、script が自分の canvas を受け持って自分の root の中だけを探し、全体の時刻から
自分の開始時刻を引くので、**同じ型をシーンに何体置いても混ざらない**（2026-11-11 に 2 体で書き出して確認）。

1. 型の `<style>` と、root の `<div>` から 2 つ目の `<script>` までを
   `frames/rig-<名前>.html` の `<template>` に入れる（`<!doctype html><html><head><meta charset="utf-8"></head><body><template>…</template></body></html>`）。
   root からは `data-start` と `data-no-timeline` を外す（シーンの側の器が持つ）
2. 素材の変数 id は**キャラごとに別の名前**（`akanePart0`…）。宣言は**シーンの composition**の
   `data-composition-variables` に並べ、`bind_composition_variable` で束ねる（器の中の `data-var-src` に届く）
3. シーンの root の**直下**に器を置く:

   ```html
   <div id="akane" data-composition-id="rig-akane" data-composition-src="frames/rig-akane.html"
        data-previz-card="akane" data-no-timeline data-start="0" data-duration="8" data-track-index="2"
        data-width="720" data-height="1080" style="width:720px;height:1080px"></div>
   ```

   `data-previz-card` がカードの名前。幅と高さは rig の `data-width` / `data-height` と同じ画素で書く
   （無いと箱の大きさが決まらない）。位置・重なり順・変形はプレイヤーが毎コマ書くので、器に
   `transform` / `left` / `top` / `z-index` を書かない
4. プリビズの文書に `kind: "card"` を置く（`size` の縦横比 = 720:1080）

