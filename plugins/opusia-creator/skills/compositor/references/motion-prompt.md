# Motion Prompt を合成に使う

[Motion Prompt](https://github.com/showheyohtaki/motion-prompt) は動く見本と仕様の辞典。
タイトル、図、画面転換などに作例や番号を指定されたとき、または動きの具体化に役立つときに使う。

1. [motion の日本語一覧](https://github.com/showheyohtaki/motion-prompt/blob/main/packs/motion/README.ja.md)、[motion2 の日本語一覧](https://github.com/showheyohtaki/motion-prompt/blob/main/packs/motion2/README.ja.md)、[camera の日本語一覧](https://github.com/showheyohtaki/motion-prompt/blob/main/packs/camera/README.ja.md) から候補を探す。見本は `https://showheyohtaki.github.io/motion-prompt/#005` のように番号で参照できる。
2. 詳細は `https://showheyohtaki.github.io/motion-prompt/api/v1/ja/e/005.txt`（3 桁の番号を置換）を公開 URL の読み取りで確認する。届かなければ一覧と既存の効果を使い、数値やコードを推測しない。
3. 対象・開始時刻・尺・方向・強さ・イージングを作品の尺と音に合わせる。例: #005 の mask reveal はタイトルを枠から出す。実際の文字と行数は作品のものを使う。指定された番号以外を勝手に足さない。
4. まず画面の既存効果（`references/effects.md`）や HyperFrames の仕組みで実現する。必要なら見本のコードを参考にし、**コードを使う場合は上流の先頭の著作権・MIT ライセンス表示を残す**。外部コードをそのまま埋める前に、共有 kit への依存と HyperFrames の再生・フレーム単位レンダリングの契約を確認する。
5. 既存のチェックとプレビューで前後の繋がり、可読性、同期を確認する。見本の周期や寸法をそのまま作品の尺に押し付けない。ユーザーに指定された作例は番号と適用箇所、[見本](https://showheyohtaki.github.io/motion-prompt/)を報告する。

カメラの動きは撮影設計、ワイプ・ディゾルブなどは編集で作る。J/L カットは
映像と音の切り替え時刻をずらす編集であり、画面エフェクトではない。
