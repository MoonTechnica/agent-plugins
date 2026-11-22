# 光・粒・グロー（発光・逆光・光漏れ・フレア・光芒・キラキラ・漂う粒・空気の色）

イラスト MV・モーショングラフィックスの**光の演出**の作り方。図形は [shape-motion.md](shape-motion.md)、カメラは
[parallax-camera.md](parallax-camera.md)、文字の光らせ方の強さは [text-motion.md](text-motion.md)。
根拠と出典は `docs/_research/2026-11-12-light-particles-glow.md`。**数値は出発点**（プロの数値の一次出典は少ない）。
§3.1〜§3.4 と §4 のリムは HyperFrames 0.9.30 で書き出して確かめてある（リム・粒・グロー・光の帯・キラキラ）。

**既にあるものは書き直さずにそちらを使う**:

| やりたいこと | 使うもの |
|---|---|
| 主役の**背後**の後光・1 回だけ横切る光・文字の中のシマー | `hyperframes-animation` の `rules/ambient-glow-bloom.md` |
| 1 回きりに弾ける粒（≤ 40 個） | `rules/particle-burst.md` |
| 文字の塗りそのものの移動 | `rules/gradient-text-sweep.md` |
| 雨・全面の雪・霧・VHS・粒状感・白フラッシュ | 組み込みの効果（[effects.md](effects.md)） |
| 3D の物体が光る・3D の空気のにじみ | プリビズの `render.post.bloom`（奥の 3D だけ）/ Blender の Glare（[blender-by-hand.md](blender-by-hand.md)） |
| 光の種類の数・後光の基本（1 シーン 1〜2 種類） | [illustration-mv.md](illustration-mv.md) §5 |

---

## 1. 合成モード（何で足すか）

| モード | 式 | 使う所 |
|---|---|---|
| **加算** `plus-lighter`（canvas は `'lighter'`） | `min(1, a + b)`。重なるほど白へ飛ぶ | ネオン・発光体・キラキラの芯・光の帯の芯 |
| **`screen`** | `a + b − ab`。1 を超えない | 逆光の地明かり・光漏れ・大きなにじみ（大面積でも絵を潰しにくい） |
| `color-dodge` | 明るい所だけ持ち上げる | 髪・瞳のハイライトに小さく低い不透明度で（広げると焼ける） |
| `lighten` | 明るい方を取るだけ | 光の足しにはならない（使わない） |

- **黒地に描いた光の素材は、加算・screen なら抜かずに使える**（黒 = 0 は何も足さない）。光は透過で作るより黒地に作る。
- **`mix-blend-mode` は同じ積み重ねの文脈の中でしか混ざらない**。親に `opacity < 1` / `transform` / `filter` /
  `isolation` があるとその中だけで混ざる。**光の層は混ぜたい絵と同じ親の直下に置く**。
- 白・明るい地の上の光はほぼ見えない。光を見せたいなら地を暗くするか、光の色を濃く（彩度高く）する。

## 2. 効果ごとの作り方

