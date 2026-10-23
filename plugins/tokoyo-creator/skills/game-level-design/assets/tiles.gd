extends SceneTree
## Tile tools for the game agent (game-level-design references/tilemaps.md). Build-time only:
## nothing here ships in the game. Run `godot --headless --path <source>/godot --import` first so
## the tile images are imported resources.
##
##   godot --headless --path <source>/godot -s <tool> -- atlas <res://dir> --out <res://sheet.png> [--columns N]
##   godot --headless --path <source>/godot -s <tool> -- sheet <res://image.png> [--tile WxH] [--margin X,Y] [--separation X,Y]
##   godot --headless --path <source>/godot -s <tool> -- greybox <res://dir> --tile N --terrains a,b,c
##   godot --headless --path <source>/godot -s <tool> -- tileset <source>/design/tiles/<name>.json
##   godot --headless --path <source>/godot -s <tool> -- paint <source>/design/tilemaps/<room>.json
##   godot --headless --path <source>/godot -s <tool> -- meshlib <res://kit.glb> <res://out.tres>
##
## atlas: packs single tile images (one PNG per tile, as CC0 packs like Kenney ship them) into one
##   sheet in file-name order and writes `<sheet>.atlas.json` (file → atlas coords).
## sheet: reads a tile sheet, guesses the grid when --tile is missing, and writes `<image>.sheet.png`
##   (enlarged, gridded, row/column numbers) plus `<image>.sheet.json` (per-tile edge opacity and a
##   suggested terrain shape) next to the image, so the agent can look at the sheet before mapping it.
## greybox: writes a flat-colour corner tile sheet (16 tiles per terrain) and its tileset spec, so a
##   greybox map can autotile before any art exists.
## tileset: builds a TileSet resource from a JSON spec (atlas grid, padding, collision, one-way,
##   custom data, terrain sets with peering bits, probability, animation).
## paint: paints TileMapLayer nodes of a scene from character grids with terrain connect, saves the
##   scene, writes a picture of the result (from the atlas, no GPU) and reports cells whose
##   neighbours have no matching tile.
## meshlib: turns each mesh of a 3D kit into a MeshLibrary item (with a collision shape) for GridMap.

const MODES := {"corners_and_sides": TileSet.TERRAIN_MODE_MATCH_CORNERS_AND_SIDES, "corners": TileSet.TERRAIN_MODE_MATCH_CORNERS, "sides": TileSet.TERRAIN_MODE_MATCH_SIDES}
## Peering bits in the order a shape string lists them (clockwise from the top left).
const SHAPE_BITS := {
	"corners": [TileSet.CELL_NEIGHBOR_TOP_LEFT_CORNER, TileSet.CELL_NEIGHBOR_TOP_RIGHT_CORNER, TileSet.CELL_NEIGHBOR_BOTTOM_RIGHT_CORNER, TileSet.CELL_NEIGHBOR_BOTTOM_LEFT_CORNER],
	"sides": [TileSet.CELL_NEIGHBOR_TOP_SIDE, TileSet.CELL_NEIGHBOR_RIGHT_SIDE, TileSet.CELL_NEIGHBOR_BOTTOM_SIDE, TileSet.CELL_NEIGHBOR_LEFT_SIDE],
	"corners_and_sides": [TileSet.CELL_NEIGHBOR_TOP_LEFT_CORNER, TileSet.CELL_NEIGHBOR_TOP_SIDE, TileSet.CELL_NEIGHBOR_TOP_RIGHT_CORNER, TileSet.CELL_NEIGHBOR_RIGHT_SIDE, TileSet.CELL_NEIGHBOR_BOTTOM_RIGHT_CORNER, TileSet.CELL_NEIGHBOR_BOTTOM_SIDE, TileSet.CELL_NEIGHBOR_BOTTOM_LEFT_CORNER, TileSet.CELL_NEIGHBOR_LEFT_SIDE],
}
const DATA_TYPES := {"bool": TYPE_BOOL, "int": TYPE_INT, "float": TYPE_FLOAT, "string": TYPE_STRING, "vector2": TYPE_VECTOR2, "color": TYPE_COLOR}
## Tile sizes common in CC0 sheets, tried in order when the grid is guessed.
const COMMON_SIZES := [16, 18, 32, 64, 24, 48, 8, 12, 20, 21, 128]

func _initialize() -> void:
	var args := OS.get_cmdline_user_args()
	var commands := ["atlas", "sheet", "greybox", "tileset", "paint", "meshlib"]
	if args.is_empty() or not args[0] in commands:
		_fail("usage: tiles.gd -- %s ..." % "|".join(commands))
		return
	var ok := false
	match args[0]:
		"atlas": ok = _atlas(args.slice(1))
		"sheet": ok = _sheet(args.slice(1))
		"greybox": ok = _greybox(args.slice(1))
		"tileset": ok = _tileset(args.slice(1))
		"paint": ok = await _paint(args.slice(1))
		"meshlib": ok = _meshlib(args.slice(1))
	quit(0 if ok else 1)

func _fail(message: String) -> bool:
	printerr("tiles.gd: ", message)
	quit(1)
	return false

func _option(args: Array, name: String, fallback: String = "") -> String:
	var at := args.find(name)
	return args[at + 1] if at >= 0 and at + 1 < args.size() else fallback

func _pair(text: String, fallback: Vector2i) -> Vector2i:
	if text == "": return fallback
	var parts := text.replace("x", ",").split(",")
	if parts.size() == 1: return Vector2i(int(parts[0]), int(parts[0]))
	return Vector2i(int(parts[0]), int(parts[1]))

func _vec2i(value, fallback: Vector2i) -> Vector2i:
	if value is Array and value.size() == 2: return Vector2i(int(value[0]), int(value[1]))
	if value is float or value is int: return Vector2i(int(value), int(value))
	return fallback

func _read_json(path: String) -> Dictionary:
	var parsed = JSON.parse_string(FileAccess.get_file_as_string(path))
	if not parsed is Dictionary:
		printerr("tiles.gd: %s is not a JSON object" % path)
		return {}
	return parsed

func _load_image(path: String) -> Image:
	var image := Image.load_from_file(ProjectSettings.globalize_path(path) if path.begins_with("res://") else path)
	if image == null or image.is_empty():
		printerr("tiles.gd: cannot read image %s" % path)
		return null
	if image.is_compressed(): image.decompress()
	image.convert(Image.FORMAT_RGBA8)
	return image

# ---------------------------------------------------------------------------------------------
# atlas: single tile files → one sheet

