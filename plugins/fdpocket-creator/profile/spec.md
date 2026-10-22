# ミニアプリの仕様（SDK・Project・禁止事項）

この文書が**唯一の API 契約**である。ここに無い API・グローバル変数・外部 URL は存在しない。
書いても取り込みの静的検証と実行時の Gateway・CSP が落とすので、作り直しになる。
型の正本は Kit が置くビルド済みの SDK（`packages/miniapp-sdk/`。`.d.ts` 付き）で、迷ったら型を読む。

## 1. 作るもの

**Project**（1 つのモノレポ）を作る。Project は複数の **App** を持ち、同じ Project の App は
**データベース・ユーザー・権限・ファイルを共有**する。App ごとの違いは `infra/project.yaml` の capability で表す。

| kind | 中身 |
|---|---|
| web | 利用者・管理者の画面（Vite + React SPA）。権限はAppごとに宣言 |
| api | 外部API・Webhookを扱うWorker |
| jobs | UTC scheduleで実行するWorker |

Appは任意名で1〜16個。同kindを複数持て、webを持たない構成もよい。web/adminは命名例。画面Appのslug apiはAPIルーティング用に予約する。

App は Project 専用のオリジン（`https://{project}.{apps-domain}`）で配られ、web は `/`、ほかの App は `/<slug>/` に置かれる。
スーパーアプリ（Web / iOS / Android）からは iframe / WebView に埋め込まれて開く。直接開かれることもある。

```text
<project>/                   # ./source/（git のリポジトリ）
├── apps/
│   ├── web/                 # src/main.tsx, src/routes/（ファイルベースのルート）, vite.config.ts
│   └── admin/               # 任意
├── packages/
│   ├── db-schema/           # schema.zmodel（編集する）, platform.zmodel（Kit が置く）, migrations/, pending/, seed.ts, erase.test.ts
│   ├── sdk/                 # src/index.ts（client と schema）+ src/zenstack/（kit generate の生成物）。編集しない。commit する
│   ├── ui/                  # shadcn の部品と globals.css
│   ├── miniapp-sdk/         # Kit が置くビルド済みの SDK。編集しない。commit する
│   └── project-protocol/    # 同上（SDK の依存）
├── infra/project.yaml       # App・capability・バケット・Role の宣言（§2）
├── listing/                 # 掲載情報（§10）
├── design/                  # brief.md / screens.md / data-model.md
├── bunfig.toml              # 変えない（§8）
├── bun.lock                 # commit する（§8）
└── package.json             # workspaces: apps/*, packages/*
```

`kit new` がこの形を作る。App の `vite.config.ts` は `createAppConfig('<slug>', import.meta.dirname)`
（`@workspace/miniapp-sdk/vite`）を呼ぶだけにする。配信の場所・出力（Project の根の `dist/<slug>/`）・
TanStack Router / React / Tailwind のプラグイン・`kit dev` のポート（`APP_DEV_PORTS`: web 5173 / admin 5174）・
ビルド時の定数（`__PROJECT_ID__` / `__APP_SLUG__` / `__GATEWAY_URL__`）を決める。定数の値は `kit build` / `kit dev` が渡す。

## 2. `infra/project.yaml`

Platform が検証・正規化して版に記録する。`kit generate` が同じ検査をする（`.kit/generated/project.json`）。

```yaml
version: 1
sdkVersion: 3
apps:
  web:
    kind: web
    access: public                       # public | restricted
    displayName: { ja: "タスク", en: "Tasks" }
    capabilities:
      models:                            # モデル（camelCase）× 操作: read | create | update | delete
        task: [read, create, update, delete]
        user: [read, update]
      buckets:                           # バケット × 操作: read | write | delete
        attachments: [read, write, delete]
    anonymous: { allowed: false, write: false }
  admin:
    kind: web
    access: restricted
    requiredPermission: app.access.admin # restricted には必須（public には書けない）
    capabilities:
      models:
        user: [read]
        projectRole: [read, create, update, delete]
buckets:
  attachments:
    public: false                        # true のバケットだけ visibility: public を CDN で配れる
    maxBytes: 10485760                   # 5 GiB まで
    contentTypes: [image/*, application/pdf]
    # delivery: proxy                    # 毎回認可する表示用URL。public: false 必須
    # appScoped: true                    # App間で共有しない場合。public: false 必須
roles:                                   # Role 名 → Permission（a.b の形。platform.* は予約）
  admin: [app.access.admin, users.manage, roles.manage, audit.read]
  member: [workspace.create]
defaultRoles: [member]                   # 初めて使った人に付く
ownerBootstrap: [admin]                  # Project の作者に付く
```

| 規則 | 内容 |
|---|---|
| App | 1〜16個、任意slug `[a-z][a-z0-9-]{1,31}`。kindはweb/api/jobs、同kindも複数可。画面Appのapi slugは予約 |
| capability | **App が使うモデル × 操作・バケット × 操作だけ**を宣言する。宣言していない操作は Gateway がポリシーより先に `FORBIDDEN` にする。広すぎる宣言は審査で指摘される |
| 宣言できない操作 | `user` の create、`storageFile` の create / update、`auditEvent` の create / update / delete（Platform だけが書く） |
| バケット | 10 個まで。名前は `[a-z][a-z0-9-]{1,31}` |
| 匿名 | `anonymous.allowed` が false の App は匿名の利用者を開かない。`write: true` は `allowed: true` が要る |
| Role | Permission の付与は Role 経由だけ。Role を変えると次のリクエストから両方の App に効く |

api / jobs・外部サービス・通知を使う Project は、次の項目を足す（手順は `$fdpocket-app-integrations` と `$fdpocket-app-notifications`）。

