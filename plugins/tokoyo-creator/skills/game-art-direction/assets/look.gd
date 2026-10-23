extends SceneTree
## Colour tools for keeping the game's look on the concept art (game-art-direction
## references/concept-to-map.md). Build-time only: nothing here ships in the game. Images are read
## as files, so no import step and no GPU are needed.
##
##   godot --headless --path <source>/godot -s <tool> -- palette <concept.png> --out <source>/design/palette.json [--colors 8]
##   godot --headless --path <source>/godot -s <tool> -- compare <concept.png> <shot.png> [--out <compare.png>]
##   godot --headless --path <source>/godot -s <tool> -- recolor <image.png> --palette <palette.json> --out <image.png> [--mode transfer|map] [--strength 0..1]
##
## palette: the concept's main colours with their share of the picture, its light (mean, darkest,
##   brightest, contrast), colourfulness and warmth, and suggested ambient / key light / shadow
##   colours for the WorldEnvironment and lights. Writes the JSON and a swatch picture beside it.
## compare: the concept and a game screenshot side by side with their palettes, and how far the
##   screenshot is from the concept (light, contrast, colourfulness, warmth, missing colours).
## recolor: moves an image (a tile sheet, a fill texture, a 3D kit's colour map) onto the
##   palette: `transfer` matches its colour statistics (keeps detail), `map` repaints it by
##   brightness with the palette's colours (strong, for pixel art). Alpha is kept.

func _initialize() -> void:
	var args := OS.get_cmdline_user_args()
	var ok := false
	match args[0] if not args.is_empty() else "":
		"palette": ok = _palette(args.slice(1))
		"compare": ok = _compare(args.slice(1))
		"recolor": ok = _recolor(args.slice(1))
		_: printerr("usage: look.gd -- palette|compare|recolor ...")
	quit(0 if ok else 1)

func _fail(message: String) -> bool:
	printerr("look.gd: ", message)
	return false

func _option(args: Array, name: String, fallback: String = "") -> String:
	var at := args.find(name)
	return args[at + 1] if at >= 0 and at + 1 < args.size() else fallback

func _path(path: String) -> String:
	return ProjectSettings.globalize_path(path) if path.begins_with("res://") else path

func _load(path: String) -> Image:
	var image := Image.load_from_file(_path(path))
	if image == null or image.is_empty(): return null
	if image.is_compressed(): image.decompress()
	image.convert(Image.FORMAT_RGBA8)
	return image

# ---------------------------------------------------------------------------------------------
# Colour maths: sRGB ↔ CIE Lab (D65), where distances follow what the eye sees.

func _lab(c: Color) -> Vector3:
	var r := c.srgb_to_linear()
	var x := (r.r * 0.4124 + r.g * 0.3576 + r.b * 0.1805) / 0.95047
	var y := r.r * 0.2126 + r.g * 0.7152 + r.b * 0.0722
	var z := (r.r * 0.0193 + r.g * 0.1192 + r.b * 0.9505) / 1.08883
	var fx := _f(x)
	var fy := _f(y)
	var fz := _f(z)
	return Vector3(116.0 * fy - 16.0, 500.0 * (fx - fy), 200.0 * (fy - fz))

func _f(t: float) -> float:
	return pow(t, 1.0 / 3.0) if t > 0.008856 else 7.787 * t + 16.0 / 116.0

func _rgb(lab: Vector3, alpha: float = 1.0) -> Color:
	var fy := (lab.x + 16.0) / 116.0
	var fx := fy + lab.y / 500.0
	var fz := fy - lab.z / 200.0
	var x := 0.95047 * _finv(fx)
	var y := _finv(fy)
	var z := 1.08883 * _finv(fz)
	var lin := Color(3.2406 * x - 1.5372 * y - 0.4986 * z, -0.9689 * x + 1.8758 * y + 0.0415 * z, 0.0557 * x - 0.2040 * y + 1.0570 * z)
	var c := Color(clampf(lin.r, 0, 1), clampf(lin.g, 0, 1), clampf(lin.b, 0, 1)).linear_to_srgb()
	c.a = alpha
	return c

func _finv(t: float) -> float:
	return t * t * t if t > 0.206893 else (t - 16.0 / 116.0) / 7.787

