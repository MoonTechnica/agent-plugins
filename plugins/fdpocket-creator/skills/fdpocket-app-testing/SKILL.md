---
name: fdpocket-app-testing
description: ミニアプリが動くことを確かめる。Vitest で書くテストの対象、kit dev（開発用 Host ページ・主体の切り替え・FORBIDDEN が正しい場面・起動し直す場面）、kit check の項目、kit build の結果（artifact_hash・apps・vite_warnings）の読み方。データと画面ができたときと、着地の前に使う。
---

# 確かめる

## 1. Vitest（純ロジックだけ）

- 対象: 計算・変換・入力の検証・日付の扱い・状態の遷移など、画面と通信を持たない関数（`apps/<slug>/src/lib/*.ts` に置く）。
- 書かないもの: 部品の描画のテスト、SDK を丸ごと置き換えたテスト、実装をなぞるだけのテスト。
- `apps/<slug>` で `bunx vitest run`（Vitest はテンプレートの依存にある）。

## 2. ローカルの smoke（`kit dev`）

`node <kit>/scripts/kit.mjs dev [--as member|admin|anonymous]` はローカル libSQL（`.kit/dev.db`）、
ファイル置き場（`.kit/objects/`）、モックの Gateway と Worker、各 App の Vite で動く。**Node は 22.12 以上**。
本物の DB・Storage・外部 API の動作を確かめたことにはならない。

| 場所 | 中身 |
|---|---|
| `http://localhost:4320` | 通常の開発用 Host ページ。App とテスト主体を切り替える |
| 起動ログにある各 App の URL | 本番と同じ bridge で App を開くローカルの画面 |


- `member` は `defaultRoles`、`admin` は `ownerBootstrap` の Role を持つ**テスト利用者**。admin でも本人のアカウントではない。
  `anonymous` も匿名のテスト主体。追加の主体は `seed.ts` の `testIdentities` に宣言する。
- admin を member で開くと、必要な `requiredPermission` が無ければ `FORBIDDEN` が正しい。
- 起動時に migration と pending を当て、DB を初期化したときだけ seed の計画を使う。通常のローカル dev の SQL や seed を
  変えて作り直すと、そのローカル試用データは消える。本物の session DB の通常の再開では seed を再投入しない。
- 通常のローカル確認で ZModel を変えたときは `kit generate` の後に通常 dev を起動し直す。
  利用者の live は watcher が同期するので、この理由で再起動しない。
- UI ファイルは HMR。古い画面が残るときは、まず通常 dev のログと生成されたルートを確認する。

**確かめること**（smoke）:

1. Host ページと各 App が開く（HTTP 200）。起動ログ・ブラウザのコンソールにエラーが無い。
2. web を member で開き、主な流れ（`design/brief.md`）を 1 回通す: 作る → 一覧に出る → 直す → 消す。
3. 一覧で 21 件目以降が「もっと見る」で出る（seed で 20 件以上入れておく）。
4. admin を member で開くと `FORBIDDEN`、admin で開くと開く。
5. 匿名を許していない App を anonymous で開くと開かない。
6. スマホ幅（ブラウザの幅を 390px 前後）で崩れない。
7. 全対応言語で主要画面・入力案内・空状態・エラー・確認ダイアログ・`aria-label`が翻訳される。
   現在のKitのHost言語は`?locale=ja` / `?locale=en`で確認できる（既存クエリがあれば`&locale=`）。
   追加言語はアプリの共通ロケール解決・翻訳処理でも確認する。地域付きタグ、未対応ロケール、翻訳キー欠落時の既定言語へのフォールバックを検証する。
   日付・数値・通貨の書式、長い翻訳や文字量の違いによるスマホ幅の崩れも確認し、入力済みの利用者データを翻訳や言語切り替えで書き換えない。
   i18n実装は、辞書と対応言語設定の追加で言語を増やせるかも確認する。依頼の返信言語だけをi18n対応済みの根拠にしない。

## 3. 本物のセッション環境で確かめる

| 確認すること | 方法 |
|---|---|
| 計算・変換・入力の検証 | Vitest |
| 画面の表示・主要な操作・権限の無い主体で admin が開けないこと | 通常のローカル `kit dev` |
| 本物の Gateway のポリシー、Worker の外部 API、Realtime、Python GPU、Storage の署名 URL・R2 Multipart | 本物の live に対する E2E |

本物で実行する前に `design/test-plan.md` を書く。必要な観測、ローカルでは確かめられない理由、App・テスト主体、
期待する結果、外部への副作用と `network.mocks`、実際に呼ぶ読み取りの理由、AI・GPU の費用を記録する。
実行後には成功・失敗、実際に本物を使った範囲、モックした範囲、未確認のことを書く。ローカルだけの成功を本物の成功と書かない。

```bash
node <kit>/scripts/kit.mjs e2e --live --as member
node <kit>/scripts/kit.mjs e2e --live --as admin --app admin --test design/e2e.ts
```