```yaml
version: 1
sdkVersion: 3
apps:
  web:
    kind: web
    access: public
    capabilities:
      models:
        order: [read, create]
      ai: { chat: true }                     # ミニアプリ内 AI（§3.8）。使う web App だけ
    network:
      browser: [https://maps.googleapis.com]   # ブラウザから直接呼ぶ公開 API（https のオリジン。CSP に足す）
  partner-api:
    kind: api
    routes: ["/api/*"]                       # Project オリジンの /api/* を受ける
    network:
      egress: [api.stripe.com]               # サーバーが呼べるホスト名（HTTPS だけ）。*.example.com も可
    secrets:                                 # 名前だけ。値は作者がアプリ管理画面で入れる
      - name: STRIPE_SECRET_KEY
        description: { ja: "Stripe のシークレットキー", en: "Stripe secret key" }
        required: true
    servicePermissions: [notifications.send, jobs.schedule, ai.chat]   # ai.chat: 利用者として AI を呼ぶ（jobs にも書ける）
  digest:
    kind: jobs
    schedules:
      - { cron: "0 0 * * *", handler: dailyDigest }   # UTC。実行の間隔は 5 分以上
    network:
      egress: [hooks.slack.com]
    secrets:
      - name: SLACK_WEBHOOK_URL
    servicePermissions: [notifications.send, jobs.consume]
notifications:
  templates:
    order_shipped:                           # キーは [a-z][a-z0-9_]
      app: web                               # path を開く web App（path を書くなら必須）
      category: orders                       # 利用者がカテゴリごとに止められる
      title: { ja: "注文を発送しました", en: "Your order has shipped" }   # 60 字まで
      body: { ja: "{{item}} を発送しました", en: "{{item}} is on its way" } # 120 字まで
      params:
        item: { maxLength: 40 }
        orderId: { maxLength: 36 }
      path: /orders/{{orderId}}              # App 内の相対パス
ai:                                          # ミニアプリ内 AI を使う Project だけ（§3.8）
  model: auto                                # 省略可。auto（Jev Router が選ぶ）/ fast / quality / 許可されたモデル ID
  maxOutputTokens: 16384                     # 省略可。1 ターンの出力の上限（推論も含む。1〜65536）
  instructions: [order-helper]               # ai/order-helper.md（システムの指示文。8 個・各 8 KiB まで）
  schemas: [OrderSummary]                    # ai/schemas/OrderSummary.json（JSON Schema。8 個まで）
```

| 規則 | 内容 |
|---|---|
| api / jobs | `access`（public 以外）・`capabilities`・`anonymous`・`requiredPermission`・`displayName` を書けない。利用者の代わりに呼ぶときは `asUser` で、その利用者の web App の capability で判定される |
| `network.egress` | api / jobs だけ。ホスト名（小文字・2 ラベル以上。先頭に `*.` を 1 つ）を 50 個まで。IP 直指定・`localhost`・`.local` / `.internal` などの内部名・Platform のホスト（Supabase / Turso / R2）は書けない。実行時も http・既定以外のポート・URL の資格情報を拒否し、リダイレクトを追わない |
| `network.browser` | web だけ。`https://host` の形（パス・ポート・末尾の `/` なし）。秘密が要る API は書かず api 経由にする |
| `secrets` | api / jobs だけ。名前は `[A-Z][A-Z0-9_]` で 50 個まで。`GATEWAY_URL` と `PLATFORM_` で始まる名前は予約。値はコード・manifest・`listing/` に書かない（取り込みの検証が落とす） |
| `servicePermissions` | api / jobs だけ。`notifications.send`（通知を送る）・`jobs.schedule`（jobs へ仕事を予約する）・`jobs.consume`（予約を受ける jobs 側）・`ai.chat`（api は利用者として、jobs は実行中のジョブとして AI を呼ぶ。§3.8） |
| `ai` | AI を使う版だけ書く（書くと利用者の初回の同意に「AI の利用」が加わり、既に同意した人にも出し直す）。`instructions` / `schemas` は宣言した名前のファイルだけが版に固定される（実行時にファイルを読み直さない） |
| `schedules` | jobs だけ。UTC の 5 フィールドの cron と handler 名。main / prod だけで動く（branch / preview では動かない） |
| `routes` | api だけ。`["/api/*"]` だけ |
| `notifications` | テンプレートは 50 個まで。文中の `{{名前}}` はすべて `params` に宣言する。パスワード・金額・個人情報を文面とパラメータに入れない（ロック画面に出る） |

## 3. SDK（`@workspace/miniapp-sdk`）

各 App は Project の `@workspace/sdk` の `client` を使う（`packages/sdk/src/index.ts`。テンプレートが置き、編集しない）。

```ts
import { client, schema, apiPath } from '@workspace/sdk' // client = createClient<SchemaType>({ projectId, app, gateway })
```

`createClient(options: ClientOptions)` の `ClientOptions` は `projectId` / `app` / `gateway`（と試験用の `fetch` / `window`。
`window` は `HostWindow` = `parent` / `addEventListener` / `removeEventListener` と、直接ログインの移動先を扱う任意の`location`（`href` / `assign`）を持つもの）。
`projectId` と `app` はルーティングのヒントで、トークンの中身と違えば `TOKEN_SCOPE_MISMATCH`。SDK を書き換えても別の Project・App にはならない。

`ProjectClient` のメンバー: `projectId` / `app` / `auth` / `db` / `idempotent` / `storage` / `ui` / `gateway` / `fetch`
（`fetch` はトークンを付けて Gateway を呼ぶ。失敗は `SdkError` にして投げる。App が直接使う場面はほぼ無い）。

### 3.1 `client.auth` — 本人とトークン（`Auth`）

| API | 使い方 |
|---|---|
| `client.auth.fromHost()` | スーパーアプリに埋め込まれているとき、Host からトークンを受け取る（`main.tsx` で 1 回。テンプレートどおり）。埋め込まれていない・10 秒で届かなければ `HOST_UNAVAILABLE` |
| `client.auth.signInWithSuperApp()` | 直接アクセス時、同じミニアプリオリジンのPlatform製入口へ進む。FDPocketアカウントが必要なことを説明し、本人が「続ける」を押してからログイン・アプリの既存同意へ移る。一回限りコードとstate/PKCEで元のオリジン・Appパスへ戻り、信頼されたwrapperからProject専用セッションを受け取る。埋め込み中は`fromHost()`を再利用し、認証済みなら移動しない。戻り値は`Promise<void>` |
| `client.auth.session()` | 今の `Session`（無ければ null） |
| `client.auth.onChange(listener)` | 受け取り・更新・失効で呼ぶ。戻り値で購読をやめる |
| `client.auth.can(permission)` | **画面の出し分けだけ**に使う（ボタンを出す / 出さない）。認可は Gateway が毎回 DB で判定する。これを認可の代わりにしない |
| `client.auth.refresh()` | 期限前の更新（SDK が自動で行う。失効は `SESSION_EXPIRED`） |
| `client.auth.signOut()` | このミニアプリのトークンを失効する（スーパーアプリのログインには触れない） |