## Opaque pixels of a copy at most 160 px wide, in Lab.
func _samples(image: Image) -> PackedVector3Array:
	var small := image.duplicate() as Image
	if small.get_width() > 160: small.resize(160, maxi(1, small.get_height() * 160 / small.get_width()), Image.INTERPOLATE_BILINEAR)
	var out := PackedVector3Array()
	for y in small.get_height():
		for x in small.get_width():
			var c := small.get_pixel(x, y)
			if c.a > 0.5: out.append(_lab(c))
	return out

# ---------------------------------------------------------------------------------------------
# palette

func _palette(args: Array) -> bool:
	if args.is_empty(): return _fail("palette needs an image")
	var image := _load(args[0])
	if image == null: return _fail("cannot read %s" % args[0])
	var out := _option(args, "--out", args[0].get_basename() + ".palette.json")
	var info := _describe(image, int(_option(args, "--colors", "8")))
	info["source"] = args[0]
	var file := FileAccess.open(_path(out), FileAccess.WRITE)
	if file == null: return _fail("cannot write %s" % out)
	file.store_string(JSON.stringify(info, "  "))
	file.close()
	var swatches := _swatches(info.colors, 480, 48)
	swatches.save_png(_path(out.get_basename() + ".png"))
	print("LOOK_PALETTE=", JSON.stringify({"palette": out, "picture": out.get_basename() + ".png", "colors": info.colors.map(func(c): return c.hex), "light": info.light, "suggest": info.suggest}))
	return true

## Main colours (k-means in Lab), light, colourfulness, warmth and light suggestions.
func _describe(image: Image, k: int) -> Dictionary:
	var lab := _samples(image)
	if lab.is_empty(): return {"colors": [], "light": {}, "suggest": {}}
	var lights := PackedFloat32Array()
	var chroma := 0.0
	var warmth := 0.0
	var mean := Vector3.ZERO
	for v in lab:
		lights.append(v.x)
		chroma += Vector2(v.y, v.z).length()
		warmth += v.z * 0.5 + v.y * 0.5
		mean += v
	var n := float(lab.size())
	mean /= n
	var spread := Vector3.ZERO
	for v in lab: spread += (v - mean) * (v - mean)
	spread = Vector3(sqrt(spread.x / n), sqrt(spread.y / n), sqrt(spread.z / n))
	lights.sort()
	var p := func(q: float) -> float: return lights[clampi(int(q * (lights.size() - 1)), 0, lights.size() - 1)]
	var centres := _kmeans(lab, clampi(k, 2, 16))
	var colors := []
	for c in centres:
		colors.append({"hex": "#" + _rgb(c.lab).to_html(false), "share": snappedf(c.share, 0.001), "lightness": snappedf(c.lab.x, 0.1)})
	return {
		"colors": colors,
		"light": {"mean": snappedf(mean.x, 0.1), "dark_5": snappedf(p.call(0.05), 0.1), "median": snappedf(p.call(0.5), 0.1), "bright_95": snappedf(p.call(0.95), 0.1), "contrast": snappedf(p.call(0.95) - p.call(0.05), 0.1)},
		"colourfulness": snappedf(chroma / n, 0.1),
		"warmth": snappedf(warmth / n, 0.1),
		"lab": {"mean": [mean.x, mean.y, mean.z], "spread": [spread.x, spread.y, spread.z]},
		"suggest": {
			"ambient": "#" + _rgb(_mean_where(lab, p.call(0.0), p.call(0.3))).to_html(false),
			"shadow": "#" + _rgb(_mean_where(lab, p.call(0.0), p.call(0.1))).to_html(false),
			"key_light": "#" + _rgb(_mean_where(lab, p.call(0.9), p.call(1.0))).to_html(false),
		},
	}

func _mean_where(lab: PackedVector3Array, lo: float, hi: float) -> Vector3:
	var sum := Vector3.ZERO
	var count := 0
	for v in lab:
		if v.x >= lo and v.x <= hi:
			sum += v
			count += 1
	return sum / count if count > 0 else Vector3(50, 0, 0)

