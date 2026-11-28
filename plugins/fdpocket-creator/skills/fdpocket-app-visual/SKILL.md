---
name: fdpocket-app-visual
description: ミニアプリの画面を「用途に合った、整った見た目」にする手順。方向を 3 行で決め（ui-ux-pro-max で業種に合う色・書体・UX 指針を検索）、ひな形のトークン（--brand-hue）と部品（AppShell・PageHeader・EmptyState・Badge・Skeleton・Sheet など）で組み、kit shot で自分の画面を撮ってはみ出し・小さい操作を直す。画面を作る・直すときに必ず使う。クラウドの生成でも手元でも同じ。
---

# 見た目を作る

目的は、**どのアプリも同じ素っ気ない灰色の画面にならず、用途に合った整った画面にすること**。
個別の知識は `$fdpocket-ui-ux-pro-max`（色・書体・スタイル・UX 指針の検索）に任せ、ここでは**このプラットフォームでの手順と約束**を決める。
`$fdpocket-app-ui`（技術的な約束）と一緒に使う。
操作の流れは `$fdpocket-app-ux-patterns`、文言は `$fdpocket-app-ux-writing`、表・数字・グラフは `$fdpocket-app-data-display`、誰でも使えるかは `$fdpocket-app-accessibility`、仕上げの採点は `$fdpocket-app-design-review`。

## 1. 方向を 3 行で決める（作る前に）

依頼と `design/context.md` から次の 3 つを決め、`design/context.md` の `## 見た目` に書く（次のターンも同じ見た目で続けるため）。

```markdown
## 見た目
- 用途と雰囲気: 店舗スタッフが素早く入力する業務ツール。落ち着いて、迷わない
- 色: 青（--brand-hue: 235）。成功・注意は意味のある場面だけ
- 密度: ふつう（スマホ幅が主。管理画面は広めの表）
```

- 方向は**その業務から**決める。扱う物・使う人・使う場面（現場で片手・事務所の PC・外出先）・業界で見慣れた言葉と色が手がかりになる。保育園の連絡帳と経理の承認ツールが同じ見た目になるなら、決めていない。
- **作る前に見直す**: 書いた 3 行が「似た別の依頼でも同じになる」なら、その行は選んでいない。この業務に合わせて直し、何をなぜ変えたかを結果に 1 行書く。ひな形の既定の色相（258）を、理由なくそのまま使わない。
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

**明暗（ダークモード）**: 明と暗の両方で使えるようにする。切り替えはひな形が済ませている。

- `html` の `.dark` クラスで切り替わる（`globals.css` の `.dark {}` のトークンと `dark:`）。付け外しは `AppShell` の `colorScheme={useColorScheme()}`（ひな形の `__root.tsx`）。スーパーアプリの中ならその外観の設定、ブラウザ・ホーム画面なら端末の設定に従う。
- **自分で `.dark` を付け外ししない・明暗の切り替えボタンを作らない**（スーパーアプリの設定とずれる）。`prefers-color-scheme` を CSS や JS で直接見ない（スーパーアプリの中で設定と食い違う）。
- 色はトークンだけで書けば、暗い画面は何もしなくても正しくなる。`dark:` を書くのは、トークンで表せない所（画像の上の文字・グラフの線の濃さ）だけ。
- 画像・ロゴは暗い背景でも見えるか確かめる（透過 PNG の黒い線が消える）。必要なら背景付きの枠に入れる。
- 影は暗い画面ではほぼ見えない。まとまりは影ではなく枠（`border`）と背景（`bg-card`）の差で見せる。

## 4. 骨格と部品（ひな形にある。なければ足す）

`@workspace/ui/components/*`: `app-shell`・`page-header`・`empty-state`・`card`・`button`・`input`・`textarea`・`label`・`badge`・`skeleton`・`separator`・`tabs`・`switch`・`avatar`・`dialog`・`sheet`（`md` 以上で中央のダイアログになる）・`app-nav`（主な行き先。幅でタブバー → レール → サイドバー。6 個以上は「その他」・節の見出し・上下の枠も持つ。`$fdpocket-app-responsive` §2）・`dropdown-menu`（「…」の操作）・`tooltip`（アイコンのボタンの名前と近道）。

