---
name: fdpocket-app-integrations
description: api / jobs の外部 API、秘密の名前、サーバー SDK、開発用モックを実装するときに使う。
---

# 外部サービス

## 外部アカウントのデータを使う場合

Google/Microsoft・Slack・Notion・Dropbox・Box・Salesforce・HubSpotの本人が接続したデータは `client.connections` を使う（spec.md §3.10）。`capabilities.connections` に対象サービスと `fdpocket-read` を宣言し、画面のタップから `request` → 許可後に `read`。OAuthフロー・Nangoキー・Provider tokenを生成コードで管理しない。APIからは本人の起動を引き継ぐ `server.asUser(request).connections.read` だけを使う。無人jobs/cronには個人接続を渡さない。一覧はcursorでページングし、実データを生成Agentやログへ自動投入しない。

## 独自の外部APIを使う場合

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

**登録されたジョブ**（api の `jobs.schedule`・python のタスクの `onFinish` と `ctx.jobs.schedule` から）は `queue(job, env, ctx)` で受ける。
`job` は `{ id, handler, payload, attempt, scheduledTime, noRetry() }`。jobs の App に `servicePermissions: [jobs.consume]`
を宣言する。失敗（例外）は最大 5 回まで再試行されるので、副作用は冪等にする（`job.id` を相手の冪等キーにする）。

```ts
import { createServerClient } from '@workspace/miniapp-sdk/server'
import type { SchemaType } from '@workspace/sdk'

export default {
  async queue(job, env, ctx) {
    const server = createServerClient<SchemaType>({ env })
    if (job.handler === 'afterCaption') {
      const caption = await server.db.caption.findUnique({ where: { id: job.payload.captionId } })
      // AI・python はこのジョブの払う人で呼ぶ（登録した利用者・python のタスクの払う人。サーバーとしての登録では使えない）
      const ai = server.forJob(job).ai.openai()
      // …外部 API に送る・通知する
    }
  },
}
```

登録は api なら `server.asUser(request).jobs.schedule({ app, handler, payload, idempotencyKey, runAt? })`
（その利用者が払う。`asUser` 無しの `server.jobs.schedule` は払う人がいないので、ジョブから AI・python を使えない）、
python のタスクの終わりは `project.yaml` の `onFinish`（Platform が登録する。中身は `{ runId, app, task, status, error }` で
`pythonRunFinishedSchema` で確かめ、出力は `server.forJob(job).python.get(runId)` で読む）、途中からは `ctx.jobs.schedule(...)`
（`$fdpocket-app-python`）。payload は JSON で 64 KiB まで、`runAt` は 30 日先まで。
ジョブは main / prod と本人のセッション環境で動く。セッションの schedule は自動の時刻実行ではなく、
開発者パネルの手動実行で確かめる。利用者・テスト主体の範囲を保ち、セッションの AI・GPU の費用はチャットの持ち主が払う。

web からAPIを呼ぶときはapiPathでAPI Appを明示する。現在の画面のBASE_URLではなくProject共通prefixを使い、ライブプレビューのtokenも維持する。

```ts
import { client, apiPath } from '@workspace/sdk'
const response = await client.fetch(apiPath('partner-api', '/example'))
```

`client.fetch` が利用者のトークンを添えるので、api は `asUser(request)` で受け取れる。

サーバーでは `@workspace/miniapp-sdk/server` の `createServerClient<SchemaType>({ env })` を使う（`SchemaType` は `@workspace/sdk` から型だけ import する）。`env.GATEWAY_URL` と `env.PLATFORM_SERVICE_CREDENTIAL` は Platform が渡す。ブラウザに渡さない。ユーザー操作を扱うときは server client の `asUser(request)` を使い、認可を迂回しない。

外部 API は `AbortSignal.timeout(5000)` などで期限を設ける。再試行は回数を制限し、429 / 一時的な 5xx だけをバックオフ付きで扱う。課金・送信などの操作には相手サービスの冪等キーを使う。Webhook はサービス公式の署名検証と時刻の検査を行い、検証前に DB の変更や通知をしない。受信本文をログに出さない。

手元だけの値は `.kit/dev.vars` に置く（git に入れない）。通常の `kit dev` の外部通信は、`network.mocks` に宣言した
host / status / headers / body の固定応答を使う。未宣言の応答を 200 の成功にせず **501** にするので、試す外部 API に必要な応答を用意する。
利用者の live は本物の環境で、権限に応じた `dev` secrets を Platform が渡す。手元の `.kit/dev.vars` は読まない。
外部参加者の権限を manifest やクライアントのヘッダーで昇格させない。

決済・メール・Push などの外部への副作用がある API は、E2E でも `network.mocks` で代えるのが既定。
本物でしか分からない読み取りだけを選び、先に `design/test-plan.md` に宛先・理由・副作用・期待結果・費用を書く（`$fdpocket-app-testing`）。
AI・GPU の実際の利用料はチャットの持ち主が払う。開発者パネルで外部通信・拒否・通知を確認し、秘密の値やテスト許可証をログに出さない。
`kit dev --trigger <app:handler>` は通常ローカルで宣言した schedule を 1 回実行して終了する。
