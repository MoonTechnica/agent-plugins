r"""2.5D パララックスのカメラの動きを層ごとに検算する (compositor).

標準ライブラリだけで動く。

references/parallax-camera.md の式 (§2) をそのまま計算する:
  - 層の余白: 動きの山で絵の縁が画面に出ないか (横移動・寄り / 引き・傾き・揺れ)
  - 元絵の拡大率 g: 寄りの終点で絵が甘くならないか (1 原画素が何画面画素になるか)
  - 最速の層の 1 コマの移動量: ちらつき・ジャダーの域に入らないか

    python3 parallax_plan.py --width 1920 --height 1080 --fps 24 --duration 4 \
        --x -120 120 --zoom 1 1.3 --roll 1 --shake 6 --ease sine \
        --layer sky:0.1:2000x1125:2000 --layer chara:1.0:2240x1260:2240 \
        --layer fg:2.0:2560x1440:2560 [--json]

--layer は `名前:視差比 r:構図上の幅x高さ:元絵の横画素数`。--x / --y は被写体の
平面でのカメラの位置の範囲 (px)、--zoom は被写体の倍率 S の範囲 (dolly)、--lens は
全層一様のレンズの倍率の範囲。見積もりは上限 (保守的)。最後は書き出したコマで見る。
"""

from __future__ import annotations

import argparse
import json
import math
import sys
from dataclasses import dataclass
from typing import Any

#: 時間の ease の、平均の速さに対する最高速の比 (inOut の中央の傾き)
EASE_PEAK = {
    "linear": 1.0,
    "sine": math.pi / 2,
    "power1": 2.0,
    "power2": 3.0,
    "power3": 4.0,
}
SPEED_LIMIT = 12.0
"""これを超える 1 コマの移動量 (1080p 相当) はちらつき・ジャダーの域."""
WHIP_FROM = 40.0
"""これ以上は whip pan の速さ (動かしたまま見せず、最高速で切る)."""
G_MAX = 1.0
G_MIN = 0.5
K_TOO_CLOSE = 3.0
SAFETY = 0.01


@dataclass
class Layer:
    name: str
    r: float
    w: float
    h: float
    n: float


@dataclass
class Measured:
    need_w: float
    need_h: float
    k_max: float
    g_max: float
    speed: float


def parse_layer(spec: str) -> Layer:
    try:
        name, r, size, pixels = spec.split(":")
        w, h = size.lower().split("x")
        return Layer(name, float(r), float(w), float(h), float(pixels))
    except ValueError:
        sys.exit(f"--layer は 名前:r:幅x高さ:元絵の横画素数 で渡す: {spec!r}")


def cover(
    width: float, height: float, roll_deg: float, shake: float
) -> tuple[float, float]:
    """傾き・揺れを含めて、層が覆うべき画面の大きさ."""
    a = math.radians(abs(roll_deg))
    w = width * math.cos(a) + height * math.sin(a) + 2 * shake
    h = width * math.sin(a) + height * math.cos(a) + 2 * shake
    return w, h


def layer_factors(r: float, perspective: float, scale: float) -> tuple[float, float]:
    """被写体の倍率 S のときの、層の倍率 k と移動倍率 s."""
    d = perspective / r
    cz = perspective * (1 - 1 / scale)
    if d - cz <= 0:
        return math.inf, math.inf
    return d / (d - cz), perspective / (d - cz)


def measure(layer: Layer, args: argparse.Namespace, cover_wh: tuple) -> Measured:
    ends = [layer_factors(layer.r, args.perspective, s) for s in args.zoom]
    k_min = min(k for k, _ in ends)
    k_max = max(k for k, _ in ends)
    s_max = max(s for _, s in ends)
    lens_min, lens_max = min(args.lens), max(args.lens)
    reach_x = max(abs(v) for v in args.x)
    reach_y = max(abs(v) for v in args.y)
    travel = math.hypot(max(args.x) - min(args.x), max(args.y) - min(args.y))
    frames = max(args.duration * args.fps, 1)
    to_1080 = 1080 / min(args.width, args.height)
    return Measured(
        need_w=(cover_wh[0] / lens_min + 2 * s_max * reach_x) / k_min * (1 + SAFETY),
        need_h=(cover_wh[1] / lens_min + 2 * s_max * reach_y) / k_min * (1 + SAFETY),
        k_max=k_max,
        g_max=layer.w / layer.n * k_max * lens_max,
        speed=s_max * lens_max * travel / frames * EASE_PEAK[args.ease] * to_1080,
    )


