extends SceneTree
## 対戦サーバーのルール（`godot/server/rules.gd` = `extends TokoyoRules`）の自己試遊（$game-playtest §2b）。
## `playtest_rules.gd` は 1 人用の static 関数のルール用なので、`TokoyoRules` はこちらで確かめる。書き換えは要らない。
## `godot/` の外（`scripts/playtest_server.gd`）にコピーして使う。本番の pack に入れない。
##
##   godot --headless --path godot --script ../scripts/playtest_server.gd                         # res://server/rules.gd・2 席
##   godot --headless --path godot --script ../scripts/playtest_server.gd -- res://server/rules.gd 4   # 席数を変える
##
## 全部 ✓ なら終了コード 0、1 つでも ✗ なら 1。**出力に `SCRIPT ERROR` が 1 行でも出たら失敗**
## （GDScript の実行時エラーは例外にならず、Godot は止まらずに続けるので、このスクリプトからは捕まえられない）。
## `playtest_server.sh` がそこまで見て終了コードにする。
## ゲーム固有の勝ち方・面白さは確かめない。確かめるのは、サーバーが壊れずに決着まで進む最低限:
##   状態が送れる形か・入力が壊れたり極端でも壊れないか・決着が 1 回だけで全員分か・離脱と変なメッセージで壊れないか。

const DEFAULT_PATH := "res://server/rules.gd"
const STATE_MAX_BYTES := 256 * 1024
const MESSAGE_MAX_BYTES := 4096
const INPUT_FIELDS_MAX := 64
## Platform の卓の最長（maxDurationSec の上限）に合わせて、放置・遊びを回す長さ。
const IDLE_SECONDS := 125.0
const FUZZ_SECONDS := 60.0

var _failed := false
var _sent: Array = []
var _finishes: Array = []
var _rules_script: GDScript
var _players := 2


func _initialize() -> void:
	var args := OS.get_cmdline_user_args()
	var path: String = args[0] if args.size() > 0 else DEFAULT_PATH
	_players = int(args[1]) if args.size() > 1 else 2
	_rules_script = load(path)
	if _rules_script == null:
		printerr("✗ %s を読み込めない" % path)
		quit(1)
		return
	var probe = _rules_script.new()
	if not (probe is TokoyoRules):
		printerr("✗ %s は TokoyoRules を継承していない（extends TokoyoRules）" % path)
		quit(1)
		return
	_check("tick_rate は 10〜60", _tick_rate_ok(probe))
	_check("input_fields の宣言が正しい（n は英字で始まる 32 文字まで・k は f か b・d の型が k と合う・64 項目まで）", _fields_ok(probe))
	_check("setup が、送れる形の状態を作る（数・真偽・文字列・配列・Dictionary だけ・有限・256 KiB まで）", _setup_ok())
	_check("放置で %d 秒回しても壊れない（状態が常に送れる形・finish は高々 1 回・決着の形が正しい）" % int(IDLE_SECONDS), _run_ok(IDLE_SECONDS, false))
	_check("極端・不正な入力（±1e30・範囲外・向きの反転）で %d 秒回しても壊れない" % int(FUZZ_SECONDS), _run_ok(FUZZ_SECONDS, true))
	_check("1 席だけ離れても、全員が離れても壊れない（finish は高々 1 回）", _leave_ok())
	_check("on_join / on_message に変な値（null・巨大・入れ子・NaN・platform:）を渡しても壊れない", _messages_ok())
	quit(1 if _failed else 0)


func _check(label: String, problem: String) -> void:
	if problem == "":
		print("✓ ", label)
	else:
		_failed = true
		print("✗ ", label, "\n    ", problem)


func _tick_rate_ok(rules) -> String:
	var rate = rules.tick_rate
	if typeof(rate) not in [TYPE_INT, TYPE_FLOAT] or rate < 10 or rate > 60:
		return "tick_rate = %s" % str(rate)
	return ""


