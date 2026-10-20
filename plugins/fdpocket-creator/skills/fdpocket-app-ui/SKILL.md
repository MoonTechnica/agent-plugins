---
name: fdpocket-app-ui
description: ミニアプリの画面を作る。shadcn の部品（packages/ui）と Tailwind のトークン、TanStack Router のファイルベースのルート、SDK のフックでのデータ取得と一覧のページング、読み込み中・空・エラーの状態、SdkError の出し分け、スマホ幅とキーボード・セーフエリア・タップ標的。画面を作る・直すときに使う。
---

# 画面を作る

## 1. 構成

- ルートは `apps/<slug>/src/routes/` のファイルベース（TanStack Router）。`routeTree.gen.ts` はプラグインが作る（手で書かない）。
  `/tasks` は `routes/tasks/index.tsx`、`/tasks/$taskId` は `routes/tasks/$taskId.tsx`。リンクは `<Link to="/tasks/$taskId" params={{ taskId: task.id }}>`。
- `main.tsx` と `ProjectProvider`・`client.auth.fromHost()` はテンプレートのまま使う。
- 部品は `@workspace/ui/components/*`（shadcn。button / card / input / label / textarea）。足りない部品は `packages/ui/src/components/` に
  shadcn の書き方で足し、**web と admin で共有**する。画面ごとにクラス文字列の定数をコピペしない。
- 色はトークン（`bg-background` / `text-foreground` / `text-muted-foreground` / `bg-primary` / `border-border` / `text-destructive`）。
  `bg-zinc-900` や `#fff` のような生の色を書かない（ダークモードが壊れる）。アイコンは `lucide-react`。
- UIのi18n対応は必須。現在の初期対応言語はja/enだが、今後の言語追加に対応できる構造にする。利用者の対応言語の指定は初期辞書へ反映し、対応言語が少なくてもi18n構造は維持する。
- `useLocale()`（`@workspace/miniapp-sdk/react`）または `client.ui.locale()` でHostの言語を取得する。ブラウザ言語だけで判定してHostの設定を無視しない。
- 文言は言語ごとの辞書にまとめる。見出し・ボタン・フォーム・プレースホルダー・空状態・送信結果・エラー・確認ダイアログ・`aria-label`を全対応言語で揃える。
  SDKエラーの生の `message` を利用者に見せず、`code` に対応する翻訳を出す。web/adminで共通の文言は共有パッケージで再利用する。
- 日時・数値・通貨は共通のロケール解決後のlocaleで `Intl.DateTimeFormat` / `Intl.NumberFormat` を使う。日時は利用者のタイムゾーンに直して表示する（DBはUTC）。
  `document.documentElement.lang` も選択したlocaleに合わせる。利用者が書いたタスク名・投稿・表示名などのデータを勝手に翻訳・上書きしない。
- 対応言語一覧・既定言語・ロケール解決は共通の一か所に置く。SDKのlocaleは文字列として扱い、`ja`かどうかだけで全言語を2択に潰さない。
  言語タグの完全一致、親タグ・基底言語、既定言語の順で対応辞書を解決する。翻訳キーの欠落は開発時に検出し、本番で生のキーや空欄を表示しない。
- ミニアプリはViteのSPAであり、Next.js用の`next-intl`をそのまま入れない。小さなアプリは型を揃えた辞書・共通の翻訳処理・SDKのlocaleで実装できる。allowlistに無い依存を追加しない。

```tsx
import { useLocale } from '@workspace/miniapp-sdk/react'

// アプリの共通i18nモジュール。対応言語・既定言語・フォールバックを一か所で管理する。
import { getMessages } from '../i18n'

function AddTaskButton() {
  const t = getMessages(useLocale())
  return <button type="submit">{t.addTask}</button>
}
```

## 2. データ

```tsx
import { useClientQueries } from '@workspace/miniapp-sdk/react'
import { schema } from '@workspace/sdk'

function TaskList({ workspaceId }: { workspaceId: string }) {
  const hooks = useClientQueries(schema)
  const args = { where: { workspaceId }, orderBy: [{ createdAt: 'desc' as const }, { id: 'desc' as const }], take: 20 }
  const pages = hooks.task.useInfiniteFindMany(args, {
    // 次のページの引数は args を丸ごと置き換える（足りない項目は引き継がれない）ので、args を広げて書く
    getNextPageParam: (last) =>
      last.length < args.take ? undefined : { ...args, skip: 1, cursor: { id: last.at(-1)!.id } },
  })
  const tasks = pages.data?.pages.flat() ?? []
  const create = hooks.task.useCreate()      // 成功すると task のクエリが読み直される
  // …
}
```