func _atlas(args: Array) -> bool:
	if args.is_empty(): return _fail("atlas needs a res:// directory of tile images")
	var dir: String = args[0]
	var out := _option(args, "--out")
	if out == "": return _fail("atlas needs --out res://….png")
	var files := []
	for file in DirAccess.get_files_at(dir):
		if file.get_extension().to_lower() == "png": files.append(file)
	if files.is_empty(): return _fail("atlas: no PNG in %s" % dir)
	files.sort_custom(func(a: String, b: String) -> bool: return a.naturalnocasecmp_to(b) < 0)
	var images := []
	var tile := Vector2i.ZERO
	for file in files:
		var image := _load_image(dir.path_join(file))
		if image == null: return _fail("atlas: cannot read %s" % file)
		tile = Vector2i(maxi(tile.x, image.get_width()), maxi(tile.y, image.get_height()))
		images.append(image)
	var columns := int(_option(args, "--columns", str(ceili(sqrt(files.size())))))
	var rows := ceili(float(files.size()) / columns)
	var sheet := Image.create(columns * tile.x, rows * tile.y, false, Image.FORMAT_RGBA8)
	var mapping := {}
	var odd := []
	for i in files.size():
		var at := Vector2i(i % columns, i / columns)
		var image: Image = images[i]
		if image.get_size() != tile: odd.append(files[i])
		sheet.blit_rect(image, Rect2i(Vector2i.ZERO, image.get_size()), at * tile)
		mapping[files[i]] = [at.x, at.y]
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(out.get_base_dir()))
	sheet.save_png(ProjectSettings.globalize_path(out))
	_write(out.get_basename() + ".atlas.json", JSON.stringify({"image": out, "tile": [tile.x, tile.y], "columns": columns, "files": mapping}, "  "))
	print("TILES_ATLAS=", JSON.stringify({"image": out, "tile": [tile.x, tile.y], "columns": columns, "rows": rows, "files": files.size(), "different_size": odd}))
	return true

# ---------------------------------------------------------------------------------------------
# sheet: look at a tile sheet before mapping it

func _sheet(args: Array) -> bool:
	if args.is_empty(): return _fail("sheet needs an image path")
	var path: String = args[0]
	var image := _load_image(path)
	if image == null: return _fail("sheet: no image")
	var margin := _pair(_option(args, "--margin"), Vector2i.ZERO)
	var separation := _pair(_option(args, "--separation"), Vector2i(-1, -1))
	var tile := _pair(_option(args, "--tile"), Vector2i.ZERO)
	var guess := {}
	if tile == Vector2i.ZERO or separation.x < 0:
		guess = _guess_grid(image, margin, tile, separation)
		if guess.is_empty(): return _fail("sheet: could not guess the grid; pass --tile WxH (and --separation)")
		tile = guess.tile
		separation = guess.separation
	var grid := Vector2i((image.get_width() - margin.x * 2 + separation.x) / (tile.x + separation.x), (image.get_height() - margin.y * 2 + separation.y) / (tile.y + separation.y))
	var tiles := []
	for y in grid.y:
		for x in grid.x:
			var rect := Rect2i(margin + Vector2i(x, y) * (tile + separation), tile)
			var edges := _edges(image, rect)
			if edges.fill == 0.0: continue
			tiles.append({"coords": [x, y], "fill": snappedf(edges.fill, 0.01), "edges": edges.sides, "corners_shape": edges.corners_shape, "sides_shape": edges.sides_shape, "full_shape": edges.full_shape})
	var info := {"image": path, "size": [image.get_width(), image.get_height()], "tile": [tile.x, tile.y], "margin": [margin.x, margin.y], "separation": [separation.x, separation.y], "grid": [grid.x, grid.y], "tiles": tiles, "guessed": not guess.is_empty()}
	var base := path.get_basename()
	_write(base + ".sheet.json", JSON.stringify(info, "  "))
	_preview(image, tile, margin, separation, grid).save_png(ProjectSettings.globalize_path(base + ".sheet.png"))
	print("TILES_SHEET=", JSON.stringify({"tile": info.tile, "separation": info.separation, "grid": info.grid, "tiles": tiles.size(), "guessed": info.guessed}))
	return true

## Picks the tile size whose grid lines fall on fully transparent gutters, or (no gutters) whose
## cells line up with the most transparent/opaque edges. Returns {} when nothing fits.
func _guess_grid(image: Image, margin: Vector2i, tile: Vector2i, separation: Vector2i) -> Dictionary:
	var w := image.get_width() - margin.x * 2
	var h := image.get_height() - margin.y * 2
	var sizes := [tile.x] if tile != Vector2i.ZERO else COMMON_SIZES
	var best := {}
	var best_score := -1.0
	for s in sizes:
		for sep in ([separation.x] if separation.x >= 0 else [0, 1, 2]):
			if (w + sep) % (s + sep) != 0 or (h + sep) % (s + sep) != 0: continue
			var cols: int = (w + sep) / (s + sep)
			var rows: int = (h + sep) / (s + sep)
			if cols < 1 or rows < 1: continue
			var score := 0.0
			if sep > 0:
				score = _gutter_clear(image, margin, s, sep, cols, rows) * 2.0
			else:
				score = _cell_contrast(image, margin, s, cols, rows)
			# Prefer the larger of two equally good sizes (a 32 grid also divides into 16s).
			score += s * 0.0001
			if score > best_score:
				best_score = score
				best = {"tile": Vector2i(s, s), "separation": Vector2i(sep, sep)}
	return best if best_score > 0.5 else {}

func _gutter_clear(image: Image, margin: Vector2i, s: int, sep: int, cols: int, rows: int) -> float:
	var clear := 0
	var total := 0
	for c in cols - 1:
		var x := margin.x + (c + 1) * (s + sep) - sep
		for y in range(margin.y, image.get_height() - margin.y, 3):
			total += 1
			if image.get_pixel(x, y).a < 0.05: clear += 1
	for r in rows - 1:
		var y := margin.y + (r + 1) * (s + sep) - sep
		for x in range(margin.x, image.get_width() - margin.x, 3):
			total += 1
			if image.get_pixel(x, y).a < 0.05: clear += 1
	return float(clear) / max(total, 1)

## Without gutters, real cell boundaries are where colour changes most often between neighbours.
func _cell_contrast(image: Image, margin: Vector2i, s: int, cols: int, rows: int) -> float:
	var on := 0.0
	var off := 0.0
	var n_on := 0
	var n_off := 0
	for y in range(margin.y, image.get_height() - margin.y - 1, 2):
		for x in range(margin.x + 1, image.get_width() - margin.x):
			var d := _diff(image.get_pixel(x - 1, y), image.get_pixel(x, y))
			if (x - margin.x) % s == 0:
				on += d
				n_on += 1
			else:
				off += d
				n_off += 1
	if n_on == 0 or n_off == 0: return 0.0
	var ratio: float = (on / n_on) / max(off / n_off, 0.0001)
	return clampf((ratio - 1.0) / 2.0, 0.0, 1.0)

