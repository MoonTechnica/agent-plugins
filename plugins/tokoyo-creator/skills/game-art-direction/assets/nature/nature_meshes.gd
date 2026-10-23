extends RefCounted
## Small procedural meshes for outdoor scenes: grass clumps, leaf-card trees, rocks and the
## leaf texture they use. Same seed, same mesh. Build once at load and share the result.
##
## Contracts the nature shaders rely on:
##   grass  : UV.y = 0 at the root, 1 at the tip; origin at the root.
##   foliage: COLOR.r = how much the vertex sways (0 trunk base, 1 outer leaves);
##            leaf normals point away from the canopy centre so the crown shades like one soft volume.

## A clump of `blades` tapered, slightly curved blades inside `radius`. 5 triangles per blade.
static func grass_clump(blades: int = 7, radius: float = 0.18, height: float = 0.45, width: float = 0.05, seed: int = 1) -> ArrayMesh:
	var rng := RandomNumberGenerator.new()
	rng.seed = seed
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	for b in blades:
		var angle := rng.randf() * TAU
		var base := Vector3(cos(angle), 0, sin(angle)) * radius * sqrt(rng.randf())
		var yaw := rng.randf() * TAU
		var side := Vector3(cos(yaw), 0, sin(yaw))
		var lean := Vector3(-side.z, 0, side.x) * rng.randf_range(0.05, 0.25)
		var h := height * rng.randf_range(0.65, 1.15)
		var w := width * rng.randf_range(0.8, 1.2)
		var rows: Array[float] = [0.0, 0.35, 0.7]
		var left := PackedVector3Array()
		var right := PackedVector3Array()
		for t in rows:
			var centre := base + Vector3(0, t * h, 0) + lean * h * t * t
			var half := w * (1.0 - t * 0.85) * 0.5
			left.append(centre - side * half)
			right.append(centre + side * half)
		var tip := base + Vector3(0, h, 0) + lean * h
		for r in rows.size() - 1:
			_quad(st, left[r], right[r], right[r + 1], left[r + 1], rows[r], rows[r + 1])
		_vertex(st, left[2], 0.0, rows[2])
		_vertex(st, right[2], 1.0, rows[2])
		_vertex(st, tip, 0.5, 1.0)
	st.index()
	return st.commit()

static func _quad(st: SurfaceTool, a: Vector3, b: Vector3, c: Vector3, d: Vector3, v0: float, v1: float) -> void:
	_vertex(st, a, 0.0, v0)
	_vertex(st, b, 1.0, v0)
	_vertex(st, c, 1.0, v1)
	_vertex(st, a, 0.0, v0)
	_vertex(st, c, 1.0, v1)
	_vertex(st, d, 0.0, v1)

static func _vertex(st: SurfaceTool, p: Vector3, u: float, v: float) -> void:
	st.set_normal(Vector3.UP)
	st.set_uv(Vector2(u, v))
	st.add_vertex(p)

## RGBA leaf-cluster texture for the foliage shader (alpha cut-out, mipmapped).
## The colour is a light neutral green so the shader's palette colours do the tinting.
static func leaf_texture(size: int = 256, seed: int = 3) -> ImageTexture:
	var rng := RandomNumberGenerator.new()
	rng.seed = seed
	var image := Image.create_empty(size, size, false, Image.FORMAT_RGBA8)
	# Transparent texels carry the leaf colour so smaller mipmaps do not pull in a dark fringe.
	image.fill(Color(0.6, 0.75, 0.45, 0.0))
	for i in 46:
		var c := Vector2(rng.randf_range(0.18, 0.82), rng.randf_range(0.18, 0.82)) * size
		var a := rng.randf() * TAU
		var axis := Vector2(cos(a), sin(a))
		var length := size * rng.randf_range(0.09, 0.15)
		var shade := rng.randf_range(0.75, 1.0)
		var r := int(length) + 1
		for y in range(maxi(0, int(c.y) - r), mini(size, int(c.y) + r)):
			for x in range(maxi(0, int(c.x) - r), mini(size, int(c.x) + r)):
				var d := Vector2(x, y) - c
				var along := d.dot(axis) / length
				var across := d.dot(Vector2(-axis.y, axis.x)) / (length * 0.42)
				if along * along + across * across <= 1.0:
					var vein := 0.9 + 0.1 * absf(across)
					image.set_pixel(x, y, Color(0.6 * shade * vein, 0.78 * shade * vein, 0.45 * shade * vein, 1.0))
	image.generate_mipmaps()
	return ImageTexture.create_from_image(image)

