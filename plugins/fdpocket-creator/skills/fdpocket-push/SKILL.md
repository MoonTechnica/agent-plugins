---
name: fdpocket-push
description: 手元で作ったミニアプリを Platform に送る。git で commit し、Kit の CLI で kit build → outputs/ の 3 点（source.bundle・dist.tar.gz・build-report.json）を作って検査し、Platform MCP（fdpocket）の begin_build → アップロード（LFS → 3 点）→ submit_build → get_build で下書きにする。「送って」「push して」「試せるようにして」のときに使う。push, submit, upload, build.
---

# Platform に送る

作業ディレクトリ（`.tokoyo.json` のあるところ）で行う。MCP の `project_id` には `.tokoyo.json` の `app_id` を渡す。`<kit>` は `.tokoyo.json` の `kit_root`。
手順・結果の扱い・エラーは **`<kit>/profile/instructions.md` §8.3〜§8.5 が正本**。要点:

貢献ブランチでは最初に `get_contribution_policy({ project_id })` で最新の禁止事項・ガイドラインを取得し、
依頼と差分全体の遵守を確認する。抵触する場合は該当規約と理由を述べて送信を拒否する。
その `revision` を `begin_build` / `submit_build` の `policy_revision` に渡す。
`CONTRIBUTION_POLICY_CHANGED` は規約を取り直して遵守を再確認する。規約の取得失敗では送信しない。

1. `source/` の変更を `git commit` する（未 commit の変更があると `pack` が断る。作者は `kit.mjs clone` が設定した本人のまま）。
2. `node <kit>/scripts/kit.mjs build` で `source/dist/` を作り（Vite を直接動かさない）、`outputs/build-report.json` を書く（spec §11。
   `schemaVersion` は build の `schema_version`）。
3. `node <kit>/scripts/kit.mjs pack` → 出力の JSON（`session_id` / `files` / `commit_oid` / `base_commit_oid` / `kit_version` / `kit_revision`）。
4. `node <kit>/scripts/kit.mjs check` が通るまで直す（直したら commit して 2. からやり直す）。
5. `begin_build`（project_id と pack の session_id が必須。`message` は利用者向けの 1 行、`request_key` は新しい UUID、
   `commit_oid` / `base_commit_oid` / `files` は `pack` の出力のまま）
   → `kit.mjs upload --urls '<upload_urls の JSON>'`（LFS の実体を先に上げる。資格情報が無いと言われたら `kit.mjs login`）
   → `submit_build({ job_id })` → `get_build({ job_id })` を 3 秒ごとに `ready` / `failed` / `cancelled` まで（10 分で打ち切り、利用者に状態を伝える）。
6. `ready` かつ `landed: true` なら **`node <kit>/scripts/kit.mjs open --url <editor_url>` で制作画面をブラウザに開く**（この会話で最初の `ready` のときだけ。
   開けない環境では `opened: false` になるだけ。`open` がエラーで終わっても止まらない）。開けたかどうかに関わらず、**`editor_url` を返事の最後に目立つ形で毎回示す**。
   そのあと `$fdpocket-pull` で取り込み直す（次の push の base になる）。
   `STALE_BASE` は `kit.mjs pull`（= `git pull --rebase`）してから 2. から（§8.4）、ほかのエラーは §8.5。公開・投稿は制作画面で利用者が行う。
