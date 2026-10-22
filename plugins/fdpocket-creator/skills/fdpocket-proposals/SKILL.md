---
name: fdpocket-proposals
description: 自分のミニアプリ（main）に届いた提案を読み、コメントし、マージするか見送る。Platform MCP（fdpocket）の list_proposals / get_proposal / get_proposal_inputs / comment_proposal / merge_proposal / close_proposal と git を使う。「届いた提案を見て」「レビューして」「マージして」のときに使う。review, merge, maintainer.
user-invocable: false
---

# 届いた提案を読んで決める

作業ディレクトリ（main の `.fdpocket.json` のあるところ）で行う。手順・エラーの正本は **`<kit>/profile/instructions.md` §8.6**。要点:

1. `list_notifications({ unread_only: true })` の `proposal_opened` / `proposal_commented`、または
   `get_project({ project_id })` の `proposals.incoming_open_count` → `list_proposals({ project_id, status: "open" })`。
2. `get_proposal({ proposal_id })`: 説明・頼んだこと（`requests`）・変更（`change_diff`）・マージできるか（`mergeability_current`）・コメント。
3. 中身を読む: `get_proposal_inputs({ proposal_id })` の結果を `kit.mjs fetch-review --inputs '<JSON>'` に渡すと `fetched_as`
   （`refs/remotes/fdpocket/proposals/<id>`）に入る。`source/` で `git diff --stat <base> <theirs>` と `git diff <base> <theirs>`（提案の変更）、
   `git diff --stat <base> <ours>`（その間に main で変わったこと）を読み、利用者に要点を伝える。
   特に `packages/db-schema/schema.zmodel`（データを壊す変更・ポリシーを緩める変更）と `infra/project.yaml`（capability・Role の追加）を見る。
   base が null なら `git diff <ours> <theirs>`。**ブランチは切り替えない（読むだけ）。**
4. 利用者の判断に従う:
   - マージ: `merge_proposal({ proposal_id, request_key: <新しい UUID> })`（確認が出る）。`get_build({ job_id })` を 3 秒ごとに見て、
     `ready` なら `editor_url` を伝える。**検証の成功は候補を用意するだけ**。制作画面で試して差分を確かめた後、利用者が main への取り込みを確定する。
     公開も別の明示操作。
   - 返事: `comment_proposal`（確認が出る）。見送り: `close_proposal`（確認が出る）。