`Session` は `userId`（Project 内の User.id）/ `globalUserId` / `displayName` / `isAnonymous` / `permissions`（トークン発行時の写し）/
`apps`（この人が開ける App）/ `expiresAt`。トークンはメモリにだけ置く（SDK がそうする）。Supabase の資格情報は App に来ない。
直接ログインの往復では、Platform製入口だけがstate・PKCE verifier・対象を一時保存して戻りで破棄する。生成Appはトークンや認証資格情報をURL・Cookie・localStorage・sessionStorageに保存しない。直接起動をリロードした場合は入口から再開する。

### 3.1a `client.profile` — スーパーアプリの本人プロフィール（`Profile` / `PlatformProfile`）

`await client.profile.get()` は最新の `{ displayName: string | null, avatarUrl: string | null }` を返す。
匿名・プロフィールの無いアカウントは `null`。メール等の非公開情報や他人のプロフィールは取得できない。
アバターは128pxに変換済みのURLで、そのまま画像のsrcに使える。未設定ならイニシャル等を表示する。
GatewayをSupabaseとは別オリジンに置く構成では、Appの`network.browser`にSupabaseの公開オリジンを宣言して画像のCSPを許可する。

アプリの性質に応じて、参照とコピーを選ぶ（両者を混同しない）。

```ts
// スーパーアプリの情報を使う: 表示時や再表示時に取得する。取得エラーは画面で扱う。
const profile = await client.profile.get()

// アプリ独自のプロフィールの初期値としてコピーする: 本人の操作などで一度だけ保存する。
const session = client.auth.session()
if (session && profile) {
  await client.db.user.update({ where: { id: session.userId }, data: profile })
}
```

コピーはAppの`capabilities.models.user`に`read`・`update`が必要で、Userの本人更新ポリシーが適用される。
取得だけではProjectのUserを書き換えない。コピー後はUserを読み、独自編集を毎回の起動で上書きしない。
`Session.displayName`はProject内の名前の発行時の写しであり、スーパーアプリの最新情報ではない。
既存の初回ログインは表示名のみ初期コピーする。アバターのコピーが必要なら上のAPIを明示的に使う。
コピーするのは画像URLであり画像ファイルの複製ではない。元画像の削除後も保管する要件には別途ファイルの保存が必要。

`kit dev`（Studioのライブプレビューも同じ）は本人の実情報を使わず、Member/Adminの仮名・仮アバターを返す。
anonymousは`null`。検証済みの版のプレビューは、起動同意済みの本人の実プロフィールを返す。

### 3.2 `client.db` — データ（ZenStack の query をそのまま）

```ts
const tasks = await client.db.task.findMany({
  where: { workspaceId },                                  // 明示的に絞る（ポリシー任せにしない）
  orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],        // 一意列を最後に（ページ間で重複・欠落しない）
  take: 20, skip: cursor ? 1 : 0, cursor: cursor ? { id: cursor } : undefined,
})
await client.db.task.create({ data: { title, workspaceId } })
await client.db.task.update({ where: { id }, data: { done: true } })
await client.db.task.delete({ where: { id } })
await client.idempotent(crypto.randomUUID()).db.task.create({ data })   // 二重送信を防ぐ（Gateway が 10 分覚える）
```

| 項目 | 内容 |
|---|---|
| 操作（`DB_OPERATIONS` / `DbOperation`） | `findMany` / `findUnique` / `findFirst` / `count` / `exists` / `aggregate` / `groupBy` / `create` / `createMany` / `createManyAndReturn` / `update` / `updateMany` / `updateManyAndReturn` / `upsert` / `delete` / `deleteMany` |
| 無いもの | `$queryRaw` / `$executeRaw` / `$transaction` / `findUniqueOrThrow` などの `*OrThrow`。生の SQL は使えない |

複数書き込みは `await client.db.batch([{ model: 'task', operation: 'create', args: { data: { id, title: '準備する' } } }, ...])`。順序どおりに実行し、対応する結果のtupleを返す。型は通常のDB操作と同じ。`DbBatchOperation<Schema>`はモデル・書き込み操作・引数の型付き入力、`DbBatchResults<Schema, Operations>`は対応する返却値のtuple型。書き込みだけ、1〜20操作、本文1MiB・応答5MiB、実行期限4秒（各操作後とcommit直前に検査）。失敗・行ポリシー拒否・読み返し拒否・期限/応答上限超過は全体をrollbackし、通知はcommit後だけ。各操作の入れ子を含むApp capabilityを検査し、1リクエストの認証contextで行ポリシーを適用する。前の結果を参照する式やcallbackは使えない。必要なIDは事前に用意する。`Batch` / `batch` はモデルの予約名。サーバーの `client.idempotent(key).db.batch` も利用できる。
| 型 | `DbClient` はスキーマの全モデル、`AppDbClient` は `ModelCapabilities`（project.yaml の capability）で操作を狭めた型。型の有無はセキュリティではない（判定は Gateway） |
| ページング | `take` は既定 50・最大 200（SDK と Gateway でクランプ）。一覧は最初からページングする |
| 上限 | 1 リクエストの本体 1 MiB、`createMany` は 500 行、`include` の入れ子は深さ 3 まで |
| 書いた後に読めない | 保存はされたが、新しい値をポリシー上読み返せないときは `POST_WRITE_READ_DENIED`（`committed: true`）。**失敗として扱わない**（一覧を読み直す） |

**React**（`@workspace/miniapp-sdk/react`）: データのフックは ZenStack の公式をそのまま再輸出している。

```tsx
const hooks = useClientQueries(schema)                     // または useModelQueries(schema, 'task')
const { data, error } = hooks.task.useFindMany({ where: { workspaceId }, take: 20 })
const args = { take: 20, orderBy: [{ createdAt: 'desc' as const }, { id: 'desc' as const }] }
const pages = hooks.task.useInfiniteFindMany(args, {          // 次のページの引数は args を丸ごと置き換える
  getNextPageParam: (last) => (last.length < 20 ? undefined : { ...args, skip: 1, cursor: { id: last.at(-1)!.id } }),
})
const create = hooks.task.useCreate()                      // 書き込みは関係するモデルのクエリを自動で読み直す
```

