---
name: fdpocket-app-testing
description: ミニアプリが動くことを確かめる。Vitest で書くテストの対象、kit dev（開発用 Host ページ・主体の切り替え・FORBIDDEN が正しい場面・起動し直す場面）、kit check の項目、kit build の結果（artifact_hash・apps・vite_warnings）の読み方。データと画面ができたときと、着地の前に使う。
---

# 確かめる

## 1. Vitest（純ロジックだけ）

- 対象: 計算・変換・入力の検証・日付の扱い・状態の遷移など、画面と通信を持たない関数（`apps/<slug>/src/lib/*.ts` に置く）。
- 書かないもの: 部品の描画のテスト、SDK を丸ごと置き換えたテスト、実装をなぞるだけのテスト。
- `apps/<slug>` で `bunx vitest run`（Vitest はテンプレートの依存にある）。

## 2. `kit dev`

`node <kit>/scripts/kit.mjs dev [--as member|admin|anonymous]` は本番と同じ Gateway を Node で起動し、ローカルの libSQL（`.kit/dev.db`）・
ファイル置き場（`.kit/objects/`）・各 App の Vite（web 5173 / admin 5174）で全 App を動かす。**Node は 22.12 以上**（Vite 8 の要件）。

| 場所 | 中身 |
|---|---|
| `http://localhost:4320` | **開発用 Host ページ**。本番の Host と同じ bridge でトークンを渡して App を開く。上で App と主体（member / admin / anonymous）を切り替える |
| `http://{name}-{id の 10 桁}.localhost:5173/` | Project のオリジン（本番と同じ形）。web は `/`、admin は `/admin/`。起動ログに出る |

- 主体: `member` は `defaultRoles` の Role、`admin` は `ownerBootstrap` の Role（作者の代わり）、`anonymous` は匿名。
- **admin を member で開くと `FORBIDDEN` になって App が開かないのが正しい**（`requiredPermission` を持たないため）。開いてしまったら守りが壊れている。
- 起動時に `kit db diff` を回し、`migrations/` → `pending/generated.sql` → `pending/data.sql` を当てて DB を作る。当てる SQL か `seed.ts` が
  変われば作り直し（試したデータは消える）、作ったときだけ `seed.ts` を流す。`seed.ts` が失敗したら起動しない（エラーを読んで直す）。
- **ZModel を変えたら `kit generate` の後に `kit dev` を起動し直す**（型と DB が古いまま）。project.yaml を変えたときも起動し直す。
- 画面のファイルは HMR で反映される。ページを丸ごと読み直して古い画面が出たら起動し直す（TanStack Router の `autoCodeSplitting` の既知の問題）。

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

## 3. `kit check`

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

## 4. `kit build`

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
