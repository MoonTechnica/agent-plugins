extends SceneTree
## Map tools for the game agent (game-level-design references/world-layout.md). Build-time only:
## nothing here ships in the game.
##
##   godot --headless --path <source>/godot -s <kit>/skills/game-level-design/assets/world.gd -- build <source>
##   godot --headless --path <source>/godot -s <kit>/skills/game-level-design/assets/world.gd -- overview <source> [--concept]
##
## `design/world-map.json` is the single source of the layout. `build` shapes the open-world terrain
## from it (regions → landmark stamps → rivers → roads → POI plateaus → light erosion → vegetation
## mask) and writes `godot/terrain/height.bin` and `godot/terrain/vegetation.bin`. `overview` draws the
## layout from data (no GPU needed) to `design/overview.png` and writes `design/world-report.json`;
## with `--concept` it also writes `design/concept/map.png` for the planning card.
## Deterministic for the same file and seed.

const SAMPLES := 1024
const KINDS := ["open_world", "areas"]

var source := ""
var world: Dictionary = {}
var size := Vector2(8192, 8192)
var cell := 8.0
var height_scale := 400.0
var heights := PackedFloat32Array()
## 0 = free, 1 = river, 2 = road, 3 = plateau (protected from erosion and vegetation)
var mask := PackedByteArray()
var region_of := PackedInt32Array()

func _initialize() -> void:
	var args := OS.get_cmdline_user_args()
	if args.size() < 2 or not args[0] in ["build", "overview"]:
		_fail("usage: world.gd -- build|overview <source-dir> [--concept]")
		return
	source = args[1]
	if not _load_world():
		return
	if args[0] == "build":
		if world.kind != "open_world":
			_fail("build shapes open-world terrain; kind \"%s\" has nothing to build" % world.kind)
			return
		var started := Time.get_ticks_msec()
		_build_terrain()
		_save_terrain()
		print("WORLD_BUILD=", JSON.stringify({"ms": Time.get_ticks_msec() - started, "samples": SAMPLES}))
	else:
		var report := {}
		var image: Image
		var concept: Image
		if world.kind == "open_world":
			if not _load_terrain():
				_fail("godot/terrain/height.bin is missing; run build first")
				return
			report = _check_open_world()
			image = _draw_open_world(report, true)
			concept = _draw_open_world(report, false)
		else:
			report = _check_areas()
			image = _draw_areas(report, true)
			concept = _draw_areas(report, false)
		_write(source.path_join("design/world-report.json"), JSON.stringify(report, "  "))
		image.save_png(source.path_join("design/overview.png"))
		if "--concept" in args:
			DirAccess.make_dir_recursive_absolute(source.path_join("design/concept"))
			# The planning card shows the layout only; check marks stay in design/overview.png.
			if concept.get_width() > 1024:
				concept.resize(1024, 1024 * concept.get_height() / concept.get_width(), Image.INTERPOLATE_BILINEAR)
			concept.save_png(source.path_join("design/concept/map.png"))
		print("WORLD_REPORT=", JSON.stringify(report.get("summary", {})))
	quit(0)

func _fail(message: String) -> void:
	printerr("world.gd: ", message)
	quit(1)

# ---------------------------------------------------------------------------------------------
# world-map.json

func _load_world() -> bool:
	var text := FileAccess.get_file_as_string(source.path_join("design/world-map.json"))
	var parsed = JSON.parse_string(text)
	if not parsed is Dictionary:
		_fail("design/world-map.json is missing or not JSON")
		return false
	world = parsed
	if not world.get("kind") in KINDS:
		_fail("kind must be one of %s" % [KINDS])
		return false
	var problems := []
	var ids := {}
	for list in ["regions", "landmarks", "rivers", "roads", "pois", "areas"]:
		if not world.has(list): world[list] = []
		if not world[list] is Array:
			problems.append("%s must be an array" % list)
			continue
		for item in world[list]:
			if not item is Dictionary or not item.get("id") is String:
				problems.append("every %s entry needs a string id" % list)
				continue
			if ids.has(item.id): problems.append("duplicate id %s" % item.id)
			ids[item.id] = true
	if world.kind == "open_world":
		var s = world.get("size", [8192, 8192])
		size = Vector2(float(s[0]), float(s[1]))
		cell = size.x / SAMPLES
		height_scale = float(world.get("height_scale", 400.0))
		for list in ["landmarks", "pois"]:
			for item in world[list]:
				if not _inside(_vec(item.get("at"))): problems.append("%s %s is outside the world" % [list, item.id])
		for list in ["rivers", "roads"]:
			for item in world[list]:
				if not item.get("points") is Array or item.points.size() < 2: problems.append("%s %s needs 2+ points" % [list, item.id])
	if not world.has("targets"): world.targets = {}
	if not problems.is_empty():
		_fail("design/world-map.json: " + "; ".join(problems))
		return false
	return true

