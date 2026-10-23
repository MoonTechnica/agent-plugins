extends Node3D
## Scatters one mesh (grass clump, flower, bush, tree, rock) over the ground as MultiMesh chunks.
## Each chunk is its own MultiMeshInstance3D so off-screen chunks are culled and far chunks stop
## drawing (visibility_range_end). Building is spread over frames with a time budget, and with
## `stream_radius` > 0 only chunks around `focus` exist (open worlds).
##
##   var grass := NatureScatter.new()
##   grass.mesh = NatureMeshes.grass_clump()
##   grass.material = preload("res://nature/grass_material.tres")
##   grass.height_at = terrain.height_at          # Callable(x: float, z: float) -> float
##   grass.density_at = func(x, z): return 1.0    # 0..1: paths, water, buildings = 0
##   grass.area = Rect2(-60, -60, 120, 120)
##   grass.per_square_metre = 6.0
##   add_child(grass)

@export var mesh: Mesh
@export var material: Material
@export var area := Rect2(-50, -50, 100, 100)
@export var chunk_size := 16.0
## Instances per m² where density_at is 1. Grass clumps 4-10, flowers 0.2-1, trees 0.002-0.02.
@export var per_square_metre := 6.0
@export var min_scale := 0.8
@export var max_scale := 1.25
## Random yaw only; tilt follows the slope when align_to_ground (rocks), never for grass/trees.
@export var align_to_ground := false
## Chunks beyond this camera distance are not drawn. For grass set the shader's fade_end a little
## below it (fade_end ~ draw_distance - chunk_size / 2) so blades have shrunk away before the chunk drops.
@export var draw_distance := 45.0
## Far level of detail: beyond lod_distance only `far_fraction` of the instances draw, each scaled
## by `far_scale` so coverage stays similar. far_fraction 0 = no far level (one level to draw_distance).
@export var lod_distance := 18.0
@export_range(0.0, 1.0) var far_fraction := 0.0
@export var far_scale := 1.35
## Optional cheaper mesh for the far level (a tree with fewer leaf cards, a 2-blade clump).
## Set it with far_fraction 1.0 to swap the mesh without thinning.
@export var far_mesh: Mesh
## 0 = build the whole area once. > 0 = keep only chunks within this radius of `focus`.
@export var stream_radius := 0.0
@export var cast_shadows := false
@export var seed := 1
@export var budget_usec := 2000

var height_at: Callable = func(_x: float, _z: float) -> float: return 0.0
var density_at: Callable = func(_x: float, _z: float) -> float: return 1.0
## Optional Callable(x, z) -> Color multiplied into the instance (match the ground's tint).
var tint_at: Callable
var focus := Vector3.ZERO

var _chunks: Dictionary = {}
var _jobs: Array[Vector2i] = []

func _ready() -> void:
	_schedule()

func _process(_delta: float) -> void:
	if stream_radius > 0.0:
		_schedule()
	var start := Time.get_ticks_usec()
	while not _jobs.is_empty() and Time.get_ticks_usec() - start < budget_usec:
		_build(_jobs.pop_front())

## Rebuild everything, e.g. after the ground or the density map changed.
func rebuild() -> void:
	for key in _chunks:
		if _chunks[key] != null:
			_chunks[key].queue_free()
	_chunks.clear()
	_jobs.clear()
	_schedule()

func _schedule() -> void:
	var first := Vector2i(floori(area.position.x / chunk_size), floori(area.position.y / chunk_size))
	var last := Vector2i(ceili(area.end.x / chunk_size) - 1, ceili(area.end.y / chunk_size) - 1)
	var wanted := {}
	if stream_radius > 0.0:
		var r := ceili(stream_radius / chunk_size)
		var c := Vector2i(floori(focus.x / chunk_size), floori(focus.z / chunk_size))
		first = Vector2i(maxi(first.x, c.x - r), maxi(first.y, c.y - r))
		last = Vector2i(mini(last.x, c.x + r), mini(last.y, c.y + r))
	for z in range(first.y, last.y + 1):
		for x in range(first.x, last.x + 1):
			var key := Vector2i(x, z)
			if stream_radius > 0.0 and Vector2((x + 0.5) * chunk_size - focus.x, (z + 0.5) * chunk_size - focus.z).length() > stream_radius + chunk_size:
				continue
			wanted[key] = true
			if not _chunks.has(key):
				_chunks[key] = null
				_jobs.append(key)
	if stream_radius > 0.0:
		for key in _chunks.keys():
			if not wanted.has(key):
				if _chunks[key] != null:
					_chunks[key].queue_free()
				_chunks.erase(key)
				_jobs.erase(key)

