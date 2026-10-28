---
name: tokoyo-remix
description: 他の人のTOKOYO.gamesのゲームに変更を提案するため、同じゲームの中に自分の作業を作って始める。公開版（作者が許可していれば制作中のゲーム）から始め、ゲームの作者は変わらない。Platform MCPのresolve_app / create_branch / get_git_bundlesを使う。「これを改造して」「リミックスして」「このゲームを直して作者に提案したい」のときに使う。
---

# 他の人のゲームに変更を提案する（作業を始める）

手順の正本は **<kit>/profile/instructions.md §8.6**。ゲームの作者・チームは変わらない。利用者には
「採用」「制作中のゲーム」「公開版」の言葉で話す（main・ブランチ・fork は使わない）。

1. `resolve_app({ reference })` で元ゲームと自分の立場を確認する。本人・所属チームのゲームは `get_app` の通常編集を使う。
2. `contribution.allowed` を確認する。`my_branches` に続けたい作業があれば再開する。無ければ
   `create_branch({ app_id, request_key: <UUID> })`。再送は同じrequest_keyを使う。
3. **返った `base` を利用者に伝える**: `kind: "release"` →「公開版 v{version_no} から始めました」、
   `kind: "main"` →「作者の許可で、制作中のゲームの最新から始めました」。ゲームの作者は変わらないことも添える。
4. 元ゲームのapp_idと返されたsession_idで `get_git_bundles({ app_id, session_id })`。そのJSONを
   `kit.mjs clone --bundles '<JSON>'` へ渡す。既存の作業は `$tokoyo-pull` で続ける。
5. 素材ツールにもapp_id・session_idを渡す。自分の作業を編集し、`$tokoyo-push` で検証する。作者への提案は `$tokoyo-propose`。

提案には1つの目的を入れる。掲載情報は頼まれない限り変えない。生成やpushが成功しても、作者のゲームと公開版は変わらない。

一般参加者には公開版とその作業に必要なコード・素材だけが渡る。制作中のゲームの中身・重なりの詳細は、作者・チーム、
または作者が明示的に許可した人だけが見られる。手元で最新を取り込めない（作者側が取り込む）ので、公開版が進んだときは
新しい公開版から新しい作業を始めるか、作者に取り込んでもらう。
