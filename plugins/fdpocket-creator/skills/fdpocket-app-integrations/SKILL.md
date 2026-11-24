---
name: fdpocket-app-integrations
description: api / jobs、利用者のデータを扱うバックグラウンド処理、外部 API、秘密、開発用モックを実装するときに使う。
---

# API・バックグラウンド処理・外部サービス

## 完了条件で処理を選ぶ

| 必要な動き | 使う機能 |
|---|---|
| 画面から依頼し、API の応答までに利用者のデータを処理する | api の `asUser(request)` で DB・Storage・AI を使う |
| 補助的な計測など、短い処理を応答後に続ける | 同じ API Worker の `ctx.waitUntil(task)` に処理の Promise を渡す。HTTP Worker の猶予は最大 30 秒。中断しても主要な操作が成立する処理に使う |
| 受付後も独立して処理する、画面を閉じても続ける、再試行や予約が要る | FDPocket の `jobs.schedule` と `queue`。利用者として登録し、保存データに触れる jobs App に `jobs.data` を宣言する |
| 決まった時刻に定期実行する | `schedules` と `scheduled`（UTC cron） |
| GPU や Python のライブラリが必要な処理を依頼する | Python タスクを使う（`$fdpocket-app-python`）。必要なら本人の権限で `ctx.db` / `ctx.storage` を使い、保存した `runId` で状態を取得する |

次の操作に処理結果が要らないときは、受付が済んだら利用者が先に進めるようにする。実行方式は、画面を閉じた後に続ける必要や、
進捗の保存・再試行の要否で選ぶ。重い処理を待つ画面では、結果に依存する箇所だけで進捗を示す。

処理時間で一律に決めず、受付から切り離して引き受けるべき仕事は `jobs` に回す。名刺や書類の取り込み、要約、翻訳、分類、
外部サービスへの送信などに使える。キューの設定・配送は Platform が担当する。業務データと利用者に見せる処理結果はミニアプリの DB に置く。
外部 AI の待ち時間だけを理由に Modal を追加しない。

1. API で `asUser(request)` を使い、利用者の権限で対象を確かめる。対象の ID と安定した `idempotencyKey` を渡して
   `jobs.schedule` を待つ。受付済みの ID を対象とひもづけ、利用者にはその時点で受付を返す。
2. jobs で `createServerClient({ env }).forJob(job)` を使う。本人の資料を AI に渡すなら `fdpocket-file:<fileId>`、
   ファイルの内容が必要なら `storage.download`、状態や結果には `db` を使う。元の画面 App の宣言と本人の現在の権限が適用される。
   再試行では `job.id` に対応する保存済みの結果を確認する。同じ仕事が届いても更新先が一意になるように DB の一意キーを使い、
   送信先が提供する冪等キーにも `job.id` を含める。複数の副作用があるなら操作ごとにキーを分ける。
3. 画面では対象ごとに受付・処理中・結果・失敗を表示する。次の取り込みはすぐに続けられ、終わったものから確認できる。
   遅い処理中にも別の操作ができること、別の利用者の資料が拒否されること、再配送しても保存が重複しないことを確かめる。

毎週の集計や毎朝の取り込みは `project.yaml` の `schedules` と `scheduled(event, env, ctx)` を使う。
同じ回の再試行で結果や通知が重複しないように、`event.scheduledTime` と処理名に対応する一意キーを使う。
利用者との会話では「何を何時に行うか」と結果をどこで確認できるかを伝える。

## 外部アカウントのデータを使う場合

Google/Microsoft・Slack・Notion・Dropbox・Box・Salesforce・HubSpotの本人が接続したデータは `client.connections` を使う（spec.md §3.10）。`capabilities.connections` に対象サービスと `fdpocket-read` を宣言し、画面のタップから `request` → 許可後に `read`。OAuthフロー・Nangoキー・Provider tokenを生成コードで管理しない。APIからは本人の起動を引き継ぐ `server.asUser(request).connections.read` だけを使う。無人jobs/cronには個人接続を渡さない。一覧はcursorでページングし、実データを生成Agentやログへ自動投入しない。

## 独自の外部APIを使う場合

`infra/project.yaml` の api / jobs に `network.egress`（HTTPS のホスト名）、`secrets`（名前・説明・required）を宣言する。値は作者がアプリ管理画面で設定する。秘密をコードや manifest に書かない。ブラウザで使ってよい公開 API だけ web の `network.browser` に HTTPS オリジンを宣言する。

api は `src/index.ts` で `export default { fetch(request, env, ctx) {} }` を公開する。Worker は `nodejs_compat` で動き、
`node:async_hooks`・`node:crypto` などの Node の組み込みも使える。動的 import も 1 ファイルにまとまる。
jobs は用途に応じて `queue` や `scheduled` を default export のオブジェクトに置く。定期実行の `schedules` は UTC cron と handler 名を持つ。

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

ジョブの `forJob(event)` は実行中のジョブとして API を呼ぶために使う。DB・Storage には、本人として登録したジョブ、
宛先の `jobs.data`、Platform が渡した現在の配送資格が要る。予約の時点で payload 内の ID へのアクセスも確認する。
ユーザートークンを payload に入れず、配送資格はログ・DB に残さない。Workspace はクエリで絞り、Gateway のポリシーで守る。

登録は api なら `server.asUser(request).jobs.schedule({ app, handler, payload, idempotencyKey, runAt? })`
（その利用者が払う。`asUser` 無しの `server.jobs.schedule` は払う人がいないので、ジョブから AI・python を使えない）、
python のタスクの終わりは `project.yaml` の `onFinish`（Platform が登録する。中身は `{ runId, app, task, status, error }` で
`pythonRunFinished.wire` で確かめ、出力は `server.forJob(job).python.get(runId)` で読む）、途中からは `ctx.jobs.schedule(...)`
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
