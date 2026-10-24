---
name: fdpocket-app-python
description: GPU が要る AI の処理（深層学習の推論・学習・埋め込み・画像や音声の変換）や、PyTorch・transformers など Python のライブラリが要る処理を、python の App として作るときに使う。費用は依頼した利用者のクレジット。
---

# python の App（GPU の AI 処理）

`kind: python` の App は Platform の Modal の Sandbox（GPU・gVisor・外への通信は `network.egress` だけ）で動く（spec §2・§3.9）。
**費用は秒単位の実費**: タスクは依頼した利用者（画面・`asUser`）かジョブの払う人、HTTP サーバーの時間は Project の持ち主のクレジット。

## 1. 使うかどうか

| 頼まれたこと | 作り方 |
|---|---|
| 画像の生成・変換、音声の文字起こし・合成、埋め込み、分類・検出のモデル、小さな学習（LoRA など） | python の App の**タスク**（§3） |
| 何度も呼ぶ推論で、モデルを読み込んだまま待たせたい（チャットの応答を流す・続けて速く返す） | python の App の **server**（§4）。待っている間も持ち主に費用がかかるので、タスクで足りるならタスク |
| 文章の要約・下書き・分類・チャット | `client.ai`（`$fdpocket-app-ai`）。GPU を自分で動かさない |
| JS で書ける処理・軽い集計 | api / jobs（`$fdpocket-app-integrations`）。python の App を足さない |
| GPU の結果を受けて、外部 API・通知・集計など TypeScript の処理を続ける | タスクに `onFinish` を宣言して jobs で受ける（§5） |

api / jobs（TypeScript の Worker）と python は 1 つの Project に一緒に置け、DB・Storage を共有する。**呼べる向きは決まっている**:
画面・api・jobs → python（`python.run`）、python → jobs（`onFinish`・`ctx.jobs`）。python から api の App は呼べない
（要るデータは python から `ctx.db` / `ctx.storage` で直接読み書きする）。

**DB・Storage は依頼した利用者として**読み書きする（cron から始まった実行は Project の持ち主）。その人の権限と ZenStack の
ポリシーに加え、python の App にも使うモデル・バケットを宣言する（宣言できるのは `models` と `buckets` だけ）:

```yaml
  vision:
    kind: python
    capabilities:
      models: { caption: [read, create], dataset: [read] }
      buckets: { datasets: [read], models: [write] }
```

宣言に無い操作・利用者が見られない行やファイルは `FORBIDDEN` / 見つからない扱い。他の利用者のデータをまとめて処理したいときも
ポリシーを緩めない（その人自身に依頼してもらうか、admin の利用者が依頼する）。

## 2. 宣言と GPU の選び方

- `compute.gpu` は必要なときだけ書く（省略は CPU だけ）。目安: 小さな推論・埋め込みは `T4` / `L4`、
  7〜13B 級や SDXL は `L40S` / `A100-40GB`、大きなモデル・学習は `A100-80GB` / `H100`。迷ったら小さいほうから。
- `timeoutSeconds` は実際にかかる時間の 2〜3 倍（既定 600 秒）。長い学習は進み具合を `ctx.progress` で出す。
- 重みは **`cache: true` の `/cache`** に置く（初回に取得して置き、2 回目からは読むだけ。`ctx.cache_dir`）。
  Hugging Face なら `network.egress: [huggingface.co, "*.hf.co"]` と、要るなら `secrets: [{ name: HF_TOKEN }]`。
  `/cache` は作り直せるものだけ（利用者のデータは DB と Storage）。
  合わせて **50 GiB・50,000 個まで**。超えると Platform が空にする（次に使うときは最初から取得し直す）。
  小さなファイルを大量に置かない（データセットは 1 つのアーカイブにまとめる）。
- `dist/<slug>/` に入るのはソース・設定・小さなデータだけ。重みや大きなファイルを commit しない。

## 3. タスク

```python
# apps/vision/src/vision/tasks.py
from functools import cache

@cache
def model(cache_dir):                       # 同じ Sandbox の中では 1 回だけ読む
    from transformers import pipeline        # 重い import は関数の中
    return pipeline("image-to-text", model="Salesforce/blip-image-captioning-base",
                    model_kwargs={"cache_dir": str(cache_dir)})

def caption(ctx, input):
    ctx.progress(0.1, "loading")
    image = ctx.storage.download(input["fileId"])   # 依頼した利用者として読む（小さなファイルだけ）
    text = model(ctx.cache_dir)(to_image(image))[0]["generated_text"]
    return {"text": text}                   # JSON にできる値だけ
```

