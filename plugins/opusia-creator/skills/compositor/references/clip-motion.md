# クリップのモーション（位置・スケール・回転・不透明度）

エディタの「モーション」欄（Premiere のエフェクトコントロールの Motion と同じ。ストップウォッチ・
◀◆▶・キーフレームの菱形・Easy Ease / Linear / Hold）で人が付ける動き。**AI も同じ形で書く**と、
人が画面でそのまま開いて直せる。違う形（独自の CSS アニメーション）で書くと、画面は
「ただのアニメーション」として扱い、人は触れない。

**ここで書くのは 1 本のクリップの基本の動き**（ゆっくり寄る、フェードイン、位置ずらし）。
図形・文字・3D が組み合わさった**動きの絵そのもの**はモーション（プリビズ）で作る
（previz スキルの `references/motion-graphics.md`）。

## 1. 形

クリップ要素に `data-motion`（JSON）を付ける。時刻 `t` は**クリップの頭からの秒**。

```html
<img class="clip" data-start="2" data-duration="6" data-track-index="1"
     data-motion='{"scale":[{"t":0,"v":1},{"t":6,"v":1.12,"ease":"ease-in-out"}],
                   "opacity":[{"t":0,"v":0},{"t":0.5,"v":1}]}'>
```

| プロパティ | 値 | 備考 |
|---|---|---|
| `position` | `[x, y]` px（クリップの置き場所からのずれ） | `translate` で効く |
| `scale` | 倍率（1 = 等倍、0 以上） | |
| `rotation` | 度 | |
| `opacity` | 0〜1 | 範囲外は端に丸まる |

- キーは `{t, v, ease}`。`ease` は `linear`（既定）/ `ease-in` / `ease-out` / `ease-in-out` / `hold`。
- **`ease` は「出発するキー」に付く**（そのキーから次のキーへの動き方）。previz の `keys.opacity`
  （到着するキーに付く）とは逆なので取り違えない。
- 最後のキーのあとは**その値で止まる**（`forwards`）。クリップの外の時刻にキーを置かない。
- キーが 1 つだけのプロパティは動かない固定値になる（人が画面で基準値を詰めた状態）。

## 2. CSS は自分で書かない（スクリプトで作る）

`data-motion` だけでは、**書き出しもプレビューも動かない**。ブラウザが読む CSS（`@keyframes`）と、
それを指す `animation`、画面が「このモーションは自分の形」と識別する運び屋の要素が要る。
この 3 つは**画面側のコードと一字違わず一致**していなければならないので、手で書かず
スクリプトに作らせる:

```bash
python3 <SKILL_DIR>/scripts/clip_motion.py \
  --spec '{"scale":[{"t":0,"v":1},{"t":6,"v":1.12,"ease":"ease-in-out"}]}' \
  [--animation '<クリップが既に持っている animation の値>']
```

標準出力は JSON: `{hash, attr, carrier, keyframes, animation}`。

| キー | 置き場所 |
|---|---|
| `attr` | クリップの `data-motion` の値（そのまま） |
| `carrier` | **composition のルートに 1 つ**置く `<div data-studio-motion="…" style="display: none"><style>…</style></div>`。画面が識別する運び屋 |
| `animation` | クリップの `style` の `animation:` の値（既存の効果のアニメーションがあれば `--animation` に渡すと、**モーションを先・効果を後**に並べて返す） |

- 同じ内容は同じ `hash` になる。クリップを増やしても運び屋は内容ごとに 1 つ。
- 不正な指定は終了コード 2 と stderr の理由で返る（黙って直さない）。
- モーションを消すなら `data-motion`・運び屋・`animation` の `m-<hash>-…` の部分を**3 つとも**消す。

## 3. 守ること

- **`translate` / `scale` / `rotate` / `opacity` だけ**で動かす（`transform` を使わない）。
  効果（エフェクト）が `transform` を使うことがあり、同じプロパティを奪い合うと片方が消える。
- **人が付けたモーションを AI が黙って書き換えない。** 「直して」と頼まれたクリップだけ。
  直すときは既存の `data-motion` を読んで、変えるキーだけ変えて**スクリプトを回し直す**。
- クリップを分割・複製するときは、右側の `data-motion` のキー時刻を切り直し（頭が 0 になるように）、
  `clip_motion.py` で運び屋と `animation` を作り直す。HTML をそのままコピーすると右側が頭から動き直す。
- **`animation-fill-mode: forwards` を使わない**というルール（SKILL.md §9）の**例外**:
  `m-<hash>-…` のアニメーションだけは `forwards` で書かれる（スクリプトがそう出す）。
  効果のアニメーションには引き続き使わない。
