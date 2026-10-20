---
name: fdpocket-new
description: ミニアプリを手元の Coding Agent で新しく作り始める。Platform MCP（fdpocket）で App を作り、作業ディレクトリ（.tokoyo.json・git のリポジトリ source/）を用意し、kit new でテンプレートの Project を置く。まだ Platform に無いミニアプリを作るときに使う。new app, create, setup.
---

# 新しいミニアプリを作り始める

`<kit>` は Creator Kit の置き場で、この Skill のディレクトリの 2 つ上（`skills/fdpocket-new/` の上の上）。
分からなければ利用者に Kit の場所を聞く。git と Git LFS（`git lfs version`）・Bun・Node 22.12 以上が要る。無ければ入れてもらう。

1. **持ち主を決める**: `whoami()` の `accounts` がチームを含むなら、どのアカウント（個人かチーム）のアプリにするかを利用者に聞く。
   個人なら `owner_account_id` は省く。
2. **Project を作る**: `create_project({ title, owner_account_id? })` → `project_id` / `session_id` / `editor_url`。`title` は依頼から短く付ける。
3. **作業ディレクトリを作る**: 今のディレクトリの下に、題名を英数字にした新しいディレクトリを作って移り、
   `get_git_bundles({ project_id, session_id })` の結果の JSON をそのまま渡して `node <kit>/scripts/kit.mjs clone --bundles '<JSON>'`
   （`.tokoyo.json`・空の `source/`（git のリポジトリ）・`outputs/`・`AGENTS.md` ができる）。
4. **Project を置く**: `node <kit>/scripts/kit.mjs new --name <英小文字とハイフンの名前> --title <表示名>`（管理画面が要らなければ `--apps web`）
   → `source/` で `bun install` → `node <kit>/scripts/kit.mjs generate` → テンプレートのまま一度 `git commit`。
5. **画像を使うなら一度だけ** `node <kit>/scripts/kit.mjs login`（ブラウザで許可する。Git LFS の資格情報）。
6. **作る**: `<kit>/profile/instructions.md` を読み、その約束（§3 と §8）どおりに `source/` で作り、`kit.mjs dev` で確かめて `git commit` する。
7. **送る**: `$fdpocket-push`。送った版は制作画面（`editor_url`）で試せる。
