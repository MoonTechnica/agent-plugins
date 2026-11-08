---
name: fdpocket-release
description: 自分のチャットのブランチを main へ取り込み（adopt_branch）、公開を依頼する（publish_project → get_publication）。取り込みは編集者（write 以上）、公開はオーナーとアプリの管理者だけ。呼ぶ前の必須チェック（check・push の ready・kit dev で全画面 App と権限の違い・DB と権限の変更・main の確認用環境・掲載情報・公開範囲）を省略せずに行い、利用者の明示的な了承を得てから呼ぶ。「main に取り込んで」「マージして」「公開して」「リリースして」のときに使う。adopt, merge into main, publish, release.
user-invocable: false
---

# main への取り込みと公開

作業ディレクトリ（`.fdpocket.json` のあるところ）で行う。`<kit>` は `.fdpocket.json` の `kit_root`。
手順・エラーの正本は **`<kit>/profile/instructions.md` §8.7**。

- 取り込み（A）は**アプリの編集者**（write のコラボレーター・管理者・オーナー）。DB・権限の変更を含むときは、取り込む人とチャットを書いた人の両方が管理者でないと `FORBIDDEN`（`policy_change_requires_admin`）。
- 公開（B）は**オーナーとアプリの管理者だけ**。write は `FORBIDDEN`（`not_project_admin`）。
  外部参加のブランチ（`requires_proposal`）は `$fdpocket-propose` で提案する。
- `adopt_branch` も `publish_project` も、**クライアントが利用者に確認を求める**。断られたらそれ以上押さない。
- **下の必須チェックは 1 つも省略しない。** 結果を利用者に報告し、会話で「取り込んでよい」「公開してよい」と明示的な了承を得てから呼ぶ。
  クライアントの確認ダイアログは了承の代わりにならない。問題が見つかったら呼ばずに直す。
- 投稿・削除・クレジット・チーム・通報、データ削除の確認（承認）は MCP には無い（制作画面で利用者が行う）。

## A. main へ取り込む（`adopt_branch`）

### 必須チェック（呼ぶ前に全部）

1. `node <kit>/scripts/kit.mjs check` が通り、`kit.mjs push` で送った版が `ready`、未解決の警告が無い。
2. 変更した**画面 App すべて**を `kit.mjs dev`（またはチャットのプレビュー）で動かした:
   各 App のホストを開く・主な流れ・App 間の移動（`ui.navigate`）・API の呼び出し・権限の違い（admin / member / 匿名）。コンソールにエラーが無い。
3. DB・権限の変更を読んだ: `packages/db-schema` の migration は意図どおりで、データを失わない。ZModel のポリシー・capability の変更を説明できる。
4. main に入るもの（差分の要約・リスク）を利用者に示し、会話で明示的に了承を得た。

### 呼ぶ

`adopt_branch({ project_id, session_id })`（`.fdpocket.json` の値）。いまの main とチャットの head を使う。

- `merged` / `already_merged` → `version_id`（main の版）と、main の配備が始まったことを伝える。公開はまだしない。
- `MERGE_CONFLICTS` → 取り込まれていない。`conflicts` のファイルをチャットのブランチで直す:
  `kit.mjs pull` → `git merge refs/remotes/fdpocket/heads/main` → 衝突を解く → `kit.mjs check` → commit → `kit.mjs push`（`ready` を待つ）→ チェック 1〜4 をやり直して呼び直す。
- `REVISION_CONFLICT` → 確かめたあとで main か head が進んだ。`get_project` で取り直し、確かめ直す。

## B. 公開する（`publish_project`）

### 必須チェック（呼ぶ前に全部）

1. 公開する版が **main にある**（A が終わっている）。main（確認用の環境。公開中とは別のデータ）で確かめた:
   各画面 App を `--{app}--main` のホストで開き、A と同じ流れを通した。
2. `get_project` の `listing.missing` が空。`get_publication` の `compatibility.reasons` に止める理由が無い（年齢区分・審査の条件。`REVIEW_REQUIRED` はサーバーが公開の途中で行う）。
3. 公開範囲 `app_access` を利用者に**明示的に聞いた**: `public`（だれでも）/ `restricted`（メンバーと招待した人だけ）。**確認なしに `public` にしない。**
4. データ削除の確認など人の判断が要るものは MCP で決めない。`publish_url` を示して止める。
5. 何を・だれに公開するかを示し、会話で明示的に了承を得た。

### 呼ぶ

`publish_project({ project_id, app_access })`（聞いた値。変えないなら省く）。掲載情報は版のまま送る。

その後 `get_publication({ project_id })` を数秒おきに見て `ended: true` まで待ち、結果を伝える:

- `succeeded` → 公開できた。
- `failed` / `stopped` → `error_code` と `error_detail` を伝える。直せるものは直して、チェックからやり直す。
- `needs_person: true`（`awaiting_review`。データ削除の確認）→ MCP では決めない。`publish_url` を利用者に示し、画面で判断してもらう。