func _build(key: Vector2i) -> void:
	if not _chunks.has(key):
		return
	var rng := RandomNumberGenerator.new()
	rng.seed = hash(Vector3i(key.x, key.y, seed))
	var origin := Vector2(key.x * chunk_size, key.y * chunk_size)
	var tries := int(round(chunk_size * chunk_size * per_square_metre))
	var transforms: Array[Transform3D] = []
	var colors: Array[Color] = []
	var top := -INF
	var bottom := INF
	for i in tries:
		var x := origin.x + rng.randf() * chunk_size
		var z := origin.y + rng.randf() * chunk_size
		var keep_roll := rng.randf()
		var yaw := rng.randf() * TAU
		var s := rng.randf_range(min_scale, max_scale)
		if not area.has_point(Vector2(x, z)) or keep_roll >= float(density_at.call(x, z)):
			continue
		var y: float = height_at.call(x, z)
		var basis := Basis(Vector3.UP, yaw).scaled(Vector3.ONE * s)
		if align_to_ground:
			var e := 0.5
			var n := Vector3(float(height_at.call(x - e, z)) - float(height_at.call(x + e, z)), 2.0 * e,
				float(height_at.call(x, z - e)) - float(height_at.call(x, z + e))).normalized()
			basis = Basis(Quaternion(Vector3.UP, n)) * basis
		transforms.append(Transform3D(basis, Vector3(x, y, z)))
		colors.append(tint_at.call(x, z) if tint_at.is_valid() else Color.WHITE)
		top = maxf(top, y)
		bottom = minf(bottom, y)
	if transforms.is_empty():
		return
	# Instances are stored relative to the chunk centre and custom_aabb is centred on it: the engine
	# measures visibility range to the centre of the instance's AABB.
	var centre := Vector3(origin.x + chunk_size / 2, 0, origin.y + chunk_size / 2)
	var mesh_box := mesh.get_aabb()
	var pad := mesh_box.size.length() * max_scale * (far_scale if far_fraction > 0.0 else 1.0)
	var box := AABB(Vector3(-chunk_size / 2 - pad, bottom - pad, -chunk_size / 2 - pad),
		Vector3(chunk_size + pad * 2, top - bottom + pad * 2, chunk_size + pad * 2))
	var holder := _level(mesh, transforms, colors, centre, 1.0, 1.0, box)
	if far_fraction > 0.0:
		holder.visibility_range_end = lod_distance
		holder.visibility_range_end_margin = 2.0
		var far := _level(far_mesh if far_mesh else mesh, transforms, colors, centre, far_fraction, far_scale, box)
		far.visibility_range_begin = lod_distance
		far.visibility_range_begin_margin = 2.0
		holder.add_child(far)
	holder.position = centre
	add_child(holder)
	_chunks[key] = holder

## One MultiMesh level for a chunk. `fraction` < 1 keeps every n-th instance, `grow` scales them.
func _level(level_mesh: Mesh, transforms: Array[Transform3D], colors: Array[Color], centre: Vector3, fraction: float, grow: float, box: AABB) -> MultiMeshInstance3D:
	var step := maxi(1, int(round(1.0 / fraction)))
	var count := ceili(float(transforms.size()) / step)
	# One set_buffer call instead of a call per instance (the single-threaded Web build stalls
	# on thousands of separate calls). Per instance: 12 floats of transform rows, then RGBA.
	var buffer := PackedFloat32Array()
	buffer.resize(count * 16)
	for i in count:
		var t := transforms[i * step]
		var b := t.basis.scaled(Vector3.ONE * grow)
		var o := t.origin - centre
		var c := colors[i * step]
		var k := i * 16
		buffer[k] = b.x.x; buffer[k + 1] = b.y.x; buffer[k + 2] = b.z.x; buffer[k + 3] = o.x
		buffer[k + 4] = b.x.y; buffer[k + 5] = b.y.y; buffer[k + 6] = b.z.y; buffer[k + 7] = o.y
		buffer[k + 8] = b.x.z; buffer[k + 9] = b.y.z; buffer[k + 10] = b.z.z; buffer[k + 11] = o.z
		buffer[k + 12] = c.r; buffer[k + 13] = c.g; buffer[k + 14] = c.b; buffer[k + 15] = c.a
	var multimesh := MultiMesh.new()
	multimesh.transform_format = MultiMesh.TRANSFORM_3D
	multimesh.use_colors = true
	multimesh.mesh = level_mesh
	multimesh.instance_count = count
	multimesh.buffer = buffer
	var holder := MultiMeshInstance3D.new()
	holder.multimesh = multimesh
	holder.material_override = material
	holder.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON if cast_shadows else GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	holder.visibility_range_end = draw_distance
	holder.custom_aabb = box
	return holder
