# tokoyo recipe: foliage for Godot (grass clump + leaf-card tree) -> GLB
# Run: blender -b --factory-startup -Y --python-exit-code 1 -P foliage_recipe.py
# Contracts with the Kit's nature shaders (skills/game-art-direction/assets/nature/):
#   grass  : origin at the root, UV.y 0 at the root -> 1 at the tip (glTF V is flipped by the exporter,
#            so the script writes Blender V = 1 - height), normals all pointing up (Normal Edit, DIRECTIONAL).
#   foliage: colour attribute "wind" (R: 0 trunk base -> 1 outer leaves) exported as COLOR_0,
#            leaf normals from the crown ellipsoid (Normal Edit, RADIAL), alpha = mask (rounded alpha).
import math
import os
import random

import bpy

OUT = os.environ.get("OUT", os.path.join(os.path.dirname(os.path.abspath(__file__)), "out"))
# Optional RGBA leaf-cluster PNG: $LEAF_TEXTURE, else leaves.png among the run's inputs ($INPUTS).
LEAF_TEXTURE = os.environ.get("LEAF_TEXTURE") or os.path.join(os.environ.get("INPUTS", ""), "leaves.png")
if not os.path.isfile(LEAF_TEXTURE):
    LEAF_TEXTURE = ""
SETTINGS = {
    "seed": 7,
    "grass": {"blades": 7, "radius": 0.18, "height": 0.45, "width": 0.05},
    "tree": {"height": 5.0, "crown_radius": 1.8, "cards": 70, "trunk_sides": 7},
}

bpy.ops.wm.read_factory_settings(use_empty=True)
random.seed(SETTINGS["seed"])
os.makedirs(OUT, exist_ok=True)


def mesh_object(name, verts, faces, uvs=None):
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    if uvs is not None:
        layer = mesh.uv_layers.new(name="UVMap")
        for poly in mesh.polygons:
            for li in poly.loop_indices:
                layer.data[li].uv = uvs[mesh.loops[li].vertex_index]
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    return obj


def material(name, color, alpha_image=None, double_sided=True):
    mat = bpy.data.materials.new(name)
    mat.use_backface_culling = not double_sided  # exporter: doubleSided = not backface culling
    nodes = mat.node_tree.nodes
    bsdf = nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (*color, 1.0)
    bsdf.inputs["Roughness"].default_value = 0.85
    if alpha_image:
        tex = nodes.new("ShaderNodeTexImage")
        tex.image = bpy.data.images.load(alpha_image)
        # Round the alpha so the exporter writes alphaMode MASK (cut-out), never BLEND.
        rnd = nodes.new("ShaderNodeMath")
        rnd.operation = "ROUND"
        mat.node_tree.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
        mat.node_tree.links.new(tex.outputs["Alpha"], rnd.inputs[0])
        mat.node_tree.links.new(rnd.outputs[0], bsdf.inputs["Alpha"])
    return mat


def normal_edit(obj, mode, target=None, offset=(0, 0, 0)):
    mod = obj.modifiers.new("normals", "NORMAL_EDIT")
    mod.mode = mode
    mod.offset = offset
    if target is not None:
        mod.target = target
        mod.use_direction_parallel = True
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=mod.name)


def wind_attribute(obj, weight_of):
    attr = obj.data.color_attributes.new("wind", "BYTE_COLOR", "CORNER")
    for loop in obj.data.loops:
        w = max(0.0, min(1.0, weight_of(obj.data.vertices[loop.vertex_index].co)))
        attr.data[loop.index].color = (w, 0.0, 0.0, 1.0)
    obj.data.color_attributes.active_color = attr


def export(objs, path):
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.ops.export_scene.gltf(
        filepath=os.path.join(OUT, path), export_format="GLB", use_selection=True,
        export_apply=True, export_normals=True,
        # The default MATERIAL only exports colours the material uses; the wind mask is data.
        export_vertex_color="ACTIVE",
    )