`ProjectProvider({ client, queryClient })` を根に置く（テンプレートどおり）。`useProjectClient()` は Provider の
`ProjectClientCore`（`projectId` / `app` / `auth` / `storage` / `ui` / `gateway` / `fetch`。db は上のフックで使う）。
`useSession()` は今の Session、`useSafeArea()` は Host のセーフエリア、`useLocale()` は Host のロケール文字列（接続前・単独起動はブラウザの言語タグ、取得不能なら`en`）。対応辞書への解決とフォールバックはAppの共通i18n処理で行う。`getQueryKey` は ZenStack の queryKey を作る
（手で invalidate するとき）。フックの `error` には `SdkError` が届く。`$transaction` のフックは型に出るが Gateway が受けない。

### 3.3 `client.storage` — ファイル

```ts
const bucket = client.storage.from('attachments')          // project.yaml の論理バケット（Storage）
const file = await bucket.upload(blob, { name: 'report.pdf', workspaceId, visibility: 'workspace',
  onProgress: ({ loaded, total }) => setProgress(loaded / total) })
const { url, expiresAt } = await bucket.getDownloadUrl(file.id)   // 60〜300 秒の署名 URL（public は CDN で expiresAt: null）
const meta = await bucket.get(file.id)                     // 読めない・別のバケットなら null
await bucket.remove(file.id)                               // 論理削除（実体は後で消える。冪等）
const files = await client.db.storageFile.findMany({ where: { bucket: 'attachments', workspaceId } })  // 一覧は db で
```

| 項目 | 内容 |
|---|---|
| `Bucket` | `upload` / `getDownloadUrl` / `get` / `remove` |
| `UploadOptions` | `name`（省略時は File の名前）/ `contentType`（省略時は Blob の type）/ `workspaceId` / `visibility` / `onProgress`（`UploadProgress` = `loaded` / `total`） |
| 可視性 | `private`（本人）/ `workspace`（Workspace のメンバー）/ `public`（`public: true` のバケットだけ） |
| `StorageFileMeta` | `id` / `bucket` / `ownerId` / `workspaceId` / `visibility` / `status` / `originalName` / `contentType` / `sizeBytes` / `createdAt`（ISO 文字列） |
| 上限 | 1 ファイル 5 GiB まで（100 MiB を超えると SDK が自動で Multipart。バケットの `maxBytes` と `contentTypes` も Gateway が見る） |
| 権限 | upload は capability の `write`、読むのは `StorageFile` のポリシー、一覧は `models.storageFile: [read]` が要る |

本体は R2 へ直接 PUT し、Gateway を通らない（トークンを付けない。署名 URL が権限）。URL は保存しない（毎回 `getDownloadUrl`）。

### 3.4 `client.ui` — スーパーアプリとの連携（`Ui`）

| API | 使い方 |
|---|---|
| `client.ui.host()` | `'superapp'`（埋め込み）か `'standalone'`（直接） |
| `client.ui.locale()` | Hostのロケール文字列。接続前・単独起動はブラウザの言語タグ、取得不能なら`en`。App側で対応言語・基底言語・既定言語へ解決し、翻訳と日時・数値書式に使う。現行Hostの対応言語はja/enだが、SDKの型を2言語に限定しない |
| `client.ui.openShare({ path, text })` | スーパーアプリの共有シート（App 内の相対パスだけ） |
| `client.ui.close()` | ミニアプリを閉じる |
| `client.ui.navigate({ app, path })` | 同じ Project の別 App へ（Host が開ける人か確かめる） |
| `client.ui.openCredits()` | スーパーアプリのクレジット購入を開く（AI の `QUOTA_EXCEEDED` のとき。購入画面はミニアプリに作らない） |
| `client.ui.safeArea()` / `client.ui.onSafeAreaChange(listener)` | セーフエリア（埋め込まれていなければ 0） |

埋め込まれていないときは no-op ではなく `HOST_UNAVAILABLE` を返す。`host()` を見て出し分ける。

### 3.5 `client.safety` — 利用者の投稿の通報とブロック（`Safety`）

**利用者が互いの投稿（コメント・メッセージ・プロフィール文など）を読めるミニアプリは、次の 3 つを必ず入れる**
（ストアの審査の要件。入れられないなら公開範囲を Workspace に閉じる）。

| やること | 書き方 |
|---|---|
| 投稿ごとの「通報」 | `client.safety.report({ target: { model: 'Post', id } })`。スーパーアプリが運営の窓口へ案内する（理由は窓口で書いてもらう） |
| 投稿者の「ブロック」 | `client.safety.block(authorId)`（スーパーアプリ全体で共通。返り値はブロックしている人の User.id） |
| ブロックした人の投稿を隠す | ZModel に `@@deny('read', authorId in auth().blockedUserIds)`（`$fdpocket-app-data-model` §2）。画面の側で絞らない |

`client.safety.blockedUserIds()` でブロックしている人を取れる。ブロックを外す操作はスーパーアプリの設定にあるので、
ミニアプリには作らない。

### 3.6 `client.notifications` — 通知の許可（`Notifications`）

通知はミニアプリごとに**既定で OFF**。利用者がスーパーアプリのシートで「受け取る」を押したときだけ届く。
ブラウザの SDK からは送れない（文面は `project.yaml` の `notifications.templates` に書き、Platform が審査して送る）。

| API | 書き方 |
|---|---|
| `client.notifications.requestPermission({ reason })` | **ボタンのタップの中から**呼ぶ（起動直後や裏で呼ぶと `FORBIDDEN`）。`reason` に何を知らせるかを書く（200 字まで）。返り値は選んだあとの状態 |
| `client.notifications.status()` | `granted` / `denied`（止めた）/ `default`（まだ聞いていない）。`granted` なら許可を求めるボタンを出さない |
| `client.notifications.openSettings()` | スーパーアプリのこのミニアプリの通知設定を開く（「通知の設定」のリンクに使う） |

`notifications.templates` の文面にパスワード・金額・個人情報を入れない（ロック画面に出る）。`path` はミニアプリ内の
相対パス（例: `/tasks/` に続けてパラメータ）だけ。pathがあるテンプレートには `app: reports` のように宣言済みweb Appのslugを必ず指定する。

