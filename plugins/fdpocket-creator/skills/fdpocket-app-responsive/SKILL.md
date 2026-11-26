---
name: fdpocket-app-responsive
description: ミニアプリをスマホ・タブレット・PC のどれで開いても、その端末に合った使い心地にする。幅のクラス（compact / medium / expanded）と Tailwind の md・lg、幅ごとのナビ（下のタブ → 左のレール → サイドバー）、シートとダイアログの切り替え、一覧と詳細の並べ方、指とマウスの違い（hover・pointer）、キーボードの近道・右クリックのメニュー・ツールチップ、密度、320px での折り返し、`kit shot` の 3 つの幅での確認。画面を作る・直すとき必ず使う。
---

# どの端末でも、その端末らしく使える画面にする

*技術の約束は `$fdpocket-app-ui`、見た目は `$fdpocket-app-visual`、操作の流れは `$fdpocket-app-ux-patterns`、誰でも使えるかは `$fdpocket-app-accessibility`。この Skill は**幅と入力の違いで何を変えるか**を決める。*

ミニアプリはスマホのスーパーアプリの中、PC やタブレットのブラウザ、ホーム画面（PWA）のどれでも開かれる。
**スマホの画面を引き伸ばしただけの PC 画面、PC の画面を縮めただけのスマホ画面はどちらも不合格**。
同じデータと操作を、端末ごとに一番使いやすい形で出す。

## 1. 幅で決める（端末の種類で決めない）

判断は**今の画面の幅**でする。「iPad だから」「Android だから」で分けない（窓を分割した iPad はスマホ幅になるし、PC の窓も細くできる）。
Apple も「サイズクラスで決め、端末の種類や向きでは決めない」、Android も「ほとんどのアプリは幅のクラスだけで足りる」としている。

| 幅のクラス（Material） | 目安 | Tailwind | 代表 | 形 |
|---|---|---|---|---|
| **compact** | 600dp 未満 | 既定（接頭辞なし） | スマホ縦 | 1 列。下のタブ。シートは下から。主な操作は親指の届く下側 |
| **medium** | 600〜840dp | `md:`（768px〜） | タブレット縦・スマホ横・細い PC の窓 | 左のレール。ダイアログは中央。一覧と詳細は 1 画面ずつ |
| **expanded** | 840dp 以上 | `lg:`（1024px〜） | タブレット横・PC | 左のサイドバー。一覧と詳細を横に並べる。表を出す |
| large / extra-large | 1200 / 1600dp 以上 | `xl:` `2xl:` | 大きな PC | 本文を伸ばしすぎない（1 行は 80 字まで。余りは余白か第 3 の列） |

- **作る順はスマホ幅から**（既定のクラスを compact に書き、`md:` `lg:` で足す）。ただし「足すだけ」で終わらせず、広い画面で**形を変える**（§2〜§5）。
- 高さが低い（スマホの横向き・480dp 未満）ときは、上下に固定するバーを増やさない。キーボードが出るとさらに半分になる（`$fdpocket-app-ui` §4）。
- `useMediaQuery` で JS の分岐を作らない。**CSS（Tailwind の接頭辞）で切り替える**（最初の描画でずれない・SSR が無くても速い）。JS で分けるのは「出す部品そのものが違い、両方を DOM に置くと重い」ときだけ。

## 2. ナビ（主な行き先が 2〜5 個のとき）

ひな形の `apps/web/src/routes/__root.tsx` は `NAV_ITEMS` の配列から `AppNav` を作り、`AppShell` の `nav` に渡す。項目が 2 つ以上あるとナビが出る。画面を足したら、この配列に 1 行足す。1 つの `<nav>` が幅で形を変える。

- 見た目は固定ではない。`AppNav` / `AppNavItem` の `className` や `packages/ui/src/components/app-nav.tsx` を、アプリに合わせて変えてよい（色・形・アイコンだけ・中央の作成ボタンなど）。
- 行き先が 1 つのアプリにはナビを置かない。上のタブなど別の形の方が合うアプリは `AppNav` を外してよい。そのときも、スマホ幅で主な行き先を親指の届く下に置くかどうかは考えて決める。