func _diff(a: Color, b: Color) -> float:
	return absf(a.r - b.r) + absf(a.g - b.g) + absf(a.b - b.b) + absf(a.a - b.a)

## Which sides and corners of one tile continue into the next tile. A border continues when it is
## opaque and looks like the tile's inside; outlines, grass caps and transparent edges do not. The
## result is a suggested terrain shape ("#" = terrain, "." = empty) for the agent to confirm
## against the enlarged picture, not a fact.
func _edges(image: Image, rect: Rect2i) -> Dictionary:
	var opaque := 0
	for y in range(rect.position.y, rect.end.y):
		for x in range(rect.position.x, rect.end.x):
			if image.get_pixel(x, y).a > 0.5: opaque += 1
	var fill := float(opaque) / (rect.size.x * rect.size.y)
	var p := rect.position
	var e := rect.size
	var b := maxi(1, e.x / 16)
	var q := maxi(1, e.x / 4)
	var inside := _average(image, Rect2i(p + e / 4, e / 2))
	var strips := {
		"top": Rect2i(p.x + q, p.y, e.x - q * 2, b), "right": Rect2i(p.x + e.x - b, p.y + q, b, e.y - q * 2),
		"bottom": Rect2i(p.x + q, p.y + e.y - b, e.x - q * 2, b), "left": Rect2i(p.x, p.y + q, b, e.y - q * 2),
		"tl": Rect2i(p.x, p.y, q, b).merge(Rect2i(p.x, p.y, b, q)), "tr": Rect2i(p.x + e.x - q, p.y, q, b).merge(Rect2i(p.x + e.x - b, p.y, b, q)),
		"br": Rect2i(p.x + e.x - q, p.y + e.y - b, q, b).merge(Rect2i(p.x + e.x - b, p.y + e.y - q, b, q)), "bl": Rect2i(p.x, p.y + e.y - b, q, b).merge(Rect2i(p.x, p.y + e.y - q, b, q)),
	}
	var open := {}
	var sides := {}
	for key in strips:
		var opacity := _opacity(image, strips[key])
		var avg := _average(image, strips[key])
		var alike := inside.a > 0.5 and _diff(avg, inside) < 0.35
		open[key] = "#" if opacity > 0.5 and alike else "."
		if key.length() > 2: sides[key] = {"opacity": snappedf(opacity, 0.01), "like_inside": alike}
	return {
		"fill": fill,
		"sides": sides,
		"corners_shape": open.tl + open.tr + open.br + open.bl,
		"sides_shape": open.top + open.right + open.bottom + open.left,
		"full_shape": open.tl + open.top + open.tr + open.right + open.br + open.bottom + open.bl + open.left,
	}

func _average(image: Image, rect: Rect2i) -> Color:
	var sum := Color(0, 0, 0, 0)
	var n := 0
	for y in range(rect.position.y, rect.end.y):
		for x in range(rect.position.x, rect.end.x):
			sum += image.get_pixel(x, y)
			n += 1
	return sum / max(n, 1)

func _opacity(image: Image, rect: Rect2i) -> float:
	var hit := 0
	var total := 0
	for y in range(rect.position.y, rect.end.y):
		for x in range(rect.position.x, rect.end.x):
			total += 1
			if image.get_pixel(x, y).a > 0.5: hit += 1
	return float(hit) / max(total, 1)

func _preview(image: Image, tile: Vector2i, margin: Vector2i, separation: Vector2i, grid: Vector2i) -> Image:
	var scale := maxi(1, 48 / maxi(tile.x, tile.y))
	var cellw := tile.x * scale + 1
	var cellh := tile.y * scale + 1
	var pad := 22
	var out := Image.create(pad + grid.x * cellw + 1, pad + grid.y * cellh + 1, false, Image.FORMAT_RGBA8)
	out.fill(Color(0.12, 0.13, 0.16))
	for y in grid.y:
		for x in grid.x:
			var region := image.get_region(Rect2i(margin + Vector2i(x, y) * (tile + separation), tile))
			region.resize(tile.x * scale, tile.y * scale, Image.INTERPOLATE_NEAREST)
			var at := Vector2i(pad + x * cellw + 1, pad + y * cellh + 1)
			# Checkerboard behind transparent pixels so empty and dark tiles are told apart.
			for cy in range(0, tile.y * scale, 6):
				for cx in range(0, tile.x * scale, 6):
					var shade := 0.22 if ((cx + cy) / 6) % 2 == 0 else 0.28
					out.fill_rect(Rect2i(at + Vector2i(cx, cy), Vector2i(mini(6, tile.x * scale - cx), mini(6, tile.y * scale - cy))), Color(shade, shade, shade))
			out.blend_rect(region, Rect2i(Vector2i.ZERO, region.get_size()), at)
	for x in grid.x + 1:
		out.fill_rect(Rect2i(pad + x * cellw, pad, 1, grid.y * cellh), Color(1, 0.3, 0.6))
	for y in grid.y + 1:
		out.fill_rect(Rect2i(pad, pad + y * cellh, grid.x * cellw, 1), Color(1, 0.3, 0.6))
	for x in grid.x:
		_number(out, Vector2(pad + x * cellw + 3, 4), x)
	for y in grid.y:
		_number(out, Vector2(2, pad + y * cellh + 4), y)
	return out

# ---------------------------------------------------------------------------------------------
# greybox: flat-colour corner tiles so a greybox map autotiles before art exists

const GREYBOX_COLORS := [Color(0.55, 0.55, 0.6), Color(0.4, 0.62, 0.36), Color(0.3, 0.5, 0.8), Color(0.72, 0.6, 0.38), Color(0.62, 0.38, 0.38), Color(0.5, 0.42, 0.66)]

