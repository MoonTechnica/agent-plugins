extends SceneTree
## Tile tools for the game agent (game-level-design references/tilemaps.md). Build-time only:
## nothing here ships in the game. Run `godot --headless --path <source>/godot --import` first so
## the tile images and kits are imported resources.
##
##   godot --headless --path <source>/godot -s <tool> -- atlas <res://dir> --out <res://sheet.png> [--columns N]
##   godot --headless --path <source>/godot -s <tool> -- sheet <res://image.png> [--tile WxH] [--margin X,Y] [--separation X,Y]
##   godot --headless --path <source>/godot -s <tool> -- greybox <res://dir> --tile N --terrains a,b,c
##   godot --headless --path <source>/godot -s <tool> -- compose <source>/design/tiles/<name>.compose.json
##   godot --headless --path <source>/godot -s <tool> -- tileset <source>/design/tiles/<name>.json
##   godot --headless --path <source>/godot -s <tool> -- paint <source>/design/tilemaps/<room>.json
##   godot --headless --path <source>/godot -s <tool> -- meshlib <res://kit.glb|res://dir> <res://out.tres> [--collision box|convex|trimesh|none]
##
## atlas: packs single tile images (one PNG per tile, as CC0 packs like Kenney ship them) into one
##   sheet in file-name order and writes `<sheet>.atlas.json` (file → atlas coords).
## sheet: reads a tile sheet, guesses the grid when --tile is missing, and writes `<image>.sheet.png`
##   (enlarged, gridded, row/column numbers) plus `<image>.sheet.json` (per-tile edge opacity and a
##   suggested terrain shape) next to the image, so the agent can look at the sheet before mapping it.
## compose: draws all 47 "corners and sides" tiles of each terrain from a fill texture (made
##   seamless on request) and edge strips (a grass cap, a rim), so art in the concept's style
##   becomes an autotiling tile set. Writes the sheet and its tileset spec.
## greybox: compose with flat colours, so a greybox map autotiles before any art exists.
## tileset: builds a TileSet resource from a JSON spec (atlas grid, padding, collision, one-way,
##   custom data, terrain sets with peering bits, probability, animation).
## paint: paints TileMapLayer / GridMap nodes of a scene from character grids (2D terrain connect,
##   3D pieces chosen and turned by their neighbours), saves the scene, writes a picture of the
##   result (from the data, no GPU; problems marked red) and a report of what did not fit.
## meshlib: turns each piece of a 3D kit into one MeshLibrary item (with a collision shape) for
##   GridMap and writes a contact sheet of the pieces seen from above and from the front.

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
	var commands := ["atlas", "sheet", "greybox", "compose", "tileset", "paint", "meshlib"]
	if args.is_empty() or not args[0] in commands:
		_fail("usage: tiles.gd -- %s ..." % "|".join(commands))
		return
	var ok := false
	match args[0]:
		"atlas": ok = _atlas(args.slice(1))
		"sheet": ok = _sheet(args.slice(1))
		"greybox": ok = _greybox(args.slice(1))
		"compose": ok = _compose(args.slice(1))
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
		if guess.is_empty() and tile != Vector2i.ZERO:
			# The size is given and no gutter fits it: a sheet without gutters.
			separation = Vector2i.ZERO
		elif guess.is_empty():
			return _fail("sheet: could not guess the grid; pass --tile WxH (and --separation X,Y if the tiles have gutters)")
		else:
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
# compose / greybox: textures and edge strips → the 47 tiles of each terrain

const GREYBOX_COLORS := [Color(0.55, 0.55, 0.6), Color(0.4, 0.62, 0.36), Color(0.3, 0.5, 0.8), Color(0.72, 0.6, 0.38), Color(0.62, 0.38, 0.38), Color(0.5, 0.42, 0.66)]
const SIDE_NAMES := ["top", "right", "bottom", "left"]

func _greybox(args: Array) -> bool:
	if args.is_empty(): return _fail("greybox needs an output res:// directory")
	var dir: String = args[0]
	var size := int(_option(args, "--tile", "16"))
	var names := _option(args, "--terrains", "ground").split(",", false)
	if size < 6 or names.is_empty(): return _fail("greybox needs --tile >= 6 and --terrains a,b")
	var terrains := []
	for t in names.size():
		var base: Color = GREYBOX_COLORS[t % GREYBOX_COLORS.size()]
		# A darker rim where the terrain meets empty space keeps the shape readable.
		terrains.append({"name": names[t], "fill": "#" + base.to_html(false), "edge": {"color": "#" + base.darkened(0.35).to_html(false), "width": maxi(1, size / 16)}})
	return _compose_tiles({"output": dir.path_join("greybox_tiles"), "tile": size, "pixel_art": true, "terrains": terrains}, "TILES_GREYBOX")

func _compose(args: Array) -> bool:
	if args.is_empty(): return _fail("compose needs a spec path")
	var spec := _read_json(args[0])
	if spec.is_empty(): return _fail("compose: no spec")
	return _compose_tiles(spec, "TILES_COMPOSE")