func _vec(value) -> Vector2:
	if value is Array and value.size() >= 2: return Vector2(float(value[0]), float(value[1]))
	return Vector2(INF, INF)

func _inside(p: Vector2) -> bool:
	return absf(p.x) <= size.x / 2 and absf(p.y) <= size.y / 2

func _target(key: String, fallback: float) -> float:
	return float(world.targets.get(key, fallback))

func _world_at(i: int, j: int) -> Vector2:
	return Vector2((i + 0.5) * cell - size.x / 2, (j + 0.5) * size.y / SAMPLES - size.y / 2)

func _index_at(p: Vector2) -> Vector2i:
	return Vector2i(clampi(int((p.x + size.x / 2) / cell), 0, SAMPLES - 1), clampi(int((p.y + size.y / 2) / (size.y / SAMPLES)), 0, SAMPLES - 1))

func _h(p: Vector2) -> float:
	var g := _index_at(p)
	return heights[g.y * SAMPLES + g.x]

# ---------------------------------------------------------------------------------------------
# build: shape the terrain on purpose

func _build_terrain() -> void:
	var n := SAMPLES * SAMPLES
	heights.resize(n)
	mask.resize(n)
	mask.fill(0)
	var base := PackedFloat32Array()
	base.resize(n)
	var rough := PackedFloat32Array()
	rough.resize(n)
	# 1. Large shapes: each region's base height and roughness, blended across borders.
	_assign_regions()
	for j in SAMPLES:
		for i in SAMPLES:
			var found := region_of[j * SAMPLES + i]
			base[j * SAMPLES + i] = float(world.regions[found].get("base_height", 30.0)) if found >= 0 else float(world.get("base_height", 30.0))
			rough[j * SAMPLES + i] = float(world.regions[found].get("roughness", 0.5)) if found >= 0 else 0.5
	base = _blur(base, 24)
	rough = _blur(rough, 24)
	var noise := FastNoiseLite.new()
	noise.seed = int(world.get("seed", 1))
	noise.frequency = 0.004
	noise.fractal_octaves = 5
	for j in SAMPLES:
		for i in SAMPLES:
			var k := j * SAMPLES + i
			heights[k] = base[k] + noise.get_noise_2d(i, j) * 60.0 * rough[k]
	# 2. Landmarks: shapes you can see and steer by.
	for landmark in world.landmarks:
		_stamp(_vec(landmark.at), float(landmark.get("radius", 300.0)), float(landmark.get("height", 150.0)), str(landmark.get("shape", "cone")))
	# 3. Rivers run downhill along their line; 4. roads follow a graded centreline.
	for river in world.rivers: _carve(river, 1)
	for road in world.roads: _carve(road, 2)
	# 5. Flat ground for towns, camps and ruins.
	for poi in world.pois: _plateau(_vec(poi.at), float(poi.get("radius", 60.0)))
	# 6. Light thermal erosion outside the protected lines and plateaus.
	_erode(int(world.get("erosion_passes", 4)))

func _assign_regions() -> void:
	region_of.resize(SAMPLES * SAMPLES)
	var polygons := []
	for region in world.regions:
		var points := PackedVector2Array()
		for p in region.get("polygon", []): points.append(_vec(p))
		polygons.append(points)
	for j in SAMPLES:
		for i in SAMPLES:
			var p := _world_at(i, j)
			var found := -1
			for r in polygons.size():
				if polygons[r].size() >= 3 and Geometry2D.is_point_in_polygon(p, polygons[r]):
					found = r
					break
			region_of[j * SAMPLES + i] = found

func _blur(values: PackedFloat32Array, radius: int) -> PackedFloat32Array:
	var out := values
	for pass_index in 2:
		for axis in 2:
			var next := PackedFloat32Array()
			next.resize(out.size())
			for line in SAMPLES:
				var sum := 0.0
				var count := 0
				for t in range(-radius, radius + 1):
					var c := clampi(t, 0, SAMPLES - 1)
					sum += out[(line * SAMPLES + c) if axis == 0 else (c * SAMPLES + line)]
					count += 1
				for t in SAMPLES:
					next[(line * SAMPLES + t) if axis == 0 else (t * SAMPLES + line)] = sum / count
					var add := clampi(t + radius + 1, 0, SAMPLES - 1)
					var drop := clampi(t - radius, 0, SAMPLES - 1)
					sum += out[(line * SAMPLES + add) if axis == 0 else (add * SAMPLES + line)]
					sum -= out[(line * SAMPLES + drop) if axis == 0 else (drop * SAMPLES + line)]
			out = next
	return out

