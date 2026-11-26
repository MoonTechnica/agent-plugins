## 戦闘の土台（$game-combat）。`godot/combat_kit.gd` にコピーし、`const Combat := preload("res://combat_kit.gd")` で使う。
## ノード・描画・音に触れない。rules.gd（$game-design §3）からも、敵のスクリプトからも呼べる。
##
## 1. 攻撃の段階: 予備動作（startup）→ 判定が出る（active）→ 硬直（recovery）をフレーム数で持ち、
##    経過フレームからいまの段階を返す。判定は active の間だけ出す。
## 2. 攻撃の順番待ち（AttackTokens）: 同時にプレイヤーへ攻撃してよい敵の数を絞る。
##    囲んだ敵が一斉に殴る「理不尽な同時攻撃」を防ぎ、1 体ずつ読める戦いにする。

enum Phase { STARTUP, ACTIVE, RECOVERY, DONE }


## 攻撃 1 つの定義。数値は godot/tuning.gd に置き、ここへ渡す。
static func attack(startup: int, active: int, recovery: int, damage: float, knockback: float = 0.0, hitstop: int = 4) -> Dictionary:
	return {"startup": startup, "active": active, "recovery": recovery, "damage": damage, "knockback": knockback, "hitstop": hitstop}


## 経過フレーム（0 始まり）からいまの段階。
static func phase(def: Dictionary, frame: int) -> Phase:
	if frame < int(def.startup):
		return Phase.STARTUP
	if frame < int(def.startup) + int(def.active):
		return Phase.ACTIVE
	if frame < total_frames(def):
		return Phase.RECOVERY
	return Phase.DONE


static func total_frames(def: Dictionary) -> int:
	return int(def.startup) + int(def.active) + int(def.recovery)


## 当てたあと、攻撃側が動けるまで / 受けた側が動けるまでの差（+ なら攻撃側が先に動ける）。
## hitstun は受けた側がのけぞるフレーム数。格闘・アクションで「当てたら反撃されない」かを数値で確かめる。
static func advantage_on_hit(def: Dictionary, hitstun: int) -> int:
	var remaining_after_first_active := int(def.active) - 1 + int(def.recovery)
	return hitstun - remaining_after_first_active


## 同じ攻撃が同じ相手に 1 回の振りで何度も当たらないよう、当てた相手を覚える。
## 攻撃を振り始めるたびに {} を作り直して渡す。
static func try_hit(hit_ids: Dictionary, target_id: int) -> bool:
	if hit_ids.has(target_id):
		return false
	hit_ids[target_id] = true
	return true


## 攻撃の順番待ち。1 体の敵が攻撃したいときに request() し、許されたら攻撃、終わったら release()。
## 許されなかった敵は間合いの外を回る・構える（待っているのが見える行動にする）。
class AttackTokens:
	extends RefCounted
	var capacity: int
	var cooldown: float            # 返された札が再び使えるまでの秒（連続で殴られ続けないように）
	var _holders := {}             # id -> true
	var _cooling: Array[float] = []

	func _init(capacity_: int = 1, cooldown_: float = 0.4) -> void:
		capacity = capacity_
		cooldown = cooldown_

	func request(id: int) -> bool:
		if _holders.has(id):
			return true
		if _holders.size() + _cooling.size() >= capacity:
			return false
		_holders[id] = true
		return true

	func release(id: int) -> void:
		if _holders.erase(id):
			_cooling.append(cooldown)

	## 倒された・消えた敵の札を、冷却なしで返す。
	func forget(id: int) -> void:
		_holders.erase(id)

	func step(dt: float) -> void:
		var kept: Array[float] = []
		for left in _cooling:
			if left - dt > 0.0:
				kept.append(left - dt)
		_cooling = kept

	func holding(id: int) -> bool:
		return _holders.has(id)