func _compose_tiles(spec: Dictionary, tag: String) -> bool:
	var size := int(spec.get("tile", 16))
	var out: String = spec.get("output", "")
	var defs: Array = spec.get("terrains", [])
	if out == "" or size < 6 or defs.is_empty(): return _fail("compose needs \"output\" (res://dir/name), \"tile\" >= 6 and \"terrains\"")
	var pixel := bool(spec.get("pixel_art", size <= 32))
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(out.get_base_dir()))
	var shapes := _blob_shapes()
	var columns := 8
	var rows_per := ceili(float(shapes.size()) / columns)
	var image := Image.create(size * columns, size * rows_per * defs.size(), false, Image.FORMAT_RGBA8)
	var tiles := {}
	var terrains := []
	var names := []
	for t in defs.size():
		var def: Dictionary = defs[t]
		var name := str(def.get("name", "terrain%d" % t))
		var fill := _fill_image(def.get("fill", "#888888"), size, pixel, bool(def.get("seamless", false)))
		if fill == null: return _fail("compose: cannot read the fill of %s" % name)
		var strips := []
		for s in 4:
			var strip = _edge_strip(def.get(SIDE_NAMES[s], def.get("edge")), size, pixel)
			if strip is String: return _fail("compose: %s %s: %s" % [name, SIDE_NAMES[s], strip])
			strips.append(strip)
		names.append(name)
		terrains.append({"name": name, "color": "#" + _average(fill, Rect2i(Vector2i.ZERO, fill.get_size())).to_html(false)})
		for i in shapes.size():
			var at := Vector2i(i % columns, t * rows_per + i / columns)
			_draw_shape(image, at * size, size, shapes[i], fill, strips, int(def.get("round", 0)))
			tiles["%d,%d" % [at.x, at.y]] = {"terrain": name, "shape": shapes[i], "collision": def.get("collision", "solid")}
	var png := out + ".png"
	image.save_png(ProjectSettings.globalize_path(png))
	var tileset_spec := {
		"version": 1,
		"image": png,
		"tile_size": [size, size],
		"output": out + ".tres",
		"physics_layers": [{"collision_layer": 1, "collision_mask": 1}],
		"terrain_sets": [{"mode": "corners_and_sides", "terrains": terrains}],
		"tiles": tiles,
	}
	_write(out + ".json", JSON.stringify(tileset_spec, "  "))
	print(tag, "=", JSON.stringify({"image": png, "spec": out + ".json", "terrains": names, "tiles_per_terrain": shapes.size()}))
	return true

## A colour, or an image scaled to one tile. A tile is reused everywhere, so the texture must
## wrap; `seamless` blends its borders so the repeats do not show.
func _fill_image(value, size: int, pixel: bool, seamless: bool) -> Image:
	var text := str(value)
	if text.begins_with("#"):
		var flat := Image.create(size, size, false, Image.FORMAT_RGBA8)
		flat.fill(Color.from_string(text, Color.GRAY))
		return flat
	var image := _load_image(text)
	if image == null: return null
	if seamless: image = _seamless(image)
	image.resize(size, size, Image.INTERPOLATE_NEAREST if pixel else Image.INTERPOLATE_LANCZOS)
	return image

## The edge strip of one side, `size` long and `width` deep; row 0 touches the empty side.
## Returns null for no edge and a String for an error.
func _edge_strip(def, size: int, pixel: bool):
	if not def is Dictionary: return null
	var width := clampi(int(def.get("width", maxi(1, size / 8))), 1, size / 2)
	var strip: Image
	if def.has("image"):
		strip = _load_image(str(def.image))
		if strip == null: return "cannot read %s" % def.image
		strip.resize(size, width, Image.INTERPOLATE_NEAREST if pixel else Image.INTERPOLATE_LANCZOS)
	else:
		strip = Image.create(size, width, false, Image.FORMAT_RGBA8)
		strip.fill(Color.from_string(str(def.get("color", "#000000")), Color.BLACK))
	return strip

## Each pixel takes the fill, then the strip of the nearest empty side (or inner corner) within
## that strip's depth. Outer corners can be rounded off.
func _draw_shape(image: Image, origin: Vector2i, size: int, shape: String, fill: Image, strips: Array, round: int) -> void:
	for y in size:
		for x in size:
			if round > 0 and _rounded_off(shape, size, x, y, round): continue
			var colour := fill.get_pixel(x, y)
			var near := _nearest_edge(shape, size, x, y, strips)
			if near.x >= 0:
				var strip: Image = strips[near.x]
				colour = colour.blend(strip.get_pixel(x if near.x % 2 == 0 else y, near.y))
			image.set_pixelv(origin + Vector2i(x, y), colour)

## [side, depth] of the closest exposed edge that has a strip, or [-1, -1].
func _nearest_edge(shape: String, size: int, x: int, y: int, strips: Array) -> Vector2i:
	var far := [y, size - 1 - x, size - 1 - y, x]  # distance to the top, right, bottom, left border
	var best := Vector2i(-1, -1)
	for s in 4:
		if shape[s * 2 + 1] == "." and strips[s] != null and far[s] < strips[s].get_height() and (best.x < 0 or far[s] < best.y): best = Vector2i(s, far[s])
	# Inner corners: both sides connect but the diagonal cell is empty.
	for k in [0, 2, 4, 6]:
		if shape[k] != "." or shape[k + 1] != "#" or shape[(k + 7) % 8] != "#": continue
		var vertical: int = 0 if k < 4 else 2  # the top or bottom side this corner touches
		var horizontal: int = 3 if k == 0 or k == 6 else 1
		var dy: int = far[vertical]
		var dx: int = far[horizontal]
		var s: int = vertical if dy >= dx else horizontal
		var d := maxi(dx, dy)
		if strips[s] != null and d < strips[s].get_height() and (best.x < 0 or d < best.y): best = Vector2i(s, d)
	return best

func _rounded_off(shape: String, size: int, x: int, y: int, r: int) -> bool:
	var cx := x if x < r else (size - 1 - x if x >= size - r else -1)
	var cy := y if y < r else (size - 1 - y if y >= size - r else -1)
	if cx < 0 or cy < 0: return false
	var side_x := 7 if x < r else 3
	var side_y := 1 if y < r else 5
	if shape[side_x] != "." or shape[side_y] != ".": return false
	return Vector2(r - cx - 0.5, r - cy - 0.5).length() > r