func _stamp(center: Vector2, radius: float, height: float, shape: String) -> void:
	var reach := radius * (2.0 if shape == "dome" else 1.2)
	var from := _index_at(center - Vector2(reach, reach))
	var to := _index_at(center + Vector2(reach, reach))
	for j in range(from.y, to.y + 1):
		for i in range(from.x, to.x + 1):
			var d := _world_at(i, j).distance_to(center) / radius
			var k := j * SAMPLES + i
			match shape:
				"dome": heights[k] += height * exp(-d * d * 2.5)
				"plateau": heights[k] = lerpf(heights[k], heights[k] + height, 1.0 - smoothstep(0.85, 1.15, d))
				"spire": heights[k] += height * pow(maxf(0.0, 1.0 - d), 2.2)
				_: heights[k] += height * maxf(0.0, 1.0 - d)

## Carves a river (kind 1) or grades a road (kind 2) along a polyline.
func _carve(line: Dictionary, kind: int) -> void:
	var points := PackedVector2Array()
	for p in line.points: points.append(_vec(p))
	var half := float(line.get("width", 16.0 if kind == 2 else 30.0)) / 2.0
	# Centreline heights every cell along the line.
	var along := PackedVector2Array()
	var lengths := PackedFloat32Array()
	var total := 0.0
	for s in points.size() - 1:
		var a := points[s]
		var b := points[s + 1]
		var steps := maxi(1, int(a.distance_to(b) / cell))
		for t in steps:
			var p := a.lerp(b, float(t) / steps)
			if not along.is_empty(): total += along[along.size() - 1].distance_to(p)
			along.append(p)
			lengths.append(total)
	along.append(points[points.size() - 1])
	lengths.append(total + along[along.size() - 2].distance_to(points[points.size() - 1]))
	var centre := PackedFloat32Array()
	for p in along: centre.append(_h(p))
	if kind == 1:
		# The bed only ever descends from the source, then sits `depth` below the banks.
		var depth := float(line.get("depth", 6.0))
		for t in range(1, centre.size()): centre[t] = minf(centre[t], centre[t - 1] - 0.05)
		for t in centre.size(): centre[t] -= depth
	else:
		centre = _smooth_line(centre, 12)
		var grade := float(line.get("max_grade", 0.12))
		for t in range(1, centre.size()):
			var limit := grade * (lengths[t] - lengths[t - 1])
			centre[t] = clampf(centre[t], centre[t - 1] - limit, centre[t - 1] + limit)
		for t in range(centre.size() - 2, -1, -1):
			var limit := grade * (lengths[t + 1] - lengths[t])
			centre[t] = clampf(centre[t], centre[t + 1] - limit, centre[t + 1] + limit)
	var shoulder := half * 3.0
	for t in along.size():
		var p := along[t]
		var from := _index_at(p - Vector2(shoulder, shoulder))
		var to := _index_at(p + Vector2(shoulder, shoulder))
		for j in range(from.y, to.y + 1):
			for i in range(from.x, to.x + 1):
				var k := j * SAMPLES + i
				var d := _world_at(i, j).distance_to(p)
				if d > shoulder: continue
				var weight := 1.0 if d <= half else 1.0 - smoothstep(half, shoulder, d)
				var target := lerpf(heights[k], centre[t], weight)
				heights[k] = minf(heights[k], target) if kind == 1 else target
				# Mark half a sample wider so the feature survives texture filtering at this resolution.
				if d <= half + cell * 0.5: mask[k] = kind

func _smooth_line(values: PackedFloat32Array, radius: int) -> PackedFloat32Array:
	var out := PackedFloat32Array()
	out.resize(values.size())
	for t in values.size():
		var sum := 0.0
		var count := 0
		for o in range(-radius, radius + 1):
			sum += values[clampi(t + o, 0, values.size() - 1)]
			count += 1
		out[t] = sum / count
	return out

func _plateau(center: Vector2, radius: float) -> void:
	var level := _h(center)
	var reach := radius * 1.6
	var from := _index_at(center - Vector2(reach, reach))
	var to := _index_at(center + Vector2(reach, reach))
	for j in range(from.y, to.y + 1):
		for i in range(from.x, to.x + 1):
			var k := j * SAMPLES + i
			var d := _world_at(i, j).distance_to(center)
			if d > reach: continue
			heights[k] = lerpf(heights[k], level, 1.0 - smoothstep(radius, reach, d))
			if d <= radius and mask[k] == 0: mask[k] = 3

## Thermal erosion: material above the talus angle slides to the lowest neighbour.
func _erode(passes: int) -> void:
	var talus := cell * 0.9
	for pass_index in passes:
		for j in range(1, SAMPLES - 1):
			for i in range(1, SAMPLES - 1):
				var k := j * SAMPLES + i
				if mask[k] != 0: continue
				var lowest := k
				for o in [k - 1, k + 1, k - SAMPLES, k + SAMPLES]:
					if heights[o] < heights[lowest]: lowest = o
				var drop := heights[k] - heights[lowest]
				if lowest != k and drop > talus and mask[lowest] == 0:
					var move := (drop - talus) * 0.25
					heights[k] -= move
					heights[lowest] += move