| 効果 | 骨格 | 既定値（出発点） | どこで作る |
|---|---|---|---|
| **グロー（物が光る）** | 複製 → 暗部を落とす（しきい値）→ 彩度を少し落とす → ぼかし → 加算。**2〜3 段重ねる** | 芯 4〜8px・0.6〜0.9・加算 / 中 16〜32px・0.4〜0.6・加算 / 空気 60〜120px・0.2〜0.35・screen | CSS（§3.1） |
| **拡散（ふわっと明るい空気）** | 画全体の複製 → 大きくぼかす → screen で薄く | `blur(20〜40px) brightness(1.1〜1.3)`、0.15〜0.35 | CSS の最後の層（§3.6） |
| **光漏れ・フィルム焼け** | 画面の**外**に中心を置いた暖色の大きな放射グラデ 2〜3 個を screen | 直径は短辺の 0.6〜1.5 倍。漂いは 4〜10 秒周期・0.3〜0.6。転換は 0.4〜1.2 秒で立ち上げ継ぎ目で 6〜9 割を覆う | CSS |
| **アナモルフィックの横筋** | 高さ 2〜6px・幅が画面の 0.5〜1.2 倍の横長の楕円グラデ → **横だけ**ぼかす → 加算 | 青〜シアン、芯だけ白、0.4〜0.8。光源の明るさに連動、画面外へ出たら消す | CSS（SVG `feGaussianBlur stdDeviation="40 1"`）/ 多重の筋・ゴーストは Blender の Glare |
| **光芒（差し込む光）** | 画面外の光源から開く 3〜7 本の細いくさびを screen + 光源から遠いほど薄くなるマスク | 0.08〜0.25、筋ごとに幅・不透明度をハッシュ、3〜8 秒周期の明滅・角度 ±1〜3° | CSS。窓・木漏れ日・髪の隙間を通る光は Blender |
| **キラキラ** | 先が細い 4 点の十字（縦を横の 1.2〜1.6 倍）+ 芯の玉、加算 | 寿命 0.25〜0.6 秒、立ち上がり 35%（`power2.out`）、拡大縮小 0→1→0 と回転 0→45°、**同時に数個** | SVG（§3.3）/ 数十個以上は canvas |
| **漂う粒**（塵・ボケ・雪・花びら・火の粉） | 奥 / 中 / 手前の 3 層 | 下の表 | canvas 1 枚（§3.4） |
| **文字・ロゴの上を通る光の帯** | 文字と同じ形の複製に斜めの白い帯のグラデを `background-clip: text`、加算、位置を 1 回だけ動かす | 帯の幅は文字高の 0.3〜0.8 倍、通過 0.5〜1.2 秒、角度 100〜120°。通った瞬間に弱いグロー + キラキラ 1 つ | CSS |
| **ちらつき**（電球・ネオン・蝋燭） | 時刻を量子化してハッシュで明るさ | ネオンの点きかけは 0.3〜1.2 秒に 2〜4 回の落ち込み（補間しない）。炎は ±10〜20% を 0.08〜0.15 秒刻みで補間 | CSS 変数 / `onUpdate`（§3.5） |
| **逆光・リムライト** | §4 | — | CSS マスク |

**漂う粒の奥行き**（手前ほど大きく・ぼけて・速く・少なく・薄く。揃っていないと「画面のゴミ」に見える）:

| 層 | 大きさ | ぼけ | 不透明度 | 速さ | 数 |
|---|---|---|---|---|---|
| 奥 | 1〜3px | 0〜1px | 0.2〜0.4 | 10〜30px/秒 | 100〜400 |
| 中 | 3〜6px | 0〜2px | 0.5〜0.8 | 30〜80px/秒 | 40〜150 |
| 手前（ボケ） | 20〜120px | 8〜30px | 0.1〜0.3 | 100〜300px/秒 | 3〜15 |

| 種類 | 動き |
|---|---|
| 塵 | ほぼ無重力の漂い（低い周波数の正弦 2〜3 本）+ ごく弱い上昇・下降、ゆっくり明滅 ±30%。**光の当たる範囲だけ明るく**、影の中では消す |
| ボケ | ほぼ静止〜ゆっくり横流れ。カメラの動きと逆向きに大きく動く（手前だから） |
| 雪 | 落下 40〜150px/秒 + 横揺れ（10〜40px・2〜5 秒周期）+ 風で全体を少し斜めに |
| 花びら | 雪より遅く不規則 + 回転と裏返り（`scale(cos θ, 1)`）。形は 3〜5 種のスプライト。光らせない（通常の合成） |
| 火の粉 | 上昇 60〜200px/秒 + 速い揺らぎ、寿命 1〜3 秒で白黄 → 橙 → 赤 → 暗く小さく消える。加算 |

組み込みの `snow` は全面のタイル（奥行き・揺れ・個別の寿命なし）。雰囲気なら組み込み、画の主題の雪・花びらは canvas。
**主役の顔・歌詞の前を手前のボケが横切るのは一瞬だけ**。粒の色はその場の光の色（暖色の逆光なら琥珀、夜は青白）。

**光は 1 つの物語にする**: リム・後光・フレア・光芒・粒の明るい範囲が同じ方向・同じ色から来ること。光源が画面に見えるなら
そこが画面で一番明るい。**光源が無いのにフレアを出さない**。

---

## 3. レシピ（決定論。1 本の paused timeline、値は時刻の純関数）

乱数は添字のハッシュ（毎コマ呼ぶ値は列の PRNG から取らない。呼んだ順で値が変わる）:

```js
function hash(i, k) {
  let h = (i * 374761393 + k * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
```

### 3.1 多段グロー（CSS）

```html
<div class="glow-stack">              <!-- 背景と同じ親の直下（§1） -->
  <img class="core" data-var-src="logo">
  <img class="g g1" data-var-src="logo" aria-hidden="true">
  <img class="g g2" data-var-src="logo" aria-hidden="true">
  <img class="g g3" data-var-src="logo" aria-hidden="true">
</div>
```

