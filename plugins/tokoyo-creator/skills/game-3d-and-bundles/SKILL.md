---
name: game-3d-and-bundles
description: Godotの3Dゲームと素材の多い作品を作る。シーン・GLB・テクスチャのimport、必要な範囲だけの読み込みと資源寿命、Web/nativeの性能測定を扱う。
---

# Godotの3Dと大きいゲーム

`$game-godot`、`$game-design`の`references/performance-risk.md`、素材調達は`$game-3d-studio`を読む。
Godot 4.5.1のCompatibility rendererでWeb/native共通の描画を作る。Phaser/Babylon/JS codecを追加しない。

- GLB・画像・音をGodotへimportしてシーンから参照する。固定版の公式APIと同梱サンプルを確認する。
- シーン・ステージごとに資源を分け、必要な時だけ読み込む。動的パスの依存は作品の宣言へ記録し、Editor側の静的解析だけに頼らない。
- `ResourceLoader.load_threaded_request`等を使う場合も、Nodeの追加・GPU upload・破棄のframe負荷は別に測る。
- 不要なシーンは`queue_free()`し、autoload・signal・配列・辞書がResourceを保持していないか確認する。
- 再入場が必要な近隣だけを上限付きで保持する。全ステージのpreload・無制限キャッシュを使わない。
- 大きい音・画像・GLBは既存の素材台帳で管理し、再生成せず再利用する。Kitが提供しないnativeの動的PCK配信を実装済みと仮定しない。
- Artifactは書庫圧縮後200 MiB、展開後1 GiB、単一ファイル64 MiB、起動分64 MiBの制限を守る。
  標準Web WASMだけでも約38 MiBある。圧縮前後とPCKの容量を実測し、超過を隠さない。
- GodotのWeb exportはPCKを起動時に取得する。一般のJS `app.bundles`と同じ遅延配信がnativeでも自動成立すると扱わない。
  必要なら現在の配布契約に収まるシーン・素材構成へ分割し、未対応の動的資源は報告する。

影・透明描画・全画面shader・粒子・テクスチャ寸法・解像度・活動中のNode数に予算を置く。
見た目を一律に下げず、実frame時間・メモリ・操作感から原因別に調整する。
起動、ステージ切替、同じ場所への再入場、タイトル復帰、終了を繰り返し、メモリが無制限に増えないか測る。
Editorは必要なシーンと明示した素材だけを読み、iframe交換後の解放を確認する。小規模サンプルの成功を大規模作品の保証にしない。
