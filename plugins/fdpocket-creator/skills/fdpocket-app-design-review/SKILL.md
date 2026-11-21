---
name: fdpocket-app-design-review
description: 画面を作り終えたあとの仕上げの見直し。kit shot で主な画面と状態を撮り、7 つの観点（目的・階層・一貫性・余白と整列・状態・文言・誰でも使えるか）で採点し、低い所から直して撮り直す。「できた」と言う前、見た目の依頼に応えたあと、他の人の変更を取り込む前に使う。
---

# 仕上げの見直し

*`$fdpocket-app-visual` §7 の「撮って見て直す」を、**観点と合格の線を決めて**やる手順。作る Skill（`$fdpocket-app-visual` / `$fdpocket-app-ux-patterns` / `$fdpocket-app-data-display` / `$fdpocket-app-ux-writing` / `$fdpocket-app-accessibility`）の確認をまとめたもの。*

作った本人の目は甘くなる。**初めて開いた依頼者の立場**で見る。

## 1. 撮る

```bash
node <kit>/scripts/kit.mjs shot --out /tmp/fdpocket/shots --path /                 # トップ
node <kit>/scripts/kit.mjs shot --out /tmp/fdpocket/shots --path /tasks/<id>       # 詳細（実在の id で）
node <kit>/scripts/kit.mjs shot --out /tmp/fdpocket/shots --as admin --app admin --path /
node <kit>/scripts/kit.mjs shot --out /tmp/fdpocket/shots --path / --theme dark    # 暗い画面
```

- 撮るのは **いちばん多い操作で通る画面すべて**（一覧・詳細・作成フォーム）と、**空・エラーの状態**（`$fdpocket-app-visual` §7）。
- 画面が多いアプリでも、少なくともトップ・主な一覧・主なフォーム・管理画面のトップの 4 つ。
- `checks` の値（`horizontalOverflow` / `smallTargets` / `smallTextCount` / `consoleErrors`）が 0 / false でなければ、採点の前に直す。

## 2. 採点する（各 0〜2 点）

| 観点 | 2 点（合格） | 0 点で多い原因 |
|---|---|---|
| **目的** | 開いて 3 秒で、何の画面か・いちばん多い操作がどこか分かる | 主な操作が下の方・見出しが抽象的・トップが空のまま |
| **階層** | 主役が 1 つ。見出し → 本文 → 補足の大きさと濃さに差がある。主ボタンは画面に 1 つ | 全部太字・ボタンが全部同じ強さ・色が 2 色以上目立つ |
| **一貫性** | 同じものが同じ見た目と名前（ボタン・行・バッジ・日付の書式）。外枠は `AppShell` で 1 回 | 画面ごとに手書きのボタン・余白・角丸 |
| **余白と整列** | 余白が 4px の倍数でそろう。左端がそろう。カードの入れ子が無い | 詰まりすぎ／スカスカ・中央揃えの多用・線で区切りすぎ |
| **状態** | 読み込み中・空・エラー・送信中が作られ、空とエラーに次の操作がある | 空のときに真っ白・エラーが空の一覧に見える |
| **文言** | 業務の言葉・具体的な動詞・内部の言葉が無い（`$fdpocket-app-ux-writing` §5） | 「データ」「送信」「pending」・en が崩れる |
| **誰でも使える** | 44px・16px・コントラスト（**明と暗の両方**）・キーボード・`aria-label`（`$fdpocket-app-accessibility` §7） | アイコンだけのボタン・薄い文字・`div` の onClick |

**合格の線: 全観点 1 点以上かつ合計 11 点以上（14 点満点）**。下回ったら、点の低い観点から直して撮り直す（最大 3 回）。
3 回で届かなければ、届かない理由（例: 依頼の内容が画面に収まらない）を結果に書く。

## 3. よく効く直し方（上から順に試す）

1. **要らないものを消す**（使われない列・飾りの説明・重複した操作）。足すより先に減らす。
2. 主な操作を 1 つにし、ほかを `variant="outline"` / `"ghost"` か「…」メニューへ。
3. 見出しを `PageHeader` に、まとまりを `Card` 1 段に。カードの入れ子と線を余白（`gap-6`）に置き換える。
4. 文字を 5 段（`$fdpocket-app-visual` §6）に戻す。補足を `text-muted-foreground` に。
5. 空・エラーに `EmptyState` と次の操作を足す。
6. `--brand-hue` が用途に合っているか（`$fdpocket-app-visual` §3）。無彩色のままにしない。

## 4. 結果に書く

最終の返信（`build-report.json` の要約）に 1〜2 行で: 見た画面の数・点数・直した主な点・**見られなかったもの**（画像を見られない環境・撮れなかった状態）。
「きれいにしました」のような根拠の無い言い方をしない。