func _greybox(args: Array) -> bool:
	if args.is_empty(): return _fail("greybox needs an output res:// directory")
	var dir: String = args[0]
	var size := int(_option(args, "--tile", "16"))
	var names := _option(args, "--terrains", "ground").split(",", false)
	if size < 6 or names.is_empty(): return _fail("greybox needs --tile >= 6 and --terrains a,b")
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(dir))
	var shapes := _blob_shapes()
	var columns := 8
	var rows_per := ceili(float(shapes.size()) / columns)
	var image := Image.create(size * columns, size * rows_per * names.size(), false, Image.FORMAT_RGBA8)
	var tiles := {}
	var terrains := []
	var third := size / 3
	# 3x3 parts of a tile in shape order (TL, T, TR, R, BR, B, BL, L), then the centre.
	var parts := [Rect2i(0, 0, third, third), Rect2i(third, 0, size - third * 2, third), Rect2i(size - third, 0, third, third),
		Rect2i(size - third, third, third, size - third * 2), Rect2i(size - third, size - third, third, third),
		Rect2i(third, size - third, size - third * 2, third), Rect2i(0, size - third, third, third), Rect2i(0, third, third, size - third * 2)]
	var centre := Rect2i(third, third, size - third * 2, size - third * 2)
	for t in names.size():
		var base: Color = GREYBOX_COLORS[t % GREYBOX_COLORS.size()]
		terrains.append({"name": names[t], "color": "#" + base.to_html(false)})
		for i in shapes.size():
			var shape: String = shapes[i]
			var at := Vector2i(i % columns, t * rows_per + i / columns)
			var origin := at * size
			image.fill_rect(Rect2i(origin + centre.position, centre.size), base)
			for k in 8:
				if shape[k] == "#": image.fill_rect(Rect2i(origin + parts[k].position, parts[k].size), base)
			# A darker rim where the terrain meets empty space keeps the shape readable.
			for y in size:
				for x in size:
					var px := origin + Vector2i(x, y)
					if image.get_pixelv(px).a == 0.0: continue
					var edge := x == 0 and shape[7] == "." or x == size - 1 and shape[3] == "." or y == 0 and shape[1] == "." or y == size - 1 and shape[5] == "."
					for d in [Vector2i(1, 0), Vector2i(-1, 0), Vector2i(0, 1), Vector2i(0, -1)]:
						var n: Vector2i = Vector2i(x, y) + d
						if n.x >= 0 and n.y >= 0 and n.x < size and n.y < size and image.get_pixelv(origin + n).a == 0.0: edge = true
					if edge: image.set_pixelv(px, base.darkened(0.35))
			tiles["%d,%d" % [at.x, at.y]] = {"terrain": names[t], "shape": shape, "collision": "solid"}
	var png := dir.path_join("greybox_tiles.png")
	image.save_png(ProjectSettings.globalize_path(png))
	var spec := {
		"version": 1,
		"image": png,
		"tile_size": [size, size],
		"output": dir.path_join("greybox_tiles.tres"),
		"physics_layers": [{"collision_layer": 1, "collision_mask": 1}],
		"terrain_sets": [{"mode": "corners_and_sides", "terrains": terrains}],
		"tiles": tiles,
	}
	_write(dir.path_join("greybox_tiles.json"), JSON.stringify(spec, "  "))
	print("TILES_GREYBOX=", JSON.stringify({"image": png, "spec": dir.path_join("greybox_tiles.json"), "terrains": names, "tiles_per_terrain": shapes.size()}))
	return true

## The 47 neighbour shapes of a "corners and sides" set: a corner counts only when both sides
## next to it connect (Godot's 3x3 minimal layout).
func _blob_shapes() -> Array:
	var seen := {}
	var list := []
	for mask in 256:
		var b := []
		for k in 8: b.append(mask & (1 << k) != 0)
		# Shape order: 0 TL, 1 T, 2 TR, 3 R, 4 BR, 5 B, 6 BL, 7 L
		if b[0] and not (b[1] and b[7]): continue
		if b[2] and not (b[1] and b[3]): continue
		if b[4] and not (b[3] and b[5]): continue
		if b[6] and not (b[5] and b[7]): continue
		var shape := ""
		for k in 8: shape += "#" if b[k] else "."
		if not seen.has(shape):
			seen[shape] = true
			list.append(shape)
	return list

# ---------------------------------------------------------------------------------------------
# tileset: JSON spec → TileSet resource

func _tileset(args: Array) -> bool:
	if args.is_empty(): return _fail("tileset needs a spec path")
	var spec := _read_json(args[0])
	if spec.is_empty(): return _fail("tileset: no spec")
	var tile_set := TileSet.new()
	tile_set.tile_size = _vec2i(spec.get("tile_size"), Vector2i(16, 16))
	var problems := []
	for layer in spec.get("physics_layers", [{}]):
		var i := tile_set.get_physics_layers_count()
		tile_set.add_physics_layer()
		tile_set.set_physics_layer_collision_layer(i, int(layer.get("collision_layer", 1)))
		tile_set.set_physics_layer_collision_mask(i, int(layer.get("collision_mask", 1)))
	var custom: Dictionary = spec.get("custom_data", {})
	for name in custom:
		if not DATA_TYPES.has(custom[name]):
			problems.append("custom_data %s: unknown type %s" % [name, custom[name]])
			continue
		var i := tile_set.get_custom_data_layers_count()
		tile_set.add_custom_data_layer()
		tile_set.set_custom_data_layer_name(i, name)
		tile_set.set_custom_data_layer_type(i, DATA_TYPES[custom[name]])
	# Terrains are referred to by name or by a one-character key in shape strings.
	var terrain_ref := {}
	var set_mode := {}
	var sets: Array = spec.get("terrain_sets", [])
	for s in sets.size():
		var mode: String = sets[s].get("mode", "corners")
		if not MODES.has(mode):
			problems.append("terrain set %d: unknown mode %s" % [s, mode])
			continue
		tile_set.add_terrain_set()
		tile_set.set_terrain_set_mode(s, MODES[mode])
		set_mode[s] = mode
		var list: Array = sets[s].get("terrains", [])
		for t in list.size():
			tile_set.add_terrain(s, t)
			tile_set.set_terrain_name(s, t, list[t].name)
			tile_set.set_terrain_color(s, t, Color.from_string(list[t].get("color", "#888888"), Color.GRAY))
			terrain_ref[list[t].name] = Vector2i(s, t)
			if list[t].has("key"): terrain_ref[str(list[t].key)] = Vector2i(s, t)
	var fallbacks := []
	for s in sets.size():
		for terrain in sets[s].get("terrains", []):
			if terrain.has("fallback_tile"): fallbacks.append({"terrain": terrain.name, "tile": str(terrain.fallback_tile), "source": int(terrain.get("fallback_source", 0)), "mode": sets[s].get("mode", "corners")})
	var sources: Array = spec.get("atlases", [])
	if sources.is_empty() and spec.has("image"):
		sources = [{"image": spec.image, "tile_size": spec.get("tile_size"), "margin": spec.get("margin"), "separation": spec.get("separation"), "tiles": spec.get("tiles", {})}]
	var created := 0
	for source_index in sources.size():
		var src: Dictionary = sources[source_index]
		var texture = load(src.image)
		if not texture is Texture2D:
			return _fail("tileset: cannot load %s as a texture; run `godot --headless --path <source>/godot --import` first" % src.image)
		var atlas := TileSetAtlasSource.new()
		atlas.texture = texture
		atlas.texture_region_size = _vec2i(src.get("tile_size"), tile_set.tile_size)
		atlas.margins = _vec2i(src.get("margin"), Vector2i.ZERO)
		atlas.separation = _vec2i(src.get("separation"), Vector2i.ZERO)
		# Godot's default: a 1 px transparent border per tile so filtered tiles don't bleed.
		atlas.use_texture_padding = bool(src.get("texture_padding", true))
		tile_set.add_source(atlas, source_index)
		var tiles: Dictionary = src.get("tiles", {})
		var image := _load_image(src.image)
		if src.get("all_opaque_tiles", false) and image != null:
			for coords in _opaque_cells(image, atlas):
				var key := "%d,%d" % [coords.x, coords.y]
				if not tiles.has(key): tiles[key] = {}
		for key in tiles:
			var coords := _pair(key, Vector2i(-1, -1))
			var def: Dictionary = tiles[key]
			var grid := atlas.get_atlas_grid_size()
			if coords.x < 0 or coords.y < 0 or coords.x >= grid.x or coords.y >= grid.y:
				problems.append("tile %s is outside the %dx%d grid" % [key, grid.x, grid.y])
				continue
			atlas.create_tile(coords, _vec2i(def.get("size"), Vector2i.ONE))
			created += 1
			var data := atlas.get_tile_data(coords, 0)
			_apply_tile(tile_set, atlas, coords, data, def, terrain_ref, set_mode, problems)
	for fb in fallbacks:
		created += _fill_missing_shapes(tile_set, fb, terrain_ref, set_mode, problems)
	var out: String = spec.get("output", "")
	if out == "": return _fail("tileset: spec needs \"output\" (res://…tres)")
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(out.get_base_dir()))
	var err := ResourceSaver.save(tile_set, out)
	if err != OK: return _fail("tileset: cannot save %s (%s)" % [out, error_string(err)])
	var summary := _terrain_coverage(tile_set)
	print("TILES_TILESET=", JSON.stringify({"output": out, "tiles": created, "problems": problems, "terrain_shapes": summary}))
	for p in problems: printerr("tiles.gd: ", p)
	return problems.is_empty()