- 増えうる一覧は**必ずページング**する。スマホの一覧は「もっと見る」ボタン（無限スクロールにするならボタンも DOM に残す）。
  `take` を付けずに全件を取らない（Gateway は 200 件で切る）。
- 書き込みのフック（`useCreate` / `useUpdate` / `useDelete`）は関係するクエリを自動で読み直す。手で `invalidateQueries` しない。
- 二重送信を防ぎたい作成（注文・申請）は `client.idempotent(key).db.<model>.create(...)` で送り、送信中はボタンを無効にする。

## 3. 状態（全部そろえる）

| 状態 | 表示 |
|---|---|
| 読み込み中 | 実寸に近いスケルトン（レイアウトを動かさない） |
| 空 | 何も無いことと、次の操作（「最初のタスクを作る」） |
| エラー | `SdkError` の `code` で出し分け（下）。再試行のボタン |
| 追加の読み込み中・末尾 | 一覧の末尾に表示（既存の項目を消さない） |
| 送信中 | ボタンを無効にし、結果（成功・失敗）を画面に出す |

| `code` | 表示 |
|---|---|
| `FORBIDDEN` | 「この操作の権限がありません」 |
| `NOT_FOUND` | 「見つかりません」（消された・見えない） |
| `VALIDATION_FAILED` | `details` から欄ごとのメッセージ |
| `CONFLICT` | 「すでにあります / ほかの人が変更しました」 |
| `RATE_LIMITED` / `QUOTA_EXCEEDED` | 「しばらく待ってください」 |
| `GATEWAY_UNAVAILABLE` | 「つながりません」+ 再試行 |
| `POST_WRITE_READ_DENIED` | エラーにしない（保存済み。一覧を読み直す） |
| `HOST_UNAVAILABLE` | スーパーアプリの外で開かれたときの案内 |

失敗を空の一覧として見せない（`[]` で握りつぶさない）。

## 4. スマホ幅

- 最初に 360〜430px の幅で組み、広い画面は `md:` で足す。横スクロールを出さない。
- **入力欄の文字は 16px 以上**（`text-base`。shadcn の `Input` / `Textarea` はそうなっている。`text-sm` で上書きしない）。iOS で拡大されないため。
- 入力には意味に合った属性: `type="email"` `autoComplete="email"` / `inputMode="numeric"` / `enterKeyHint="send"` など。
- キーボードが画面の半分を覆う。送信ボタンを画面下に固定するなら、入力中も届くこと（フォームの直下に置くのが確実）。
- タップできる要素は 44×44px 以上（小さいアイコンも padding で広げる）。破壊的な操作（削除）を主要な操作の隣に置かず、確認を挟む。
- 埋め込み時はセーフエリアを `useSafeArea()` で取り、画面の端に固定するバーに padding として足す。
- モーダルはスマホ幅では下から出るシートにする。

## 5. 権限による出し分け

`client.auth.can('tasks.manage')`（または `useSession()?.permissions`）でボタンを出す / 出さないを決めてよいが、**守りではない**。
守りは ZModel のポリシーと project.yaml の capability。出していないボタンの操作も、Gateway が拒否すれば `FORBIDDEN` を出す作りにする。

## 6. 注意

- TanStack Router の `autoCodeSplitting` の `kit dev` で、ファイルを書き換えた後にページを丸ごと読み直すと、分割したルートのコンポーネントが古いまま返ることがある。
  HMR（書き換えの自動反映）では正しく更新されるので、読み直しで古く見えたら `kit dev` を起動し直す。
- 外部 CDN のフォント・画像・スクリプトを読まない。フォントは npm（`@fontsource-variable/*`）、画像は `apps/<slug>/public/` か `client.storage`。
- 配信物の画像・フォント・Worker等のURLはimport、`new URL('./asset.png', import.meta.url)`、または`import.meta.env.BASE_URL`から組み立てる。`'/image.png'`のような実行時のルート絶対パスを固定しない。検証済み・非公開アプリは認証付きの配信prefix配下で動く。Routerの`basepath`も`import.meta.env.BASE_URL`を維持する。APIにはSDKの`apiPath`を使う。