送るきっかけは `project.yaml` の `notifications.triggers` に書く（Gateway が `/v1/db` の書き込みが確定した後に評価する）:

```yaml
notifications:
  triggers:
    - on: { model: task, op: update, when: { changed: assigneeId } }  # op は create / update / delete
      template: task_assigned
      to: { field: assigneeId }              # 宛先の User.id が入った列
      params: { assigner: "$actor.displayName", task: "$row.title", taskId: "$row.id" }
      except: actor                          # 自分の操作では自分に送らない
```

- `params` はテンプレートの `params` と同じ名前をすべて書く。値は `$row.<列>` / `$actor.id` / `$actor.displayName` か固定の文字列
- 発火するのは 1 行の `create` / `update` / `delete` だけ（`updateMany` 等では送らない）。`when.changed` は `update` だけ
- 許可していない人・匿名・送り手をブロックした人には届かない。1 人に 1 日 20 件まで。ブランチ（チャット）の環境では
  チャットの持ち主にだけ届く
- `$row.password` のような参照は静的検証が警告する
### 3.7 `client.workspaces` — 共有のスペース（家族・チーム・顧客ごと。`Workspaces`）

「家族で使う」「チームで共有する」データは Workspace に属させる（`$fdpocket-app-data-model` §1 の `workspace.members?[…]`）。
**Workspace と Membership を `client.db` で作らない**（Membership の create は既存の owner / admin だけに許されているので、
最初の 1 人を `client.db` では入れられない）。作成・招待・受諾は次の API を使う。

| やること | 書き方 |
|---|---|
| 作る（作った人が owner） | `client.workspaces.create({ name })` → `{ id, name }`。`project.yaml` の Role に `workspace.create` が要る |
| 招待する（owner / admin） | `client.workspaces.invite(workspaceId, { userId, role })`（この Project を使ったことのある人。User.id）か `{ accountName, role }`（スーパーアプリのアカウント名）。role は `admin` / `editor` / `viewer`（既定 `editor`） |
| 届いた招待を出す | `client.workspaces.invitations()` → `[{ invitationId, workspaceId, workspaceName, role, invitedByUserId, expiresAt }]` |
| 受ける / 断る | `client.workspaces.accept(workspaceId, invitationId)` / `decline(workspaceId, invitationId)` |

- 招待は**宛先の人を名指しする**。リンクを知っているだけでは参加できない（「招待リンクをコピー」は作らない）。7 日で切れる。
- 招待すると宛先のスーパーアプリに通知が届き、開くとこのアプリが開く。アプリの最初の画面で `invitations()` を見て、
  届いていれば「参加する / 断る」を出す。
- 失敗: Workspace の owner / admin でない → `FORBIDDEN`、居ない人・使えない人・ブロックし合っている人 → `NOT_FOUND`、
  既に招待済み・既にメンバー → `CONFLICT`、期限切れの受諾 → `NOT_FOUND`（`details.reason = 'expired'`）、匿名 → `FORBIDDEN`。
- メンバーの一覧・役割の変更・外すのは `client.db.membership`（owner / admin のポリシーのとおり）。

### 3.8 `client.ai` — ミニアプリ内 AI（`Ai`）

`capabilities.ai.chat` を宣言した web App から、Platform が用意する AI を呼ぶ。**費用は使った本人のクレジット**から
実際にかかった分だけ引く（所有者の財布からは引かない）。匿名の利用者は使えない。

| API | 書き方 |
|---|---|
| `client.ai.chat(input)` | 1 ターン送って結果を待つ。`input`（`AiChatInput`）: `conversation`（会話の名前。`[A-Za-z0-9_.:-]` で 64 字まで。同じ名前の履歴を Platform が持つ）・`message`・`attachments`（`[{ fileId }]`。Storage のファイル、4 個まで）・`instructions`（宣言した指示文の名前）・`schema`（宣言した Schema の名前。JSON で返させる）・`model`・`onToken`（渡すと届いた分から順に呼ぶ）・`signal`（待つのをやめる） |
| `client.ai.reset(conversation)` | 会話を切る（次のターンから履歴を送らない） |
| `client.ai.openai()` | OpenAI 互換の接続先（`OpenAiCompatible`: `baseURL`・`apiKey`・`fetch`）。Mastra・LangChain・Vercel AI SDK・OpenAI SDK にそのまま渡し、エージェント（ツール呼び出しのループ）・構造化出力・ストリーミングを作る。会話の履歴はフレームワークが持つ |

結果（`AiTurnResult`）: `text`・`json`（`schema` を指定し、正常に終わったときだけ）・`finishReason`（`AiFinishReason`。
`stop` は正常、`length` は出力の上限で切れた、`content_filter` は提供元が止めた、`other` はそれ以外）・
`credits`（このターンで引いたクレジット）・`responseId`・`model`（実際に使われたモデル）。

- `finishReason` が `length` なら「途中で切れた」と出す（`maxOutputTokens` を上げるか、短く頼む）。`text` を完成した答えとして扱わない。
- `signal` で止めても、始まったターンの費用は戻らない。
- 添付は画像・PDF・音声・動画。読めないファイルは `NOT_FOUND`、扱わない種類は `VALIDATION_FAILED`。
- 失敗は必ず画面に出す: 残高不足は `QUOTA_EXCEEDED`（`client.ui.openCredits()` を開くボタンを出す）、利用中のターンが
  ある・使いすぎは `RATE_LIMITED`、匿名・宣言の無い App は `FORBIDDEN`、AI のサービスの障害は `GATEWAY_UNAVAILABLE`。
  **AI が使えなくてもアプリの他の機能は使えるように作る**。
- AI を使う画面には「AI を使うとクレジットを消費します」と分かる表示を置く。
- 回数・同時に動かす数の制限は無い（エージェントのように続けて・並べて呼べる）。上限は払う人のクレジットだけ。
- api（サーバー）からは、利用者のリクエストを受けたときだけ、`asUser(request)` の戻り値の `ai`（同じ `chat` / `reset` /
  `openai()`）でその利用者として呼ぶ（`servicePermissions: [ai.chat]`。その利用者のクレジットから引く）。
