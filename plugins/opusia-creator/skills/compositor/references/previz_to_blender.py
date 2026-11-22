r"""プリビズの文書を Blender で描く橋 (bpy). 手順は blender-by-hand.md の §7.

    node <previz の SKILL_DIR>/scripts/previz_sample.mjs doc.json --out frames.json
    uv run --no-project --python 3.13 --with bpy==5.3.0 \\
        python previz_to_blender.py --frames frames.json --out shot.webm \\
        [--asset <asset_id>=<GLB か画像>]... [--card <名前>=<動画か連番>]... \\
        [--font sans=<ttf>] [--text-depth 0.03] [--focus <ノード id>] \\
        [--fstop 2.0] [--glow 0.6] [--opaque] [--preview] [--engine cycles]

動き (位置・回転・大きさ・カメラ・画角・正投影の高さ・見え隠れ・不透明度 0 の
非表示・芝居の時刻・つまみ) は
`previz_sample.mjs` がプレイヤーと同じ `evaluate` で出した値を
**キーとして打つだけ**。見た目は文書の `render` (look / steps / outline /
post.bloom) を写し、被写界深度・グロー・文字の厚みは引数で足す。

座標: three.js は Y が上、Blender は Z が上。物の形は three.js のローカル座標の
まま作り、回転を q_c * q (q_c = X 軸まわり +90 度)、位置を (x, -z, y) にする。
"""

import argparse
import json
import math
import sys
from collections.abc import Callable
from dataclasses import dataclass, field
from pathlib import Path

import bpy
from mathutils import Matrix, Quaternion, Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
from blender_template import outline, render, setup, toon

Node = dict[str, object]
RGB = tuple[float, float, float]
Q_C = Quaternion((1, 0, 0), math.radians(90))
"""three.js の座標 (Y が上) → Blender (Z が上)."""
ROT_Z_TO_Y = Matrix.Rotation(math.radians(-90), 4, "X")
"""Blender の primitive の Z 軸 (円柱の軸・床の法線) を three の Y 軸へ."""
SRGB_KNEE = 0.04045
MOVIES = (".webm", ".mp4", ".mov")

ARGS = argparse.ArgumentParser()
ARGS.add_argument("--frames", required=True, help="previz_sample.mjs の出力")
ARGS.add_argument("--out", required=True)
ARGS.add_argument("--asset", action="append", default=[], help="<asset_id>=<path>")
ARGS.add_argument("--card", action="append", default=[], help="<card>=<動画か PNG>")
ARGS.add_argument("--font", action="append", default=[], help="sans|serif=<ttf>")
ARGS.add_argument("--text-depth", type=float, default=0.0, help="文字の厚み (m)")
ARGS.add_argument("--focus", help="焦点を合わせるノードの id (被写界深度)")
ARGS.add_argument("--fstop", type=float, default=2.8)
ARGS.add_argument("--glow", type=float, help="グローの強さ (文書の bloom より優先)")
ARGS.add_argument("--opaque", action="store_true", help="背景を文書の色で塗る")
ARGS.add_argument("--preview", action="store_true")
ARGS.add_argument("--engine", choices=["eevee", "cycles"], default="eevee")


@dataclass
class Inputs:
    """引数で渡された手元のファイルと、文書の見た目の層."""

    assets: dict[str, str]
    cards: dict[str, str]
    fonts: dict[str, str]
    look: dict[str, object]
    text_depth: float
    clips: dict[str, tuple[object, str]] = field(default_factory=dict)


def pairs(values: list[str], flag: str) -> dict[str, str]:
    """`<名前>=<パス>` の列を辞書にする."""
    out = {}
    for value in values:
        key, sep, path = value.partition("=")
        if not sep:
            sys.exit(f"{flag} は <名前>=<パス> で渡す: {value}")
        out[key] = path
    return out


def required(table: dict[str, str], key: object, hint: str) -> str:
    """引数で渡されたはずのファイル (無ければ何を渡すかを言って止まる)."""
    path = table.get(str(key))
    if not path:
        sys.exit(f"{hint} が無い")
    return path


