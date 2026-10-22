---
name: fdpocket-push
description: 手元で作ったミニアプリを Platform に送る。git で commit し、Kit の CLI の kit push 1 つで build → 3 点（source.bundle・dist.tar.gz・build-report.json）→ 検査 → begin_build → アップロード → submit_build → 完了待ち → 取り込み直しまで行い、下書きにする。「送って」「push して」「試せるようにして」のときに使う。push, submit, upload, build.
user-invocable: false
---

# Platform に送る

作業ディレクトリ（`.tokoyo.json` のあるところ）で行う。`<kit>` は `.tokoyo.json` の `kit_root`。
手順・結果の扱い・エラーの正本は **`<kit>/profile/instructions.md` §8.3〜§8.5**。要点:

1. **貢献のブランチなら規約を確かめる**: `get_contribution_policy({ project_id })`（`project_id` は `.tokoyo.json` の `app_id`）で最新の禁止事項・
   ガイドラインを読み、依頼と差分全体が守っているか確かめる。抵触するなら該当規約と理由を述べて送らない。取得に失敗したら送らない。
   守っているなら、返った `revision` を 3. の `--policy-revision` に渡す。
2. `source/` の変更を `git commit` する（未 commit の変更があると断られる。作者は `kit.mjs clone` が設定した本人のまま）。
   `outputs/build-report.json` には申告（`notes`・`listingRequested`・`stage`）だけを書けばよい。`project`・`apps`・`schemaVersion`・
   `migrations` は `kit push` が build の結果から書く（spec §11）。
3. `node <kit>/scripts/kit.mjs push --message "<利用者向けの 1 行の説明>"`（貢献のブランチは `--policy-revision <revision>`、
   この会話で最初の送信なら `--open`）。build → pack → check → begin_build → アップロード → submit_build →
   `ready` / `failed` / `cancelled` まで待つ（10 分で打ち切り）→ `ready` なら取り込み直す、までを 1 回で行う。
   - 検査（check）で落ちたら終了コード 2 と理由が出る。直して commit し、3. をやり直す。
   - Platform が断ったら、コード（`STALE_BASE`・`CONTRIBUTION_POLICY_CHANGED` など）と次の手順がエラーに出る。そのとおりにする（§8.4・§8.5）。
4. 結果の JSON:
   - `status: "ready"` → **`editor_url` を返事の最後に目立つ形で毎回示す**（例: 「▶ 制作画面で試す: <editor_url>」）。
     `opened` は `--open` で制作画面を開けたか。`pulled` は取り込み直した結果（次の push の base）。
   - `status: "failed"` → `reports[].report_url` を取得して読み、直して commit し、3. をやり直す。
   - `status: "timed_out"` → 利用者に伝え、後で `get_build({ job_id })` を見る。
   - `kit_update` があれば Kit が古い。結果を伝えたあとに更新を勧める（`kit_update.update` の手順）。
5. 公開・投稿は制作画面で利用者が行う（MCP と Kit には無い）。

MCP の `begin_build` / `submit_build` / `get_build` を直接呼ぶ手順（§8.3 の詳細）も残っているが、普段は `kit push` を使う。
