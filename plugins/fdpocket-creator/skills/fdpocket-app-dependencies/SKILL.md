---
name: fdpocket-app-dependencies
description: ミニアプリに npm のパッケージを足す前に必ず使う。足さずに書けないかの判断、実績（週間ダウンロード数・最終リリース・保守状況・star）・ライセンス・型・既知の脆弱性の調べ方と基準、bun.lock と bunfig.toml の扱い、git・URL・file の依存の禁止。
---

# 依存を足す

npm の公開パッケージは足してよい。ただし**足したものは利用者のアプリに残り続ける**ので、次の順に決める。

## 1. まず足さずに書けないか

1. テンプレートに入っているもので書けないか: React 19・TanStack Router / Query・ZenStack のフック・Tailwind・shadcn の部品
   （`packages/ui`。足りない部品は shadcn の書き方で `packages/ui` に足す）・`lucide-react`・zod。
2. Web 標準で書けないか: `Intl`（日時・数値・通貨・相対時間）、`URL` / `URLSearchParams`、`crypto.randomUUID()`、`structuredClone`、
   `<input type="date">`、`<dialog>`、CSS（Tailwind）のアニメーション。
3. 数十行で書ける処理（配列の整形・小さな計算）は自分で書く。

それでも要るとき（グラフ・リッチテキストエディタ・ドラッグ並び替え・カレンダー・QR コードなど）だけ §2 へ。

## 2. 調べる（記憶で決めない）

足す前に必ず実物を確かめる（`npm view <名前>` / `npm view <名前> time --json`、npm のページ、GitHub）。

| 項目 | 基準（1 つでも外れたら入れない） |
|---|---|
| 週間ダウンロード数 | 目安 1 万以上。同じ役割の候補が複数あれば多い方 |
| 最終リリース | 1 年以内。リポジトリが archived・deprecated でない |
| 保守 | issue / PR に反応がある。README 以外の文書と変更履歴がある |
| star | **補助の材料だけ**（star は買える）。少なすぎる（数百未満）なら見送る理由になるが、多いことを入れる理由にしない |
| ライセンス | MIT / Apache-2.0 / BSD / ISC。GPL / AGPL / SSPL / BUSL / 独自のものは入れない |
| 型 | 本体に型が入っているか、`@types/<名前>` がある |
| 脆弱性 | 未修正の既知の脆弱性が無い（`npm view` の deprecated の表示、GitHub の Security、osv.dev） |
| 大きさ | ブラウザに入るものは小さいものを選ぶ（数百 kB を超えるなら、使う部分だけを import できるか） |
| 動く場所 | ブラウザで動く（Node 専用・ネイティブのバイナリが要るものは使えない）。外部の CDN やサーバーを呼ばない |

- 似た役割のものを 2 つ入れない（日付のライブラリ 2 つ、など）。
- 足した理由（何に使い、§2 をどう満たしたか）を `build-report.json` の `notes` に 1 行書く。

## 3. 足し方

1. 使う App（`apps/web` など）の `package.json` に**完全な版**（`"^"` を付けない）で書く。
2. `source/` の根で `bun install` を実行し、**`bun.lock` を commit する**。
3. `node <kit>/scripts/kit.mjs build` が通ることを確かめる（`vite_warnings` に大きなチャンクの警告が出ていないか）。

- **git・URL・`file:`・`link:` の依存は不可**（`bun.lock` が npm レジストリの版 + integrity でないと `kit build` と `kit check` が落とす）。
- **`bunfig.toml` を変えない**: 公開から 7 日未満の版は解決されない（`minimumReleaseAge`）。新しすぎる版が要るなら一つ前の版にする。
  依存の install スクリプトは動かない（`ignoreScripts`）。install スクリプトが無いと動かないパッケージは使えない。
- `packages/miniapp-sdk/` と `packages/project-protocol/` は Kit が置く。npm の同名・類似のパッケージを足さない。
