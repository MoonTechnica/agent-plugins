<!-- このファイルは自動生成です。手で編集しない。
     正本: frontend/packages/studio/src/entities/composition/lib/fx.ts
     生成: bun run --filter @workspace/studio generate:fx-reference -->

# 効果（トランジション / エフェクト / 入場アニメ）

Studio の効果タブが出すのと**同じ効果**を、自分で書く composition にも入れられる。
実装はすべて **CSS アニメーション**で、HyperFrames のランタイムが `css` アダプタで
seek するため、プレビューでも書き出しでも同じ絵になる。**GSAP timeline は要らない。**

## 守ること（守らないと書き出しだけ壊れる）

| 禁止 | 理由 |
|---|---|
| `::before` / `::after` にアニメーションを置く | アダプタは擬似要素を集めないので seek されず、実時間で流れる（フレームが毎回変わる） |
| `animation-iteration-count: infinite` | 全体尺は「明示の `data-duration` と推定した終端の大きいほう」で決まるため、無限にすると尺が無限に伸びる |
| `animation-fill-mode: forwards` | 終端を保持するとクリップ自身の `filter` / `opacity` を恒久的に上書きする |
| `display` / `visibility` を動かす | クリップの表示窓はランタイムの持ち物 |
| 同じトラックでクリップを重ねる | `lint` が落ち、レンダーは未定義 |
| オーバーレイ / 複製に `z-index` を書かない | **効果が丸ごと見えなくなる。** `data-track-index` は時間のレーンであって重なり順ではないので、重なりは CSS で決まる。素材やテロップが `z-index: 1` 以上を持つと、`z-index: auto` のオーバーレイは必ずその裏に回る |
| オーバーレイ / 複製 / 継ぎ目に `data-studio-fx-key` と `data-studio-fx-of` を書かない | **画面が「効果」として認識できない。** 絵は正しく出るのに fx バッジが出ず、エフェクトコントロールにも並ばず（＝**人が外せない**）、持ち主をトリム・移動しても付いてこない（次節） |

## 重なり順（`z-index`）

**`data-track-index` は「時間の重なりのレーン」であって描画順ではない**
（HyperFrames 公式: *A clip on track 5 is not "above" a clip on track 1*）。
したがって効果を前に出すには CSS で書く。Studio が焼くのと同じ規則:

```
z-index = data-track-index + 1   （音声レーン（10 以上）は書かない）
position: absolute               （static な要素には z-index が効かない）
```

CSS は**使う効果のぶんだけ**貼ればよい（全部入れる必要はない）。
クラス名と keyframes 名は変えないこと（画面側と同じ見た目にならなくなる）。

## 効果の素性（書かないと画面から触れなくなる）

効果の実体は composition の中では**ただのクリップ**なので、画面は次の属性で
「何の効果か」と「誰に掛かっているか」を読む。**書き落としても絵は正しく出る**
ぶん、見て気づけない。落ちるのは次の 4 つ:

- クリップの `fx` バッジが出ない（当たっているのか読めない）
- エフェクトコントロールに並ばない → **人が画面から外せない**
- 継ぎ目のオーバーレイが帯にまとまらず、**別レーンの謎のクリップ**として残る
- 持ち主をトリム・移動しても効果が付いてこない（その場に置き去りになる）

| 属性 | 何を書くか |
|---|---|
| `data-studio-fx-key` | 効果のキー（`rain` / `dissolve` …。このファイルの見出しの語） |
| `data-studio-fx-of` | 持ち主のクリップの **`data-hf-id`** |
| `data-name` | タイムラインに出す名前（無いと内部 id がそのまま並ぶ） |

**持ち主の id は自分で振る。** 画面側は要素を `data-hf-id` で指すので、効果を掛ける
クリップに `data-hf-id="hf-hero"` のように書いておき、効果クリップの
`data-studio-fx-of` に同じ値を書く（既にある `data-hf-id` は尊重されるので、
自分で振った値がそのまま使われる）。

持ち主は「その効果が掛かっている 1 本」:

| 効果の種類 | 持ち主 |
|---|---|
| 全画面オーバーレイ（雨 / 雪 / 霧 / VHS / フィルム粒子） | 覆っているクリップ。特定のクリップに掛けていないなら省いてよい |
| 複製（残像 / 分身） | 複製元のクリップ |
| 継ぎ目のオーバーレイ（クロスディゾルブ / ホワイトフラッシュ） | 継ぎ目の**後ろ**のクリップ（その「入り」として並ぶ） |

**端の演出の尺をカタログ既定から変えたら `data-studio-fx-in-sec` / `data-studio-fx-out-sec` も書く。**
画面の帯は既定の尺で描くので、書かないと**見えている帯と実際の長さが食い違う**
（人が端を引っぱるまで直らない）。

## トランジション（カットの継ぎ目）

**当てるのは MCP の `apply_transition`（外すのは `remove_transition`）。** 継ぎ目の複製・
別レーン・`z-index`・素材の開始位置・上の素性の属性は、画面と同じ変換が組む。
**以下の CSS と組み立ては、その仕組みの中身の参照用**で、手で再現しない
（手で書くと黒に落ちる / 画面から外せない効果になる）。

### `dissolve`（クリップの頭 / 尻）

入りはクリップの `style` に置く（`data-start` が原点なので遅延は要らない）:

```html
<video class="clip" data-start="3" data-duration="3" data-end="6" data-track-index="0"
  data-studio-fx-in="dissolve" style="animation: hf-fx-dissolve-in 0.4s linear"></video>
```

出は**直前のクリップ**に置く。遅延はそのクリップの尺 − 効果の尺（下は尺 3 秒の例）:

```html
<video class="clip" data-start="0" data-duration="3" data-end="3" data-track-index="0"
  data-studio-fx-out="dissolve" style="animation: hf-fx-dissolve-out 0.4s linear 2.6s"></video>
```

⚠️ **上の 2 つは「黒との出入り」であって、カット同士の混ざりではない。**
同じレーンの 2 本は時間的に重なっていないので、前が透明になった瞬間その裏には
**何も無い** —— 一度黒に落ちる（ディップ・トゥ・ブラック）。レーンの先頭や
前が空いている継ぎ目ではこれが正しいが、**カット同士を混ぜたいなら次の形を使う。**