NOTES = (
    (
        lambda m, layer: m.need_w > layer.w or m.need_h > layer.h,
        "余白が足りない: 絵の縁が出る (動きを減らす / 広く描く / r を下げる)",
    ),
    (
        lambda m, _layer: m.g_max > G_MAX,
        "寄りの終点で拡大 g > 1: 甘くなる (元絵を大きく / 寄りを減らす)",
    ),
    (
        lambda m, _layer: m.g_max < G_MIN,
        "元絵が大きすぎる g < 0.5: 細い線がちらつきうる (2 倍以内の縮小に)",
    ),
    (
        lambda m, _layer: m.k_max > K_TOO_CLOSE,
        "寄りでカメラに近づきすぎる: この層を外すか r を下げる",
    ),
    (
        lambda m, _layer: WHIP_FROM > m.speed > SPEED_LIMIT,
        "速さがジャダーの域 (12〜40 px/コマ): 遅くする / ブラー / whip にして切る",
    ),
    (
        lambda m, _layer: m.speed >= WHIP_FROM,
        "whip pan の速さ (40 px/コマ以上): 動かしたまま見せず、最高速で切る",
    ),
)


def row_for(layer: Layer, m: Measured) -> dict[str, Any]:
    return {
        "layer": layer.name,
        "r": layer.r,
        "k_max": round(m.k_max, 3),
        "need": [math.ceil(m.need_w), math.ceil(m.need_h)],
        "has": [int(layer.w), int(layer.h)],
        "short": [
            max(0, math.ceil(m.need_w - layer.w)),
            max(0, math.ceil(m.need_h - layer.h)),
        ],
        "g_max": round(m.g_max, 3),
        "peak_px_per_frame": round(m.speed, 1),
        "notes": [text for check, text in NOTES if check(m, layer)],
    }


def plan(args: argparse.Namespace) -> dict[str, Any]:
    cover_wh = cover(args.width, args.height, args.roll, args.shake)
    rows = [row_for(layer, measure(layer, args, cover_wh)) for layer in args.layer]
    return {"cover": [math.ceil(cover_wh[0]), math.ceil(cover_wh[1])], "layers": rows}


def report(result: dict[str, Any]) -> None:
    print(f"覆う大きさ (傾き・揺れ込み): {result['cover'][0]}x{result['cover'][1]}")
    for row in result["layers"]:
        print(
            f"- {row['layer']} r={row['r']} k≤{row['k_max']} "
            f"要る {row['need'][0]}x{row['need'][1]} "
            f"/ ある {row['has'][0]}x{row['has'][1]} "
            f"g≤{row['g_max']} 最速 {row['peak_px_per_frame']} px/コマ"
        )
        for note in row["notes"]:
            print(f"    ! {note}")


def parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description="2.5D パララックスのカメラの動きを検算する")
    p.add_argument("--width", type=float, default=1920)
    p.add_argument("--height", type=float, default=1080)
    p.add_argument("--fps", type=float, default=24)
    p.add_argument("--duration", type=float, required=True, help="動きの尺 (秒)")
    p.add_argument("--perspective", type=float, default=1000)
    p.add_argument("--x", type=float, nargs=2, default=[0, 0])
    p.add_argument("--y", type=float, nargs=2, default=[0, 0])
    p.add_argument("--zoom", type=float, nargs=2, default=[1, 1], help="被写体の倍率 S")
    p.add_argument("--lens", type=float, nargs=2, default=[1, 1], help="全層一様の倍率")
    p.add_argument("--roll", type=float, default=0, help="最大の傾き (度)")
    p.add_argument("--shake", type=float, default=0, help="揺れの振幅 (px)")
    p.add_argument("--ease", choices=sorted(EASE_PEAK), default="sine")
    p.add_argument("--layer", type=parse_layer, action="append", required=True)
    p.add_argument("--json", action="store_true")
    return p


def main(argv: list[str]) -> int:
    args = parser().parse_args(argv)
    result = plan(args)
    if args.json:
        print(json.dumps(result, ensure_ascii=False))
    else:
        report(result)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