- jobs からは、受け取った queue / scheduled のイベントを `createServerClient(...).forJob(event)` に渡し、`.ai.openai()` で呼ぶ
  （`servicePermissions: [jobs.consume, ai.chat]`）。払うのは、`asUser(request).jobs.schedule(...)` で**利用者として登録した
  ジョブならその利用者**、project.yaml の **cron なら Project の持ち主**。サーバーとして（`asUser` 無しで）登録したジョブは
  払う人がいないので `FORBIDDEN`。呼べるのは配送中の間だけ。jobs では `fdpocket-file:` を使えない（Storage から読んで data URL で渡す）。

`openai()` の要点（`model` は `auto`＝Jev Router か、project.yaml の `ai.model` / 許可一覧の ID）:

```ts
import { createOpenAI } from '@ai-sdk/openai'               // Mastra の Agent の model にも同じものを渡す
const fdpocket = createOpenAI(client.ai.openai())
const model = fdpocket.chat('auto')                          // Chat Completions（/responses ではない）

import { ChatOpenAI } from '@langchain/openai'
const { baseURL, apiKey, fetch } = client.ai.openai()
const llm = new ChatOpenAI({ model: 'auto', apiKey, configuration: { baseURL, fetch } })
```

- 使えるのは Chat Completions（`/chat/completions`）だけ。Responses API・Embeddings・画像生成は無い。
- Storage のファイルは画像・ファイル・音声・動画の場所に `fdpocket-file:<fileId>` と書く（read ポリシーで確かめて渡す）。
- 断られたときは OpenAI の形のエラー（本文の `error.code` が `SdkErrorCode`）。`402`（`QUOTA_EXCEEDED`）は再試行しない。
- 自分の API キーで外部の AI を呼ぶこともできる（`$fdpocket-app-integrations`。費用は作者持ち）。利用者に払ってもらうならこの `client.ai`。
- 作り方（宣言・指示文と Schema・画面で必ずすること・`kit dev` の本物と模擬の使い分け）は `$fdpocket-app-ai`。

## 4. エラー（`SdkError`）

SDK は失敗を `null` / `[]` で隠さず `SdkError` を投げる。メンバーは `code`（`SdkErrorCode`）/ `retryable` / `requestId` /
`status` / `details`（`VALIDATION_FAILED` のフィールド）/ `committed`（`POST_WRITE_READ_DENIED` のとき true）。
ユーザー向けの文言は持たない（`code` を見て App が利用者の言語で出す）。

| code | 意味 | App がすること |
|---|---|---|
| `UNAUTHENTICATED` / `SESSION_EXPIRED` | トークンが無い / 切れた | 埋め込みなら Host に任せる。直接なら案内を出す |
| `TOKEN_SCOPE_MISMATCH` | トークンが別の Project・App のもの | 作りの誤り。直す |
| `FORBIDDEN` | capability かポリシーで拒否（どちらかは返さない） | 権限が無い表示。admin を member で開くと正しくこれになる |
| `NOT_FOUND` | 無い、またはポリシー上見えない | 「見つからない」表示 |
| `VALIDATION_FAILED` | 入力が ZModel の制約に合わない | `details` で欄ごとに出す |
| `POST_WRITE_READ_DENIED` | 保存はできたが読み返せない | 失敗にしない |
| `CONFLICT` | 一意制約・競合 | 入力を直させる / 再試行（retryable） |
| `RATE_LIMITED` / `QUOTA_EXCEEDED` | 回数・容量の上限 | 待つよう伝える |
| `PAYLOAD_TOO_LARGE` | 上限超え | 小さくさせる |
| `CONSENT_REQUIRED` | 利用者がこのミニアプリにまだ同意していない | Host が同意画面を出す。App は待つ |
| `GATEWAY_UNAVAILABLE` | Gateway に届かない（フェイルクローズ） | 再試行の導線。読めたふりをしない |
| `HOST_UNAVAILABLE` | 埋め込まれていない | 直接アクセスの表示に切り替える |

## 5. データモデル（ZModel）

- 業務モデルは `packages/db-schema/schema.zmodel` に書く。入口はこのファイルで、`import "platform"` を消さない。
- **`platform.zmodel` は編集しない**（User・Workspace の基底・Membership・ProjectRole・RolePermission・UserProjectRole・
  AppUserState・StorageFile・StorageGrant・AuditEvent。`kit generate` が Kit の版に戻し、検証が差分を拒否する）。
- `model User with PlatformUser { … }` と `model Workspace with PlatformWorkspace { … }` に足せるのは**逆向きの relation だけ**
  （`tasks Task[]`）。`@@allow` / `@@deny` やほかのフィールドを足さない。
- **既定は拒否**。`@@allow` の無い操作は誰にもできない。ポリシーは次の 3 つの形だけで書く:
  `auth().id == ownerId`（本人）/ `workspace.members?[userId == auth().id]`（Workspace のメンバー）/
  `auth().permissions?[name == 'tasks.manage']`（Permission）。`has(auth().permissions, …)` は使えない。`auth().appSlug` を条件にしない。
- 所有者は `User` への relation、テナントは `Workspace` への relation で表す。
- **保護する列**（`ownerId` / `workspaceId` など、作った後に変えさせない列）は
  `@@allow('post-update', true)` と `@@deny('post-update', before().ownerId != ownerId)` を**対で**書く（deny だけでは拒否されない）。
- `User` への relation には `onDelete` を必ず書き、利用者を消したときに行をどうするかをモデルごとに決める: 本人だけのものは `Cascade`、共有されていて残すものは列を任意にして `SetNull`、法令・会計で残すものは `SetNull` に `@@platform.retain(reason: '…', days: N)` を付ける。`Restrict` / `NoAction` / `SetDefault` と書かないことは検証が拒否する（`USER_RELATION_ON_DELETE_*`）。
- 保持期間は本人のデータ消去時（複数User参照なら最後の参照を外す時）から数える。作成日時からは数えない。Platformが期限を管理し、他の利用者や子行から参照される行は削除を保留する。業務列の追加は期限を引き継ぎ、主キー・User参照が非互換になる変更は定期処理のエラーになる。期限が不明な行をAgentが推測で一括削除しない。
- 一覧になるモデルには並び順の列（`createdAt` と `id`）と、絞り込みの列 + 並び順の `@@index` を置く。
- 日時は `DateTime`（UTC で保存される）。

## 6. migration（`packages/db-schema/`）