def to_blender(p: list[float]) -> Vector:
    return Vector((p[0], -p[2], p[1]))


def to_rotation(q: list[float]) -> Quaternion:
    """three.js の四元数 (x, y, z, w) を、three のローカル座標で作った物の回転に."""
    return Q_C @ Quaternion((q[3], q[0], q[1], q[2]))


def linear(c: float) -> float:
    return c / 12.92 if c <= SRGB_KNEE else ((c + 0.055) / 1.055) ** 2.4


def color(hex_value: object, fallback: str = "#8899aa") -> RGB:
    """文書の色 (sRGB の #rrggbb) を Blender の材質の色 (リニア) に."""
    value = str(hex_value or fallback).lstrip("#")
    r, g, b = (linear(int(value[i : i + 2], 16) / 255) for i in (0, 2, 4))
    return (r, g, b)


def primitive(name: str, build: Callable[[], object]) -> bpy.types.Object:
    build()
    obj = bpy.context.object
    obj.name = name
    return obj


# ---- 形 (three のローカル座標で作る) ----------------------------------------


def box(node: Node) -> bpy.types.Object:
    obj = primitive(str(node["id"]), lambda: bpy.ops.mesh.primitive_cube_add(size=1))
    obj.data.transform(Matrix.Diagonal((*node["size"], 1)))
    return obj


def sphere(node: Node) -> bpy.types.Object:
    radius = node["size"]["radius"]
    return primitive(
        str(node["id"]), lambda: bpy.ops.mesh.primitive_uv_sphere_add(radius=radius)
    )


def cylinder(node: Node) -> bpy.types.Object:
    r, h = node["size"]["radius"], node["size"]["height"]
    obj = primitive(
        str(node["id"]),
        lambda: bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=h),
    )
    obj.data.transform(ROT_Z_TO_Y)
    return obj


def capsule(node: Node) -> bpy.types.Object:
    obj = cylinder(node)
    r, h = node["size"]["radius"], node["size"]["height"]
    for sign in (1, -1):
        cap = primitive(
            f"{node['id']}_cap", lambda: bpy.ops.mesh.primitive_uv_sphere_add(radius=r)
        )
        cap.data.transform(Matrix.Translation((0, sign * h / 2, 0)))
        with bpy.context.temp_override(
            active_object=obj, selected_editable_objects=[obj, cap]
        ):
            bpy.ops.object.join()
    return obj


def floor(node: Node) -> bpy.types.Object:
    obj = primitive(str(node["id"]), lambda: bpy.ops.mesh.primitive_plane_add(size=1))
    obj.data.transform(ROT_Z_TO_Y)
    w, d = node["size"]
    obj.data.transform(Matrix.Diagonal((w, 1, d, 1)))
    return obj


def board(name: str, width: float, height: float) -> bpy.types.Object:
    """立てた板 (three の XY 平面・+Z を向く = Blender の板そのまま)."""
    obj = primitive(name, lambda: bpy.ops.mesh.primitive_plane_add(size=1))
    obj.data.transform(Matrix.Diagonal((width, height, 1, 1)))
    return obj


# ---- 材質 --------------------------------------------------------------------


def emission(name: str) -> tuple[bpy.types.Material, bpy.types.Node]:
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    mat.node_tree.nodes.clear()
    out = mat.node_tree.nodes.new("ShaderNodeOutputMaterial")
    emit = mat.node_tree.nodes.new("ShaderNodeEmission")
    mat.node_tree.links.new(emit.outputs[0], out.inputs["Surface"])
    return mat, emit


def flat_material(name: str, rgb: RGB) -> bpy.types.Material:
    """光を受けない単色 (文字の板。プレイヤーと同じく陰を付けない)."""
    mat, emit = emission(name)
    emit.inputs["Color"].default_value = (*rgb, 1)
    return mat


