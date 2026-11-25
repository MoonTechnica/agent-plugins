---
name: fdpocket-app-data-display
description: ミニアプリで数字・一覧・表・グラフを読みやすく見せる。スマホは行の一覧・PC の管理画面は表、数値と日時の書式、状態の見せ方、ダッシュボードの要約、依存を足さずに SVG と chart トークンで描く小さなグラフ。データを並べる・集計を見せる画面を作るときに使う。
---

# データを読みやすく見せる

*見た目の基本は `$fdpocket-app-visual`、一覧のページングと状態は `$fdpocket-app-ui`。ここでは**データの並べ方と書式**を決める。*

目的は、**見た人が 3 秒で「今どうなっているか」と「次に何をするか」が分かること**。データを全部見せることではない。

## 1. 一覧か表か

| 状況 | 形 |
|---|---|
| スマホ幅（利用者向けの主な画面） | **行の一覧**（`$fdpocket-app-visual` §5）。1 行に見せる情報は 3 つまで（タイトル・補足・状態か日付） |
| PC 幅の管理画面で、列を見比べる・並べ替える | **表**（`<table>`）。スマホ幅では行の一覧に切り替える（`md:` で表を出す）。一覧と詳細を横に並べるかは `$fdpocket-app-responsive` §6。表を横スクロールさせるのは最後の手段 |
| 1 件の中身 | 定義リスト（`<dl>`。見出しと値の 2 列、スマホは縦に積む） |

表の約束:

- 見出しは `<th scope="col">`、行の主な列は `<th scope="row">`。見出しは本文に付いてくるよう `sticky top-0 bg-background`。
- **数値の列は右揃え + `tabular-nums`**、文字の列は左揃え。単位は見出しに書き（「金額（円）」）、セルに繰り返さない。
- 行の高さは 48px 以上。区切りは横線だけ（`divide-y`）。縦線と縞模様は使わない。
- 並べ替えられる列は見出しをボタンにし、今の並びを矢印と `aria-sort` で示す。並び・絞り込み・ページは URL に置く（`$fdpocket-app-ux-patterns` §1）。
- 行の操作は右端の「…」メニュー（`packages/ui` の `DropdownMenu`。右クリックのメニューを作るなら同じ操作をここにも置く。`$fdpocket-app-responsive` §4）にまとめる。行ごとにボタンを 3 つ並べない。
- 複数選択して一括操作するときは、選んだ件数と操作を表の上に出す（「3 件を選択中・完了にする・選択を外す」）。

## 2. 書式（`Intl` を使う。自前で組み立てない）

| 値 | 書き方 |
|---|---|
| 金額 | `new Intl.NumberFormat(locale, { style: 'currency', currency: 'JPY' })`。通貨はデータに持つ |
| 件数・数量 | `Intl.NumberFormat`（桁区切り）。大きい数の要約は `notation: 'compact'`（「1.2万」「12K」） |
| 割合 | `style: 'percent'`、小数は 1 桁まで。分母が小さい（10 未満）ときは割合でなく件数で |
| 日付 | 今年なら年を省く。`Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' })` |
| 最近の時刻 | 24 時間以内は相対（`Intl.RelativeTimeFormat`。「3 時間前」）、それより前は日付。`<time dateTime={iso}>` で包み、`title` に正確な日時 |
| 期限 | 「あと 2 日」「今日まで」「3 日超過」のように残りで。超過は `text-destructive` + アイコン |
| 空の値 | 「—」（`text-muted-foreground`）。`null` / `undefined` / `0` を取り違えない（0 は 0 と出す） |

- DB は UTC。表示で利用者のタイムゾーンへ直す（`$fdpocket-app-ui` §1）。
- 書式の関数は `packages/` の 1 か所にまとめ、web と admin で同じものを使う。

## 3. 状態を見せる

- 状態は `Badge`（`$fdpocket-app-visual` §3 の意味の色）+ **文言**。色だけ・アイコンだけにしない。
- 状態の種類は 5 つまで。多いなら業務の言葉でまとめる（「下書き・確認待ち・完了」）。
- 進み具合は「3 / 5」と細いバー（`div` の幅。`role="progressbar"` と `aria-valuenow`）。円グラフにしない。

## 4. ダッシュボード（要約の画面）

1. **いちばん大事な数字を 1〜4 個**（`$fdpocket-app-visual` §5 の「数字の要約」）。各数字に、比べる相手（前週・目標）と差を付ける。比べる相手の無い数字は置かない。
2. その下に、**次にすること**の一覧（「期限が今日のタスク 3 件」）。数字より行動を先に見せてよい。
3. グラフは 1〜2 個まで。グラフで分かることを見出しに書く（「今週は月曜に集中」）。
- 集計は Gateway で全件を読んで画面で数えない。件数は `count`、合計は `aggregate` / `groupBy`（SDK の db の操作）で取る。
- 期間の切り替え（今日・7 日・30 日）はチップで、選んだ期間を URL に置く。

## 5. グラフ（依存を足さない）

グラフのライブラリは allowlist に無い。**小さな SVG を自分で書く**（数十行で済む）。

| 伝えたいこと | 形 |
|---|---|
| 時間による変化 | 折れ線（点が 30 以上）か縦棒（12 以下） |
| 項目の比較 | **横棒**（ラベルが長くても読める）。値の大きい順に並べる |
| 全体の内訳 | 積み上げの横棒 1 本。項目が 5 個を超えたら上位 4 + 「その他」。円グラフ・ドーナツは使わない |
| 1 つの値の推移を小さく | 線だけのスパークライン（数字の横に） |

- 色は `--chart-1`〜`--chart-5`（`globals.css`）。1 系列なら `--primary` 1 色だけ。系列は 5 個まで。
- 軸の線・目盛りは薄く（`stroke-border`）、目盛りの数字は 3〜5 個。値のラベルを直接付けられるなら凡例は要らない。
- 0 から始める（棒グラフは必ず）。単位を軸か見出しに書く。
- `viewBox` で描いて幅 100% に伸ばし、高さは固定（スマホで 160〜200px）。
- 読み上げ用に `<svg role="img" aria-label="…">` で要約（「7 日間の件数。最大は月曜の 12 件」）を付け、必要なら数値の表も下に畳んで置く。
- データが 0 件・1 件のときの表示を作る（空の軸を描かない。`EmptyState` か「データが足りません」）。

```tsx
// 横棒（項目の比較）。値の大きい順に渡す
function BarList({ rows, label }: { rows: { name: string; value: number }[]; label: string }) {
  const max = Math.max(1, ...rows.map((row) => row.value))
  return (
    <ul aria-label={label} className="flex flex-col gap-2">
      {rows.map((row) => (
        <li key={row.name} className="grid grid-cols-[minmax(0,8rem)_1fr_auto] items-center gap-3 text-sm">
          <span className="truncate">{row.name}</span>
          <span className="h-2 rounded-full bg-muted">
            <span className="block h-full rounded-full bg-primary" style={{ width: `${(row.value / max) * 100}%` }} />
          </span>
          <span className="tabular-nums text-muted-foreground">{row.value.toLocaleString()}</span>
        </li>
      ))}
    </ul>
  )
}
```

## 6. やらないこと

- 意味の無い数字（合計の総数だけ・比べる相手の無い割合）を大きく並べる。
- 3D・影・グラデーションのグラフ、円グラフ、目盛りの多い軸。
- 表をスマホ幅でそのまま横スクロールさせる。数値を左揃えにする。
- 日時を `toString()` / UTC のまま出す。`0` を空と同じに見せる。
