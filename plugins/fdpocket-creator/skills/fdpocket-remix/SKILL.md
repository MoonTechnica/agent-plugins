---
name: fdpocket-remix
description: 他の人のミニアプリへ参加し、公開済みの版（参照許可があれば最新の main）から同じ Project のブランチを作って作業する。Platform MCP の resolve_project / create_branch / get_git_bundles を使う。「これを改造して」「作者へ提案したい」のときに使う。
---

# ミニアプリへ参加する

手順の正本は **<kit>/profile/instructions.md §8.6**。所有権は元の作者・チームに残る。

1. `resolve_project({ reference })` で元の Project と自分の立場を確認する。本人・所属チームのものは `get_project` の通常編集を使う。
2. 外部参加では `contribution.allowed` を確認する。`my_branches` に続けたいブランチがあれば再開する。無ければ
   `create_branch({ project_id, request_key: <UUID> })`。再送は同じ request_key を使う。
3. 元の project_id と返された session_id で `get_git_bundles({ project_id, session_id })`。その JSON を `kit.mjs clone --bundles '<JSON>'` へ渡す。
   既存のブランチは `$fdpocket-pull` で続ける。
4. 自分のブランチを編集し、`$fdpocket-push` で検証する。main への提案は `$fdpocket-propose`。
5. 最新の main の参照権限がある場合だけ、`$fdpocket-pull` で main も fetch し、自分のブランチの上で git merge する。衝突を解いて検証し直す。

提案には 1 つの目的を入れる。掲載情報は頼まれない限り変えない。データモデルの既存の列を変えない（`$fdpocket-app-data-model`）。
生成や push が成功しても main・公開版は更新されない。一般参加者に未公開の main・合流候補・そのプレビューを要求しない。
