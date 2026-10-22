---
name: game-open-world
description: 広い世界（8 km四方級まで）を局所的に読み込み、解放して長く遊べるようにする。地域ごとの追加pack、GDScriptのクリップマップ地形、作者設計map/seed生成、時間予算、活動NPC、地域資源の所有、進行保存/再開、協力卓のチェックポイントを扱う。探索・RPG・サンドボックスを作るときに使う。open world, RPG, chunks, streaming, save, memory.
---

# オープンワールド・長時間探索

実装前に`$game-design` references/performance-risk.md §0を読む。地域読み込み/活動範囲/資源寿命を
最初から設計し、その上で実描画を測って必要な追加最適化を行う。世界を広げてから基本対策を後付けしない。
RPGの進行は `$game-design` references/rpg.md。SDK APIの正本は `<kit>/sdk/app-sdk/spec.md`。
地域の役割・接続・配置・生成候補の選定は `$game-level-design`。このSkillは採用した世界の読み込み・活動範囲・保存を扱う。
エンジンAPIは固定版Godotの公式マニュアル/API定義で確認する。8 km四方級（原点中心で±4 km）までの世界を作れる。
起動前に届く主PCKは64 MiBまでで、地域ごとの素材は**地域ごとの追加pack**（`spec.md` §8.6）で近づいたときに取り寄せる。
減らすのは同時にメモリへ載せる地域・活動させる処理の量と、1回のプレイで読む地域packの総量。
雰囲気と「次に行きたい場所」の作り方は `$game-level-design` references/genre-spaces.md §5。広さそのものを面白さにしない。
世界規模・活動NPC・生成・描画方式を決める段階で `$game-design` references/performance-risk.md を読み、
懸念を先に伝え、代表的な地域の最小試作を実描画して比較する。広げてから負荷を調べない。

## 1. 世界と活動範囲

作者設計の地域データ/tilemap/GLB、seed生成、両者の組み合わせを使える。総面積ではなく現在の負荷を限定する。
部屋/場所を切り替える世界も使える。切替方式と実世界/マップメニューの対応は `$game-level-design`
references/transitions-and-map.md。地域/部屋・シーン・chunkを同じ単位と決めつけず、小さい場所切替へ半径式の管理を強制しない。

- 地形はチャンクへ分割する。32mや32–64tileは初期候補であり保証値ではない。
- 読み込み半径r、保持半径r+1、描画、physics、AI、骨格animationの範囲を別に決める。
  r=2なら読み込み25に対し保持集合の保守的上限49。r=3なら49に対し81。
- タッチの有無は操作方式の判定だけ。スマホ/PCの別や描画方式だけで性能を判断しない。
- 中心チャンク/進行方向が変わった時にqueueを更新する。全候補を毎frame配列化/sortしない。
- 近傍NPCの感知/経路探索だけ更新し、時間分散と要求上限を持つ。不可視meshにも計算が残り得る。
- 表示と衝突が準備できるまで未ロード地域へ進めない。teleportはロード画面と進捗を用意する。
- 徒歩だけでなく、その作品で可能な最大移動速度/急な方向転換/境界往復を先読み設計に含める。
  霧で隠しただけでmesh/physics/AIの処理が減ったとは扱わず、活動範囲とLODを別に管理する。

## 1.5 広い地形（8 km級）

GDExtensionの地形（Terrain3D等）は使えない（WebとiOSの実行環境が拒否する）。GDScriptとシェーダで作る。
そのまま動く実装例（リング・シェーダ・周辺の当たり判定・植生）は [references/large-terrain.md](references/large-terrain.md)。ゼロから書かずにこれを作品に合わせて直す。

- **座標**: 世界の中心を原点に置き、端まで±4096 m以内にする。単精度のまま、原点の移動もしない
  （Godot公式の推奨範囲。対戦サーバーとの座標も揃えやすい）。
- **描画**: 地形はクリップマップ。中心ほど細かい同心のグリッドメッシュを数枚、起動時に`ArrayMesh`で作り、カメラに合わせて
  グリッド単位でずらす。高さは`ShaderMaterial`の頂点シェーダで高さテクスチャから`VERTEX.y`を変える。
  シェーダで動かした頂点はAABBと合わないので、`custom_aabb`（または`extra_cull_margin`）を設定して誤ったカリングを防ぐ。