- 例外はそのまま投げる（Platform が `failed` と型名・メッセージを記録する。SDK の `FdpocketError` は型名ではなくその理由のコードになる）。握りつぶして成功を返さない。
- 入力・出力は 256 KiB まで。大きい結果は Storage に置き、`fileId` を返す。
- GPU のタスクは Modal が途中で止めることがあり、そのときは Platform が**最初から**やり直す（全部で 3 回まで。止められた回は利用者に請求されない）。同じ入力で 2 回動いても困らないように書く（外部への送信・DB への追加は最後に 1 回、`ctx.run_id` を冪等キーにする）。数十分を超える学習は `ctx.cache_dir` にチェックポイントを書き、起動時に続きから始める。3 回とも止められると `error.code` が `preempted` になるので、画面は再依頼を案内する。
- 画面は `const run = await client.python.run(...)` のあと `await run.wait({ onProgress })` で待ち（`run()` は Promise。`await` せずに `.wait` を続けると `wait is not a function`）、進み具合と失敗（`error`）を必ず出す。
  失敗は作り手・利用者が**次に何をすればよいか分かる言葉**で出す（`FdpocketError` のような型名やコードだけを出さない）。
  `error.code` で分岐して App の辞書の文を出し、知らないコードは「処理に失敗しました。もう一度試してください」に `error.message` を添える。
  `NOT_AVAILABLE_IN_DEVELOPMENT`（プレビューで python から DB・Storage を使った）は `error.message` をそのまま出す
  （「プレビューでは、python の処理から保存したデータやファイルは使えません。『この変更を採用』で取り込んでから試してください」の日英の文）。

### 大きなデータ（教師データ）と学習

- **受け取り**: 利用者は画面から Storage に上げる（`client.storage.from('datasets').upload(file)`。1 ファイル 5 GiB まで、
  100 MiB を超えれば SDK が自動で分割して送る）。大きなデータセットは **数百 MB〜数 GB のファイルに分けて**持つ
  （Parquet・WebDataset・JSONL のシャード。並列に読め、失敗してもファイル単位でやり直せる）。
- **渡し方**: タスクの入力は 256 KiB までなので、データは `fileId` の一覧で渡す（多ければ DB にデータセットの行を作り、
  その id を渡して python から `ctx.db` でファイルの一覧を読む）。
- **読み方**: 大きなファイルに `storage.download()` を使わない（全部をメモリに読む）。ディスクへ流し込む:

  ```python
  def train(ctx, input):
      data = ctx.cache_dir / "datasets" / input["datasetId"]      # cache: true なら 2 回目は落とさない
      files = ctx.storage.download_all(input["fileIds"], data)     # {fileId: Path}。同時 4 本
      ...
      ckpt = ctx.cache_dir / "checkpoints" / ctx.run_id             # 途中停止からの再開用
      weights = save_model(ckpt)                                    # 重みのファイルのパス
      file = ctx.storage.upload("models", "model.safetensors", weights, "application/octet-stream")
      return {"modelFileId": file["id"]}                            # 結果は fileId で返す
  ```

  1 ファイルなら `ctx.storage.download_to(fileId, path)`。`/cache` に置くのは作り直せるものだけで、合わせて 50 GiB まで
  （超えるデータは `/tmp` に落とす。Sandbox のディスクは 512 GiB で、実行が終わると消える）。
- **保存**: `storage.upload(bucket, name, data, content_type)` の `data` はファイルのパスでもよい（100 MiB を超えれば
  分割して送り、全体をメモリに載せない）。重みのような大きな結果は必ずパスで渡す。
- GPU・時間の目安: 学習は `A100-80GB` / `H100`、`timeoutSeconds` は最大 86,400（24 時間）。より長い学習は
  チェックポイントで区切り、`onFinish` の jobs から続きのタスクを依頼する。

## 4. server

`server: { handler: "vision.server:app" }` の ASGI の app（FastAPI など）を `/api/vision/*` で受ける。
依存に `uvicorn` を足す。利用者は Platform が確かめてから届き、トークンは `X-Fdpocket-Authorization`:

```python
from fastapi import FastAPI, Request
from fdpocket import Client
from fdpocket.asgi import user_token

app = FastAPI()
gateway = Client.from_env()

@app.post("/generate")
def generate(request: Request, body: dict):
    me = gateway.as_user(user_token(request.headers))   # その利用者として DB・Storage を呼ぶ
    ...
```

要求が無い時間が `idleTimeoutSeconds` を超えると止まり、次の要求で起き直す（起動に数十秒。その間は 503 と Retry-After）。

