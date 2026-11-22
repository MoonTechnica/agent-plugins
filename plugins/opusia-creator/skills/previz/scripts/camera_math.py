"""カメラの動きの検算 (previz スキル). 標準ライブラリだけで動く.

数値の根拠は references/camera-moves.md。四元数の向きはプレイヤー
(three.js: -Z 前方・+Y 上・[x, y, z, w]) と同じ。

  look        ヨー / ピッチ、または 2 点から四元数を出す。roll でバンクも指定
  pan-speed   pan の角速度が「画面幅 1 枚ぶんに 7 秒以上」に収まるか
  push-in     被写体距離から「読める寄り」の終点を出す / 終点を判定する
  dolly-zoom  距離を変えても被写体の大きさが変わらない fov を出す
  arc         円弧・上昇 / 下降スパイラルの translation キー列を生成する
  lens        焦点距離 (mm) と縦画角 (度) を相互に換算する (lens.md §1)
  place       ショットサイズ・身長からカメラの距離と高さを出す (lens.md §3・§4)
  capsule     身長からカプセルの size と原点の高さを出す (staging.md)

すべて `--json` で機械可読。人が読む既定の出力は 1〜3 行。
"""

from __future__ import annotations

import argparse
import json
import math
import sys
from collections.abc import Iterable, Iterator
from itertools import tee
from typing import Any, NoReturn, TypeVar

_T = TypeVar("_T")


def pairwise(items: Iterable[_T]) -> Iterator[tuple[_T, _T]]:
    """隣り合う 2 つずつ (pairwise は 3.10 から。macOS の python3 は 3.9)."""
    first, second = tee(items)
    next(second, None)
    return zip(first, second)


# 本編と揃える既定 (lens.md: 35mm = fov 38、framing.md: 16:9)
DEFAULT_ASPECT = 16 / 9
# RED「画面幅 1 枚ぶんの pan に 7 秒以上」(24fps・180° シャッター)
PAN_SECONDS_PER_FRAME_WIDTH = 7.0
# 見かけの大きさが +20% 未満だと「変わった」と読めない (CGChannel の 20% 規則)
PERCEPTIBLE_SCALE = 1.2
# ここから上はショットサイズ一段ぶんの寄りとみなす
ONE_SIZE_MIN_SCALE = 1.4
# ショットサイズ一段 (lens.md の段: 1.9 → 1.1 → 0.7 → 0.4 は 0.57〜0.64 倍)
ONE_SIZE_SCALE = 1 / 0.6
STANDARD_SCALE = 1.5
MAX_FOV_DEG = 180
BISECTION_STEPS = 60

# CSS と同じ cubic-bezier (player の easing.ts と同じ値)
BEZIERS: dict[str, tuple[float, float, float, float]] = {
    "ease-in": (0.42, 0.0, 1.0, 1.0),
    "ease-out": (0.0, 0.0, 0.58, 1.0),
    "ease-in-out": (0.42, 0.0, 0.58, 1.0),
}

Quat = list[float]
Vec3 = list[float]
Control = tuple[float, float, float, float]


def _fail(message: str) -> NoReturn:
    raise SystemExit(message)


def _require(condition: bool, message: str) -> None:  # noqa: FBT001
    if not condition:
        _fail(message)


# ---------------------------------------------------------------- 四元数


def quat_from_yaw_pitch(yaw_deg: float, pitch_deg: float) -> Quat:
    """ヨー (Y 軸・左が +) → ピッチ (カメラの X 軸・上が +) の順. 水平は傾かない."""
    hy = math.radians(yaw_deg) / 2
    hp = math.radians(pitch_deg) / 2
    cy, sy, cp, sp = math.cos(hy), math.sin(hy), math.cos(hp), math.sin(hp)
    return [cy * sp, sy * cp, -sy * sp, cy * cp]


def yaw_pitch_from_direction(direction: Vec3) -> tuple[float, float]:
    """-Z 前方のカメラが `direction` を向くヨー / ピッチ (度)."""
    dx, dy, dz = direction
    horizontal = math.hypot(dx, dz)
    yaw = math.degrees(math.atan2(-dx, -dz))
    pitch = math.degrees(math.atan2(dy, horizontal))
    return yaw, pitch


