---
name: fdpocket-app-pwa
description: ミニアプリをホーム画面に置いて全画面で開いたとき（PWA）にも使いやすくする。スーパーアプリの中・ブラウザ・ホーム画面の 3 つの開き方の違い、セーフエリア（--safe-* の変数）、ブラウザの戻る・再読み込みが無い前提の画面、通信が切れたとき、更新後の古い画面、外部リンク、アイコンと名前。画面の端に接する要素・戻る導線・オフラインを作るときに使う。
---

# ホーム画面から開いても使いやすくする（PWA）

*manifest・アイコン・`<meta>` は Platform が出す（App のオリジンが掲載情報から作る）。App が書くのは**画面の作り**だけ。*

**やらないこと**: `manifest.webmanifest` や `apple-mobile-web-app-*` の `<meta>` を書く・**Service Worker を登録する**（検証で弾かれる）・「ホーム画面に追加」の独自の案内を出す。

## 1. 3 つの開き方

同じ画面が、次の 3 つの環境で開かれる。どれでも崩れないように作る。

| | スーパーアプリの中 | ブラウザ | ホーム画面（PWA） |
|---|---|---|---|
| `client.ui.host()` | `'superapp'` | `'standalone'` | `'standalone'` |
| 見分け方 | `host()` | `matchMedia('(display-mode: browser)')` | `matchMedia('(display-mode: standalone)')`・CSS は `standalone:` |
| セーフエリア | Host が渡す（`useSafeArea()`）。CSS の `env()` は 0 | ほぼ 0（横向きの iPhone で左右だけ値が入る） | `env()` に実際の値（ノッチ・ホームバー） |
| 戻る・再読み込み | スーパーアプリの閉じる・戻る | ブラウザのボタン | **無い**（Android は端末の戻る操作だけ） |
| 上の帯 | スーパーアプリのヘッダーの下に App が出る | アドレスバーの下 | 端末のステータスバーのすぐ下 |
| 保存（`localStorage`） | App のオリジン | 同じ | **ブラウザとは別のことがある**（iOS）。ブラウザでの下書き・ログインは引き継がれない前提で |

- 開き方で**機能を変えない**。変えてよいのは余白と、戻る・更新の導線の出し方だけ。
- `host()` は「ブラウザ」と「ホーム画面」を区別しない。区別が要るときだけ `display-mode` を見る。

## 2. セーフエリア（いちばん崩れやすい）

**画面の端に接する要素は、`globals.css` の `--safe-top` / `--safe-right` / `--safe-bottom` / `--safe-left` で余白を取る。**
この変数は、スーパーアプリの中なら Host の値、ホーム画面なら `env()` の値になる（`AppShell` に `safeArea={useSafeArea()}` を渡しておけば入る。ひな形の `__root.tsx` のとおり）。

| 要素 | 書き方 |
|---|---|
| 上のヘッダー | `AppShell` が `pt-[var(--safe-top)]` を持つ。自作のヘッダーを作らない |
| 下に固定したバー・タブ・主ボタン | `fixed inset-x-0 bottom-0 pb-[max(0.75rem,var(--safe-bottom))]`。バーの**背景はホームバーの下まで伸ばし**、中身だけ上げる |
| 本文の最後 | 下に固定のバーがあるなら、本文に `pb-[calc(バーの高さ+var(--safe-bottom))]` を足して最後の行が隠れないように |
| 横の余白 | `pl-[max(1rem,var(--safe-left))]`（横向きのノッチ）。`AppShell` は持っている |
| 下から出るシート | ひな形の `Sheet` が持っている |

- **`env(safe-area-inset-*)` を直接書かない**（スーパーアプリの中で 0 になり、ホームバーに重なる）。**`useSafeArea()` の値だけで余白を取らない**（ホーム画面で 0 になる）。両方を合わせた `--safe-*` を使う。
- 二重に足さない: 親が余白を取ったら、子でまた足さない（ノッチの分だけ空白が 2 倍になる）。
- 高さは `h-dvh` / `min-h-dvh`。`h-screen`（`100vh`）は iOS で下が切れる。
- 横向き・タブレット幅でも、左右の余白と `max-w-*` で本文が端に張り付かないこと。
- 自作のモーダル・固定パネルも高さは `max-h-[calc(100dvh_-_var(--safe-top)_-_var(--safe-bottom)_-_2rem)]` と `overflow-y-auto overscroll-contain`（ひな形の `Dialog` / `Sheet` と同じ）。中身が長くても閉じるボタンがノッチの下に隠れない。
- ホーム画面で引っ張ったときに画面全体が伸びないよう、ひな形の `globals.css` が `display-mode: standalone` のときだけ `overscroll-behavior-y: none` にしている。消さない。
- 上の帯は Platform が `apple-mobile-web-app-status-bar-style: default`（状態バーの下から画面が始まる）にしている。iOS のホーム画面では `--safe-top` が 0 になることがあるが、それで正しい。

