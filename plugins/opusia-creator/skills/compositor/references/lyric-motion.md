# MV の歌詞を演出として組む（書体・縦組み・叩きつけ・前後関係・3D）

何をどれだけやるか（見せる行と読ませる行・ジャンプ率・前後関係の 3 択・配分・避けること）は
`genre-playbook` の references/mv-lyrics.md が正本。ここは **HTML / CSS / GSAP / three.js でどう書くか**。
出入りの時刻・1 枚の量・`lyric_check.py` は SKILL.md §10「MV の歌詞」のまま使う。
根拠と実測は `docs/_research/2026-11-11-mv-lyric-typography.md`。
動きの選び方（強さ・気持ちと意味・曲の流れ）と、動きの語彙をここで何で作るかは [text-motion.md](text-motion.md)。

## 0. どこに書くか

| 型 | 置き場 |
|---|---|
| 叩きつけ・散らし組み・1 文字ずつ・避ける・重ねる・演出として動かす行 | **モーションのシーンの 2D レイヤー**（出方が型で足りる行は `text` レイヤー。足りない動きだけ `html`。previz の `references/motion-graphics.md` §2.7）。本編のトラックに部品を並べない |
| **人物の後ろに回す**・層の間に挟む・3D の空間に置く | モーションのシーン（`place: "back"` + `transparent: true`、またはカード。[illustration-mv.md](illustration-mv.md)） |
| 読ませる行（字幕的な歌詞・カラオケ風の行送り） | 本編のトラック（`captions`） |

## 1. 書体

| 書体 | 状態 |
|---|---|
| **Noto Sans JP（400 / 700）** | HyperFrames に同梱。何もしなくても Cloud で確実に出る |
| それ以外の日本語（明朝・筆・極太ゴシック） | 同梱されていない。下のどちらかで読む |

1. **Google Fonts の名前を `font-family` に書く**（今すぐできる）: コンパイラが書き出し時に取得して埋め込む。
   lint が `font_family_without_font_face` の **warning** を出す（error ではない）。Cloud では取得できないと
   書き出しが**落ちる**（黙って別の書体にはならない）。
2. **書体を自分で埋め込む**（確実）: 歌詞の文字だけに絞った woff2 を `@font-face` で読む。
   `font-family` は自前の名前（`"Lyric Mincho"`）にする。縦組みに要る字形の機能を必ず残す
   （`pyftsubset … --layout-features+=vert,vrt2,vpal,palt --flavor=woff2`。`vert` が落ちると「、。ー「」」が横向きになる）。
   絞ると 1 曲ぶん（約 600 字）で 90KB 前後。`files` はテキストで渡すので、woff2 は
   `src: url(data:font/woff2;base64,…)` に入れる。

**実測（2026-11-17、HyperFrames 0.9.58 のローカル書き出し `snapshot`。1 コマを目で確認）**:

- 方法 1（Google Fonts の名前を `font-family` に書くだけ）は**効く**。コンパイラが取得して埋め込む。
  確認できた書体と字面: Zen Old Mincho（400 と 900 で太さが変わる）/ Shippori Mincho 800 / Kaisei Tokumin 800 /
  Yuji Syuku（毛筆）/ Yuji Boku / **Dela Gothic One（極太）** / M PLUS 1 900 / Zen Kaku Gothic New 900 / Klee One 600
  （どれも「愛と夢」が別々の字形で出た）
- ⚠️ **存在しない名前は黙って別の書体に落ちる**（ローカルでは WARN が 1 行出るだけで失敗しない。
  この実測では明朝系の既定書体になった）。綴りは Google Fonts の表記どおりにし、**初出の書体は 1 コマ見て確かめる**
- ⚠️ **未確認**: (1) **HeyGen Cloud の書き出し**（ローカルのコンパイラが取得するので、Cloud 側がネットワークで
  Google Fonts に届くかは別。試すには課金（出力 1 分あたり）の書き出しが要る）、(2) **Studio のプレビュー**
  （Studio の束ね器は Google Fonts を取得しない。プレビューでは別の書体に見える可能性が高く、
  書き出しとずれる）、(3) data URI の `@font-face` を lint が解消と見なすか。
  **書体を選んだら、Cloud 書き出しの前に必ず `hyperframes snapshot` で 1 コマを見る**。プレビューで見えた字面を
  書体の確認にしない。

候補（すべて SIL OFL。書き出した映像に条件は及ばない。OFL FAQ 1.13）:

| 役割 | 書体 |
|---|---|
| 細〜中の明朝（静か・透明感） | Shippori Mincho（400〜800）/ Zen Old Mincho（400〜900）/ Noto Serif JP（200〜900）/ Kaisei Tokumin / Hina Mincho |
| 極太の明朝・筆（情念・毒） | Zen Old Mincho 900 / Shippori Mincho 800 / Kaisei Tokumin 800 / Yuji Syuku・Yuji Boku・Yuji Mai（毛筆） |
| 極太の角ゴシック（叩きつけ） | Dela Gothic One / M PLUS 1（〜900）/ Zen Kaku Gothic New（〜900） |
| 手書き | Klee One / Yomogi |

モリサワ・フォントワークス等の商用書体は使わない（映像への使用条件が契約ごと）。

## 2. 組み

```css
.lyric-v { writing-mode: vertical-rl; text-orientation: mixed; line-height: 1;
           font-feature-settings: "vpal" 1; }            /* 縦の約物の詰め */
.lyric-v .tcy { text-combine-upright: all; }               /* 縦中横は 2〜3 桁の数字だけ span で */
```

- **1 字ずつ `<span>` を HTML に直書きする**（歌詞は事前に分かっている。SplitText を実行時に走らせない）。
  出る秒・語頭・強調は `data-at` / `data-hit` に持たせ、timeline はそれを読んで組む。
- **ジャンプ率は `font-size` を最初から変えて組み、動きは `scale` で付ける**（`fontSize` / `letterSpacing` を
  動かすと描き直しでカクつく）。
- **散らし組み**: 1 列 = 1 要素の絶対配置。列ごとに `top` と `font-size` を変える。**大きい字は別の列に分ける**
  （縦組みの中で 1 字だけ大きくすると列の幅がその字に合わせて広がる）。避けるなら列の座標を人物の層の輪郭の外に。
- 文字は `document.fonts.ready` の後に組み、`window.__timelines[<id>]` には**組み終えてから**登録する。

## 3. 叩きつけ（巨大な 1〜2 字）

```html
<div class="slam" style="position:absolute;left:8%;top:6%;font:900 860px/1 'Lyric Mincho';color:var(--accent)">邪</div>
<div class="tail" style="position:absolute;left:44%;top:58%;font:700 96px/1 'Lyric Mincho';color:var(--accent)">っぽいな</div>
<script>
document.fonts.ready.then(() => {
  const tl = gsap.timeline({ paused: true });
  const HIT = 12.48;                         // 曲の地図の打点（手で測らない）。シーン用 composition なら相対時刻
  tl.set(".slam", { autoAlpha: 0 }, 0)
    .fromTo(".slam", { autoAlpha: 1, scale: 1.4 }, { scale: 1, duration: 0.1, ease: "power4.out" }, HIT - 0.06)
    .fromTo(".tail", { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: 0.25, ease: "power2.out" }, HIT + 0.35)
    .to([".slam", ".tail"], { autoAlpha: 0, duration: 0.2 }, HIT + 2.2);
  window.__timelines["<composition-id>"] = tl;
});
</script>
```

着地（scale 1.4 → 1 を 2〜4 コマ）を打点の 1〜2 コマ前に置き、着地したら止める
（`hyperframes-animation` の `rules/kinetic-beat-slam.md`）。

## 4. 人物との前後関係・合成

| 型 | 書き方 |
|---|---|
| 後ろに回す | `z-index` で 背景の層 < 文字 < 人物の層（layerize）< 前景・効果。層に分かれていない持ち込みの 1 枚は切り抜けばできる（[subject-text-layering.md](subject-text-layering.md)）。これから描く絵は art-director の layerize |
| 避ける | 文字を人物の層より上に置き、座標を人物の bounding box / 輪郭の外に |
| 重ねる | 人物の層より上。小さな字を頬・肩・手に。**目と口の上に置かない** |
| 背景になじませる | 文字に `mix-blend-mode: overlay`（溶ける）/ `difference`（背後を反転） |
| 文字の中に絵 | 画像なら `background: url(…); background-clip: text; color: transparent`（動画 + SVG mask は未検証） |
| 画面全体の処理 | 色収差（`rules/chromatic-glitch.md`。時刻を量子化したハッシュで決定論）・フィルム・黒帯は**見せる文字を含むラッパー**に掛ける |

## 5. 奥行き（3D）

> 空間に浮かぶ語・カメラが通り抜ける表現（トンネル・散らし→集め・バウンス・円筒など）は previz の
> references/kinetic-typography-3d.md と `scripts/kinetic_3d.py`。使いどころは genre-playbook の kinetic-typography.md。

**線引き**: 層が 10 枚程度までで、面が交差せず、光と影が要らない → **CSS 3D**。
それを超える（大量の文字・交差・押し出した厚み・ライティング・粒子と一緒に動く）→ **three.js**。
迷ったら CSS 3D で組み、破綻した所だけ three.js にする。