#### 本物のクロスディゾルブ（`dissolve` をカット同士で混ぜる）

**片方の複製を別レーンに重ねて、相手の上で演じさせる。** 2 つの絵が同時に
存在するので、混ざりもワイプもスライドも「相手に対して」掛かる。
重ねるなら別トラック（同一トラックの重なりは lint が error にする）。

```html
<!-- V1: 6s で切り替わる 2 本。位置も尺もそのまま。
     持ち主として指せるように data-hf-id を自分で振っておく -->
<video id="a" class="clip" data-hf-id="hf-a" data-var-src="sceneA" src=""
  data-start="0" data-duration="6" data-end="6" data-track-index="0"
  style="position: absolute; z-index: 1" muted playsinline></video>
<video id="b" class="clip" data-hf-id="hf-b" data-var-src="sceneB" src=""
  data-start="6" data-duration="6" data-end="12" data-track-index="0"
  style="position: absolute; z-index: 1" muted playsinline></video>

<!-- 継ぎ目に重ねる 1 本。A の**続き**（data-media-start = A の尺）を
     B の上に置き、尺いっぱいで out を演じ切る。
     持ち主は継ぎ目の**後ろ**のクリップ（B の「入り」として画面に並ぶ） -->
<video id="a-dissolve" class="clip" data-var-src="sceneA" src=""
  data-name="dissolve" data-studio-fx-key="dissolve" data-studio-fx-of="hf-b"
  data-start="6" data-duration="1" data-end="7" data-track-index="3"
  data-media-start="6"
  style="position: absolute; z-index: 4; animation: hf-fx-dissolve-out 1s linear"
  muted playsinline></video>
```

⚠️ **この形にしたら、A と B に `data-studio-fx-in` / `data-studio-fx-out` を書かない。**
同じ継ぎ目に演出が二重に掛かる（画面側も、オーバーレイを置くときは両側の控えを
必ず外している）。

前後どちらへ寄せてもよい（上は「継ぎ目から後ろへ」）。逆向きにするなら、
**入ってくるクリップの助走**（`data-media-start` を継ぎ目の尺ぶん戻す）を
`[継ぎ目 − 尺, 継ぎ目]` に置いて `in` を演じさせる。

素材に余白が無いときは、**既に見せたぶんを回し直す**（Premiere の
*repeated frames*）。素材の外を指すと絵が出ないので、`data-media-start` は
必ず素材の中に収める。

必要な CSS（composition の `<style>` にそのまま入れる）:

```css
@keyframes hf-fx-dissolve-in { from { opacity: 0 } to { opacity: 1 } }
@keyframes hf-fx-dissolve-out { from { opacity: 1 } to { opacity: 0 } }
```

### `wipe`（クリップの頭 / 尻）

入りはクリップの `style` に置く（`data-start` が原点なので遅延は要らない）:

```html
<video class="clip" data-start="3" data-duration="3" data-end="6" data-track-index="0"
  data-studio-fx-in="wipe" style="animation: hf-fx-wipe-in 0.35s cubic-bezier(0.65, 0, 0.35, 1)"></video>
```

出は**直前のクリップ**に置く。遅延はそのクリップの尺 − 効果の尺（下は尺 3 秒の例）:

```html
<video class="clip" data-start="0" data-duration="3" data-end="3" data-track-index="0"
  data-studio-fx-out="wipe" style="animation: hf-fx-wipe-out 0.35s cubic-bezier(0.65, 0, 0.35, 1) 2.65s"></video>
```

⚠️ **上の 2 つは「黒との出入り」であって、カット同士の混ざりではない。**
同じレーンの 2 本は時間的に重なっていないので、前が透明になった瞬間その裏には
**何も無い** —— 一度黒に落ちる（ディップ・トゥ・ブラック）。レーンの先頭や
前が空いている継ぎ目ではこれが正しいが、**カット同士を混ぜたいなら次の形を使う。**

#### 本物のクロスディゾルブ（`wipe` をカット同士で混ぜる）

**片方の複製を別レーンに重ねて、相手の上で演じさせる。** 2 つの絵が同時に
存在するので、混ざりもワイプもスライドも「相手に対して」掛かる。
重ねるなら別トラック（同一トラックの重なりは lint が error にする）。

```html
<!-- V1: 6s で切り替わる 2 本。位置も尺もそのまま。
     持ち主として指せるように data-hf-id を自分で振っておく -->
<video id="a" class="clip" data-hf-id="hf-a" data-var-src="sceneA" src=""
  data-start="0" data-duration="6" data-end="6" data-track-index="0"
  style="position: absolute; z-index: 1" muted playsinline></video>
<video id="b" class="clip" data-hf-id="hf-b" data-var-src="sceneB" src=""
  data-start="6" data-duration="6" data-end="12" data-track-index="0"
  style="position: absolute; z-index: 1" muted playsinline></video>

<!-- 継ぎ目に重ねる 1 本。A の**続き**（data-media-start = A の尺）を
     B の上に置き、尺いっぱいで out を演じ切る。
     持ち主は継ぎ目の**後ろ**のクリップ（B の「入り」として画面に並ぶ） -->
<video id="a-dissolve" class="clip" data-var-src="sceneA" src=""
  data-name="wipe" data-studio-fx-key="wipe" data-studio-fx-of="hf-b"
  data-start="6" data-duration="1" data-end="7" data-track-index="3"
  data-media-start="6"
  style="position: absolute; z-index: 4; animation: hf-fx-wipe-out 1s cubic-bezier(0.65, 0, 0.35, 1)"
  muted playsinline></video>
```

⚠️ **この形にしたら、A と B に `data-studio-fx-in` / `data-studio-fx-out` を書かない。**
同じ継ぎ目に演出が二重に掛かる（画面側も、オーバーレイを置くときは両側の控えを
必ず外している）。

