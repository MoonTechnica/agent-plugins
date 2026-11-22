# Motion Prompt をカメラ設計に使う

[Motion Prompt](https://github.com/showheyohtaki/motion-prompt) は動きの名前と作例の辞典。
ユーザーが番号・名前・作例を指定したとき、またはカメラの動きを具体化するのに役立つときに参照する。
番号だけを生成モデルに渡さず、作品の被写体と空間に翻訳する。

1. [カメラの日本語一覧](https://github.com/showheyohtaki/motion-prompt/blob/main/packs/camera/README.ja.md) で名前を探す。動く見本は `https://showheyohtaki.github.io/motion-prompt/#025` のように 3 桁の番号で開ける。
2. 指定番号の詳しい仕様は公開読み取り URL `https://showheyohtaki.github.io/motion-prompt/api/v1/ja/e/025.txt`（番号を置換）から確認する。取得できなければ一覧と既存の `shot-vocabulary.md` を使い、未確認の仕様を推測しない。
3. カメラの位置・向き、被写体、開始と終了、方向、速度・尺、注視点を書く。例えば #027 はカメラが被写体に近づく dolly in、#028 は位置を変えずレンズで寄る zoom in。両者を混同しない。
4. 具体化した英語のカメラ指示を文字コンテの `shot` に、必要な経路や注視条件を `note` に残し、絵コンテとプリビズへ引き継ぐ。生成モデルが見本どおりの動きや秒数を再現する保証はない。

`camera` には撮影以外に編集の切り替えや音の J/L カットもある。マッチカットは
別々の画を構図で合わせて編集し、ディゾルブやワイプはタイムラインで作る
（`ai-video-craft` の `references/seams.md`）。用語と軸の正本は `shot-vocabulary.md` と
`camera-design.md`。指定された番号以外を勝手に追加しない。番号未指定なら作品の意図に
合う候補を選び、演出を増やすこと自体を目的にしない。