## Tileable in both directions: each axis is blended with its half-offset copy near the borders,
## where the copy is continuous across the wrap; its own seam sits in the middle at zero weight.
func _seamless(image: Image) -> Image:
	var result := image
	for axis in 2:
		var w := result.get_width()
		var h := result.get_height()
		var out := result.duplicate() as Image
		var length := w if axis == 0 else h
		for y in h:
			for x in w:
				var p := x if axis == 0 else y
				var weight := clampf((absf(float(p) / maxf(length - 1, 1) * 2.0 - 1.0) - 0.5) * 2.0, 0.0, 1.0)
				if weight == 0.0: continue
				var other := result.get_pixel((x + w / 2) % w, y) if axis == 0 else result.get_pixel(x, (y + h / 2) % h)
				out.set_pixel(x, y, result.get_pixel(x, y).lerp(other, weight))
		result = out
	return result

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
		var three_d: bool = spec.get("layers", []).any(func(l) -> bool: return l is Dictionary and l.has("mesh_library"))
		root = Node3D.new() if three_d else Node2D.new()
		root.name = scene_path.get_file().get_basename().to_pascal_case()
	get_root().add_child(root)
	var terrain_ref := {}
	if tile_set != null:
		for s in tile_set.get_terrain_sets_count():
			for t in tile_set.get_terrains_count(s):
				terrain_ref[tile_set.get_terrain_name(s, t)] = Vector2i(s, t)
	var report := {"layers": {}, "unmatched": [], "cleared": {}, "rests_on": {}}
	var origin := _vec2i(spec.get("origin"), Vector2i.ZERO)
	var layers: Array = spec.get("layers", [])
	var painted := []
	var grid_maps := []
	for layer_def in layers:
		var node_name: String = layer_def.get("node", "Ground")
		if layer_def.has("mesh_library"):
			var grid_map := _paint_gridmap(root, node_name, layer_def, origin, report)
			if grid_map != null and not grid_map in grid_maps: grid_maps.append(grid_map)
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
					report.unmatched.append({"layer": node_name, "cell": [origin.x + x, origin.y + y], "problem": "no legend for '%s'" % ch})
					continue
				var cell := origin + Vector2i(x, y)
				var entry: Dictionary = legend[ch]
				counts[ch] = counts.get(ch, 0) + 1
				if entry.has("terrain"):
					if not terrain_ref.has(entry.terrain):
						report.unmatched.append({"layer": node_name, "cell": [origin.x + x, origin.y + y], "problem": "unknown terrain %s" % entry.terrain})
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
	report.unmatched.append_array(_tile_overlaps(painted))
	report.unmatched = _without_covered_holes(report.unmatched, grid_maps)
	if not grid_maps.is_empty(): report.unmatched.append_array(_grounding(grid_maps, report.rests_on))
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(scene_path.get_base_dir()))
	var packed := PackedScene.new()
	var err := packed.pack(root)
	if err == OK: err = ResourceSaver.save(packed, scene_path)
	if err != OK: return _fail("paint: cannot save %s (%s)" % [scene_path, error_string(err)])
	var picture: Image = null
	if tile_set != null and not painted.is_empty(): picture = _picture(painted, tile_set, report.unmatched)
	elif not grid_maps.is_empty(): picture = _top_view(grid_maps, report.unmatched)
	var png := ""
	if picture != null:
		png = spec_path.get_basename() + ".png"
		picture.save_png(png)
	var angle := ""
	if not grid_maps.is_empty():
		var side := _top_view(grid_maps, report.unmatched, _angle_view())
		if side != null:
			angle = spec_path.get_basename() + ".angle.png"
			side.save_png(angle)
	root.queue_free()
	report.erase("cleared")
	report.erase("rests_on")
	_write(spec_path.get_basename() + ".report.json", JSON.stringify(report, "  "))
	print("TILES_PAINT=", JSON.stringify({"scene": scene_path, "picture": png, "angle": angle, "unmatched": report.unmatched.size()}))
	return true

## 3D: the same character grid fills a GridMap floor. A legend entry names one MeshLibrary item
## (with an optional turn around Y in degrees), or lists `pieces` with the sides they connect on,
## and each cell gets the piece and the turn that fit its neighbours (walls, fences, roads, rims).
func _paint_gridmap(root: Node, node_name: String, def: Dictionary, origin: Vector2i, report: Dictionary) -> GridMap:
	var library = load(def.mesh_library)
	if not library is MeshLibrary:
		report.unmatched.append({"layer": node_name, "problem": "cannot load mesh library %s" % def.mesh_library})
		return null
	var grid_map := root.get_node_or_null(node_name) as GridMap
	if grid_map == null:
		grid_map = GridMap.new()
		grid_map.name = node_name
		root.add_child(grid_map)
		grid_map.owner = root
	grid_map.mesh_library = library
	if def.has("cell_size"): grid_map.cell_size = Vector3(def.cell_size[0], def.cell_size[1], def.cell_size[2])
	# Kit pieces have their origin on the floor (Kenney, KayKit), so floor N stands at
	# y = N * cell height, not half a cell above it (GridMap's default centres cells on Y).
	grid_map.cell_center_y = bool(def.get("center_y", false))
	var floor_y := int(def.get("floor", 0))
	# The grids are the source of truth: the first layer of a run that paints this node empties it,
	# so cells left over from an earlier floor or shape do not survive; later layers (other
	# floors of the same node) add to it.
	if def.get("clear", true) and not report.cleared.has(node_name):
		grid_map.clear()
	report.cleared[node_name] = true
	report.rests_on[node_name] = str(def.get("rests_on", "pieces"))
	var counts := {}
	var legend: Dictionary = def.get("legend", {})
	var rows: Array = def.get("grid", [])
	var outside := _outside_cells(rows)
	for z in rows.size():
		var row: String = rows[z]
		for x in row.length():
			var ch := row[x]
			if ch == "." or ch == " ": continue
			if not legend.has(ch):
				report.unmatched.append({"layer": node_name, "cell": [origin.x + x, origin.y + z], "problem": "no legend for '%s'" % ch})
				continue
			var choice := _choose_piece(legend[ch], rows, x, z, ch, outside)
			if choice.has("problem"): report.unmatched.append({"layer": node_name, "cell": [origin.x + x, origin.y + z], "problem": choice.problem})
			if choice.item == "": continue
			var item: int = library.find_item_by_name(choice.item)
			if item < 0:
				report.unmatched.append({"layer": node_name, "cell": [origin.x + x, origin.y + z], "problem": "no mesh library item '%s'" % choice.item})
				continue
			var basis := Basis(Vector3.UP, deg_to_rad(choice.rotate))
			grid_map.set_cell_item(Vector3i(origin.x + x, floor_y, origin.y + z), item, grid_map.get_orthogonal_index_from_basis(basis))
			counts[ch] = counts.get(ch, 0) + 1
	if def.get("walkable", false): report.unmatched.append_array(_holes(rows, node_name, origin))
	report.layers[node_name] = counts
	return grid_map