## Packs rarely draw every edge (bottoms, inner walls). For each neighbour shape of the terrain that
## no tile covers, add an alternative of the fallback (plain fill) tile with that shape, so Godot
## picks the fill there instead of a wrong edge piece.
func _fill_missing_shapes(tile_set: TileSet, fb: Dictionary, terrain_ref: Dictionary, set_mode: Dictionary, problems: Array) -> int:
	var atlas := tile_set.get_source(fb.source) as TileSetAtlasSource
	var coords := _pair(fb.tile, Vector2i(-1, -1))
	if atlas == null or not atlas.has_tile(coords):
		problems.append("fallback_tile %s of %s is not a declared tile" % [fb.tile, fb.terrain])
		return 0
	var ref: Vector2i = terrain_ref[fb.terrain]
	var bits: Array = SHAPE_BITS[fb.mode]
	var covered := {}
	for i in tile_set.get_source_count():
		var src := tile_set.get_source(tile_set.get_source_id(i)) as TileSetAtlasSource
		if src == null: continue
		for t in src.get_tiles_count():
			var c := src.get_tile_id(t)
			for a in src.get_alternative_tiles_count(c):
				var d := src.get_tile_data(c, src.get_alternative_tile_id(c, a))
				if d.terrain_set != ref.x or d.terrain != ref.y: continue
				var shape := ""
				for b in bits: shape += "#" if d.get_terrain_peering_bit(b) == ref.y else "."
				covered[shape] = true
	var all: Array = _blob_shapes() if fb.mode == "corners_and_sides" else []
	if all.is_empty():
		for mask in 16:
			var shape := ""
			for k in 4: shape += "#" if mask & (1 << k) else "."
			all.append(shape)
	var base := atlas.get_tile_data(coords, 0)
	var added := 0
	for shape in all:
		if covered.has(shape): continue
		var alt := atlas.create_alternative_tile(coords)
		var data := atlas.get_tile_data(coords, alt)
		data.terrain_set = ref.x
		data.terrain = ref.y
		for k in bits.size(): data.set_terrain_peering_bit(bits[k], ref.y if shape[k] == "#" else -1)
		# Alternatives inherit nothing from the base tile; copy what the game relies on.
		for layer in tile_set.get_physics_layers_count():
			for poly in base.get_collision_polygons_count(layer):
				data.add_collision_polygon(layer)
				data.set_collision_polygon_points(layer, poly, base.get_collision_polygon_points(layer, poly))
				data.set_collision_polygon_one_way(layer, poly, base.is_collision_polygon_one_way(layer, poly))
		for layer in tile_set.get_custom_data_layers_count():
			data.set_custom_data_by_layer_id(layer, base.get_custom_data_by_layer_id(layer))
		data.probability = base.probability
		added += 1
	return added

func _opaque_cells(image: Image, atlas: TileSetAtlasSource) -> Array:
	var cells := []
	var grid := atlas.get_atlas_grid_size()
	for y in grid.y:
		for x in grid.x:
			var rect := Rect2i(atlas.margins + Vector2i(x, y) * (atlas.texture_region_size + atlas.separation), atlas.texture_region_size)
			if _opacity(image, rect) > 0.0: cells.append(Vector2i(x, y))
	return cells

