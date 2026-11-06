---
name: fdpocket-app-visual
description: ミニアプリの画面を「用途に合った、整った見た目」にする手順。方向を 3 行で決め（ui-ux-pro-max で業種に合う色・書体・UX 指針を検索）、ひな形のトークン（--brand-hue）と部品（AppShell・PageHeader・EmptyState・Badge・Skeleton・Sheet など）で組み、kit shot で自分の画面を撮ってはみ出し・小さい操作を直す。画面を作る・直すときに必ず使う。クラウドの生成でも手元でも同じ。
---

# 見た目を作る

目的は、**どのアプリも同じ素っ気ない灰色の画面にならず、用途に合った整った画面にすること**。
個別の知識は `$fdpocket-ui-ux-pro-max`（色・書体・スタイル・UX 指針の検索）に任せ、ここでは**このプラットフォームでの手順と約束**を決める。
`$fdpocket-app-ui`（技術的な約束）と一緒に使う。

## 1. 方向を 3 行で決める（作る前に）

依頼と `design/context.md` から次の 3 つを決め、`design/context.md` の `## 見た目` に書く（次のターンも同じ見た目で続けるため）。

```markdown
## 見た目
- 用途と雰囲気: 店舗スタッフが素早く入力する業務ツール。落ち着いて、迷わない
- 色: 青（--brand-hue: 235）。成功・注意は意味のある場面だけ
- 密度: ふつう（スマホ幅が主。管理画面は広めの表）
```

- すでに `## 見た目` があるアプリは**それに従う**。変えるのは依頼されたときだけ（画面ごとに見た目がぶれるのを防ぐ）。
- 利用者が見た目を指定していれば、その指定が先（ただしスマホ幅で使えること・44px・コントラストは守る）。

## 2. 検索して決める（`$fdpocket-ui-ux-pro-max`）

新しいアプリ、または見た目を大きく変えるときに 1 回。クエリは「業種 + 雰囲気 + 2〜3 語」。

```bash
python3 <kit>/skills/fdpocket-ui-ux-pro-max/scripts/search.py "healthcare clinic booking calm" --design-system --density 5
python3 <kit>/skills/fdpocket-ui-ux-pro-max/scripts/search.py "form inline validation error" --domain ux
python3 <kit>/skills/fdpocket-ui-ux-pro-max/scripts/search.py "list row badge" --stack shadcn
```

- 出てくるのは**提案**。パターン・スタイル・主色・書体の雰囲気を採り、§3 のトークンに写す。`--persist` は使わない。
- 管理画面・業務ツールは `--density 7〜8`（詰める）、利用者向けは `4〜5`。`--variance` は低め（装飾より分かりやすさ）。
- Python が使えないときは `references/quick-reference.md` を読む。

## 3. 色（`globals.css` の `--brand-hue` の 1 か所）

ひな形のテーマは、背景・文字・枠に同じ色相をごく薄く混ぜた中立色と、主役の色 1 つでできている。**変えるのは色相だけ**。

| 用途 | 色相 | 感じ |
|---|---|---|
| 業務・タスク・汎用（既定） | 258 | 青紫。落ち着いて信頼できる |
| 金融・医療・信頼 | 235 | 青。清潔で堅い |
| 健康・衛生・予約 | 195 | 青緑。やわらかく清潔 |
| 習慣・自然・環境 | 155 | 緑。穏やか（成功の緑と近いので、成功の表示は文言とアイコンも添える） |
| 食・暮らし・温かさ | 50 | 橙。親しみやすい |
| 創作・学び | 300 | 紫。創造的 |
| 流行・ファッション | 345 | 赤紫。華やか |

- **主役の色は 1 色**。成功（緑）・注意（黄）・失敗（赤）は、その意味の場面だけ（`Badge` の `success` / `warning` / `destructive`）。
- 赤系の色相（0〜30）を主役にしない（失敗と紛れる）。
- 生の色（`bg-zinc-900`・`text-white`・`#fff`）を書かない。必ずトークン（`bg-primary` / `text-muted-foreground` / `border-border` …）。ダークモードが壊れる。
- 色だけで意味を伝えない（アイコン・文言を添える）。文字のコントラストは 4.5:1 以上（トークンはそれを満たす）。

## 4. 骨格と部品（ひな形にある。なければ足す）

`@workspace/ui/components/*`: `app-shell`・`page-header`・`empty-state`・`card`・`button`・`input`・`textarea`・`label`・`badge`・`skeleton`・`separator`・`tabs`・`switch`・`avatar`・`dialog`・`sheet`。

- **外枠は `__root.tsx` の `AppShell` で 1 回だけ**（ヘッダー・本文の幅と余白）。利用者向けは `width="narrow"`、管理画面は `width="wide"`。画面ごとに外枠を作り直さない。
- 各画面の先頭は `PageHeader`（タイトル・1 行の説明・右に主な操作）。
- 部品が足りないときは `packages/ui/src/components/` に shadcn の書き方で足し、web と admin で共有する（クラス文字列を画面ごとにコピペしない）。`radix-ui` は入っている。
- ボタンの既定は 44px 高（スマホのタップ標的）。`size="sm"` / `"xs"` は管理画面の表の中など、デスクトップで詰めたい所だけ。
- アイコンは `lucide-react`（16 か 20px、線の太さをそろえる）。絵文字をアイコン代わりにしない。