| ファイル | 書く人 | 内容 |
|---|---|---|
| `schema.zmodel` | Agent | 正本 |
| `migrations/` | **Platform だけ** | 確定済み。ブランチで変えない・足さない |
| `pending/generated.sql` | `kit db diff` | このブランチの未確定の差分。手で書かない |
| `pending/intent.yaml` | Agent（破壊的な変更のときだけ） | 意図: `rename`（列の名前の変更）/ `drop`（消す）/ `retype`（型・NOT NULL・一意制約を変える）/ `contract`（公開の後に消す予約） |
| `pending/data.sql` | Agent（任意） | データの移し替え（埋め戻し・名前変更のコピー） |
| `seed.ts` | Agent | `kit dev` などの試用データ（本番では流れない） |
| `erase.test.ts` | Agent | 消去のテスト。動的検証が seed の後の新しい DB で流す（seed の利用者を 1 人 `erase` して、本人のデータが残らず他人のデータが壊れないこと） |

ZModel を変えたら `kit generate` → `kit db diff` → `pending/` と `packages/sdk/src/zenstack/` を commit。
`kit db diff` の `destructive: true`（列・表の削除、型の変更、NOT NULL 化、一意制約の追加、既定値の無い必須列の追加）なら
`pending/intent.yaml` を書き、データを移すなら `pending/data.sql` も書く。

```yaml
# pending/intent.yaml
- rename: { table: Task, from: title, to: name }
- drop: { table: Task, column: legacy }
- retype: { table: Task, column: priority, to: Int }
- contract: { table: Task, column: title }   # 公開中の版が使う列は今は残し、次の公開の後に消す
```

合流では Platform が、意図の無い破壊的な変更・どの変更にも当たらない意図を止め、影の DB（prod のスキーマ + 試用の行）で
行数と `rename` / `retype` の値が保たれるか、**公開中の版がまだ読めるか**を確かめる。公開中の版が読む列を消す・名前を
変える変更は 2 段に分ける: 今回は新しい列を足して両方に書く（expand。`data.sql` で埋める）、古い列は `contract` で予約する。

```ts
// packages/db-schema/seed.ts（型だけを import する。db はポリシーの無い client）
import type { ClientContract } from '@zenstackhq/orm'
import type { SchemaType } from '@workspace/sdk'

export default async function seed(db: ClientContract<SchemaType>) {
  const alice = await db.user.create({ data: { id: crypto.randomUUID(), globalUserId: 'seed:alice', displayName: 'Alice' } })
  // …
}
```

## 7. 上限

| 項目 | 値 |
|---|---|
| `take` | 既定 50・最大 200 |
| リクエストの本体 | 1 MiB |
| `createMany` | 500 行 |
| `include` の入れ子 | 深さ 3 |
| ファイル | 1 つ 5 GiB（100 MiB 超は Multipart） |
| バケット | 10 個 |
| 冪等キー | 10 分 |
| 署名 URL（ダウンロード） | 60〜300 秒 |

## 8. 依存とビルド

- npm の公開パッケージは足してよい（足す前に `$fdpocket-app-dependencies` の基準で調べる）。`package.json` に書いて `bun install` し、
  **`bun.lock` を commit する**。
- **git・URL・`file:` の依存は不可**（`kit build` が install の前に落とす）。`bun.lock` は npm レジストリの版 + integrity と `workspace:` だけ。
- **`bunfig.toml` を変えない**（`minimumReleaseAge`: 公開 7 日未満の版を解決しない / `ignoreScripts`: 依存の install スクリプトを動かさない）。
  `kit build` は `--frozen-lockfile --ignore-scripts` で入れるので、書き換えても効かない。
- `packages/miniapp-sdk/` と `packages/project-protocol/` は Kit が置く。編集しても Kit の版に戻る。
- ビルドは必ず `kit build`（`dist/<slug>/` と `dist/.artifact-index.json`）。Vite を直接動かした `dist/` は送れない。

## 9. 禁止事項

| 禁止 | 代わりに |
|---|---|
| ブラウザ（web App）から Gateway と `network.browser` 以外への `fetch` / `XMLHttpRequest` / `WebSocket` / `EventSource` | データは `client.db`、ファイルは `client.storage`。秘密が要る外部サービスは api / jobs から `network.egress` と `secrets` を宣言して呼ぶ（§2・`$fdpocket-app-integrations`） |
| 秘密の値をコード・manifest・`.kit/dev.vars` 以外のファイルに書く・web に渡す | 名前を `secrets` に宣言し、api / jobs の `env.<名前>` で読む。値は作者がアプリ管理画面で入れる |
| サーバーの資格情報（`env.PLATFORM_SERVICE_CREDENTIAL`）をブラウザへ返す・利用者の認可を迂回して `db` を使う | 利用者の操作は `asUser(request)` で、サーバー自身の処理だけをサービスの client で行う |
| `localStorage` / `sessionStorage` / `indexedDB` / Cookie にトークン・個人情報を置く | トークンは SDK がメモリに持つ。画面の好み（並び順など）だけは置いてよい |
| 外部 CDN の `<script>` / フォント / 画像の URL | npm の依存か、`apps/<slug>/public/` に同梱する |
| `eval` / `new Function` | 素直に書く |
| 生の SQL（`$queryRaw` / `$executeRaw`）・`$transaction` | `client.db` の操作 |
| `platform.zmodel` / `packages/sdk/` / `packages/miniapp-sdk/` / `packages/project-protocol/` / `migrations/` の手での編集 | 正しい手順（§5・§6） |
| **admin の権限を画面の条件分岐で代用する** | `requiredPermission` と ZModel のポリシーで守り、`client.auth.can` は表示だけ |
| 利用者が互いに送る自由入力を、通報・ブロックの手段なしに公開する | §3.5 の 3 つを入れる。入れられないなら公開範囲を Workspace に閉じる |

## 10. 掲載情報（`listing/`）

`listing/listing.json` の `title` / `tagline` / `description` / `category` / `tags` と、`listing/icon.png` / `listing/cover.png`。
初回は用途・表示名に対応する短い英語のURL名 `repositoryName` も付ける（`team-taskboard` など）。所有者内の重複だけPlatformが `-2`、`-3` と調整する。確定済み・手動変更済みのURL名は上書きしない。ランダム文字列・UUID・依頼文の切り出しを名前にしない。
`category` は次から 1 つ: `business` / `productivity` / `education` / `kids` / `community` / `tools` / `lifestyle` / `finance` /
`health` / `medical` / `entertainment` / `games` / `news` / `books` / `reference` / `music` / `photo_video` / `graphics_design` /
`food_drink` / `shopping` / `travel` / `navigation` / `sports` / `weather` / `developer_tools` / `other`。書き方は `$fdpocket-app-listing`。

