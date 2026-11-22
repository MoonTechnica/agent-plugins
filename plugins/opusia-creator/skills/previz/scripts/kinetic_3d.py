"""3D キネティックタイポグラフィのキーを計算する (previz スキル).

標準ライブラリだけで動く.

文字の板 (`kind: text`) を語・字ごとに置き、位置・回転・不透明度のキーを
**時刻の純関数**として作る。乱数は seed 付き (同じ seed なら同じ出力)。
出力は `patch_previz_scene` の
`{"op": "add", "path": "/nodes/-", "value": <ノード>}` の列 (`--ops`) か、ノードの配列。
レシピの意味・数値の根拠は references/kinetic-typography-3d.md、
docs/_research/2026-11-16-kinetic-typography-3d.md。

  tunnel   語を奥行きに並べ、カメラがその間を通り抜ける (各語の手前で減速して静止)
  scatter  字を seed 付きで散らし、本来の位置へ組み上げる
  bounce   語を落として減衰するバウンス (解析式。着地で潰れる。接触影つき)
  flip     字ごとに時間差で 360° 回る (stagger)
  ring     字を円筒の外面に並べ、ゆっくり自転させる (裏は消す)
  shake    カメラの位置のキーに減衰するシェイクを作る (ロールしない)
  fill     語が画面を満たすカメラ距離 (マッチカット用)
  width    文字列の板の幅 (m) の見積り (配置の計画用)

座標は m、カメラは -Z 前方・+Y 上、板は +Z を向く (カメラが +Z 側から見る)。
キーの `ease` は**そのキーへ到達する区間**に効く (camera-moves.md §2.1)。
"""

# ruff: noqa: C901, PLR0913, PLR0915
# (サブコマンドごとに引数と分岐が多い CLI。camera_math.py と同じ型で、関数は小さく保つ)

from __future__ import annotations

import argparse
import json
import math
import sys
import unicodedata
from collections.abc import Callable
from typing import Any, NoReturn

# 板の字幅 (1 = 文字の高さ)。全角は 1、半角は 0.56、空白は 0.3
# プレイヤーの板の計測に近い目安。
WIDE_ADVANCE = 1.0
NARROW_ADVANCE = 0.56
SPACE_ADVANCE = 0.3
VEC3_SIZE = 3
LINE_HEIGHT = 1.25  # schema: 行の間隔は 1 文字の高さの 1.25 倍


def fail(message: str) -> NoReturn:
    raise SystemExit(message)


def rnd(value: float, digits: int = 4) -> float:
    return round(value, digits)


# ---------------------------------------------------------------- 乱数 (seed 付き)


def mulberry32(seed: int) -> Callable[[], float]:
    """小さな seed 付き PRNG。呼び出し順に依存させないため、字ごとに別の seed で作る."""
    state = seed & 0xFFFFFFFF

    def next_value() -> float:
        nonlocal state
        state = (state + 0x6D2B79F5) & 0xFFFFFFFF
        t = state
        t = ((t ^ (t >> 15)) * (t | 1)) & 0xFFFFFFFF
        t ^= (t + (((t ^ (t >> 7)) * (t | 61)) & 0xFFFFFFFF)) & 0xFFFFFFFF
        return ((t ^ (t >> 14)) & 0xFFFFFFFF) / 4294967296

    return next_value


def glyph_rng(seed: int, index: int) -> Callable[[], float]:
    return mulberry32(seed * 1000003 + index * 7919 + 17)


# ---------------------------------------------------------------- 四元数


def quat_axis_angle(axis: str, degrees: float) -> list[float]:
    half = math.radians(degrees) / 2
    s, c = math.sin(half), math.cos(half)
    return {"x": [s, 0, 0, c], "y": [0, s, 0, c], "z": [0, 0, s, c]}[axis]


def quat_mul(a: list[float], b: list[float]) -> list[float]:
    ax, ay, az, aw = a
    bx, by, bz, bw = b
    return [
        aw * bx + ax * bw + ay * bz - az * by,
        aw * by - ax * bz + ay * bw + az * bx,
        aw * bz + ax * by - ay * bx + az * bw,
        aw * bw - ax * bx - ay * by - az * bz,
    ]


def quat_euler(x_deg: float, y_deg: float, z_deg: float) -> list[float]:
    """XYZ の順 (X を先に回す) のオイラー角 → 四元数 [x, y, z, w]."""
    q = quat_mul(quat_axis_angle("y", y_deg), quat_axis_angle("x", x_deg))
    return quat_mul(quat_axis_angle("z", z_deg), q)


