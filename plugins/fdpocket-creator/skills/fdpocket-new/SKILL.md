---
name: fdpocket-new
description: ミニアプリを手元の Coding Agent で新しく作り始める。Platform MCP（fdpocket）で App を作り、作業ディレクトリ（.tokoyo.json・git のリポジトリ source/）を用意し、kit new でテンプレートの Project を置く。まだ Platform に無いミニアプリを作るときに使う。new app, create, setup.
user-invocable: false
---

# 新しいミニアプリを作り始める

`<kit>` は Creator Kit の置き場で、この Skill のディレクトリの 2 つ上（`skills/fdpocket-new/` の上の上）。
分からなければ利用者に Kit の場所を聞く。

0. **準備を確かめる**: `node <kit>/scripts/kit.mjs doctor`。`ok: false` の項目は `fix` のとおり利用者に直してもらう
   （Node 22.12 以上・git・Git LFS・Bun。`kit` が古いと出たら更新を勧める）。

1. **持ち主を決める**: `whoami()` の `accounts` がチームを含むなら、どのアカウント（個人かチーム）のアプリにするかを利用者に聞く。
   個人なら `owner_account_id` は省く。
2. **Project を作る**: `create_project({ title, owner_account_id? })` → `project_id` / `session_id` / `editor_url`。`title` は依頼から短く付ける。
3. **作業ディレクトリを作る**: 今のディレクトリの下に、題名を英数字にした新しいディレクトリを作って移り、
   `node <kit>/scripts/kit.mjs clone --project-id <project_id> --session-id <session_id>`
   （Kit が `get_git_bundles` を呼ぶ。最初の一度だけブラウザでログインの許可を求められる。
   `.tokoyo.json`・空の `source/`（git のリポジトリ）・`outputs/`・`AGENTS.md` ができる）。
4. **Project を置く**: `node <kit>/scripts/kit.mjs new --name <英小文字とハイフンの名前> --title <表示名>`（管理画面が要らなければ `--apps web`）
   → `source/` で `bun install` → `node <kit>/scripts/kit.mjs generate` → テンプレートのまま一度 `git commit`。
5. **作る**: `<kit>/profile/instructions.md` を読み、その約束（§3 と §8）どおりに `source/` で作り、`kit.mjs dev` で確かめて `git commit` する。
6. **送る**: `$fdpocket-push`。送った版は制作画面（`editor_url`）で試せる。