def picture_material(name: str, image: bpy.types.Image) -> bpy.types.Material:
    """光を受けない絵の材質 (アルファで抜く)。画像の板・カード."""
    mat, emit = emission(name)
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    tex = nodes.new("ShaderNodeTexImage")
    tex.image = image
    tex.image_user.frame_duration = image.frame_duration
    tex.image_user.use_auto_refresh = True
    clear = nodes.new("ShaderNodeBsdfTransparent")
    mix = nodes.new("ShaderNodeMixShader")
    out = next(n for n in nodes if n.type == "OUTPUT_MATERIAL")
    links.new(tex.outputs["Color"], emit.inputs["Color"])
    links.new(tex.outputs["Alpha"], mix.inputs["Fac"])
    links.new(clear.outputs[0], mix.inputs[1])
    links.new(emit.outputs[0], mix.inputs[2])
    links.new(mix.outputs[0], out.inputs["Surface"])
    mat.surface_render_method = "BLENDED"
    return mat


def look_material(node: Node, look: dict[str, object]) -> bpy.types.Material:
    """文書の見た目の層 (previz / toon / flat) を写す."""
    rgb = color(node.get("color"))
    name = look.get("look", "previz")
    if name == "toon":
        return toon(str(node["id"]), rgb, steps=int(look.get("steps", 3)))
    if name == "flat":
        return flat_material(str(node["id"]), rgb)
    mat = bpy.data.materials.new(str(node["id"]))
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (*rgb, 1)
    bsdf.inputs["Roughness"].default_value = 0.8
    return mat


def load_picture(path: str) -> bpy.types.Image:
    """画像・動画・連番 PNG (名前の末尾が番号) を読む."""
    image = bpy.data.images.load(path)
    source = Path(path)
    is_sequence = source.suffix.lower() == ".png" and source.stem[-4:].isdigit()
    sources = {True: "MOVIE", False: "SEQUENCE" if is_sequence else "FILE"}
    image.source = sources[source.suffix.lower() in MOVIES]
    image.reload()
    return image


# ---- ノードの種類ごとの組み立て ----------------------------------------------

Builder = Callable[[Node, Inputs], bpy.types.Object]


def with_look(build: Callable[[Node], bpy.types.Object]) -> Builder:
    def made(node: Node, inputs: Inputs) -> bpy.types.Object:
        obj = build(node)
        obj.data.materials.append(look_material(node, inputs.look))
        return obj

    return made


def group(node: Node, _inputs: Inputs) -> bpy.types.Object:
    obj = bpy.data.objects.new(str(node["id"]), None)
    bpy.context.scene.collection.objects.link(obj)
    return obj


def image_board(node: Node, inputs: Inputs) -> bpy.types.Object:
    asset = node["asset_id"]
    path = required(inputs.assets, asset, f"--asset {asset}=<画像>")
    image = load_picture(path)
    width = float(node["width"])
    obj = board(str(node["id"]), width, width * image.size[1] / image.size[0])
    obj.data.materials.append(picture_material(str(node["id"]), image))
    return obj


def card(node: Node, inputs: Inputs) -> bpy.types.Object:
    name = node["card"]
    path = required(inputs.cards, name, f"--card {name}=<動画か PNG>")
    obj = board(str(node["id"]), *node["size"])
    obj.data.materials.append(picture_material(str(node["id"]), load_picture(path)))
    return obj


def text(node: Node, inputs: Inputs) -> bpy.types.Object:
    font_key = node.get("font", "sans")
    path = required(inputs.fonts, font_key, f"--font {font_key}=<ttf>")
    curve = bpy.data.curves.new(str(node["id"]), "FONT")
    curve.body = str(node["text"])
    curve.font = bpy.data.fonts.load(path)
    curve.size = float(node["font_size"])
    curve.space_line = 1.25
    curve.align_x = str(node.get("align", "center")).upper()
    curve.align_y = "CENTER"
    curve.extrude = inputs.text_depth / 2
    obj = bpy.data.objects.new(str(node["id"]), curve)
    bpy.context.scene.collection.objects.link(obj)
    rgb = color(node.get("color"), "#ffffff")
    obj.data.materials.append(flat_material(str(node["id"]), rgb))
    return obj