## Neighbour order of masks (as in 2D shapes): NW, N, NE, E, SE, S, SW, W.
const AROUND := [Vector2i(-1, -1), Vector2i(0, -1), Vector2i(1, -1), Vector2i(1, 0), Vector2i(1, 1), Vector2i(0, 1), Vector2i(-1, 1), Vector2i(-1, 0)]

## Picks {item, rotate} for one cell. A piece's `sides` says where it connects when not turned:
## 4 characters N E S W, or 8 characters NW N NE E SE S SW W ("#" connects, "." does not, "?"
## either). Turning by +90 degrees around Y carries east to north, i.e. mask index i to i - 2.
## A piece with a `front` (N/E/S/W: its inner, decorated face) is turned so that face looks into
## the enclosed area rather than outside; otherwise the smallest fitting turn wins. Several
## fitting pieces (variants) are picked by cell position, so the result is repeatable.
func _choose_piece(entry: Dictionary, rows: Array, x: int, z: int, ch: String, outside: Dictionary) -> Dictionary:
	if not entry.has("pieces"): return {"item": str(entry.get("item", "")), "rotate": float(entry.get("rotate", 0))}
	var mask := _neighbour_mask(rows, x, z, str(entry.get("joins", "")) + ch)
	var fits := []
	var best := -2
	var pieces: Array = entry.pieces
	for p in pieces.size():
		var piece: Dictionary = pieces[p]
		var sides := str(piece.get("sides", ""))
		if sides.length() == 4: sides = "?%s?%s?%s?%s" % [sides[0], sides[1], sides[2], sides[3]]
		if sides.length() != 8: continue
		for k in 4:
			if not _turned_fits(sides, k, mask): continue
			var score := _front_score(str(piece.get("front", "")), k, rows, x, z, outside)
			best = maxi(best, score)
			fits.append({"item": str(piece.item), "rotate": float(piece.get("rotate", 0)) + k * 90.0, "score": score, "piece": p})
	if fits.is_empty(): return {"item": str(entry.get("fallback", "")), "rotate": 0.0, "problem": "no piece connects like %s (NW N NE E SE S SW W)" % mask}
	var first_per_piece := {}
	for fit in fits:
		if fit.score == best and not first_per_piece.has(fit.piece): first_per_piece[fit.piece] = fit
	var options := first_per_piece.values()
	return options[absi(x * 73856093 ^ z * 19349663) % options.size()]

## +1 when the turned front faces an enclosed empty cell, -1 when it faces the outside, else 0.
func _front_score(front: String, k: int, rows: Array, x: int, z: int, outside: Dictionary) -> int:
	var local := {"N": 1, "E": 3, "S": 5, "W": 7}.get(front, -1) as int
	if local < 0: return 0
	var at: Vector2i = Vector2i(x, z) + AROUND[posmod(local - 2 * k, 8)]
	if outside.has(at): return -1
	if at.y >= 0 and at.y < rows.size() and at.x >= 0 and at.x < (rows[at.y] as String).length() and (rows[at.y] as String)[at.x] in [".", " "]: return 1
	return 0

## Empty cells reachable from beyond the grid without crossing a piece: the outside of rooms.
func _outside_cells(rows: Array) -> Dictionary:
	var width := 0
	for row in rows: width = maxi(width, (row as String).length())
	var outside := {}
	var queue := []
	for x in range(-1, width + 1):
		queue.append(Vector2i(x, -1))
		queue.append(Vector2i(x, rows.size()))
	for z in rows.size():
		queue.append(Vector2i(-1, z))
		queue.append(Vector2i(width, z))
	while not queue.is_empty():
		var at: Vector2i = queue.pop_back()
		if outside.has(at) or at.x < -1 or at.y < -1 or at.x > width or at.y > rows.size(): continue
		var inside_grid := at.y >= 0 and at.y < rows.size() and at.x >= 0 and at.x < (rows[at.y] as String).length()
		if inside_grid and not (rows[at.y] as String)[at.x] in [".", " "]: continue
		outside[at] = true
		for d in [Vector2i(0, -1), Vector2i(1, 0), Vector2i(0, 1), Vector2i(-1, 0)]: queue.append(at + d)
	return outside

func _turned_fits(sides: String, k: int, mask: String) -> bool:
	for i in 8:
		var want := sides[i]
		if want != "?" and want != mask[posmod(i - 2 * k, 8)]: return false
	return true

## Which neighbours join this cell; a corner counts only when both sides next to it join.
func _neighbour_mask(rows: Array, x: int, z: int, joins: String) -> String:
	var on := []
	for d in AROUND:
		var at: Vector2i = Vector2i(x, z) + d
		var joined := false
		if at.y >= 0 and at.y < rows.size() and at.x >= 0 and at.x < (rows[at.y] as String).length():
			joined = joins.contains((rows[at.y] as String)[at.x])
		on.append(joined)
	var mask := ""
	for i in 8:
		var j: bool = on[i]
		if i % 2 == 0: j = j and on[(i + 7) % 8] and on[i + 1]
		mask += "#" if j else "."
	return mask

## Empty cells walled in on three or four sides by a walkable layer: likely a missing floor piece.
func _holes(rows: Array, node_name: String, origin: Vector2i) -> Array:
	var found := []
	for z in rows.size():
		var row: String = rows[z]
		for x in row.length():
			if row[x] != "." and row[x] != " ": continue
			var closed := 0
			for d in [Vector2i(0, -1), Vector2i(1, 0), Vector2i(0, 1), Vector2i(-1, 0)]:
				var at: Vector2i = Vector2i(x, z) + d
				if at.y >= 0 and at.y < rows.size() and at.x >= 0 and at.x < (rows[at.y] as String).length() and not (rows[at.y] as String)[at.x] in [".", " "]: closed += 1
			if closed >= 3: found.append({"layer": node_name, "cell": [origin.x + x, origin.y + z], "problem": "hole: an empty cell inside the floor"})
	return found