```css
.glow-stack > * { position:absolute; inset:0; }
.g1 { filter: brightness(1.6) saturate(0.8) blur(6px);  mix-blend-mode: plus-lighter; opacity: var(--g1, 0.7); }
.g2 { filter: brightness(1.4) saturate(0.8) blur(24px); mix-blend-mode: plus-lighter; opacity: var(--g2, 0.45); }
.g3 { filter: brightness(1.2) saturate(0.9) blur(90px); mix-blend-mode: screen;       opacity: var(--g3, 0.3); }
```

強さの変化は `--g1`〜`--g3`（不透明度）を GSAP で tween する。**ぼかしの半径は tween しない**。
暗部を落とすしきい値が要るなら複製に `contrast(3) brightness(0.6)` を足す。光の色は元の色より一段濃く。
**やり過ぎの見分け**: 主役の輪郭が読めない・画面の 3 割以上が白く飛ぶ。彩度 0 にして明暗だけで形が読めるかで確かめる。

### 3.2 光の帯（文字・ロゴの上）

```css
.sheen { position:absolute; inset:0; color:transparent; mix-blend-mode:plus-lighter;   /* 文字と同じ組みの複製 */
  background: linear-gradient(105deg, transparent 46%, rgba(255,255,255,.9) 50%, transparent 54%) 0 0 / 300% 100% no-repeat;
  -webkit-background-clip: text; background-clip: text; }
```

```js
tl.fromTo(".sheen", { backgroundPosition: "100% 0" }, { backgroundPosition: "-50% 0", duration: 0.8, ease: "power1.inOut" }, T);
```

帯の幅は「グラデの幅（ここでは 8%）× 背景の大きさ（300%）」で要素の幅の約 24%。**40〜60% にすると字全体が一度に白くなる**（実測）。
金属・ガラスのロゴは白い帯、紙・布なら帯を使わず全体のグローの明滅に（質感と矛盾する光は嘘に見える）。

### 3.3 キラキラ 1 個（SVG）

```html
<svg class="spark" viewBox="-50 -50 100 100" width="48" height="48" style="position:absolute;mix-blend-mode:plus-lighter">
  <defs><radialGradient id="sk"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>
  <path d="M0,-50 L4,0 L0,50 L-4,0 Z" fill="url(#sk)"/><path d="M-36,0 L0,3 L36,0 L0,-3 Z" fill="url(#sk)"/>
  <circle r="7" fill="url(#sk)"/>
</svg>
```

```js
tl.fromTo(el, { scale: 0, rotation: 0, opacity: 0 }, { scale: 1, rotation: 20, opacity: 1, duration: LIFE * 0.35, ease: "power2.out" }, AT);
tl.to(el, { scale: 0, rotation: 45, opacity: 0, duration: LIFE * 0.65, ease: "power2.in" }, AT + LIFE * 0.35);
```

置くのは**光が当たっていて当然の所**（髪のハイライト・瞳・金属・水面）。散らす時刻・位置は `hash`、拍に合わせるなら拍の頭に 1〜3 個。
1 枚の SVG の中で `id` を使い回すなら、インスタンスごとに `id` を変える（同じ id が複数あると最初の定義が使われる）。

### 3.4 漂う粒（canvas 1 枚・時刻の純関数）

```js
const cv = root.querySelector("canvas.dust"), g = cv.getContext("2d");   // width=1920 height=1080
const W = 1920, H = 1080, N = 240;
const parts = Array.from({ length: N }, (_, i) => {
  const layer = i % 10 < 6 ? 0 : i % 10 < 9 ? 1 : 2;                    // 奥 6 : 中 3 : 手前 1
  const [lo, hi] = [[1, 3], [3, 6], [24, 80]][layer];
  return { x0: hash(i, 1) * W, y0: hash(i, 2) * H, r: lo + hash(i, 3) * (hi - lo),
    vy: -[10, 30, 120][layer] * (0.6 + 0.8 * hash(i, 4)), amp: 8 + 24 * hash(i, 5),
    per: 2 + 3 * hash(i, 6), ph: hash(i, 7) * 6.283, a: [0.3, 0.65, 0.18][layer], tw: hash(i, 8) * 6.283, layer };
});
const sprite = document.createElement("canvas"); sprite.width = sprite.height = 64;   // 光の玉は 1 回だけ作る
{ const s = sprite.getContext("2d"), grd = s.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, "rgba(255,244,220,1)"); grd.addColorStop(0.25, "rgba(255,210,150,0.55)");
  grd.addColorStop(1, "rgba(255,180,120,0)"); s.fillStyle = grd; s.fillRect(0, 0, 64, 64); }
const wrap = (v, m) => ((v % m) + m) % m;
function draw(t) {
  g.clearRect(0, 0, W, H); g.globalCompositeOperation = "lighter";
  for (const p of parts) {
    const x = wrap(p.x0 + p.amp * Math.sin(6.283 * t / p.per + p.ph), W + 160) - 80;
    const y = wrap(p.y0 + p.vy * t, H + 160) - 80;                       // 画面外で折り返す
    g.globalAlpha = p.a * (0.7 + 0.3 * Math.sin(t * 1.7 + p.tw));
    const d = p.r * (p.layer === 2 ? 2 : 4);
    g.drawImage(sprite, x - d / 2, y - d / 2, d, d);
  }
  g.globalAlpha = 1;
}
const clock = { t: 0 };
tl.to(clock, { t: DUR, duration: DUR, ease: "none", onUpdate: () => draw(clock.t) }, 0);
draw(0);
```