func _apply_tile(tile_set: TileSet, atlas: TileSetAtlasSource, coords: Vector2i, data: TileData, def: Dictionary, terrain_ref: Dictionary, set_mode: Dictionary, problems: Array) -> void:
	var half := Vector2(atlas.texture_region_size) * Vector2(_vec2i(def.get("size"), Vector2i.ONE)) / 2.0
	var collision = def.get("collision", "")
	var polygon := PackedVector2Array()
	match collision:
		"solid", "one_way": polygon = PackedVector2Array([-half, Vector2(half.x, -half.y), half, Vector2(-half.x, half.y)])
		"slope_up": polygon = PackedVector2Array([Vector2(-half.x, half.y), Vector2(half.x, -half.y), half])
		"slope_down": polygon = PackedVector2Array([-half, half, Vector2(-half.x, half.y)])
		"top_half": polygon = PackedVector2Array([-half, Vector2(half.x, -half.y), Vector2(half.x, 0), Vector2(-half.x, 0)])
		"bottom_half": polygon = PackedVector2Array([Vector2(-half.x, 0), Vector2(half.x, 0), half, Vector2(-half.x, half.y)])
		"", "none": pass
		_:
			if collision is Array:
				for point in collision: polygon.append(Vector2(point[0], point[1]) - half)
			else:
				problems.append("tile %s: unknown collision %s" % [coords, collision])
	if not polygon.is_empty():
		data.add_collision_polygon(0)
		data.set_collision_polygon_points(0, 0, polygon)
		if collision == "one_way": data.set_collision_polygon_one_way(0, 0, true)
	for name in def.get("custom", {}):
		if tile_set.has_custom_data_layer_by_name(name): data.set_custom_data(name, def.custom[name])
		else: problems.append("tile %s: custom data %s is not declared" % [coords, name])
	if def.has("probability"): data.probability = float(def.probability)
	if def.has("z_index"): data.z_index = int(def.z_index)
	if def.has("y_sort_origin"): data.y_sort_origin = int(def.y_sort_origin)
	if def.has("terrain"):
		if not terrain_ref.has(def.terrain):
			problems.append("tile %s: unknown terrain %s" % [coords, def.terrain])
			return
		var ref: Vector2i = terrain_ref[def.terrain]
		data.terrain_set = ref.x
		data.terrain = ref.y
		var mode: String = set_mode[ref.x]
		var shape: String = def.get("shape", "")
		var bits: Array = SHAPE_BITS[mode]
		if shape.length() != bits.size():
			problems.append("tile %s: %s shape needs %d characters (got \"%s\")" % [coords, mode, bits.size(), shape])
			return
		for i in bits.size():
			var ch := shape[i]
			var value := -1
			if ch == "#": value = ref.y
			elif ch != ".":
				if not terrain_ref.has(ch) or terrain_ref[ch].x != ref.x:
					problems.append("tile %s: shape letter %s is not a terrain of set %d" % [coords, ch, ref.x])
					continue
				value = terrain_ref[ch].y
			data.set_terrain_peering_bit(bits[i], value)
	var anim: Dictionary = def.get("animation", {})
	if anim.has("frames"):
		atlas.set_tile_animation_columns(coords, int(anim.get("columns", 0)))
		atlas.set_tile_animation_separation(coords, _vec2i(anim.get("separation"), Vector2i.ZERO))
		atlas.set_tile_animation_frames_count(coords, int(anim.frames))
		atlas.set_tile_animation_speed(coords, float(anim.get("speed", 1.0)))
		for f in int(anim.frames): atlas.set_tile_animation_frame_duration(coords, f, float(anim.get("duration", 0.2)))

## How many distinct neighbour shapes each terrain has tiles for; a corners set needs 16 (15 with
## an empty tile) and corners_and_sides 47 to connect everywhere.
func _terrain_coverage(tile_set: TileSet) -> Dictionary:
	var shapes := {}
	for i in tile_set.get_source_count():
		var atlas := tile_set.get_source(tile_set.get_source_id(i)) as TileSetAtlasSource
		if atlas == null: continue
		for t in atlas.get_tiles_count():
			var coords := atlas.get_tile_id(t)
			for a in atlas.get_alternative_tiles_count(coords):
				var data := atlas.get_tile_data(coords, atlas.get_alternative_tile_id(coords, a))
				if data.terrain_set < 0 or data.terrain < 0: continue
				var key := "%s/%s" % [data.terrain_set, tile_set.get_terrain_name(data.terrain_set, data.terrain)]
				var bits := []
				for b in 16:
					if data.is_valid_terrain_peering_bit(b): bits.append(data.get_terrain_peering_bit(b))
				if not shapes.has(key): shapes[key] = {}
				shapes[key][str(bits)] = true
	var result := {}
	for key in shapes: result[key] = shapes[key].size()
	return result

# ---------------------------------------------------------------------------------------------
# paint: character grids → TileMapLayer cells (terrain connect), picture and report

func _paint(args: Array) -> bool:
	if args.is_empty(): return _fail("paint needs a map spec path")
	var spec_path: String = args[0]
	var spec := _read_json(spec_path)
	if spec.is_empty(): return _fail("paint: no spec")
	var tile_set = load(spec.get("tileset", "")) if spec.has("tileset") else null
	if spec.has("tileset") and not tile_set is TileSet: return _fail("paint: cannot load tileset %s" % spec.get("tileset", ""))
	var scene_path: String = spec.get("scene", "")
	var root: Node
	if ResourceLoader.exists(scene_path):
		root = (load(scene_path) as PackedScene).instantiate()
	else:
		root = Node2D.new()
		root.name = scene_path.get_file().get_basename().to_pascal_case()
	get_root().add_child(root)
	var terrain_ref := {}
	if tile_set != null:
		for s in tile_set.get_terrain_sets_count():
			for t in tile_set.get_terrains_count(s):
				terrain_ref[tile_set.get_terrain_name(s, t)] = Vector2i(s, t)
	var report := {"layers": {}, "unmatched": []}
	var origin := _vec2i(spec.get("origin"), Vector2i.ZERO)
	var layers: Array = spec.get("layers", [])
	var painted := []
	for layer_def in layers:
		var node_name: String = layer_def.get("node", "Ground")
		if layer_def.has("mesh_library"):
			report.layers[node_name] = _paint_gridmap(root, node_name, layer_def, origin, report)
			continue
		var layer := root.get_node_or_null(node_name) as TileMapLayer
		if layer == null:
			layer = TileMapLayer.new()
			layer.name = node_name
			root.add_child(layer)
			layer.owner = root
		layer.tile_set = tile_set
		if layer_def.has("z_index"): layer.z_index = int(layer_def.z_index)
		if layer_def.has("y_sort"): layer.y_sort_enabled = bool(layer_def.y_sort)
		if layer_def.has("collision"): layer.collision_enabled = bool(layer_def.collision)
		layer.clear()
		var legend: Dictionary = layer_def.get("legend", {})
		var grid: Array = layer_def.get("grid", [])
		var by_terrain := {}
		var counts := {}
		for y in grid.size():
			var row: String = grid[y]
			for x in row.length():
				var ch := row[x]
				if ch == "." or ch == " ": continue
				if not legend.has(ch):
					report.unmatched.append({"layer": node_name, "cell": [x, y], "problem": "no legend for '%s'" % ch})
					continue
				var cell := origin + Vector2i(x, y)
				var entry: Dictionary = legend[ch]
				counts[ch] = counts.get(ch, 0) + 1
				if entry.has("terrain"):
					if not terrain_ref.has(entry.terrain):
						report.unmatched.append({"layer": node_name, "cell": [x, y], "problem": "unknown terrain %s" % entry.terrain})
						continue
					if not by_terrain.has(entry.terrain): by_terrain[entry.terrain] = []
					by_terrain[entry.terrain].append(cell)
				elif entry.has("tile"):
					var coords := _pair(str(entry.tile), Vector2i.ZERO)
					layer.set_cell(cell, int(entry.get("source", 0)), coords, int(entry.get("alternative", 0)))
		# One call per terrain, so tiles inside the same terrain connect to each other.
		for name in by_terrain:
			var ref: Vector2i = terrain_ref[name]
			layer.set_cells_terrain_connect(by_terrain[name], ref.x, ref.y, bool(layer_def.get("ignore_empty_terrains", true)))
		report.layers[node_name] = counts
		painted.append(layer)
	await process_frame
	for layer in painted:
		report.unmatched.append_array(_mismatches(layer))
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(scene_path.get_base_dir()))
	var packed := PackedScene.new()
	var err := packed.pack(root)
	if err == OK: err = ResourceSaver.save(packed, scene_path)
	if err != OK: return _fail("paint: cannot save %s (%s)" % [scene_path, error_string(err)])
	var picture := _picture(painted, tile_set) if tile_set != null else null
	var png := ""
	if picture != null:
		png = spec_path.get_basename() + ".png"
		picture.save_png(png)
	root.queue_free()
	_write(spec_path.get_basename() + ".report.json", JSON.stringify(report, "  "))
	print("TILES_PAINT=", JSON.stringify({"scene": scene_path, "picture": png, "unmatched": report.unmatched.size()}))
	return true