- 幅ごとの形（ナビ・一覧と詳細・密度・指とマウス）は `$fdpocket-app-responsive`。
- **外枠は `__root.tsx` の `AppShell` で 1 回だけ**（本文の幅と余白・セーフエリア・ナビ）。利用者向けは `width="narrow"`、管理画面は `width="wide"`。画面ごとに外枠を作り直さない。
- **アプリ名のヘッダー（上に固定した帯）を作らない。** スーパーアプリの中では FDPocket がアプリの名前・閉じる・メニューを上に出している。自分で帯を足すと名前が 2 回並び、本文が狭くなる（`kit shot` が「header bar is pinned above the content」と出す）。上に固定してよいのは、その画面だけの道具（検索欄・絞り込みのタブ）だけ。
  - 「ヘッダーが要る」と頼まれたら、**頼まれた中身を分けて作る**: 画面の名前・戻る・操作 → `PageHeader`、PC 幅の検索・通知・アカウント → `AppShell` の `topBar`（`md` 以上だけ）、ロゴとアプリ名 → 単独で開く管理画面だけ `AppNavHeader`。アプリ名の帯だけを作らず、頼まれたことを断って終わらせない（作らない理由は結果に 1 行書く）。
- **フッターは作ってよい**（規約・版・問い合わせなど画面の最後に置くもの）。`AppShell` の `footer`（本文の最後に出る。画面の下に固定しない）。
- 各画面の先頭は `PageHeader`: `title` は**その画面に何があるか**（「今日のタスク」「連絡先」。アプリ名ではない）、`description` は 1 行、`actions` に主な操作（編集・追加）、詳細・編集の画面は `back` に左上の戻る（`<Link>` を入れる。48px の丸いアイコンになる）。**本文の途中に「← 戻る」の行やボタンを置かない**。
- 下のタブ（`AppNav`）は選択中がブランド色と太字になる。ラベルを消さない。
- 部品が足りないときは `packages/ui/src/components/` に shadcn の書き方で足し、web と admin で共有する（クラス文字列を画面ごとにコピペしない）。`radix-ui` は入っている。
- ボタンの既定は 44px 高（スマホのタップ標的）。`size="sm"` / `"xs"` は管理画面の表の中など、デスクトップで詰めたい所だけ。
- アイコンは `lucide-react`（16 か 20px、線の太さをそろえる）。絵文字をアイコン代わりにしない。

## 5. 画面の型

スマホ幅の型は、iPhone と Android の人がふだん使っている形に合わせる（`$fdpocket-ios-design-guidelines`・`$fdpocket-android-design-guidelines`。両方に共通することを既定にする）。迷ったら、その節を開いて「なぜそうするか」を読む。

| 画面 | 型 |
|---|---|
| 一覧 | `Card` の中に `divide-y` で行を並べる（行ごとにカードを作らない）。行 = 左に頭文字かアイコン、真ん中にタイトルと補足、右に `Badge` か日付。行の高さは 56px 以上で、行全体を押せる |
| 詳細 | 下の「詳細の画面」の型。`PageHeader`（左上の戻る・名前・右に編集）→ 本人が分かるまとまり → 種類ごとの `Card` |
| フォーム | `Label` は欄の上、欄は縦に `gap-4`。主ボタンは 1 つ（`w-full` でスマホ幅いっぱい）で、フォームの直下。エラーは欄の下に具体的に。送信中はボタンを無効にして文言を変える |
| 空 | `EmptyState`（アイコン + 何も無いこと + **次にすること**のボタン）。文字だけを置かない |
| 読み込み中 | `Skeleton` を**実際の行と同じ高さ・数**で。読み込み後に動かさない |
| エラー | 原因と次にすること（再試行のボタン）。`SdkError` の `code` に対応した文言（`$fdpocket-app-ui` §3） |
| 数字の要約 | 2 列の `Card`（小さな見出し + 大きな数字 `tabular` + 前回との差）。3 つ以上並べるなら横スクロールにせず 2 列で折り返す |
| 確認（削除など） | `Dialog`（短い確認）。入力が多い・選択肢が多い操作は `Sheet`（スマホ幅は下から、`md` 以上は中央。`$fdpocket-app-responsive` §5） |

### 詳細の画面（連絡先・案件・注文など 1 件を見る画面）

AI がいちばん崩しやすい画面。**全部を 1 枚のカードに詰めない**。上から次の順に組む。

1. `PageHeader`: `back` に一覧への戻る、`title` にその 1 件の名前、`actions` に「編集」（アイコン + 文字か、`aria-label` 付きのアイコン）。
2. **本人が分かるまとまり**（カードにしない）: 大きめのアバターか頭文字、名前（`text-xl font-semibold`）、所属・肩書きなど 1 行、状態は `Badge`（「対応中」）。**状態を `select` で出さない**（変えるのは編集の画面か、押すと `Sheet` で選べる行）。名前の下に、他の欄の値を「・」でつないだ 1 行を作らない（同じ値が下に出て二重になる）。
3. **よく使う操作を 2〜4 個の丸いボタンで横に並べる**（電話・メール・地図など。アイコン + 短いラベル。値があるものだけ）。連絡先の値をそのまま青いリンクにして並べない。
4. **種類ごとの `Card`**（「連絡先」「会社」「メモ」）。中は区切り線の行で、行 = 上に小さなラベル（`text-xs text-muted-foreground`）・下に値、押せる行は右に `ChevronRight`。値が複数あるもの（電話 3 つなど）は行を分け、5 つ以上は「すべて表示」で畳む。空の欄の行は出さない。
5. 関連する一覧（やりとりの履歴など）は最後に 3 件だけ見せ、「すべて見る」で別の画面へ。
6. 削除などの危ない操作は画面の最後か「…」メニューに。詳細の画面の主役にしない。