### 5.1 CSS 3D

`hyperframes-animation` の `rules/3d-camera-flight.md`（静的な `perspective` の舞台 + `preserve-3d` のワールドを
動かす）と `rules/depth-of-field-blur.md`。

- **`preserve-3d` の要素とその途中の親に `filter` / `opacity < 1` / `mix-blend-mode` / `mask` / `clip-path` /
  `overflow` を付けない**（仕様で平らに落ちる）。ぼかし・透明度は**葉の要素**に、色収差・フィルムは舞台の**外側**の
  ラッパーに掛ける。
- 面どうしは Z で十分離す（交差・ほぼ同じ深さの面はちらつきうる）。
- 文字の面は DOM なので縦組み・約物・書体がそのまま効く（three.js より日本語に強い）。

### 5.2 three.js（文字のトンネル・空間に散る歌詞・押し出した立体文字）

**まず直書きしない形を探す**: キャラやカメラワークと文字を合わせるなら、3D はプリビズで組み `place_previz_clip`
の層に 2D の文字を重ねる（SKILL.md §9.3）。3D の空間に語や行の単位で浮かぶ歌詞は、プリビズの文書の
**文字の板**（previz の references/look.md §2）で置け、縦組みや 1 字ずつの出入りは 2D で組んで**カード**に貼る
（同 §2.1、[illustration-mv.md](illustration-mv.md)）。three.js を直に書くのは押し出す・字が奥行きへ散る・
トンネルのように文書で作れないときだけで、規則は [three-by-hand.md](three-by-hand.md)。
カメラの言葉（寄り・パン・ドリー・アーク、レンズの mm と画角、カットの間の 180°）は `previz` の references/camera-moves.md・lens.md を読んで**同じ語で**決める。

| 文字の描き方 | 使うとき |
|---|---|
| **Canvas に文字を焼いた板**（既定） | ほぼ全部。縦組みは 1 字ずつ `fillText` で置く。寄る量に合わせて Canvas を大きく |
| `TextGeometry`（押し出し） | 厚み・面取り・光が要る見せ場だけ（1〜2 回）。書体を typeface.json に変換し、歌詞の字だけに絞る。約物は縦向きにならない |
| troika-three-text（SDF） | 使わない（woff2 を読めず、収録外の字を CDN へ取りに行く） |

守ること（2 倍描き・`buildReady` での待ち合わせ・時刻だけで描く・版）は [three-by-hand.md](three-by-hand.md) §2。

```js
// 縦組みの板（1 字ずつ上から下へ）。約物を含む語は字形の向きを別に扱う
function bakePlane(text, size, color) {
  const px = 512, c = document.createElement("canvas");
  c.width = px; c.height = px * [...text].length;
  const g = c.getContext("2d");
  g.fillStyle = color; g.font = `800 ${px * 0.9}px "Lyric Mincho"`;
  g.textAlign = "center"; g.textBaseline = "top";
  [...text].forEach((ch, i) => g.fillText(ch, px / 2, i * px));
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false });
  return new THREE.Mesh(new THREE.PlaneGeometry(size, size * [...text].length), mat);
}
```

全体の雛形（カメラのドリーで語の間を進む）は調査報告の §6.3。

## 6. 書き順・変形・作字（見せ場だけ）

| やりたいこと | 書き方 |
|---|---|
| 輪郭をなぞって現れる | 字のアウトラインを SVG パスにし `stroke-dashoffset`（`rules/svg-path-draw.md`）/ DrawSVG。描き終えたら塗り |
| 書き順どおりに書く | 画数の少ない要所の 1〜2 字だけ、画ごとの中心線を手でパスに書き、塗りの字の mask にする。または上→下・左→右のワイプ数本で近似（KanjiVG は CC BY-SA 3.0 なので使わない） |
| 字が次の字へ変わる | 2 字のアウトラインを SVG パスにして MorphSVG。パスは opentype.js（woff2 不可）か fontTools で取り出す |
| 字の一部を図形に | 字を SVG にして画の一部を別の要素に差し替える。1 曲 1〜2 字 |

## 7. 書き出す前に見るもの

- `lyric_check.py`（出入りの時刻・居残り）
- **縦組みの約物（、。「」ー）の向き・縦中横・`vpal`** を書き出した 1 コマで見る
- 初めて使う書体が出ているか（豆腐・別の書体になっていないか）
- 目と口に文字が乗っていないか、巨大な字が人物を潰していないか
- 3D の文字の縁のジャギ（2 倍描きが効いているか）
