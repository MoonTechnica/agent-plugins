---
name: fdpocket-app-accessibility
description: ミニアプリを誰でも使えるようにする。キーボードだけで操作できる・フォーカスが見える・読み上げで意味が伝わる・コントラストと文字の大きさ・動きを減らす設定・タッチの大きさ。WCAG 2.2 AA の要点を、ひな形の部品と HTML の書き方で満たす手順と確認。画面を作る・直すときと、仕上げの確認で使う。
---

# 誰でも使える画面にする

*ひな形の部品（`radix-ui` 由来の Dialog・Sheet・Tabs・Switch など）は読み上げとキーボードに対応している。崩れるのは**自分で書いた部分**。そこをこの Skill で守る。*

目標は WCAG 2.2 の AA。業務アプリは毎日・長時間使われるので、使いにくさがそのまま仕事の遅さになる。

## 1. 正しい要素を使う（いちばん効く）

| したいこと | 使う要素 | 使わない |
|---|---|---|
| 押して何かする | `<button type="button">`（`Button`） | `<div onClick>` / `<span onClick>` |
| 別の画面へ行く | `<Link>`（`<a href>`） | `button` + `navigate()` |
| 入力 | `<input>` + `<Label htmlFor>` | ラベルの無い入力・プレースホルダーだけのラベル |
| 選ぶ（6 個以上） | `<select>` | 自作のドロップダウン |
| 見出し | `<h1>`（画面に 1 つ。`PageHeader`）→ `<h2>` … の順 | 太字の `<div>` |
| 一覧 | `<ul>` / `<ol>` | `div` の羅列 |
| 表 | `<table>` + `<th scope>`（`$fdpocket-app-data-display` §1） | `div` の格子 |

- `div` に `onClick` を付けたくなったら `button` にする。`role="button"` + `tabIndex` + キー操作を自分で足すより確実。
- ページの大枠は `<nav>` `<main>`（`AppShell` が持つ）。画面の名前は `PageHeader` の `<h1>`（1 画面に 1 つ）。戻るのアイコンには `aria-label`（「連絡先に戻る」）。

## 2. キーボード

- すべての操作が Tab / Shift+Tab / Enter / Space / Esc でできる。キーボードの近道を足すときの約束（1 文字の近道は入力中に効かせない・ブラウザの近道を上書きしない）は `$fdpocket-app-responsive` §4。Tab の順は見た目の順（`tabIndex` に正の数を書かない）。
- **フォーカスが見える**: 部品は `focus-visible:ring-3 focus-visible:ring-ring/50`。自作の要素にも同じクラスを付け、`outline-none` だけにしない。
- 画面を移ったら、フォーカスを新しい画面の見出しか本文の先頭へ。ダイアログ・シートを閉じたら、開いたボタンへ戻す（部品がやる）。
- 下に固定したバーや通知が、フォーカスした要素を隠さない（WCAG 2.2 の 2.4.11）。

## 3. 読み上げ

- アイコンだけのボタンには `aria-label`（文言は辞書から）。飾りのアイコンには `aria-hidden`。
- 画像には `alt`。意味の無い画像は `alt=""`。
- 入力のエラーは `aria-invalid` と、エラー文への `aria-describedby`。必須は `required`（色や * だけにしない）。
- 画面が変わらずに結果だけ出るとき（保存した・3 件追加した・検索結果の件数）は `role="status"`（`aria-live="polite"`）の領域に文を入れる。失敗は `role="alert"`。
- 読み込み中の領域は `aria-busy="true"`。スケルトンは `aria-hidden` にし、「読み込んでいます」を `role="status"` で 1 回だけ。
- `document.documentElement.lang` を表示中の言語に（`$fdpocket-app-ui` §1）。

## 4. 見え方

- 文字のコントラスト 4.5:1 以上、大きい文字（24px 以上か 18.66px 以上の太字）と操作の枠・アイコンは 3:1 以上。トークンの組（`text-foreground` on `bg-background`、`text-muted-foreground` on `bg-background`、`text-primary-foreground` on `bg-primary`）は満たす。**`text-muted-foreground` を `bg-muted` の上に置くなど、組を崩したときに落ちる**。透明度（`/50`）で文字を薄くしない。
- **明と暗の両方で**同じ基準を満たす（`kit shot --theme dark` で撮って見る）。トークンの組は暗い画面でも満たすが、`dark:` で自分で書いた色・画像の上の文字は落ちやすい。
- **色だけで意味を伝えない**（状態・エラー・グラフの系列）。文言・アイコン・形を添える。
- 文字を 200% に拡大しても、はみ出さず読める（`rem` の単位・固定の高さを文字の箱に付けない）。
- 本文 16px、下限 12px（`kit shot` の `smallTextCount`）。

## 5. 動きと時間

- `motion-reduce:` で動きを止める（部品は対応済み。自作のアニメーションにも付ける）。点滅・自動で動くカルーセルを作らない。
- 自動で消える通知に、大事な情報や操作を載せない（失敗・取り消しは画面に残す）。
- 時間制限のある操作は作らない（作るなら延長できる）。

## 6. タッチ

- 操作は 44×44px 以上（`kit shot` の `smallTargets`）。隣の操作との間を 8px 以上。
- ドラッグ・スワイプ・長押しでしかできない操作を作らない。必ずボタンでもできる（2.5.7）。
- hover（マウスを乗せたとき）だけに出る操作・情報を作らない。指では出ない（`$fdpocket-app-responsive` §3）。

## 7. 確かめる

1. **キーボードだけで**、いちばん多い操作を最初から最後まで通す（マウス・タップを使わない）。どこにフォーカスがあるか常に見えたか。
2. `kit shot` の `checks`（`smallTargets` / `smallTextCount` / `lowContrastText`）が 0 / 空。
3. コードを読んで確かめる: `onClick` の付いた `div`・`span` が無い／アイコンだけのボタンに `aria-label`／すべての入力に `Label`／`<img>` に `alt`／生の色や透明度で薄くした文字が無い。
4. 画像を見られる環境なら、撮った画像で色だけの区別・薄い文字が無いか見る。見られないなら、そのことを結果に書く。
