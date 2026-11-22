# テンプレートの棚（`list_templates` / `get_template` / `save_template`）

棚は人と同じ `stock_items`（組織の持ち物。システムが置いた既定も混ざる）。
置くのは **`place_template`**。画面のドロップと**同じ変換**で、テンプレートのクリップが
本編のルート直下に普通のクリップとして並ぶ。**自分で HTML を書き換えない**
(id・時刻・レーン・CSS の付け替えは機械の仕事。手でやると、間違えても
エラーにならず画面だけが崩れる)。

## 1. 置く（既にあるテンプレートを使う）

1. `list_templates(project_id, query?)` — **書く前に引く。** 「いつもの」「前と同じ」
   「ブランドの」「テンプレで」と言われたとき、タイトル・ローワーサード・字幕・転換を
   ゼロから書く前に。`query` は名前と説明を探す。棚は**場面**でしか探せない。
2. `get_template(stock_item_id)` — 中身と `meta`（変数・尺・寸法・素材枠）。文言を変えるなら
   `meta.variables` の `id` が `values` のキーになる。
3. `place_template(composition_id, stock_item_id, at_seconds, track_index?, values?)`
   - `values` は変数 id → 文言。**打った文言はクリップの中身へ入る**（置いたあと
     テキストクリップとして直せる）。
   - `track_index` を省けば、既存の映像レーンの**上に新しいレーン**を開く（重ならない）。
     指したときはそのレーンから上へ並び、既存のクリップと重なれば**書かずに断る**
     （誰のクリップかが文に載る）。
   - 読んだ時点の `head_seq` で書く。読んだ後に人が触っていれば断るので、読み直して呼び直す。
4. 戻りの `form` を読む。`clips` = 普通のクリップに展開した（2 本以上は `data-link-id` で
   束ねてある。外せば個別に動く）。`host` = スクリプトで動くテンプレートなので
   サブ composition 1 つとして置いた（中のクリップは個別に直せない。直すなら
   `get_composition_bundle` で `compositions/tpl-*.html` を読み、そのファイルを直す）。
5. 置いた後は `get_composition_bundle` で普通のクリップとして読め、`put_composition_bundle` で 1 本ずつ直せる。

**素材枠（`media_slots`）があるテンプレートは、置いても空のまま。** 素材が要るなら
ホスト側のレーンへ別に置く。**サブ composition を含むテンプレートは置けない**
（`place_template` が断る。新規タイムラインとしてなら使える）。

## 2. 作る・直す（「ローワーサードのテンプレを作って」）

| 規則 | 理由 |
|---|---|
| 形は **`<template>` 形のサブ composition 1 ファイル**。`<template>` の中に `<style>`・`<div id="root" data-composition-id="…">`・（要れば）`<script>`。**`<head>` に `<style>` を置かない** | 展開は `<template>` の中しか運ばない。`<head>` の CSS は黙って落ちる |
| ルートに `data-start="0"` `data-width` `data-height` `data-duration` | 尺は書き出しの長さそのもの |
| **寸法は依頼のタイムラインに合わせる**（`list_compositions` の `width/height/fps`）。無ければ 1920×1080 / 24 | 違うと置いたときに中央寄せの警告になる |
| 文言・色は**変数**（`data-composition-variables` の宣言 + `data-var-text` / `var(--id)`）。`default` に見本 | 人が置くときセンターの入力欄で差し替えられる。ハードコードすると「3 パターン」が 3 ファイルになる |
| **素材枠（`data-var-src`）は作らない**。ロゴが要るなら `description` に書く | 置いても空のまま。壊れて見える |
| **動きは既定で CSS アニメーション**（`@keyframes`）。GSAP が要るときだけ GSAP（§2.1） | CSS は置いたとき**普通のクリップへ展開され、1 本ずつ直せる**。GSAP は host 形（ブロック 1 本）で置かれる |
| GSAP を使うなら `window.__timelines["<root の id>"]` に**止めた timeline**を登録し、本体は CDN の `<script src>` で読み込む | 探索キーは root の id。本体を `<script>` に貼り込むと、ライブラリ内の `Math.random()` / `Date.now()` で lint の error になる |
| `description` は**場面**（「人物紹介の名前出し。右下、3 秒」） | 次のタイムラインで自分（別セッション）が引く手がかり |

### 2.1 動きの付け方 — CSS か GSAP か（どちらも使える。置かれ方が変わる）

**GSAP を禁止はしない。** HyperFrames の機能はそのまま使える。選ぶと、置いたときの形が変わるだけ。

| | CSS アニメーション（既定） | GSAP などの script |
|---|---|---|
| 置いたとき | **普通のクリップに展開**（`form: clips`）。バー・文字を 1 本ずつ選んで直せ、エージェントも HTML を読んでそのまま直せる | **host 形**（`form: host`）。タイムラインではブロック 1 本。中身は `compositions/tpl-*.html` を直す |
| 時刻 | 各クリップの `data-start` が基準なので、置いた位置へそのままずれる | 箱の中で完結するので、そのまま動く |
| 書き出し | 通る | 通る（CDN の `<script src>` で読み込むこと） |

**CSS で足りる**: 出入り（フェード・スライド・スケール・ワイプ）、複数要素の時間差（`animation-delay` と
`--i`）、タイプライター（`steps()`）、繰り返しの装飾。弾むイージングは `linear()` で近似できる。

**CSS で足りない（GSAP を選ぶ）**: 差し込む文言を**1 文字ずつ順に出す**演出（CSS は文字を動的に
分けられない）、他の動きの終わりを待つ連鎖・ラベルを使う振り付け、画面上の測定値に基づく動き、
乱数・パーティクル、複雑な SVG のモーフィング。Lottie / Three.js も script 前提なので host 形になる。

選び方: **まず CSS で書けるかを考える**（展開できれば、人もエージェントも後から 1 本ずつ直せる）。
CSS で足りない動きが本当に要るときだけ GSAP を使い、`description` に「GSAP のため 1 本ずつは
直せない」と書いておく。

GSAP の書き方（`hyperframes-animation` の契約）: `<script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>`
で読み込み、timeline は `gsap.timeline({ paused: true })`、`window.__timelines["<root の id>"]` に登録する。
`Math.random` / `Date.now` / `repeat: -1` は使わない（レンダーが決定論でなくなる）。

保存: `save_template({ project_id, name, description, files: {"index.html": <block>}, width, height, fps })`。

- 保存前にサーバが **block 本体をそのまま lint** し、error があれば何も置かずに指摘を返す
  （直して置き直す）。host で包んで掛けても通らない — 包んだ側にタイムライン登録が
  無いと別の error になる（実測）。
- 戻りの `warnings` を読む: 変数が 1 つも無い / 素材枠が空のまま、など。
- **直すときは `replaces` に前の `stock_item_id`**。新しい行を作ってから古い行を外すので、
  棚に試作が溜まらない。システム所有の行は外せない。
- 試作の後始末だけなら `delete_template`（自組織の行だけ）。

人は棚のタイルをクリックしてセンターで動きを確かめ、気に入ったら置く。「2 番目を少し
小さく」はチャットで続け、`replaces` で差し替える。

## 3. やらないこと

- `list_templates` を引かずに「いつもの」を自作しない（棚と見た目が割れる）
- 音声クリップをテンプレートに入れない（テンプレートは映像だけ）
- 保存した行を `put_composition_bundle` で直接置き換えようとしない（棚は `save_template`）
