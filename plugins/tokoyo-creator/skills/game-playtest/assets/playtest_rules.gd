extends SceneTree
## ルールの自己試遊（$game-playtest §2）。ゲームの `scripts/playtest_rules.gd` にコピーして、
## 下の `_checks()` をこのゲームの rubric（design/playtest.md）に合わせて書き換える。
##
##   godot --headless --path godot --script ../scripts/playtest_rules.gd              # res://rules.gd を回す
##   godot --headless --path godot --script ../scripts/playtest_rules.gd -- res://x.gd  # 別のルールファイル
##
## `godot/` の外に置く（本番の pack に入れない）。rules.gd は描画・ノード・音・TokoyoApp に触れない
## static 関数だけにする（$game-design §3）:
##   init(seed) -> Dictionary / step(state, input, dt) -> Dictionary
##   アーケードは is_over(state) -> bool / score(state) -> float も持つ。
##   進行型は PROGRESSION を true にし、_checks() を保存・クエストの rubric へ置き換える。
## 全部 ✓ なら終了コード 0、1 つでも ✗ なら 1。

const PROGRESSION := false
const DT := 1.0 / 60.0

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
	var required := ["init", "step"] if PROGRESSION else ["init", "step", "is_over", "score"]
	var missing := required.filter(func(name): return not _rules.has_method(name))
	if not missing.is_empty():
		printerr("✗ %s に %s が無い（static func で書く）" % [path, " / ".join(missing)])
		quit(1)
		return
	for check in _checks():
		_run(check[0], check[1])
	quit(1 if _failed else 0)


# ---------------------------------------------------------------------------
# CHECKS: このゲームの rubric に合わせて書き換える。入力（idle / play）の形は rules.gd の input に合わせる。
# 雛形はアクション向け。放置で負ける遊び・入力が無いと進まない遊び（パズル・ターン制）では
# 「最初の手で状態が変わる」「解ける」など、その遊びに合う項目に置き換える。
# ---------------------------------------------------------------------------

## 何も押さない
func _idle(_t: float, _state: Dictionary) -> Dictionary:
	return {}


## うまく遊ぶ人の入力（このゲームの操作に書き換える）
func _play(t: float, _state: Dictionary) -> Dictionary:
	return {"right": int(t * 2.0) % 2 == 0}


func _checks() -> Array:
	return [
		["開始できる", func(): _expect(_rules.init(1) is Dictionary, "init が Dictionary を返さない")],
		["何もしなくても最初の 10 秒は終わらない", func():
			var run := simulate(1, 10.0, _idle)
			_expect(not run.over, "%.1f 秒で終わった（最初は失敗しにくくする）" % [run.ended_at])],
		["いつかは終わる（負けか時間切れが起きる）", func():
			_expect(simulate(1, 300.0, _idle).over, "5 分放置しても終わらない")],
		["遊ぶと点が増える", func():
			_expect(simulate(1, 20.0, _play).score > 0, "20 秒遊んでも点が 0")],
		["数値が壊れない", func():
			for input in [_idle, _play]:
				var run := simulate(1, 60.0, input)
				_expect(run.broken == "", "%s が NAN か INF になった" % run.broken)],
		["再挑戦で最初の状態に戻る", func():
			var first := var_to_str(_rules.init(1))
			simulate(1, 20.0, _play)
			_expect(var_to_str(_rules.init(1)) == first,
				"遊んだあとの init が最初と違う（randf を直接使っていないか・状態を使い回していないか）")],
	]


# ---------------------------------------------------------------------------

## 決まった入力で遊ぶ。input(t, state) は経過秒と状態から、その瞬間の入力を返す。
## 返り値: over / ended_at / score / state / broken（壊れた数値の場所。無ければ ""）/ samples（1 秒ごとの点数）
func simulate(seed: int, seconds: float, input: Callable) -> Dictionary:
	var state: Dictionary = _rules.init(seed)
	var samples: Array = []
	var steps := roundi(seconds / DT)
	var per_second := roundi(1.0 / DT)
	for index in range(1, steps + 1):
		var t := index * DT
		state = _rules.step(state, input.call(t, state), DT)
		var broken := _broken_number(state, "")
		if broken != "":
			return _result(false, -1.0, state, broken, samples)
		if index % per_second == 0:
			samples.append(_score(state))
		if not PROGRESSION and _rules.is_over(state):
			return _result(true, t, state, "", samples)
	return _result(false, -1.0, state, "", samples)


func _result(over: bool, ended_at: float, state: Dictionary, broken: String, samples: Array) -> Dictionary:
	return {"over": over, "ended_at": ended_at, "score": _score(state), "state": state, "broken": broken, "samples": samples}


func _score(state: Dictionary) -> float:
	return _rules.score(state) if _rules.has_method("score") else 0.0


func _broken_number(value: Variant, path: String) -> String:
	match typeof(value):
		TYPE_FLOAT:
			return path if is_nan(value) or is_inf(value) else ""
		TYPE_VECTOR2, TYPE_VECTOR3:
			return path if not value.is_finite() else ""
		TYPE_DICTIONARY:
			for key in value:
				var found := _broken_number(value[key], "%s.%s" % [path, key] if path else str(key))
				if found != "":
					return found
		TYPE_ARRAY:
			for i in value.size():
				var found := _broken_number(value[i], "%s[%d]" % [path, i])
				if found != "":
					return found
	return ""


var _current_failure := ""


func _expect(condition: bool, message: String) -> void:
	if not condition and _current_failure == "":
		_current_failure = message


func _run(name: String, check: Callable) -> void:
	_current_failure = ""
	check.call()
	if _current_failure == "":
		print("✓ %s" % name)
	else:
		_failed = true
		print("✗ %s — %s" % [name, _current_failure])
