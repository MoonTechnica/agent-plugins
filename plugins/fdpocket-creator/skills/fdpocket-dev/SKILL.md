---
name: fdpocket-dev
description: 手元の変更を自分だけのセッション環境へ接続して確認する。kit dev --connect、主体切替、セッションの DB・AI・Python・ジョブを使う動作確認に使う。dev, connect, live.
user-invocable: false
---

# 自分のセッションへ接続する

`<kit>` は `.fdpocket.json` の `kit_root`。作業ディレクトリには `project_id` と自分の `session_id` が必要。
未作成なら `$fdpocket-new`、既存の App なら `$fdpocket-pull` で用意する。

1. **確認する範囲を決める**: 通常は `node <kit>/scripts/kit.mjs dev`。ローカルの DB・ファイル・モックで画面と純ロジックを確かめ、外部への副作用を出さない。`--ai` は使わない。
2. **本物のセッションが必要なら接続する**: 作業ディレクトリで `node <kit>/scripts/kit.mjs dev --connect [--as self|member|admin|anonymous|宣言したslot]`。初回は既存のログイン手順に従う。`--connect` と `--live` は併用しない。セッション ID や接続先の URL を別のフラグで指定しない。
3. **明示的に同意する**: 表示された手元の Host をブラウザで開き、App の共有情報・接続先・AI/Python の利用を確認して利用者が許可する。自動で同意したり、他の利用者のセッションへ接続したりしない。主体は本人の `self` または現在のセッションで宣言されたテスト主体だけ。宣言されていない主体を本人へ置き換えない。
4. **変更を確かめる**: 手元の App は割り当てられた `*.localhost:5173` の origin で動き、Platform の DB・Storage・AI・Python は自分のセッションに接続される。Host は `http://127.0.0.1:4320`。Host の開発ツールで主体を切り替え、イベント・ジョブの実行・実行履歴を確認する。増える履歴は「もっと見る」で続ける。
5. **データと費用を理解する**: 再接続や通常の編集でセッション DB は消えない。意図を伴わない破壊的なスキーマ変更では、このセッションの DB だけを再作成する。main / prod の DB をリセットしない。外部 API は既定で宣言したモック（未宣言なら 501）、通知は送らない。実際の AI・Python/GPU の費用はチャットの持ち主が払う。
6. **止める**: Ctrl-C で接続を止める。接続は別の機器が引き継いだ時にも終了する。公開版や main は変わらない。成果を Platform に送るときは commit して `$fdpocket-push`。接続中の作業ツリーと push 後の built は区別する。

OAuth・同意の確認 ID・テスト grant・通知キーを HTML、ログ、`.fdpocket.json`、ソース、テスト計画へ書かない。通常の scoped Project JWT は Host のメモリと MessageChannel だけで扱う。テストの証跡と本物を使う理由は `design/test-plan.md` へ記録する（`$fdpocket-app-testing`）。
