extends SceneTree
## Sprite frame tools for the game agent (game-motion references/sprite-2d.md). Build-time only:
## nothing here ships in the game. Reads PNG files directly (no import step needed).
##
##   godot --headless -s <tool> -- frames <in.png> --grid CxR [--frames N] [--height H] [--pad P] --out <out.png>
##   godot --headless -s <tool> -- pixel <in.png> --cell WxH --to WxH [--colors N] --out <out.png>
##
## frames: cuts a generated row/grid of poses into cells, scales every frame by ONE factor (so the
##   character keeps its size), puts the lowest opaque pixel of every frame on one baseline and the
##   torso (upper body) on one vertical line, and writes:
##   <out.png>        one row per input row, all cells the same size (ready for SpriteFrames)
##   <out.json>       cell size, frame count, per-frame metrics and warnings
##   <out.check.png>  enlarged frames with the baseline in red + an onion skin of all frames
##   Warnings: size drift between frames, empty cells, last frame repeating the first,
##   green/magenta fringe left by background removal, half-transparent pixels.
## pixel: turns an aligned sheet of fake "pixel art" into real pixels: each target pixel takes the
##   majority colour of its block (not one sampled pixel), alpha becomes 0 or 255, and colours are
##   limited to the N most used ones. Run it once at the end, on the whole sheet, so all frames
##   share one palette.

func _initialize() -> void:
	var args := OS.get_cmdline_user_args()
	if args.is_empty() or not args[0] in ["frames", "pixel"]:
		_fail("usage: sprites.gd -- frames|pixel ...")
		quit(1)
		return
	var ok := false
	match args[0]:
		"frames": ok = _frames(args.slice(1))
		"pixel": ok = _pixel(args.slice(1))
	quit(0 if ok else 1)

func _fail(message: String) -> bool:
	printerr("sprites.gd: ", message)
	return false

func _opt(args: PackedStringArray, name: String, fallback: String = "") -> String:
	var i := args.find(name)
	return args[i + 1] if i >= 0 and i + 1 < args.size() else fallback

func _pair(text: String) -> Vector2i:
	var parts := text.split("x")
	if parts.size() != 2 or not parts[0].is_valid_int() or not parts[1].is_valid_int():
		return Vector2i.ZERO
	return Vector2i(int(parts[0]), int(parts[1]))

func _load(path: String) -> Image:
	var image := Image.load_from_file(path)
	if image == null:
		return null
	image.convert(Image.FORMAT_RGBA8)
	return image

# --- frames -------------------------------------------------------------------------------------