## 3D: the same character grid fills a GridMap floor. Legend entries name MeshLibrary items and an
## optional rotation around Y in degrees (0, 90, 180, 270).
func _paint_gridmap(root: Node, node_name: String, def: Dictionary, origin: Vector2i, report: Dictionary) -> Dictionary:
	var library = load(def.mesh_library)
	if not library is MeshLibrary:
		report.unmatched.append({"layer": node_name, "problem": "cannot load mesh library %s" % def.mesh_library})
		return {}
	var grid_map := root.get_node_or_null(node_name) as GridMap
	if grid_map == null:
		grid_map = GridMap.new()
		grid_map.name = node_name
		root.add_child(grid_map)
		grid_map.owner = root
	grid_map.mesh_library = library
	if def.has("cell_size"): grid_map.cell_size = Vector3(def.cell_size[0], def.cell_size[1], def.cell_size[2])
	var floor_y := int(def.get("floor", 0))
	if def.get("clear", true):
		for cell in grid_map.get_used_cells():
			if cell.y == floor_y: grid_map.set_cell_item(cell, GridMap.INVALID_CELL_ITEM)
	var counts := {}
	var legend: Dictionary = def.get("legend", {})
	var rows: Array = def.get("grid", [])
	for z in rows.size():
		var row: String = rows[z]
		for x in row.length():
			var ch := row[x]
			if ch == "." or ch == " ": continue
			var entry: Dictionary = legend.get(ch, {})
			var item: int = library.find_item_by_name(str(entry.get("item", "")))
			if item < 0:
				report.unmatched.append({"layer": node_name, "cell": [x, z], "problem": "no mesh library item for '%s'" % ch})
				continue
			var basis := Basis(Vector3.UP, deg_to_rad(float(entry.get("rotate", 0))))
			grid_map.set_cell_item(Vector3i(origin.x + x, floor_y, origin.y + z), item, grid_map.get_orthogonal_index_from_basis(basis))
			counts[ch] = counts.get(ch, 0) + 1
	return counts

## Visible seams: neighbouring tiles must agree on the edge or corner they share (an empty or
## non-terrain cell counts as empty). A disagreement means the tile set has no tile for that
## neighbourhood, or the shape is too thin for the terrain mode (corner sets need 2x2 blocks).
const OPPOSITE := {TileSet.CELL_NEIGHBOR_RIGHT_SIDE: TileSet.CELL_NEIGHBOR_LEFT_SIDE, TileSet.CELL_NEIGHBOR_LEFT_SIDE: TileSet.CELL_NEIGHBOR_RIGHT_SIDE, TileSet.CELL_NEIGHBOR_TOP_SIDE: TileSet.CELL_NEIGHBOR_BOTTOM_SIDE, TileSet.CELL_NEIGHBOR_BOTTOM_SIDE: TileSet.CELL_NEIGHBOR_TOP_SIDE}
## For each corner: [neighbour direction, that neighbour's corner at the same vertex] for the three
## cells sharing it.
const VERTEX := {
	TileSet.CELL_NEIGHBOR_TOP_LEFT_CORNER: [[TileSet.CELL_NEIGHBOR_LEFT_SIDE, TileSet.CELL_NEIGHBOR_TOP_RIGHT_CORNER], [TileSet.CELL_NEIGHBOR_TOP_SIDE, TileSet.CELL_NEIGHBOR_BOTTOM_LEFT_CORNER], [TileSet.CELL_NEIGHBOR_TOP_LEFT_CORNER, TileSet.CELL_NEIGHBOR_BOTTOM_RIGHT_CORNER]],
	TileSet.CELL_NEIGHBOR_TOP_RIGHT_CORNER: [[TileSet.CELL_NEIGHBOR_RIGHT_SIDE, TileSet.CELL_NEIGHBOR_TOP_LEFT_CORNER], [TileSet.CELL_NEIGHBOR_TOP_SIDE, TileSet.CELL_NEIGHBOR_BOTTOM_RIGHT_CORNER], [TileSet.CELL_NEIGHBOR_TOP_RIGHT_CORNER, TileSet.CELL_NEIGHBOR_BOTTOM_LEFT_CORNER]],
	TileSet.CELL_NEIGHBOR_BOTTOM_RIGHT_CORNER: [[TileSet.CELL_NEIGHBOR_RIGHT_SIDE, TileSet.CELL_NEIGHBOR_BOTTOM_LEFT_CORNER], [TileSet.CELL_NEIGHBOR_BOTTOM_SIDE, TileSet.CELL_NEIGHBOR_TOP_RIGHT_CORNER], [TileSet.CELL_NEIGHBOR_BOTTOM_RIGHT_CORNER, TileSet.CELL_NEIGHBOR_TOP_LEFT_CORNER]],
	TileSet.CELL_NEIGHBOR_BOTTOM_LEFT_CORNER: [[TileSet.CELL_NEIGHBOR_LEFT_SIDE, TileSet.CELL_NEIGHBOR_BOTTOM_RIGHT_CORNER], [TileSet.CELL_NEIGHBOR_BOTTOM_SIDE, TileSet.CELL_NEIGHBOR_TOP_LEFT_CORNER], [TileSet.CELL_NEIGHBOR_BOTTOM_LEFT_CORNER, TileSet.CELL_NEIGHBOR_TOP_RIGHT_CORNER]],
}

func _mismatches(layer: TileMapLayer) -> Array:
	var found := []
	for cell in layer.get_used_cells():
		var data := layer.get_cell_tile_data(cell)
		if data == null or data.terrain_set < 0: continue
		for b in 16:
			if not data.is_valid_terrain_peering_bit(b): continue
			var want := data.get_terrain_peering_bit(b)
			var pairs: Array = [[b, OPPOSITE[b]]] if OPPOSITE.has(b) else VERTEX[b]
			for pair in pairs:
				var have := _bit_at(layer, layer.get_neighbor_cell(cell, pair[0]), pair[1], data.terrain_set)
				if have != want:
					found.append({"layer": String(layer.name), "cell": [cell.x, cell.y], "problem": "seam: this tile's %s is %d, the neighbour's is %d" % [_bit_name(b), want, have]})
					break
			if not found.is_empty() and found[-1].cell == [cell.x, cell.y]: break
	return found

