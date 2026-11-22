"""Blender (bpy) の演出の型. 手順と決まりは blender-by-hand.md.

動かし方 (エージェントの作業環境で。Python 3.13 と bpy 5.3.0 を uv が用意する):

    uv run --no-project --python 3.13 --with bpy==5.3.0 \
        python blender_template.py --out <出力の .webm> --width 1920 --height 1080 \
        --fps 24 --seconds 4 [--preview]

書き換えるのは `build()` の中だけ (場面・動き・光・カメラ)。それ以外 (書き出しの形・
物理の焼き込み・日時を書かない・トゥーンと輪郭線の作り方) は触らない。
2026-11-11 に Apple Silicon の Mac で検証: EEVEE・剛体の物理・Freestyle の輪郭線・
VP9 + アルファの WebM を直に書き出し、HyperFrames の <video> で背景の 2D が透けた。
"""

import argparse
import math
import random
import time
from pathlib import Path

import bpy

ARGS = argparse.ArgumentParser()
ARGS.add_argument("--out", required=True)
ARGS.add_argument("--width", type=int, default=1920)
ARGS.add_argument("--height", type=int, default=1080)
ARGS.add_argument("--fps", type=int, default=24)
ARGS.add_argument("--seconds", type=float, default=4)
ARGS.add_argument("--preview", action="store_true", help="半分の解像度で試す")
ARGS.add_argument(
    "--engine",
    choices=["eevee", "cycles"],
    default="eevee",
    help="cycles は EEVEE が起動しない環境の逃げ道 (トゥーンは平らな塗りになる)",
)


# ---- 型 (触らない) ----------------------------------------------------------


def setup(args: argparse.Namespace) -> bpy.types.Scene:
    """空の場面と書き出しの設定 (透過の WebM・日時を書かない・EEVEE)."""
    bpy.ops.wm.read_factory_settings(use_empty=True)
    random.seed(0)  # 乱数は種を決める (書き出すたびに同じ絵)
    scene = bpy.context.scene
    engine = getattr(args, "engine", "eevee")
    scene.render.engine = "CYCLES" if engine == "cycles" else "BLENDER_EEVEE"
    if engine == "cycles":
        scene.cycles.device = "CPU"
        scene.cycles.samples = 16
        scene.cycles.use_denoising = True
    scale = 0.5 if args.preview else 1
    scene.render.resolution_x = round(args.width * scale)
    scene.render.resolution_y = round(args.height * scale)
    scene.render.fps = args.fps
    scene.frame_start = 1
    scene.frame_end = round(args.seconds * args.fps)
    # 背景を描かない (composition の 2D の上に重ねる)
    scene.render.film_transparent = getattr(args, "transparent", True)
    scene.render.image_settings.media_type = "VIDEO"
    scene.render.image_settings.file_format = "FFMPEG"
    scene.render.ffmpeg.format = "WEBM"
    scene.render.ffmpeg.codec = "WEBM"
    scene.render.ffmpeg.constant_rate_factor = "HIGH"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.filepath = args.out
    scene.render.use_file_extension = False
    for flag in ("use_stamp_date", "use_stamp_time", "use_stamp_render_time"):
        setattr(scene.render, flag, False)
    return scene


RGB = tuple[float, float, float]


def toon(
    name: str, rgb: RGB, shade: float = 0.35, steps: int = 2
) -> bpy.types.Material:
    """セル調の材質 (Shader to RGB + 段の色ランプ)。shade は影の明るさ、steps は段数.

    Shader to RGB は EEVEE だけのもの。Cycles では光を受けない平らな塗りにする.
    """
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    nodes.clear()
    out = nodes.new("ShaderNodeOutputMaterial")
    emit = nodes.new("ShaderNodeEmission")
    if bpy.context.scene.render.engine == "CYCLES":
        emit.inputs["Color"].default_value = (*rgb, 1)
        links.new(emit.outputs[0], out.inputs["Surface"])
        return mat
    diffuse = nodes.new("ShaderNodeBsdfDiffuse")
    diffuse.inputs["Color"].default_value = (*rgb, 1)
    to_rgb = nodes.new("ShaderNodeShaderToRGB")
    ramp = nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.interpolation = "CONSTANT"
    shade_steps(ramp.color_ramp, rgb, shade, steps)
    links.new(diffuse.outputs[0], to_rgb.inputs[0])
    links.new(to_rgb.outputs["Color"], ramp.inputs["Fac"])
    links.new(ramp.outputs["Color"], emit.inputs["Color"])
    links.new(emit.outputs[0], out.inputs["Surface"])
    return mat


def shade_steps(ramp: bpy.types.ColorRamp, rgb: RGB, shade: float, steps: int) -> None:
    """段の色ランプ: 暗い (shade) → 明るい (1) を steps 段に等分する."""
    for _ in range(max(steps, 2) - 2):
        ramp.elements.new(0.5)
    last = len(ramp.elements) - 1
    for index, element in enumerate(ramp.elements):
        level = shade + (1 - shade) * index / last
        element.position = 0.35 + 0.5 * (index - 1) / last if index else 0.0
        element.color = (rgb[0] * level, rgb[1] * level, rgb[2] * level, 1)