func _vegetation() -> PackedByteArray:
	var out := PackedByteArray()
	out.resize(SAMPLES * SAMPLES)
	var snow := _target("snow_line", height_scale * 0.75)
	for j in SAMPLES:
		for i in SAMPLES:
			var k := j * SAMPLES + i
			if mask[k] != 0:
				out[k] = 0
				continue
			var r := region_of[k]
			var density := float(world.regions[r].get("vegetation", 0.5)) if r >= 0 else 0.4
			density *= 1.0 - smoothstep(0.35, 0.7, _slope(i, j))
			density *= 1.0 - smoothstep(snow - 40.0, snow, heights[k])
			out[k] = int(clampf(density, 0.0, 1.0) * 255.0)
	return out

func _slope(i: int, j: int) -> float:
	var x0 := heights[j * SAMPLES + maxi(i - 1, 0)]
	var x1 := heights[j * SAMPLES + mini(i + 1, SAMPLES - 1)]
	var z0 := heights[maxi(j - 1, 0) * SAMPLES + i]
	var z1 := heights[mini(j + 1, SAMPLES - 1) * SAMPLES + i]
	return Vector2(x1 - x0, z1 - z0).length() / (2.0 * cell)

func _save_terrain() -> void:
	var dir := source.path_join("godot/terrain")
	DirAccess.make_dir_recursive_absolute(dir)
	var normalized := PackedFloat32Array()
	normalized.resize(heights.size())
	for k in heights.size(): normalized[k] = clampf(heights[k] / height_scale, 0.0, 1.0)
	_write_bytes(dir.path_join("height.bin"), normalized.to_byte_array())
	_write_bytes(dir.path_join("vegetation.bin"), _vegetation())
	_write_bytes(dir.path_join("features.bin"), mask)

func _load_terrain() -> bool:
	var dir := source.path_join("godot/terrain")
	var raw := FileAccess.get_file_as_bytes(dir.path_join("height.bin"))
	if raw.size() != SAMPLES * SAMPLES * 4: return false
	heights = raw.to_float32_array()
	for k in heights.size(): heights[k] *= height_scale
	mask = FileAccess.get_file_as_bytes(dir.path_join("features.bin"))
	if mask.size() != SAMPLES * SAMPLES:
		mask = PackedByteArray()
		mask.resize(SAMPLES * SAMPLES)
	_assign_regions()
	return true

# ---------------------------------------------------------------------------------------------
# overview checks (open world)

