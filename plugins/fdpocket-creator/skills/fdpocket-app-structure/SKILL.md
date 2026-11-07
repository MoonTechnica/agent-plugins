---
name: fdpocket-app-structure
description: ミニアプリ（Project = モノレポ）の構造を守る。共有コードの置き場（packages/）、App を足す手順、共有 package の作り方（名前・exports・workspace:*）、使う側の package.json への依存の宣言、App 間 import の禁止、kit check の構造エラー（UNDECLARED_DEPENDENCY / APP_IMPORTS_APP / PACKAGE_IMPORTS_APP / CROSS_PACKAGE_RELATIVE_IMPORT）の直し方。App や package を足す・複数の App でコードや部品を共有する・別の App の部品を使いたい・admin や api / jobs を足すときに使う。
---

# モノレポの構造を守る

Project は 1 つのモノレポで、`apps/*`（動く単位）と `packages/*`（共有する部品）でできている。
次の 4 つを守る。**破ると `kit check` が構造エラーで止める**（取り込みの静的検証も同じ検査をする）。

1. **使う package は、使う側の `package.json` に宣言する。** 宣言していない import は、他の package が入れた依存が
   たまたま見えて動いてしまい、あとで壊れる。
2. **package の境界を `../` で越えない。** 他の package は `@workspace/<name>` で import する。
3. **App は別の App に依存しない。** 共有したいコードは `packages/` に出す。
4. **package は App に依存しない。** 依存は `apps/*` → `packages/*` の一方向（`packages/*` 同士も循環させない）。

## 1. どこに置くか

| 書くもの | 置き場 |
|---|---|
| 1 つの App だけの画面・部品・ロジック | `apps/<slug>/src/`（画面は `routes/`、その App だけの部品は `components/`、純ロジックは `lib/`） |
| 複数の画面 App で使う UI の部品（shadcn） | `packages/ui/src/components/`（`$fdpocket-app-ui`） |
| 複数の App（画面・api・jobs）で使う型・検証・計算・文言の辞書 | 新しい共有 package（`packages/<name>`。§3） |
| データモデル・ポリシー・migration・seed | `packages/db-schema/`（`$fdpocket-app-data-model`）。生成物は `packages/sdk/` |
| Kit が置くもの | `packages/miniapp-sdk/` `packages/project-protocol/` `packages/fdpocket-py/` `packages/sdk/src/zenstack/` は**編集しない**（spec §9） |

- **最初は使う App の中に書く。** 2 つ目の App が同じコードを要るようになった時点で、共有 package に出す
  （形が読めないうちに共通化しない）。
- 共有 package は **1 つの目的**に絞る（`packages/shared` に何でも入れない。`packages/validation` `packages/i18n` のように）。
- api / jobs は Worker で動く。api / jobs からも使う共有 package は、`window` `document` や React に依存させない。
  画面専用の部品は `packages/ui`（画面 App だけが依存する）に置く。
- 依存は、使う App / package の `package.json` に書く（ルートの `package.json` に足して済ませない）。足す前の調べ方は `$fdpocket-app-dependencies`。

## 2. 依存の宣言と import

```jsonc
// apps/web/package.json（使うものを全部ここに書く）
{
  "dependencies": {
    "@workspace/sdk": "workspace:*",
    "@workspace/ui": "workspace:*",
    "@workspace/validation": "workspace:*",
    "react": "19.3.0"
  }
}
```

```ts
import { parseTaskInput } from '@workspace/validation'          // ✅ package の名前で
import { parseTaskInput } from '../../../packages/validation/src/task' // ❌ 他の package のファイルを ../ で触る
import { parseTaskInput } from '../../admin/src/lib/task'       // ❌ 別の App から
```

- 同じ Project の package は `"workspace:*"`、npm の package は完全な版（`^` を付けない。`$fdpocket-app-dependencies`）。
- 宣言を足したら `source/` の根で `bun install` し、`bun.lock` を commit する。
- `@/` で始まる App 内の別名と、`node:` `cloudflare:` `virtual:` の指定子は宣言が要らない。

## 3. 共有 package を作る

1. `packages/<name>/package.json` を作る。手本は `packages/sdk/package.json`。

   ```json
   {
     "name": "@workspace/<name>",
     "version": "0.0.0",
     "private": true,
     "type": "module",
     "exports": { ".": "./src/index.ts" },
     "dependencies": {}
   }
   ```

   - `name` は `@workspace/` を付けて、Project の中で重複させない。
   - **`exports` に入口を書く。** 使わせたい入口だけを出す（`"./task": "./src/task.ts"` のように必要な分だけ）。
     何でも再輸出する `index.ts` は作らない。
   - この package が import するものは、この `package.json` の `dependencies` に書く。
