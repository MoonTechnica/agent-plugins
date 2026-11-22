# 斜めの帯・図形のモーション（帯・縞・ワイプ・枠・集中線・リング・ポップ）

アニメ OP・イラスト MV・YouTube のモーショングラフィックスで画面を走る**図形**の作り方。
文字を動かすのは [text-motion.md](text-motion.md)、光・粒は [light-particles.md](light-particles.md)、カメラは
[parallax-camera.md](parallax-camera.md)。根拠と出典は `docs/_research/2026-11-12-shape-motion.md`。
**ここの数値は出発点**（アニメ OP の帯の角度・尺の一次出典は見つからなかった）。曲と絵に合わせて変えてよい。
R1・R2・R3・R4・R5（時計）・R6・R9 は HyperFrames 0.9.30 で書き出して確かめてある。

**既にあるものは書き直さずにそちらを使う**:

| やりたいこと | 使うもの |
|---|---|
| クリップの頭尾・継ぎ目のワイプ・ディゾルブ | 組み込みの効果（[effects.md](effects.md) の `wipe` など）。図形が画面を横切る転換だけここ |
| 全画面の帯・ブロックで覆う転換（本数・間隔の基準） | `hyperframes-animation` の `transitions/css-cover.md`（帯 6 本 0.03 秒差 / 12 本 0.018 秒差、`power3.inOut`） |
| 円・菱形のアイリス | `transitions/css-radial.md`（**星形は補間が壊れるので使わない**） |
| 線・枠の描き出しの基本 | `rules/svg-path-draw.md` |
| 文字の下のマーカー・丸囲み・小さなバースト | `rules/css-marker-patterns.md` |
| 方向ブラー・残像 | `rules/motion-blur-streak.md` |
| 中心から放射に並べる・拍の格子・遅速遅の動き | `center-outward-expansion` / `kinetic-beat-slam` / `nudge-curve` |
| 乱れ・ちらつきの乱数 | `chromatic-glitch` と同じ種付きハッシュ |

---

## 1. 部品と役割

| 部品 | 役割 | レシピ |
|---|---|---|
| 斜め帯のスイープ | 区切り・勢い・転換の予告 | R1 |
| 帯の束（太さ違い・ずらし） | 装飾 / 全面を覆えば転換 | R2 |
| 斜めの切り口の帯（先端が伸びる） | 速さを形で見せる | R3 |
| 流れる縞・ハッチ・文字帯 | 地（背景のループ） | R4 |
| 図形ワイプ（斜め・分割・ブラインド・時計・図形で覆う） | 転換 | R5 |
| 枠・括弧・角 | 注目させる・ロックオン | R6 |
| 伸びる線（先端に点） | 引き出し線・下線 | R7 |
| ドット・グリッド | 地・拍の可視化 | R8 |
| 集中線・流線 | 一点に視線を集める・突進 | R9 |
| 回転リング・円弧 | HUD・拍・待ち | R10 |
| 拍で弾ける小図形 | 強拍の響き | R11 |
| 図形マスク（窓） | 図形の形で絵を見せる・コマ割り | R12 |

## 2. 既定値（出発点）

| 項目 | 既定 |
|---|---|
| 帯の角度 | **水平から 15〜30°**（既定 20°。勢いなら 30〜45°）。**1 作品で角度は 1 つ**（とその鏡像） |
| 主役の帯の太さ | 画面高さの 8〜20%。束は太・中・細を 1 : 0.5 : 0.15 で混ぜる（揃えるとブラインドに見える） |
| 細い線 | **1080p で 4px 以上**（2px 以下の斜線はちらつく） |
| 出る / 消える | 伸びて出る `expo.out` 0.25〜0.45 秒、縮んで消える `expo.in` 0.2〜0.35 秒。**速く出て長く止まる** |
| 横切る転換 | `power3.inOut` / `expo.inOut` 0.2〜0.5 秒 |
| ポップ | `back.out(1.7〜3)` 0.25〜0.4 秒 |
| 描き出し | `power2.out`〜`power3.out` 0.3〜0.6 秒。連鎖は前の線の 70〜80% で次を始める |
| ループ・回転 | `ease: "none"`（等速）。1 周期 2〜8 秒、リング 1 周 4〜12 秒 |
| ずらし | 装飾の束 0.04〜0.08 秒（総ずらしは 1 本の尺の 30〜60%）。30fps では 0.033 秒未満の差は同じコマ |
| 同時に動く量 | **主役 1 群 + 脇 2 群まで**（1 群 3〜8 要素。地のパターンも 1 群） |
| 色 | **3〜5 色 + 白黒**。ベース（面積大）とアクセント 1 色（面積 10〜20% 以下）。色はワイプの通過と同時に変える |
| 拍 | 図形の**出の頭を打点**に、伸びきる瞬間を打点の 0〜1 コマ後。文字と同じ打点なら図形をわずかに遅らせる（文字が先に読める）。強拍は強い図形、裏拍は小さなポップ、細かい刻みは地の速さで |