func _fields_ok(rules) -> String:
	var fields = rules.input_fields()
	if typeof(fields) != TYPE_ARRAY:
		return "input_fields() が配列を返さない"
	if fields.size() > INPUT_FIELDS_MAX:
		return "項目が %d 個（上限 %d）" % [fields.size(), INPUT_FIELDS_MAX]
	var pattern := RegEx.create_from_string("^[A-Za-z][A-Za-z0-9_]{0,31}$")
	var seen := {}
	for field in fields:
		if typeof(field) != TYPE_DICTIONARY:
			return "項目が Dictionary でない: %s" % str(field)
		var name = field.get("n")
		if typeof(name) != TYPE_STRING or pattern.search(name) == null:
			return "n が不正: %s" % str(name)
		if seen.has(name):
			return "n が重複: %s" % name
		seen[name] = true
		var kind = field.get("k")
		if kind not in ["f", "b"]:
			return "%s の k が f / b でない: %s" % [name, str(kind)]
		if not field.has("d"):
			return "%s に既定値 d が無い" % name
		var d = field.get("d")
		if kind == "f" and typeof(d) not in [TYPE_INT, TYPE_FLOAT]:
			return "%s は k = f なのに d が数でない" % name
		if kind == "b" and typeof(d) != TYPE_BOOL:
			return "%s は k = b なのに d が真偽でない（0 / 1 ではなく true / false）" % name
	return ""


## 送れる値だけか（Platform は状態を JSON にして全員へ送る）。
func _value_problem(value: Variant, path: String, depth: int = 0) -> String:
	if depth > 16:
		return "%s が深すぎる（16 段まで）" % path
	match typeof(value):
		TYPE_BOOL, TYPE_STRING, TYPE_STRING_NAME:
			return ""
		TYPE_INT:
			return ""
		TYPE_FLOAT:
			return "" if is_finite(value) else "%s が NaN / 無限大" % path
		TYPE_ARRAY:
			for i in value.size():
				var problem := _value_problem(value[i], "%s[%d]" % [path, i], depth + 1)
				if problem != "":
					return problem
			return ""
		TYPE_PACKED_FLOAT32_ARRAY, TYPE_PACKED_FLOAT64_ARRAY:
			for i in value.size():
				if not is_finite(value[i]):
					return "%s[%d] が NaN / 無限大" % [path, i]
			return ""
		TYPE_PACKED_INT32_ARRAY, TYPE_PACKED_INT64_ARRAY, TYPE_PACKED_BYTE_ARRAY, TYPE_PACKED_STRING_ARRAY:
			return ""
		TYPE_DICTIONARY:
			for key in value:
				if typeof(key) not in [TYPE_STRING, TYPE_STRING_NAME, TYPE_INT]:
					return "%s のキー %s が文字列でも整数でもない" % [path, str(key)]
				var problem := _value_problem(value[key], "%s.%s" % [path, str(key)], depth + 1)
				if problem != "":
					return problem
			return ""
		_:
			return "%s は送れない型（%s）。Vector2 / Object / Callable / null は state に入れない（配列か数に分ける）" % [path, type_string(typeof(value))]


func _state_problem(ctx: TokoyoSpaceContext) -> String:
	var problem := _value_problem(ctx.state, "state")
	if problem != "":
		return problem
	var size := JSON.stringify(ctx.state).length()
	if size > STATE_MAX_BYTES:
		return "state が %d バイト（上限 %d）" % [size, STATE_MAX_BYTES]
	return ""


func _new_ctx(count: int) -> TokoyoSpaceContext:
	_sent = []
	_finishes = []
	var ctx := TokoyoSpaceContext.new(
		func(slot: int, type: String, payload: Variant) -> void: _sent.append([slot, type, payload]),
		func(type: String, payload: Variant) -> void: _sent.append([0, type, payload]),
		func(outcomes: Variant, ranks: Dictionary, scores: Dictionary, reason: String) -> void: _finishes.append([outcomes, ranks, scores, reason]),
	)
	ctx.seed = 4242
	for slot in range(1, count + 1):
		ctx.players.append({"slot": slot, "role": "player", "participantId": "p%d" % slot, "displayName": "P%d" % slot, "connected": true})
	return ctx


func _setup_ok() -> String:
	var rules = _rules_script.new()
	var ctx := _new_ctx(_players)
	rules.setup(ctx)
	return _state_problem(ctx)


## 実サーバーと同じ順: setup → 席が埋まるたびに on_join。
func _start(rules, ctx: TokoyoSpaceContext) -> void:
	rules.setup(ctx)
	for player in ctx.players:
		rules.on_join(ctx, player)


func _defaults(rules) -> Dictionary:
	var out := {}
	for field in rules.input_fields():
		out[field.n] = field.d
	return out


## 入力。Platform は `input_fields()` の宣言どおりに読み、形の違うものは捨てるので、ここで作るのは「宣言どおりの形で、値だけ極端」。
func _inputs(rules, slot: int, tick: int, fuzz: bool, rng: RandomNumberGenerator) -> Dictionary:
	var out := _defaults(rules)
	if not fuzz:
		return out
	for field in rules.input_fields():
		if field.k == "b":
			out[field.n] = rng.randf() < 0.5
		else:
			var pick := rng.randi_range(0, 5)
			out[field.n] = [0.0, 1.0, -1.0, 1.0e30, -1.0e30, rng.randf_range(-3.0, 3.0)][pick]
	return out


