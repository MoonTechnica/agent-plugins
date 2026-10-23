extends SceneTree
## Image resizing for machines without ImageMagick (the hosted Sandbox has `convert`; a creator's
## machine may not). Build-time only: nothing here ships in the game. Reads and writes files
## directly, so no import step and no GPU are needed. The output format follows the extension
## (.png / .jpg / .jpeg / .webp).
##
##   godot --headless -s <tool> -- fit <in> <out> --max 1024 [--quality 85]
##       shrink to fit inside max×max (never enlarges), keep the aspect ratio
##   godot --headless -s <tool> -- cover <in> <out> --size 1600x1000 [--quality 85]
##       scale to cover WxH, then crop the centre (like `-resize WxH^ -gravity center -extent WxH`)
##
## Prints IMAGE_RESULT={"output", "width", "height"} on success and exits 1 on failure.

func _initialize() -> void:
	var args := OS.get_cmdline_user_args()
	var ok := false
	if args.size() >= 3 and args[0] in ["fit", "cover"]:
		ok = _run(args[0], args[1], args[2], args.slice(3))
	else:
		printerr("usage: image.gd -- fit <in> <out> --max N | cover <in> <out> --size WxH [--quality Q]")
	quit(0 if ok else 1)

func _option(args: Array, name: String, fallback: String) -> String:
	var at := args.find(name)
	return args[at + 1] if at >= 0 and at + 1 < args.size() else fallback

func _run(command: String, source: String, output: String, args: Array) -> bool:
	var image := Image.load_from_file(source)
	if image == null or image.is_empty():
		printerr("image.gd: cannot read ", source)
		return false
	if image.is_compressed(): image.decompress()
	image.convert(Image.FORMAT_RGBA8)
	if command == "fit":
		var longest := int(_option(args, "--max", "1024"))
		var scale := minf(1.0, float(longest) / maxi(image.get_width(), image.get_height()))
		if scale < 1.0:
			image.resize(maxi(1, roundi(image.get_width() * scale)), maxi(1, roundi(image.get_height() * scale)), Image.INTERPOLATE_LANCZOS)
	else:
		var size := _option(args, "--size", "").split("x")
		if size.size() != 2 or int(size[0]) < 1 or int(size[1]) < 1:
			printerr("image.gd: cover needs --size WxH")
			return false
		var target := Vector2i(int(size[0]), int(size[1]))
		var scale := maxf(float(target.x) / image.get_width(), float(target.y) / image.get_height())
		image.resize(maxi(target.x, ceili(image.get_width() * scale)), maxi(target.y, ceili(image.get_height() * scale)), Image.INTERPOLATE_LANCZOS)
		image = image.get_region(Rect2i((image.get_size() - target) / 2, target))
	return _save(image, output, clampf(float(_option(args, "--quality", "85")) / 100.0, 0.01, 1.0))

func _save(image: Image, output: String, quality: float) -> bool:
	DirAccess.make_dir_recursive_absolute(output.get_base_dir())
	var err := OK
	match output.get_extension().to_lower():
		"jpg", "jpeg":
			image.convert(Image.FORMAT_RGB8)
			err = image.save_jpg(output, quality)
		"webp": err = image.save_webp(output, true, quality)
		"png": err = image.save_png(output)
		_:
			printerr("image.gd: write .png, .jpg or .webp, not ", output)
			return false
	if err != OK:
		printerr("image.gd: cannot write ", output, " (", error_string(err), ")")
		return false
	print("IMAGE_RESULT=", JSON.stringify({"output": output, "width": image.get_width(), "height": image.get_height()}))
	return true