def import_glb(path: str) -> list[bpy.types.Object]:
    if path.lower().endswith(".vrm"):
        sys.exit("VRM は橋で扱わない (Blender の VRM アドオンが要る)")
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    return [obj for obj in bpy.data.objects if obj not in before]


def model(node: Node, inputs: Inputs) -> bpy.types.Object:
    """GLB を読み、three のローカル座標の空の下に置く (importer は Z 上で読む)."""
    asset = node.get("asset_id")
    imported = import_glb(required(inputs.assets, asset, f"--asset {asset}=<GLB>"))
    holder = group(node, inputs)
    local = bpy.data.objects.new(f"{node['id']}_local", None)
    bpy.context.scene.collection.objects.link(local)
    local.parent = holder
    local.rotation_mode = "QUATERNION"
    local.rotation_quaternion = Q_C.inverted()
    for obj in (o for o in imported if o.parent is None):
        obj.parent = local
    motion = node.get("motion")
    if isinstance(motion, dict):
        loop = str(motion.get("loop", "repeat"))
        inputs.clips[str(node["id"])] = (play_clip(holder, motion, inputs), loop)
    return holder


def play_clip(
    holder: bpy.types.Object, motion: dict[str, object], inputs: Inputs
) -> object:
    """芝居のクリップを NLA に置き、時刻 (strip_time) を打てるようにする."""
    clip_asset = motion.get("asset_id")
    if clip_asset:
        import_glb(required(inputs.assets, clip_asset, f"--asset {clip_asset}=<GLB>"))
    clip = str(motion["clip"])
    action = bpy.data.actions.get(clip) or next(iter(bpy.data.actions), None)
    if action is None:
        sys.exit(f"{holder.name}: クリップ {clip!r} が GLB に無い")
    kinds = ("ARMATURE", "MESH")
    target = next((o for o in holder.children_recursive if o.type in kinds), holder)
    data = target.animation_data or target.animation_data_create()
    data.action = None
    strip = data.nla_tracks.new().strips.new(clip, int(action.frame_range[0]), action)
    strip.use_animated_time = True
    return strip


BUILDERS: dict[str, Builder] = {
    "box": with_look(box),
    "sphere": with_look(sphere),
    "cylinder": with_look(cylinder),
    "capsule": with_look(capsule),
    "plane": with_look(floor),
    "group": group,
    "model": model,
    "image": image_board,
    "text": text,
    "card": card,
}
UNLIT = ("image", "card", "text")
"""プレイヤーと同じく、光を受けず輪郭線を引かない種類."""


# ---- 場面の設定 -------------------------------------------------------------


def apply_world(doc: dict[str, object]) -> bpy.types.Node:
    world = bpy.data.worlds.new("world")
    world.use_nodes = True
    background = world.node_tree.nodes["Background"]
    background.inputs["Color"].default_value = (*color(doc["world"]["background"]), 1)
    background.inputs["Strength"].default_value = 0.2
    bpy.context.scene.world = world
    return background


def add_light(
    light: dict[str, object], background: bpy.types.Node, scale: float = 1.0
) -> None:
    """Three の光を Blender の光へ (強さは目安の換算。書き出して見て直す).

    `scale` はつまみ `p3d_light` の倍率 (カット全体で固定。動かさない)。
    """
    kind, energy = light["kind"], float(light.get("intensity", 1)) * scale
    rgb = color(light.get("color"), "#ffffff")
    if kind == "hemisphere":
        background.inputs["Color"].default_value = (*rgb, 1)
        background.inputs["Strength"].default_value = 0.3 * energy
        return
    position = to_blender((light.get("transform") or {}).get("t", [0, 5, 5]))
    blender_kind = {"directional": "SUN"}.get(str(kind), str(kind).upper())
    data = bpy.data.lights.new(str(light["id"]), blender_kind)
    data.color = rgb
    data.energy = energy * (2 if kind == "directional" else 200)
    obj = bpy.data.objects.new(str(light["id"]), data)
    bpy.context.scene.collection.objects.link(obj)
    obj.location = position
    # three の光は原点を照らす
    obj.rotation_euler = (-position).to_track_quat("-Z", "Y").to_euler()


