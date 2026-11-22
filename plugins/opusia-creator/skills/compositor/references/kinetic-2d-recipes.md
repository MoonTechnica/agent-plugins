# 実写・背景映像の上に重ねる文字演出のレシピ（2D）

リリックモーション / PV でよく見る、**文字が円周を回る・輪郭だけの巨大な字が画面を横切る・細い輪と目盛り**。
どれも 2D（HTML + GSAP）で組む。**使いどころと強度は genre-playbook の kinetic-typography.md**、
出し方の語彙は [text-motion.md](text-motion.md)、歌詞の時刻は [lyric-motion.md](lyric-motion.md)。

下のコードのうち**配置（円周の字が外向きに立つ・輪郭の字が欠けずに出る）は Chromium で 1280x720 に描いて確かめた**。§1 の tween はスクリプトの出力で実測した（上記）。§2・§3 の tween は未実測。
動かす値は [設計値]（書き出して見て直す）。**`Math.random` / `Date.now` / `repeat:-1` は使わない**
（hyperframes の契約）。回し続けるときは `duration` を尺に合わせた**有限の 1 回の tween**にする。

## 0. 配置の計算は `scripts/text_path.py` に任せる（手で座標を作らない）

輪・円弧・渦巻き・波に沿った配置は、**弧長から 1 字ずつの位置と向きを決める計算**で、手で書くと崩れる
（字間・接線の向き・一周に収める）。`python3 <SKILL_DIR>/scripts/text_path.py <形> …`（標準ライブラリだけ・
乱数なし・同じ引数なら同じ出力）。出力の `layer` を `patch_previz_scene` の `/layers/-` へ入れる（`--ops` でそのまま
操作列）。

| 形 | 作るもの | 主な引数 |
|---|---|---|
| `ring` | 円周に沿って並べる | `--radius` `--fit`（一周ぴったり）`--side in`（内向き）`--start`（最初の字の角度。12 時 = 0） |
| `arc` | 円弧（中央寄せ） | `--radius` `--from-deg` `--to-deg` |
| `spiral` | 渦巻き（吸い込み・噴き出し） | `--r0` `--r1` `--turns` |
| `wave` | 正弦波（接線に合わせて傾く） | `--amp` `--wavelength` `--x0` `--y0` |

共通: `--text` `--size`（字高 px）`--tracking` `--font serif|sans` `--weight` `--color` `--outline`（中抜き）
`--stroke`（縁 px）`--anchor baseline|center`（字の下端を曲線に載せる / 字の中心を載せる）`--cx` `--cy`（中心）
`--frame 1920x1080` `--reveal`（字ごとの出現の間隔。総 0.8 秒以内に自動で収める）`--spin`（回す度数。時計回りが正）
`--spin-from` `--duration`（回す秒数）`--at`（レイヤーの出）`--layer-duration` `--id` `--name` `--place`。
`glyphs`（字ごとの x / y / 回転）は 3D の板やカードで同じ配置を作るときに使う。

```
python3 <SKILL_DIR>/scripts/text_path.py ring --text "次は周回軌道で　次は周回軌道で　" \
  --radius 285 --size 54 --fit --spin 300 --duration 6 --ops
```

**確かめたこと**: Chromium（1280x720・GSAP 3.15）に出力をそのまま載せ、0.2 / 3 / 6 秒へ `seek` して描いた。
12 時から時計回りに字が順に現れ、輪全体が回る。**読ませる字は上半分（−90°〜90°）に収める**（下半分は逆さ）。
macOS 標準の `python3`（3.9）でも走る。以下の §1〜§3 は、スクリプトを使わずに書くときの形（仕組みの説明）。

## 1. 円周に沿って回る文字（テキストオンパス・サークルテキスト）

字 1 つを `span` にし、**中心から半径 R の位置に、外向きに立てて**並べる。字 i の角度は `start + i × step`。
`step = 360 / 字数` で一周ぴったり、一部だけなら `step` を小さく。回すのは**親 1 つ**（字ごとに回さない）。

```html
<div class="ring" id="ring" style="position:absolute;left:640px;top:360px;width:0;height:0"></div>
<style>
 .ch{position:absolute;left:0;top:0;transform-origin:0 0;white-space:pre;
     font:400 54px/1 "Noto Serif JP",serif;color:#fff}
</style>
<script>
const text = "次は周回軌道で　次は周回軌道で　";   // 空白（全角）で一周を埋める
const R = 285, step = 360 / [...text].length;
const ring = document.getElementById('ring');
[...text].forEach((c, i) => {
  const s = document.createElement('span'); s.className = 'ch'; s.textContent = c;
  s.style.transform = `rotate(${i * step}deg) translate(0,${-R}px) translate(-50%,-50%)`;
  ring.appendChild(s);
});
// 回転: 親だけを回す。1 周 6〜12 秒（速いと読めない）。尺に収まる有限の tween
tl.fromTo('#ring', { rotation: -25 }, { rotation: 335, duration: 10, ease: 'none' }, 0);
</script>
```