| 幅 | 形 | 根拠 |
|---|---|---|
| compact | 画面の下に固定したタブバー（アイコン + 短いラベル。ホームバーの余白込み） | Material: 幅か高さが compact ならナビゲーションバー。Apple: iPhone はタブバー |
| medium | 左のレール（アイコンの下にラベル、幅 80px） | Material: それ以外はナビゲーションレール |
| expanded 以上 | 左のサイドバー（アイコンとラベルを横に、幅 240px） | Apple: iPad・Mac はサイドバー。Material: 広い幅ではドロワーを常に開いてよい |

```tsx
// apps/<slug>/src/routes/__root.tsx
import { AppNav, AppNavItem } from "@workspace/ui/components/app-nav"
import { HomeIcon, ListIcon, SettingsIcon } from "lucide-react"
import { Link } from "@tanstack/react-router"

const nav = (
  <AppNav aria-label={t.mainNav}>
    <AppNavItem asChild><Link to="/"><HomeIcon aria-hidden />{t.home}</Link></AppNavItem>
    <AppNavItem asChild><Link to="/tasks"><ListIcon aria-hidden />{t.tasks}</Link></AppNavItem>
    <AppNavItem asChild><Link to="/settings"><SettingsIcon aria-hidden />{t.settings}</Link></AppNavItem>
  </AppNav>
)
<AppShell nav={nav} safeArea={safeArea} colorScheme={colorScheme}><Outlet /></AppShell>
```

- 行き先は**どの幅でも同じ並び・同じ名前**（幅で項目を増減しない）。今いる場所は `aria-current="page"`（TanStack Router の `Link` が付ける）。
- ラベルを消してアイコンだけにしない（レールでもラベルを出す）。6 個以上は 5 個に絞る（`$fdpocket-app-ux-patterns` §1）。
- 管理画面（admin）も同じ部品でよい。PC 幅が主なので、サイドバーに節の見出しを足してもよい。
- **キーボードが出ても、下に固定した入力欄・主ボタンが見えること**（スマホではキーボードが画面の約半分を覆う）。ひな形の `index.html` は viewport に `interactive-widget=resizes-content` を付けてあり、キーボードの分だけ画面が縮むので、`fixed bottom-0` の帯と `dvh` はキーボードの上に乗る（iOS Safari の既定は縮まないので、この指定を消さない）。フォームの中では、タブバーと同じ場所に主ボタンを固定せず、フォームの最後に置く。チャットのような下固定の入力欄は、入力中は下のタブを隠す（`focus-within` で `AppNav` を消す）。`env(keyboard-inset-*)` は iOS で常に 0 なので頼らない。
- PC 幅で**大事な操作を画面の下端に置かない**（Apple: macOS では窓の下に重要な操作を置かない）。スマホ幅で下に固定した主ボタンは、PC 幅では `PageHeader` の右か、フォームの直下に戻す。

## 3. 指とマウス（入力の種類は画面の幅から推測しない）

幅が広くてもタッチの PC やタブレットがあり、狭くてもマウスをつないだ端末がある。**入力の違いは `pointer` と `hover` のメディア機能で見る**（web.dev）。

| 書き方 | 効く条件 | 使いどころ |
|---|---|---|
| `hover:`（Tailwind 4） | `@media (hover: hover)` の中だけ | マウスで乗せたときの色。**指の端末では付かない**ので、押した印は `active:` で別に出す |
| `pointer-coarse:` / `pointer-fine:` | 主な入力が指 / マウス | 指のとき余白を広げる。**マウスでも標的を小さくしない**（フィッツの法則。小さいと狙いにくい） |
| `any-pointer-coarse:` | 指でも触れる端末（タッチの PC など） | 「ドラッグで並べ替え」に、ボタンでの並べ替えも出す |