def apply_outline(scene: bpy.types.Scene, look: dict[str, object]) -> None:
    spec = look.get("outline")
    if spec is False or not (spec or look.get("look") == "toon"):
        return
    spec = spec if isinstance(spec, dict) else {}
    thickness = float(spec.get("thickness", 0.003)) * scene.render.resolution_y
    line_rgb = color(spec.get("color"), "#000000")
    outline(scene, thickness=max(thickness, 0.5), rgb=line_rgb)


def move_to(collection: bpy.types.Collection, obj: bpy.types.Object) -> None:
    for owner in list(obj.users_collection):
        owner.objects.unlink(obj)
    collection.objects.link(obj)


def keep_out_of_outline(
    scene: bpy.types.Scene, objects: list[bpy.types.Object]
) -> None:
    """板・カード・文字に輪郭線を引かない (四角い縁や字の線が出る)."""
    unlit = bpy.data.collections.new("no_outline")
    scene.collection.children.link(unlit)
    for obj in objects:
        move_to(unlit, obj)
    for lines in scene.view_layers[0].freestyle_settings.linesets:
        lines.select_by_collection = True
        lines.collection = unlit
        lines.collection_negation = "EXCLUSIVE"


def apply_glow(
    scene: bpy.types.Scene, look: dict[str, object], glow: float | None
) -> None:
    """グロー (Glare の Bloom)。文書の post.bloom か --glow."""
    bloom = (look.get("post") or {}).get("bloom") or {}
    strength = glow if glow is not None else bloom.get("intensity")
    if not strength:
        return
    # Blender 5 の合成はノードグループ (出力は Group Output の Image)
    tree = bpy.data.node_groups.new("post", "CompositorNodeTree")
    tree.interface.new_socket("Image", in_out="OUTPUT", socket_type="NodeSocketColor")
    scene.compositing_node_group = tree
    layers = tree.nodes.new("CompositorNodeRLayers")
    output = tree.nodes.new("NodeGroupOutput")
    glare = tree.nodes.new("CompositorNodeGlare")
    glare.inputs["Type"].default_value = "Bloom"
    glare.inputs["Strength"].default_value = float(strength)
    glare.inputs["Threshold"].default_value = float(bloom.get("threshold", 0.8))
    tree.links.new(layers.outputs["Image"], glare.inputs["Image"])
    tree.links.new(glare.outputs["Image"], output.inputs[0])


def make_camera(
    scene: bpy.types.Scene, focus: bpy.types.Object | None, fstop: float
) -> bpy.types.Object:
    data = bpy.data.cameras.new("camera")
    data.sensor_fit = "VERTICAL"
    camera = bpy.data.objects.new("camera", data)
    scene.collection.objects.link(camera)
    camera.rotation_mode = "QUATERNION"
    scene.camera = camera
    data.dof.use_dof = focus is not None
    data.dof.focus_object = focus
    data.dof.aperture_fstop = fstop
    return camera


# ---- コマごとのキー ----------------------------------------------------------


def key_camera(
    camera: bpy.types.Object, cam: dict, frame: int, aspect: float = 16 / 9
) -> None:
    data = camera.data
    camera.location = to_blender(cam["position"])
    camera.rotation_quaternion = to_rotation(cam["quaternion"])
    data.clip_start, data.clip_end = cam["near"], cam["far"]
    camera.keyframe_insert("location", frame=frame)
    camera.keyframe_insert("rotation_quaternion", frame=frame)
    if data.type == "ORTHO":
        # 正投影: ortho_scale は「解像度の大きい側」(sensor_fit AUTO) の長さ。
        # 文書は縦の長さ (ortho_height) なので、横長なら aspect を掛ける
        data.ortho_scale = float(cam["ortho_height"]) * max(aspect, 1.0)
        data.keyframe_insert("ortho_scale", frame=frame)
        return
    data.lens = (data.sensor_height / 2) / math.tan(math.radians(cam["fov"]) / 2)
    data.keyframe_insert("lens", frame=frame)


