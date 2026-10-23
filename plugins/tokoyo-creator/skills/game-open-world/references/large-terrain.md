# 広い地形（〜8 km）の実装例

`$game-open-world` §1.5 の方式を、そのまま動く形にした例。2026-10-23 に Godot 4.5.1 の Web 書き出しを
本物の Shell と Chrome（Apple Silicon の Mac）で動かし、140 m/s で 3.6 km を移動して p50/p95/p99 とも 16.7 ms、
50 ms 超の停止 0 回、地域 pack の取得から重ねるまで 21 ms を確認した。**スマホの実機では未測定**。数値は目安にしない。
同日、木を円錐から `nature` の部品（近くは葉 40 枚、120 m より先は葉 10 枚の大きな板）に替えた。上のフレーム時間は替える前の測定。
替えた後の描画は Mac で描画呼び出し 121・三角形 17.3 万（全部を近くの木にすると 88 万）。替えた後のフレーム時間は未測定。

作品に合わせて変えてよい値: 世界の大きさ・高さの倍率・リングの段数・植生の量と種類・地域の大きさ。
変えてはいけないこと: GDExtension を使わない、仕事を `_process` の時間予算で分ける、当たり判定は周辺だけ。

- 木と草は `$game-art-direction` の `assets/nature/` を `godot/nature/` にコピーして使う（下の例は `nature_meshes.gd` と `foliage.gdshader` を読む）。
- 地形のデータは `world.gd build`（`$game-level-design` references/world-layout.md）が `design/world-map.json` から作る:
  `res://terrain/height.bin`（1024² の 32 bit float、0〜1 を `height_scale` 倍）、`vegetation.bin`（木の密度 0〜255）、
  `features.bin`（1 川・2 道・3 町などの台地）。ノイズだけの地形にしない。
  `.bin` は資源ではないので、`export_presets.cfg` の Web / Native の `include_filter` に `terrain/*.bin` を足す。
  `HEIGHT` は `world-map.json` の `height_scale`、`WORLD`（シェーダの `world_size`）は `size` と同じ値にする。起動のたびに生成しない。
- **世界の大きさ**: 下の例の数値（`WORLD := 8192.0`・`LEVELS := 7`）は 8 km の場合。`.bin` は大きさによらず 1024² なので、
  1 サンプルは `size / 1024` m（2 km なら 2 m、8 km なら 8 m）。小さい世界ほど地形は細かくなる。
  リングは一番外側が見える距離を覆えばよいので、小さい世界では `LEVELS` を減らす（目安: `BASE_CELL × CELLS × 2^(LEVELS-1)` が見える距離の 2 倍程度。
  2 km の世界なら `LEVELS := 5` で約 2 km）。`BASE_CELL` は 1 サンプルより細かくしても形は増えない。
- **橋**: 道が川を渡る所は川床が残る（地形に道は描かれない）。`design/world-build.json` の `bridges`（`from`・`to`・`width`・`deck_height`）ごとに
  橋の板と当たり判定を置く（`res://` で読むなら `world-build.json` を `godot/` 側へ写して `include_filter` に足す）。置かないと道が川で途切れる。
- 段の境目は、細かい段のリングの外周付近で頂点の高さを粗い段の高さへ寄せて（geomorph）隙間をなくしている。
  リングの段数や格子の数を変えたら、シェーダの `cell_size` / `ring_half` も合わせる（`clipmap_terrain.gd` が設定する）。

## ring_mesh.gd

```gdscript
extends RefCounted
## Builds one clipmap level: a CELLS x CELLS grid, with the middle cut out above level 0.
## The cut is one cell smaller on every side so neighbouring levels overlap instead of leaving gaps.

static func build(level: int, cells: int, base_cell: float) -> ArrayMesh:
	var size := base_cell * pow(2, level)
	var vertices := PackedVector3Array()
	var indices := PackedInt32Array()
	var half := cells * size / 2.0
	for z in cells + 1:
		for x in cells + 1:
			vertices.append(Vector3(x * size - half, 0, z * size - half))
	var hole_from := cells / 4 + 1
	var hole_to := cells * 3 / 4 - 1
	for z in cells:
		for x in cells:
			if level > 0 and x >= hole_from and x < hole_to and z >= hole_from and z < hole_to:
				continue
			var a := z * (cells + 1) + x
			var b := a + 1
			var c := a + cells + 1
			var d := c + 1
			indices.append_array([a, b, c, b, d, c])
	var arrays := []
	arrays.resize(Mesh.ARRAY_MAX)
	arrays[Mesh.ARRAY_VERTEX] = vertices
	arrays[Mesh.ARRAY_INDEX] = indices
	var mesh := ArrayMesh.new()
	mesh.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arrays)
	return mesh
```