**重なり順**（奥から）: 地（色・パターン）→ 絵・人物 → 図形 → 文字とその下敷き → 転換の覆い。帯を人物の**後ろ**に通すと
奥行きが出る（人物が切り抜きであること）。オーバーレイには `z-index` を必ず書く（effects.md）。

**速さはぼかしでなく形で見せる**（ぼかしは高く、図形の硬い縁も消える）: スミア（速いコマだけ進行方向に `scaleX` 1→2.5→1）・
先端先行（R3）・残像のコピー 2〜3 枚（不透明度 0.5 / 0.25）・平行な流線を一瞬。コマ打ちの質感が要るなら
`Math.floor(t * 12) / 12` で時刻を量子化する（混ぜると片方だけカクつくので層ごと）。

**文字と共存させる**: 帯が文字の真後ろを通る瞬間も文字との明度差を保つ（帯の色ごとに文字の色か縁を決める）。
読ませる行の後ろでは地のパターンを遅く・低コントラスト（明暗差 10〜20%）に。集中線は文字の周りに穴を取る。

---

## 3. 共通の約束

- 要素はクリップの中、**1 本の paused timeline** に有限の tween で載せる（`repeat: -1` / CSS の `infinite` は使わない）。
- **`::before` / `::after` を動かさない**（seek されない）。帯 1 本 = 実要素 1 個。
- `width` / `height` / `top` / `left` を tween しない。伸縮は `scaleX` / `scaleY`、見える範囲は `clip-path`。
- **GSAP が動かす要素の CSS に `transform` を書かない**（`hyperframes lint` の `gsap_css_transform_conflict`。GSAP が上書きする）。
  初期の `scaleX(0)` などは `fromTo` の from で持たせる。回転した器（R1）は GSAP で動かさないので CSS でよい。
- 乱数は種付きハッシュ: `const h = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };`
- 配置は組むときに数値で決める（tween 中に DOM を測らない。`stagger: { grid: "auto" }` も測るので行列を明示、
  `from: "random"` は再現性が書かれていないので使わず、ハッシュで並べ替えた配列を渡す）。
- **`clip-path` は同じ種類の基本図形どうしでしか補間されない**。`polygon()` は始点と終点で**頂点数を揃える**
  （三角 → 四角は「2 頂点が重なった四角」で書く）。`none` / `url()` との間は飛ぶので、終わったら `tl.set` で戻す。
  `mask-image` は補間されないので、CSS 変数を GSAP で書く。

---

## 4. レシピ

### R1 斜め帯のスイープ（回転した器の中で水平な帯を `scaleX`）

```html
<div class="band-rig" style="position:absolute;left:50%;top:50%;width:2173px;height:1672px;
  transform:translate(-50%,-50%) rotate(-20deg);z-index:30;pointer-events:none">
  <div class="band" style="position:absolute;left:0;right:0;top:calc(50% - 80px);height:160px;background:#ff3b5c"></div>
</div>
```

```js
tl.fromTo(".band", { scaleX: 0, transformOrigin: "0% 50%" },
  { scaleX: 1, duration: 0.32, ease: "expo.out", immediateRender: true }, IN);
tl.set(".band", { transformOrigin: "100% 50%" }, OUT);          // 伸びきってから原点を反対の端へ
tl.to(".band", { scaleX: 0, duration: 0.26, ease: "expo.in" }, OUT);
```