def qround(q: list[float]) -> list[float]:
    return [rnd(c, 5) for c in q]


# ---------------------------------------------------------------- 文字の寸法


def advance(char: str) -> float:
    if char.isspace():
        return SPACE_ADVANCE
    return (
        WIDE_ADVANCE
        if unicodedata.east_asian_width(char) in ("W", "F")
        else NARROW_ADVANCE
    )


def text_width(text: str, size: float) -> float:
    """1 行の板の幅 (m)。改行を含めば一番長い行."""
    return max(
        (sum(advance(c) for c in line) * size for line in text.split("\n")), default=0
    )


def glyph_layout(text: str, size: float) -> list[tuple[str, float]]:
    """1 行を字ごとに並べる: (字, 中心の x)。空白は飛ばす (板を作らない)."""
    total = sum(advance(c) for c in text) * size
    cursor = -total / 2
    placed: list[tuple[str, float]] = []
    for char in text:
        width = advance(char) * size
        if not char.isspace():
            placed.append((char, cursor + width / 2))
        cursor += width
    return placed


# ---------------------------------------------------------------- ノードの組み立て


def text_node(
    node_id: str,
    text: str,
    *,
    size: float,
    position: list[float],
    rotation: list[float] | None = None,
    weight: int = 700,
    font: str = "sans",
    color: str = "#ffffff",
    keys: dict[str, Any] | None = None,
) -> dict[str, Any]:
    node: dict[str, Any] = {
        "id": node_id,
        "kind": "text",
        "text": text,
        "font_size": rnd(size),
        "font": font,
        "weight": weight,
        "align": "center",
        "color": color,
        "transform": {
            "t": [rnd(c) for c in position],
            "r": qround(rotation or [0, 0, 0, 1]),
            "s": [1, 1, 1],
        },
        "visible": True,
    }
    if keys:
        node["keys"] = keys
    return node


def key(t: float, value: Any, ease: str | None = None) -> dict[str, Any]:  # noqa: ANN401
    item: dict[str, Any] = {"t": rnd(t), "v": value}
    if ease:
        item["ease"] = ease
    return item


def emit(
    args: argparse.Namespace, nodes: list[dict[str, Any]], extra: dict[str, Any]
) -> dict[str, Any]:
    result: dict[str, Any] = dict(extra)
    if args.ops:
        result["ops"] = [
            {"op": "add", "path": "/nodes/-", "value": node} for node in nodes
        ]
    else:
        result["nodes"] = nodes
    result["node_count"] = len(nodes)
    return result


def check_text(args: argparse.Namespace) -> list[str]:
    words = [w for w in args.words if w.strip()]
    if not words:
        fail("--words に 1 つ以上の語が要る")
    return words


# ---------------------------------------------------------------- tunnel


def cmd_tunnel(args: argparse.Namespace) -> dict[str, Any]:
    words = check_text(args)
    spacing = args.size * args.spacing
    nodes: list[dict[str, Any]] = []
    camera: list[dict[str, Any]] = []
    t_arrive = args.t0
    first_z = args.camera_distance
    camera.append(key(max(0.0, args.t0 - args.per_word), [0, args.y, first_z]))
    for i, word in enumerate(words):
        rng = glyph_rng(args.seed, i)
        z = -i * spacing
        x = (rng() * 2 - 1) * args.size * args.jitter
        y = args.y + (rng() * 2 - 1) * args.size * args.jitter
        roll = (rng() * 2 - 1) * args.roll_max
        opacity_keys = None
        if args.fade_in:
            # 奥の語は到着の少し前に現れる。フォグが無いので不透明度で代える。
            opacity_keys = [
                key(max(0.0, t_arrive - 2 * args.per_word), 0.0),
                key(max(0.01, t_arrive - 0.6 * args.per_word), 1.0, "ease-out"),
            ]
        node_keys = {"opacity": opacity_keys} if opacity_keys else None
        nodes.append(
            text_node(
                f"{args.id_prefix}{i + 1}",
                word,
                size=args.size,
                position=[x, y, z],
                rotation=quat_axis_angle("z", roll),
                color=args.color,
                weight=args.weight,
                keys=node_keys,
            )
        )
        cam = [x * 0.7, y, z + args.camera_distance]
        camera.append(key(t_arrive, cam, "ease-in-out"))
        camera.append(key(t_arrive + args.hold, cam))
        t_arrive += args.per_word
    return emit(
        args,
        nodes,
        {
            "camera_translation": camera,
            "end": rnd(t_arrive - args.per_word + args.hold),
            "note": "camera は cuts[i].camera.keys.translation へ。"
            "向きは固定 (ロールしない)。fov は 55〜65 度を推奨。"
            "DOF・フォグは無いので opacity で奥を溶かしてある。",
        },
    )