func _check_open_world() -> Dictionary:
	var report := {"kind": "open_world", "warnings": []}
	# POI density per cell.
	var cell_size := _target("poi_cell_size", 1024.0)
	var columns := int(ceil(size.x / cell_size))
	var rows := int(ceil(size.y / cell_size))
	var counts := {}
	for poi in world.pois:
		var p := _vec(poi.at)
		var key := Vector2i(int((p.x + size.x / 2) / cell_size), int((p.y + size.y / 2) / cell_size))
		counts[key] = counts.get(key, 0) + 1
	var empty := []
	for r in rows:
		for c in columns:
			if not counts.has(Vector2i(c, r)): empty.append([c, r])
	report.poi_cells = {"cell_size": cell_size, "columns": columns, "rows": rows, "empty": empty}
	if empty.size() > columns * rows / 3:
		report.warnings.append("%d of %d cells have no point of interest" % [empty.size(), columns * rows])
	# Distance from each POI to the nearest road.
	var far := []
	var limit := _target("max_poi_road_distance", 400.0)
	for poi in world.pois:
		var d := _distance_to_lines(_vec(poi.at), world.roads)
		if d > limit: far.append({"id": poi.id, "distance": roundi(d)})
	report.pois_far_from_roads = far
	if not far.is_empty(): report.warnings.append("%d points of interest are more than %d m from a road" % [far.size(), roundi(limit)])
	# Landmarks seen from the roads (the next goal should be visible from the path).
	var view := _target("landmark_view_distance", 2000.0)
	var samples := []
	for road in world.roads:
		var points: Array = road.points
		for s in points.size() - 1:
			var a := _vec(points[s])
			var b := _vec(points[s + 1])
			var steps := maxi(1, int(a.distance_to(b) / 200.0))
			for t in steps + 1: samples.append(a.lerp(b, float(t) / steps))
	var visibility := []
	for landmark in world.landmarks:
		var top := _vec(landmark.at)
		var top_height := _h(top) + 2.0
		var near := 0
		var seen := 0
		for p in samples:
			if p.distance_to(top) > view: continue
			near += 1
			if _line_of_sight(p, _h(p) + 2.0, top, top_height): seen += 1
		visibility.append({"id": landmark.id, "road_samples_in_range": near, "seen_from": seen})
		if seen == 0: report.warnings.append("landmark %s is not visible from any road within %d m" % [landmark.id, roundi(view)])
	report.landmark_visibility = visibility
	# Walkable ground and whether every POI is reachable on foot from the start.
	var max_slope := _target("max_walk_slope", 0.7)
	var walkable := PackedByteArray()
	walkable.resize(SAMPLES * SAMPLES)
	var walk_count := 0
	for j in SAMPLES:
		for i in SAMPLES:
			var ok := _slope(i, j) <= max_slope and mask[j * SAMPLES + i] != 1
			walkable[j * SAMPLES + i] = 1 if ok else 0
			if ok: walk_count += 1
	report.walkable_ratio = snappedf(float(walk_count) / (SAMPLES * SAMPLES), 0.001)
	var reached := _flood(walkable, _index_at(_vec(world.get("start", [0, 0]))))
	var unreachable := []
	for poi in world.pois:
		var g := _index_at(_vec(poi.at))
		if reached[g.y * SAMPLES + g.x] == 0: unreachable.append(poi.id)
	report.pois_unreachable_on_foot = unreachable
	if not unreachable.is_empty(): report.warnings.append("%d points of interest cannot be reached on foot from the start" % unreachable.size())
	# Road grades and rivers that keep flowing downhill.
	var roads := []
	for road in world.roads:
		var worst := _worst_grade(road)
		roads.append({"id": road.id, "max_grade": snappedf(worst, 0.001)})
		if worst > float(road.get("max_grade", 0.12)) * 1.25: report.warnings.append("road %s rises %.0f%% at its steepest" % [road.id, worst * 100])
	report.roads = roads
	var rivers := []
	for river in world.rivers:
		var rise := _river_rise(river)
		rivers.append({"id": river.id, "uphill_m": snappedf(rise, 0.1)})
		if rise > 1.0: report.warnings.append("river %s flows uphill by %.1f m" % [river.id, rise])
	report.rivers = rivers
	report.regularity = _regularity(world.pois, report)
	report.summary = {"warnings": report.warnings.size(), "empty_cells": empty.size(), "walkable_ratio": report.walkable_ratio, "pois_unreachable": unreachable.size()}
	return report

func _distance_to_lines(p: Vector2, lines: Array) -> float:
	var best := INF
	for line in lines:
		var points: Array = line.points
		for s in points.size() - 1:
			var closest := Geometry2D.get_closest_point_to_segment(p, _vec(points[s]), _vec(points[s + 1]))
			best = minf(best, p.distance_to(closest))
	return best

func _line_of_sight(from: Vector2, from_h: float, to: Vector2, to_h: float) -> bool:
	var distance := from.distance_to(to)
	var steps := maxi(2, int(distance / (cell * 2.0)))
	for t in range(1, steps):
		var f := float(t) / steps
		if _h(from.lerp(to, f)) > lerpf(from_h, to_h, f) + 1.0: return false
	return true

func _flood(walkable: PackedByteArray, start: Vector2i) -> PackedByteArray:
	var seen := PackedByteArray()
	seen.resize(walkable.size())
	var queue := PackedInt32Array([start.y * SAMPLES + start.x])
	seen[queue[0]] = 1
	var head := 0
	while head < queue.size():
		var k := queue[head]
		head += 1
		var i := k % SAMPLES
		var j := k / SAMPLES
		for o in [Vector2i(1, 0), Vector2i(-1, 0), Vector2i(0, 1), Vector2i(0, -1)]:
			var ni: int = i + o.x
			var nj: int = j + o.y
			if ni < 0 or nj < 0 or ni >= SAMPLES or nj >= SAMPLES: continue
			var nk := nj * SAMPLES + ni
			if seen[nk] == 0 and walkable[nk] == 1:
				seen[nk] = 1
				queue.append(nk)
	return seen

func _worst_grade(road: Dictionary) -> float:
	var worst := 0.0
	var points: Array = road.points
	for s in points.size() - 1:
		var a := _vec(points[s])
		var b := _vec(points[s + 1])
		var steps := maxi(1, int(a.distance_to(b) / (cell * 4.0)))
		for t in steps:
			var p := a.lerp(b, float(t) / steps)
			var q := a.lerp(b, float(t + 1) / steps)
			worst = maxf(worst, absf(_h(q) - _h(p)) / maxf(p.distance_to(q), 0.001))
	return worst

