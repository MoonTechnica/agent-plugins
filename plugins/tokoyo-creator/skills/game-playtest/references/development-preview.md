# 開発ケースと本編の検査

制作Hostの「開発テスト」から起動する。**Debug MenuのUIはこのゲームのリポジトリ内の`debug/`に作る**。
ステージ構成、状態表示、試験操作に合わせて設計し、全作品へ同じ画面を強制しない。
SDKの型付き操作と検査・結果・timeoutを使い、ケース切替はHostの認可と新Scopeでの起動を経由する。
任意JavaScriptコンソールは作らない。
通常試遊/公開版には開発機能を配信しない。同じソースから本番`dist/`と私有の`debug-dist/`を作る。
本番入口から`debug/`をimportしない。専用素材は開発ビルドだけに含め、共通素材は既存のhash/台帳を再利用する。

## 開発UIと通常開始

生成時に、この作品向けの独立して開けるpanel/overlayと入口を用意する。タイトル・プレイ中・ポーズの
必要な場面で利用でき、タッチでも開けるようにする。タイトル/ポーズに補助入口を置くのは選択肢であり、
全作品の開始メニューへ同じ項目を追加しない。開始/再開の主操作を保ち、開発UIの入力を本編へ渡さない。

`normal_start`は本編の起動経路、開始画面、設定処理を共有する。本編にタイトルが無ければ追加しない。
専用Scopeの開始条件を適用して最初の操作可能な画面が準備できた時にreadyを通知し、開始押下まで待たせない。
ステージ/試験場の直行は明示したcaseだけで行う。対象が未生成のcommandは実行可能と表示しない。
通常の初回開始、開発入口→閉じる→開始、ステージ直行→ケース再起動→通常試遊の復帰を確認する。

Godotでは`$game-godot`と`$game-3d-and-bundles`の開発シーン・資源寿命の契約を読む。

## 核が遊べるとき

`debug/entry.ts`と`debug/catalog.json`を作る。新規ゲームは通常開始ケースを含める。
本編の安定したstage/entry/subject IDと進行restoreを使い、所持品、能力、扉、イベント、敵の状態とseedを
`debug/presets/`へ置く。配列indexや実ユーザーのセーブ、Document ID、tokenをfixtureへ入れない。
初期保存のACKと必要bundle、衝突、カメラの準備後にSDKの`app.debug.ready`を呼ぶ。失敗は`app.debug.fail`で報告する。
APIの正確な型は`<kit>/sdk/app-sdk/types/`と`spec.md`を読む。未実装の遠隔操作APIを呼ばない。

キャラ・機能アイテム・敵・仕掛けの試験場は本編factory/controller、animation、inventory/item effect、AI、
衝突と保存をそのまま使う。選んだ対象と必要な相手だけを配置する。図形や既存素材で十分な試験に有料素材を生成しない。
完成済みの複数stageに到達時状態を用意し、未実装stageや装飾NPCを水増ししない。対象外の理由はbrief/playtestへ残す。

## 変更したとき

対象ID、bundle、preset、許可commandを更新する。コマンド入力はnone/boolean/enum/有限numberのみ。
任意URL、コード、内部パスや財布/本番権利を操作する入力は作らない。タイムアウトのAbortSignalを守り、
処理を停止できない場合はケースを新Scopeで再起動する。UIのON表示は結果のACK後に確定する。
Document必須ケースとライブオンライン操作は今回未対応。Storeだけを設定して対応済みと説明しない。

## ビルド前の検査

```sh
node <kit>/sdk/app-sdk/build-config/kit.mjs debug-catalog <source-dir> --kind stage --offset 0
node <kit>/sdk/app-sdk/build-config/kit.mjs debug-validate <source-dir>
```

`<source-dir>`は実際の制作ソース（Sandboxでは`/workspace/game`、手元では`source/`）。
カタログの構文/参照検査と実画面の確認を区別する。本番/開発の両ビルドを検査し、
`debug-dist.tar.gz`を通常の`dist.tar.gz`と別の成果物として提出する。
`documents.read`または`documents.write`を要求するゲームは今回の開発起動対象外。
その場合は本番成果物だけを作り、使えない開発メニューや試験adapterを追加しない。
対応対象は元版やSDK版に関係なく両成果物を必須とする。

`design/playtest.md`にsource revision、Artifact/SDK release、case/preset/schema、seed、端末、操作、観察、
passed/failed/unverifiedを記録する。ケースを起動しただけで全編の品質・クリア可能性を保証しない。
通常開始とチートなしのケース、再起動で初期条件へ戻ることを確認する。既存ゲームは局所変更とし、
既存の遊びを全面改修して全ケースを推測で生成しない。
