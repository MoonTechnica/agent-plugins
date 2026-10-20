---
description: 送る前の検査（project.yaml・基底 ZModel・同梱の SDK・bun.lock・migration）を手元で走らせる
---

作業ディレクトリ（`.tokoyo.json` のあるところ）で `node <kit>/scripts/kit.mjs check` を実行し、結果を利用者に短く伝える
（`<kit>` は `.tokoyo.json` の `kit_root`）。落ちたら終了コード 2 で理由が出るので、直し方を示す（`$fdpocket-app-testing` §3）。
通っても Platform 側の検証（画面を開く動的検証を含む）は送信のたびに必ず走る。