- **`shadowBlur` を使わない**（300 粒で 1 コマ約 1.4 秒、2000 粒で約 9.6 秒。実測）。ぼけはスプライトの大きさで出す。
- 雪は `vy > 0`・白いスプライト、花びらは画像のスプライトを `setTransform` で回転と `scale(cos θ, 1)`、火の粉は
  `life = wrap(t + hash(i, 9) * L, L) / L` から色・大きさ・不透明度を決める。
- 100 個を超える常時の粒は DOM でなく canvas に描く（style を毎コマ書くとシークが遅くなる）。canvas は書き出しと同じ画素数。

### 3.5 ちらつき（量子化した時刻）

```js
const STEP = 1 / 12, ck = { t: 0 };
tl.to(ck, { t: DUR, duration: DUR, ease: "none", onUpdate: () => {
  const k = Math.floor(ck.t / STEP), f = ck.t / STEP - k;
  const a = 0.85 + 0.15 * hash(k, 1), b = 0.85 + 0.15 * hash(k + 1, 1);
  lamp.style.opacity = String(a + (b - a) * f);    // 炎は補間する。ネオンの点きかけは a のまま
} }, START);
```

広い面のちらつきは §5 の点滅に数える（落ち込みを小さく、面積を絞る）。

### 3.6 ふわっと明るい MV の空気（最後の仕上げの層）

上から順に、絵（キャラ + 背景）の上に重ねる:

1. **拡散**: 絵全体の複製に `filter: blur(20〜40px) brightness(1.1〜1.3)`、`screen` 0.15〜0.35
2. **明部を暖色に**: 光源側から琥珀〜桃の放射グラデ、`screen` 0.1〜0.25
3. **黒を浮かせる**: 紺〜紫の単色、`screen` 0.05〜0.12
4. **周辺減光**: 四隅を `multiply` で 10〜20% 落とす
5. **粒状感**: 組み込みの `filmGrain` を薄く（大きなグラデの縞を隠す。§5）

彩度は上げない（光を足すと上がって見える）。線画は光の層より上に置くとキャラが潰れない。2D と 3D を同じ空気にするなら、
この層をプリビズの 3D の層より上に置く（`render.post.bloom` は奥の 3D にしか効かない）。

---

## 4. 2D のイラストに光を当てる（逆光・リム・ライトラップ）

逆光は「顔と体は少し暗く、輪郭と髪の縁に強い光」。層（下から）:

| 層 | 書き方 |
|---|---|
| 後光 | キャラの頭の後ろの放射グラデ、screen（ambient-glow-bloom、ピーク ≤ 0.45） |
| キャラを少し暗く・寒色に | キャラに `filter: brightness(0.85〜0.95)`（やり過ぎると切り抜きに見える） |
| リムの広い層 | 下のマスク差分、ずらし大・`blur(8px)`・0.3、加算 |
| リムの芯 | ずらし小（6〜16px）・`blur(1〜2px)`・0.8、加算（髪の毛先・肩・頬） |
| 目元 | 小さな放射グラデ（`overlay` / 加算・低い不透明度）+ 瞳のキラキラ（1〜2 か所） |
| 手前 | 光芒・塵・光漏れ・拡散（§2・§3.6） |

**片側だけのリム（キャラの形 − 光源と逆へずらしたキャラの形）**:

```css
.rim { position:absolute; inset:0; background: var(--rim-color, #ffd9a8);
  -webkit-mask: url(char.png) 0 0 / 100% 100% no-repeat, url(char.png) var(--dx, -10px) var(--dy, 6px) / 100% 100% no-repeat;
  -webkit-mask-composite: source-out;
  mask: url(char.png) 0 0 / 100% 100% no-repeat, url(char.png) var(--dx, -10px) var(--dy, 6px) / 100% 100% no-repeat;
  mask-composite: subtract;
  filter: blur(1.5px); mix-blend-mode: plus-lighter; opacity: .85; }
```

`--dx, --dy` は**光源と逆向き**（光源が右上なら左下へずらす → 右上の縁が残る。書き出して確認済み）。ずらし量 = 縁の太さ。
**明るい色の絵に加算すると縁は色が飛んで白くなる**（実測）。色を残したいなら `screen` にするか不透明度を下げる。
`filter: drop-shadow(0 0 12px 色)` は全周に均一の縁（ハロー）なので地明かりに留め、見せ場は片側のリムにする。
パーツ分けしたキャラ（layer-rig）は、パーツごとでなく**キャラ全体の合成結果に 1 回**掛ける（パーツの境目に光の線が出る）。
色は夕方の逆光なら琥珀〜橙のリム + 影側に青紫、夜のステージなら白〜シアンのリム + マゼンタの地明かり。

**ライトラップ**（背景の光がキャラの縁に回り込む）: 背景と同じ絵を `blur(20〜60px) brightness(1.2)` にし、キャラの形 −
内側へ 8〜20px 縮めた形（`mask-composite: subtract`）の帯の中だけ `screen` 0.6。縮めた形は CSS で作れないので、layerize / rig の段で
素材を作るか SVG の `feMorphology operator="erode"` を使う。カメラが動くなら背景の複製も同じ動きにする。

---

## 5. 点滅・縞・白飛び（必ず守る）

- **どの 1 秒にも閃光は 3 回まで**（WCAG 2.3.1。閃光 = 相対輝度 10% 以上の明暗の対で暗い側が 0.8 未満。赤の閃光も 3 回まで）。
  面積の目安は 1080p で約 640×360 未満。**拍ごとの白フラッシュは 8 分なら 90 BPM、4 分でも 180 BPM を超えると違反**。
  強いフラッシュは小節頭か 2 拍ごと、強いのは継ぎ目だけ（`whiteFlash`）。**赤い光は点滅させない**（持続光か 1 秒以上のゆっくりした変化）。
  ネオン・電球の大面積のちらつきも数える。
- **縞（バンディング）**: 大きな光のグラデ（後光・光漏れ・拡散）は 8 bit と符号化で段が出る。色の段を増やしても直らないので、
  **最後に `filmGrain` を薄く**重ねる。
- **白飛び**: 加算は 1 に張り付く。光の色を白でなくわずかに色付きに、大面積は screen に。白に張り付いた画素が主役の顔・歌詞にかかって
  いないかを書き出したコマで見る（Blender なら Glare の Maximum で頭打ちにする）。

## 6. 重さ（ソフトウェア描画の書き出し。手元の Apple Silicon・ヘッドレス Chromium で実測）

| 手段 | 1 コマ（1920×1080） |
|---|---|
| 全画面 `filter: blur()`（8〜100px） | 約 33ms。**半径ではほとんど変わらない**（大きいぼかしは縮小して計算される）。効くのは面積 × 枚数 |
| 全画面 `blur(24px)` + screen を 4 枚 | 約 16〜33ms |
| 全画面 `backdrop-filter: blur()` | **約 62〜81ms**（光には使わない。光はぼかした複製を足すもの） |
| DOM の光の玉 1000 個 / canvas の粒 2000 個（`'lighter'`） | 約 16〜33ms |
| **canvas の `shadowBlur`** | **300 粒で約 1.4 秒・2000 粒で約 9.6 秒**（禁止） |

サーバ（x86）と HyperFrames の取り込み経路では未測定。加算と screen の速さは同じなので見た目で選んでよい。

**HTML でなく Blender（[blender-by-hand.md](blender-by-hand.md)）で焼くもの**: 物理つきの粒（風に流れる・積もる・ぶつかる・数千〜）、
遮蔽物を通る光芒（窓・木漏れ日・髪の隙間）、レンズのゴースト・多重の筋・星形のグレア（Glare の Ghosts / Streaks / Simple Star）、
3D の物体が光って周りに回る光。透過の動画にして重ねる。