前後どちらへ寄せてもよい（上は「継ぎ目から後ろへ」）。逆向きにするなら、
**入ってくるクリップの助走**（`data-media-start` を継ぎ目の尺ぶん戻す）を
`[継ぎ目 − 尺, 継ぎ目]` に置いて `in` を演じさせる。

素材に余白が無いときは、**既に見せたぶんを回し直す**（Premiere の
*repeated frames*）。素材の外を指すと絵が出ないので、`data-media-start` は
必ず素材の中に収める。

必要な CSS（composition の `<style>` にそのまま入れる）:

```css
@keyframes hf-fx-wipe-in { from { clip-path: inset(0 100% 0 0) } to { clip-path: inset(0 0 0 0) } }
@keyframes hf-fx-wipe-out { from { clip-path: inset(0 0 0 0) } to { clip-path: inset(0 0 0 100%) } }
```

### `mix`（クリップの頭 / 尻）

入りはクリップの `style` に置く（`data-start` が原点なので遅延は要らない）:

```html
<video class="clip" data-start="3" data-duration="3" data-end="6" data-track-index="0"
  data-studio-fx-in="mix" style="animation: hf-fx-mix-in 0.45s cubic-bezier(0.4, 0, 0.2, 1)"></video>
```

出は**直前のクリップ**に置く。遅延はそのクリップの尺 − 効果の尺（下は尺 3 秒の例）:

```html
<video class="clip" data-start="0" data-duration="3" data-end="3" data-track-index="0"
  data-studio-fx-out="mix" style="animation: hf-fx-mix-out 0.45s cubic-bezier(0.4, 0, 0.2, 1) 2.55s"></video>
```

⚠️ **上の 2 つは「黒との出入り」であって、カット同士の混ざりではない。**
同じレーンの 2 本は時間的に重なっていないので、前が透明になった瞬間その裏には
**何も無い** —— 一度黒に落ちる（ディップ・トゥ・ブラック）。レーンの先頭や
前が空いている継ぎ目ではこれが正しいが、**カット同士を混ぜたいなら次の形を使う。**

#### 本物のクロスディゾルブ（`mix` をカット同士で混ぜる）

**片方の複製を別レーンに重ねて、相手の上で演じさせる。** 2 つの絵が同時に
存在するので、混ざりもワイプもスライドも「相手に対して」掛かる。
重ねるなら別トラック（同一トラックの重なりは lint が error にする）。

```html
<!-- V1: 6s で切り替わる 2 本。位置も尺もそのまま。
     持ち主として指せるように data-hf-id を自分で振っておく -->
<video id="a" class="clip" data-hf-id="hf-a" data-var-src="sceneA" src=""
  data-start="0" data-duration="6" data-end="6" data-track-index="0"
  style="position: absolute; z-index: 1" muted playsinline></video>
<video id="b" class="clip" data-hf-id="hf-b" data-var-src="sceneB" src=""
  data-start="6" data-duration="6" data-end="12" data-track-index="0"
  style="position: absolute; z-index: 1" muted playsinline></video>

<!-- 継ぎ目に重ねる 1 本。A の**続き**（data-media-start = A の尺）を
     B の上に置き、尺いっぱいで out を演じ切る。
     持ち主は継ぎ目の**後ろ**のクリップ（B の「入り」として画面に並ぶ） -->
<video id="a-dissolve" class="clip" data-var-src="sceneA" src=""
  data-name="mix" data-studio-fx-key="mix" data-studio-fx-of="hf-b"
  data-start="6" data-duration="1" data-end="7" data-track-index="3"
  data-media-start="6"
  style="position: absolute; z-index: 4; animation: hf-fx-mix-out 1s cubic-bezier(0.4, 0, 0.2, 1)"
  muted playsinline></video>
```

⚠️ **この形にしたら、A と B に `data-studio-fx-in` / `data-studio-fx-out` を書かない。**
同じ継ぎ目に演出が二重に掛かる（画面側も、オーバーレイを置くときは両側の控えを
必ず外している）。

前後どちらへ寄せてもよい（上は「継ぎ目から後ろへ」）。逆向きにするなら、
**入ってくるクリップの助走**（`data-media-start` を継ぎ目の尺ぶん戻す）を
`[継ぎ目 − 尺, 継ぎ目]` に置いて `in` を演じさせる。

素材に余白が無いときは、**既に見せたぶんを回し直す**（Premiere の
*repeated frames*）。素材の外を指すと絵が出ないので、`data-media-start` は
必ず素材の中に収める。

必要な CSS（composition の `<style>` にそのまま入れる）:

```css
@keyframes hf-fx-mix-in { from { opacity: 0; filter: blur(14px); transform: scale(1.06) } to { opacity: 1; filter: blur(0); transform: scale(1) } }
@keyframes hf-fx-mix-out { from { opacity: 1; filter: blur(0); transform: scale(1) } to { opacity: 0; filter: blur(14px); transform: scale(1.06) } }
```

### `whiteFlash`（継ぎ目のオーバーレイ）

継ぎ目をまたぐ短いクリップを 1 本置く（継ぎ目が中央に来るようにする）:

```html
<!-- 継ぎ目の後ろのクリップに data-hf-id="hf-b" を振ってある前提 -->
<div class="clip hf-fx-white-flash" id="clip-fx-whiteFlash" data-name="whiteFlash" data-studio-fx-key="whiteFlash" data-studio-fx-of="hf-b"
  data-start="2.82" data-duration="0.36" data-end="3.18" data-track-index="3"
  style="position: absolute; z-index: 4; animation-duration: 0.36s"></div>
```

必要な CSS（composition の `<style>` にそのまま入れる）:

```css
.hf-fx-white-flash { position: absolute; inset: 0; background: #ffffff; opacity: 0; pointer-events: none; animation-name: hf-fx-white-flash-play; animation-timing-function: cubic-bezier(0.2, 0, 0.1, 1); animation-iteration-count: 1 }
@keyframes hf-fx-white-flash-play { 0% { opacity: 0 } 40% { opacity: 1 } 100% { opacity: 0 } }
```

### `zoomIn`（クリップの頭 / 尻）

入りはクリップの `style` に置く（`data-start` が原点なので遅延は要らない）:

```html
<video class="clip" data-start="3" data-duration="3" data-end="6" data-track-index="0"
  data-studio-fx-in="zoomIn" style="animation: hf-fx-zoom-in-in 0.4s cubic-bezier(0.2, 0.7, 0.2, 1)"></video>
```

出は**直前のクリップ**に置く。遅延はそのクリップの尺 − 効果の尺（下は尺 3 秒の例）:

```html
<video class="clip" data-start="0" data-duration="3" data-end="3" data-track-index="0"
  data-studio-fx-out="zoomIn" style="animation: hf-fx-zoom-in-out 0.4s cubic-bezier(0.6, 0, 0.9, 0.4) 2.6s"></video>
```

⚠️ **上の 2 つは「黒との出入り」であって、カット同士の混ざりではない。**
同じレーンの 2 本は時間的に重なっていないので、前が透明になった瞬間その裏には
**何も無い** —— 一度黒に落ちる（ディップ・トゥ・ブラック）。レーンの先頭や
前が空いている継ぎ目ではこれが正しいが、**カット同士を混ぜたいなら次の形を使う。**

#### 本物のクロスディゾルブ（`zoomIn` をカット同士で混ぜる）

**片方の複製を別レーンに重ねて、相手の上で演じさせる。** 2 つの絵が同時に
存在するので、混ざりもワイプもスライドも「相手に対して」掛かる。
重ねるなら別トラック（同一トラックの重なりは lint が error にする）。

```html
<!-- V1: 6s で切り替わる 2 本。位置も尺もそのまま。
     持ち主として指せるように data-hf-id を自分で振っておく -->
<video id="a" class="clip" data-hf-id="hf-a" data-var-src="sceneA" src=""
  data-start="0" data-duration="6" data-end="6" data-track-index="0"
  style="position: absolute; z-index: 1" muted playsinline></video>
<video id="b" class="clip" data-hf-id="hf-b" data-var-src="sceneB" src=""
  data-start="6" data-duration="6" data-end="12" data-track-index="0"
  style="position: absolute; z-index: 1" muted playsinline></video>

<!-- 継ぎ目に重ねる 1 本。A の**続き**（data-media-start = A の尺）を
     B の上に置き、尺いっぱいで out を演じ切る。
     持ち主は継ぎ目の**後ろ**のクリップ（B の「入り」として画面に並ぶ） -->
<video id="a-dissolve" class="clip" data-var-src="sceneA" src=""
  data-name="zoomIn" data-studio-fx-key="zoomIn" data-studio-fx-of="hf-b"
  data-start="6" data-duration="1" data-end="7" data-track-index="3"
  data-media-start="6"
  style="position: absolute; z-index: 4; animation: hf-fx-zoom-in-out 1s cubic-bezier(0.6, 0, 0.9, 0.4)"
  muted playsinline></video>
```

⚠️ **この形にしたら、A と B に `data-studio-fx-in` / `data-studio-fx-out` を書かない。**
同じ継ぎ目に演出が二重に掛かる（画面側も、オーバーレイを置くときは両側の控えを
必ず外している）。

前後どちらへ寄せてもよい（上は「継ぎ目から後ろへ」）。逆向きにするなら、
**入ってくるクリップの助走**（`data-media-start` を継ぎ目の尺ぶん戻す）を
`[継ぎ目 − 尺, 継ぎ目]` に置いて `in` を演じさせる。

素材に余白が無いときは、**既に見せたぶんを回し直す**（Premiere の
*repeated frames*）。素材の外を指すと絵が出ないので、`data-media-start` は
必ず素材の中に収める。

必要な CSS（composition の `<style>` にそのまま入れる）:

```css
@keyframes hf-fx-zoom-in-in { from { transform: scale(1.35); opacity: 0.25 } to { transform: scale(1); opacity: 1 } }
@keyframes hf-fx-zoom-in-out { from { transform: scale(1); opacity: 1 } to { transform: scale(1.35); opacity: 0 } }
```

### `motion`（クリップの頭 / 尻）

入りはクリップの `style` に置く（`data-start` が原点なので遅延は要らない）:

```html
<video class="clip" data-start="3" data-duration="3" data-end="6" data-track-index="0"
  data-studio-fx-in="motion" style="animation: hf-fx-motion-in 0.3s cubic-bezier(0.16, 0.84, 0.24, 1)"></video>
```

出は**直前のクリップ**に置く。遅延はそのクリップの尺 − 効果の尺（下は尺 3 秒の例）:

```html
<video class="clip" data-start="0" data-duration="3" data-end="3" data-track-index="0"
  data-studio-fx-out="motion" style="animation: hf-fx-motion-out 0.3s cubic-bezier(0.76, 0, 0.84, 0.16) 2.7s"></video>
```

⚠️ **上の 2 つは「黒との出入り」であって、カット同士の混ざりではない。**
同じレーンの 2 本は時間的に重なっていないので、前が透明になった瞬間その裏には
**何も無い** —— 一度黒に落ちる（ディップ・トゥ・ブラック）。レーンの先頭や
前が空いている継ぎ目ではこれが正しいが、**カット同士を混ぜたいなら次の形を使う。**

#### 本物のクロスディゾルブ（`motion` をカット同士で混ぜる）

**片方の複製を別レーンに重ねて、相手の上で演じさせる。** 2 つの絵が同時に
存在するので、混ざりもワイプもスライドも「相手に対して」掛かる。
重ねるなら別トラック（同一トラックの重なりは lint が error にする）。