`screenshots` はアプリ詳細のギャラリーに撮るページの宣言（`mobile` / `desktop` 各 5 枚まで。`{ app, path, as, caption, requested }`）。
画像は Platform が検証で公開物から撮る。利用者が指定したページ（`requested: true`）と作者のアップロードは Platform が残す。

`releaseNotes` は版の差分・実施した検証とその結果を記録する。未実施のテストや推測を確認済みと記載しない。作者メッセージはPlatformの別欄で扱う。

## 11. `build-report.json`

着地のターンに `./outputs/build-report.json` を書く。Platform は**申告**として扱い、中身は検証で確かめる。

```json
{
  "project": { "…": "infra/project.yaml をそのまま JSON にしたもの" },
  "apps": { "web": { "entry": "dist/web/index.html" }, "admin": { "entry": "dist/admin/index.html" } },
  "schemaVersion": "kit build の schema_version",
  "migrations": ["pending/generated.sql", "pending/data.sql"],
  "notes": ["実装できなかった要求・Skill と食い違った点・掲載情報を直した理由など（無ければ省く）"],
  "listingRequested": ["title"],
  "stage": "build",
  "policy_revision": 0
}
```

| 項目 | 内容 |
|---|---|
| `stage` | `"build"`（作った）/ `"concept"`（企画だけ。dist なし）/ `"reply"`（答えただけ）/ `"refused"`（規約で断った）/ `"settings"`（規約の設定だけ） |
| `listingRequested` | 利用者が手で直した掲載項目を、依頼どおりに変えたときだけ |
| `policy_revision` | 貢献ブランチで読んだ規約の revision、または設定ツールが返した revision |
| `migrations` | このブランチの `pending/` のファイル（無ければ空） |

## Realtime（DB変更・Broadcast・Presence）

`client.realtime` はPlatform管理のCloudflare Durable Objectsへ接続する。Supabase Realtimeへ直接接続しない。保存には従来の`client.db`を使う。Broadcastは一時メッセージ、Presenceは接続中の状態で、保存や切断中の再配信はしない。

```ts
const room = client.realtime.channel('document', { key: documentId })
  .on('db_changes', { model: 'message', event: '*' }, change => reloadMessages(change))
  .on('broadcast', { event: 'typing' }, ({ payload }) => showTyping(payload))
  .on('presence', { event: 'sync' }, () => showOnline(room.presenceState()))
  .subscribe((status, error) => {
    if (status === 'SUBSCRIBED') renderInitialRows(room.snapshot())
    else showConnectionStatus(status, error)
  })
await room.send({ type: 'broadcast', event: 'typing', payload: { active: true } })
await room.track({ editing: true })
// 画面から離れたら必ず解放する。
await room.unsubscribe()
```

DBのみの購読には`channel('changes')`を使う。モデルはmanifestの`realtime.models`、roomは`realtime.channels`へ宣言する。roomのjoin・受信・送信・presenceには既存のモデルポリシーによる権限を宣言し、公開channelを作らない。filterは`{ field, op, value }`、opはeq/neq/lt/lte/gt/gte/in、selectは列名配列。filterは認可の代用にならない。登録はsubscribe前に行う。1channel内では同じmodelのDB購読は1つまで。異なるfilterやselectで同じmodelを購読するときは別channelを作る。

`SUBSCRIBED`時の`snapshot()`は認可済みの初期行。INSERT/UPDATEの`new`は配送時の最新の認可済み投影で、変更時点の完全な行履歴ではない。DELETEはこの接続ですでに見えた行のキーだけを返し、`old`に過去の本文を期待しない。`RESYNC_REQUIRED`ならSDKが新しいticketで再接続し、認可済みsnapshotを取り直す。200行を超える初期snapshotは購読filterで対象を絞る。切断中のsend/trackは失敗し、自動再送しない。失効・権限拒否は停止し、通常の回線切断は新しいticketで再接続する。`removeChannel`・`removeAllChannels`でも解放できる。

Realtimeの公開型は次の契約を表す。`Realtime`はclient.realtime、`RealtimeChannel`はchannelの戻り値。`RealtimeChannel.untrack()`は自分の接続のpresenceを取り下げる。

| 型 | メンバー・意味 |
|---|---|
| `ChannelOptions` | `key`は対象行のキー、`broadcast.self`は自分への配送、`broadcast.ack`は受理確認 |
| `ChangeFilter` | `model`・`event`・`filter`・`select`による購読定義 |
| `BroadcastMessage` | `event`と任意JSONの`payload` |
| `PresenceState` | server発行のUserキーからconnection metasの配列への辞書。metaの`presence_ref`はserver発行の接続識別子 |
| `RealtimeSnapshot` | `model`と`rows`（認可された初期行の配列） |
| `RealtimeChange` | `eventId`は重複排除ID、`eventType`はINSERT/UPDATE/DELETE、`model`は対象、`primaryKey`はキー、`new`は最新投影、`old`は既定空または既知キー、`capturedAt`は取得時刻、`cursor`は再開位置、`dataMode`はcurrent/key_only |
| `RealtimeStatus` | SUBSCRIBEDは初期snapshot同期済み、TIMED_OUTは接続期限超過、CLOSEDは明示解除、CHANNEL_ERRORは失効・拒否・回線障害等。再接続後は新しいsnapshotでSUBSCRIBEDになる |
| `RealtimeSocketFactory` | テスト等で使うWebSocket生成関数。`ClientOptions.webSocket`に注入できる。通常のAppでは指定しない |

`SdkErrorCode.REALTIME_DISABLED`はmanifestや実行環境にRealtimeの宣言が無い。`SdkErrorCode.REALTIME_CAPACITY`は接続上限、`SdkErrorCode.RESYNC_REQUIRED`は取得位置や認可の変更によりsnapshotの再構築が必要な状態。SDKはRESYNC_REQUIREDで新しいticketを取得して再接続し、最新snapshotに置き換える。FORBIDDENでは再接続しない。