## terrain.gdshader

```glsl
shader_type spatial;
render_mode cull_back;

uniform sampler2D heightmap : filter_linear, repeat_disable;
// Rivers (R), roads (G) and plateaus (B) from the world tool's features.bin, filtered so edges stay smooth.
uniform sampler2D features : filter_linear, repeat_disable;
uniform float world_size = 8192.0;
uniform float height_scale = 400.0;
uniform float level_bias = 0.0;
// Grid spacing and half width of this level; the outer band blends into the next, coarser level.
uniform float cell_size = 2.0;
uniform float ring_half = 64.0;
// Colours from design/palette.json. source_color converts them from sRGB (without it they wash out on
// Forward+ and native). For textures, slope/macro variation and splat maps see nature/ground.gdshader.
uniform vec4 grass_color : source_color = vec4(0.28, 0.46, 0.2, 1.0);
uniform vec4 rock_color : source_color = vec4(0.42, 0.39, 0.35, 1.0);
uniform vec4 snow_color : source_color = vec4(0.92, 0.93, 0.96, 1.0);
uniform vec4 plateau_color : source_color = vec4(0.5, 0.46, 0.38, 1.0);
uniform vec4 road_color : source_color = vec4(0.55, 0.47, 0.34, 1.0);
uniform vec4 river_color : source_color = vec4(0.16, 0.32, 0.5, 1.0);

varying float v_height;
varying vec3 v_world_normal;
varying vec2 v_uv;

float sample_height(vec2 xz) {
	return textureLod(heightmap, xz / world_size + 0.5, 0.0).r * height_scale;
}

void vertex() {
	vec2 xz = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xz;
	float texel = world_size / 1024.0;
	float h = sample_height(xz);
	// Geomorph: near the outer edge, take the height the coarser level draws at this point
	// (the average of its two or four neighbours on the 2x grid), so the levels meet without cracks.
	vec2 odd = mod(floor(VERTEX.xz / cell_size + 0.5), 2.0) * cell_size;
	float coarse = 0.25 * (sample_height(xz + vec2(-odd.x, -odd.y)) + sample_height(xz + vec2(odd.x, -odd.y))
		+ sample_height(xz + vec2(-odd.x, odd.y)) + sample_height(xz + vec2(odd.x, odd.y)));
	float edge = max(abs(VERTEX.x), abs(VERTEX.z)) / ring_half;
	h = mix(h, coarse, smoothstep(0.8, 0.97, edge));
	VERTEX.y = h - level_bias;
	float dx = sample_height(xz + vec2(texel, 0.0)) - sample_height(xz - vec2(texel, 0.0));
	float dz = sample_height(xz + vec2(0.0, texel)) - sample_height(xz - vec2(0.0, texel));
	v_world_normal = normalize(vec3(-dx, 2.0 * texel, -dz));
	NORMAL = v_world_normal;
	v_height = h;
	v_uv = xz / world_size + 0.5;
}

void fragment() {
	float slope = 1.0 - v_world_normal.y;
	vec3 color = mix(grass_color.rgb, rock_color.rgb, smoothstep(0.15, 0.35, slope));
	color = mix(color, snow_color.rgb, smoothstep(260.0, 320.0, v_height) * (1.0 - smoothstep(0.3, 0.5, slope)));
	vec3 feature = texture(features, v_uv).rgb;
	color = mix(color, plateau_color.rgb, smoothstep(0.3, 0.6, feature.b) * 0.5);
	color = mix(color, road_color.rgb, smoothstep(0.35, 0.55, feature.g));
	color = mix(color, river_color.rgb, smoothstep(0.35, 0.55, feature.r));
	ALBEDO = color;
	ROUGHNESS = 0.92;
}
```

## clipmap_terrain.gd

`focus` に追う位置（カメラや利用者）を毎フレーム入れる。`height_at()` は描画と同じデータで高さを返す（接地・配置に使う）。