# ---------------------------------------------------------------------------------------------
# Pictures of 3D pieces, drawn from the mesh data (headless Godot has no GPU)

const NO_HEIGHT := -1.0e9

## GridMaps seen from above (or, with `view`, from an angle): each piece's faces coloured by
## material and texture, shaded by how much they face the viewer, with outlines where the depth
## drops. Problem cells are framed in red.
func _top_view(maps: Array, marks: Array, view_basis: Basis = Basis.IDENTITY) -> Image:
	var first := maps[0] as GridMap
	var cs: Vector3 = first.cell_size
	var lo := Vector2(INF, INF)
	var hi := Vector2(-INF, -INF)
	for gm in maps:
		for c in gm.get_used_cells():
			var p: Vector3 = view_basis * gm.map_to_local(c)
			lo = Vector2(minf(lo.x, p.x), minf(lo.y, p.z))
			hi = Vector2(maxf(hi.x, p.x), maxf(hi.y, p.z))
	if lo.x > hi.x: return null
	var span := (hi - lo) / Vector2(cs.x, cs.z) + Vector2(7, 7)
	var cell_px := clampi(int(4096 / maxf(span.x, span.y)), 4, 48)
	var ppm := float(cell_px) / cs.x
	var size := Vector2i(ceili(span.x * cell_px), ceili(span.y * cell_px))
	var origin := lo - Vector2(3.5 * cs.x, 3.5 * cs.z)
	var view := {"image": Image.create(size.x, size.y, false, Image.FORMAT_RGBA8), "heights": PackedFloat32Array(), "size": size}
	view.image.fill(Color(0.1, 0.11, 0.14))
	view.heights.resize(size.x * size.y)
	view.heights.fill(NO_HEIGHT)
	var sprites := {}
	for gm in maps:
		var lib: MeshLibrary = gm.mesh_library
		for c in gm.get_used_cells():
			var item: int = gm.get_cell_item(c)
			var orient: int = gm.get_cell_item_orientation(c)
			var key := "%d/%d/%d" % [lib.get_instance_id(), item, orient]
			if not sprites.has(key):
				var mesh := lib.get_item_mesh(item)
				sprites[key] = null if mesh == null else _sprite(mesh, Transform3D(view_basis * gm.get_basis_with_orthogonal_index(orient), Vector3.ZERO) * lib.get_item_mesh_transform(item), ppm)
			if sprites[key] == null: continue
			var p: Vector3 = view_basis * gm.map_to_local(c)
			_stamp(view, sprites[key], Vector2i(roundi((p.x - origin.x) * ppm), roundi((p.z - origin.y) * ppm)), p.y)
	_outline(view, 0.25 * cs.y)
	for m in marks:
		if not m.has("cell"): continue
		var p: Vector3 = view_basis * first.map_to_local(Vector3i(m.cell[0], int(m.get("floor", 0)), m.cell[1]))
		var at := Vector2i(roundi((p.x - origin.x) * ppm), roundi((p.z - origin.y) * ppm))
		_frame(view.image, Rect2i(at - Vector2i(cell_px, cell_px) / 2, Vector2i(cell_px, cell_px)), Color(1, 0.2, 0.2))
	return view.image

## From the south-east and above, so heights show: floating, sunk or doubled pieces are visible.
func _angle_view() -> Basis:
	return Basis(Vector3.RIGHT, -0.75) * Basis(Vector3.UP, -0.5)

## A gap in the floor is not a hole when another layer stands there (a wall between rooms).
func _without_covered_holes(problems: Array, maps: Array) -> Array:
	var kept := []
	for p in problems:
		if not str(p.get("problem", "")).begins_with("hole") or not _covered(maps, String(p.layer), p.cell):
			kept.append(p)
	return kept

func _covered(maps: Array, layer: String, cell: Array) -> bool:
	for gm in maps:
		if String(gm.name) == layer: continue
		for c in gm.get_used_cells():
			if c.x == cell[0] and c.z == cell[1]: return true
	return false

# ---------------------------------------------------------------------------------------------
# Checks a picture from above cannot show: pieces must stand on something, and layers must not
# put two solid pieces in the same place.

## Every placed piece as a world box: {layer, cell, floor, item, box}.
func _piece_boxes(maps: Array) -> Array:
	var boxes := []
	for gm in maps:
		var lib: MeshLibrary = gm.mesh_library
		for c in gm.get_used_cells():
			var item: int = gm.get_cell_item(c)
			var mesh := lib.get_item_mesh(item)
			if mesh == null: continue
			var xf: Transform3D = gm.transform * Transform3D(gm.get_basis_with_orthogonal_index(gm.get_cell_item_orientation(c)), gm.map_to_local(c)) * lib.get_item_mesh_transform(item)
			boxes.append({"layer": String(gm.name), "cell": Vector2i(c.x, c.z), "floor": c.y, "item": lib.get_item_name(item), "box": xf * mesh.get_aabb()})
	return boxes