- **hover でしか見えない情報・操作を作らない**。行の上に乗せたときだけ出る「…」、ツールチップにしか書いていない説明は、指では見つけられない。操作は常に見せるか、行を押した先・「…」メニューに置く。
- `:hover` の見た目を付けたら `:focus-visible` も付ける（キーボードでも同じ手がかり）。
- 標的は**どの幅でも 44×44px 以上**（ひな形のアイコンボタン・戻る・閉じるは 48px。Material の 48dp に合わせ、iOS の 44pt も満たす。Apple: Mac でも大きめのタップ標的にしつつ見た目の大きさと密度は保つ）。PC 幅で詰めたいときは見た目の余白を減らし、押せる範囲は padding で保つ。
- 長押し・スワイプ・ドラッグでしかできない操作を作らない（`$fdpocket-app-accessibility` §6）。
- **画面の左右の端から始まる横スワイプを作らない**（iOS の左端からの戻る、Android の予測型「戻る」と同じ動きになり、どちらかが効かなくなる）。カルーセル・行のスワイプは端から 24px 以上内側で始め、同じ操作をボタンにも置く（`$fdpocket-app-ux-patterns` §1）。

## 4. PC でうれしいこと（キーボード・右クリック・ツールチップ）

PC で使う人は、マウスとキーボードで速く仕事をしたい。**スマホで作った画面に次を足す**。

### キーボード

- Tab で全部の操作に届き、順番が見た目どおり（`$fdpocket-app-accessibility` §2）。フォームは Enter で送れる。ダイアログ・シート・メニューは Esc で閉じる（Radix の部品は対応済み）。
- **近道は、いちばん多い操作に 1〜3 個だけ**（例: `N` 新規、`/` 検索に移る、`⌘/Ctrl + Enter` 保存して送る）。
  - ブラウザと OS の決まった近道（`⌘C` `⌘V` `⌘Z` `⌘F` `⌘W` `⌘T` `⌘R` `⌘L` など）を**別の意味に使わない**（Apple: 標準の近道を尊重し、転用しない）。
  - 1 文字の近道は、入力欄にいるときは効かせない（`event.target` が `input` / `textarea` / `[contenteditable]` なら何もしない）。WCAG 2.1.4 も 1 文字の近道に「止める・変える・フォーカス時だけ」のどれかを求める。
  - Mac は `⌘`、それ以外は `Ctrl` で同じ動きにする（`event.metaKey || event.ctrlKey`）。表示も端末に合わせる。
  - 近道はメニューの項目に並べて見せる（`DropdownMenuShortcut`。PC 幅だけ表示される）。近道でしかできない操作を作らない。
- 一覧はキーボードで上下に移れると速い（`↑` `↓` で選択、`Enter` で開く）。作るなら `aria-activedescendant` か、行を `<a>` / `<button>` にして Tab で回す素直な形にする。

```tsx
// 画面に 1 つだけ。入力中は無視する
useEffect(() => {
  const onKey = (event: KeyboardEvent) => {
    const target = event.target as HTMLElement
    if (target.closest("input, textarea, select, [contenteditable='true']")) return
    if (event.key === "n" && !event.metaKey && !event.ctrlKey && !event.altKey) {
      event.preventDefault()
      void navigate({ to: "/tasks/new" })
    }
  }
  window.addEventListener("keydown", onKey)
  return () => window.removeEventListener("keydown", onKey)
}, [navigate])
```

### 右クリックのメニュー（作るなら）

- **同じ操作を必ず画面の上にも置く**（「…」メニューかボタン。Apple: コンテキストメニューの項目は本体の画面でも使えるようにする）。右クリックは近道であって、唯一の入口にしない。
- 項目は少なく、よく使う順。今できない項目は灰色にせず**出さない**。近道の表示は本体のメニュー側に置く。