```tsx
<PageHeader
  back={<Link to="/contacts" aria-label="連絡先に戻る"><ChevronLeft /></Link>}
  title={contact.name}
  actions={<Button asChild variant="ghost"><Link to="/contacts/$id/edit" params={{ id }}>編集</Link></Button>}
/>
<section className="flex flex-col items-center gap-2 py-4 text-center">
  <Avatar className="size-20">…</Avatar>
  <p className="text-sm text-muted-foreground">{contact.company}・{contact.title}</p>
  <Badge variant="secondary">{statusLabel[contact.status]}</Badge>
</section>
<div className="grid grid-cols-3 gap-2">{/* 電話・メール・地図。値があるものだけ */}</div>
<Card>
  <dl className="divide-y">
    <div className="px-4 py-3"><dt className="text-xs text-muted-foreground">携帯</dt><dd>{phone}</dd></div>
  </dl>
</Card>
```

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

- 文字は 5 段階だけ: 画面の見出し `text-3xl font-semibold`（`PageHeader` の `title`。30px。iOS の大きなタイトル 34pt・Material の Headline に近い大きさで、どの画面にいるかが一目で分かる）、節の見出し `text-lg font-semibold`、本文 `text-base`、補足 `text-sm text-muted-foreground`、注記 `text-xs`（12px が下限）。全部を太字・中央揃えにしない。
- 余白は 4px の倍数: 要素の間 `gap-2`〜`gap-4`、まとまりの間 `gap-6`、画面の左右 `px-4`。**区切りは線より余白**。カードの入れ子（カードの中のカード）は作らない。
- 金額・件数・時刻は `tabular`（桁をそろえる）。長い文字は `truncate` か折り返し（`min-w-0` を忘れない）。
- 動きは利用者の操作に答える所に使う（開閉・切り替え・押した反応・増えた・消えた）。150〜250ms。`motion-reduce` を尊重する（部品は対応済み）。装飾のための動き・グラデーションの塊・影の重ねがけをしない。
- 画面の文言は具体的な動詞（「追加する」「保存する」）。「OK」「送信」だけにしない。専門用語を出さない。

### 使って気持ちいい画面にする

業務アプリでも、使っていてワクワクする画面にする。ワクワクは飾りではなく、**触った手応え**と**仕事が片付いた実感**から作る。

- **押した瞬間に反応する**: 完了のチェック・並べ替え・保存は、サーバーの返事を待たずに画面へ反映する（TanStack Query の楽観的更新。`onMutate` で書き換え、失敗したら `onError` で元に戻して知らせる）。待たされないことがいちばんの気持ちよさ。
- **節目をちゃんと祝う**: 今日の分が全部終わった・申請が通った・目標に届いた、など業務の**節目**だけで、チェックが弾む・数字が数え上がる・一言の声かけ（「今日の分は全部終わりました」）を出す。1 件ごとの保存のたびには出さない。紙吹雪のような大きな演出は、年に数回の大きな節目だけ。
- **前に進んでいることが見える**: 残りの件数・進み具合のゲージ・昨日より何件進んだか、を業務の数字で見せる（ホームの主役の候補）。
- **動きでつなぐ**: 増えた項目は差し込まれ、消えた項目の後ろは詰まり、開いた詳細は押した場所から広がる。状態の変化を目で追えるようにする（`motion-reduce` のときは動かさず切り替える）。
- **空の画面と言葉に人柄を出す**: 最初の 1 件を促す小さな絵と一言。語り口は業務に合わせる（保育園なら柔らかく、経理なら簡潔に。`$fdpocket-app-ux-writing`）。
- **主役の 1 か所は思い切る**: その業務でいちばん大事な画面の 1 か所（今日の件数・次にやること）には、ブランド色の面・大きな数字・絵を使ってよい。控えめにするのは、それ以外の場所。

## 7. 自分の画面を撮って確かめる（`kit shot`。必須）

作ったら、**撮って、見て、直す**。見ずに「できた」と言わない（クラウドでも手元でも同じ）。

