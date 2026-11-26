extends Node3D
## 三人称の追従カメラ（$game-character-camera §3）。`godot/orbit_camera_3d.gd` にコピーして使う。
##
## 木の形（プレイヤーの子にしない。top_level で独立させ、位置だけ追う）:
##   CameraRig (Node3D, このスクリプト)      … 左右の向き（yaw）
##   └─ Pitch (Node3D)                       … 上下の向き（pitch）
##      └─ SpringArm3D                       … 壁に当たったら縮む（プレイヤーの体は除外する）
##         └─ Camera3D
##
## 視点の入力: マウス・タッチのドラッグは add_look(相対移動 px) を呼ぶ。右スティックは InputMap の
## look_left / look_right / look_up / look_down（あれば）を毎フレーム読む。
## 移動は flat_basis() でカメラの水平の向きに回す（スティックの上 = 画面の奥）。
## 利用者の操作なしにカメラを回さない（$game-ux §5）。背中側へ戻すのはボタン（InputMap の camera_reset など）で
## recenter() を呼んだときだけ。

@export var target: Node3D
@export var height := 1.4                    # 追う点（target からの高さ。頭より少し下）
@export var follow_speed := 12.0             # 位置の追従（大きいほど硬い）。1/秒
@export var distance := 4.5                  # 腕の長さ（SpringArm3D.spring_length）
@export var pitch_min_deg := -55.0           # 見下ろしの限界
@export var pitch_max_deg := 25.0            # 見上げの限界
@export var mouse_sensitivity := 0.25        # 度 / px
@export var stick_speed_deg := 160.0         # 右スティックを倒し切ったときの度 / 秒
@export var invert_y := false
@export var recenter_speed := 10.0           # recenter() で背中側へ戻る速さ。1/秒

@onready var _pitch: Node3D = $Pitch
@onready var _arm: SpringArm3D = $Pitch/SpringArm3D

var _yaw := 0.0
var _pitch_rad := deg_to_rad(-15.0)
var _recenter_to = null                      # float（目標の yaw）か null


func _ready() -> void:
	top_level = true
	_arm.spring_length = distance
	if target is CollisionObject3D:
		_arm.add_excluded_object((target as CollisionObject3D).get_rid())
	if target:
		global_position = target.global_position + Vector3.UP * height
		_yaw = target.global_rotation.y
	_apply()


## マウス / タッチのドラッグ量（px）。設定画面の感度はここの mouse_sensitivity で受ける。
func add_look(relative: Vector2) -> void:
	_turn(relative * mouse_sensitivity)


## キャラの背中側へ向き直す（ボタンを押したときに呼ぶ）。
func recenter() -> void:
	if target:
		_recenter_to = target.global_rotation.y


## カメラの水平の向き。移動の入力（x = 右、y = 下＝手前）を世界の向きへ回す。
func flat_basis() -> Basis:
	return Basis(Vector3.UP, _yaw)


func move_direction(input: Vector2) -> Vector3:
	var dir := flat_basis() * Vector3(input.x, 0.0, input.y)
	return dir.normalized() * minf(1.0, input.length()) if dir.length_squared() > 0.0001 else Vector3.ZERO


func _physics_process(delta: float) -> void:
	if target == null:
		return
	var stick := Vector2.ZERO
	if InputMap.has_action(&"look_left"):
		stick = Input.get_vector(&"look_left", &"look_right", &"look_up", &"look_down", 0.2)
	if stick != Vector2.ZERO:
		_turn(stick * stick_speed_deg * delta)
	var goal := target.global_position + Vector3.UP * height
	global_position = global_position.lerp(goal, 1.0 - exp(-follow_speed * delta))
	if _recenter_to != null:
		_yaw = lerp_angle(_yaw, _recenter_to, 1.0 - exp(-recenter_speed * delta))
		if absf(angle_difference(_yaw, _recenter_to)) < 0.01:
			_recenter_to = null
	_apply()


func _turn(degrees: Vector2) -> void:
	_recenter_to = null   # 利用者が視点を触ったら、向き直しをやめる
	_yaw -= deg_to_rad(degrees.x)
	var dy := degrees.y if invert_y else -degrees.y
	_pitch_rad = clampf(_pitch_rad + deg_to_rad(dy), deg_to_rad(pitch_min_deg), deg_to_rad(pitch_max_deg))
	if is_node_ready():
		_apply()


func _apply() -> void:
	rotation = Vector3(0.0, _yaw, 0.0)
	_pitch.rotation = Vector3(_pitch_rad, 0.0, 0.0)
