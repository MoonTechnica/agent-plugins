---
name: tokoyo-proposals
description: 自分の TOKOYO.games のゲームに届いた提案（Pull Request）を読み、コメントし、修正を依頼し、採用の準備をして採用するか、見送る。Platform MCP（tokoyo）の list_proposals / get_proposal / get_proposal_inputs / comment_proposal / request_proposal_changes / merge_proposal / accept_merge_candidate / close_proposal と git を使う。「届いた提案を見て」「PR をレビューして」「採用して」「修正を依頼して」のときに使う。review, adopt, maintainer.
---

# 届いた提案を読んで決める

作業ディレクトリ（自分のゲームの `.tokoyo.json` のあるところ。**同じゲームを clone してある**こと。無ければ `$tokoyo-pull`）で行う。
手順・エラーの正本は **`<kit>/profile/instructions.md` §8.6**。利用者には「採用」「制作中のゲーム」「同じ部分に別の変更」の言葉で話す。

1. `list_notifications({ unread_only: true })` の `proposal_opened` / `proposal_commented` / `proposal_resubmitted`、または
   `get_app({ app_id })` の `proposals.incoming_open_count` → `list_proposals({ app_id, status: "open" })`。
2. `get_proposal({ proposal_id })`: 先頭の `state`・`base`（どこから始めた提案か）・`candidate`、続いて説明・
   提案者が頼んだこと（`requests`）・変更（`change_diff`。行 diff）・コメント。
3. 中身を読む: `get_proposal_inputs({ proposal_id })` は提案時点のcommitと制作中のゲームの限定bundleを返す
   （同時に重なりも確認する。`merge_check_required` を避けるため、採用の準備の前に必ず呼ぶ）。
   `kit.mjs fetch-review --inputs '<JSON>'` に渡すと `fetched_as`（`refs/remotes/tokoyo/proposals/<id>`）に入る。
   `source/` で `git diff --stat <base> <theirs>` と `git diff <base> <theirs>`（提案の変更）、`git diff --stat <base> <ours>`
   （その間に制作中のゲームで変わったこと）を読み、要点（何が変わるか・危ないところ・同じ部分に別の変更がありそうなところ）を伝える。
   base が null なら `git diff <ours> <theirs>`。**ブランチは切り替えない（読むだけ）。** 提案した版を手元で動かす方法は無い
   （遊ぶのは制作画面の「提案の変更を遊ぶ」）。
4. 利用者の判断に従う:
   - **修正を依頼する**: `request_proposal_changes({ proposal_id, reason })`（確認が出る。理由は必須で、提案者にそのまま表示される）。
     提案者が直して再提出するまで採用できない。
   - **見送る**: `close_proposal({ proposal_id, reason })`（確認が出る。理由は必須）。
   - **採用する**: `merge_proposal({ proposal_id, request_key: <新しい UUID> })` で「採用する内容」を準備する（確認が出る。
     同じ部分に別の変更が無ければ無料。あれば Platform の AI が調整してコインを使う）。`get_build({ job_id })` を3秒ごとに見て
     `ready` になったら `editor_url` を伝える。**準備ができても採用はまだ**。内容を確認した利用者が、
     `accept_merge_candidate({ proposal_id })` で採用を確定する（確認が出る。公開はされない）。
     準備のあとに制作中のゲームが動いたら `STALE_BASE`（もう一度 `merge_proposal` から）。
   - **返事**: `comment_proposal`（確認が出る）。
   手元の Agent は同じ部分の調整をしない（Platform の AI が行う）。公開は MCP からできないので、採用後は制作画面で行うよう伝える。
