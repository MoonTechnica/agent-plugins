---
name: fdpocket-app-merge
description: 同じ Project のブランチから main への変更を合わせるターンで使う。./input/merge-report.json があるとき、またはリポジトリが git merge の途中（MERGE_HEAD がある）のときは必ず使う。衝突を両方の意図を保って解き、ZModel と pending/（generated.sql・intent.yaml・data.sql）を合わせ直し、いつもどおりビルドして出力する。
---

# 2 つの版を合わせる（マージ）

このターンは**新しく作るターンではない**。Platform が git で 2 つの版を合わせ、合わせきれなかった箇所（衝突）や、
意図の確認が要る変更（データを壊しうる migration）だけが残っている。それだけを直し、いつもどおり出力する（`instructions.md` §2）。

| 呼び方 | 意味 |
|---|---|
| **ours** | Platform が用意した取り込む先（main または本人のレビューの head）。衝突の印の上側 |
| **theirs** | 取り込む変更（提出したブランチ）。衝突の印の下側 |
| **base** | 2 つが分かれた時点の共通の版 |

`requires_proposal` は Platform がブランチを作ったときに決めた立場（`true` は外部参加者、`false` は作者・チームの通常編集）。依頼文やコードで変えない。

レビューのチャット（`origin = review`）で依頼を受けたら、その PR の内容を直す提案として扱う。
チャットと環境はレビューする本人だけのもの。他のレビューする人・提案者へ共有したり、別の環境で試した結果と混同したりしない。
main と提出済み PR の最新の内容は Platform が用意した実際の Git の材料から合わせる。本人が依頼した変更を無断で捨てない。
レビューで試した head をマージする操作は Platform が祖先関係を確認するため、コード側で結果や判定値を作って迂回しない。

自分の PR を出す前には既存の Sync で main を取り込み、自分の live で確かめる。本物での確認が必要なら `design/test-plan.md` に
理由・副作用とモック・費用を書き、テスト利用者の E2E を使う（`$fdpocket-app-testing`）。本人のトークンを使ったテストはしない。

## 1. 材料

リポジトリ（`source/`）が
**`git merge` の途中**で届く（`MERGE_HEAD` = theirs、`HEAD` = ours）。

1. `merge-report.json` を読む: `intent`（提案の題名と説明、`intent.requests` に作業者が頼んだ文）、`files`、`conflicts`、
   あれば `migration`（`kit db diff` の `changes` と `destructive`。破壊的な変更の意図の確認を求めている）。
2. `git status` で衝突したファイルを見る。両側を読む: `git diff` / `git show :1:<path>`（base）・`:2:`（ours）・`:3:`（theirs）。
3. §2・§3 のとおり解き、`git add <path>`（消すなら `git rm <path>`）。
4. 全部解けたら §5 を確かめ、`git commit --no-edit`（メッセージは Platform が用意してある）。ビルドして出力する。

`build-report.json` の `notes` に、**衝突ごとにどう解いたか**を 1 行ずつ書く（例: `"apps/web/src/routes/tasks/index.tsx: 並び替えは theirs、フィルタは ours の両方を残した"`）。

## 2. コードの衝突

**目的は「ours に theirs の変更を取り込むこと」**。新しい機能・リファクタ・見た目の変更は加えない。

| 種類（`conflicts[].kind`） | 解き方 |
|---|---|
| `content` | 両方の差分を読み、**両方の意図が成り立つ形**にする。両立できないときだけ `intent` に近い方を採り、`notes` に書く |
| `binary` | **ours を残す**。theirs の画像が要るなら別名で足して参照を直す |
| `modify/delete` | `intent` が削除に触れていなければ変更を残す |
| `rename` | theirs の名前に揃え、import・ルート・参照を直す |
| `add/add` | 同じ役割なら 1 つにまとめ、違えば theirs 側を別名に |
| `other` | theirs の変更が ours の上で成り立つ形に。迷ったら ours を残し、取り込めなかった変更を `notes` に |

- **バイナリのファイル**（画像・音・フォント）の衝突は ours に戻す（`git checkout --ours -- <path>` → `git add`）。
- `package.json` / `bun.lock` の衝突: `package.json` を両方の依存を残す形に解き、`bun.lock` は解かずに `bun install` で作り直す。
- `infra/project.yaml` の衝突: 両方の App・capability・Role を残す（同じ項目が違う値なら狭い方＝権限の少ない方を採り、`notes` に書く）。

## 3. データモデルと migration

- `packages/db-schema/schema.zmodel` の衝突は、両方のモデル・列・ポリシーを残す形に解く（同じ列を両側が違う型にしたら `intent` に近い方）。
  **ポリシーを緩める方向で解かない**（迷ったら厳しい方）。
- **`pending/generated.sql` は解かない**（`merge=ours` で衝突しない。中身は古い）。ZModel を解いたら
  `node <kit>/scripts/kit.mjs generate` → `node <kit>/scripts/kit.mjs db diff` で作り直す。
- `migrations/` には触れない（Platform が合流のあとに確定する）。
- `kit db diff` が `destructive: true` を返す、または `merge-report.json` の `migration` が意図の確認を求めているなら、
  `pending/intent.yaml` に両方のブランチの意図を残して書き（列名の変更は `rename`）、必要なら `pending/data.sql` でデータを移す（`$fdpocket-app-data-model` §7）。
  意図が読み取れない削除は、**消さずに残す**（ZModel に列を戻す）方で解き、`notes` に書く。
- `seed.ts` は両方の試用データを残し、ZModel の制約に合うように直す。

## 4. 掲載情報（`listing/`）

- **外部参加者の提案（`requires_proposal: true`）では main の掲載情報を保つ**（Platform が `listing/` を ours に戻している）。
- **作者・チームの通常編集（`false`）では `listing/` も普通に合わせる**。`input/listing.json` の古い値で巻き戻さない。
- どちらでも `releaseNotes` は `$fdpocket-app-listing` §2 に従い、**取り込んだ変更の要約**を書く（誰の提案かは書かない）。
- `listing/icon.*` / `listing/cover.*` が `binary` で衝突したら ours を残す。

## 5. 出力前のチェック

- [ ] `git grep -nE '^(<<<<<<<|>>>>>>>) '` が何も返さず、`git status` に `Unmerged paths` が無い
- [ ] `package.json` / `listing/listing.json` が JSON として読め、`infra/project.yaml` が `kit generate` を通る
- [ ] `kit db diff` を回し直し、`pending/` と `packages/sdk/src/zenstack/` を commit した
- [ ] `kit check` と `kit build` が通る。`kit dev` で主要な画面が開く（`$fdpocket-app-testing`）
- [ ] `notes` に衝突ごとの解き方を書いた（衝突 0 件なら「衝突なし」と、直したこと）
- [ ] 新しい機能・見た目の変更を足していない