def rotate(q: Quat, v: Vec3) -> Vec3:
    """四元数 q でベクトル v を回す."""
    x, y, z, w = q
    vx, vy, vz = v
    tx = 2 * (y * vz - z * vy)
    ty = 2 * (z * vx - x * vz)
    tz = 2 * (x * vy - y * vx)
    return [
        vx + w * tx + (y * tz - z * ty),
        vy + w * ty + (z * tx - x * tz),
        vz + w * tz + (x * ty - y * tx),
    ]


def _angles_from_points(args: argparse.Namespace) -> tuple[float, float]:
    _require(args.from_ is not None, "look: --from と --to は両方要る")
    _require(args.to is not None, "look: --from と --to は両方要る")
    direction = [t - f for f, t in zip(args.from_, args.to)]
    _require(any(direction), "look: --from と --to が同じ点")
    return yaw_pitch_from_direction(direction)


def _look_angles(args: argparse.Namespace) -> tuple[float, float]:
    if args.from_ is None and args.to is None:
        return args.yaw, args.pitch
    return _angles_from_points(args)


def cmd_look(args: argparse.Namespace) -> dict[str, Any]:
    yaw, pitch = _look_angles(args)
    x, y, z, w = quat_from_yaw_pitch(yaw, pitch)
    # 視線 (-Z) 軸まわりの右手系のローカル回転を右から掛ける。
    half_roll = math.radians(args.roll) / 2
    sr, cr = math.sin(half_roll), math.cos(half_roll)
    q = [x * cr - y * sr, y * cr + x * sr, z * cr - w * sr, w * cr + z * sr]
    return {
        "quaternion": [round(c, 4) for c in q],
        "yaw_deg": round(yaw, 3),
        "pitch_deg": round(pitch, 3),
        "roll_deg": args.roll,
        "forward": [round(c, 4) for c in rotate(q, [0, 0, -1])],
    }


# ---------------------------------------------------------------- pan の速さ


def horizontal_fov(vertical_fov_deg: float, aspect: float) -> float:
    """縦画角 (度) とアスペクト比から横画角 (度)."""
    half = math.radians(vertical_fov_deg) / 2
    return math.degrees(2 * math.atan(math.tan(half) * aspect))


def cmd_pan_speed(args: argparse.Namespace) -> dict[str, Any]:
    _require(args.seconds > 0, "pan-speed: --seconds は正の秒数")
    _require(0 < args.fov < MAX_FOV_DEG, "pan-speed: --fov は 0〜180 の度")
    sweep = abs(args.to_yaw - args.from_yaw)
    hfov = horizontal_fov(args.fov, args.aspect)
    limit = hfov / PAN_SECONDS_PER_FRAME_WIDTH
    speed = sweep / args.seconds
    return {
        "sweep_deg": round(sweep, 3),
        "deg_per_s": round(speed, 3),
        "horizontal_fov_deg": round(hfov, 2),
        "limit_deg_per_s": round(limit, 3),
        "ok": speed <= limit,
        "min_seconds": round(sweep / limit, 2),
    }


# ---------------------------------------------------------------- 寄りの量


def _scale_verdict(factor: float) -> str:
    if factor < PERCEPTIBLE_SCALE:
        return "too_small"
    if factor < ONE_SIZE_MIN_SCALE:
        return "noticeable"
    return "one_size"


def _push_in_verdict(distance: float, end: float) -> dict[str, Any]:
    _require(end > 0, "push-in: --end は正の m")
    factor = distance / end
    return {
        "end": end,
        "scale_factor": round(factor, 3),
        "verdict": _scale_verdict(factor),
    }


def cmd_push_in(args: argparse.Namespace) -> dict[str, Any]:
    _require(args.distance > 0, "push-in: --distance は正の m")
    out: dict[str, Any] = {
        "distance": args.distance,
        "min_end": round(args.distance / PERCEPTIBLE_SCALE, 3),
        "standard_end": round(args.distance / STANDARD_SCALE, 3),
        "one_size_end": round(args.distance / ONE_SIZE_SCALE, 3),
    }
    if args.end is not None:
        out.update(_push_in_verdict(args.distance, args.end))
    return out


# ---------------------------------------------------------------- dolly zoom