func _bit_at(layer: TileMapLayer, cell: Vector2i, bit: int, terrain_set: int) -> int:
	var data := layer.get_cell_tile_data(cell)
	if data == null or data.terrain_set != terrain_set: return -1
	if data.is_valid_terrain_peering_bit(bit): return data.get_terrain_peering_bit(bit)
	return data.terrain

func _bit_name(bit: int) -> String:
	return {0: "right side", 3: "bottom-right corner", 4: "bottom side", 7: "bottom-left corner", 8: "left side", 11: "top-left corner", 12: "top side", 15: "top-right corner"}.get(bit, str(bit))

## The painted layers drawn from their atlas regions (no GPU), 2x for small tiles.
func _picture(layers: Array, tile_set: TileSet) -> Image:
	var used := Rect2i()
	var first := true
	for layer in layers:
		var r: Rect2i = layer.get_used_rect()
		if r.size == Vector2i.ZERO: continue
		used = r if first else used.merge(r)
		first = false
	if first: return null
	var ts := tile_set.tile_size
	var scale := 2 if ts.x <= 24 else 1
	var cap := 4096
	if used.size.x * ts.x * scale > cap or used.size.y * ts.y * scale > cap: scale = 1
	var out := Image.create(mini(used.size.x * ts.x * scale, cap), mini(used.size.y * ts.y * scale, cap), false, Image.FORMAT_RGBA8)
	out.fill(Color(0.1, 0.11, 0.14))
	var images := {}
	for layer in layers:
		for cell in layer.get_used_cells():
			var source_id: int = layer.get_cell_source_id(cell)
			var atlas := tile_set.get_source(source_id) as TileSetAtlasSource
			if atlas == null: continue
			if not images.has(source_id): images[source_id] = _load_image(atlas.texture.resource_path)
			var image: Image = images[source_id]
			if image == null: continue
			var region := image.get_region(atlas.get_tile_texture_region(layer.get_cell_atlas_coords(cell)))
			if scale != 1: region.resize(region.get_width() * scale, region.get_height() * scale, Image.INTERPOLATE_NEAREST)
			out.blend_rect(region, Rect2i(Vector2i.ZERO, region.get_size()), (cell - used.position) * ts * scale)
	return out

# ---------------------------------------------------------------------------------------------
# meshlib: 3D kit → MeshLibrary for GridMap

func _meshlib(args: Array) -> bool:
	if args.size() < 2: return _fail("meshlib needs <res://kit.glb|res://dir> <res://out.tres>")
	var meshes := []
	var sources := []
	if args[0].ends_with("/") or DirAccess.dir_exists_absolute(ProjectSettings.globalize_path(args[0])):
		for file in DirAccess.get_files_at(args[0]):
			if file.get_extension() in ["glb", "gltf", "tscn", "scn"]: sources.append(args[0].path_join(file))
	else:
		sources.append(args[0])
	for path in sources:
		var scene = load(path)
		if not scene is PackedScene: return _fail("meshlib: cannot load %s; run --import first" % path)
		var root: Node = scene.instantiate()
		for node in root.find_children("*", "MeshInstance3D", true, false):
			var mi := node as MeshInstance3D
			if mi.mesh == null: continue
			var name: String = String(mi.name) if sources.size() == 1 else "%s/%s" % [path.get_file().get_basename(), mi.name]
			meshes.append({"name": name, "mesh": mi.mesh, "transform": _relative(mi, root)})
		root.free()
	if meshes.is_empty(): return _fail("meshlib: no meshes found")
	var library := MeshLibrary.new()
	var collision := _option(args, "--collision", "box")
	for i in meshes.size():
		var m: Dictionary = meshes[i]
		library.create_item(i)
		library.set_item_name(i, m.name)
		library.set_item_mesh(i, m.mesh)
		library.set_item_mesh_transform(i, m.transform)
		var shape: Shape3D
		match collision:
			"none": shape = null
			"convex": shape = m.mesh.create_convex_shape(true, true)
			"trimesh": shape = m.mesh.create_trimesh_shape()
			_:
				var box := BoxShape3D.new()
				var aabb: AABB = m.mesh.get_aabb()
				# Flat pieces (floors) still need some thickness to stand on; grow them downwards.
				var thin := Vector3(maxf(0.1 - aabb.size.x, 0.0), maxf(0.1 - aabb.size.y, 0.0), maxf(0.1 - aabb.size.z, 0.0))
				box.size = aabb.size + thin
				shape = box
				m.transform = m.transform * Transform3D(Basis.IDENTITY, aabb.get_center() - Vector3(0, thin.y / 2.0, 0))
		if shape != null: library.set_item_shapes(i, [shape, m.transform])
	var out: String = args[1]
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(out.get_base_dir()))
	var err := ResourceSaver.save(library, out)
	if err != OK: return _fail("meshlib: cannot save %s (%s)" % [out, error_string(err)])
	var listing := []
	for i in meshes.size():
		var aabb: AABB = meshes[i].mesh.get_aabb()
		listing.append({"id": i, "name": meshes[i].name, "size": [snappedf(aabb.size.x, 0.01), snappedf(aabb.size.y, 0.01), snappedf(aabb.size.z, 0.01)]})
	print("TILES_MESHLIB=", JSON.stringify({"output": out, "items": listing}))
	return true

func _relative(node: Node3D, root: Node) -> Transform3D:
	var t := node.transform
	var p := node.get_parent()
	while p != null and p != root:
		if p is Node3D: t = (p as Node3D).transform * t
		p = p.get_parent()
	return t

# ---------------------------------------------------------------------------------------------

const DIGITS := ["111101101101111", "010110010010111", "111001111100111", "111001111001111", "101101111001001", "111100111001111", "111100111101111", "111001001001001", "111101111101111", "111101111001111"]

func _number(image: Image, at: Vector2, value: int) -> void:
	var text := str(value)
	for c in text.length():
		var glyph: String = DIGITS[int(text[c])]
		for y in 5:
			for x in 3:
				if glyph[y * 3 + x] == "1":
					image.fill_rect(Rect2i(int(at.x) + c * 8 + x * 2, int(at.y) + y * 2, 2, 2), Color(1, 1, 1))

func _write(path: String, text: String) -> void:
	var file := FileAccess.open(ProjectSettings.globalize_path(path) if path.begins_with("res://") else path, FileAccess.WRITE)
	if file == null:
		push_error("tiles.gd: cannot write %s (%s)" % [path, error_string(FileAccess.get_open_error())])
		return
	file.store_string(text)