# --- grass clump --------------------------------------------------------------------------
g = SETTINGS["grass"]
verts, faces, uvs = [], [], []
rows = [0.0, 0.35, 0.7]
for b in range(g["blades"]):
    a = random.random() * math.tau
    r = g["radius"] * math.sqrt(random.random())
    base = (math.cos(a) * r, math.sin(a) * r)
    yaw = random.random() * math.tau
    side = (math.cos(yaw), math.sin(yaw))
    lean = (-side[1] * random.uniform(0.05, 0.25), side[0] * random.uniform(0.05, 0.25))
    h = g["height"] * random.uniform(0.65, 1.15)
    w = g["width"] * random.uniform(0.8, 1.2)
    start = len(verts)
    for t in rows:
        half = w * (1 - t * 0.85) / 2
        cx, cy = base[0] + lean[0] * h * t * t, base[1] + lean[1] * h * t * t
        verts += [(cx - side[0] * half, cy - side[1] * half, t * h), (cx + side[0] * half, cy + side[1] * half, t * h)]
        uvs += [(0.0, 1.0 - t), (1.0, 1.0 - t)]
    verts.append((base[0] + lean[0] * h, base[1] + lean[1] * h, h))
    uvs.append((0.5, 0.0))
    for k in range(2):
        i = start + k * 2
        faces.append((i, i + 1, i + 3, i + 2))
    faces.append((start + 4, start + 5, start + 6))
grass = mesh_object("GrassClump", verts, faces, uvs)
grass.data.materials.append(material("Grass", (0.3, 0.5, 0.18)))
up = bpy.data.objects.new("Up", None)
bpy.context.collection.objects.link(up)
up.location = (0, 0, 1000)
normal_edit(grass, "DIRECTIONAL", target=up)
export([grass], "grass_clump.glb")

# --- tree: trunk + leaf cards -------------------------------------------------------------
t = SETTINGS["tree"]
height, crown_r = t["height"], t["crown_radius"]
crown = (0.0, 0.0, height - crown_r * 0.9)
sides = t["trunk_sides"]
tv, tf = [], []
for s in range(sides):
    a = math.tau * s / sides
    tv += [(math.cos(a) * height * 0.045, math.sin(a) * height * 0.045, 0.0),
        (math.cos(a) * height * 0.022, math.sin(a) * height * 0.022, height * 0.55)]
for s in range(sides):
    a, b = s * 2, ((s + 1) % sides) * 2
    tf.append((a, b, b + 1, a + 1))
trunk = mesh_object("Trunk", tv, tf, [(0, 0)] * len(tv))
trunk.data.materials.append(material("Bark", (0.28, 0.19, 0.12), double_sided=False))
wind_attribute(trunk, lambda p: p.z / height * 0.3)

lv, lf, luv = [], [], []
for c in range(t["cards"]):
    d = [random.uniform(-1, 1), random.uniform(-1, 1), random.uniform(-0.6, 1)]
    n = math.sqrt(sum(x * x for x in d)) or 1.0
    dist = crown_r * random.random() ** 0.4
    centre = (crown[0] + d[0] / n * dist, crown[1] + d[1] / n * dist, crown[2] + d[2] / n * dist * 0.8)
    size = crown_r * random.uniform(0.55, 0.85) / 2
    yaw = random.random() * math.tau
    for cross in (0.0, math.pi / 2):
        ax = (math.cos(yaw + cross) * size, math.sin(yaw + cross) * size)
        i = len(lv)
        lv += [(centre[0] - ax[0], centre[1] - ax[1], centre[2] - size), (centre[0] + ax[0], centre[1] + ax[1], centre[2] - size),
            (centre[0] + ax[0], centre[1] + ax[1], centre[2] + size), (centre[0] - ax[0], centre[1] - ax[1], centre[2] + size)]
        luv += [(0, 0), (1, 0), (1, 1), (0, 1)]
        lf.append((i, i + 1, i + 2, i + 3))
leaves = mesh_object("Leaves", lv, lf, luv)
leaves.data.materials.append(material("Leaves", (0.35, 0.55, 0.22), LEAF_TEXTURE or None))
wind_attribute(leaves, lambda p: 0.35 + math.dist(p, crown) / crown_r * 0.65)
# Radial: normals from the crown ellipsoid (its bounding box), so the crown shades as one soft volume.
normal_edit(leaves, "RADIAL")

bpy.ops.object.select_all(action="DESELECT")
for o in (trunk, leaves):
    o.select_set(True)
bpy.context.view_layer.objects.active = trunk
bpy.ops.object.join()
trunk.name = "Tree"
export([trunk], "tree.glb")
print("RECIPE_OK", OUT)