def cmd_dolly_zoom(args: argparse.Namespace) -> dict[str, Any]:
    _require(min(args.distance, args.to_distance) > 0, "dolly-zoom: 距離は正の m")
    _require(0 < args.fov < MAX_FOV_DEG, "dolly-zoom: --fov は 0〜180 の度")
    constant = args.distance * math.tan(math.radians(args.fov) / 2)
    fov = math.degrees(2 * math.atan(constant / args.to_distance))
    return {
        "distance": args.distance,
        "fov_from": args.fov,
        "to_distance": args.to_distance,
        "fov": round(fov, 2),
    }


# ---------------------------------------------------------------- 置き方

#: センサー高の半分 (35mm 判 36x24mm の 24 / 2)
HALF_SENSOR_MM = 12.0
#: ショットサイズ → (見せたい高さの基準値 m, 既定レンズ mm, カメラの高さ / 身長).
#: lens.md §3 の表と §4 の `aimHeightForShot` の比率。基準は身長 1.7m
SHOT_PLACES: dict[str, tuple[float, int, float]] = {
    "ecu": (0.2, 100, 0.92),
    "closeup": (0.4, 85, 0.92),
    "bust": (0.7, 85, 0.85),
    "waist": (1.1, 50, 0.70),
    "knee": (1.4, 50, 0.62),
    "full": (1.9, 35, 0.55),
    "long": (4.0, 28, 0.45),
}
REFERENCE_HEIGHT_M = 1.7


def fov_of(mm: float) -> float:
    return math.degrees(2 * math.atan(HALF_SENSOR_MM / mm))


def mm_of(fov: float) -> float:
    return HALF_SENSOR_MM / math.tan(math.radians(fov) / 2)


def cmd_lens(args: argparse.Namespace) -> dict[str, Any]:
    _require((args.mm is None) != (args.fov is None), "lens: --mm か --fov の片方")
    if args.mm is not None:
        _require(args.mm > 0, "lens: --mm は正")
        return {"mm": args.mm, "fov": round(fov_of(args.mm), 2)}
    _require(0 < args.fov < MAX_FOV_DEG, "lens: --fov は 0〜180 の度")
    return {"mm": round(mm_of(args.fov), 2), "fov": args.fov}


def cmd_place(args: argparse.Namespace) -> dict[str, Any]:
    _require(args.height > 0, "place: --height は身長 (m)")
    base, default_mm, eye = SHOT_PLACES[args.size]
    mm = args.mm or default_mm
    shown = base * args.height / REFERENCE_HEIGHT_M
    return {
        "size": args.size,
        "mm": mm,
        "fov": round(fov_of(mm), 2),
        "shown_height": round(shown, 3),
        "distance": round(shown * mm / (2 * HALF_SENSOR_MM), 3),
        "camera_height": round(eye * args.height, 3),
    }


def cmd_capsule(args: argparse.Namespace) -> dict[str, Any]:
    height = args.height_cm / 100
    _require(height > 2 * args.radius, "capsule: 身長が直径より小さい")
    return {
        "size": {"radius": args.radius, "height": round(height - 2 * args.radius, 3)},
        "t_y": round(height / 2, 3),
    }


# ---------------------------------------------------------------- 円弧


def _bezier_point(s: float, control: Control) -> tuple[float, float]:
    x1, y1, x2, y2 = control
    u = 1 - s
    b1, b2, b3 = 3 * u * u * s, 3 * u * s * s, s * s * s
    return b1 * x1 + b2 * x2 + b3, b1 * y1 + b2 * y2 + b3


def _invert_bezier(progress: float, control: Control) -> float:
    lo, hi = 0.0, 1.0
    for _ in range(BISECTION_STEPS):
        mid = (lo + hi) / 2
        if _bezier_point(mid, control)[1] < progress:
            lo = mid
        else:
            hi = mid
    return _bezier_point((lo + hi) / 2, control)[0]


def bezier_progress_to_time(name: str, progress: float) -> float:
    """全体に 1 本の ease を掛けたとき、進捗 `progress` に達する時刻の割合."""
    if name == "linear":
        return progress
    return _invert_bezier(progress, BEZIERS[name])


