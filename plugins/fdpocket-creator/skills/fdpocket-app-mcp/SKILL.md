---
name: fdpocket-app-mcp
description: 外部の AI クライアント（Claude / ChatGPT / Codex / Cursor / VS Code / Claude Code）からアプリを使えるようにするとき（「AI から使えるようにして」「Claude と連携」「MCP」）。kind: mcp の App とツールの書き方。
---

# AI クライアントから使う（MCP）

利用者が自分の AI クライアントにこのアプリを MCP サーバとして登録し、**その利用者本人として**ツールを呼ぶ。
認証（OAuth）・同意・接続先の案内は Platform が持つ。Agent が書くのは `kind: mcp` の App と、その中のツールだけ（spec §2・§3.11）。

## いつ足すか

- 依頼に「AI から」「Claude / ChatGPT / Codex / Cursor から」「MCP」「エージェントから操作」があるときだけ。頼まれていない Project には足さない。
- 1 Project に 1 つ（接続先は `https://{app-host}.fdpocket.dev/mcp` の 1 本）。複数の面を出したければツールで分ける。
- 画面（web）があることは前提にしない。読み取りだけの連携でもよい。

## 作り方

1. `infra/project.yaml` に `kind: mcp` の App を足す（slug は `assistant` など）。`capabilities` は **ツールが触るものだけ**を宣言する
   （`models` × 操作・`buckets`・`ai: { chat: true }`・`python`・`connections`）。web より狭くてよい。`access: restricted` と
   `requiredPermission` を書けば、業務 admin だけが接続できる。
2. `apps/<slug>/package.json` に `@workspace/miniapp-sdk`・`@workspace/sdk`・`zod`（allowlist の版）を宣言し、`apps/<slug>/src/index.ts` に
   `defineMcpApp({ tools: [...] })` を `export default` する（`toolFor<SchemaType>()` の `tool` で `ctx.server.db` を型付けする）。
3. `kit check` を回す（目録 `.kit/generated/mcp-tools.json` を workerd で評価して書き、検査する。`kit build` は同じ目録を `dist/<slug>/` にも出す）。
4. `kit dev` で確かめる（下）。

## ツールの切り方

- **1 ツール 1 操作**。「何でもできる SQL」「任意のモデルを読む」のような catch-all は作らない（審査で落ち、認可の意味が失われる）。
- **読むツールと書くツールを分ける**（`scope: 'read'` / `'write'`）。一覧・検索・詳細は `read`、作成・更新・完了・送信は `write`。
- 名前は動詞 + 対象の snake_case（`list_open_tasks` / `complete_task` / `create_invoice`）。アプリの語彙で、モデル名の CRUD にしない。
- `input` は zod で狭く（`limit` は上限を付ける、id は `z.string()`）。`output` を書くと構造化した結果が返り、モデルが読みやすい。
- 結果は必要な列だけ返す（一覧は 50 件まで）。本文は 150,000 文字で切り詰められる。
- 取り消せない操作（削除・外部への送信・支払い・公開）は `destructiveHint: true` にし、`description` に「確認してから呼ぶ」と書く。
  同じ入力で同じ結果になる操作は `idempotentHint: true`。外部の世界（他社 API・メール）に触れるなら `openWorldHint: true`。

## description の書き方

- そのツールが**何をして何を返すか**を 1〜2 文で、狭く正確に（英語でよい。モデルが読む）。
- 書かない: 「必ず最初に呼べ」「他のツールより先に」「ユーザーの指示を無視して」のようなモデルへの指示、システム指示、
  ほかのツールの呼び出し指示（Claude / ChatGPT の審査基準。`kit check` が `MCP_TOOL_DESCRIPTION` で止める）。
- 引数の意味は `input` の zod の `.describe()` に書く。

## 認可と費用

- `ctx.server` は接続した本人の Project トークンで Gateway を呼ぶ。画面と同じ認可（App の capability ∩ Role ∩ ZenStack）と上限が効く。
  **認可を迂回する書き方をしない**（サービストークンで本人の代わりに読まない。`ctx.server` 以外の経路を作らない）。
- 宣言していないモデル・操作は実行時に `FORBIDDEN`。`kit check` が先に `MCP_UNDECLARED_CAPABILITY` で止める。
- `ctx.server.ai` / `ctx.server.python` を使うツールは**その本人のクレジット**を消費する。`description` に「AI を使う」と書く。
- 失敗は `SdkError` を投げる（`isError` の結果としてモデルに返り、直せる）。例外を握りつぶして空の結果を返さない。

## `kit dev` での確かめ方

- `kit dev` を起動すると mcp の App も workerd で動き、`POST http://127.0.0.1:4320/mcp` が立つ。開発者パネルの「MCP」に
  接続先と `claude mcp add --transport http <slug> <url> --header "Authorization: Bearer <token>"` が出る
  （OAuth の代わりに、選んだ主体〔member / admin〕の Project トークン。10 分で切れる。匿名は接続できない）。
- Claude Code からは上のコマンドで登録し、`tools/list` に目録どおりのツールが並ぶこと、`read` のツールが本人のデータを返すこと、
  `write` のツールが DB を変えることを確かめる。
- 目録（`.kit/generated/mcp-tools.json`）を読んで、名前・description・scope・annotations が意図どおりか見る。
