---
name: fdpocket-pull
description: Platform にあるミニアプリを手元に取り込む（続きを作る・制作画面で進んだ版を取り込む）。Platform MCP（fdpocket）の get_project / get_git_bundles と Kit の CLI（clone / pull。手元は git のリポジトリ）を使う。project_id や制作画面の URL を渡されたとき、「続きを作って」「最新にして」のときに使う。pull, sync, continue.
user-invocable: false
---

# 手元に取り込む

`<kit>` は作業ディレクトリの `.fdpocket.json` の `kit_root`。まだ作業ディレクトリが無ければ、この Skill の
ディレクトリの 2 つ上（分からなければ利用者に Kit の場所を聞く）。git が要る。

1. **Project を決める**: ID またはリポジトリの URL を `resolve_project({ reference })` へ渡し、返る `project_id` を使う。制作画面の URL は ID を含むとは限らないので解析せず、分からなければ `list_projects()` の `items` から利用者に選んでもらう。`next_cursor` があれば `list_projects({ cursor })` で続きを取得する。
2. `.fdpocket.json` の `project_id` が MCP の `project_id`。自分の session_id は既存の `.fdpocket.json`、`get_project({ project_id })` の `session_id`、または `resolve_project` の `my_branches` から選ぶ。貢献のブランチ（`resolve_project` / `get_project` が `requires_proposal: true`）なら
   `get_contribution_policy({ project_id })` で規約を読む。以後の各編集依頼の前にも
   `get_contribution_policy({ project_id })` で最新を確認する。禁止事項・ガイドラインに抵触する依頼は
   該当の規約と理由を説明して編集を拒否し、素材生成・commit・push は行わない。取得失敗時も作業を止める。
3. **取り込む**: その App の `.fdpocket.json` があるディレクトリなら `node <kit>/scripts/kit.mjs pull`。
   無ければ新しいディレクトリを作って移り、`node <kit>/scripts/kit.mjs clone --project-id <project_id> --session-id <session_id>`。
   どちらも Kit が `get_git_bundles` を呼ぶ（初回だけブラウザでログインの許可を求められる）。
   `pull` は commit していない変更があると断るので、先に `git commit` する（`<kit>/profile/instructions.md` §8.3 / §8.4）。
4. 結果の `status` が `conflict` なら、示されたファイルの衝突を解き `git add` → `git rebase --continue`（§8.4）。
   `packages/db-schema/pending/generated.sql` は解かずに `kit.mjs db diff` で作り直す。
5. 取り込んだら `source/` で `bun install` → `node <kit>/scripts/kit.mjs generate`（同梱の SDK と型を Kit の版にそろえる）。
6. **参照を許可された最新の main だけを自分のブランチへ取り込む**: `main` が返る場合だけ行う（一般参加者には公開済みの版だけが渡される）。
   main は `refs/remotes/fdpocket/heads/main` に fetch される。自分のブランチの上で `git merge refs/remotes/fdpocket/heads/main` し、
   衝突を解いて commit し、build・push で検証し直す。fetch しただけではブランチの head・push の base・公開版は置き換わらない。
7. **公開版を参照する**: `main` が null で `reference` が返る場合、`reference.ref_name`（`refs/releases/<version_id>`）は公開済みの版のスナップショット。
   fetch 済みの `refs/remotes/fdpocket/releases/<version_id>` は参照用で、自分のブランチを置き換えない。未公開の main やそのプレビューは求めない。
