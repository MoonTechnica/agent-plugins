---
name: tokoyo-propose
description: TOKOYO.gamesの自分の作業の変更をゲームの作者へ提案する。作者からの修正依頼への再提出・返事・取り下げも行う。Platform MCPのget_app / open_proposal / get_proposal / update_proposal / comment_proposal / close_proposalを使う。
---

# 作者へ提案する

作業ディレクトリ（`.tokoyo.json` のあるところ）で行う。手順・エラーの正本は
**`<kit>/profile/instructions.md` §8.6**。利用者には「提案」「採用」「修正の依頼」の言葉で話す。

1. `get_app({ app_id })` と `.tokoyo.json` で自分のsession_idを確認する。
   `proposals.from_me` に開いている提案があれば、新しく開かずに 4. へ。
2. **提案できるのは自分の作業の検証済みの最新**（公開しなくてよい。作者はその版を試遊できる）。
   `latest_proposable_version_id` が null か、送った変更がまだ `ready` になっていなければ、`$tokoyo-push` して
   `get_build` が `ready` になるのを待つ。
3. `open_proposal({ app_id, session_id, title, body, discussion_id? })`（題名100文字、**説明は必須**で2000文字まで。
   何を変えたか・なぜかを書く）。応える話題があれば `discussion_id` を渡す。
   依頼文を公開提案に添える設定を確認し、見せたくなければ `include_requests: false`。
   **クライアントが利用者に確認を求める**。断られたらそれ以上押さない。返った `url` を利用者に伝える。
   提案の差分は自動で作られる（提案者も提案ページで自分の差分を読める）。
4. 返事を見る: `get_proposal({ proposal_id })`。
   - `state: "changes_requested"` なら **`review_request.reason`（理由・依頼者・日時）を利用者にそのまま伝え**、
     直して `$tokoyo-push` → `ready` を待つ → `update_proposal({ proposal_id, proposed_version_id: <新しい検証済みの版> })`
     で**同じ提案へ再提出**する（依頼は解除され、作者に通知される。確認が出る）。
   - `state: "needs_adjustment"` は、同じ部分に別の変更があり作者側で調整する、という意味。あなたの操作は要らない。
   - それ以外のコメントへの返事は `comment_proposal`（確認が出る）。
5. 取り下げるときは `close_proposal`（確認が出る）。見送られた場合は、新しい作業から始め直せる。
6. 結果は `list_notifications({ unread_only: true })` で届く（`proposal_commented` / `proposal_changes_requested` /
   `proposal_merged`（採用）/ `proposal_declined` / `proposal_failed` / `contribution_published`）。読んだら `mark_notifications_read`。
   採用されても公開は作者が別に行う。公開は MCP からできない。