## A broadleaf tree: tapered trunk + `cards` crossed leaf quads inside an ellipsoid crown.
## Surface 0 = trunk, surface 1 = leaves (give it the foliage shader). For a far level of detail use
## fewer, bigger cards (e.g. cards 10, card_size 1.7) so the crown keeps its volume.
static func tree(height: float = 5.0, crown_radius: float = 1.8, cards: int = 70, seed: int = 7, card_size: float = 1.0) -> ArrayMesh:
	var rng := RandomNumberGenerator.new()
	rng.seed = seed
	var mesh := ArrayMesh.new()
	var trunk_top := height * 0.55
	var crown := Vector3(0, height - crown_radius * 0.9, 0)

	var trunk := SurfaceTool.new()
	trunk.begin(Mesh.PRIMITIVE_TRIANGLES)
	var sides := 7
	for s in sides:
		var a0 := TAU * s / sides
		var a1 := TAU * (s + 1) / sides
		var r0 := height * 0.045
		var r1 := height * 0.022
		var p := [Vector3(cos(a0) * r0, 0, sin(a0) * r0), Vector3(cos(a1) * r0, 0, sin(a1) * r0),
			Vector3(cos(a1) * r1, trunk_top, sin(a1) * r1), Vector3(cos(a0) * r1, trunk_top, sin(a0) * r1)]
		var n0 := Vector3(cos(a0), 0.2, sin(a0)).normalized()
		var n1 := Vector3(cos(a1), 0.2, sin(a1)).normalized()
		var order := [0, 2, 1, 0, 3, 2]
		for k in order:
			trunk.set_normal(n0 if k == 0 or k == 3 else n1)
			trunk.set_color(Color(0.0 if k < 2 else 0.15, 0, 0))
			trunk.set_uv(Vector2(float(k == 1 or k == 2), p[k].y / height))
			trunk.add_vertex(p[k])
	trunk.commit(mesh)

	var leaves := SurfaceTool.new()
	leaves.begin(Mesh.PRIMITIVE_TRIANGLES)
	for i in cards:
		var dir := Vector3(rng.randf_range(-1, 1), rng.randf_range(-0.6, 1), rng.randf_range(-1, 1)).normalized()
		var centre := crown + dir * crown_radius * pow(rng.randf(), 0.4) / sqrt(card_size) * Vector3(1.0, 0.8, 1.0)
		var size := crown_radius * rng.randf_range(0.55, 0.85) * card_size
		var basis := Basis(Vector3.UP, rng.randf() * TAU) * Basis(Vector3.RIGHT, rng.randf_range(-0.8, 0.8))
		for cross in 2:
			var b := basis * Basis(Vector3.UP, cross * PI * 0.5)
			var u := b.x * size * 0.5
			var v := b.y * size * 0.5
			var corners := [centre - u - v, centre + u - v, centre + u + v, centre - u + v]
			var uvs := [Vector2(0, 1), Vector2(1, 1), Vector2(1, 0), Vector2(0, 0)]
			for k in [0, 1, 2, 0, 2, 3]:
				var p: Vector3 = corners[k]
				var out := p - crown
				leaves.set_normal((out / Vector3(1.0, 0.8, 1.0)).normalized())
				leaves.set_color(Color(clampf(0.35 + out.length() / crown_radius * 0.65, 0.0, 1.0), 0, 0))
				leaves.set_uv(uvs[k])
				leaves.add_vertex(p)
	leaves.commit(mesh)
	return mesh

## A low rock: a jittered sphere flattened at the bottom. Flat-shaded so facets catch light.
static func rock(radius: float = 0.8, seed: int = 11) -> ArrayMesh:
	var rng := RandomNumberGenerator.new()
	rng.seed = seed
	var sphere := SphereMesh.new()
	sphere.radius = radius
	sphere.height = radius * 1.4
	sphere.radial_segments = 9
	sphere.rings = 5
	var arrays := sphere.get_mesh_arrays()
	var verts: PackedVector3Array = arrays[Mesh.ARRAY_VERTEX]
	var jitter := {}
	for i in verts.size():
		var key := Vector3i((verts[i] * 1000.0).round())
		if not jitter.has(key):
			jitter[key] = rng.randf_range(0.8, 1.15)
		var p := verts[i] * float(jitter[key])
		p.y = maxf(p.y, -radius * 0.15)
		verts[i] = p
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var indices: PackedInt32Array = arrays[Mesh.ARRAY_INDEX]
	for i in indices.size():
		st.add_vertex(verts[indices[i]])
	st.generate_normals()
	return st.commit()