func _frames(args: PackedStringArray) -> bool:
	if args.is_empty():
		return _fail("frames: input image missing")
	var source := _load(args[0])
	if source == null:
		return _fail("frames: cannot read %s" % args[0])
	var grid := _pair(_opt(args, "--grid", "0x0"))
	if grid.x <= 0 or grid.y <= 0:
		return _fail("frames: --grid CxR is required (columns x rows)")
	var out := _opt(args, "--out")
	if out == "":
		return _fail("frames: --out is required")
	var limit := int(_opt(args, "--frames", str(grid.x * grid.y)))
	var pad := int(_opt(args, "--pad", "4"))
	var cell_in := Vector2i(source.get_width() / grid.x, source.get_height() / grid.y)

	var frames: Array[Dictionary] = []
	for i in range(mini(limit, grid.x * grid.y)):
		var cell := source.get_region(Rect2i(Vector2i(i % grid.x, i / grid.x) * cell_in, cell_in))
		var used := cell.get_used_rect()
		var frame := {"index": i, "row": i / grid.x, "empty": used.size == Vector2i.ZERO}
		if not frame.empty:
			frame.image = cell.get_region(used)
			frame.size = used.size
			frame.torso_x = _torso_x(frame.image)
		frames.append(frame)
	var filled := frames.filter(func(f: Dictionary) -> bool: return not f.empty)
	if filled.is_empty():
		return _fail("frames: every cell is empty (is the background removed?)")

	# One scale for all frames: the median height becomes --height (or stays as is).
	var heights: Array = filled.map(func(f: Dictionary) -> int: return f.size.y)
	heights.sort()
	var median_h: int = heights[heights.size() / 2]
	var scale := float(_opt(args, "--height", str(median_h))) / float(median_h)
	var reach_left := 0.0
	var reach_right := 0.0
	var tallest := 0.0
	for frame in filled:
		if not is_equal_approx(scale, 1.0):
			var target := Vector2i(maxi(1, roundi(frame.size.x * scale)), maxi(1, roundi(frame.size.y * scale)))
			frame.image.resize(target.x, target.y, Image.INTERPOLATE_LANCZOS)
			frame.torso_x *= scale
		reach_left = maxf(reach_left, frame.torso_x)
		reach_right = maxf(reach_right, frame.image.get_width() - frame.torso_x)
		tallest = maxf(tallest, frame.image.get_height())
	var cell := Vector2i(ceili(reach_left + reach_right) + pad * 2, ceili(tallest) + pad * 2)
	var anchor := Vector2i(ceili(reach_left) + pad, cell.y - pad)  # torso line, baseline

	var rows := 0
	for frame in frames:
		rows = maxi(rows, frame.row + 1)
	var per_row := grid.x
	var sheet := Image.create_empty(cell.x * per_row, cell.y * rows, false, Image.FORMAT_RGBA8)
	for frame in frames:
		if frame.empty:
			continue
		var origin := Vector2i(frame.index % per_row, frame.row) * cell
		var at := origin + Vector2i(anchor.x - roundi(frame.torso_x), anchor.y - frame.image.get_height())
		sheet.blit_rect(frame.image, Rect2i(Vector2i.ZERO, frame.image.get_size()), at)
		frame.offset = at - origin

	var report := _report(frames, filled, sheet, cell, per_row)
	report.cell = [cell.x, cell.y]
	report.baseline_y = anchor.y
	report.scale = snappedf(scale, 0.001)
	if sheet.save_png(out) != OK:
		return _fail("frames: cannot write %s" % out)
	_write_json(out.get_basename() + ".json", report)
	_check_image(sheet, frames, cell, per_row, anchor).save_png(out.get_basename() + ".check.png")
	print(JSON.stringify(report.warnings))
	return true

## Mean x of opaque pixels in the upper 60% of the frame: the head and torso stay put while legs
## and arms swing, so this line keeps the body from sliding between frames.
func _torso_x(image: Image) -> float:
	var sum := 0.0
	var count := 0
	for y in range(int(image.get_height() * 0.6)):
		for x in range(image.get_width()):
			if image.get_pixel(x, y).a > 0.5:
				sum += x
				count += 1
	return sum / count if count > 0 else image.get_width() / 2.0

func _report(frames: Array[Dictionary], filled: Array, sheet: Image, cell: Vector2i, per_row: int) -> Dictionary:
	var warnings: Array[String] = []
	var metrics: Array[Dictionary] = []
	var heights: Array[int] = []
	var half_alpha := 0
	var fringe := 0
	var opaque := 0
	for frame in frames:
		if frame.empty:
			warnings.append("frame %d is empty" % frame.index)
			metrics.append({"index": frame.index, "empty": true})
			continue
		var image: Image = frame.image
		heights.append(image.get_height())
		for y in range(image.get_height()):
			for x in range(image.get_width()):
				var c := image.get_pixel(x, y)
				if c.a <= 0.02:
					continue
				opaque += 1
				if c.a < 0.98:
					half_alpha += 1
				if _is_edge(image, x, y) and (_greenish(c) or _magentaish(c)):
					fringe += 1
		metrics.append({"index": frame.index, "size": [image.get_width(), image.get_height()], "offset": [frame.offset.x, frame.offset.y]})
	heights.sort()
	var median_h := heights[heights.size() / 2]
	for m in metrics:
		if m.has("size") and absf(m.size[1] - median_h) > median_h * 0.12:
			warnings.append("frame %d height %d differs from the others (%d) by more than 12%%: regenerate it or check it is a crouch/jump pose" % [m.index, m.size[1], median_h])
	if filled.size() >= 3:
		var first: Dictionary = filled[0]
		var last: Dictionary = filled[filled.size() - 1]
		if first.row == last.row and _difference(sheet, first, last, cell, per_row) < 0.02:
			warnings.append("last frame repeats the first: drop it so the loop does not stutter")
	if opaque > 0 and float(fringe) / opaque > 0.002:
		warnings.append("%d edge pixels keep the green/magenta background colour: remove the fringe" % fringe)
	if opaque > 0 and float(half_alpha) / opaque > 0.05:
		warnings.append("%.0f%% of pixels are half transparent: fine for painted art, run `pixel` for pixel art" % (100.0 * half_alpha / opaque))
	return {"frames": frames.size(), "metrics": metrics, "warnings": warnings}