```bash
node <kit>/scripts/kit.mjs dev            # 別のプロセスで起動しておく（既に動いていれば不要）
node <kit>/scripts/kit.mjs shot --out /tmp/fdpocket/shots --path /          # 主な画面ごとに（--path /tasks など）
node <kit>/scripts/kit.mjs shot --out /tmp/fdpocket/shots --as admin --app admin --path /   # 管理画面
```

- 既定は 390px（スマホ）・768px（タブレット）・1280px（PC）の 3 枚（1024px 以下は指の端末として撮る）。幅ごとに形が変わっているかは `$fdpocket-app-responsive` §9 で確かめる。**暗い画面も 1 回は撮る**（`--theme dark`。画像は `<app>-<幅>-dark.png`）。画面の端に固定したバー・シートがあるなら、ノッチとホームバーを重ねた 1 枚も撮る（`--safe-area iphone`。`$fdpocket-app-pwa` §2）。画像（`/tmp/fdpocket/shots/<app>-<幅>.png`）を**開いて見る**。
- JSON の `checks` も読む: `horizontalOverflow: true`（横にはみ出している）・`smallTargets`（44px 未満の操作）・`smallTextCount`（12px 未満の文字）・`lowContrastText`（背景との差が足りない文字。本文 4.5:1・大きな文字 3:1 未満。`muted-foreground` より薄い色を使っていないか）・`coveredByBottomBar`（いちばん下までスクロールしても下に固定したナビ・ボタンに隠れる本文。最後の行やボタンが押せない）・`consoleErrors`（コンソールエラー。画像の参照切れも）。**どれも 0 / false / 空になるまで直す。** `appBarAboveContent: true`（上に固定した帯がある）は、アプリ名の帯なら消す（§4）。その画面の道具（検索欄など）なら残してよい。 `bottomNavMissing`（スマホ幅で主な行き先が下に無い）と `mainNavAbsent`（ナビが無いのに本文に別の画面へのリンクが 2 つ以上ある）は知らせるだけ。直すか、意図した配置なら理由を結果に書く（`$fdpocket-app-responsive` §2）。
- 空・読み込み中・エラーの状態も撮って見る（`seed.ts` を空にする・存在しない `--path` を開くなど）。
- 見た画像で次を確かめる: 主役が 1 つに見えるか／余白がそろっているか／文字が読めるか／押せそうな所が押せそうに見えるか／色が 1 色に絞られているか。
- 撮った画像を**自分で批評する**: 社名とデータを消しても、このアプリだと分かるか（分からなければ §8 の既定の見た目に寄っている）。目立たせるのは画面の**どこか 1 か所**（今日の件数・次にやること・主な操作）。そこは思い切って目立たせ、まわりは静かにする（§6「使って気持ちいい画面にする」）。出かける前に鏡を見て 1 つ外すように、飾り（意味の無い区切り線・バッジ・アイコン・影）を**1 つ外す**。外して困らなければ戻さない。
- 画像を見られない環境（画像入力が無い）では、`checks` の数値と、文字・色のトークンの使い方を根拠にし、**見られていないことを結果に書く**。

## 8. やらないこと

- 無彩色のまま（ひな形の `--brand-hue` を用途に合わせないまま）にする。
- 画面の中央に 1 枚の `Card` だけを置く。外枠を自作する。カードを入れ子にする。
- 生の色・外部 CDN のフォント・絵文字のアイコン・ランディングページ風の hero を使う。
- 明暗の切り替えを自作する・暗い画面を撮らずに終える。
- 色だけで状態を伝える。操作が 44px 未満のまま出す。入力欄の文字を 16px 未満にする。
- ひな形の部品と違う見た目のボタン・入力欄を画面ごとに手書きする。
- `kit shot` を撮らず、撮っても見ずに終える。

**AI が作った既定の見た目**（どの依頼でも出てくる、選んでいない見た目）にしない。利用者が指定したときは指定が先。

- 何でも画面の中央にそろえる（業務の画面は左そろえが基本。中央は空状態・完了画面くらい）。
- 紫・青のグラデーションの背景や見出し。飾りのグラデーション全般。
- 全部を同じ大きさの角丸カードに切り分け、同じ薄い影を付ける。角丸は役割で変える（入力・ボタン・カード・シートで同じ値にしない）。
- 見出しの上に毎回小さな英字の大文字ラベルを置く。`A · B · C` のような中黒つなぎの補足。ボタン・リンクの文字の末尾に「→」。
- 中身が順番でないのに 01 / 02 / 03 の番号を振る。見出しの 1 語だけ色や太さを変える。
- 開くたびに全部の区画がふわっと出る・全部のカードがホバーで浮く（動きは利用者の操作に答えるときだけ。§6）。
- 数字を大きく、ラベルを小さく、横に統計を並べた KPI の並びを、主役でもないのに置く。