器の大きさは `W' = W|cosθ| + H|sinθ|`、`H' = W|sinθ| + H|cosθ|`（1920×1080: 15° → 2134×1540、20° → 2173×1672、
30° → 2203×1895）。中心に置けば四隅が欠けない。先端に色違いの細い帯を 1〜2 コマ先行させると勢いが出る。

### R2 帯の束

太さと位置を組むときに決めた帯を R1 の器に並べ、`stagger: 0.05` で伸ばし、同じ順で縮める。
**転換に使うなら**隙間 0 で全面を覆う配置（css-cover の 6 本 / 12 本）にし、**覆い終わったコマ**で前後の画を `tl.set` で
入れ替える。出た向きへ縮めて抜くと「流れ去る」、逆へ縮めると「引き戻す」。

### R3 斜めの切り口の帯と先端の伸び（`polygon()` の頂点を別々の速さで）

```js
const P = { lead: 0, tail: 0 }, s = 18;   // % 単位。s が切り口の斜め量
const draw = () => gsap.set(".slash", { clipPath:
  `polygon(${P.tail}% 40%, ${P.lead + s}% 40%, ${P.lead}% 56%, ${P.tail - s}% 56%)` });
tl.to(P, { lead: 120, duration: 0.30, ease: "expo.out", onUpdate: draw }, T);
tl.to(P, { tail: 120, duration: 0.45, ease: "power3.inOut", onUpdate: draw }, T + 0.08);
```

先端と尾の時間差が伸び（スミア）になり、止まると尾が追いついて縮む。`.slash` は `position:absolute; inset:0` のベタ塗り。

### R4 流れる縞・ハッチ（周期ぶん大きく作って `x` を mod で）

R1 の器の中に、軸に沿った縞の要素を**1 周期ぶん余分に**作り、`y = −((t · 速さ) mod 周期)` で流す（尺がどれだけ長くても継ぎ目が出ない）。
下の `0deg` は**帯と平行な縞**。帯と直角の縞にするなら `90deg` にして余白を左右に取り、`x` で流す。

```css
.hatch { position:absolute; left:0; right:0; top:-80px; height:calc(100% + 80px);
  background: repeating-linear-gradient(0deg, rgba(255,255,255,.18) 0 39px, rgba(255,255,255,0) 41px 80px); }
```

```js
const clock = { t: 0 };
tl.to(clock, { t: DUR, duration: DUR, ease: "none",
  onUpdate: () => gsap.set(".hatch", { y: -((clock.t * 120) % 80) }) }, 0);
```

- 色の境目は**硬くしない**（`39px` → `41px` のように 1〜2px にじませる。硬い角度付きの境目はギザつく）。
- 等速の模様は 1 コマの移動量を整数 px に寄せる（30fps で 120px/秒 = 4px/コマ）と縁の瞬きが減る。
- 流れる文字帯（作品名・英字の繰り返し）も同じ作り。読ませない文字は不透明度 20〜40%、2 本を逆向きに流すと交差が出る。

### R5 図形ワイプ

| 種類 | 書き方 |
|---|---|
| 斜め | 新しい画の器に `clip-path: polygon()` の平行四辺形を、画面外の細い形 → 全面へ（4 頂点のまま）。終わったら `clipPath: "none"` |
| 分割 | 前の画（静止画・単色向き）を 2 つの器に複製し、`inset()` か斜めの polygon で分けて逆向きに `x` |
| 斜めブラインド | R2 の束を回転した器に入れ、全面を覆ってから抜く |
| 時計（扇形） | `mask-image: conic-gradient(#000 var(--a), transparent calc(var(--a) + 0.5deg))` の `--a` を GSAP で 0 → 360deg。**始まるまで `visibility: hidden`**（`--a: 0deg` でも 12 時の方向に細い線が残る。実測） |
| 図形で覆う | 巨大な円・三角を `scale` 0 → 覆う大きさ → 裏で切り替え → 反対へ抜く（ベタ塗りの scale は最も安い） |

```js
tl.set("#next", { opacity: 1, zIndex: 20, clipPath: "polygon(120% 0%, 140% 0%, 120% 100%, 100% 100%)" }, T);
tl.to("#next", { clipPath: "polygon(-20% 0%, 140% 0%, 120% 100%, -40% 100%)", duration: 0.45, ease: "expo.inOut" }, T);
tl.set("#prev", { opacity: 0 }, T + 0.45);
tl.set("#next", { clipPath: "none", zIndex: "auto" }, T + 0.45);
```