func _finish_problem(count: int) -> String:
	if _finishes.size() > 1:
		return "finish が %d 回呼ばれた（1 回だけ）" % _finishes.size()
	if _finishes.is_empty():
		return ""
	var outcomes = _finishes[0][0]
	if outcomes == null:
		return ""
	if typeof(outcomes) != TYPE_DICTIONARY:
		return "finish の outcomes が Dictionary でも null でもない"
	for slot in range(1, count + 1):
		if not outcomes.has(slot):
			return "finish の outcomes に席 %d が無い（キーは整数の席番号。全員分を入れる）" % slot
		if outcomes[slot] not in ["win", "lose", "draw"]:
			return "席 %d の結果が win / lose / draw でない: %s" % [slot, str(outcomes[slot])]
	return ""


func _run_ok(seconds: float, fuzz: bool) -> String:
	var rules = _rules_script.new()
	var ctx := _new_ctx(_players)
	var rng := RandomNumberGenerator.new()
	rng.seed = 4242
	_start(rules, ctx)
	var problem := _state_problem(ctx)
	if problem != "":
		return "setup / on_join 後: " + problem
	var dt := 1.0 / float(rules.tick_rate)
	var ticks := int(seconds * rules.tick_rate)
	for t in ticks:
		ctx.tick += 1
		ctx.dt = dt
		ctx._inputs = {}
		for player in ctx.players:
			ctx._inputs[player.slot] = _inputs(rules, player.slot, ctx.tick, fuzz, rng)
		rules.step(ctx)
		problem = _state_problem(ctx)
		if problem != "":
			return "tick %d: %s" % [ctx.tick, problem]
		problem = _finish_problem(_players)
		if problem != "":
			return "tick %d: %s" % [ctx.tick, problem]
		if ctx.finished:
			print("    · %.1f 秒で決着（%s）" % [ctx.tick * dt, "極端な入力" if fuzz else "放置"])
			break
	if not ctx.finished:
		print("    · %d 秒では決着しなかった（Platform が時間切れで結果なしにする）" % int(seconds))
	return ""


func _leave_ok() -> String:
	for leave_all in [false, true]:
		var rules = _rules_script.new()
		var ctx := _new_ctx(_players)
		var rng := RandomNumberGenerator.new()
		_start(rules, ctx)
		var dt := 1.0 / float(rules.tick_rate)
		for t in int(3.0 * rules.tick_rate):
			ctx.tick += 1
			ctx.dt = dt
			ctx._inputs = {}
			for player in ctx.players:
				ctx._inputs[player.slot] = _inputs(rules, player.slot, ctx.tick, false, rng)
			rules.step(ctx)
		var leaving: Array = ctx.players.duplicate() if leave_all else [ctx.players[0]]
		for player in leaving:
			player = player.duplicate()
			player.connected = false
			rules.on_leave(ctx, player)
			var problem := _state_problem(ctx)
			if problem != "":
				return "席 %d が離れた後: %s" % [player.slot, problem]
			problem = _finish_problem(_players)
			if problem != "":
				return "席 %d が離れた後: %s" % [player.slot, problem]
		# 離れた後も step が壊れない（卓は決着までは続く）。
		for t in int(2.0 * rules.tick_rate):
			ctx.tick += 1
			ctx.dt = dt
			ctx._inputs = {}
			rules.step(ctx)
		var problem := _state_problem(ctx)
		if problem != "":
			return "離れた後の step: " + problem
	return ""


func _messages_ok() -> String:
	var rules = _rules_script.new()
	var ctx := _new_ctx(_players)
	rules.setup(ctx)
	var deep: Variant = "x"
	for i in 12:
		deep = {"a": deep}
	var junk: Array = [null, 0, -1, 1.0e30, NAN, INF, "", "x".repeat(MESSAGE_MAX_BYTES), [], [[[[1]]]], {}, deep, true]
	var types := ["", "x", "pick", "move", "ready", "platform:join"]
	for player in ctx.players:
		rules.on_join(ctx, player)
		for type in types:
			for payload in junk:
				rules.on_message(ctx, player, type, payload)
	var problem := _state_problem(ctx)
	if problem != "":
		return "変なメッセージの後: " + problem
	return _finish_problem(_players)