## A piece is held when its bottom is at the lowest level of the map (the ground), or on the top
## of a piece below it. Layers with "rests_on": "terrain" (placed on a height map) or "nothing"
## (hanging or flying decoration) are not checked for support.
func _grounding(maps: Array, rests_on: Dictionary) -> Array:
	var boxes := _piece_boxes(maps)
	if boxes.is_empty(): return []
	var tol := maxf(0.02, 0.05 * (maps[0] as GridMap).cell_size.y)
	var base := INF
	var by_cell := {}
	for i in boxes.size():
		var b: AABB = boxes[i].box
		base = minf(base, b.position.y)
		var key: Vector2i = boxes[i].cell
		if not by_cell.has(key): by_cell[key] = []
		by_cell[key].append(i)
	var found := []
	for i in boxes.size():
		var me: Dictionary = boxes[i]
		var b: AABB = me.box
		var near := []
		for dz in range(-1, 2):
			for dx in range(-1, 2):
				near.append_array(by_cell.get(me.cell + Vector2i(dx, dz), []))
		for j in near:
			if j > i and _overlap_share(b, boxes[j].box) > 0.25:
				found.append({"layer": me.layer, "cell": [me.cell.x, me.cell.y], "floor": me.floor, "problem": "overlap: %s fills the same space as %s of layer %s" % [me.item, boxes[j].item, boxes[j].layer]})
		if rests_on.get(me.layer, "pieces") != "pieces" or b.position.y <= base + tol: continue
		var below := base
		var sunk := ""
		for j in near:
			if j == i: continue
			var o: AABB = boxes[j].box
			if not _overlaps_flat(b, o): continue
			if absf(o.end.y - b.position.y) <= tol:
				below = b.position.y
				break
			if o.end.y < b.position.y: below = maxf(below, o.end.y)
			elif o.position.y < b.position.y - tol: sunk = "sunk: %s starts %.2f m inside %s of layer %s (cell height %.2f m; the piece is %.2f m tall)" % [me.item, o.end.y - b.position.y, boxes[j].item, boxes[j].layer, (maps[0] as GridMap).cell_size.y, o.size.y]
		if sunk != "" and below < b.position.y:
			found.append({"layer": me.layer, "cell": [me.cell.x, me.cell.y], "floor": me.floor, "problem": sunk})
		elif b.position.y - below > tol:
			found.append({"layer": me.layer, "cell": [me.cell.x, me.cell.y], "floor": me.floor, "problem": "floating: %s stands %.2f m above what is under it" % [me.item, b.position.y - below]})
	return found

func _thick(box: AABB) -> AABB:
	if box.size.y >= 0.05: return box
	return AABB(box.position - Vector3(0, 0.05 - box.size.y, 0), Vector3(box.size.x, 0.05, box.size.z))

func _overlaps_flat(a: AABB, b: AABB) -> bool:
	return a.position.x < b.end.x - 0.01 and b.position.x < a.end.x - 0.01 and a.position.z < b.end.z - 0.01 and b.position.z < a.end.z - 0.01

## Shared volume over the smaller piece's volume. Flat pieces count as 5 cm thick, grown
## downwards, so what stands on a floor does not share its space.
func _overlap_share(a: AABB, b: AABB) -> float:
	var ta := _thick(a)
	var tb := _thick(b)
	var common := ta.intersection(tb)
	if not common.has_volume(): return 0.0
	return common.get_volume() / maxf(minf(ta.get_volume(), tb.get_volume()), 1e-6)

## 2D: two layers that both collide in the same cell (a wall drawn twice, a platform inside the
## ground).
func _tile_overlaps(layers: Array) -> Array:
	var found := []
	var solid := {}
	for layer in layers:
		if not layer.collision_enabled: continue
		for cell in layer.get_used_cells():
			var data: TileData = layer.get_cell_tile_data(cell)
			if data == null or layer.tile_set.get_physics_layers_count() == 0 or data.get_collision_polygons_count(0) == 0: continue
			if solid.has(cell) and solid[cell] != String(layer.name):
				found.append({"layer": String(layer.name), "cell": [cell.x, cell.y], "problem": "overlap: solid in layers %s and %s" % [solid[cell], layer.name]})
			else:
				solid[cell] = String(layer.name)
	return found

## One piece rasterised from above at `ppm` pixels per metre: colours, heights and the pixel
## offset of its top-left corner from the cell centre.
func _sprite(mesh: Mesh, xf: Transform3D, ppm: float) -> Dictionary:
	var box := xf * mesh.get_aabb()
	var offset := Vector2i(floori(box.position.x * ppm) - 1, floori(box.position.z * ppm) - 1)
	var size := Vector2i(ceili(box.end.x * ppm) + 1, ceili(box.end.z * ppm) + 1) - offset
	size = size.clamp(Vector2i.ONE, Vector2i(1024, 1024))
	var sprite := {"image": Image.create(size.x, size.y, false, Image.FORMAT_RGBA8), "heights": PackedFloat32Array(), "offset": offset, "size": size}
	sprite.heights.resize(size.x * size.y)
	sprite.heights.fill(NO_HEIGHT)
	for s in mesh.get_surface_count():
		var arrays := mesh.surface_get_arrays(s)
		var verts: PackedVector3Array = arrays[Mesh.ARRAY_VERTEX]
		var uvs = arrays[Mesh.ARRAY_TEX_UV]
		var indices = arrays[Mesh.ARRAY_INDEX]
		if indices == null or (indices as PackedInt32Array).is_empty():
			indices = PackedInt32Array(range(verts.size()))
		var look := _surface_look(mesh.surface_get_material(s))
		for t in range(0, indices.size() - 2, 3):
			var ids := [indices[t], indices[t + 1], indices[t + 2]]
			var p := [xf * verts[ids[0]], xf * verts[ids[1]], xf * verts[ids[2]]]
			var normal: Vector3 = (p[1] - p[0]).cross(p[2] - p[0]).normalized()
			if absf(normal.y) < 0.05: continue
			var colour: Color = look.color
			if look.image != null and uvs != null and (uvs as PackedVector2Array).size() == verts.size():
				var uv: Vector2 = (uvs[ids[0]] + uvs[ids[1]] + uvs[ids[2]]) / 3.0
				var img: Image = look.image
				colour *= img.get_pixel(posmod(int(uv.x * img.get_width()), img.get_width()), posmod(int(uv.y * img.get_height()), img.get_height()))
			colour = colour.darkened(0.45 * (1.0 - absf(normal.y)))
			_fill_triangle(sprite, p, ppm, colour)
	return sprite

func _surface_look(material: Material) -> Dictionary:
	var look := {"color": Color(0.7, 0.7, 0.7), "image": null}
	var base := material as BaseMaterial3D
	if base == null: return look
	look.color = base.albedo_color
	if base.albedo_texture != null: look.image = _texture_image(base.albedo_texture)
	return look