### ツールチップ

- `packages/ui` の `Tooltip`。アイコンだけのボタンの名前と、近道のキーを出す。**ボタンには必ず `aria-label` も付ける**（ツールチップは指の端末では出ないし、読み上げの名前の代わりにならない）。
- 説明文・入力のルール・エラーをツールチップに入れない（画面に書く）。

## 5. 重ねて出すもの（シート・ダイアログ・メニュー）

| 中身 | compact | medium 以上 |
|---|---|---|
| 入力フォーム・選択肢・詳細 | 下から出るシート（`Sheet`。キーボードと重ならない） | **同じ `Sheet` が中央のダイアログになる**（PC で画面幅いっぱいの横長シートを出さない） |
| 短い確認（削除など） | `Dialog`（ボタンは縦に積む・主ボタンが下） | `Dialog`（ボタンは横に並び、主ボタンが右） |
| 行・画面の操作 3 つ以上 | 「…」の `DropdownMenu` | 同じ |
| 長い入力・ほかの画面を見ながら書きたい | 画面を移る（`/tasks/new`） | 画面を移るか、一覧の横の詳細の列で編集する |

- シートは `md:` で中央のダイアログに変わる（`packages/ui/src/components/sheet.tsx`）。**JS で出し分けない**。
- 重ねた中にさらに重ねない（シートの中でダイアログを開かない）。長くなったら画面にする。

## 6. 一覧と詳細（list-detail）

| 幅 | 形 |
|---|---|
| expanded（`lg:`）以上 | **一覧と詳細を横に並べる**（一覧 `w-80`〜`w-96` 固定 + 詳細が残り）。選んだ行は `aria-current` と背景で示す |
| medium・compact | 1 画面ずつ。行を押すと詳細の画面へ、戻ると一覧の同じ位置へ |

- 選んでいる項目は URL に置く（`/tasks/$id`）。幅が変わっても同じものが見え、共有・戻るも同じに動く。Material も「窓が狭くなったら詳細を出したまま」と決めている。
- 広い画面で何も選んでいないときは、詳細の列に「左から選んでください」と次にすること（`EmptyState`）を出す。空白のままにしない。
- 一覧と詳細を並べる価値が無い画面（詳細を見に来ることが少ない・1 件が長い）は並べない。**本文を中央に置き、最大幅を決める**（`AppShell` の `width`）。広い画面を余白で埋めるのは正しい。

```tsx
// routes/tasks.tsx（一覧と詳細の親）: lg 以上は横に、狭い画面は子のルートだけを出す
const isDetail = useMatch({ from: "/tasks/$id", shouldThrow: false })
<div className="lg:grid lg:grid-cols-[22rem_1fr] lg:gap-6">
  <section className={cn(isDetail && "hidden lg:block")}><TaskList /></section>
  <section className={cn(!isDetail && "hidden lg:block")}>
    {isDetail ? <Outlet /> : <EmptyState title={t.pickOne} />}
  </section>
</div>
```

## 7. 密度と表

- スマホ: 行は 56px 以上、1 行に情報 3 つまで、カードの一覧（`$fdpocket-app-visual` §5）。
- PC の管理画面: 列を見比べるなら**表**（`$fdpocket-app-data-display` §1）。`md:` / `lg:` で表を出し、狭い幅は行の一覧に戻す。行の高さ 48px、文字は `text-sm` まで詰めてよい（入力欄は 16px のまま）。
- Apple の macOS も「心地よい情報密度」を求める。PC だから詰め込むのではなく、**見比べる必要があるものだけ横に並べる**。

## 8. 折り返しと文字

- **幅 320px でも横スクロールを出さない**（WCAG 1.4.10 リフロー。320 CSS px ＝ 1280px の 400% 拡大）。表と地図・図だけは例外にしてよいが、ページ全体を横に動かさない。
- 文字の拡大 200% で切れない・重ならない（固定の高さに文字を入れない。`h-10` ではなく `min-h-10`）。
- 長い名前・数字は `min-w-0` + `truncate` か折り返し。ボタンの文言が 2 行になっても崩れない。
- 本文の 1 行は 40〜80 字（`max-w-prose` 程度）。広い画面で文章を端から端まで伸ばさない。