def _check_arc(args: argparse.Namespace) -> None:
    _require(args.radius > 0, "arc: --radius は正の m")
    _require(args.to_radius is None or args.to_radius > 0, "arc: --to-radius は正の m")
    _require(args.step > 0, "arc: --step は正の度")
    _require(args.start >= 0, "arc: --start は 0 以上 (カット内時刻)")
    _require(args.end > args.start, "arc: --end は --start より後")
    _require(args.to_deg != args.from_deg, "arc: --from-deg と --to-deg が同じ")


def _arc_key(args: argparse.Namespace, progress: float) -> dict[str, Any]:
    sweep = args.to_deg - args.from_deg
    angle = math.radians(args.from_deg + sweep * progress)
    cx, _, cz = args.center
    span = args.end - args.start
    t = args.start + span * bezier_progress_to_time(args.ease, progress)
    end_radius = args.radius if args.to_radius is None else args.to_radius
    end_height = args.height if args.to_height is None else args.to_height
    radius = args.radius + (end_radius - args.radius) * progress
    height = args.height + (end_height - args.height) * progress
    return {
        "t": round(t, 3),
        "v": [
            round(cx + radius * math.sin(angle), 3),
            round(height, 3),
            round(cz + radius * math.cos(angle), 3),
        ],
    }


def _arc_keys(args: argparse.Namespace) -> list[dict[str, Any]]:
    segments = max(1, math.ceil(abs(args.to_deg - args.from_deg) / args.step))
    return [_arc_key(args, i / segments) for i in range(segments + 1)]


def _strictly_increasing(times: list[float]) -> bool:
    return all(b > a for a, b in pairwise(times))


def cmd_arc(args: argparse.Namespace) -> dict[str, Any]:
    _check_arc(args)
    keys = _arc_keys(args)
    if args.hold and args.start > 0:
        keys.insert(0, {"t": 0, "v": keys[0]["v"]})
    _require(
        _strictly_increasing([k["t"] for k in keys]),
        "arc: キーの時刻が重なる. --step を大きくするか尺を伸ばす",
    )
    return {"translation": keys}


# ---------------------------------------------------------------- CLI


def _add_placing(sub: Any, common: argparse.ArgumentParser) -> None:  # noqa: ANN401
    """置き方のサブコマンド (lens / place / capsule)."""
    lens = sub.add_parser("lens", parents=[common], help="mm と縦画角の換算")
    lens.add_argument("--mm", type=float)
    lens.add_argument("--fov", type=float, help="縦画角 (度)")
    lens.set_defaults(func=cmd_lens)

    place = sub.add_parser("place", parents=[common], help="サイズ → 距離と高さ")
    place.add_argument("--size", choices=list(SHOT_PLACES), required=True)
    place.add_argument("--height", type=float, required=True, help="身長 (m)")
    place.add_argument("--mm", type=int, help="レンズ. 省くとそのサイズの既定")
    place.set_defaults(func=cmd_place)

    capsule = sub.add_parser("capsule", parents=[common], help="身長 → カプセル")
    capsule.add_argument("--height-cm", type=float, required=True)
    capsule.add_argument("--radius", type=float, default=0.3)
    capsule.set_defaults(func=cmd_capsule)