# ---------------------------------------------------------------- scatter


def cmd_scatter(args: argparse.Namespace) -> dict[str, Any]:
    layout = glyph_layout(args.text, args.size)
    nodes: list[dict[str, Any]] = []
    cx, cy, cz = args.center
    radius = args.size * args.radius
    end = args.t0
    for i, (char, dx) in enumerate(layout):
        rng = glyph_rng(args.seed, i)
        scattered = [
            cx + dx + (rng() * 2 - 1) * radius,
            cy + (rng() * 2 - 1) * radius,
            cz + (rng() * 2 - 1) * radius,
        ]
        spin = quat_euler(*[(rng() * 2 - 1) * args.rot for _ in range(3)])
        delay = i * args.stagger
        land = args.t0 + delay + args.assemble
        end = max(end, land)
        final = [cx + dx, cy, cz]
        keys = {
            "translation": [
                key(args.t0, [rnd(c) for c in scattered]),
                key(land, final, "ease-out"),
            ],
            "rotation": [
                key(args.t0, qround(spin)),
                key(land, [0, 0, 0, 1], "ease-out"),
            ],
            "opacity": [key(args.t0, 0.0), key(args.t0 + delay + 0.15, 1.0)],
        }
        nodes.append(
            text_node(
                f"{args.id_prefix}{i + 1}",
                char,
                size=args.size,
                position=final,
                color=args.color,
                weight=args.weight,
                keys=keys,
            )
        )
    return emit(
        args,
        nodes,
        {"end": rnd(end), "note": "最終フレームで本来の位置・向きに厳密に一致する。"},
    )


# ---------------------------------------------------------------- bounce


def bounce_samples(
    height: float, restitution: float, bounces: int, gravity: float, per_arc: int
) -> list[tuple[float, float, bool]]:
    """(経過秒, 高さ, 着地か) を返す。最初は落下、以降は減衰する放物線."""
    points: list[tuple[float, float, bool]] = []
    t = 0.0
    fall = math.sqrt(2 * height / gravity)
    for i in range(per_arc + 1):
        u = i / per_arc
        points.append((t + u * fall, height * (1 - u * u), i == per_arc))
    t += fall
    h = height
    for _ in range(bounces):
        h *= restitution
        arc = 2 * math.sqrt(2 * h / gravity)
        for i in range(1, per_arc + 1):
            u = i / per_arc
            points.append((t + u * arc, h * (1 - (2 * u - 1) ** 2), i == per_arc))
        t += arc
    return points


def cmd_bounce(args: argparse.Namespace) -> dict[str, Any]:
    words = check_text(args)
    nodes: list[dict[str, Any]] = []
    end = args.t0
    for i, word in enumerate(words):
        t_start = args.t0 + i * args.interval
        width = text_width(word, args.size)
        x = args.x + (i - (len(words) - 1) / 2) * (width + args.size)
        rest_y = args.floor_y + args.size * 0.55
        drop = args.size * args.drop
        samples = bounce_samples(
            drop, args.restitution, args.bounces, args.gravity, args.samples
        )
        moves = [key(t_start + t, [x, rest_y + h, args.z]) for t, h, _ in samples]
        # 着地で縦に潰す (体積保存): 0.08 秒だけ y 0.88 / x 1.08
        scale_keys: list[dict[str, Any]] = [key(t_start, [1, 1, 1])]
        for t, _, landed in samples:
            if landed:
                scale_keys += [
                    key(t_start + t, [1.08, 0.88, 1]),
                    key(t_start + t + 0.08, [1, 1, 1], "ease-out"),
                ]
        scale_keys = dedupe_sorted(scale_keys)
        end = max(end, t_start + samples[-1][0] + 0.08)
        nodes.append(
            text_node(
                f"{args.id_prefix}{i + 1}",
                word,
                size=args.size,
                position=[x, rest_y, args.z],
                color=args.color,
                weight=args.weight,
                keys={"translation": moves, "scale": scale_keys},
            )
        )
        if args.shadow:
            nodes.append(
                shadow_node(
                    f"{args.id_prefix}{i + 1}_shadow",
                    x,
                    args.z,
                    args.floor_y,
                    width,
                    args.size,
                    t_start,
                    samples,
                    drop,
                )
            )
    return emit(
        args,
        nodes,
        {
            "end": rnd(end),
            "note": "解析式のバウンス (物理は走らせない)。影は偽物の黒い円の板。",
        },
    )


