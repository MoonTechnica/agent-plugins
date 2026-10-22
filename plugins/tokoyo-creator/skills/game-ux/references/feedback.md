# 手応えの作り方（量の目安と道具ごとの書き方）

`SKILL.md` §2 の 4 種類の出来事に、何をどれだけ出すか。数値は**既定の目安**で、遊びに合わせて上下してよい。
ただし `SKILL.md` §5 の上限（画面の 20% 以上の点滅は 1 秒に 3 回まで・赤の全画面禁止）は超えない。

目次: 1 量の表 / 2 共通の作り（`effects`・ヒットストップ・揺れ・伸び縮み）/ 4 Godotの2D/3D / 6 効果音の 3 種類

## 1. 量の表

| 出来事 | 出すもの | 量の目安 |
|---|---|---|
| 押した | 押した物を 5〜10% 縮める / 明るくする → 80〜120ms で戻す。短い音 | 同じフレームで始める |
| 良い | 伸び縮み（縦 1.2 × 横 0.8 → 150ms で戻る）、パーティクル **6〜16 個**（0.3〜0.5 秒で消える）、浮かぶ数字（上へ 20〜40px・0.6 秒・後半で薄く）、高い音 | 100〜200ms |
| 当てた（攻撃が敵に当たった） | ヒットストップ **短く**（下の表）+ 当たった物の白い点滅 1 回（透明度か加算で 0.1 秒）+ ノックバック + 短い音 | 揺れは小さく（倒したときだけ） |
| 悪い | ヒットストップ **50〜100ms**（60fps で 3〜6 フレーム。強い衝突ほど長く）+ 揺れ **0.3 秒以内・振幅は画面の短辺の 2% まで** + 白か赤の点滅 **1 回**（0.1 秒・当たった物だけ）+ 低い音 | 揺れは `trauma`（0〜1）で持ち、量は `trauma²`、0.3 秒で 0 に戻す |
| 記録更新・クリア | 数字が増える（0.5 秒）→ 「NEW RECORD」が跳ねる（0.3 秒）→ 音 | 合計 1〜1.5 秒。タップ / キーで即座に最後の状態へ |
| 無効な操作 | 横に 4px 震える（2 往復）/ 一瞬灰色 + 短い低い音 | 100ms |

ヒットストップの長さ（ジャンルごとの手本はこれに揃える。`$game-controls` の references/genres.md・`$game-design` の references/genres-minimum.md も同じ値）:

| 場面 | 長さ |
|---|---|
| 連射する武器の 1 発が当たった（シューティング・ツインスティック） | 10〜20ms（止めすぎると連射が詰まる） |
| 1 回ずつの攻撃が当たった・敵を踏んだ（アクション・3D） | 50〜80ms |
| 格闘の打撃が当たった | 4〜6 フレーム（66〜100ms）。止まっている間も次の入力は受け付ける |
| やられた（自分が被弾した） | 50〜100ms |

イージング: 出るときは `easeOutCubic`（`1 - (1 - t) ** 3`）、消えるときは `easeInQuad`（`t * t`）で出るときの 6〜7 割の長さ。

## 2. 共通の作り

- **`effects`（0〜1）は 1 か所で掛ける**。揺れ・点滅・パーティクルを作る関数の中で掛け、呼び出し側に分岐を散らさない。
  `effects == 0` のとき、これらは呼ばれても何も起きない。**ヒットストップと音は `effects` に関係なく出す**。
- **ヒットストップはゲームの時間だけを止める**。UI・音・入力の押下状態は止めない。実時間で解除する（ポーズや画面が隠れたときに狂わない）。
- 揺れは**カメラ（`Camera2D.offset` / 3D はカメラの位置のずらし）で**行い、ゲームの座標（当たり判定）は動かさない。HUD は揺らさない。
- 浮かぶ数字・パーティクルは寿命付きで持ち、寿命が尽きたら消す（同時に出す数に上限を決める）。

```gdscript
# juice.gd（ゲームに 1 つ。Camera2D を渡して使う）
var effects := 1.0          # 設定の「画面の揺れ」で 0 になる（SKILL.md §5 / §7）
var trauma := 0.0           # 揺れの強さ 0〜1
var camera: Camera2D
var _rng := RandomNumberGenerator.new()

func hit(strength: float) -> void:              # 悪い出来事。strength は 0〜1
	hitstop(0.05 + 0.05 * strength)
	trauma = minf(1.0, trauma + strength * effects)
	sfx_bad.pitch_scale = _rng.randf_range(0.92, 1.08)
	sfx_bad.play()

func hitstop(seconds: float) -> void:
	Engine.time_scale = 0.05                    # 0 にはしない
	await get_tree().create_timer(seconds, true, false, true).timeout   # 実時間で数える
	Engine.time_scale = 1.0

func _process(delta: float) -> void:
	var real := delta / maxf(Engine.time_scale, 0.0001)   # 止まっている間も揺れは実時間で減る
	trauma = maxf(0.0, trauma - real / 0.3)
	var amount := trauma * trauma * 14.0                  # 720 基準の論理 px
	camera.offset = Vector2(_rng.randf_range(-1, 1), _rng.randf_range(-1, 1)) * amount

func squash(node: Node2D, stretch: Vector2) -> void:     # 例: ジャンプ (0.6, 1.4)、着地 (1.4, 0.6)
	if effects <= 0.0: return
	node.scale = stretch
	node.create_tween().tween_property(node, "scale", Vector2.ONE, 0.25).set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_OUT)
```