公式の指針: [WebKit: Designing websites for iPhone X](https://webkit.org/blog/7929/designing-websites-for-iphone-x/)（`viewport-fit=cover` と `max(余白, env())`）・[Chrome: edge-to-edge](https://developer.chrome.com/docs/css-ui/edge-to-edge)・[web.dev: app-like PWAs](https://web.dev/learn/pwa/app-design)（`display-mode`・`overscroll-behavior`・theme-color の明暗）。

## 3. ブラウザのボタンが無い前提で作る

- **詳細・編集・設定の画面には、画面の中に戻る導線**（`PageHeader` の左の戻る `<Link>`）を必ず置く。「ブラウザで戻ればよい」は通らない。
- 戻る先は URL で決める（`$fdpocket-app-ux-patterns` §1）。履歴が無い状態で開かれても（共有リンク・ホーム画面から直接）、一覧へ戻れること。`history.back()` だけに頼らない。
- **引っ張って更新が無い**: 前面に戻ったときに読み直す（TanStack Query の `refetchOnWindowFocus` は既定で有効。切らない）。更新が要る画面は、必要なら更新ボタンを置く。
- 再読み込みで状態が消えないように、絞り込み・タブ・ページは URL に、書きかけは下書きに（`$fdpocket-app-ux-patterns` §2）。
- 別のオリジンへ `location.href` で移らない（ホーム画面のアプリから出てしまい、戻れない）。App の中の移動は `<Link>`。

## 4. 外部リンク

- 外部のサイト（マニュアル・地図・取引先）は `<a href target="_blank" rel="noopener noreferrer">` で開く。ホーム画面のアプリの中に他のサイトを読み込まない。
- 外部へ出るリンクには、外へ出ることが分かるアイコン（`ExternalLink`、`aria-hidden`）と文言を添える。
- 電話・メールは `tel:` / `mailto:`。

## 5. 通信が切れたとき

Service Worker を置かないので、**開いた後に切れた場合**に正しく振る舞えばよい。

- `navigator.onLine` と `online` / `offline` のイベントで、画面の上に細い帯（`role="status"`。「オフラインです。つながると自動で読み直します」）を出す。つながったら消して読み直す。
- 切れている間に押された保存は、入力を消さずに「送れませんでした。つながったらもう一度お試しください」と出す（勝手に後で送らない。二重に送られる）。
- 読み込み済みの一覧はそのまま見せる（エラーで真っ白にしない）。

## 6. 開いたままの画面と更新

ホーム画面のアプリは何日も開いたままになる。その間に新しい版が公開されると、古い画面が新しい版に無いファイルを読もうとして失敗する。

```ts
// main.tsx（ルートを分割して読み込むときだけ要る）。1 回だけ読み直し、失敗が続いても繰り返さない
window.addEventListener("vite:preloadError", () => {
  try {
    if (sessionStorage.getItem("reloaded-after-update")) return
    sessionStorage.setItem("reloaded-after-update", "1")
  } catch (error) {
    console.error("could not record the reload", error)
  }
  window.location.reload()
})
```

- API の形を変えたときは、古い画面からの呼び出しも壊れないように（項目を足すのはよいが、消す・名前を変えるのは 1 版待つ）。

## 7. アイコンと名前

- ホーム画面のアイコンと名前は**掲載情報**（`$fdpocket-app-listing`）から作られる。アイコンは小さく丸く切り抜かれても判別できる絵にし、細かい文字を入れない。
- 名前はホーム画面で長いと切れる（目安は全角 6〜8 字・英字 12 字）。App の表示名は短く（「タスク帳」）。
- `<title>` は画面ごとに「画面の名前 · アプリ名」に（タスクの切り替え・履歴で区別できる）。
- テーマ色は Platform が白にしている。上の帯の色を変えたいときだけ、`index.html` に `<meta name="theme-color" content="…">` をヘッダーの背景と同じ色で書く。明と暗で 2 つ（`media="(prefers-color-scheme: light)"` / `dark`）書き、暗い画面で白い帯が残らないようにする。

## 8. 確かめる

1. `kit shot --safe-area iphone --widths 390` で、ノッチ（上 59px）とホームバー（下 34px）を赤い縞で重ねて撮る。縞の上に文字・ボタンが乗っていないか、下のバーの背景が縞の下まで伸びているかを見る（`--safe-area 上,右,下,左` で横向きなども再現できる）。
2. `kit check` の警告 `SAFE_AREA_*`（`h-screen`・`env()` の直書き・安全領域の無い端の固定バー）が出ていたら直す。
3. コードを読んで: `env(safe-area-inset-` を直接書いていない／`fixed bottom-0` の要素に `--safe-bottom` がある／詳細の画面すべてに戻る導線がある／`location.href` で別のオリジンへ移っていない／Service Worker・manifest を書いていない。
4. 実機のホーム画面では確かめられないので、確かめられなかったことを結果に書く（ノッチのある端末での見え方など）。