```gdscript
extends Node3D
## 8 km terrain without GDExtension: clipmap rings displaced in the vertex shader, collision
## only around `focus`, trees as nature_scatter.gd chunks around `focus` (leafy trees near, light
## trees far). Work is spread over frames.

const RingMesh := preload("res://terrain/ring_mesh.gd")
const NatureMeshes := preload("res://nature/nature_meshes.gd")
const NatureScatter := preload("res://nature/nature_scatter.gd")
const WORLD := 8192.0
const SAMPLES := 1024
const HEIGHT := 400.0
const LEVELS := 7
const CELLS := 64
const BASE_CELL := 2.0
const CHUNK := 256.0
const CHUNK_SAMPLES := 33
const TREES_PER_SQUARE_METRE := 0.003
const TREE_DISTANCE := 900.0
const BUDGET_USEC := 3000

var focus := Vector3.ZERO
var heights := PackedFloat32Array()
## Tree density per sample (0-255) from the world tool's vegetation mask; empty means everywhere.
var vegetation := PackedByteArray()
var _rings: Array[MeshInstance3D] = []
var _chunks: Dictionary = {}
var _trees: Node3D
var _jobs: Array[Callable] = []
var collision_ready := 0

func _ready() -> void:
	heights = FileAccess.get_file_as_bytes("res://terrain/height.bin").to_float32_array()
	vegetation = FileAccess.get_file_as_bytes("res://terrain/vegetation.bin")
	var image := Image.create_from_data(SAMPLES, SAMPLES, false, Image.FORMAT_RF, heights.to_byte_array())
	var shader := load("res://terrain/terrain.gdshader") as Shader
	var texture := ImageTexture.create_from_image(image)
	var feature_bytes := FileAccess.get_file_as_bytes("res://terrain/features.bin")
	var features: Texture2D = null
	if feature_bytes.size() == SAMPLES * SAMPLES:
		# One channel per feature so linear filtering blends edges instead of mixing kinds.
		var channels := PackedByteArray()
		channels.resize(SAMPLES * SAMPLES * 3)
		for k in feature_bytes.size():
			var kind := feature_bytes[k]
			if kind >= 1 and kind <= 3: channels[k * 3 + kind - 1] = 255
		features = ImageTexture.create_from_image(Image.create_from_data(SAMPLES, SAMPLES, false, Image.FORMAT_RGB8, channels))
	for level in LEVELS:
		var material := ShaderMaterial.new()
		material.shader = shader
		material.set_shader_parameter("heightmap", texture)
		if features: material.set_shader_parameter("features", features)
		material.set_shader_parameter("level_bias", level * 0.05)
		material.set_shader_parameter("cell_size", BASE_CELL * pow(2, level))
		material.set_shader_parameter("ring_half", CELLS * BASE_CELL * pow(2, level) / 2.0)
		var ring := MeshInstance3D.new()
		ring.mesh = RingMesh.build(level, CELLS, BASE_CELL)
		ring.material_override = material
		var span := CELLS * BASE_CELL * pow(2, level)
		ring.custom_aabb = AABB(Vector3(-span / 2, -50, -span / 2), Vector3(span, HEIGHT + 100, span))
		ring.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		add_child(ring)
		_rings.append(ring)
	# Trees from the nature kit ($game-art-direction references/nature.md): leafy cards near the
	# player, a few cards far away, like the official visibility_ranges demo. Swap in an imported or
	# Blender-made GLB the same way: trunk material + foliage.gdshader on the leaves.
	var bark := StandardMaterial3D.new()
	bark.albedo_color = Color(0.28, 0.19, 0.12)
	var leaves := ShaderMaterial.new()
	leaves.shader = preload("res://nature/foliage.gdshader")
	leaves.set_shader_parameter("leaf_texture", NatureMeshes.leaf_texture())
	leaves.set_shader_parameter("crown_center", Vector3(0, 9.0 - 3.0 * 0.9, 0))
	leaves.set_shader_parameter("crown_normals", 1.0)
	var near_tree := NatureMeshes.tree(9.0, 3.0, 40)
	var far_tree := NatureMeshes.tree(9.0, 3.0, 10, 7, 1.7)
	for tree in [near_tree, far_tree]:
		tree.surface_set_material(0, bark)
		tree.surface_set_material(1, leaves)
	var trees := NatureScatter.new()
	trees.mesh = near_tree
	trees.far_mesh = far_tree
	trees.far_fraction = 1.0
	trees.far_scale = 1.0
	trees.lod_distance = 120.0
	trees.draw_distance = TREE_DISTANCE
	trees.stream_radius = TREE_DISTANCE
	trees.chunk_size = 128.0
	trees.per_square_metre = TREES_PER_SQUARE_METRE
	trees.area = Rect2(-WORLD / 2, -WORLD / 2, WORLD, WORLD)
	trees.cast_shadows = true
	trees.height_at = height_at
	# Keep roads, rivers and towns clear; thin trees where the mask is low.
	trees.density_at = func(x: float, z: float) -> float: return density_at(x, z) / 255.0
	_trees = trees
	add_child(trees)

## Bilinear height in metres at a world position (same data the shader reads).
func height_at(x: float, z: float) -> float:
	var u := clampf((x / WORLD + 0.5) * SAMPLES - 0.5, 0.0, SAMPLES - 1.001)
	var v := clampf((z / WORLD + 0.5) * SAMPLES - 0.5, 0.0, SAMPLES - 1.001)
	var x0 := int(u)
	var y0 := int(v)
	var fx := u - x0
	var fy := v - y0
	var a := lerpf(heights[y0 * SAMPLES + x0], heights[y0 * SAMPLES + x0 + 1], fx)
	var b := lerpf(heights[(y0 + 1) * SAMPLES + x0], heights[(y0 + 1) * SAMPLES + x0 + 1], fx)
	return lerpf(a, b, fy) * HEIGHT

func density_at(x: float, z: float) -> float:
	if vegetation.size() != SAMPLES * SAMPLES: return 255.0
	var i := clampi(int((x / WORLD + 0.5) * SAMPLES), 0, SAMPLES - 1)
	var j := clampi(int((z / WORLD + 0.5) * SAMPLES), 0, SAMPLES - 1)
	return float(vegetation[j * SAMPLES + i])

func _process(_delta: float) -> void:
	for level in LEVELS:
		var snap := BASE_CELL * pow(2, level) * 2.0
		_rings[level].position = Vector3(floorf(focus.x / snap) * snap, 0, floorf(focus.z / snap) * snap)
	_trees.focus = focus
	_schedule()
	var start := Time.get_ticks_usec()
	while not _jobs.is_empty() and Time.get_ticks_usec() - start < BUDGET_USEC:
		_jobs.pop_front().call()

func _schedule() -> void:
	var cx := floori(focus.x / CHUNK)
	var cz := floori(focus.z / CHUNK)
	var wanted := {}
	for dz in range(-1, 2):
		for dx in range(-1, 2):
			var key := Vector2i(cx + dx, cz + dz)
			wanted[key] = true
			if not _chunks.has(key):
				_chunks[key] = null
				_jobs.append(_build_chunk.bind(key))
	for key in _chunks.keys():
		if not wanted.has(key) and _chunks[key] != null:
			_chunks[key].queue_free()
			_chunks.erase(key)

func _build_chunk(key: Vector2i) -> void:
	if not _chunks.has(key): return
	var spacing := CHUNK / (CHUNK_SAMPLES - 1)
	var data := PackedFloat32Array()
	data.resize(CHUNK_SAMPLES * CHUNK_SAMPLES)
	var origin := Vector2(key.x * CHUNK, key.y * CHUNK)
	for z in CHUNK_SAMPLES:
		for x in CHUNK_SAMPLES:
			data[z * CHUNK_SAMPLES + x] = height_at(origin.x + x * spacing, origin.y + z * spacing) / spacing
	var shape := HeightMapShape3D.new()
	shape.map_width = CHUNK_SAMPLES
	shape.map_depth = CHUNK_SAMPLES
	shape.map_data = data
	var body := StaticBody3D.new()
	var collision := CollisionShape3D.new()
	collision.shape = shape
	body.add_child(collision)
	# HeightMapShape3D samples are 1 unit apart and centred; scale them to the chunk spacing.
	body.scale = Vector3.ONE * spacing
	body.position = Vector3(origin.x + CHUNK / 2, 0, origin.y + CHUNK / 2)
	add_child(body)
	_chunks[key] = body
	collision_ready += 1

```

## 使い方

```gdscript
const Terrain := preload("res://terrain/clipmap_terrain.gd")
var terrain

func _ready() -> void:
	terrain = Terrain.new()
	add_child(terrain)
	$Camera3D.far = 2000.0   # 霧と一緒に縮める

func _process(_delta: float) -> void:
	terrain.focus = $Player.global_position
```

草は地形の周りだけ `nature_scatter.gd` で撒く（`stream_radius`・`focus`・`height_at = terrain.height_at`、`density_at` は `vegetation` と道・川から）。
木は 128 m の区画で周囲 900 m だけを置き、120 m より先は葉の少ない木に替える（公式デモ `3d/visibility_ranges` の段の考え方。`$game-art-direction` references/nature.md）。

町や遺跡など作り込んだ場所は `godot/regions/<地域>/` に置き、境界の手前で `TokoyoApp.regions.load(name)` を始める（`spec.md` §8.6）。
