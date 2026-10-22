"""スクリプトが書き出した GLB と、利用者が Blender の画面で手直しして書き出した GLB を比べる。

    blender -b --factory-startup -Y --python-exit-code 1 -P glb_compare.py -- <scripted.glb> <edited.glb>

標準出力に 1 行 `GLB_COMPARE <json>` を出す。オブジェクトは名前で対応付ける。

- `center` / `size`: ワールド座標の外接箱の中心と大きさ（m）。`rotation`: オブジェクトの回転（度）。
- `size_ratio`: 手直し後 / スクリプト（軸ごと）。スクリプトの寸法に掛ければ数値に書き戻せる。
- `shape_changed`: 大きさと位置をそろえても頂点が合わない（頂点を動かした・足した・回転を適用した）。
- `writable_back`: 全部のオブジェクトが位置・大きさ・回転だけの違いで、増減も無い。
  false ならスクリプトに書き戻せないので、手で仕上げた GLB として扱う（SKILL.md §5）。
"""

import json
import math
import sys

import bpy

TOLERANCE = 1e-3


def round_all(values, digits=4):
    # -0.0 を 0 にそろえる（JSON の比較で食い違わないように）
    return [round(value, digits) + 0.0 for value in values]


def bounds(points):
    if not points:
        return [0.0, 0.0, 0.0], [0.0, 0.0, 0.0]
    low = [min(p[axis] for p in points) for axis in range(3)]
    high = [max(p[axis] for p in points) for axis in range(3)]
    return (
        [(low[axis] + high[axis]) / 2 for axis in range(3)],
        [high[axis] - low[axis] for axis in range(3)],
    )


def normalized_shape(points):
    """外接箱で中心と大きさをそろえた頂点（並び順に依らない）。"""
    center, size = bounds(points)
    return sorted(
        tuple(
            round((p[axis] - center[axis]) / size[axis], 3)
            if size[axis] > TOLERANCE
            else 0.0
            for axis in range(3)
        )
        for p in points
    )


def describe(path):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=path)
    objects = {}
    for obj in bpy.context.scene.objects:
        entry = {
            "type": obj.type,
            "rotation": round_all(math.degrees(angle) for angle in obj.rotation_euler),
        }
        if obj.type == "MESH":
            local = [tuple(v.co) for v in obj.data.vertices]
            world = [tuple(obj.matrix_world @ v.co) for v in obj.data.vertices]
            center, size = bounds(world)
            entry.update(
                vertices=len(local),
                center=round_all(center),
                size=round_all(size),
                shape=normalized_shape(local),
            )
        else:
            entry.update(
                center=round_all(obj.matrix_world.translation), size=[0.0, 0.0, 0.0]
            )
        objects[obj.name] = entry
    return objects


def differs(a, b):
    return any(abs(x - y) > TOLERANCE for x, y in zip(a, b, strict=True))


def compare(scripted, edited):
    objects = {}
    for name in sorted(scripted.keys() & edited.keys()):
        before, after = scripted[name], edited[name]
        shape_changed = before.get("vertices") != after.get("vertices") or (
            before.get("shape") != after.get("shape")
        )
        ratio = [
            round(a / b, 4) if b > TOLERANCE else None
            for a, b in zip(after["size"], before["size"], strict=True)
        ]
        changed = (
            shape_changed
            or differs(before["center"], after["center"])
            or differs(before["size"], after["size"])
            or differs(before["rotation"], after["rotation"])
        )
        public = ("type", "vertices", "center", "size", "rotation")
        objects[name] = {
            "changed": changed,
            "shape_changed": shape_changed,
            "size_ratio": ratio,
            "scripted": {key: before[key] for key in public if key in before},
            "edited": {key: after[key] for key in public if key in after},
        }
    only_in_scripted = sorted(scripted.keys() - edited.keys())
    only_in_edited = sorted(edited.keys() - scripted.keys())
    return {
        "objects": objects,
        "only_in_scripted": only_in_scripted,
        "only_in_edited": only_in_edited,
        "writable_back": not only_in_scripted
        and not only_in_edited
        and not any(entry["shape_changed"] for entry in objects.values()),
    }


def main():
    args = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    if len(args) != 2:
        raise SystemExit("usage: -- <scripted.glb> <edited.glb>")
    report = compare(describe(args[0]), describe(args[1]))
    print("GLB_COMPARE " + json.dumps(report, ensure_ascii=False))


main()
