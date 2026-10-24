---
description: 手元で App を確認する（ローカルのモック、または自分のセッションへ接続）
argument-hint: "[--connect] [--as self|member|admin|anonymous|slot]"
---

`$fdpocket-dev` に従う。作業ディレクトリ（`.fdpocket.json` のあるところ）で
`node <kit>/scripts/kit.mjs dev $ARGUMENTS` を起動したままにし、表示された Host を利用者に示す。
通常はローカルの DB・ファイル・モック。`--connect` を指定すると自分だけのセッション環境へ接続する。
本物の AI・Python/GPU はチャットの持ち主のクレジットを使う。Node 22.12 以上が要る。止めるときは Ctrl-C。