- **高さデータ**: 粗い世界全体の高さ（例: 2048²の16 bit）は主PCK、細かい高さタイルは地域packに入れる。8 bitの高さは段差になるので使わない。
- **当たり判定**: 利用者（と対戦相手）の周囲の数チャンクだけ`HeightMapShape3D`を作り、離れたら外す。生成もフレームの時間予算に含める。
- **植生・小物**: `MultiMeshInstance3D`を地域×区画ごとに分ける（1つのMultiMeshは全体で同じLODになる）。配置表は地域packに置く。
  半透明を避け、不透明かアルファテストにする。
- **遠景**: 霧で遠景を消し、`Camera3D.far`を縮める（既定4000。1.5〜2 kmから実測で決める）。さらに遠くは最も粗いリングで描く。
  影の距離は延ばさない。Web・モバイルのCompatibility rendererでは可視範囲（`visibility_range_*`）のフェードが効かず即座に切り替わるので、
  切り替わる距離を見通しの悪い場所に置く。遮蔽カリングはWebの標準テンプレートに無いので頼らない。
- **読み込み**: スレッドが無い環境では`ResourceLoader.load_threaded_request`も同期で最後まで走る。地域のシーンを小さく分け、§2の予算で
  1件ずつ`load`→`instantiate`→`add_child`を進める。地域packの取得（`TokoyoApp.regions.load`）は境界の手前で先に始める。
- **地域pack**: `godot/regions/<地域>/`に地域の素材を置く（1 km²前後を目安に作品で決める）。packは外せないので、
  近づいた地域だけを読み、1回のプレイで読む総量を設計で抑える。Webでは読んだpackの大きさがそのままタブのメモリに残る。
- **容量の上限**: 書庫は圧縮後200 MiBまでで、主PCK・Webのランタイム・全地域packが入る。地域packに使えるのはおよそ150 MiB前後。
  地形・植生は高さデータと配置の規則で作り（数MB）、容量は作り込んだ場所（町・遺跡・主要な建物）に使う。テクスチャは共有し、
  地域ごとに同じ素材を複製しない（共通素材は主PCKへ）。

## 2. 時間予算と取消

「1フレーム1チャンク」は停止時間を保証しない。生成/組立/load/instantiate/解放を小さな工程に分け、
`_process` の中で時間予算を見ながら少しずつ進める。Web は single-threaded、iOS の組み込み runtime では
スクリプトが作るスレッドと `WorkerThreadPool` が使えないので、重い処理をスレッドへ逃がす設計にしない。

```gdscript
const BUDGET_USEC := 2000          # 調整用の初期値。1つの工程そのものは途中で止められない
var _jobs: Array[Dictionary] = []  # {id, steps: Array[Callable], next: int}

func _process(_delta: float) -> void:
	var start := Time.get_ticks_usec()
	while not _jobs.is_empty() and Time.get_ticks_usec() - start < BUDGET_USEC:
		var job: Dictionary = _jobs[0]
		job.steps[job.next].call()   # 地形 1 行・配置 1 塊・instantiate 1 つ、のように小さく
		job.next += 1
		if job.next >= job.steps.size():
			_jobs.pop_front()

func cancel(region_id: String) -> void:
	# 取り消した地域で作りかけの Node は queue_free() し、登録前の Resource 参照を手放す
	_jobs = _jobs.filter(func(j): return j.id != region_id)
```

- 地域離脱でその地域のjobを取り消す。後から完了したものは世代/所有を照合し、不要なNodeを木に入れず解放する。
- 大きな同期load/instantiateを別の関数に包むだけでは分割にならない。地域シーンの分割と段階別測定が先。
- pauseで時計の基準をresetしsimulationを止める。通常の低FPSを一律33ms capで遅くしない。
- 実frame時間（`Time.get_ticks_usec()` の差）を有限の履歴に残してp50/p95/p99と最大停止、各jobの時間を出し、`TokoyoApp.report()` で記録する。
  `Performance` の `TIME_PROCESS` などはCPU側の時間で、GPU完了時間ではない。

## 3. 資源の所有と地域素材

地域ごとの素材と定義は `godot/regions/<地域>/`（地域のシーン `.tscn` と、その地域だけが使う素材）に置き、
`manifest.json` の `godot.regions` と `bundles` に同じ名前で宣言する（`spec.md` §8.6）。地域のフォルダは主PCKから外れ、
地域ごとのpackになる。隣の地域が保持半径に入ったら `TokoyoApp.regions.load(name)` で取り寄せ、重ねてから
`load()` して工程を分けて instantiate する。packのファイルを読むことと、decode/GPUに載ったメモリは別に数える。