## 9. 撮って確かめる（`kit shot`。3 つの幅は既定）

```bash
node <kit>/scripts/kit.mjs shot --out /tmp/fdpocket/shots --path /          # 390 / 768 / 1280 の 3 枚
node <kit>/scripts/kit.mjs shot --out /tmp/fdpocket/shots --path / --widths 320,1024   # 折り返しと横向きタブレット
```

- 既定は **390（スマホ）・768（タブレット縦）・1280（PC）**。1024 以下は指の端末（`pointer: coarse`・hover なし）として撮るので、hover だけに頼った操作は画像から消える。
- 3 枚を並べて見て、次を確かめる:
  - [ ] スマホは下のタブ、768 はレール、1280 はサイドバーになっている（ナビがあるとき）
  - [ ] 768 と 1280 が「スマホを引き伸ばしただけ」になっていない（本文の最大幅・表・一覧と詳細・ダイアログ）
  - [ ] どの幅でも主な操作が見えて、押せそう（hover に隠れていない）
  - [ ] `horizontalOverflow` が false（320 でも）、`smallTargets` が空
  - [ ] `bottomNavMissing` が false（スマホ幅で、本文の外の `<nav>` / `role="navigation"` に行き先が 2 つ以上あるのに、画面の下にナビが無いと true になり、notes にも出る）。部品や見た目は問わず位置だけを見る。知らせるだけで、意図した配置なら理由を結果に書いてそのままでよい
  - [ ] PC 幅で大事な操作が画面の下端に無い
- 撮れない環境では、使った接頭辞（`md:` `lg:` `pointer-coarse:`）と部品を根拠に書き、**見られていないことを結果に書く**。

## 10. やらないこと

- 端末の種類・UA で分岐する（`navigator.userAgent`・`/iPad/` の判定）。
- 幅で項目・機能を消す（PC にしか無い機能、スマホにしか無い機能）。見せ方を変えても、できることは同じ。
- hover だけ・右クリックだけ・近道だけ・ドラッグだけでできる操作。
- ブラウザ・OS の決まった近道を上書きする。
- PC 幅で画面幅いっぱいの下からのシート、下端に固定した主ボタン。
- `useMediaQuery` の結果で最初の描画を切り替える（ちらつく）。

## 出典（2026-11 に確認）

- Android: [Use window size classes](https://developer.android.com/develop/ui/compose/layouts/adaptive/use-window-size-classes) / [Build adaptive navigation](https://developer.android.com/develop/ui/compose/layouts/adaptive/build-adaptive-navigation) / [Canonical layouts（list-detail）](https://developer.android.com/develop/ui/compose/layouts/adaptive/canonical-layouts)
- Apple HIG: [Layout（サイズクラス）](https://developer.apple.com/design/human-interface-guidelines/layout) / [Designing for macOS](https://developer.apple.com/design/human-interface-guidelines/designing-for-macos) / [Keyboards](https://developer.apple.com/design/human-interface-guidelines/keyboards) / [Context menus](https://developer.apple.com/design/human-interface-guidelines/context-menus)
- Microsoft: [Screen sizes and breakpoints](https://learn.microsoft.com/en-us/windows/apps/design/layout/screen-sizes-and-breakpoints-for-responsive-design)
- web.dev: [Media features（pointer / hover）](https://web.dev/learn/design/media-features) / [Interaction](https://web.dev/learn/design/interaction)
- WCAG 2.2: [1.4.10 Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html) / [2.5.8 Target Size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) / [2.1.4 Character Key Shortcuts](https://www.w3.org/WAI/WCAG22/Understanding/character-key-shortcuts.html)