| 項目 | 値 [設計値] |
|---|---|
| 半径 R | 輪の半径 + 字高 × 0.5（輪から字が浮く）。画面の短辺の 0.3〜0.4 倍 |
| 字の大きさ | 字高が輪の半径の 0.2 倍前後。字間は `step` で決まる |
| 回転 | 1 周 6〜12 秒・一方向。**止める瞬間を作って読ませる**（読ませる文は半周ごとに 0.5 秒止める） |
| 逆さの字 | 下半分の字は上下逆になる。**読ませる文は上半分に収める**（角度 −90°〜90° のあいだだけ表示し、出入りで opacity） |
| 字ごとの出 | `opacity` を `i × 0.04s` ずらす（総 0.8 秒以内）。出は回転の速さと独立 |

## 2. 輪郭だけの巨大な字（アウトラインテキスト）

中は透明で縁だけ。画面からはみ出す大きさで置き、**ゆっくり動かす／拡大する／塗りに変わる**。
読ませる字ではなく**画面の密度と動きを作る背景**として使う（読ませる字は 1 の円周か通常の歌詞）。

```html
<div class="big" style="position:absolute;left:-120px;top:-120px">業</div>
<style>
 .big{font:900 520px/1 "Noto Serif JP",serif;color:transparent;
      -webkit-text-stroke:3px #fff;paint-order:stroke fill}
</style>
<script>
tl.fromTo('.big', { x: -80, opacity: 0 }, { x: 0, opacity: 1, duration: 1.2, ease: 'power3.out' }, 0.2);
tl.to('.big', { x: 60, duration: 6, ease: 'none' }, 1.4);          // ゆっくり流す（有限）
tl.to('.big', { color: '#fff', duration: 0.6, ease: 'power2.inOut' }, 5.5); // 塗りに変える（強調の瞬間）
</script>
```

- 縁の太さは**字の大きさに比例**させない（大きい字ほど 2〜4px の細い線のほうが上品）。
- 背景映像が明るい日は**白の縁 + うすい影**（`filter: drop-shadow(0 0 6px rgba(0,0,0,.25))`）で読める。
- 縁の色は映像から 1 色（空なら白）。差し色を入れるなら 1 か所だけ。
- 巨大な字は**書体の字面（ウェイト 700〜900 の明朝）**が絵になる。細い書体の縁だけは線が潰れる。

## 3. 細い輪と目盛り（HUD の線画）

SVG の円と短い線。**描き出し**は `stroke-dasharray` と `stroke-dashoffset` の tween（GSAP の DrawSVG は不要）。

```html
<svg width="1280" height="720" style="position:absolute;left:0;top:0">
  <g stroke="#fff" fill="none" stroke-width="2">
    <circle id="rg" cx="640" cy="360" r="230" stroke-dasharray="1445" stroke-dashoffset="1445"/>
    <line x1="640" y1="110" x2="640" y2="150"/><line x1="640" y1="570" x2="640" y2="610"/>
    <line x1="390" y1="360" x2="430" y2="360"/><line x1="850" y1="360" x2="890" y2="360"/>
  </g>
</svg>
<script>
// 周長 = 2πr = 1445（r=230）。offset を 0 にすると 1 周ぶん描き終わる
tl.to('#rg', { strokeDashoffset: 0, duration: 1.0, ease: 'power3.inOut' }, 0);
tl.fromTo('line', { opacity: 0 }, { opacity: 1, duration: 0.2, stagger: 0.06 }, 0.8);
</script>
```

目盛りを輪と一緒に回すなら、輪・目盛り・円周の字を**同じ親**に入れて親だけ回す。
円周の字の `R` を輪の半径より少し外にして揃える。

## 4. 映像の上に重ねるときの守り

| 守ること | 理由 |
|---|---|
| 読ませる字は**映像の暗い所・空の単色の所**に置く。明るい雲・波の上は避けるか影を付ける | 白字が溶ける |
| 映像の動きが大きいカットでは文字の動きを**減らす**（どちらかが主役） | 二重に動くと読めない |
| 輪・目盛り・背景の輪郭字は**手前の 2D の上段**、人物がいるなら人物の**後ろ**（layerize で分けた層を文字の上に置く） | 人物を潰さない |
| 一周回る・巨大に流れる動きは**サビや山の 1〜2 か所**。全編で回し続けない | 静と動の差が価値 |
| 乱数・時刻・無限リピートを使わない | 書き出しが再現しない |