def outline(
    scene: bpy.types.Scene, thickness: float = 1.5, rgb: RGB = (0.08, 0.08, 0.12)
) -> None:
    """輪郭線 (Freestyle)。線のセットを自分で作る (無いと線が 1 本も出ない)."""
    scene.render.use_freestyle = True
    scene.render.line_thickness = thickness
    layer = scene.view_layers[0]
    layer.use_freestyle = True
    lines = layer.freestyle_settings.linesets.new("outline")
    lines.select_by_visibility = True
    lines.select_silhouette = True
    lines.select_border = True
    lines.select_crease = False
    lines.linestyle.color = rgb


def previz_camera(
    scene: bpy.types.Scene, position: RGB, target: RGB, fov_deg: float
) -> bpy.types.Object:
    """プリビズ (three.js、Y が上) の位置と縦の画角で Blender のカメラを置く.

    座標は (x, y, z) → (x, -z, y)。画角は sensor_fit = VERTICAL で
    lens = (sensor_h / 2) / tan(fov / 2)。
    """

    def to_blender(p: RGB) -> RGB:
        return (p[0], -p[2], p[1])

    bpy.ops.object.camera_add(location=to_blender(position))
    camera = bpy.context.object
    camera.data.sensor_fit = "VERTICAL"
    half = math.radians(fov_deg) / 2
    camera.data.lens = (camera.data.sensor_height / 2) / math.tan(half)
    aim = bpy.data.objects.new("aim", None)
    aim.location = to_blender(target)
    scene.collection.objects.link(aim)
    track = camera.constraints.new("TRACK_TO")
    track.target = aim
    track.track_axis = "TRACK_NEGATIVE_Z"
    track.up_axis = "UP_Y"
    scene.camera = camera
    return camera


def render(scene: bpy.types.Scene) -> None:
    """物理を焼いてから書き出す (焼かないと区間ごとの書き出しで結果が変わる)."""
    if scene.rigidbody_world:
        scene.rigidbody_world.point_cache.frame_end = scene.frame_end
    bpy.ops.ptcache.bake_all(bake=True)
    start = time.time()
    bpy.ops.render.render(animation=True)
    took = time.time() - start
    print(
        f"RENDERED {scene.frame_end} frames in {took:.1f}s -> {scene.render.filepath}"
    )


# ---- 書き換えるのはここ -----------------------------------------------------


def build(scene: bpy.types.Scene) -> None:
    """場面・動き・光・カメラ。例: 横から転がる球が積み木の塔を崩す."""
    outline(scene)
    bpy.ops.mesh.primitive_plane_add(size=6)
    bpy.context.object.data.materials.append(toon("floor", (0.25, 0.25, 0.32)))
    bpy.ops.rigidbody.object_add(type="PASSIVE")

    colors = [
        (0.95, 0.55, 0.25),
        (0.35, 0.6, 0.98),
        (0.98, 0.85, 0.3),
        (0.9, 0.35, 0.6),
    ]
    mats = [toon(f"c{i}", c) for i, c in enumerate(colors)]
    for level in range(8):
        for i in range(8):
            x, y = (i % 4) * 0.42 - 0.63, (i // 4) * 0.42 - 0.21
            location = (x, y, 0.2 + level * 0.41)
            bpy.ops.mesh.primitive_cube_add(size=0.4, location=location)
            bpy.context.object.data.materials.append(mats[(level + i) % len(mats)])
            bpy.ops.rigidbody.object_add(type="ACTIVE")

    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.5, location=(-6, 0, 0.6))
    ball = bpy.context.object
    ball.data.materials.append(toon("ball", (0.9, 0.9, 0.95)))
    bpy.ops.rigidbody.object_add(type="ACTIVE")
    ball.rigid_body.mass = 20
    # 動かすところまではキー (kinematic)、ぶつかる所から物理に渡す
    ball.rigid_body.kinematic = True
    ball.keyframe_insert("location", frame=1)
    ball.location.x = 0
    ball.keyframe_insert("location", frame=10)
    ball.rigid_body.keyframe_insert("kinematic", frame=10)
    ball.rigid_body.kinematic = False
    ball.rigid_body.keyframe_insert("kinematic", frame=11)

    bpy.ops.object.light_add(type="SUN", rotation=(0.8, 0.2, 0.6))
    bpy.context.object.data.energy = 3
    previz_camera(scene, position=(7, 4.5, 7), target=(0, 1, 0), fov_deg=35)


if __name__ == "__main__":
    import sys

    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else sys.argv[1:]
    options = ARGS.parse_args(argv)
    Path(options.out).parent.mkdir(parents=True, exist_ok=True)
    the_scene = setup(options)
    build(the_scene)
    render(the_scene)
