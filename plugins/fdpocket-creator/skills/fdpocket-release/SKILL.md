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
   **アップロード・ジョブ・AI・外部 API を使う流れは、本物のセッション環境で `kit.mjs e2e --as <テスト主体> --test <シナリオ>` を通す**（`$fdpocket-app-testing`）。
   結果が `passed` で、`platformErrors`（Platform に断られた要求）に意図しないものが無いこと。失敗したら、エラーに並ぶ Platform の理由を読んで直す。
3. DB・権限の変更を読んだ: `packages/db-schema` の migration は意図どおりで、データを失わない。ZModel のポリシー・capability の変更を説明できる。
4. main に入るもの（差分の要約・リスク）を利用者に示し、会話で明示的に了承を得た。

### 呼ぶ

`adopt_branch({ project_id, session_id })`（`.fdpocket.json` の値）。いまの main とチャットの head を使う。

- `merged` / `already_merged` → `version_id`（main の版）と、main の配備が始まったことを伝える。公開はまだしない。
  続けて下の「配備を見届ける」を必ず行う。
- `MERGE_CONFLICTS` → 取り込まれていない。`conflicts` のファイルをチャットのブランチで直す:
  `kit.mjs pull` → `git merge refs/remotes/fdpocket/heads/main` → 衝突を解く → `kit.mjs check` → commit → `kit.mjs push`（`ready` を待つ）→ チェック 1〜4 をやり直して呼び直す。
- `REVISION_CONFLICT` → 確かめたあとで main か head が進んだ。`get_project` で取り直し、確かめ直す。

## 配備を見届ける（取り込んだあと）

**取り込んだら main の配備を必ず見届ける**（配備の結果を見ないまま終わらない）:
1. `get_project` を 10 秒ごとに見て、`app_links.review` の `latest_version_id` が取り込んだ `version_id` で、
   `status` が `ready`（完了）か `failed`（失敗）になるまで待つ。`deploying` / `paused` は配備中（`step` が今の段）。
   15 分を過ぎても終わらなければ、状況を利用者に伝える。
2. `failed` → `error_code`・`error_detail` と `failed_validation[].report_url`（落ちた検証の報告 JSON）を読み、原因を利用者に伝えて直す:
   チャットのブランチで直して commit → `kit.mjs push`（`ready` を待つ）→ 必須チェックをやり直して `adopt_branch` → また見届ける。
   ソースで直せない Platform 側の失敗（`WORKERS_UNAVAILABLE`・`PLATFORM_SERVICE_CREDENTIAL` など）は直そうとせず、そう伝えて `editor_url` を示す。
3. `ready` → 配備の完了を報告し、`can_open` なら `apps[].url`（確認用のリンク）を画面 App ごとに示す。

## 環境の状況を調べる（`inspect_environment`）

配備・公開のあとの失敗や、動いているアプリの不具合（「通知が来ない」「定期処理が動かない」など）は、
推測で直す前に `inspect_environment` で環境の状況を読む。読めるのは**その Project のその環境だけ**。
- `environment: "main"`（確認用）は編集者（write 以上）、`"prod"`（本番）はオーナーと管理者だけ。権限が無いと `NOT_FOUND`。
- まず `section: "overview"`（環境の状態・最新の配備と失敗の理由・定期実行の `last_error`・直近 24 時間の失敗数）。
  失敗があれば `deployments` / `jobs` / `python` / `ai` で新しい順に読む（続きは返された `nextCursor` だけを渡す）。
- 業務データ・会話は返らない。Python の `error_message` は管理者だけに返る（`can_read_messages`）。
- api / jobs / mcp の **console 出力と例外**は `read_environment_logs` で読む（**オーナーと管理者だけ**。main / prod、直近 7 日まで）。
  `since_minutes`・`levels`（`error` など）・`search` で絞り、続きは返された `cursor` だけを渡す。
  ログには利用者の個人情報が含まれうる。原因の特定に要る行だけを引用し、まとめて貼り付けない。
  配信中の画面（ブラウザ）と Python のログは含まれない。
- 読んだ理由（`error_code`・`last_error`）を利用者に伝えてから直す。本番を直すときも、チャットのブランチで直して取り込み、公開し直す。

## リンクの扱い

リンクは MCP が返す `app_links` を**そのまま**使う。ホスト名や URL を推測・組み立てしない。
- `app_links.review` = main（確認用の環境）の配備の現在地（`status`・`step`・失敗の理由）。編集者に返る。
  `apps[].url` は各画面 App の起動リンクで、開けるのは `can_open` のオーナーと管理者だけ（それ以外は空）。
- `app_links.live.apps[].url` = 公開中の版の各画面 App の起動リンク（共有にも使う）。未公開なら `live: null`。

## B. 公開する（`publish_project`）

### 必須チェック（呼ぶ前に全部）

1. 公開する版が **main にある**（A が終わっている）。main（確認用の環境。公開中とは別のデータ）で確かめた:
   `get_project` の `app_links.review.apps[].url` で各画面 App を開き、A と同じ流れを通した（リンクは利用者にも示す）。
2. `get_project` の `listing.missing` が空。`get_publication` の `compatibility.reasons` に止める理由が無い（年齢区分・審査の条件。`REVIEW_REQUIRED` はサーバーが公開の途中で行う）。
3. 公開範囲 `app_access` を利用者に**明示的に聞いた**: `public`（だれでも）/ `restricted`（メンバーと招待した人だけ）。**確認なしに `public` にしない。**
4. データ削除の確認など人の判断が要るものは MCP で決めない。`publish_url` を示して止める。
5. 何を・だれに公開するかを示し、会話で明示的に了承を得た。専用認証を使う場合は `$fdpocket-app-auth` を読み、各 App の許可方式と自己登録の可否も伝える。

### 呼ぶ

`publish_project({ project_id, app_access })`（聞いた値。変えないなら省く）。掲載情報は版のまま送る。

その後 `get_publication({ project_id })` を数秒おきに見て `ended: true` まで待ち、結果を伝える:

- `succeeded` → 公開できた。返った `app_links.live.apps[].url`（本番のリンク）を画面 App ごとに**必ず利用者に示す**。 専用認証がある場合は、公開版の認証入口と登録・回復を確認した範囲を伝える。
- `failed` / `stopped` → `error_code` と `error_detail` を伝える。直せるものは直して、チェックからやり直す。
- `needs_person: true`（`awaiting_review`。データ削除の確認）→ MCP では決めない。`publish_url` を利用者に示し、画面で判断してもらう。