- 地域専用資源と常駐/共有資源を分け、最後の利用者が共有資源を解放する。
- Godotの地域Nodeはqueue_free()し、autoload・signal・キャッシュがResource参照を保持していないか調べる。
  共有material/textureは最後の利用者が解放する。MultiMeshは地域×モデル単位にし、活動範囲を制限する。
- 地域を離れたらその地域のNodeを`queue_free()`し、地域専用のResourceへの参照（変数・辞書・キャッシュ）を消す。参照が残る限りGPU/audioは解放されない。
- 読み込み中に離れたら、後から届いた結果を木に入れず捨てる。同じ地域を読み直すときは進行中の読み込みに合流する。
  複数地域が同じ素材を借りるなら利用者数を管理し、最後の利用者だけが参照を手放す。

## 4. 決定的生成と保存

- 生成worldはseed＋生成方式version＋安定ID＋差分＋位置/進行を保存。作者設計worldは定義版＋安定ID＋進行。
- 生成は描画から分離し整数hashと`seed`を固定した`RandomNumberGenerator`を使う。グローバルの`randf()`/`randomize()`や実装依存のsin noiseを使わない。
  同seed/version/座標の再現と境界一致を検査。camera方向のsin/cosは生成ではない。
- 改変はStoreの`blob`フィールドへ。上限1MiBはgzip+base64後の最終JSON UTF-8。圧縮だけで無限改変を保証しない。
- 活動中の定期/重要進行時にdirtyをまとめ、毎分12write以内で保存する。
  `TokoyoApp.save()` は保存中の次の保存を1つにまとめ、revisionとrequest IDを付ける。`save_status()` / `store_saved` で確定を確かめ、`failed` なら同じ内容を再試行する。
  保存する値は保存時点の小さな写し（`duplicate(true)`）にし、巨大なworldやNodeを渡さない。
- `TokoyoApp.is_paused()` の間はsaveしない（paused中は拒否）。入力/simulationを止め、resume後に未保存分を再試行する。
  OS終了前の非同期完了は保証しない。未保存/最後の確定/競合/容量超過を画面で知らせる。
- 毎保存で最新revisionだけreadして古いローカルworldを上書きしない。起動revision→ACK revisionを使う。
- 生成版変更/rollbackで旧IDが別物を指さないようにする。読めない旧セーブを消して新worldにしない。

## 5. メモリ予算

素材の静的概算＋保持チャンク集合＋旧新地域の重複＋decode/upload＋手続き生成＋骨格/RTT/保存snapshotを計上する。
groupは同時保持の宣言であり実行時の保持数を強制しない。見積もりは実機安全性の保証ではない。

- 3D textureは固定版Godotのimport設定で圧縮し、Web/nativeの実際のGPU資源量と非圧縮時の上限を別計上する。
- 単色/頂点色で済む地形はtexture不要。長いBGMはstreaming、短い効果音は共有decode。
- 512/768MiBは素材警告の目安。OS総メモリ上限ではない。対象端末でruntime資源の頭打ちを確認する。

## 6. 協力world

ルール/敵/改変は `$game-multiplayer` のサーバー権威。次回のworldは `$game-documents`、個人持ち物はstore。
共有documentのサイズ/件数/失効/書込権を守る。1卓は最長30分でソロの総プレイ時間制限ではない。
**上限前から定期チェックポイント。timeoutの`finished`で初めて保存しない。** 切断/所有者交代/競合を定義し、
終了前に知らせ次の卓から続ける導線を作る。永久共有世界や無期限卓を既存SDKが保証すると説明しない。

## 7. チェック

- [ ] 生成版/安定IDと進行保存/再開があり、読込失敗を空データで上書きしない
- [ ] 作業は時間/個数の予算を持ち、不要jobと後着結果を解放する
- [ ] 保持r+1/遷移ピーク/共有資源を予算に含める
- [ ] NPC/physics/骨格/探索を局所化し、描画非表示だけで停止と扱わない
- [ ] pause/resumeが冪等で、停止中APIを呼ばず活動中に保存を確定する
- [ ] 公開前スモークと長時間QAの未確認を区別。長時間QAは `$game-playtest` §5