2. `packages/<name>/tsconfig.json` は `packages/sdk/tsconfig.json` を写す。コードは `packages/<name>/src/`。
3. 使う App の `package.json` に `"@workspace/<name>": "workspace:*"` を足す（§2）。
4. `bun install` → `node <kit>/scripts/kit.mjs generate` → `node <kit>/scripts/kit.mjs check`。

## 4. App を足す

管理画面（`$fdpocket-app-admin`）・api / jobs（`$fdpocket-app-integrations`）・python（`$fdpocket-app-python`）が要るときに、同じ Project に App を足す。
`kit new` は最初の 1 回だけなので、すでにある Project には次の手順で足す。

1. **slug を決める**: 2〜32 文字。英小文字で始め、英小文字・数字を 1 つの `-` でつなぐ（`--` と末尾の `-` は不可）。
   任意の名前でよい（1 つの Project に 1〜16 個）。画面 App の slug に `api` は使えない（API のパスに予約）。
   `main` と `s-` + 16 進 12 桁も使えない（App のホスト名の環境の印に重なる）。
2. **ファイルを作る**
   - 画面（web）: 既存の画面 App を `apps/<slug>/` に写す。無ければ `<kit>/templates/project/apps/web/` を写す。
     `package.json` の `name` を slug にし、`vite.config.ts` の `createAppConfig("<slug>", …)` の slug も直す。
   - api / jobs（`kit new` が作る最小の形）:

     ```jsonc
     // apps/<slug>/package.json
     {
       "name": "<slug>",
       "private": true,
       "type": "module",
       "dependencies": { "@workspace/miniapp-sdk": "workspace:*", "@workspace/sdk": "workspace:*" },
       "devDependencies": { "vite": "8.3.3", "typescript": "6.0.3" }
     }
     ```

     `tsconfig.json` は既存の api / jobs の App を写す（無ければ `target: ES2023`・`module: Preserve`・`moduleResolution: Bundler`・
     `lib: [ES2023, WebWorker]`・`strict: true`・`noEmit: true`・`include: [src]`）。`src/index.ts` は api なら
     `export default { async fetch() { … } }`、jobs なら `export default { async scheduled() {} }`。中身の書き方は `$fdpocket-app-integrations`。
3. **`infra/project.yaml` の `apps` に宣言する**（`kind`、capability、`access`。spec §2）。宣言の無い App は配られない。
4. `bun install` → `node <kit>/scripts/kit.mjs generate` → `node <kit>/scripts/kit.mjs check`。

## 5. `kit check` の構造エラー

| code | 意味 | 直し方 |
|---|---|---|
| `UNDECLARED_DEPENDENCY` | `package.json` に無い package を import している | 使う側の `package.json` に宣言して `bun install`。workspace の package は `"workspace:*"` |
| `APP_IMPORTS_APP` | App が別の App を import している | 共有するコードを `packages/<name>` に出し、両方の App が `@workspace/<name>` で import する |
| `PACKAGE_IMPORTS_APP` | package が App を import している | package に必要なコードを package 側へ移し、App が package を import する |
| `CROSS_PACKAGE_RELATIVE_IMPORT` | `../` で自分の package の外のファイルを import している | `@workspace/<name>` で import し、`package.json` に宣言する。入口が `exports` に無ければ足す |
| `PACKAGE_JSON_INVALID` | `package.json` が JSON として読めない | 構文を直す |

- 構造エラーは**検査を無効にして通さない**。指定子を `eval` や文字列の組み立てで隠さない。
- 直したら `node <kit>/scripts/kit.mjs check` をもう一度実行し、エラーが無いことを確かめてから commit する。

## 6. 画面の App はそれぞれ自分のオリジンを持つ

画面の App は App ごとに別のオリジン（`{project}--{slug}.{apps-domain}`）で配られ、どれもそのオリジンの `/` に置かれる。

- **別の App へ相対パスでリンクしない**（`<a href="/admin/">` や `navigate({ to: '/admin/' })` は自分の App の中のルートになる）。
  別の App を開くときは SDK の `client.ui.navigate({ app: '<slug>', path: '/…' })` を使う。
- **App の間で localStorage・sessionStorage・IndexedDB・Cookie を共有しない**（オリジンが違うので見えない）。
  App をまたいで残したいものは DB（`$fdpocket-app-data-model`）に置く。
- 同じ Project の `api` / `python` の App は、どの画面 App からも同じ相対パス `/api/<slug>/` で呼べる（CORS は書かない）。