ワイプの縁にアクセント色の細い帯（R3 を少し先行させる）を伴走させると縁付きワイプになる。

### R6 枠・括弧・角（SVG を `pathLength="1"` で描く）

```html
<svg class="brackets" viewBox="0 0 1920 1080" preserveAspectRatio="none" style="position:absolute;inset:0">
  <path pathLength="1" stroke-dasharray="1 1" stroke-dashoffset="1" d="M 700 380 L 700 330 L 760 330" />
  <!-- 残り 3 隅も同じ形 -->
</svg>
```

```css
.brackets path { fill:none; stroke:#fff; stroke-width:8; stroke-linecap:square; }  /* 破線の値は CSS に書かない */
```

```js
tl.to(".brackets path", { attr: { "stroke-dashoffset": 0 }, duration: 0.28, ease: "power3.out", stagger: 0.04 }, T);
tl.fromTo(".brackets", { scale: 1.08, transformOrigin: "50% 50%" }, { scale: 1, duration: 0.35, ease: "back.out(2)" }, T);
```

**`pathLength="1"` のときは `attr` で tween する**（実測）: CSS の `strokeDashoffset` を tween すると GSAP が px の整数に
丸めて 1 → 0 と飛び、描かれずに一瞬で現れる。破線の値を CSS に書くと属性より CSS が勝って動かなくなる。
`pathLength` は `stroke-dashoffset` にも効く（描き途中のコマで比例して伸びるのを確認済み）。
角から腕へ描くと「掴む」、腕の端から角へ描くと「閉じる」。

### R7 伸びる線

線は `scaleX` 0 → 1（原点左）、先端の点は同じ尺・同じ ease で `x` を 0 → 線の長さ（定数）。

### R8 ドット・グリッド

`tl.from(".dot", { scale: 0, ease: "back.out(2)", duration: 0.35, stagger: { grid: [9, 16], from: "center", amount: 0.6 } }, T)`。
点が数百を超えるなら要素を並べず `radial-gradient` の背景 1 枚（`background-size` で格子）にして全体だけ動かす。

### R9 集中線・流線

**SVG の細い三角（表情が良い）**: 72 本前後、各本の角度の揺れ・根元の幅・内側の半径をハッシュで変え、
**2 コマ打ち**（`step = Math.floor(t * 12)`）で内側の半径を入れ替えてちらつかせる。

```js
const N = 72, CX = 960, CY = 540, OUTER = 1400;
const tri = (i, step) => {
  const a = (i / N) * Math.PI * 2 + (h(i * 3.1) - 0.5) * 0.05;
  const w = 0.004 + h(i * 7.7) * 0.010;
  const inner = 300 + h(i * 1.9 + step * 13.0) * 180;                // 穴の大きさ
  const p = (r, t) => `${CX + Math.cos(t) * r},${CY + Math.sin(t) * r}`;
  return `${p(inner, a)} ${p(OUTER, a - w)} ${p(OUTER, a + w)}`;
};
const clock = { t: 0 };
tl.to(clock, { t: DUR, duration: DUR, ease: "none", onUpdate: () => {
  const step = Math.floor(clock.t * 12);
  lines.forEach((el, i) => el.setAttribute("points", tri(i, step)));
} }, 0);
```

**円錐グラデーション（最も安い・機械的）**:
`background: repeating-conic-gradient(from 3deg at 50% 50%, rgba(0,0,0,.85) 0deg 1.2deg, rgba(0,0,0,0) 1.6deg 6deg)` +
`mask-image: radial-gradient(circle at 50% 50%, transparent 0 22%, #000 38%)`。揺らすなら `from` の角度を step ごとに
ハッシュで数度ずらす（CSS 変数を GSAP で）。`from 3deg` は真上下の直線を避けるため。

中心は顔・文字の中心（画面の中心からずらしてよい）、穴は顔・文字を覆わない大きさ、線の色は画の暗部側。
**流線**は進行方向と平行な細い帯 8〜20 本を長さ・太さ・速さをハッシュで変えて `x` で流し、0.2〜0.4 秒だけ出す。