func _river_rise(river: Dictionary) -> float:
	var rise := 0.0
	var lowest := INF
	var points: Array = river.points
	for s in points.size() - 1:
		var a := _vec(points[s])
		var b := _vec(points[s + 1])
		var steps := maxi(1, int(a.distance_to(b) / cell))
		for t in steps + 1:
			var h := _h(a.lerp(b, float(t) / steps))
			if h > lowest: rise = maxf(rise, h - lowest)
			lowest = minf(lowest, h)
	return rise

## Points placed too evenly read as a grid; real places cluster and thin out.
func _regularity(points: Array, report: Dictionary) -> float:
	if points.size() < 4: return 0.0
	var distances := []
	for a in points:
		var best := INF
		for b in points:
			if a != b: best = minf(best, _vec(a.at).distance_to(_vec(b.at)))
		distances.append(best)
	var mean := 0.0
	for d in distances: mean += d
	mean /= distances.size()
	var variance := 0.0
	for d in distances: variance += (d - mean) * (d - mean)
	var cv := sqrt(variance / distances.size()) / maxf(mean, 0.001)
	if cv < 0.15: report.warnings.append("points of interest are spaced almost evenly (looks like a grid)")
	return snappedf(cv, 0.01)

# ---------------------------------------------------------------------------------------------
# areas: rooms (2D) or zones (3D) linked by doors, with ability gates

func _check_areas() -> Dictionary:
	var report := {"kind": "areas", "warnings": []}
	var by_id := {}
	for area in world.areas: by_id[area.id] = area
	var links: Array = world.get("links", [])
	var start := str(world.get("start", ""))
	if not by_id.has(start):
		report.warnings.append("start must name an area")
		report.summary = {"warnings": report.warnings.size()}
		return report
	# Abilities found in reached areas open gated links; repeat until nothing new opens.
	var reached := {start: true}
	var abilities := {}
	var changed := true
	while changed:
		changed = false
		for id in reached.keys():
			for ability in by_id[id].get("grants", []): abilities[ability] = true
		for link in links:
			var gate = link.get("gate")
			if gate != null and not abilities.has(gate): continue
			for pair in [[link.from, link.to], [link.to, link.from]]:
				if link.get("one_way", false) and pair[0] != link.from: continue
				if reached.has(pair[0]) and by_id.has(pair[1]) and not reached.has(pair[1]):
					reached[pair[1]] = true
					changed = true
	var unreachable := []
	for id in by_id:
		if not reached.has(id): unreachable.append(id)
	report.areas_unreachable = unreachable
	if not unreachable.is_empty(): report.warnings.append("%d areas cannot be reached with the abilities found" % unreachable.size())
	var degree := {}
	for link in links:
		degree[link.from] = degree.get(link.from, 0) + 1
		degree[link.to] = degree.get(link.to, 0) + 1
	var dead_ends := []
	for id in by_id:
		if id != start and degree.get(id, 0) <= 1 and by_id[id].get("role", "") != "goal" and by_id[id].get("grants", []).is_empty() and by_id[id].get("role", "") != "reward":
			dead_ends.append(id)
	report.dead_ends_without_reason = dead_ends
	# The critical path must follow real links.
	var broken := []
	var path: Array = world.get("critical_path", [])
	for t in path.size() - 1:
		var linked := false
		for link in links:
			if (link.from == path[t] and link.to == path[t + 1]) or (not link.get("one_way", false) and link.to == path[t] and link.from == path[t + 1]): linked = true
		if not linked: broken.append([path[t], path[t + 1]])
	report.critical_path_breaks = broken
	if not broken.is_empty(): report.warnings.append("the critical path jumps between %d pairs of areas that are not linked" % broken.size())
	if not dead_ends.is_empty(): report.warnings.append("%d dead ends have no reward, ability or goal" % dead_ends.size())
	report.summary = {"warnings": report.warnings.size(), "areas": by_id.size(), "unreachable": unreachable.size(), "dead_ends": dead_ends.size(), "critical_path_breaks": broken.size()}
	return report

# ---------------------------------------------------------------------------------------------
# drawing (data only; works in headless runs)

const POI_COLORS := {"town": Color(0.95, 0.35, 0.25), "camp": Color(0.95, 0.6, 0.15), "ruin": Color(0.6, 0.45, 0.85), "shrine": Color(0.3, 0.85, 0.95), "boss": Color(0.85, 0.1, 0.35)}

