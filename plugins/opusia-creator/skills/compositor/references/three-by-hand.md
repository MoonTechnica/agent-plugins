# three.js を composition に直に書く（例外）

3D の層は 3 つに分けてある（設計 docs/designs/2026-11-11-motion-stills-and-3d-final.md §12）:

| 層 | 何で作るか | 使うとき |
|---|---|---|
| 器 | HyperFrames の composition | いつも（2D の文字・写真・字幕・音もここ） |
| 平面の奥行き | CSS 3D（`perspective` + `preserve-3d`） | 文字や写真の面が奥行きの中を動く。日本語の縦組みが要る（lyric-motion.md §5.1） |
| 立体の 3D | **プリビズの文書**（previz スキル）を `place_previz_clip` で層（参照）にする | キャラ・小物・カメラワーク・画像と文字の板・**動く 2D を 3D に置くカード**（パペット・縦組みの歌詞・映像。previz の references/look.md §2） |

物理（崩れる・散らばる）・粒子・ジオメトリノード・布・煙は、three.js ではなくエージェントが Blender（`bpy`）で
透過の動画にする（[blender-by-hand.md](blender-by-hand.md)）。

**three.js を自分で書くのは、この 3 つのどれでも作れないときだけ。** 書く前に、どれでも作れない理由を
1 行で言えること。言えないなら書かない（プリビズの文書なら人がエディタで直せ、同じプレイヤーで書き出せる）。

## 1. 直書きしてよいもの

| やりたいこと | 理由 |
|---|---|
| 字が 1 つずつ**奥行き方向に**散る・組み上がる・トンネルになる | カードは平らな 1 枚で、字ごとに別の奥行きへは動かない（平面の中で 1 字ずつ動くならカードで足りる） |
| 押し出した立体文字（厚み・面取り・光） | 文書は板しか持たない |
| 粒子・シェーダーの面（流体・ノイズの地・光の帯） | 文書に粒子もシェーダーも無い |
| 文書の語彙に無い変形（曲がる・ねじれる・面が割れる） | 同上 |

キャラ・カメラワーク・看板・浮かぶ歌詞（語の単位）・VRM のキャラは**直書きしない**。

## 2. 守ること（書き出しは GPU 無しの WebGL）

- **入力は時刻 t だけ。** 描くのは `hf-seek` を受けたときだけ（`window.addEventListener("hf-seek", …)`）。
  `requestAnimationFrame` / `setAnimationLoop` / `Date.now()` / `Math.random()` を使わない（乱数は
  種の決まった自前の関数）。前のフレームから積み上げない —— 書き出しは並列のワーカーが飛び飛びの時刻を描く。
- **`hf-seek` の時刻は全体の時刻。** サブ composition の中で描くなら、根要素とその親たちの `data-start` の和を
  引いて局所時刻にする（プリビズのプレイヤーの `layer.ts` と同じ）。
- **版は importmap で 1 つだけ。** `three@0.185.1`（プリビズと同じ）。プリビズの層と同じ composition に
  置くなら、プリビズの層が使う `three@0.185.1` と同じ版を importmap に書く（版を食い違わせない）。
- **2 倍で描いて縮める**（`antialias` が効かない）。`renderer.setPixelRatio(1)`、`setSize(W * 2, H * 2, false)`。
- **書体・テクスチャ・モデルを読み終えるまで撮影を待たせる。** 読み込みと板の焼き込みを
  `window.__hf.buildReady["<名前>"] = promise` に同期的に登録する（登録しないと最初の数フレームが
  豆腐・真っ白）。文字は `document.fonts.load('800 64px "<書体>"', text)` の後に焼く。
- root に `data-duration`。three.js だけで描く composition は root に `data-no-timeline`
  （GSAP の timeline を持たないと待ち合わせで止まる）。GSAP と混ぜるなら付けない。
- 下の 2D を透かすなら `new THREE.WebGLRenderer({ alpha: true })` と `scene.background = null`。
- VRM をどうしても直書きで使うなら three-vrm の作法どおり: 更新は `vrm.update(delta)` 1 本、**0 秒から一定の
  刻み**（fps の整数倍・60 歩 / 秒以上）で進め、時刻が戻ったら `vrm.springBoneManager.reset()` と MToon の UV
  アニメの位置を 0 に戻して進め直す（揺れは前の状態から積み上げる）。

## 3. 書いたあと

- 書き出して、頭・カットの境目の前後・最後の 1 コマを見る（`hyperframes snapshot --at`）。同じ時刻を 2 回
  書き出して同じ絵になること（揺れ・乱数が混ざっていないこと）。
- 同じ 3D の型が 3 回作られたら、プリビズの文書に足すかをユーザーに相談する（それまでは composition ごとに書く）。
