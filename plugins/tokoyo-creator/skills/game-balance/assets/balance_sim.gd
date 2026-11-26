extends SceneTree
## 数値の分布を見る（$game-balance §4）。ゲームの `scripts/balance_sim.gd` にコピーし、
## 下の POLICIES と TARGETS をこのゲームに合わせて書き換える。
##
##   godot --headless --path godot --script ../scripts/balance_sim.gd              # res://rules.gd を回す
##   godot --headless --path godot --script ../scripts/balance_sim.gd -- res://x.gd  # 別のルールファイル
##
## `godot/` の外に置く（本番の pack に入れない）。rules.gd は $game-design §3 の形
## （init(seed) / step(state, input, dt) / is_over(state) / score(state) の static 関数）。
## 腕前の違う何人かの「遊ぶ人」を多数の seed で遊ばせ、終わるまでの時間と点数の分布、
## 何秒台で終わったか（難しさの山）を表で出す。TARGETS を外れた行は ✗、全部収まれば終了コード 0。
## これは遊んだ感覚の代わりではない。「初心者が 5 秒で全員死ぬ」「上手い人が永遠に終わらない」のような
## 壊れた数値を、触る前に見つけるための道具。

const DT := 1.0 / 60.0
const SEEDS := 64            # seed の数。重いルールなら 16〜32 に減らす
const MAX_SECONDS := 300.0   # これを超えたら「終わらない」として打ち切る
const BUCKET := 10.0         # 終わった時刻を何秒ごとに数えるか

# ---------------------------------------------------------------------------
# POLICIES: 腕前ごとの遊ぶ人。input(t, state, rng) を返す。rules.gd の input の形に合わせて書き換える。
# 雛形は左右に動くアクション向け（ずっと同じ向き / でたらめ / 一定の間隔で切り返す）。
# 「上手い人」は state を読んで判断してよい（危険を見て避ける等）。完璧な bot にはしない（反応の遅れを入れる）。
# ---------------------------------------------------------------------------
func _policies() -> Array:
	return [
		["初めての人（でたらめ）", func(_t: float, _state: Dictionary, rng: RandomNumberGenerator) -> Dictionary:
			return {"left": rng.randf() < 0.3, "right": rng.randf() < 0.3}],
		["慣れた人（切り返す）", func(t: float, _state: Dictionary, _rng: RandomNumberGenerator) -> Dictionary:
			return {"right": int(t * 1.5) % 2 == 0, "left": int(t * 1.5) % 2 == 1}],
	]


# TARGETS: 腕前ごとの狙い（brief の「1 回の長さ」「進み方」から決める）。使わない項目は消す。
#   min_p10 / max_p50 …… 終わるまでの秒（p10 = 下位 10%、p50 = 中央値、p90 = 上位 10%）
#   min_unfinished / max_unfinished …… MAX_SECONDS まで終わらなかった割合（0〜1）
func _targets() -> Dictionary:
	return {
		"初めての人（でたらめ）": {"min_p10": 5.0, "max_p50": 120.0},
		"慣れた人（切り返す）": {"min_p10": 10.0, "max_unfinished": 0.5},
	}

# ---------------------------------------------------------------------------

var _rules: GDScript
var _failed := false


func _initialize() -> void:
	var args := OS.get_cmdline_user_args()
	var path: String = args[0] if args.size() > 0 else "res://rules.gd"
	_rules = load(path)
	if _rules == null:
		printerr("✗ %s を読み込めない" % path)
		quit(1)
		return
	for name in ["init", "step", "is_over", "score"]:
		if not _rules.has_method(name):
			printerr("✗ %s に %s が無い（static func で書く。進行型の数値は $game-balance §4 の手で表を作る）" % [path, name])
			quit(1)
			return
	var targets := _targets()
	for policy in _policies():
		_report(policy[0], policy[1], targets.get(policy[0], {}))
	quit(1 if _failed else 0)


func _report(name: String, input: Callable, target: Dictionary) -> void:
	var ends: Array[float] = []
	var scores: Array[float] = []
	var unfinished := 0
	var buckets := {}
	for seed in range(1, SEEDS + 1):
		var run := _simulate(seed, input)
		scores.append(run.score)
		if run.over:
			ends.append(run.ended_at)
			var bucket := int(run.ended_at / BUCKET)
			buckets[bucket] = int(buckets.get(bucket, 0)) + 1
		else:
			unfinished += 1
	ends.sort()
	scores.sort()
	var share := float(unfinished) / SEEDS
	print("■ %s（%d 回）" % [name, SEEDS])
	print("  終わるまで: p10 %s / p50 %s / p90 %s 秒、終わらない %d%%" % [
		_fmt(_pct(ends, 0.1)), _fmt(_pct(ends, 0.5)), _fmt(_pct(ends, 0.9)), roundi(share * 100.0)])
	print("  点数: p10 %s / p50 %s / p90 %s" % [_fmt(_pct(scores, 0.1)), _fmt(_pct(scores, 0.5)), _fmt(_pct(scores, 0.9))])
	var keys := buckets.keys()
	keys.sort()
	var line := PackedStringArray()
	for key in keys:
		line.append("%d〜%ds:%d" % [key * BUCKET, (key + 1) * BUCKET, buckets[key]])
	if not line.is_empty():
		print("  終わった時刻: " + "  ".join(line))
	_check(name, "min_p10", target, _pct(ends, 0.1), func(v, goal): return v >= goal, "下位 10%% が %s 秒で終わる（目標 %s 秒以上）")
	_check(name, "max_p50", target, _pct(ends, 0.5), func(v, goal): return v <= goal, "中央値が %s 秒（目標 %s 秒以下）")
	_check(name, "min_unfinished", target, share, func(v, goal): return v >= goal, "終わらない割合 %s（目標 %s 以上）")
	_check(name, "max_unfinished", target, share, func(v, goal): return v <= goal, "終わらない割合 %s（目標 %s 以下）")


func _check(name: String, key: String, target: Dictionary, value: float, ok: Callable, message: String) -> void:
	if not target.has(key):
		return
	if is_nan(value):   # 1 回も終わらなかった。p10 / p50 の目標は満たせない
		_failed = true
		print("  ✗ %s: 1 回も終わらない（MAX_SECONDS まで遊べてしまう）" % key)
		return
	if ok.call(value, target[key]):
		print("  ✓ %s" % key)
	else:
		_failed = true
		print("  ✗ " + message % [_fmt(value), _fmt(target[key])])


func _simulate(seed: int, input: Callable) -> Dictionary:
	var state: Dictionary = _rules.init(seed)
	var rng := RandomNumberGenerator.new()
	rng.seed = seed * 7919 + 1   # 遊ぶ人の乱数はルールの乱数と分ける
	var steps := roundi(MAX_SECONDS / DT)
	for index in range(1, steps + 1):
		state = _rules.step(state, input.call(index * DT, state, rng), DT)
		if _rules.is_over(state):
			return {"over": true, "ended_at": index * DT, "score": float(_rules.score(state))}
	return {"over": false, "ended_at": MAX_SECONDS, "score": float(_rules.score(state))}


func _pct(sorted: Array[float], p: float) -> float:
	if sorted.is_empty():
		return NAN
	return sorted[clampi(int(floor(p * (sorted.size() - 1))), 0, sorted.size() - 1)]


func _fmt(value: Variant) -> String:
	if typeof(value) == TYPE_FLOAT and is_nan(value):
		return "—"
	return "%.1f" % float(value)