- 同じ対象に続けて Tween を掛けるなら、前の Tween を変数に持って `kill()` してから作る（競合して元に戻らない）。
- ヒットストップを重ねるとき（連続で当たる）は、長い方だけを残す（タイマーを数で持って最後の解除だけ効かせる）。

## 4. Godotの2D/3D

固定版GodotのAPI定義を確認する。実装の決まりは `$game-godot` references/best-practices.md の「Juice」「Audio」。
§1 の量と §2 の作りを Godot へ写すと:

| 手応え | Godot での書き方 |
|---|---|
| ヒットストップ | `Engine.time_scale = 0.05` → `get_tree().create_timer(秒, true, false, true).timeout` で 1.0 に戻す（最後の true で実時間）。UI の Tween は `set_ignore_time_scale(true)`。乱戦は当たった 2 体だけ止める。オンラインの権威 tick と入力送信は止めない |
| 揺れ | `trauma`（0〜1）を足し 0.1〜0.3 秒で減衰、`Camera2D.offset`（3D はカメラの子の位置）へ `trauma² ×` 数〜15px（720 基準）。向きのある出来事はその向きに揺らす。`position` は揺らさない |
| 伸び縮み | `scale` を Tween で（ジャンプ (0.6, 1.4)・着地は落下の速さに比例して最大 (1.6, 0.4) → 0.2〜0.35 秒で 1 に戻す）。同じプロパティの前の Tween は `kill()` |
| 白い点滅 | `modulate` を明るくして 0.1 秒で戻す（CanvasItem）。3D は `material_overlay` の発光を短く |
| 粒子 | 動く発生源は `CPUParticles2D`（物理補間時）。`one_shot` は `restart()` か複数を使い回す。上限を決める |
| 効果音 | `max_polyphony` 4〜8、`play()` の前に `pitch_scale = randf_range(0.92, 1.08)`。連鎖は回数で音程を上げる。Web ではバスのエフェクトが鳴らない |
| 押した反応 | 押したフレームで画面のボタン・主役の見た目を変える（入力を待つアニメの後で動かさない） |

HUDは別CanvasLayerへ置く。全画面flashを使わない。不要なエフェクトと音はシーン終了時に解放する。
`effects=0`と端末の動き軽減の設定では揺れ・点滅・粒子を止め、ヒットストップと音は残す。視覚だけ・音だけで必須情報を伝えない。

## 6. 効果音の 3 種類

最低限、**押す / 良い / 悪い** の 3 つを用意する。素材ツールで作るなら `$game-asset-tools` の効果音。
無いときは起動時に PCM を合成して `AudioStreamWAV` にする（Web の sample 再生でも鳴る。`AudioStreamGenerator` の
手続き生成は Web で鳴らないので使わない）。作るのは起動時に 1 回だけで、鳴らすたびに作らない:

```gdscript
func tone(from_hz: float, to_hz: float, seconds: float, volume: float, square := false) -> AudioStreamWAV:
	var rate := 22050
	var count := int(seconds * rate)
	var data := PackedByteArray()
	data.resize(count * 2)
	var phase := 0.0
	for i in count:
		var t := float(i) / count
		phase += TAU * lerpf(from_hz, to_hz, t) / rate
		var wave := signf(sin(phase)) if square else sin(phase)
		var envelope := (1.0 - t) * (1.0 - t)          # 立ち上がりは即、すぐ減衰
		data.encode_s16(i * 2, int(clampf(wave * envelope * volume, -1.0, 1.0) * 32767.0))
	var stream := AudioStreamWAV.new()
	stream.format = AudioStreamWAV.FORMAT_16_BITS
	stream.mix_rate = rate
	stream.data = data
	return stream

# 起動時に: press = tone(660, 520, 0.05, 0.3, true) / good = tone(660, 1320, 0.15, 0.5) / bad = tone(220, 90, 0.2, 0.5, true)
```

鳴らす `AudioStreamPlayer` は `bus = &"SFX"`、`max_polyphony` 4〜8。鳴らす前に `pitch_scale` を 0.92〜1.08 で少し揺らす。

連続で良いことが起きる遊び（連鎖・コンボ）は、回数に応じて `good` の `pitch_scale` を少しずつ上げると続けた手応えが出る。