var _texture_images := {}

func _texture_image(texture: Texture2D) -> Image:
	var key := texture.get_instance_id()
	if _texture_images.has(key): return _texture_images[key]
	var image := texture.get_image()
	if (image == null or image.is_empty()) and texture.resource_path.get_extension().to_lower() in ["png", "jpg", "jpeg", "webp"]:
		image = _load_image(texture.resource_path)
	elif image != null:
		if image.is_compressed(): image.decompress()
		image.convert(Image.FORMAT_RGBA8)
	_texture_images[key] = image
	return image

func _fill_triangle(sprite: Dictionary, p: Array, ppm: float, colour: Color) -> void:
	var a := Vector2(p[0].x, p[0].z) * ppm - Vector2(sprite.offset)
	var b := Vector2(p[1].x, p[1].z) * ppm - Vector2(sprite.offset)
	var c := Vector2(p[2].x, p[2].z) * ppm - Vector2(sprite.offset)
	var area := (b - a).cross(c - a)
	if absf(area) < 1e-6: return
	var size: Vector2i = sprite.size
	var x0 := clampi(floori(minf(a.x, minf(b.x, c.x))), 0, size.x - 1)
	var x1 := clampi(ceili(maxf(a.x, maxf(b.x, c.x))), 0, size.x - 1)
	var y0 := clampi(floori(minf(a.y, minf(b.y, c.y))), 0, size.y - 1)
	var y1 := clampi(ceili(maxf(a.y, maxf(b.y, c.y))), 0, size.y - 1)
	for y in range(y0, y1 + 1):
		for x in range(x0, x1 + 1):
			var q := Vector2(x + 0.5, y + 0.5)
			var w0 := (c - b).cross(q - b) / area
			var w1 := (a - c).cross(q - c) / area
			var w2 := 1.0 - w0 - w1
			if w0 < -0.02 or w1 < -0.02 or w2 < -0.02: continue
			var h: float = w0 * p[0].y + w1 * p[1].y + w2 * p[2].y
			var i := y * size.x + x
			if h <= sprite.heights[i]: continue
			sprite.heights[i] = h
			sprite.image.set_pixel(x, y, colour)

func _stamp(view: Dictionary, sprite: Dictionary, centre: Vector2i, lift: float) -> void:
	var size: Vector2i = sprite.size
	var vsize: Vector2i = view.size
	for y in size.y:
		for x in size.x:
			var h: float = sprite.heights[y * size.x + x]
			if h == NO_HEIGHT: continue
			var at: Vector2i = centre + sprite.offset + Vector2i(x, y)
			if at.x < 0 or at.y < 0 or at.x >= vsize.x or at.y >= vsize.y: continue
			var i: int = at.y * vsize.x + at.x
			if h + lift <= view.heights[i]: continue
			view.heights[i] = h + lift
			view.image.set_pixelv(at, sprite.image.get_pixel(x, y))

## Darkens pixels next to a drop in height (wall tops, steps, edges of the floor).
func _outline(view: Dictionary, drop: float) -> void:
	var size: Vector2i = view.size
	var dark := []
	for y in size.y:
		for x in size.x:
			var h: float = view.heights[y * size.x + x]
			if h == NO_HEIGHT: continue
			for d in [Vector2i(1, 0), Vector2i(-1, 0), Vector2i(0, 1), Vector2i(0, -1)]:
				var n: Vector2i = Vector2i(x, y) + d
				if n.x < 0 or n.y < 0 or n.x >= size.x or n.y >= size.y: continue
				if view.heights[n.y * size.x + n.x] < h - drop:
					dark.append(Vector2i(x, y))
					break
	for at in dark: view.image.set_pixelv(at, view.image.get_pixelv(at).darkened(0.5))

func _frame(image: Image, rect: Rect2i, colour: Color) -> void:
	rect = rect.intersection(Rect2i(Vector2i.ZERO, image.get_size()))
	if rect.size.x <= 0 or rect.size.y <= 0: return
	for x in range(rect.position.x, rect.end.x):
		image.set_pixel(x, rect.position.y, colour)
		image.set_pixel(x, rect.end.y - 1, colour)
	for y in range(rect.position.y, rect.end.y):
		image.set_pixel(rect.position.x, y, colour)
		image.set_pixel(rect.end.x - 1, y, colour)

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

## The painted layers drawn from their atlas regions (no GPU), 2x for small tiles; cells in the
## report are framed in red.
func _picture(layers: Array, tile_set: TileSet, marks: Array) -> Image:
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
	for m in marks:
		if m.has("cell"): _frame(out, Rect2i((Vector2i(m.cell[0], m.cell[1]) - used.position) * ts * scale, ts * scale), Color(1, 0.2, 0.2))
	return out

# ---------------------------------------------------------------------------------------------
# meshlib: 3D kit → MeshLibrary for GridMap

