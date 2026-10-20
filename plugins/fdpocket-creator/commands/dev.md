---
description: 手元で全 App を動かす（本番と同じ Gateway・ローカルの DB とファイル置き場・開発用 Host ページ）
argument-hint: "[member | admin | anonymous]"
---

作業ディレクトリ（`.tokoyo.json` のあるところ）で `node <kit>/scripts/kit.mjs dev` を起動したままにし（主体の指定があれば `--as $ARGUMENTS`）、
開発用 Host ページ（`http://localhost:4320`）を利用者に示す。Host ページで App と主体を切り替えて確かめる（`$fdpocket-app-testing` §2）。
ZModel や `infra/project.yaml` を変えたら `kit.mjs generate` の後に起動し直す。Node 22.12 以上が要る。止めるときは Ctrl-C。
