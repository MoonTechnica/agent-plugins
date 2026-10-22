---
name: game-3d-and-bundles
description: Godotの3Dゲームと素材の多い作品を作る。シーン・GLB・テクスチャのimport、必要な範囲だけの読み込みと資源寿命、Web/nativeの性能測定を扱う。
---

# Godotの3Dと大きいゲーム

`$game-godot`、`$game-design`の`references/performance-risk.md`、素材調達は`$game-3d-studio`を読む。
Godot 4.5.1のCompatibility rendererでWeb/native共通の描画を作る。JS/TSの描画ライブラリやcodecは使えない（GDScriptとシーンだけ）。

- GLB・画像・音をGodotへimportしてシーンから参照する。固定版の公式APIと同梱サンプルを確認する。
- シーン・ステージごとに資源を分け、必要な時だけ読み込む。動的パスの依存は作品の宣言へ記録し、Editor側の静的解析だけに頼らない。
- Webはsingle-threaded、iOSの組み込みruntimeではスクリプトのスレッドと`WorkerThreadPool`が使えない。読み込みはスレッドに頼らず、Nodeの追加・GPU upload・破棄を小分けにしてframe負荷を測る（`$game-open-world` §2）。
- 不要なシーンは`queue_free()`し、autoload・signal・配列・辞書がResourceを保持していないか確認する。
- 再入場が必要な近隣だけを上限付きで保持する。全ステージのpreload・無制限キャッシュを使わない。
- 大きい音・画像・GLBは素材台帳（`list_assets` / `get_asset`）で再利用し、再生成しない。ゲームに入れるものは`godot/`に置く。
- **主PCKは64 MiBまで**（起動前に全部届く。書庫の単一ファイル上限も64 MiB）。標準Web WASMだけでも約38 MiBある。
  テクスチャの圧縮import・解像度・音のビットレートで収め、PCKの容量を実測して超過を隠さない。
- 広い世界・ステージの多い作品は、場所ごとの素材を`godot/regions/<地域>/`に分けて**地域ごとの追加pack**にする
  （`manifest.json`の`godot.regions`と`bundles`に同じ名前を書く。近づいたら`TokoyoApp.regions.load(name)`。`spec.md` §8.6）。
  地域packも1つ64 MiBまで。スクリプトと複数の地域が使う素材は主PCKに置く。Godotはpackを外せないので、読む地域は利用者が近づく所だけにする。
- 台帳から参照する素材・URLで読む経路は無い。ゲームに入れるものはすべて`godot/`に置く。

影・透明描画・全画面shader・粒子・テクスチャ寸法・解像度・活動中のNode数に予算を置く。
見た目を一律に下げず、実frame時間・メモリ・操作感から原因別に調整する。
起動、ステージ切替、同じ場所への再入場、タイトル復帰、終了を繰り返し、メモリが無制限に増えないか測る。
Editorは必要なシーンと明示した素材だけを読み、iframe交換後の解放を確認する。小規模サンプルの成功を大規模作品の保証にしない。