func _draw_open_world(report: Dictionary, marks: bool) -> Image:
	var image := Image.create_empty(SAMPLES, SAMPLES, false, Image.FORMAT_RGB8)
	var light := Vector2(-1, -1).normalized()
	for j in SAMPLES:
		for i in SAMPLES:
			var k := j * SAMPLES + i
			var h := heights[k] / height_scale
			var color := Color(0.33, 0.55, 0.28).lerp(Color(0.55, 0.47, 0.35), smoothstep(0.25, 0.6, h)).lerp(Color(0.95, 0.95, 0.97), smoothstep(0.7, 0.85, h))
			var gx := heights[j * SAMPLES + mini(i + 1, SAMPLES - 1)] - heights[j * SAMPLES + maxi(i - 1, 0)]
			var gz := heights[mini(j + 1, SAMPLES - 1) * SAMPLES + i] - heights[maxi(j - 1, 0) * SAMPLES + i]
			var shade := clampf(0.85 + Vector2(gx, gz).dot(light) / (cell * 2.0) * 2.5, 0.35, 1.3)
			color = color * shade
			if mask[k] == 3: color = color.lerp(Color(0.9, 0.85, 0.75), 0.5)
			if region_of.size() == SAMPLES * SAMPLES and _is_border(i, j): color = color.darkened(0.45)
			image.set_pixel(i, j, color)
	var cell_size: float = report.poi_cells.cell_size
	var px := cell_size / cell
	for c in (report.poi_cells.empty if marks else []):
		_hatch(image, Rect2i(int(c[0] * px), int(c[1] * px), int(px), int(px)), Color(0.85, 0.2, 0.2))
	for g in range(0, int(SAMPLES / px) + 1):
		_line(image, Vector2(g * px, 0), Vector2(g * px, SAMPLES - 1), Color(1, 1, 1, 0.25))
		_line(image, Vector2(0, g * px), Vector2(SAMPLES - 1, g * px), Color(1, 1, 1, 0.25))
	# Lines are drawn over the terrain so narrow roads stay readable at this scale.
	for river in world.rivers: _polyline(image, river.points, Color(0.15, 0.4, 0.9), 4)
	for road in world.roads:
		_polyline(image, road.points, Color(0.15, 0.12, 0.1), 5)
		_polyline(image, road.points, Color(0.95, 0.85, 0.6), 3)
	var unseen := {}
	for entry in report.landmark_visibility:
		if entry.seen_from == 0: unseen[entry.id] = true
	var index := 1
	for landmark in world.landmarks:
		var p := _pixel(_vec(landmark.at))
		_triangle(image, p, 12, Color(0.1, 0.1, 0.1))
		_triangle(image, p, 9, Color(1.0, 0.25, 0.25) if marks and unseen.has(landmark.id) else Color(1, 1, 1))
	for poi in world.pois:
		var p := _pixel(_vec(poi.at))
		var color: Color = POI_COLORS.get(str(poi.get("kind", "")), Color(0.95, 0.9, 0.3))
		_disc(image, p, 8 if poi.get("major", false) else 6, Color(0.05, 0.05, 0.05))
		_disc(image, p, 6 if poi.get("major", false) else 4, color)
		_number(image, p + Vector2(9, -4), index)
		index += 1
	var start := _pixel(_vec(world.get("start", [0, 0])))
	_disc(image, start, 7, Color(0, 0, 0))
	_disc(image, start, 5, Color(1, 1, 1))
	return image

func _is_border(i: int, j: int) -> bool:
	var r := region_of[j * SAMPLES + i]
	return (i + 1 < SAMPLES and region_of[j * SAMPLES + i + 1] != r) or (j + 1 < SAMPLES and region_of[(j + 1) * SAMPLES + i] != r)

func _draw_areas(report: Dictionary, marks: bool) -> Image:
	var bounds := Rect2()
	var first := true
	for area in world.areas:
		var r: Array = area.get("rect", [0, 0, 1, 1])
		var rect := Rect2(r[0], r[1], r[2], r[3])
		bounds = rect if first else bounds.merge(rect)
		first = false
	var scale := 960.0 / maxf(bounds.size.x, bounds.size.y)
	var image := Image.create_empty(1024, 1024, false, Image.FORMAT_RGB8)
	image.fill(Color(0.1, 0.11, 0.13))
	var to_px := func(p: Vector2) -> Vector2: return (p - bounds.position) * scale + Vector2(32, 32)
	var centers := {}
	var regions := {}
	var palette := [Color(0.35, 0.55, 0.85), Color(0.45, 0.75, 0.45), Color(0.85, 0.6, 0.3), Color(0.7, 0.45, 0.75), Color(0.85, 0.4, 0.4), Color(0.4, 0.75, 0.75)]
	var unreachable := {}
	var dead := {}
	if marks:
		for id in report.get("areas_unreachable", []): unreachable[id] = true
		for id in report.get("dead_ends_without_reason", []): dead[id] = true
	for area in world.areas:
		var r: Array = area.get("rect", [0, 0, 1, 1])
		var a: Vector2 = to_px.call(Vector2(r[0], r[1]))
		var b: Vector2 = to_px.call(Vector2(r[0] + r[2], r[1] + r[3]))
		var region := str(area.get("region", ""))
		if not regions.has(region): regions[region] = palette[regions.size() % palette.size()]
		var rect := Rect2i(Vector2i(a), Vector2i(b - a).max(Vector2i(4, 4)))
		image.fill_rect(rect, regions[region].darkened(0.35) if unreachable.has(area.id) else regions[region])
		if dead.has(area.id): _hatch(image, rect, Color(0.9, 0.2, 0.2))
		centers[area.id] = (a + b) / 2.0
	var path: Array = world.get("critical_path", [])
	for link in world.get("links", []):
		if not centers.has(link.from) or not centers.has(link.to): continue
		var on_path := false
		for t in path.size() - 1:
			if (path[t] == link.from and path[t + 1] == link.to) or (path[t] == link.to and path[t + 1] == link.from): on_path = true
		var gated: bool = link.get("gate") != null
		var color := Color(1, 0.85, 0.2) if on_path else (Color(0.9, 0.4, 0.9) if gated else Color(0.85, 0.85, 0.85))
		_line(image, centers[link.from], centers[link.to], color, 3 if on_path or gated else 1)
	var index := 1
	for area in world.areas:
		_number(image, centers[area.id] - Vector2(4, 3), index)
		index += 1
	if centers.has(str(world.get("start", ""))):
		_disc(image, centers[str(world.start)] + Vector2(0, 14), 6, Color(1, 1, 1))
	return image

