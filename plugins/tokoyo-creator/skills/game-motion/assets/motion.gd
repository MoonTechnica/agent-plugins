extends RefCounted
## Shared motion for one game (game-motion SKILL.md §2). Copy to res://motion.gd and use as
##   const Motion := preload("res://motion.gd")
## Every duration lives in the constants below, so the feel is tuned in one place.
## Motion.effects follows the "screen shake / motion" setting (0..1). At 0, movement, scale and
## springs become an instant change or a short fade; colour and opacity changes still play
## (they carry information and are not "motion").
## Tween rules handled here once: one tween per node and property (the old one is killed),
## tweens are created from the node (they die with it), UI tweens ignore Engine.time_scale so a
## hit stop does not freeze menus.

# --- timing tokens (seconds) --------------------------------------------------------------------
const UI_ENTER := 0.225        # element comes in (Material: 225 ms)
const UI_EXIT := 0.195         # element leaves, shorter than entering
const UI_SCREEN := 0.3         # full screen change on phones (over 0.4 feels slow)
const UI_PRESS := 0.08         # button press feedback
const STAGGER_STEP := 0.04     # delay between list items
const STAGGER_MAX := 0.35      # the whole list is in by this time
const POP := 0.2               # pick-up / reward pop
const COUNT_MIN := 0.4         # number count-up, shortest
const COUNT_MAX := 1.0         # number count-up, longest

static var effects := 1.0

static func _tween(node: Node, key: String, ui: bool) -> Tween:
	var meta := StringName("_motion_" + key)
	if node.has_meta(meta):
		var old: Tween = node.get_meta(meta)
		if old != null and old.is_valid():
			old.kill()
	var tween := node.create_tween()
	if ui:
		tween.set_ignore_time_scale(true)
	node.set_meta(meta, tween)
	return tween

## Scale up then settle (pick-up, reward, "+10"). amount 0.25 = 125 % at the peak.
static func pop(node: Node, amount: float = 0.25, ui: bool = false) -> Tween:
	var base: Variant = _unit_scale(node)
	var tween := _tween(node, "scale", ui)
	if effects <= 0.0:
		node.scale = base
		tween.kill()
		return tween
	node.scale = base * (1.0 + amount * effects)
	tween.tween_property(node, "scale", base, POP).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	return tween

## Volume-keeping squash (amount > 0 flattens: landing) or stretch (amount < 0: take-off).
static func squash(node: Node, amount: float, hold: float = 0.06, back: float = 0.16) -> Tween:
	var tween := _tween(node, "scale", false)
	var base: Variant = _unit_scale(node)
	if effects <= 0.0:
		node.scale = base
		tween.kill()
		return tween
	var y := 1.0 - amount * effects
	var side := 1.0 / sqrt(maxf(y, 0.05))
	var target: Variant = Vector2(side, y) if base is Vector2 else Vector3(side, y, side)
	tween.tween_property(node, "scale", target, hold).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)
	tween.tween_property(node, "scale", base, back).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	return tween

static func _unit_scale(node: Node) -> Variant:
	return Vector3.ONE if node is Node3D else Vector2.ONE

## Fade and slide a Control in from `offset` (pixels). Ends exactly at its current position.
static func enter(control: Control, offset: Vector2 = Vector2(0, 16), delay: float = 0.0) -> Tween:
	var end := control.position
	var tween := _tween(control, "enter", true)
	control.modulate.a = 0.0
	control.position = end + offset * effects
	tween.set_parallel(true)
	tween.tween_property(control, "modulate:a", 1.0, UI_ENTER).set_delay(delay)
	if effects > 0.0:
		tween.tween_property(control, "position", end, UI_ENTER).set_delay(delay).set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_OUT)
	else:
		control.position = end
	return tween

## Fade a Control out (accelerating), then hide it.
static func exit(control: Control) -> Tween:
	var tween := _tween(control, "enter", true)
	tween.tween_property(control, "modulate:a", 0.0, UI_EXIT).set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_IN)
	tween.tween_callback(control.hide)
	return tween

## Enter a list of Controls one after another; the last one starts by STAGGER_MAX at the latest.
static func stagger(controls: Array, offset: Vector2 = Vector2(0, 12)) -> void:
	var step := STAGGER_STEP
	if controls.size() > 1:
		step = minf(STAGGER_STEP, STAGGER_MAX / (controls.size() - 1))
	for i in controls.size():
		enter(controls[i], offset, step * i)

## Count a Label from one number to another (scores, coins). Longer for bigger changes, capped.
## Call finish(label) when the player presses a button to jump to the end.
static func count_up(label: Label, from: int, to: int, format: String = "%d") -> Tween:
	var tween := _tween(label, "count", true)
	label.set_meta(&"_motion_count_target", format % to)
	var seconds := clampf(COUNT_MIN + absf(to - from) / 2000.0, COUNT_MIN, COUNT_MAX)
	tween.tween_method(func(v: float) -> void: label.text = format % roundi(v), float(from), float(to), seconds).set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_OUT)
	return tween

static func finish(label: Label) -> void:
	if label.has_meta(&"_motion_count") and label.get_meta(&"_motion_count") is Tween:
		var tween: Tween = label.get_meta(&"_motion_count")
		if tween.is_valid():
			tween.kill()
	if label.has_meta(&"_motion_count_target"):
		label.text = label.get_meta(&"_motion_count_target")

## Button press: shrink quickly while held, spring back on release. Connect once per button.
static func press_feedback(button: BaseButton) -> void:
	button.resized.connect(func() -> void: button.pivot_offset = button.size / 2.0)
	button.pivot_offset = button.size / 2.0
	button.button_down.connect(func() -> void:
		if effects > 0.0:
			_tween(button, "scale", true).tween_property(button, "scale", Vector2.ONE * 0.95, UI_PRESS))
	button.button_up.connect(func() -> void:
		_tween(button, "scale", true).tween_property(button, "scale", Vector2.ONE, UI_PRESS * 2.0).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT))

## Second-order spring follower (t3ssel8r, "Giving Personality to Procedural Animations").
##   f: speed (Hz). z: damping (<1 overshoots, 1 critical, >1 sluggish).
##   r: start (0 eases in, 1 follows at once, >1 overshoots, <0 first moves back = anticipation).
## Use for camera follow, hats/tails/weapons lagging, leaning into acceleration, cursors, turrets.
## Starting values: snappy f=4 z=0.6 r=1.5 / heavy f=1.5 z=1 r=0 / jelly f=5 z=0.3 r=2.
class Spring:
	var k1: float
	var k2: float
	var k3: float
	var xp: Vector3
	var y: Vector3
	var yd := Vector3.ZERO

	func _init(f: float, z: float, r: float, start: Vector3) -> void:
		k1 = z / (PI * f)
		k2 = 1.0 / ((TAU * f) * (TAU * f))
		k3 = r * z / (TAU * f)
		xp = start
		y = start

	## Feed the target every frame; returns the smoothed value. Pass Motion.effects as `amount`:
	## at 0 it snaps to the target (reduced motion).
	func update(delta: float, target: Vector3, amount: float = 1.0) -> Vector3:
		if delta <= 0.0:
			return y
		if amount <= 0.0:
			xp = target
			y = target
			yd = Vector3.ZERO
			return y
		var xd := (target - xp) / delta
		xp = target
		var k2_stable := maxf(k2, maxf(delta * delta / 2.0 + delta * k1 / 2.0, delta * k1))
		y += delta * yd
		yd += delta * (target + k3 * xd - y - k1 * yd) / k2_stable
		return y
