---
name: tokoyo-continue
description: クラウドとローカルの制作を、固定されたソースと共有メモを使って引き継ぐ。handoff_id を渡されたとき、実行場所を切り替えるときに使う。
---

# 制作を引き継ぐ

`<kit>` は Creator Kit のルート。git と Git LFS が必要。

1. `node <kit>/scripts/kit.mjs continue --handoff-id <ID> --directory <新しい空のディレクトリ>` を実行する。既存の作業を上書きしない。承認後に固定ソース、LFS、writer epoch を検証してから作業可能になる。失敗時は同じ引数で再試行する。
2. `input/handoff.json` と配布された profile/instructions.md、関連 Skill を読み、goal、decisions、completed、attempts、next_steps、known_issues、checks を引き継ぐ。過去の会話そのものは取得しない。
3. 依頼された編集を実施する。共有メモは `outputs/handoff-context.json` に UTF-8 JSON（最大32KiB、schema_version:1）で保存し、ソースの commit に会話や認証情報を入れない。
4. 手動受領（Connector 管理外）でクラウドへ戻す前に source/ の変更を確認して commit し、`node <kit>/scripts/kit.mjs checkpoint --context-file outputs/handoff-context.json` で保存する。`get_workflow` の最新 epoch/source_revision_id とメモを `prepare_handoff` に渡す。失敗した変更はローカルに保持する。

Connector 管理下では子 Agent は commit と共有メモの保存まで行い、制作画面の切替操作を使う。親 Connector が現在の command/run に結び付けて checkpoint と引き継ぎ準備を実行する。子から `checkpoint` や `prepare_handoff` を実行しない。

制作画面から受け取るには `node <kit>/scripts/kit.mjs connect --workspace <専用ルート> --agent codex`（または claude）を前景で起動し、表示された challenge を画面で承認する。既定は受取のみ。利用者が自動実行を求めた場合だけ `--allow-agent-run` を付ける。停止は Ctrl-C または `disconnect --workspace <専用ルート>`。

managed workspace の `.tokoyo.json` は schema_version:2 で session_id/thread_ref は execution 内にある。手編集しない。`pack` が返す workflow_id/expected_epoch を begin_build に渡し、旧 writer の成果物を送信しない。
