# つまみ（人が画面で詰められる値）を宣言する

エディタの「つまみ」タブは、**composition が宣言した変数**をそのままスライダー・色・スイッチにする。
AI が作った動きの「角度をもう少し」「色だけ変えたい」を、人がやり直し依頼なしで詰められる。
**宣言するかどうかで、人が直せるか（AI に頼み直すしかないか）が決まる**ので、数値・色・on/off に
なる値は最初から宣言する。

## 1. 宣言の書き方

ルートの `<html>` に `data-composition-variables`（JSON の配列）。HyperFrames の変数宣言そのもの。

```html
<html data-composition-variables='[
  {"id":"bandAngle","type":"number","label":"帯: 角度","default":-18,"min":-45,"max":45,"step":1,"unit":"°"},
  {"id":"bandMain","type":"color","label":"帯: 主色","default":"#ff2e88"},
  {"id":"glow","type":"boolean","label":"光: グロー","default":true},
  {"id":"shape","type":"enum","label":"形","default":"band",
   "options":[{"value":"band","label":"帯"},{"value":"circle","label":"円"}]}
]'>
```

| type | つまみ | 必須 |
|---|---|---|
| `number` | スライダー | **`min` と `max`**（無いと出ない）。`step` `unit` は任意 |
| `color` | 色 | `#rrggbb` |
| `boolean` | スイッチ | — |
| `enum` | 選択 | `options: [{value,label}]`。`default` は options の中 |
| `string` | **つまみにならない**（文言は別の画面で直す） | — |

- **`label` は「見出し: 名前」**と書く。同じ見出しの項目が 1 つの群にまとまる（全角コロンも可）。
  見出しが無いものは先頭の群。
- 属性値は `'` で囲むので、JSON の中の `'` は `&#39;` にする。
- `default` は実際の見た目と**必ず一致**させる（つまみを動かす前の絵が既定値）。

## 2. 値を CSS に届ける（ここを外すと、つまみを動かしても絵が変わらない）

人が動かした値は、クリップの `data-variable-values`（`{"bandAngle":15}`）に入り、
**そのクリップの CSS カスタムプロパティ `--<id>`** として届く。

```css
.band { transform: rotate(calc(var(--bandAngle, -18) * 1deg)); background: var(--bandMain, #ff2e88); }
```

- `var(--id, 既定値)` の**既定値は宣言の `default` と同じ**にする。
- **`data-var-text` / `data-var-src` には届かない**（文言と素材の差し込みは `bind_composition_variable` の経路）。
  つまみにするのは CSS で見た目に効く値だけ。
- 数値はそのまま入る（単位は CSS 側で `* 1deg` / `* 1px`）。boolean は `1` / `0` ではなく、
  `calc()` で効かせにくいので、効き目を 0〜1 の number にするか、enum にする。
- アニメーションの**時間**（duration）はつまみにしない（尺は HTML が正本）。
- スクリプトで値が要るときは、初期化時に公式の `window.__hyperframes.getVariables()`
  （`const { angle } = …`）で読む。`getComputedStyle(root).getPropertyValue('--id')` でも同じ値が読める。
  どちらもインスタンスごとの値（host の `data-variable-values`、無ければ宣言の `default`）を返す。
- **宣言したつまみは必ずどこかで読む。** 読まれないつまみは、Studio にスライダーが出るのに動かしても
  何も変わらない（ビルドも `hyperframes check` も通る）。`put_composition_bundle` の `warnings` に
  `knob <id> is declared but nothing reads it` が出たら、`var(--id)` か `getVariables()` で読むか、
  宣言を消す。**読み方が見えるのは文字列として書いたとき**だけで、id を組み立てて読む書き方
  （`` `--${name}` ``）は警告になるので、リテラルで書く。
- `var(--id, 既定値)` の既定値が宣言の `default` と違うと、同じく `warnings` に
  `reads var(--<id>, …) but declares default …` が出る。動かす前の絵が Studio の表示とずれるので、
  どちらかに揃える（`0` と `0.0`、`#FF0000` と `#ff0000` は同じ値として扱われる）。
- 宣言が 9 個を超えると `N knobs are declared` が出る（§3 の目安）。
- **効くかどうかは自分の目で確かめる。** 層を書いたら、つまみの値を既定と別の値（範囲の端）にして
  `data-variable-values` へ入れ、`snapshot --at` で 2 枚撮って絵が変わっているのを見る。
  警告が出ないことは「読まれている」までしか保証しない（読んだ値が絵に届くかは別）。

## 2.5 プリセット（雰囲気をワンクリックで切り替える）

つまみが 4 本以上あるなら、値の組に名前を付けて**ルートの `<html>`** に `data-studio-presets` で宣言する
（つまみタブの頭にチップが出る）。公式の仕組みではないので `data-studio-` の名前空間を使う。

```html
<html data-composition-variables='[…]'
      data-studio-presets='{"ポップ":{"bandMain":"#ff2e88","bandScale":1.4},
                            "落ち着き":{"bandMain":"#4a5a7a","bandScale":0.8}}'>
```

- 中身は `{ "名前": { 変数id: 値 } }`。名前は短く（チップに並ぶ。3〜6 個）。
- 値は宣言に照らして検査される。**宣言に無い id・型の違う値・選択肢に無い enum が 1 つでもあると、
  そのプリセットは丸ごと出ない**（一部だけ当てない）。id は宣言と一字違わず書く。
- 選ぶと**全つまみ**がその値になる（書いていないつまみは既定に戻る）。全部書かなくてよいが、
  雰囲気を決める値は漏らさない。
- 人が個別のつまみを動かすと、チップは「カスタム」になる。
- 人は「いまの値」に名前を付けて、そのクリップへ保存できる（クリップ側の `data-studio-presets`。
  層のファイルの宣言は書き換えない）。AI が層のファイルを直すときも、人が保存したものは消さない。

## 3. 人が詰めた値を壊さない

- 既存の composition を**直すとき**、人が動かした `data-variable-values` は**消さない・写す**。
  クリップを置き直すなら既存の値をそのまま持たせる。
- 宣言の `id` を**変えない**（変えると人が詰めた値が黙って効かなくなる）。直す必要があるときは
  既定値と範囲だけを動かし、意味が変わるなら新しい `id` にして古い宣言は消す。
- つまみの数は**多すぎない**（目安 8 個まで。群は 3 つまで）。人が触る価値のある値だけ出す。
  選ばれなかったものは固定値のままでよい。

## 4. 3D の層

モーションの層（`place_previz_clip` で置いたクリップ）は、カメラのつまみ（`p3d_*`）を**自分で宣言する**
（層のファイルはシーンから組まれる）。つまみの値はクリップの `data-variable-values` に入る。`p3d_*` の id は触らない
（意味と範囲は previz スキルの `references/motion-graphics.md` §5）。
