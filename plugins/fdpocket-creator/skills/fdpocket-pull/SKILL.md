---
name: fdpocket-pull
description: Platform にあるミニアプリを手元に取り込む（続きを作る・制作画面で進んだ版を取り込む）。Platform MCP（fdpocket）の get_app / get_git_bundles と Kit の CLI（clone / pull。手元は git のリポジトリ）を使う。app_id や制作画面の URL を渡されたとき、「続きを作って」「最新にして」のときに使う。pull, sync, continue.
---

# 手元に取り込む

`<kit>` は作業ディレクトリの `.tokoyo.json` の `kit_root`。まだ作業ディレクトリが無ければ、この Skill の
ディレクトリの 2 つ上（分からなければ利用者に Kit の場所を聞く）。git と Git LFS が要る。

1. **App を決める**: 渡された `app_id`（制作画面の URL なら `/create/<app_id>` の部分）。分からなければ
   `list_apps()` の一覧から利用者に選んでもらう。
2. `.tokoyo.json` または `get_app` で自分の session_id を確認し、`get_git_bundles({ app_id, session_id })` を呼ぶ（署名 URL は短命なので、すぐ次へ渡す）。
   `requires_proposal: true` なら返る `contribution_policy` を読む。以後の各編集依頼の前にも
   `get_contribution_policy({ app_id })` で最新を確認する。禁止事項・ガイドラインに抵触する依頼は
   該当の規約と理由を説明して編集を拒否し、素材生成・commit・push は行わない。取得失敗時も作業を止める。
3. **取り込む**: その App の `.tokoyo.json` があるディレクトリなら `node <kit>/scripts/kit.mjs pull --bundles '<JSON>'`。
   無ければ新しいディレクトリを作って移り、`node <kit>/scripts/kit.mjs clone --bundles '<同じ JSON>'`。
   `pull` は commit していない変更があると断るので、先に `git commit` する（`<kit>/profile/instructions.md` §8.3 / §8.4）。
4. 結果の `status` が `conflict` なら、示されたファイルの衝突を解き `git add` → `git rebase --continue`（§8.4）。
   `packages/db-schema/pending/generated.sql` は解かずに `kit.mjs db diff` で作り直す。
5. 取り込んだら `source/` で `bun install` → `node <kit>/scripts/kit.mjs generate`（同梱の SDK と型を Kit の版にそろえる）。
6. **参照を許可された最新の main だけを自分のブランチへ取り込む**: `main` が返る場合だけ行う（一般参加者には公開済みの版だけが渡される）。
   main は `refs/remotes/tokoyo/heads/main` に fetch される。自分のブランチの上で `git merge refs/remotes/tokoyo/heads/main` し、
   衝突を解いて commit し、build・push で検証し直す。fetch しただけではブランチの head・push の base・公開版は置き換わらない。
7. **公開版を参照する**: `main` が null で `reference` が返る場合、`reference.ref_name`（`refs/releases/<version_id>`）は公開済みの版のスナップショット。
   fetch 済みの `refs/remotes/tokoyo/releases/<version_id>` は参照用で、自分のブランチを置き換えない。未公開の main やそのプレビューは求めない。