台数は `maxInstances`（既定 1・最大 10）まで、1 台あたりの同時の要求の平均が `targetConcurrency`（既定 4）を超えると Platform が足す。どの台も Project の持ち主が払うので、利用者が多いと分かっているときだけ増やす。GPU 1 枚で同時に捌ける数（バッチの大きさ・メモリ）に合わせて `targetConcurrency` を決める。台ごとに別の Sandbox なので、状態はメモリに持たず DB・Storage・`/cache` に置く（同じ利用者の次の要求が別の台に届くことがある）。

## 5. 終わりを TypeScript で受ける（python → jobs）

GPU の処理は数分〜数時間かかる。api / jobs で `run.wait()` して待ち続けると Worker の時間を使い切るので、
**依頼はすぐ返し（`runId` を自分の行に残す）、終わりは `onFinish` で jobs に受ける**。成功も失敗（例外・時間切れ・
残高不足・キャンセル・途中停止を使い切った `preempted`）も、タスクのコードが落ちても Platform が必ず 1 回届ける。

```yaml
# infra/project.yaml
apps:
  api:    { kind: api,    servicePermissions: [python.run] }
  vision:
    kind: python
    python: "3.12"
    servicePermissions: [jobs.schedule]                 # onFinish・ctx.jobs に要る
    tasks:
      caption:
        handler: "vision.tasks:caption"
        onFinish: { app: batch, handler: captionDone }   # 終わったら batch の queue に届く
  batch:  { kind: jobs,   servicePermissions: [jobs.consume, ai.chat, python.run] }
```

```ts
// apps/api/src/index.ts — 依頼して runId を残し、すぐ返す（その利用者が払う）
const run = await server.asUser(request).python.run('vision', 'caption', { fileId })
await server.asUser(request).db.captionRequest.create({ data: { fileId, runId: run.runId } })
```

```ts
// apps/batch/src/index.ts — 中身は { runId, app, task, status, error }。出力は python.get で読む
import { createServerClient, pythonRunFinishedSchema } from '@workspace/miniapp-sdk/server'

export default {
  async queue(job, env, ctx) {
    if (job.handler !== 'captionDone') return
    const done = pythonRunFinishedSchema.parse(job.payload)
    const server = createServerClient<SchemaType>({ env })
    const asJob = server.forJob(job)                    // AI・python はタスクの払う人のまま
    if (done.status !== 'succeeded') {
      // done.error.code: 例外の型名か理由（preempted / insufficient_credits / timed_out / cancelled …）
      // …失敗を記録・通知する
      return
    }
    const run = await asJob.python.get(done.runId)      // 出力（1 MiB まで）
    // …外部 API・通知など。失敗は再試行されるので done.runId を相手の冪等キーにする
  },
}
```

- **途中から続きを渡す**ときは `ctx.jobs.schedule("batch", "progressed", {...}, idempotency_key=f"progressed:{ctx.run_id}")`。
  失敗では呼ばれないので、終わりの通知の代わりにしない。payload は JSON で 64 KiB まで（大きいものは DB か Storage に置き id を渡す）。
- 定期 jobs は main / prod で動く。セッション環境では開発者パネルから手動実行する。Python の `onFinish` は実行を受け付けた環境の jobs に渡る。
  手元の `kit dev` は CPU タスクの終わりを手元の jobs に渡す。接続したセッションでは通常の認証済み Gateway と同じ DB / Storage / jobs を使う。
- 受け手の書き方は `$fdpocket-app-integrations` の「登録されたジョブ」（`queue(job, env, ctx)` と `job.handler`）。

## 6. 依存と確かめ方

- `apps/<slug>/pyproject.toml` に依存を書き、`uv lock` で `uv.lock` を作って commit する（`httpx` は消さない）。
  `kit check` が pyproject・uv.lock・handler・依存・宣言していない secret と宛先を確かめる。
- `kit dev` の既定: 手元は CPU で `uv run` がタスクとサーバーを動かす（費用は引かない。uv が要る）。
  本物の GPU は `$fdpocket-dev` の `kit.mjs dev --connect`、生成ターンでは Platform の `kit dev --live` で確かめる。
  通常の Project Gateway を通して自分のセッションの DB / Storage と連携し、チャット所有者のクレジットを使う。
  古い転送用の鍵・OAuth token を設定ファイルやブラウザーへ渡さない。
- 自己テストの繰り返しは CPU（小さなモデル。GPU の有無を torch で確かめて device を切り替える）で、
  GPU でしか確かめられないこと（速度・メモリ・大きなモデル）だけを本物で試す。
- 宣言（`project.yaml`）と依存は版に固定される。Image は依存が変わった版の初回だけ作り直す（数分かかる）。