func _is_edge(image: Image, x: int, y: int) -> bool:
	for d: Vector2i in [Vector2i(1, 0), Vector2i(-1, 0), Vector2i(0, 1), Vector2i(0, -1)]:
		var p := Vector2i(x, y) + d
		if p.x < 0 or p.y < 0 or p.x >= image.get_width() or p.y >= image.get_height():
			return true
		if image.get_pixelv(p).a <= 0.02:
			return true
	return false

func _greenish(c: Color) -> bool:
	return c.g > c.r + 0.25 and c.g > c.b + 0.25

func _magentaish(c: Color) -> bool:
	return c.r > c.g + 0.25 and c.b > c.g + 0.25

func _difference(sheet: Image, a: Dictionary, b: Dictionary, cell: Vector2i, per_row: int) -> float:
	var oa := Vector2i(a.index % per_row, a.row) * cell
	var ob := Vector2i(b.index % per_row, b.row) * cell
	var total := 0.0
	var step := maxi(1, cell.x / 48)
	var count := 0
	for y in range(0, cell.y, step):
		for x in range(0, cell.x, step):
			var ca := sheet.get_pixel(oa.x + x, oa.y + y)
			var cb := sheet.get_pixel(ob.x + x, ob.y + y)
			total += absf(ca.a - cb.a) + (absf(ca.r - cb.r) + absf(ca.g - cb.g) + absf(ca.b - cb.b)) * minf(ca.a, cb.a) / 3.0
			count += 1
	return total / count

## Frames side by side with the shared baseline (red) and torso line (blue), then one extra cell
## with all frames of the first row overlaid (onion skin): sliding feet and drifting heads show up
## as blur there.
func _check_image(sheet: Image, frames: Array[Dictionary], cell: Vector2i, per_row: int, anchor: Vector2i) -> Image:
	var count := frames.size()
	var image := Image.create_empty(cell.x * (count + 1), cell.y, false, Image.FORMAT_RGBA8)
	image.fill(Color(0.18, 0.18, 0.2))
	var onion := Image.create_empty(cell.x, cell.y, false, Image.FORMAT_RGBA8)
	for frame in frames:
		var region := Rect2i(Vector2i(frame.index % per_row, frame.row) * cell, cell)
		var at := Vector2i(frame.index * cell.x, 0)
		image.blend_rect(sheet, region, at)
		if frame.row == 0 and not frame.empty:
			var ghost := sheet.get_region(region)
			for y in range(cell.y):
				for x in range(cell.x):
					var c := ghost.get_pixel(x, y)
					if c.a > 0.02:
						ghost.set_pixel(x, y, Color(c.r, c.g, c.b, c.a * 0.35))
			onion.blend_rect(ghost, Rect2i(Vector2i.ZERO, cell), Vector2i.ZERO)
	image.blend_rect(onion, Rect2i(Vector2i.ZERO, cell), Vector2i(count * cell.x, 0))
	for x in range(image.get_width()):
		image.set_pixel(x, anchor.y, Color.RED)
	for i in range(count + 1):
		for y in range(cell.y):
			image.set_pixel(i * cell.x + anchor.x, y, Color(0.3, 0.6, 1.0))
			image.set_pixel(i * cell.x, y, Color(0.4, 0.4, 0.45))
	var zoom := maxi(1, 256 / maxi(1, cell.y))
	if zoom > 1:
		image.resize(image.get_width() * zoom, image.get_height() * zoom, Image.INTERPOLATE_NEAREST)
	return image