```html
<!-- V1: 6s で切り替わる 2 本。位置も尺もそのまま。
     持ち主として指せるように data-hf-id を自分で振っておく -->
<video id="a" class="clip" data-hf-id="hf-a" data-var-src="sceneA" src=""
  data-start="0" data-duration="6" data-end="6" data-track-index="0"
  style="position: absolute; z-index: 1" muted playsinline></video>
<video id="b" class="clip" data-hf-id="hf-b" data-var-src="sceneB" src=""
  data-start="6" data-duration="6" data-end="12" data-track-index="0"
  style="position: absolute; z-index: 1" muted playsinline></video>

<!-- 継ぎ目に重ねる 1 本。A の**続き**（data-media-start = A の尺）を
     B の上に置き、尺いっぱいで out を演じ切る。
     持ち主は継ぎ目の**後ろ**のクリップ（B の「入り」として画面に並ぶ） -->
<video id="a-dissolve" class="clip" data-var-src="sceneA" src=""
  data-name="motion" data-studio-fx-key="motion" data-studio-fx-of="hf-b"
  data-start="6" data-duration="1" data-end="7" data-track-index="3"
  data-media-start="6"
  style="position: absolute; z-index: 4; animation: hf-fx-motion-out 1s cubic-bezier(0.76, 0, 0.84, 0.16)"
  muted playsinline></video>
```

⚠️ **この形にしたら、A と B に `data-studio-fx-in` / `data-studio-fx-out` を書かない。**
同じ継ぎ目に演出が二重に掛かる（画面側も、オーバーレイを置くときは両側の控えを
必ず外している）。

前後どちらへ寄せてもよい（上は「継ぎ目から後ろへ」）。逆向きにするなら、
**入ってくるクリップの助走**（`data-media-start` を継ぎ目の尺ぶん戻す）を
`[継ぎ目 − 尺, 継ぎ目]` に置いて `in` を演じさせる。

素材に余白が無いときは、**既に見せたぶんを回し直す**（Premiere の
*repeated frames*）。素材の外を指すと絵が出ないので、`data-media-start` は
必ず素材の中に収める。

必要な CSS（composition の `<style>` にそのまま入れる）:

```css
@keyframes hf-fx-motion-in { from { transform: translate3d(16%, 0, 0); filter: blur(12px); opacity: 0.2 } to { transform: translate3d(0, 0, 0); filter: blur(0); opacity: 1 } }
@keyframes hf-fx-motion-out { from { transform: translate3d(0, 0, 0); filter: blur(0); opacity: 1 } to { transform: translate3d(-16%, 0, 0); filter: blur(12px); opacity: 0 } }
```

### `rgbShift`（クリップの頭 / 尻）

入りはクリップの `style` に置く（`data-start` が原点なので遅延は要らない）:

```html
<video class="clip" data-start="3" data-duration="3" data-end="6" data-track-index="0"
  data-studio-fx-in="rgbShift" style="animation: hf-fx-rgb-shift-in 0.28s linear"></video>
```

出は**直前のクリップ**に置く。遅延はそのクリップの尺 − 効果の尺（下は尺 3 秒の例）:

```html
<video class="clip" data-start="0" data-duration="3" data-end="3" data-track-index="0"
  data-studio-fx-out="rgbShift" style="animation: hf-fx-rgb-shift-out 0.28s linear 2.72s"></video>
```

⚠️ **上の 2 つは「黒との出入り」であって、カット同士の混ざりではない。**
同じレーンの 2 本は時間的に重なっていないので、前が透明になった瞬間その裏には
**何も無い** —— 一度黒に落ちる（ディップ・トゥ・ブラック）。レーンの先頭や
前が空いている継ぎ目ではこれが正しいが、**カット同士を混ぜたいなら次の形を使う。**

#### 本物のクロスディゾルブ（`rgbShift` をカット同士で混ぜる）

**片方の複製を別レーンに重ねて、相手の上で演じさせる。** 2 つの絵が同時に
存在するので、混ざりもワイプもスライドも「相手に対して」掛かる。
重ねるなら別トラック（同一トラックの重なりは lint が error にする）。

```html
<!-- V1: 6s で切り替わる 2 本。位置も尺もそのまま。
     持ち主として指せるように data-hf-id を自分で振っておく -->
<video id="a" class="clip" data-hf-id="hf-a" data-var-src="sceneA" src=""
  data-start="0" data-duration="6" data-end="6" data-track-index="0"
  style="position: absolute; z-index: 1" muted playsinline></video>
<video id="b" class="clip" data-hf-id="hf-b" data-var-src="sceneB" src=""
  data-start="6" data-duration="6" data-end="12" data-track-index="0"
  style="position: absolute; z-index: 1" muted playsinline></video>

<!-- 継ぎ目に重ねる 1 本。A の**続き**（data-media-start = A の尺）を
     B の上に置き、尺いっぱいで out を演じ切る。
     持ち主は継ぎ目の**後ろ**のクリップ（B の「入り」として画面に並ぶ） -->
<video id="a-dissolve" class="clip" data-var-src="sceneA" src=""
  data-name="rgbShift" data-studio-fx-key="rgbShift" data-studio-fx-of="hf-b"
  data-start="6" data-duration="1" data-end="7" data-track-index="3"
  data-media-start="6"
  style="position: absolute; z-index: 4; animation: hf-fx-rgb-shift-out 1s linear"
  muted playsinline></video>
```

⚠️ **この形にしたら、A と B に `data-studio-fx-in` / `data-studio-fx-out` を書かない。**
同じ継ぎ目に演出が二重に掛かる（画面側も、オーバーレイを置くときは両側の控えを
必ず外している）。

前後どちらへ寄せてもよい（上は「継ぎ目から後ろへ」）。逆向きにするなら、
**入ってくるクリップの助走**（`data-media-start` を継ぎ目の尺ぶん戻す）を
`[継ぎ目 − 尺, 継ぎ目]` に置いて `in` を演じさせる。

素材に余白が無いときは、**既に見せたぶんを回し直す**（Premiere の
*repeated frames*）。素材の外を指すと絵が出ないので、`data-media-start` は
必ず素材の中に収める。

必要な CSS（composition の `<style>` にそのまま入れる）:

```css
@keyframes hf-fx-rgb-shift-in {
  0% { transform: translate3d(-2.5%, 0, 0) scaleX(1.04); filter: hue-rotate(-35deg) saturate(2.4) contrast(1.3); opacity: 0.35 }
  18% { transform: translate3d(2%, 0, 0) scaleX(1); filter: hue-rotate(30deg) saturate(2) contrast(1.2); opacity: 0.8 }
  36% { transform: translate3d(-1.4%, 0, 0) scaleX(1.02); filter: hue-rotate(-18deg) saturate(1.7) contrast(1.1); opacity: 1 }
  56% { transform: translate3d(1%, 0, 0) scaleX(1); filter: hue-rotate(12deg) saturate(1.4) contrast(1.05) }
  78% { transform: translate3d(-0.4%, 0, 0) scaleX(1); filter: hue-rotate(-6deg) saturate(1.15) contrast(1) }
  100% { transform: translate3d(0, 0, 0) scaleX(1); filter: hue-rotate(0deg) saturate(1) contrast(1); opacity: 1 }
}
@keyframes hf-fx-rgb-shift-out {
  0% { transform: translate3d(0, 0, 0) scaleX(1); filter: hue-rotate(0deg) saturate(1) contrast(1); opacity: 1 }
  30% { transform: translate3d(0.8%, 0, 0) scaleX(1); filter: hue-rotate(10deg) saturate(1.4) contrast(1.05) }
  58% { transform: translate3d(-1.6%, 0, 0) scaleX(1.02); filter: hue-rotate(-24deg) saturate(1.9) contrast(1.15); opacity: 0.85 }
  80% { transform: translate3d(2.2%, 0, 0) scaleX(1); filter: hue-rotate(34deg) saturate(2.2) contrast(1.25); opacity: 0.5 }
  100% { transform: translate3d(-3%, 0, 0) scaleX(1.05); filter: hue-rotate(-40deg) saturate(2.6) contrast(1.3); opacity: 0 }
}
```

## エフェクト（画づくり）

### `afterimage`（クリップの複製）

元クリップを **2 本複製**して重ねる。複製は `data-var-src` をそのまま引き継ぐ（束ねた素材が同じように流れる。空枠は増えない）。**id は必ず別のものにする**（重複 id の video / img は真っ黒になる）。**複製どうしは別のトラックに置く**（同じトラックで重なるとレンダーが未定義）:

```html
<!-- 複製元。持ち主として指せるように data-hf-id を自分で振っておく -->
<video id="hero" class="clip" data-hf-id="hf-hero" data-var-src="heroClip" src=""
  data-start="0" data-duration="6" data-end="6" data-track-index="0"
  style="position: absolute; z-index: 1" muted playsinline></video>

<video class="hf-fx-afterimage" id="clip-fx-afterimage-1" data-name="afterimage" data-studio-fx-key="afterimage" data-studio-fx-of="hf-hero"
  data-var-src="heroClip" src="" data-start="0.09" data-duration="5.91" data-end="6" data-track-index="3" style="position: absolute; z-index: 4; opacity: 0.5" muted playsinline></video>
<video class="hf-fx-afterimage" id="clip-fx-afterimage-2" data-name="afterimage" data-studio-fx-key="afterimage" data-studio-fx-of="hf-hero"
  data-var-src="heroClip" src="" data-start="0.18" data-duration="5.82" data-end="6" data-track-index="4" style="position: absolute; z-index: 5; opacity: 0.28" muted playsinline></video>
```

複製の `data-start` をずらすと、同じ素材の**過去のフレーム**が出る = 残像になる。

必要な CSS（composition の `<style>` にそのまま入れる）:

```css
.hf-fx-afterimage { mix-blend-mode: screen; filter: blur(2px) }
```

### `clone`（クリップの複製）

元クリップを **2 本複製**して重ねる。複製は `data-var-src` をそのまま引き継ぐ（束ねた素材が同じように流れる。空枠は増えない）。**id は必ず別のものにする**（重複 id の video / img は真っ黒になる）。**複製どうしは別のトラックに置く**（同じトラックで重なるとレンダーが未定義）:

```html
<!-- 複製元。持ち主として指せるように data-hf-id を自分で振っておく -->
<video id="hero" class="clip" data-hf-id="hf-hero" data-var-src="heroClip" src=""
  data-start="0" data-duration="6" data-end="6" data-track-index="0"
  style="position: absolute; z-index: 1" muted playsinline></video>

<video class="hf-fx-clone" id="clip-fx-clone-1" data-name="clone" data-studio-fx-key="clone" data-studio-fx-of="hf-hero"
  data-var-src="heroClip" src="" data-start="0" data-duration="6" data-end="6" data-track-index="3" style="position: absolute; z-index: 4; transform: translate3d(-30%, 0, 0) scale(0.62); opacity: 0.9" muted playsinline></video>
<video class="hf-fx-clone" id="clip-fx-clone-2" data-name="clone" data-studio-fx-key="clone" data-studio-fx-of="hf-hero"
  data-var-src="heroClip" src="" data-start="0" data-duration="6" data-end="6" data-track-index="4" style="position: absolute; z-index: 5; transform: translate3d(30%, 0, 0) scale(0.62); opacity: 0.9" muted playsinline></video>
```

必要な CSS（composition の `<style>` にそのまま入れる）:

```css
.hf-fx-clone { transform-origin: 50% 50% }
```

### `rain`（全画面オーバーレイ）

全画面のクリップを 1 本重ねる。**`z-index` を必ず焼く**（下記）。反復は `--hf-fx-iterations` に **ceil(クリップ尺 ÷ 0.9s)** を入れる（`infinite` は全体尺を無限に伸ばすので禁止）:

```html
<div class="clip hf-fx-rain" id="clip-fx-rain" data-name="rain" data-studio-fx-key="rain" data-studio-fx-of="hf-hero"
  data-start="0" data-duration="6" data-end="6" data-track-index="3"
  style="position: absolute; z-index: 4; --hf-fx-iterations: 7; animation-duration: 0.9s"></div>
```

持ち主（`data-studio-fx-of`）は**覆っているクリップの `data-hf-id`**。画面全体に置くだけで特定のクリップに掛けていないなら、この属性だけは省いてよい。

必要な CSS（composition の `<style>` にそのまま入れる）:

```css
.hf-fx-rain { position: absolute; inset: 0; pointer-events: none; opacity: 0.62; mix-blend-mode: screen;
  background-image:
    repeating-linear-gradient(101deg, rgba(255, 255, 255, 0) 0 9px, rgba(255, 255, 255, 0.42) 9px 10px, rgba(255, 255, 255, 0) 10px 24px),
    repeating-linear-gradient(97deg, rgba(255, 255, 255, 0) 0 15px, rgba(255, 255, 255, 0.26) 15px 16px, rgba(255, 255, 255, 0) 16px 40px);
  background-size: 260px 300px, 420px 480px;
  animation-name: hf-fx-rain-play; animation-timing-function: linear; animation-duration: 0.9s;
  animation-iteration-count: var(--hf-fx-iterations, 1) }
@keyframes hf-fx-rain-play { from { background-position: 0 0, 0 0 } to { background-position: 0 300px, 0 480px } }
```

### `snow`（全画面オーバーレイ）

全画面のクリップを 1 本重ねる。**`z-index` を必ず焼く**（下記）。反復は `--hf-fx-iterations` に **ceil(クリップ尺 ÷ 6s)** を入れる（`infinite` は全体尺を無限に伸ばすので禁止）:

```html
<div class="clip hf-fx-snow" id="clip-fx-snow" data-name="snow" data-studio-fx-key="snow" data-studio-fx-of="hf-hero"
  data-start="0" data-duration="6" data-end="6" data-track-index="3"
  style="position: absolute; z-index: 4; --hf-fx-iterations: 1; animation-duration: 6s"></div>
```

持ち主（`data-studio-fx-of`）は**覆っているクリップの `data-hf-id`**。画面全体に置くだけで特定のクリップに掛けていないなら、この属性だけは省いてよい。

必要な CSS（composition の `<style>` にそのまま入れる）:

```css
.hf-fx-snow { position: absolute; inset: 0; pointer-events: none; opacity: 0.85; mix-blend-mode: screen;
  background-image:
    radial-gradient(circle at 23% 31%, rgba(255, 255, 255, 0.9) 0 1.6px, rgba(255, 255, 255, 0) 2.8px),
    radial-gradient(circle at 68% 12%, rgba(255, 255, 255, 0.72) 0 2.4px, rgba(255, 255, 255, 0) 3.8px),
    radial-gradient(circle at 41% 77%, rgba(255, 255, 255, 0.55) 0 1.2px, rgba(255, 255, 255, 0) 2.2px),
    radial-gradient(circle at 84% 58%, rgba(255, 255, 255, 0.62) 0 1.9px, rgba(255, 255, 255, 0) 3.1px);
  background-size: 137px 137px, 211px 211px, 97px 97px, 173px 173px;
  animation-name: hf-fx-snow-play; animation-timing-function: linear; animation-duration: 6s;
  animation-iteration-count: var(--hf-fx-iterations, 1) }
@keyframes hf-fx-snow-play {
  0% { background-position: 0 0, 0 0, 0 0, 0 0 }
  50% { background-position: 14px 68.5px, -11px 105.5px, 9px 48.5px, -13px 86.5px }
  100% { background-position: 0 137px, 0 211px, 0 97px, 0 173px }
}
```

### `fog`（全画面オーバーレイ）

全画面のクリップを 1 本重ねる。**`z-index` を必ず焼く**（下記）。反復は `--hf-fx-iterations` に **ceil(クリップ尺 ÷ 14s)** を入れる（`infinite` は全体尺を無限に伸ばすので禁止）:

```html
<div class="clip hf-fx-fog" id="clip-fx-fog" data-name="fog" data-studio-fx-key="fog" data-studio-fx-of="hf-hero"
  data-start="0" data-duration="6" data-end="6" data-track-index="3"
  style="position: absolute; z-index: 4; --hf-fx-iterations: 1; animation-duration: 14s"></div>
```

持ち主（`data-studio-fx-of`）は**覆っているクリップの `data-hf-id`**。画面全体に置くだけで特定のクリップに掛けていないなら、この属性だけは省いてよい。

必要な CSS（composition の `<style>` にそのまま入れる）:

```css
.hf-fx-fog { position: absolute; inset: 0; pointer-events: none; opacity: 0.5; mix-blend-mode: screen; filter: blur(6px);
  background-image:
    radial-gradient(60% 55% at 25% 60%, rgba(255, 255, 255, 0.42) 0%, rgba(255, 255, 255, 0) 70%),
    radial-gradient(70% 45% at 75% 45%, rgba(220, 230, 240, 0.34) 0%, rgba(220, 230, 240, 0) 72%),
    radial-gradient(90% 60% at 50% 85%, rgba(255, 255, 255, 0.26) 0%, rgba(255, 255, 255, 0) 75%);
  background-size: 160% 140%, 190% 130%, 220% 150%;
  animation-name: hf-fx-fog-play; animation-timing-function: ease-in-out; animation-duration: 14s;
  animation-iteration-count: var(--hf-fx-iterations, 1) }
@keyframes hf-fx-fog-play {
  0% { background-position: 0% 40%, 100% 60%, 50% 100% }
  50% { background-position: 100% 55%, 0% 45%, 18% 78% }
  100% { background-position: 0% 40%, 100% 60%, 50% 100% }
}
```

### `vhs`（全画面オーバーレイ）

全画面のクリップを 1 本重ねる。**`z-index` を必ず焼く**（下記）。反復は `--hf-fx-iterations` に **ceil(クリップ尺 ÷ 0.5s)** を入れる（`infinite` は全体尺を無限に伸ばすので禁止）:

```html
<div class="clip hf-fx-vhs" id="clip-fx-vhs" data-name="vhs" data-studio-fx-key="vhs" data-studio-fx-of="hf-hero"
  data-start="0" data-duration="6" data-end="6" data-track-index="3"
  style="position: absolute; z-index: 4; --hf-fx-iterations: 12; animation-duration: 0.5s"></div>
```

持ち主（`data-studio-fx-of`）は**覆っているクリップの `data-hf-id`**。画面全体に置くだけで特定のクリップに掛けていないなら、この属性だけは省いてよい。

必要な CSS（composition の `<style>` にそのまま入れる）:

```css
.hf-fx-vhs { position: absolute; inset: 0; pointer-events: none; opacity: 0.55; mix-blend-mode: screen;
  background-image:
    repeating-linear-gradient(0deg, rgba(255, 255, 255, 0.16) 0 1px, rgba(0, 0, 0, 0) 1px 3px),
    linear-gradient(92deg, rgba(255, 0, 90, 0.16) 0%, rgba(0, 255, 220, 0.16) 100%),
    repeating-linear-gradient(0deg, rgba(255, 255, 255, 0.1) 0 2px, rgba(0, 0, 0, 0) 2px 130px);
  background-size: 100% 3px, 100% 100%, 100% 260px;
  animation-name: hf-fx-vhs-play; animation-timing-function: linear; animation-duration: 0.5s;
  animation-iteration-count: var(--hf-fx-iterations, 1) }
@keyframes hf-fx-vhs-play {
  0% { background-position: 0 0, 0 0, 0 0; transform: translate3d(0, 0, 0) }
  22% { background-position: 0 1px, 0 0, 0 -70px; transform: translate3d(0.35%, 0, 0) }
  48% { background-position: 0 2px, 0 0, 0 -150px; transform: translate3d(-0.3%, 0, 0) }
  76% { background-position: 0 1px, 0 0, 0 -210px; transform: translate3d(0.15%, 0, 0) }
  100% { background-position: 0 3px, 0 0, 0 -260px; transform: translate3d(0, 0, 0) }
}
```

### `filmGrain`（全画面オーバーレイ）

全画面のクリップを 1 本重ねる。**`z-index` を必ず焼く**（下記）。反復は `--hf-fx-iterations` に **ceil(クリップ尺 ÷ 0.48s)** を入れる（`infinite` は全体尺を無限に伸ばすので禁止）:

```html
<div class="clip hf-fx-film-grain" id="clip-fx-filmGrain" data-name="filmGrain" data-studio-fx-key="filmGrain" data-studio-fx-of="hf-hero"
  data-start="0" data-duration="6" data-end="6" data-track-index="3"
  style="position: absolute; z-index: 4; --hf-fx-iterations: 13; animation-duration: 0.48s"></div>
```

持ち主（`data-studio-fx-of`）は**覆っているクリップの `data-hf-id`**。画面全体に置くだけで特定のクリップに掛けていないなら、この属性だけは省いてよい。

必要な CSS（composition の `<style>` にそのまま入れる）:

```css
.hf-fx-film-grain { position: absolute; inset: 0; pointer-events: none; opacity: 0.34; mix-blend-mode: overlay;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch' seed='7'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23g)' opacity='0.55'/%3E%3C/svg%3E");
  background-size: 160px 160px;
  animation-name: hf-fx-film-grain-play; animation-timing-function: steps(1, end); animation-duration: 0.48s;
  animation-iteration-count: var(--hf-fx-iterations, 1) }
@keyframes hf-fx-film-grain-play {
  0% { background-position: 0 0 }
  17% { background-position: -48px 32px }
  34% { background-position: 31px -47px }
  50% { background-position: -27px -19px }
  67% { background-position: 44px 21px }
  84% { background-position: -13px 45px }
  100% { background-position: 0 0 }
}
```

## 入場アニメ（クリップの頭）

### `fadeIn`（クリップの頭）

入りはクリップの `style` に置く（`data-start` が原点なので遅延は要らない）:

```html
<video class="clip" data-start="3" data-duration="3" data-end="6" data-track-index="0"
  data-studio-fx-in="fadeIn" style="animation: hf-fx-fade-in-in 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94)"></video>
```

必要な CSS（composition の `<style>` にそのまま入れる）:

```css
@keyframes hf-fx-fade-in-in { from { opacity: 0 } to { opacity: 1 } }
```

### `slide`（クリップの頭）

入りはクリップの `style` に置く（`data-start` が原点なので遅延は要らない）:

```html
<video class="clip" data-start="3" data-duration="3" data-end="6" data-track-index="0"
  data-studio-fx-in="slide" style="animation: hf-fx-slide-in 0.5s cubic-bezier(0.215, 0.61, 0.355, 1)"></video>
```

必要な CSS（composition の `<style>` にそのまま入れる）:

```css
@keyframes hf-fx-slide-in { from { transform: translate3d(-60px, 0, 0); opacity: 0 } to { transform: translate3d(0, 0, 0); opacity: 1 } }
```

### `zoom`（クリップの頭）

入りはクリップの `style` に置く（`data-start` が原点なので遅延は要らない）:

```html
<video class="clip" data-start="3" data-duration="3" data-end="6" data-track-index="0"
  data-studio-fx-in="zoom" style="animation: hf-fx-zoom-in 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)"></video>
```

必要な CSS（composition の `<style>` にそのまま入れる）:

```css
@keyframes hf-fx-zoom-in { from { transform: scale(0.7); opacity: 0 } to { transform: scale(1); opacity: 1 } }
```

### `bounce`（クリップの頭）

入りはクリップの `style` に置く（`data-start` が原点なので遅延は要らない）:

```html
<video class="clip" data-start="3" data-duration="3" data-end="6" data-track-index="0"
  data-studio-fx-in="bounce" style="animation: hf-fx-bounce-in 0.6s linear"></video>
```

必要な CSS（composition の `<style>` にそのまま入れる）:

```css
@keyframes hf-fx-bounce-in {
  0% { transform: translate3d(0, -60px, 0) }
  36% { transform: translate3d(0, 0, 0) }
  54% { transform: translate3d(0, -18px, 0) }
  72% { transform: translate3d(0, 0, 0) }
  86% { transform: translate3d(0, -6px, 0) }
  100% { transform: translate3d(0, 0, 0) }
}
```

### `rotate`（クリップの頭）

入りはクリップの `style` に置く（`data-start` が原点なので遅延は要らない）:

```html
<video class="clip" data-start="3" data-duration="3" data-end="6" data-track-index="0"
  data-studio-fx-in="rotate" style="animation: hf-fx-rotate-in 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94)"></video>
```

必要な CSS（composition の `<style>` にそのまま入れる）:

```css
@keyframes hf-fx-rotate-in { from { transform: rotate(-90deg); opacity: 0 } to { transform: rotate(0deg); opacity: 1 } }
```