def key_node(obj: bpy.types.Object, state: dict, frame: int) -> None:
    obj.location = to_blender(state["position"])
    obj.rotation_quaternion = to_rotation(state["quaternion"])
    obj.scale = state["scale"]
    # 不透明度 0 は描かない (途中の値の半透明は橋では扱わない。プリビズの絵とは違う)
    obj.hide_render = not state["visible"] or state.get("opacity", 1.0) <= 0.0
    for path in ("location", "rotation_quaternion", "scale", "hide_render"):
        obj.keyframe_insert(path, frame=frame)


def key_clip(playing: tuple, seconds: float, fps: float, frame: int) -> None:
    """芝居の時刻をクリップのコマへ (repeat はクリップの長さで回す)."""
    strip, loop = playing
    start, end = strip.action.frame_range
    span = max(end - start, 1e-6)
    local = seconds * fps
    local = local % span if loop == "repeat" else min(local, span)
    strip.strip_time = start + local
    strip.keyframe_insert("strip_time", frame=frame)


def key_sample(sample: dict, objects: dict, inputs: Inputs, fps: float) -> None:
    frame = sample["frame"] + 1
    for nid, obj in objects.items():
        state = sample["nodes"][nid]
        key_node(obj, state, frame)
        if nid in inputs.clips and "motion_time" in state:
            key_clip(inputs.clips[nid], state["motion_time"], fps, frame)


def key_frames(
    sampled: dict, camera: bpy.types.Object, objects: dict, inputs: Inputs
) -> None:
    # 投影の型はキーにできない (アニメできない)。最初のコマで決め、全カット同じ型にする
    first = sampled["frames"][0]["camera"]
    camera.data.type = "ORTHO" if first.get("ortho_height") is not None else "PERSP"
    camera.data.sensor_fit = "AUTO" if camera.data.type == "ORTHO" else "VERTICAL"
    aspect = sampled["width"] / sampled["height"]
    for sample in sampled["frames"]:
        key_camera(camera, sample["camera"], sample["frame"] + 1, aspect)
        key_sample(sample, objects, inputs, sampled["fps"])


# ---- 入口 -------------------------------------------------------------------


def scene_for(options: argparse.Namespace, sampled: dict) -> bpy.types.Scene:
    scene = setup(
        argparse.Namespace(
            out=options.out,
            width=sampled["width"],
            height=sampled["height"],
            fps=sampled["fps"],
            seconds=sampled["duration"],
            preview=options.preview,
            engine=options.engine,
            transparent=not options.opaque,
        )
    )
    scene.frame_end = len(sampled["frames"])
    return scene


def build_nodes(doc: dict, inputs: Inputs) -> dict[str, bpy.types.Object]:
    nodes = [n for n in doc["nodes"] if n["kind"] in BUILDERS]
    objects = {str(n["id"]): BUILDERS[n["kind"]](n, inputs) for n in nodes}
    for obj in objects.values():
        obj.rotation_mode = "QUATERNION"
    return objects


def main() -> None:
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else sys.argv[1:]
    options = ARGS.parse_args(argv)
    sampled = json.loads(Path(options.frames).read_text())
    doc = sampled["doc"]
    inputs = Inputs(
        assets=pairs(options.asset, "--asset"),
        cards=pairs(options.card, "--card"),
        fonts=pairs(options.font, "--font"),
        look=doc.get("render") or {},
        text_depth=options.text_depth,
    )
    scene = scene_for(options, sampled)
    background = apply_world(doc)
    light_scale = float(sampled["frames"][0].get("light_scale", 1.0))
    for light in doc.get("lights", []):
        add_light(light, background, light_scale)
    apply_outline(scene, inputs.look)
    objects = build_nodes(doc, inputs)
    unlit = [objects[str(n["id"])] for n in doc["nodes"] if n["kind"] in UNLIT]
    keep_out_of_outline(scene, unlit)
    camera = make_camera(scene, objects.get(options.focus or ""), options.fstop)
    apply_glow(scene, inputs.look, options.glow)
    key_frames(sampled, camera, objects, inputs)
    render(scene)


if __name__ == "__main__":
    main()