`--live` と `--as` は必須。`--app` を省くと `web`、無ければ最初の web App を使う。
`--test` は source 内の相対パス。省略時は `design/e2e.ts` があれば実行し、無ければ接続・表示の smoke だけを行う。
シナリオは TS / JS の default export として書く。`page` は実際の Playwright Page、`frame` は接続した App の Frame。
期待と違えば例外にして失敗させる。シナリオの引数に許可証やセッショントークンは渡らない。

```ts
export default async ({ frame }) => {
  const heading = frame.getByRole('heading', { name: '一覧', exact: true })
  await heading.waitFor({ state: 'visible' })
}
```

引数にはほかに `page` / `app` / `identity` / `environmentId` がある。単なる接続 smoke の成功を、業務操作や権限制御まで確認した結果としない。
HAR・storageState・trace・スクリーンショットは自動保存しない。結果は秘密を除いて計画へ追記する。

### 許可証とテスト主体

- `KIT_TEST_GRANT` は現在の環境・ターンに束縛された許可証。プロセスの環境だけで扱う。
  終了・取消・失敗・期限切れ・別環境の許可証は使えない。許可証が無ければ実行を止める。
- 選べるのは予約主体 `admin` / `member` / `anonymous` と `seed.ts` で宣言した slot。
  発行されるのはそのテスト利用者のトークンだけで、本人のトークンは使わない。
- 本人としてログインする、`KIT_LIVE` の値や保存済みセッションで代用する、トークンを手作りする回避はしない。
- 許可証・トークンを `.env`、`.kit/`、テスト計画、ログ、最終返答に書かない。Playwright の `storageState` をファイルへ保存しない。
  ヘッダー・認証 URL・HAR・trace に秘密を記録しない。テスト結果には必要な観測と安全なエラーだけを残す。

### 副作用と費用

- 決済・メール・Push などの副作用がある外部 API は、`network.mocks` の固定応答で代えるのが既定。
  モックの無い宛先は成功扱いにせず 501 になる。失敗を握りつぶさず、必要な応答を宣言する。
- 本物の外部サービスで確かめるのは、副作用の無い読み取りを既定とする。その必要性と宛先を計画に書く。
  外部参加者のモックの制限を、コードやヘッダーで解除しない。
- DB・Storage のテスト主体は架空でも、実際に呼ぶ AI・GPU の費用は**チャットの持ち主**が払う。
  必要な範囲と回数に絞り、課金を避けるために本人トークンへ切り替えたり別の支払い元を指定したりしない。
- 受理済みの非同期処理はテスト時のモックの区分を保つ。ターン終了や許可証の期限切れだけで、受理済みの処理まで取消済みと報告しない。

## 4. `kit check`

`node <kit>/scripts/kit.mjs check`。落ちたら終了コード 2 と理由（標準エラー）。Plugin の hook も送信の前に同じものを走らせる。

| 項目 | 落ちたら |
|---|---|
| `infra/project.yaml` の形 | 理由のパスを直す |
| `platform.zmodel` / 同梱の SDK（`packages/miniapp-sdk/`・`packages/project-protocol/`）が Kit の版か | `kit generate` で戻す |
| `bun.lock`（npm レジストリの版 + integrity と `workspace:` だけ） | git・URL・`file:` の依存を外して `bun install` |
| `migrations/` が取り込んだ版から変わっていない | 変更を戻す（`git checkout <base> -- packages/db-schema/migrations`） |
| `pending/generated.sql` が最新 | `kit db diff` → commit |
| 型（`apps/<slug>/tsconfig.json` のある App を `tsc -b`。`TYPE_ERROR` に場所が付く） | 型の誤りを直す。SDK の API の使い方の誤り（例: `client.python.run()` を `await` せずに `.wait()`）もここで落ちる。`// @ts-ignore` や `any` で黙らせない |

通っても Platform 側の検証（取り込み・静的・画面を開く動的検証）は必ず走る。

## 5. `kit build`

`node <kit>/scripts/kit.mjs build` は lockfile の検査 → 同梱物を置く → `bun install --frozen-lockfile --ignore-scripts` → `kit generate` →
web の App ごとに Vite → `dist/<slug>/` と `dist/.artifact-index.json`。結果の JSON:

| 項目 | 読み方 |
|---|---|
| `artifact_hash` | 全 App の中身のハッシュ（同じソースなら同じ値） |
| `schema_version` | ZModel から作ったスキーマのハッシュ（`build-report.json` の `schemaVersion` に写す） |
| `apps` | App ごとのファイル数・大きさ・ハッシュ |
| `warnings` | project.yaml の注意（匿名の書き込みなど）。意図していなければ直す |
| `vite_warnings` | Vite の警告。500 kB を超えるチャンク・解決できない import は直す（大きな依存を足していないか見直す） |

`dist/` は `kit build` だけが作る。Vite を直接動かした・後から書き換えた `dist/` は `pack` が断る。

## 手元のセッション接続

本物のセッション DB・AI・Python が必要なら `$fdpocket-dev` に従い `kit dev --connect`。
Host で利用者が明示的に同意し、本人または宣言済みの主体だけで試す。通常の `kit dev` はローカルのモック。
`--ai` による別の AI 接続は使わない。接続中の変更は未 push の作業ツリーであり、公開版・main・built と混同しない。