## k-means seeded at lightness quantiles; returns [{lab, share}] largest share first.
func _kmeans(lab: PackedVector3Array, k: int) -> Array:
	var sorted := Array(lab)
	sorted.sort_custom(func(a: Vector3, b: Vector3) -> bool: return a.x < b.x)
	var centres := []
	for i in k: centres.append(sorted[int((i + 0.5) / k * (sorted.size() - 1))])
	var counts := []
	for _round in 12:
		var sums := []
		counts = []
		for i in k:
			sums.append(Vector3.ZERO)
			counts.append(0)
		for v in lab:
			var best := 0
			var best_d := INF
			for i in k:
				var d: float = (v - centres[i]).length_squared()
				if d < best_d:
					best_d = d
					best = i
			sums[best] += v
			counts[best] += 1
		for i in k:
			if counts[i] > 0: centres[i] = sums[i] / counts[i]
	var result := []
	for i in k:
		if counts[i] > 0: result.append({"lab": centres[i], "share": float(counts[i]) / lab.size()})
	result.sort_custom(func(a: Dictionary, b: Dictionary) -> bool: return a.share > b.share)
	return result

func _swatches(colors: Array, width: int, height: int) -> Image:
	var image := Image.create(width, height, false, Image.FORMAT_RGBA8)
	var x := 0
	for i in colors.size():
		var w := width - x if i == colors.size() - 1 else roundi(colors[i].share * width)
		image.fill_rect(Rect2i(x, 0, maxi(w, 1), height), Color.from_string(colors[i].hex, Color.BLACK))
		x += w
	return image

# ---------------------------------------------------------------------------------------------
# compare

func _compare(args: Array) -> bool:
	if args.size() < 2: return _fail("compare needs <concept.png> <shot.png>")
	var concept := _load(args[0])
	var shot := _load(args[1])
	if concept == null or shot == null: return _fail("cannot read the images")
	var a := _describe(concept, 8)
	var b := _describe(shot, 8)
	var gaps := []
	var dl: float = b.light.mean - a.light.mean
	if absf(dl) > 6: gaps.append("the game is %s than the concept (mean lightness %+.0f)" % ["brighter" if dl > 0 else "darker", dl])
	var dc: float = b.light.contrast - a.light.contrast
	if absf(dc) > 10: gaps.append("the game has %s contrast (%+.0f)" % ["more" if dc > 0 else "less", dc])
	var ds: float = b.colourfulness - a.colourfulness
	if absf(ds) > 5: gaps.append("the game is %s colourful (%+.0f)" % ["more" if ds > 0 else "less", ds])
	var dw: float = b.warmth - a.warmth
	if absf(dw) > 4: gaps.append("the game is %s (%+.0f)" % ["warmer" if dw > 0 else "cooler", dw])
	var missing := _unmatched(a.colors, b.colors, 0.05)
	var extra := _unmatched(b.colors, a.colors, 0.10)
	if not missing.is_empty(): gaps.append("concept colours missing in the game: %s" % ", ".join(missing))
	if not extra.is_empty(): gaps.append("large colours in the game that the concept does not have: %s" % ", ".join(extra))
	var height := 360
	var left := _fit(concept, height)
	var right := _fit(shot, height)
	var picture := Image.create(left.get_width() + right.get_width() + 8, height + 40, false, Image.FORMAT_RGBA8)
	picture.fill(Color(0.1, 0.11, 0.14))
	picture.blit_rect(left, Rect2i(Vector2i.ZERO, left.get_size()), Vector2i.ZERO)
	picture.blit_rect(right, Rect2i(Vector2i.ZERO, right.get_size()), Vector2i(left.get_width() + 8, 0))
	var sa := _swatches(a.colors, left.get_width(), 32)
	var sb := _swatches(b.colors, right.get_width(), 32)
	picture.blit_rect(sa, Rect2i(Vector2i.ZERO, sa.get_size()), Vector2i(0, height + 8))
	picture.blit_rect(sb, Rect2i(Vector2i.ZERO, sb.get_size()), Vector2i(left.get_width() + 8, height + 8))
	var out := _option(args, "--out", args[1].get_basename() + ".compare.png")
	picture.save_png(_path(out))
	print("LOOK_COMPARE=", JSON.stringify({"picture": out, "gaps": gaps, "concept": {"light": a.light, "colourfulness": a.colourfulness, "warmth": a.warmth}, "game": {"light": b.light, "colourfulness": b.colourfulness, "warmth": b.warmth}}))
	return true

## Colours of `from` with at least `share` of the picture and nothing within ΔE 15 in `to`.
func _unmatched(from: Array, to: Array, share: float) -> Array:
	var out := []
	for c in from:
		if c.share < share: continue
		var lab := _lab(Color.from_string(c.hex, Color.BLACK))
		var near := false
		for d in to:
			if (_lab(Color.from_string(d.hex, Color.BLACK)) - lab).length() < 15.0: near = true
		if not near: out.append("%s (%d%%)" % [c.hex, roundi(c.share * 100)])
	return out

