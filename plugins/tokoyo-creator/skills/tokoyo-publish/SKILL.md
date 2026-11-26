---
name: tokoyo-publish
description: ready になったゲームを publish_app で公開する。掲載情報が足りなければ listing/ を作って push し直す。「公開して」「リリースして」のときに使う。
---

# 公開する・ゲームを管理する

公開は**エージェントだけで最後まで行える**（確認は挟まない。2026-11-27 の決定）。画面の公開と同じ検査は
サーバー（DB・Edge Function）が行うので、通らない版は理由つきで断られる。利用者の「公開して」を受けたら次の順に進む。

1. `get_app({ app_id })` で `listing.missing`（公開に足りない項目）と `published_version_id`、`running_job` を見る。
   - `missing` があれば `$game-listing` に従って `source/listing/` を作る。**アイコンとカバーの画像は素材ツール
     （`generate_image` など）で作る**（コインを使う。利用者が許可済みのときだけ。許可が無ければ何が足りないかを伝えて止まる）。
     作ったら `$tokoyo-push` で送り、`get_build` が `ready` になるのを待つ。
2. `ready` になった版の `app_version_id`（`get_build` の結果）と、手元のスレッドの `session_id`（`.tokoyo.json`）を `publish_app({ app_id, app_version_id, session_id })` に渡す。
   `session_id` を渡すと、そのチャットの変更を制作中のゲーム（main）へ採用してから公開する（**2 回目以降の更新の公開も同じ 1 回の呼び出し**）。採用だけなら `adopt_changes`。
   - `visibility` は既定が `public`。限定公開にしたいときだけ `unlisted`。投稿を付けるときだけ `post_body`。
   - `status: "validating"` が返ったら、**同じ `request_key`** で呼び直す（検証・年齢区分の判定が終わるまで）。
3. `status: "published"` なら、`page_url`（ゲームのページ）を利用者に示す。

## 断られたとき

| 返り | 意味と次の一手 |
|---|---|
| `LISTING_INCOMPLETE` | 掲載情報が足りない。`get_app` の `listing.missing` を埋めて push し直す（1.） |
| `VALIDATION_REQUIRED` | 動作の検証が通っていない。検証の report を読み、直して push し直す |
| `CONTENT_REVIEW_REQUIRED` | 年齢区分を判定できなかった。`manifest.json` の `contentRating` と画面・説明を見直す（18 は公開できない） |
| `STALE_BASE` / `main_changed` / `REVISION_CONFLICT` | 制作中のゲーム（main）か公開中の版が先に進んだ（main が分岐した）。`$tokoyo-pull`（`kit.mjs pull`）で取り込み、衝突があれば手元で直して push し直す。サーバー側で衝突を解決することはしない |
| `FORBIDDEN` | このゲームを公開できない（編集権限が無い・停止中）。利用者に伝える |

## ゲームの管理（公開のあと）

| やりたいこと | ツール |
|---|---|
| 非公開にする（もう一度 `publish_app` で戻る） | `unpublish_app` |
| 公開範囲を変える（public / unlisted） | `set_visibility` |
| フィードへ投稿する | `create_post`（公開と同時なら `publish_app` の `post_body`） |
| 削除する・戻す | `get_deletion_preview` → `delete_app`（`confirm_title` にゲーム名をそのまま）／ `list_deleted_apps` → `restore_app`（公開したことがあれば猶予の間だけ） |
| ランキングの不正な記録を消す | `remove_leaderboard_entry` |
| 提案の受付・禁止事項 | `set_contribution_policy` |

削除は元に戻せない場合がある（一度も公開していないゲームは次の掃除で消える）。利用者が「削除して」と言ったときだけ行い、`get_deletion_preview` の内容を伝えてから実行する。
アカウント・チーム・クレジットの購入・通報の操作は制作画面で利用者が行う（MCP には無い）。