def build_parser() -> argparse.ArgumentParser:
    """サブコマンドを組む. `--json` はどのサブコマンドの後ろにも置ける."""
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    common = argparse.ArgumentParser(add_help=False)
    common.add_argument("--json", action="store_true", help="機械可読で出す")
    sub = parser.add_subparsers(dest="command", required=True)

    look = sub.add_parser(
        "look", parents=[common], help="ヨー / ピッチか 2 点 → 四元数"
    )
    look.add_argument("--yaw", type=float, default=0.0, help="度. 左が +")
    look.add_argument("--pitch", type=float, default=0.0, help="度. 上が +")
    look.add_argument(
        "--roll", type=float, default=0.0, help="ローカル視線軸 (-Z) まわりの度. 右手系"
    )
    look.add_argument(
        "--from", dest="from_", type=float, nargs=3, metavar=("X", "Y", "Z")
    )
    look.add_argument("--to", type=float, nargs=3, metavar=("X", "Y", "Z"))
    look.set_defaults(func=cmd_look)

    pan = sub.add_parser("pan-speed", parents=[common], help="pan の角速度の検算")
    pan.add_argument("--from-yaw", type=float, required=True)
    pan.add_argument("--to-yaw", type=float, required=True)
    pan.add_argument("--seconds", type=float, required=True)
    pan.add_argument("--fov", type=float, required=True, help="縦画角 (度)")
    pan.add_argument("--aspect", type=float, default=DEFAULT_ASPECT)
    pan.set_defaults(func=cmd_pan_speed)

    push = sub.add_parser("push-in", parents=[common], help="寄りの量の目安と判定")
    push.add_argument("--distance", type=float, required=True, help="被写体距離 (m)")
    push.add_argument("--end", type=float, help="終点の被写体距離 (m). 判定したいとき")
    push.set_defaults(func=cmd_push_in)

    dz = sub.add_parser("dolly-zoom", parents=[common], help="被写体の大きさを保つ fov")
    dz.add_argument("--distance", type=float, required=True)
    dz.add_argument("--fov", type=float, required=True, help="始点の縦画角 (度)")
    dz.add_argument("--to-distance", type=float, required=True)
    dz.set_defaults(func=cmd_dolly_zoom)

    arc = sub.add_parser("arc", parents=[common], help="円弧の translation キー列")
    arc.add_argument(
        "--center", type=float, nargs=3, required=True, metavar=("X", "Y", "Z")
    )
    arc.add_argument("--radius", type=float, required=True)
    arc.add_argument("--height", type=float, required=True, help="カメラの高さ (m)")
    arc.add_argument(
        "--to-height", type=float, help="終点の高さ (m). 指定時は上昇 / 下降"
    )
    arc.add_argument(
        "--to-radius", type=float, help="終点の半径 (m). 指定時は拡大 / 縮小"
    )
    arc.add_argument(
        "--from-deg", type=float, required=True, help="0 = +Z 側. + で +X 側へ"
    )
    arc.add_argument("--to-deg", type=float, required=True)
    arc.add_argument("--start", type=float, required=True, help="動き出し (カット内秒)")
    arc.add_argument("--end", type=float, required=True, help="止まる時刻 (カット内秒)")
    arc.add_argument(
        "--step", type=float, default=15.0, help="キーの刻み (度). 既定 15"
    )
    arc.add_argument("--ease", choices=["linear", *BEZIERS], default="linear")
    arc.add_argument(
        "--no-hold", dest="hold", action="store_false", help="t=0 の静止キーを付けない"
    )
    arc.set_defaults(func=cmd_arc)

    _add_placing(sub, common)
    return parser


def _describe_look(out: dict[str, Any]) -> str:
    return (
        f"quaternion {out['quaternion']}"
        f"  (yaw {out['yaw_deg']}°, pitch {out['pitch_deg']}°, roll {out['roll_deg']}°)"
    )


def _describe_pan_speed(out: dict[str, Any]) -> str:
    verdict = "ok" if out["ok"] else f"too fast → {out['min_seconds']} s 以上かける"
    return (
        f"{out['sweep_deg']}° in {out['deg_per_s']}°/s,"
        f" limit {out['limit_deg_per_s']}°/s (hfov {out['horizontal_fov_deg']}°)"
        f" → {verdict}"
    )


def _describe_push_in(out: dict[str, Any]) -> str:
    line = (
        f"from {out['distance']} m: min end {out['min_end']} m (+20%),"
        f" standard {out['standard_end']} m (x1.5),"
        f" one size {out['one_size_end']} m"
    )
    if "verdict" in out:
        line += f"\nend {out['end']} m → x{out['scale_factor']} → {out['verdict']}"
    return line


def _describe_dolly_zoom(out: dict[str, Any]) -> str:
    return (
        f"fov {out['fov_from']}° at {out['distance']} m"
        f" → {out['fov']}° at {out['to_distance']} m"
    )


DESCRIBERS = {
    "look": _describe_look,
    "pan-speed": _describe_pan_speed,
    "push-in": _describe_push_in,
    "dolly-zoom": _describe_dolly_zoom,
}


def main(argv: list[str] | None = None) -> int:
    """引数を読んで結果を標準出力へ. arc は常に JSON."""
    args = build_parser().parse_args(argv)
    out = args.func(args)
    describer = DESCRIBERS.get(args.command)
    if args.json or describer is None:
        print(json.dumps(out, ensure_ascii=False))
    else:
        print(describer(out))
    return 0


if __name__ == "__main__":
    sys.exit(main())
