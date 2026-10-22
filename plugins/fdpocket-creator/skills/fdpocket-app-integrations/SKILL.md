---
name: fdpocket-app-integrations
description: api / jobs の外部 API、秘密の名前、サーバー SDK、開発用モックを実装するときに使う。
---

# 外部サービス

`infra/project.yaml` の api / jobs に `network.egress`（HTTPS のホスト名）、`secrets`（名前・説明・required）を宣言する。値は作者がアプリ管理画面で設定する。秘密をコードや manifest に書かない。ブラウザで使ってよい公開 API だけ web の `network.browser` に HTTPS オリジンを宣言する。

api は `src/index.ts` で `export default { fetch(request, env, ctx) {} }`（Worker は `nodejs_compat` で動き、`node:async_hooks`・`node:crypto` などの Node の組み込みも使える。動的 import も 1 ファイルにまとまる）、jobs は `export default { scheduled(controller, env, ctx) {} }` を公開する。jobs の `schedules` は UTC cron と handler 名を持つ。

jobs の scheduled は `controller.handler` で manifest の handler 名を選ぶ。非同期処理は return / await するか `ctx.waitUntil()` に渡す。再試行しても復旧しない失敗だけ `controller.noRetry()` で止める。

```ts
export default {
  async scheduled(controller, env, ctx) {
    if (controller.handler === 'dailyDigest') await sendDigest(env)
  },
}
```

web からAPIを呼ぶときはapiPathでAPI Appを明示する。現在の画面のBASE_URLではなくProject共通prefixを使い、ライブプレビューのtokenも維持する。

```ts
import { client, apiPath } from '@workspace/sdk'
const response = await client.fetch(apiPath('partner-api', '/example'))
```

`client.fetch` が利用者のトークンを添えるので、api は `asUser(request)` で受け取れる。

サーバーでは `@workspace/miniapp-sdk/server` の `createServerClient<SchemaType>({ env })` を使う（`SchemaType` は `@workspace/sdk` から型だけ import する）。`env.GATEWAY_URL` と `env.PLATFORM_SERVICE_CREDENTIAL` は Platform が渡す。ブラウザに渡さない。ユーザー操作を扱うときは server client の `asUser(request)` を使い、認可を迂回しない。

外部 API は `AbortSignal.timeout(5000)` などで期限を設ける。再試行は回数を制限し、429 / 一時的な 5xx だけをバックオフ付きで扱う。課金・送信などの操作には相手サービスの冪等キーを使う。Webhook はサービス公式の署名検証と時刻の検査を行い、検証前に DB の変更や通知をしない。受信本文をログに出さない。

手元だけの値は `.kit/dev.vars` に置く（git に入れない）。`kit dev` の外部通信は宣言した宛先への 200 モックであり、本物のサービスを呼ばない。ライブプレビューと検証では手元の値を読まない。開発パネルで外部通信・拒否・通知を見る。`kit dev --trigger <app:handler>` は宣言した schedule を 1 回実行して終了する。