def shadow_node(
    node_id: str,
    x: float,
    z: float,
    floor_y: float,
    width: float,
    size: float,
    t_start: float,
    samples: list[tuple[float, float, bool]],
    drop: float,
) -> dict[str, Any]:
    """接触影: 高いほど薄く小さい (板の size は固定、不透明度で表す)."""
    opacity = [
        key(t_start + t, rnd(0.55 - 0.4 * min(1.0, h / drop))) for t, h, _ in samples
    ]
    return {
        "id": node_id,
        "kind": "plane",
        "size": [rnd(width * 0.95), rnd(size * 0.5)],
        "shape": "circle",
        "color": "#000000",
        "transform": {
            "t": [rnd(x), rnd(floor_y + 0.002), rnd(z)],
            "r": [0, 0, 0, 1],
            "s": [1, 1, 1],
        },
        "visible": True,
        "keys": {"opacity": opacity},
    }


def dedupe_sorted(keys: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """時刻が昇順・重複なしになるようにする (同じ時刻は後勝ち)."""
    by_time: dict[float, dict[str, Any]] = {}
    for item in keys:
        by_time[item["t"]] = item
    return [by_time[t] for t in sorted(by_time)]


# ---------------------------------------------------------------- flip


def ease_out_back(u: float, overshoot: float) -> float:
    c1 = overshoot
    c3 = c1 + 1
    return 1 + c3 * (u - 1) ** 3 + c1 * (u - 1) ** 2


def cmd_flip(args: argparse.Namespace) -> dict[str, Any]:
    layout = glyph_layout(args.text, args.size)
    cx, cy, cz = args.center
    nodes: list[dict[str, Any]] = []
    end = args.t0
    for i, (char, dx) in enumerate(layout):
        t_i = args.t0 + i * args.stagger
        steps = max(6, args.turns * 8)
        rotation = []
        for s in range(steps + 1):
            u = s / steps
            angle = 360 * args.turns * ease_out_back(u, args.overshoot)
            rotation.append(
                key(t_i + u * args.duration, qround(quat_axis_angle(args.axis, angle)))
            )
        end = max(end, t_i + args.duration)
        nodes.append(
            text_node(
                f"{args.id_prefix}{i + 1}",
                char,
                size=args.size,
                position=[cx + dx, cy, cz],
                color=args.color,
                weight=args.weight,
                keys={"rotation": rotation},
            )
        )
    return emit(
        args,
        nodes,
        {
            "end": rnd(end),
            "note": "回転の途中 (90/270 度) は板が線になって読めない。最後は正面。",
        },
    )


# ---------------------------------------------------------------- ring


def cmd_ring(args: argparse.Namespace) -> dict[str, Any]:
    layout = glyph_layout(args.text, args.size)
    cx, cy, cz = args.center
    step = max(0.05, 15 / max(1e-6, abs(args.spin)))  # 1 区間で最大 15 度
    count = max(1, math.ceil(args.duration / step))
    times = [args.t0 + args.duration * k / count for k in range(count + 1)]
    nodes: list[dict[str, Any]] = []
    for i, (char, dx) in enumerate(layout):
        theta0 = math.degrees(dx / args.radius)
        translation, rotation, opacity = [], [], []
        for t in times:
            theta = theta0 + args.spin * (t - args.t0)
            rad = math.radians(theta)
            translation.append(
                key(
                    t,
                    [
                        rnd(cx + args.radius * math.sin(rad)),
                        cy,
                        rnd(cz + args.radius * math.cos(rad)),
                    ],
                )
            )
            rotation.append(key(t, qround(quat_axis_angle("y", theta))))
            if args.fade_back:
                opacity.append(key(t, rnd(max(0.0, min(1.0, math.cos(rad) / 0.5)))))
        keys: dict[str, Any] = {"translation": translation, "rotation": rotation}
        if opacity:
            keys["opacity"] = opacity
        front = [cx + dx, cy, cz + args.radius]
        nodes.append(
            text_node(
                f"{args.id_prefix}{i + 1}",
                char,
                size=args.size,
                position=front,
                color=args.color,
                weight=args.weight,
                keys=keys,
            )
        )
    return emit(
        args,
        nodes,
        {
            "end": rnd(args.t0 + args.duration),
            "note": "一方向にゆっくり回す (1 周 6 秒以上)。正面 ±35 度が読み帯。",
        },
    )


# ---------------------------------------------------------------- shake / fill / width


def cmd_shake(args: argparse.Namespace) -> dict[str, Any]:
    rng = mulberry32(args.seed)
    phase_x, phase_y = rng() * math.tau, rng() * math.tau
    frames = max(2, round(args.duration * args.fps))
    base = args.base
    keys = []
    for f in range(frames + 1):
        u = f / frames
        t = args.t0 + u * args.duration
        envelope = args.amp * math.exp(-4.0 * u) * (1 - u)
        dx = envelope * math.sin(math.tau * args.freq * u * args.duration + phase_x)
        dy = envelope * math.sin(
            math.tau * args.freq * 1.13 * u * args.duration + phase_y
        )
        keys.append(key(t, [rnd(base[0] + dx), rnd(base[1] + dy), base[2]]))
    keys[-1] = key(args.t0 + args.duration, [base[0], base[1], base[2]])
    return {
        "camera_translation": keys,
        "note": "ロールは使わない。カメラが他に動いているときは"
        "このキーを足さず、語のスケール・ヒットで当てる。",
    }


def cmd_fill(args: argparse.Namespace) -> dict[str, Any]:
    half = math.tan(math.radians(args.fov) / 2)
    by_width = (args.width / args.fraction) / (2 * half * args.aspect)
    by_height = (args.height / args.fraction) / (2 * half) if args.height else 0.0
    return {
        "distance": rnd(max(by_width, by_height), 3),
        "by_width": rnd(by_width, 3),
        "by_height": rnd(by_height, 3),
        "note": "three.js の fov は縦。"
        "終端で正面・ロール 0・ブルーム 0 にして 2D の板へ切り替える。",
    }


def cmd_width(args: argparse.Namespace) -> dict[str, Any]:
    return {
        "width": rnd(text_width(args.text, args.size), 3),
        "height": rnd(args.size * LINE_HEIGHT * (args.text.count("\n") + 1), 3),
    }


# ---------------------------------------------------------------- CLI


def vec3(raw: str) -> list[float]:
    parts = [p for p in raw.replace(",", " ").split() if p]
    if len(parts) != VEC3_SIZE:
        message = "x,y,z の 3 つを渡す"
        raise argparse.ArgumentTypeError(message)
    return [float(p) for p in parts]


def common(sub: argparse.ArgumentParser, *, size: float) -> None:
    sub.add_argument("--t0", type=float, default=0.0, help="始まりの秒 (シーン時刻)")
    sub.add_argument("--size", type=float, default=size, help="文字の高さ (m)")
    sub.add_argument(
        "--seed", type=int, default=1, help="乱数の seed (同じなら同じ出力)"
    )
    sub.add_argument("--color", default="#ffffff")
    sub.add_argument("--weight", type=int, choices=(400, 700, 900), default=700)
    sub.add_argument("--id-prefix", default="k")
    sub.add_argument(
        "--ops", action="store_true", help="patch_previz_scene の add 操作の列で出す"
    )


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    sub = parser.add_subparsers(dest="command", required=True)

    p = sub.add_parser("tunnel", help="語のトンネル")
    p.add_argument("--words", nargs="+", required=True)
    common(p, size=0.6)
    p.add_argument(
        "--per-word",
        type=float,
        default=1.0,
        help="1 語を抜けるまでの秒 (拍に合わせる)",
    )
    p.add_argument("--hold", type=float, default=0.3, help="各語の手前で止まる秒")
    p.add_argument(
        "--spacing", type=float, default=3.0, help="語の z 間隔 = size x この値"
    )
    p.add_argument(
        "--jitter", type=float, default=0.3, help="x/y のずれ = size x この値"
    )
    p.add_argument("--roll-max", type=float, default=8.0, help="語のロールの上限 (度)")
    p.add_argument(
        "--camera-distance", type=float, default=4.0, help="止まるときの語との距離 (m)"
    )
    p.add_argument("--y", type=float, default=1.6)
    p.add_argument(
        "--fade-in",
        action=argparse.BooleanOptionalAction
        if hasattr(argparse, "BooleanOptionalAction")
        else "store_true",
        default=True,
    )
    p.set_defaults(func=cmd_tunnel)

    p = sub.add_parser("scatter", help="散らして組み上げる")
    p.add_argument("--text", required=True)
    common(p, size=0.5)
    p.add_argument("--center", type=vec3, default=[0, 1.6, 0])
    p.add_argument("--radius", type=float, default=4.0, help="散布半径 = size x この値")
    p.add_argument("--rot", type=float, default=180.0, help="回転のばらつき (度)")
    p.add_argument("--assemble", type=float, default=0.8)
    p.add_argument("--stagger", type=float, default=0.04)
    p.set_defaults(func=cmd_scatter)

    p = sub.add_parser("bounce", help="落としてバウンス")
    p.add_argument("--words", nargs="+", required=True)
    common(p, size=0.6)
    p.add_argument(
        "--interval", type=float, default=0.5, help="語ごとの落とし始めの間隔 (秒)"
    )
    p.add_argument("--drop", type=float, default=4.0, help="落下高 = size x この値")
    p.add_argument("--bounces", type=int, default=3)
    p.add_argument("--restitution", type=float, default=0.45, help="反発ごとの高さの比")
    p.add_argument("--gravity", type=float, default=9.8)
    p.add_argument("--samples", type=int, default=8, help="1 回の放物線を切るキーの数")
    p.add_argument("--floor-y", type=float, default=0.0)
    p.add_argument("--x", type=float, default=0.0)
    p.add_argument("--z", type=float, default=0.0)
    p.add_argument("--shadow", action="store_true", help="接触影 (黒い円の板) も作る")
    p.set_defaults(func=cmd_bounce)

    p = sub.add_parser("flip", help="字ごとに回る")
    p.add_argument("--text", required=True)
    common(p, size=0.5)
    p.add_argument("--center", type=vec3, default=[0, 1.6, 0])
    p.add_argument("--stagger", type=float, default=0.05)
    p.add_argument("--duration", type=float, default=0.5)
    p.add_argument("--turns", type=int, default=1)
    p.add_argument("--axis", choices=("x", "y"), default="x")
    p.add_argument(
        "--overshoot",
        type=float,
        default=0.3,
        help="easeOutBack の行き過ぎ (遊びの語り口のみ)",
    )
    p.set_defaults(func=cmd_flip)

    p = sub.add_parser("ring", help="円筒に並べて自転")
    p.add_argument("--text", required=True)
    common(p, size=0.5)
    p.add_argument("--center", type=vec3, default=[0, 1.6, -2])
    p.add_argument("--radius", type=float, default=2.0)
    p.add_argument(
        "--spin",
        type=float,
        default=40.0,
        help="自転の度/秒 (一方向。1 周 6 秒以上 = 60 以下)",
    )
    p.add_argument("--duration", type=float, default=6.0)
    p.add_argument(
        "--fade-back",
        action=argparse.BooleanOptionalAction
        if hasattr(argparse, "BooleanOptionalAction")
        else "store_true",
        default=True,
    )
    p.set_defaults(func=cmd_ring)

    p = sub.add_parser("shake", help="カメラのシェイプ")
    p.add_argument(
        "--base", type=vec3, required=True, help="止まっているカメラの位置 x,y,z"
    )
    p.add_argument("--t0", type=float, default=0.0)
    p.add_argument("--duration", type=float, default=0.3)
    p.add_argument(
        "--amp", type=float, default=0.04, help="振幅 (m)。語の高さ x 0.03〜0.06"
    )
    p.add_argument("--freq", type=float, default=22.0, help="周波数 (Hz)")
    p.add_argument("--fps", type=int, default=30)
    p.add_argument("--seed", type=int, default=1)
    p.add_argument("--ops", action="store_true")
    p.set_defaults(func=cmd_shake)

    p = sub.add_parser("fill", help="語が画面を満たすカメラ距離")
    p.add_argument("--width", type=float, required=True, help="語の板の幅 (m)")
    p.add_argument(
        "--height", type=float, default=0.0, help="語の板の高さ (m)。縦で決まるときだけ"
    )
    p.add_argument("--fov", type=float, default=40.0, help="縦画角 (度)")
    p.add_argument("--aspect", type=float, default=16 / 9)
    p.add_argument("--fraction", type=float, default=0.85, help="画面に占める割合")
    p.set_defaults(func=cmd_fill)

    p = sub.add_parser("width", help="文字列の板の幅の見積り")
    p.add_argument("--text", required=True)
    p.add_argument("--size", type=float, default=0.5)
    p.set_defaults(func=cmd_width)
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    result = args.func(args)
    json.dump(result, sys.stdout, ensure_ascii=False)
    sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