## 5. 画面の型

| 画面 | 型 |
|---|---|
| 一覧 | `Card` の中に `divide-y` で行を並べる（行ごとにカードを作らない）。行 = 左に頭文字かアイコン、真ん中にタイトルと補足、右に `Badge` か日付。行の高さは 56px 以上で、行全体を押せる |
| 詳細 | `PageHeader`（戻る・タイトル・操作）→ 情報を `Card` のまとまり（見出し + 項目の定義リスト）に分ける |
| フォーム | `Label` は欄の上、欄は縦に `gap-4`。主ボタンは 1 つ（`w-full` でスマホ幅いっぱい）で、フォームの直下。エラーは欄の下に具体的に。送信中はボタンを無効にして文言を変える |
| 空 | `EmptyState`（アイコン + 何も無いこと + **次にすること**のボタン）。文字だけを置かない |
| 読み込み中 | `Skeleton` を**実際の行と同じ高さ・数**で。読み込み後に動かさない |
| エラー | 原因と次にすること（再試行のボタン）。`SdkError` の `code` に対応した文言（`$fdpocket-app-ui` §3） |
| 数字の要約 | 2 列の `Card`（小さな見出し + 大きな数字 `tabular` + 前回との差）。3 つ以上並べるなら横スクロールにせず 2 列で折り返す |
| 確認（削除など） | `Dialog`（短い確認）。入力が多い・選択肢が多い操作は下から出る `Sheet`（スマホ幅の既定） |

```tsx
// 一覧の行（Card の中に divide-y で並べる）
<Card>
  <ul className="divide-y">
    {items.map((item) => (
      <li key={item.id}>
        <Link className="flex min-h-14 items-center gap-3 px-4 py-3 outline-none focus-visible:bg-muted" to="/items/$id" params={{ id: item.id }}>
          <Avatar><AvatarFallback>{item.name.slice(0, 1)}</AvatarFallback></Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{item.name}</p>
            <p className="truncate text-sm text-muted-foreground">{item.note}</p>
          </div>
          <Badge variant={item.done ? 'success' : 'secondary'}>{item.done ? t.done : t.open}</Badge>
        </Link>
      </li>
    ))}
  </ul>
</Card>
```

## 6. 文字・余白・動き

- 文字は 5 段階だけ: 画面の見出し `text-2xl font-semibold`、節の見出し `text-lg font-semibold`、本文 `text-base`、補足 `text-sm text-muted-foreground`、注記 `text-xs`（12px が下限）。全部を太字・中央揃えにしない。
- 余白は 4px の倍数: 要素の間 `gap-2`〜`gap-4`、まとまりの間 `gap-6`、画面の左右 `px-4`。**区切りは線より余白**。カードの入れ子（カードの中のカード）は作らない。
- 金額・件数・時刻は `tabular`（桁をそろえる）。長い文字は `truncate` か折り返し（`min-w-0` を忘れない）。
- 動きは意味がある所だけ（開閉・切り替え・押した反応）。150〜250ms。`motion-reduce` を尊重する（部品は対応済み）。装飾のための動き・グラデーションの塊・影の重ねがけをしない。
- 画面の文言は具体的な動詞（「追加する」「保存する」）。「OK」「送信」だけにしない。専門用語を出さない。

## 7. 自分の画面を撮って確かめる（`kit shot`。必須）

作ったら、**撮って、見て、直す**。見ずに「できた」と言わない（クラウドでも手元でも同じ）。

```bash
node <kit>/scripts/kit.mjs dev            # 別のプロセスで起動しておく（既に動いていれば不要）
node <kit>/scripts/kit.mjs shot --out /tmp/fdpocket/shots --path /          # 主な画面ごとに（--path /tasks など）
node <kit>/scripts/kit.mjs shot --out /tmp/fdpocket/shots --as admin --app admin --path /   # 管理画面
```

- 既定は 390px（スマホ）と 1280px（PC）の 2 枚。画像（`/tmp/fdpocket/shots/<app>-<幅>.png`）を**開いて見る**。
- JSON の `checks` も読む: `horizontalOverflow: true`（横にはみ出している）・`smallTargets`（44px 未満の操作）・`smallTextCount`（12px 未満の文字）・`consoleErrors`（コンソールエラー。画像の参照切れも）。**どれも 0 / false になるまで直す。**
- 空・読み込み中・エラーの状態も撮って見る（`seed.ts` を空にする・存在しない `--path` を開くなど）。
- 見た画像で次を確かめる: 主役が 1 つに見えるか／余白がそろっているか／文字が読めるか／押せそうな所が押せそうに見えるか／色が 1 色に絞られているか。
- 画像を見られない環境（画像入力が無い）では、`checks` の数値と、文字・色のトークンの使い方を根拠にし、**見られていないことを結果に書く**。

## 8. やらないこと

- 無彩色のまま（ひな形の `--brand-hue` を用途に合わせないまま）にする。
- 画面の中央に 1 枚の `Card` だけを置く。外枠を自作する。カードを入れ子にする。
- 生の色・外部 CDN のフォント・絵文字のアイコン・ランディングページ風の hero を使う。
- 色だけで状態を伝える。操作が 44px 未満のまま出す。入力欄の文字を 16px 未満にする。
- ひな形の部品と違う見た目のボタン・入力欄を画面ごとに手書きする。
- `kit shot` を撮らず、撮っても見ずに終える。