func _fit(image: Image, height: int) -> Image:
	var copy := image.duplicate() as Image
	copy.resize(maxi(1, image.get_width() * height / image.get_height()), height, Image.INTERPOLATE_BILINEAR)
	return copy

# ---------------------------------------------------------------------------------------------
# recolor

func _recolor(args: Array) -> bool:
	if args.is_empty(): return _fail("recolor needs an image")
	var image := _load(args[0])
	if image == null: return _fail("cannot read %s" % args[0])
	var palette_path := _option(args, "--palette")
	var palette = JSON.parse_string(FileAccess.get_file_as_string(_path(palette_path))) if palette_path != "" else null
	if not palette is Dictionary or not palette.has("lab"): return _fail("recolor needs --palette <palette.json> written by `palette`")
	var out := _option(args, "--out")
	if out == "": return _fail("recolor needs --out")
	var mode := _option(args, "--mode", "transfer")
	var strength := clampf(float(_option(args, "--strength", "1")), 0.0, 1.0)
	var mapped := _transfer(image, palette) if mode == "transfer" else _gradient_map(image, palette)
	if mapped == null: return _fail("unknown mode %s" % mode)
	if strength < 1.0:
		for y in image.get_height():
			for x in image.get_width():
				mapped.set_pixel(x, y, image.get_pixel(x, y).lerp(mapped.get_pixel(x, y), strength))
	mapped.save_png(_path(out))
	var after := _describe(mapped, 8)
	print("LOOK_RECOLOR=", JSON.stringify({"output": out, "mode": mode, "colors": after.colors.map(func(c): return c.hex), "light": after.light}))
	return true

## Reinhard transfer: each Lab channel of the opaque pixels takes the palette's mean and spread.
func _transfer(image: Image, palette: Dictionary) -> Image:
	var lab := _samples(image)
	if lab.is_empty(): return image.duplicate()
	var mean := Vector3.ZERO
	for v in lab: mean += v
	mean /= lab.size()
	var spread := Vector3.ZERO
	for v in lab: spread += (v - mean) * (v - mean)
	spread = Vector3(sqrt(spread.x / lab.size()), sqrt(spread.y / lab.size()), sqrt(spread.z / lab.size()))
	var target_mean := Vector3(palette.lab.mean[0], palette.lab.mean[1], palette.lab.mean[2])
	var target_spread := Vector3(palette.lab.spread[0], palette.lab.spread[1], palette.lab.spread[2])
	var scale := Vector3(target_spread.x / maxf(spread.x, 0.5), target_spread.y / maxf(spread.y, 0.5), target_spread.z / maxf(spread.z, 0.5))
	var out := image.duplicate() as Image
	for y in image.get_height():
		for x in image.get_width():
			var c := image.get_pixel(x, y)
			if c.a == 0.0: continue
			var v := (_lab(c) - mean) * scale + target_mean
			out.set_pixel(x, y, _rgb(Vector3(clampf(v.x, 0, 100), v.y, v.z), c.a))
	return out

## Each pixel's place between the image's darkest and brightest is painted with the palette
## colour at the same place in the palette's own range of lightness.
func _gradient_map(image: Image, palette: Dictionary) -> Image:
	var ramp := []
	for c in palette.colors: ramp.append(_lab(Color.from_string(c.hex, Color.BLACK)))
	if ramp.size() < 2: return null
	ramp.sort_custom(func(a: Vector3, b: Vector3) -> bool: return a.x < b.x)
	var lights := PackedFloat32Array()
	for v in _samples(image): lights.append(v.x)
	if lights.is_empty(): return image.duplicate()
	lights.sort()
	var lo: float = lights[int(0.02 * (lights.size() - 1))]
	var hi: float = maxf(lights[int(0.98 * (lights.size() - 1))], lo + 1.0)
	var out := image.duplicate() as Image
	for y in image.get_height():
		for x in image.get_width():
			var c := image.get_pixel(x, y)
			if c.a == 0.0: continue
			var t := clampf((_lab(c).x - lo) / (hi - lo), 0.0, 1.0) * (ramp.size() - 1)
			var i := mini(int(t), ramp.size() - 2)
			out.set_pixel(x, y, _rgb((ramp[i] as Vector3).lerp(ramp[i + 1], t - i), c.a))
	return out