## A kit is a folder of GLBs (one piece each), one GLB per piece, or one GLB whose top-level
## nodes are the pieces (a kit imported as a folder: one node per file). Each piece becomes one
## item with all its meshes merged, named after the piece.
func _meshlib(args: Array) -> bool:
	if args.size() < 2: return _fail("meshlib needs <res://kit.glb|res://dir> <res://out.tres>")
	var sources := []
	if args[0].ends_with("/") or DirAccess.dir_exists_absolute(ProjectSettings.globalize_path(args[0])):
		for file in DirAccess.get_files_at(args[0]):
			if file.get_extension() in ["glb", "gltf", "tscn", "scn"]: sources.append(args[0].path_join(file))
		sources.sort_custom(func(a: String, b: String) -> bool: return a.naturalnocasecmp_to(b) < 0)
	else:
		sources.append(args[0])
	var pieces := []
	var skipped := []
	var names := {}
	for path in sources:
		var scene = load(path)
		if not scene is PackedScene: return _fail("meshlib: cannot load %s; run --import first" % path)
		var root: Node = scene.instantiate()
		var tops := []
		for child in root.get_children():
			if child is Node3D and (child is MeshInstance3D or not child.find_children("*", "MeshInstance3D", true, false).is_empty()): tops.append(child)
		if root is MeshInstance3D or tops.size() < 2: tops = [root]
		for top in tops:
			var name: String = String(top.name) if top != root else (path.get_file().get_basename() if sources.size() > 1 or tops.size() == 1 else String(root.name))
			var mesh := _merged_mesh(top)
			if mesh == null:
				skipped.append(name)
				continue
			var unique := name
			var n := 2
			while names.has(unique):
				unique = "%s_%d" % [name, n]
				n += 1
			names[unique] = true
			pieces.append({"name": unique, "mesh": mesh})
		root.free()
	if pieces.is_empty(): return _fail("meshlib: no meshes found")
	var library := MeshLibrary.new()
	var collision := _option(args, "--collision", "box")
	var textures := {}
	for i in pieces.size():
		var m: Dictionary = pieces[i]
		library.create_item(i)
		library.set_item_name(i, m.name)
		library.set_item_mesh(i, m.mesh)
		for s in m.mesh.get_surface_count():
			var base := m.mesh.surface_get_material(s) as BaseMaterial3D
			if base != null and base.albedo_texture != null: textures[base.albedo_texture.resource_path] = true
		var shape_xf := Transform3D.IDENTITY
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
				shape_xf = Transform3D(Basis.IDENTITY, aabb.get_center() - Vector3(0, thin.y / 2.0, 0))
		if shape != null: library.set_item_shapes(i, [shape, shape_xf])
	var out: String = args[1]
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(out.get_base_dir()))
	var err := ResourceSaver.save(library, out)
	if err != OK: return _fail("meshlib: cannot save %s (%s)" % [out, error_string(err)])
	var listing := []
	for i in pieces.size():
		var aabb: AABB = pieces[i].mesh.get_aabb()
		listing.append({"id": i, "name": pieces[i].name, "size": [snappedf(aabb.size.x, 0.01), snappedf(aabb.size.y, 0.01), snappedf(aabb.size.z, 0.01)], "min": [snappedf(aabb.position.x, 0.01), snappedf(aabb.position.y, 0.01), snappedf(aabb.position.z, 0.01)]})
	var sheet := out.get_basename() + ".png"
	_contact_sheet(pieces).save_png(ProjectSettings.globalize_path(sheet))
	_write(out.get_basename() + ".items.json", JSON.stringify(listing, "  "))
	print("TILES_MESHLIB=", JSON.stringify({"output": out, "picture": sheet, "items": listing, "textures": textures.keys(), "skipped": skipped}))
	return true

## All meshes under `top` (skinned ones excluded) as one ArrayMesh in `top`'s own space; the
## piece's position in the kit scene is dropped so every item sits on its own origin.
func _merged_mesh(top: Node) -> ArrayMesh:
	var instances := top.find_children("*", "MeshInstance3D", true, false)
	if top is MeshInstance3D: instances.push_front(top)
	var merged := ArrayMesh.new()
	for node in instances:
		var mi := node as MeshInstance3D
		if mi.mesh == null or mi.skin != null: continue
		var xf := Transform3D.IDENTITY if mi == top else _relative(mi, top)
		for s in mi.mesh.get_surface_count():
			if mi.mesh.surface_get_primitive_type(s) != Mesh.PRIMITIVE_TRIANGLES: continue
			var st := SurfaceTool.new()
			st.append_from(mi.mesh, s, xf)
			st.set_material(mi.get_surface_override_material(s) if mi.get_surface_override_material(s) != null else mi.mesh.surface_get_material(s))
			st.commit(merged)
	return merged if merged.get_surface_count() > 0 else null

func _relative(node: Node3D, root: Node) -> Transform3D:
	var t := node.transform
	var p := node.get_parent()
	while p != null and p != root:
		if p is Node3D: t = (p as Node3D).transform * t
		p = p.get_parent()
	return t

## Every item from above (left) and from the front (right) at one common scale, with its id.
func _contact_sheet(pieces: Array) -> Image:
	const CELL := 112
	const COLUMNS := 6
	var extent := 0.01
	for m in pieces:
		var size: Vector3 = m.mesh.get_aabb().size
		extent = maxf(extent, maxf(size.x, maxf(size.y, size.z)))
	var ppm := (CELL - 8) / extent
	var rows := ceili(float(pieces.size()) / COLUMNS)
	var sheet := Image.create(COLUMNS * CELL * 2, rows * (CELL + 14), false, Image.FORMAT_RGBA8)
	sheet.fill(Color(0.1, 0.11, 0.14))
	# Front: turn -90 degrees around X so height becomes depth and up becomes the top of the picture.
	var front := Transform3D(Basis(Vector3.RIGHT, -PI / 2.0), Vector3.ZERO)
	for i in pieces.size():
		var at := Vector2i((i % COLUMNS) * CELL * 2, (i / COLUMNS) * (CELL + 14))
		_number(sheet, Vector2(at.x + 3, at.y + 2), i)
		for v in 2:
			var sprite := _sprite(pieces[i].mesh, Transform3D.IDENTITY if v == 0 else front, ppm)
			var view := {"image": Image.create(CELL, CELL, false, Image.FORMAT_RGBA8), "heights": PackedFloat32Array(), "size": Vector2i(CELL, CELL)}
			view.image.fill(Color(0.16, 0.17, 0.21) if v == 0 else Color(0.13, 0.15, 0.19))
			view.heights.resize(CELL * CELL)
			view.heights.fill(NO_HEIGHT)
			# Centre each view on the piece's own bounds; up in the top view is north (-Z).
			_stamp(view, sprite, Vector2i(CELL / 2, CELL / 2) - sprite.offset - sprite.size / 2, 0.0)
			_outline(view, 0.05)
			sheet.blit_rect(view.image, Rect2i(0, 0, CELL, CELL), at + Vector2i(v * CELL, 14))
	return sheet

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