# --- pixel --------------------------------------------------------------------------------------

func _pixel(args: PackedStringArray) -> bool:
	if args.is_empty():
		return _fail("pixel: input image missing")
	var source := _load(args[0])
	if source == null:
		return _fail("pixel: cannot read %s" % args[0])
	var cell := _pair(_opt(args, "--cell", "0x0"))
	var to := _pair(_opt(args, "--to", "0x0"))
	var out := _opt(args, "--out")
	if cell.x <= 0 or to.x <= 0 or out == "":
		return _fail("pixel: --cell WxH (cell in the input), --to WxH (cell in pixels) and --out are required")
	var cols := source.get_width() / cell.x
	var rows := source.get_height() / cell.y
	var block := Vector2(float(cell.x) / to.x, float(cell.y) / to.y)
	var result := Image.create_empty(cols * to.x, rows * to.y, false, Image.FORMAT_RGBA8)
	var usage := {}
	for ty in range(rows * to.y):
		for tx in range(cols * to.x):
			var c := _majority(source, Vector2i(tx / to.x, ty / to.y) * cell, cell, Vector2(tx % to.x, ty % to.y) * block, block)
			result.set_pixel(tx, ty, c)
			if c.a > 0.0:
				usage[c.to_rgba32()] = usage.get(c.to_rgba32(), 0) + 1
	var colors := int(_opt(args, "--colors", "0"))
	if colors > 0 and usage.size() > colors:
		var ranked := usage.keys()
		ranked.sort_custom(func(a: int, b: int) -> bool: return usage[a] > usage[b])
		var palette: Array[Color] = []
		for key in ranked.slice(0, colors):
			palette.append(Color.hex(key))
		for y in range(result.get_height()):
			for x in range(result.get_width()):
				var c := result.get_pixel(x, y)
				if c.a > 0.0:
					result.set_pixel(x, y, _nearest(c, palette))
	if result.save_png(out) != OK:
		return _fail("pixel: cannot write %s" % out)
	print(JSON.stringify({"size": [result.get_width(), result.get_height()], "colors": mini(usage.size(), colors) if colors > 0 else usage.size()}))
	return true

## Majority vote inside one block, on colours rounded to 5 bits per channel, so the anti-aliased
## edges and noise of a generated image do not decide the pixel.
func _majority(source: Image, origin: Vector2i, cell: Vector2i, start: Vector2, size: Vector2) -> Color:
	var votes := {}
	var sums := {}
	var transparent := 0
	var total := 0
	for y in range(floori(start.y), mini(ceili(start.y + size.y), cell.y)):
		for x in range(floori(start.x), mini(ceili(start.x + size.x), cell.x)):
			var c := source.get_pixel(origin.x + x, origin.y + y)
			total += 1
			if c.a < 0.5:
				transparent += 1
				continue
			var key := (int(c.r * 31) << 10) | (int(c.g * 31) << 5) | int(c.b * 31)
			votes[key] = votes.get(key, 0) + 1
			sums[key] = sums.get(key, Vector3.ZERO) + Vector3(c.r, c.g, c.b)
	if total == 0 or transparent * 2 >= total:
		return Color(0, 0, 0, 0)
	var best: int = votes.keys()[0]
	for key in votes:
		if votes[key] > votes[best]:
			best = key
	var mean: Vector3 = sums[best] / votes[best]
	return Color(mean.x, mean.y, mean.z, 1.0)

func _nearest(c: Color, palette: Array[Color]) -> Color:
	var best := palette[0]
	var best_d := INF
	for p in palette:
		var d := Vector3(c.r - p.r, c.g - p.g, c.b - p.b).length_squared()
		if d < best_d:
			best_d = d
			best = p
	return best

func _write_json(path: String, data: Dictionary) -> void:
	var file := FileAccess.open(path, FileAccess.WRITE)
	if file == null:
		printerr("sprites.gd: cannot write ", path)
		return
	file.store_string(JSON.stringify(data, "  "))