### R10 回転リング・円弧

破線の円（`pathLength="100"` + `stroke-dasharray: 2 3`）を等速で回し、円弧（`pathLength="1"`、`rotate(-90deg)` で 12 時から）を
`attr: { "stroke-dashoffset": … }` で描く（R6 と同じく CSS の `strokeDashoffset` は丸められる）。内外 2 本を逆向き・別の速さ（1 : −0.6）にすると HUD らしい。強拍で `scale` 1.06 → 1（0.2 秒）。

### R11 拍で弾ける小図形

形は作品のモチーフ 1〜2 種。位置・回転・大きさはハッシュ（拍ごとに種を変え、同じ場所に出し続けない）。
出現 `scale 0 → 1` `back.out(2.5)` 0.25 秒 + 回転 ±30°、消えは `power2.in` 0.15 秒。1 回 3〜8 個。

### R12 図形マスク（窓）

`clip-path: polygon(...)` の傾いた四角に絵を入れ、窓は頂点を中心から外へ開く（4 頂点のまま）。窓の中の絵は逆向きに
ゆっくり `x`（視差）。縁に R6 の線を重ねるとコマ割り・切り紙の見え方になる。SVG の `<clipPath>` は補間されない。

---

## 5. 重さ（ソフトウェア描画の書き出し）

| 手段 | 重さ |
|---|---|
| ベタ塗りの `transform`（`x` / `scaleX` / `rotation`）・`opacity` | 安い |
| `clip-path`（基本図形）・`background-position` / グラデーションの変数を毎コマ書く | 中（面積に比例） |
| SVG の `points` / `d` を毎コマ書き換え | 中〜高（72 本程度まで。数百本は避ける） |
| 画面全体の `mask-image` / 広い面の `mix-blend-mode` | 中〜高（重ねは 1〜2 枚まで） |
| `filter: blur()` / `backdrop-filter` | **最も高い**（半径 × 面積。アニメーションさせない） |

図形は数十〜百個まで。点・粒が数百を超えるなら背景 1 枚か、Blender で焼いた透過の動画（[blender-by-hand.md](blender-by-hand.md)）。
迷ったら該当区間を `--quality draft` で書き出して 1 コマの時間を比べる。

## 6. 落とし穴

| 症状 | 原因 | 対処 |
|---|---|---|
| 斜めの縁がギザつく・瞬く | ソフトウェア描画は硬い境目をアンチエイリアスしない・細すぎる線・半端な移動量 | 境目に 1〜2px（円錐は 0.3〜0.5°）のにじみ・4px 以上・1 コマの移動を整数 px に |
| `clip-path` が補間されず飛ぶ | 頂点数・図形の種類が違う / `none` との間 | 同じ関数・同じ頂点数で書き、戻しは `tl.set` |
| 書き出すたびに模様が違う | `Math.random` / `from: "random"` / CSS の `infinite` / 疑似要素 | §3 |
| 散らかって見える | 角度・色・モチーフがばらばら・同時に動く量が多い・全部同じ ease と尺 | §2。主役は速く大きく、脇はゆっくり小さく |
| 文字が読めない | 帯の通過で文字と明度差が消える | 帯の色ごとに文字の色か縁を決める |

## 7. 点滅と規則模様（必ず守る）

- **どの 1 秒にも閃光は 3 回まで**（WCAG 2.3.1。閃光 = 相対輝度 10% 以上の明暗の対、赤の閃光も同じ）。
  [text-motion.md](text-motion.md) の点滅の決まりと同じ。
- **白帯 → 黒帯 → 白帯と明暗が反転する全面の転換を拍ごとに繰り返さない**（閃光と同じ）。転換は 1 秒に 1 回程度まで、
  帯の色は背景との明度差を抑えるか反転を伴わない色に。
- **高コントラストの縞・同心円・集中線を画面の大部分に広げて動かさない**（日本の放送ガイドラインも規則模様を避けるとする）。
  地の縞は低コントラスト、集中線は穴を取って面積を抑え、全面の白黒の縞は数コマで終える。
- 打点の強調は白黒反転のフラッシュではなく、位置の衝撃と色の小さなずれで出す。書き出した該当区間を目で確かめる。