func _pixel(p: Vector2) -> Vector2:
	return Vector2((p.x + size.x / 2) / cell, (p.y + size.y / 2) / (size.y / SAMPLES))

func _polyline(image: Image, points: Array, color: Color, width: int) -> void:
	for s in points.size() - 1: _line(image, _pixel(_vec(points[s])), _pixel(_vec(points[s + 1])), color, width)

func _line(image: Image, a: Vector2, b: Vector2, color: Color, width: int = 1) -> void:
	var steps := int(maxf(absf(b.x - a.x), absf(b.y - a.y))) + 1
	for t in steps + 1:
		var p := a.lerp(b, float(t) / steps)
		for o in range(-(width / 2), width / 2 + 1):
			for q in range(-(width / 2), width / 2 + 1):
				_blend(image, int(p.x) + o, int(p.y) + q, color)

func _disc(image: Image, center: Vector2, radius: int, color: Color) -> void:
	for y in range(-radius, radius + 1):
		for x in range(-radius, radius + 1):
			if x * x + y * y <= radius * radius: _blend(image, int(center.x) + x, int(center.y) + y, color)

func _triangle(image: Image, center: Vector2, radius: int, color: Color) -> void:
	for y in range(-radius, radius + 1):
		var half := int((y + radius) * 0.6)
		for x in range(-half, half + 1): _blend(image, int(center.x) + x, int(center.y) + y, color)

func _hatch(image: Image, rect: Rect2i, color: Color) -> void:
	for y in range(rect.position.y, rect.end.y):
		for x in range(rect.position.x, rect.end.x):
			if (x + y) % 10 < 2: _blend(image, x, y, Color(color, 0.7))

func _blend(image: Image, x: int, y: int, color: Color) -> void:
	if x < 0 or y < 0 or x >= image.get_width() or y >= image.get_height(): return
	image.set_pixel(x, y, image.get_pixel(x, y).lerp(Color(color.r, color.g, color.b), color.a))

## Numbers label places on the map; their names are listed in level-design.md under the same numbers.
const DIGITS := ["111101101101111", "010110010010111", "111001111100111", "111001111001111", "101101111001001", "111100111001111", "111100111101111", "111001001001001", "111101111101111", "111101111001111"]

func _number(image: Image, at: Vector2, value: int) -> void:
	var text := str(value)
	image.fill_rect(Rect2i(int(at.x) - 2, int(at.y) - 2, text.length() * 8 + 3, 14), Color(0, 0, 0))
	for c in text.length():
		var glyph: String = DIGITS[int(text[c])]
		for y in 5:
			for x in 3:
				if glyph[y * 3 + x] == "1":
					image.fill_rect(Rect2i(int(at.x) + c * 8 + x * 2, int(at.y) + y * 2, 2, 2), Color(1, 1, 1))

func _write(path: String, text: String) -> void:
	var file := FileAccess.open(path, FileAccess.WRITE)
	if file == null:
		push_error("world.gd: cannot write %s (%s)" % [path, error_string(FileAccess.get_open_error())])
		return
	file.store_string(text)

func _write_bytes(path: String, bytes: PackedByteArray) -> void:
	var file := FileAccess.open(path, FileAccess.WRITE)
	if file == null:
		push_error("world.gd: cannot write %s (%s)" % [path, error_string(FileAccess.get_open_error())])
		return
	file.store_buffer(bytes)
