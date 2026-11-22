# ruff: noqa: C901, PLR0913
# (サブコマンドごとに引数と分岐が多い CLI。camera_math.py と同じ型)
"""輪・円弧・渦巻き・波に沿って字を並べる (compositor スキル). 標準ライブラリだけで動く.

字 1 つずつの位置と向きを**曲線の弧長**から決め、2D レイヤー
(`layers[]` の `html`) にして返す。
乱数も時計も使わない (同じ引数なら同じ出力)。回すのは**親 1 本** (字ごとに回さない)。

  ring     円周に沿って並べる (`--fit` で一周ぴったり。`--side in` で内向き)
  arc      円弧に沿って並べる (`--from-deg` から `--to-deg`、中央寄せ)
  spiral   渦巻き (半径が `--r0` から `--r1` へ、`--turns` 回転)
  wave     正弦波に沿って並べる (接線に合わせて傾く)

出力 (JSON): `layer` (id / html …。`patch_previz_scene` の
`/layers/-` へ入れる)、`glyphs`
(字ごとの x / y / 回転。3D の板やカードへ使うとき用)。`--ops` で patch の操作列にする。

座標は**フレームの px** で、左上が原点、y が下。角度は 12 時が 0、時計回りが正。
詳しい使い方・数値の根拠は references/kinetic-2d-recipes.md §1 と
docs/_research/2026-11-17-lyric-motion-technique-catalog.md A1〜A4。
"""

from __future__ import annotations

import argparse
import json
import math
import re
import sys
import unicodedata
from typing import Any, NoReturn

# 字幅 (1 = 文字の高さ)。全角は 1、半角は 0.56、空白は 0.3。
# kinetic_3d.py と同じ目安
WIDE_ADVANCE = 1.0
NARROW_ADVANCE = 0.56
SPACE_ADVANCE = 0.3
# 字の下端を曲線に載せるとき、曲線から字の中心までずらす量 (字高に対する比)
BASELINE_SHIFT = 0.4
ID_PATTERN = re.compile(r"^[A-Za-z0-9_-]{1,64}$")
# 曲線の標本の細かさ (px / 度)。位置の誤差がこれより小さくなる
SAMPLE_STEP_PX = 1.0
SAMPLE_STEP_DEG = 0.25
# 出現の stagger は総時間をこれ以内に収める (読み始めが遅れない)
MAX_STAGGER_TOTAL = 0.8
FONTS = {
    "serif": '"Noto Serif JP","Hiragino Mincho ProN","Yu Mincho",serif',
    "sans": '"Noto Sans JP","Hiragino Sans","Yu Gothic",sans-serif',
}


def fail(message: str) -> NoReturn:
    raise SystemExit(message)


# ---------------------------------------------------------------- 字の寸法


def advance(char: str) -> float:
    if char.isspace():
        return SPACE_ADVANCE
    wide = unicodedata.east_asian_width(char) in ("W", "F")
    return WIDE_ADVANCE if wide else NARROW_ADVANCE


def text_length(text: str, size: float, tracking: float) -> float:
    return sum(advance(c) * size + tracking for c in text)


# ---------------------------------------------------------------- 曲線の弧長表


class Curve:
    """標本点の列 (x, y) と、そこまでの弧長。弧長 s から位置と接線の向きを引く."""

    def __init__(self, points: list[tuple[float, float]]) -> None:
        self.points = points
        self.cumulative = [0.0]
        for a, b in zip(points, points[1:]):
            self.cumulative.append(self.cumulative[-1] + math.dist(a, b))

    @property
    def length(self) -> float:
        return self.cumulative[-1]

    def at(self, s: float) -> tuple[float, float, float]:
        """弧長 s の (x, y, 接線の向き (度。右向きが 0、時計回りが正))."""
        s = min(max(s, 0.0), self.length)
        lo, hi = 0, len(self.cumulative) - 1
        while hi - lo > 1:
            mid = (lo + hi) // 2
            if self.cumulative[mid] <= s:
                lo = mid
            else:
                hi = mid
        span = self.cumulative[hi] - self.cumulative[lo] or 1.0
        u = (s - self.cumulative[lo]) / span
        (x0, y0), (x1, y1) = self.points[lo], self.points[hi]
        x, y = x0 + (x1 - x0) * u, y0 + (y1 - y0) * u
        # 接線は前後の標本から取る。折れ線の継ぎ目でがたつかない
        a = self.points[max(lo - 1, 0)]
        b = self.points[min(hi + 1, len(self.points) - 1)]
        return x, y, math.degrees(math.atan2(b[1] - a[1], b[0] - a[0]))


def ring_point(cx: float, cy: float, radius: float, deg: float) -> tuple[float, float]:
    rad = math.radians(deg)
    return cx + radius * math.sin(rad), cy - radius * math.cos(rad)


def ring_curve(
    cx: float, cy: float, radius: float, start: float, sweep: float
) -> Curve:
    """12 時 = 0・時計回りが正の角度で、start から sweep 度ぶんの円弧."""
    steps = max(2, math.ceil(abs(sweep) / SAMPLE_STEP_DEG))
    return Curve(
        [
            ring_point(cx, cy, radius, start + sweep * i / steps)
            for i in range(steps + 1)
        ]
    )


def spiral_curve(
    cx: float, cy: float, r0: float, r1: float, start: float, sweep: float
) -> Curve:
    steps = max(2, math.ceil(abs(sweep) / SAMPLE_STEP_DEG))
    points = []
    for i in range(steps + 1):
        u = i / steps
        points.append(ring_point(cx, cy, r0 + (r1 - r0) * u, start + sweep * u))
    return Curve(points)


def wave_curve(
    x0: float, y0: float, amp: float, wavelength: float, reach: float
) -> Curve:
    steps = max(2, math.ceil(reach / SAMPLE_STEP_PX))
    return Curve(
        [
            (
                x0 + reach * i / steps,
                y0 + amp * math.sin(2 * math.pi * (reach * i / steps) / wavelength),
            )
            for i in range(steps + 1)
        ]
    )


# ---------------------------------------------------------------- 字の配置


def place_glyphs(
    text: str,
    curve: Curve,
    args: argparse.Namespace,
    *,
    offset: float,
    tracking: float,
) -> list[dict[str, Any]]:
    """文字列を曲線の弧長に沿って並べる。offset は最初の字の手前までの弧長."""
    glyphs: list[dict[str, Any]] = []
    cursor = offset
    for char in text:
        width = advance(char) * args.size
        if not char.isspace():
            x, y, tangent = curve.at(cursor + width / 2)
            if args.anchor == "baseline":
                # 字の下端を曲線に載せるため、曲線の上側へずらす
                # (接線を反時計回りへ 90 度回した向き)
                rad = math.radians(tangent)
                x += math.sin(rad) * args.size * BASELINE_SHIFT
                y -= math.cos(rad) * args.size * BASELINE_SHIFT
            glyphs.append(
                {
                    "char": char,
                    "x": round(x, 2),
                    "y": round(y, 2),
                    "rotation": round(tangent, 2),
                }
            )
        cursor += width + tracking
    return glyphs


# ---------------------------------------------------------------- HTML


def layer_html(glyphs: list[dict[str, Any]], args: argparse.Namespace) -> str:
    fill = "transparent" if args.outline else args.color
    stroke = (
        f"-webkit-text-stroke:{args.stroke}px {args.stroke_color};"
        "paint-order:stroke fill;"
        if args.outline or args.stroke
        else ""
    )
    spans = "".join(
        f'<span class="g" style="left:{g["x"]}px;top:{g["y"]}px;'
        f'transform:translate(-50%,-50%) rotate({g["rotation"]}deg)">{g["char"]}</span>'
        for g in glyphs
    )
    css = (
        ".tp-spin{position:absolute;inset:0;"
        f"transform-origin:{args.cx}px {args.cy}px}}"
        ".tp-spin .g{position:absolute;white-space:pre;line-height:1;"
        f"font:{args.weight} {args.size}px/1 {FONTS[args.font]};"
        f"color:{fill};{stroke}}}"
    )
    steps = []
    if glyphs and args.reveal > 0:
        each = min(args.reveal, MAX_STAGGER_TOTAL / max(len(glyphs) - 1, 1))
        steps.append(
            "tl.fromTo(root.querySelectorAll('.g'),{opacity:0},"
            "{opacity:1,duration:0.3,ease:'power2.out',"
            f"stagger:{round(each, 4)}}},t0);"
        )
    if args.spin:
        steps.append(
            "tl.fromTo(root.querySelector('.tp-spin'),"
            f"{{rotation:{args.spin_from}}},"
            f"{{rotation:{args.spin_from + args.spin},duration:{args.duration},"
            "ease:'none'},t0);"
        )
    script = f"<script>{''.join(steps)}</script>" if steps else ""
    return f'<style>{css}</style><div class="tp-spin">{spans}</div>{script}'


# ---------------------------------------------------------------- コマンド


def build(args: argparse.Namespace) -> dict[str, Any]:
    text = args.text.strip("\n")
    if not text.strip():
        fail("--text に 1 字以上の文字が要る")
    if not ID_PATTERN.match(args.id):
        fail("--id は英数字・_・- の 1〜64 字")
    tracking = args.tracking
    total = text_length(text, args.size, tracking)
    curve, offset = make_curve(args, total)
    if args.fit:
        # 曲線の長さに収まるよう、字間だけを足し引きする
        tracking += (curve.length - total) / max(len(text), 1)
        offset = 0.0
    glyphs = place_glyphs(text, curve, args, offset=offset, tracking=tracking)
    layer: dict[str, Any] = {
        "id": args.id,
        "name": args.name or args.id,
        "place": args.place,
        "start": args.at,
        "html": layer_html(glyphs, args),
    }
    if args.layer_duration is not None:
        layer["duration"] = args.layer_duration
    return {
        "layer": layer,
        "glyphs": glyphs,
        "length_px": round(curve.length, 1),
        "text_px": round(total, 1),
        "note": "回すのは親 1 本。読ませる語は半周ごとに止める。"
        "曲線より文字が長いと端で重なるので --fit か --size を見直す。",
    }


def make_curve(args: argparse.Namespace, total: float) -> tuple[Curve, float]:
    if args.shape == "ring":
        inward = args.side == "in"
        start = args.start if args.start is not None else (180.0 if inward else 0.0)
        sweep = -360.0 if inward else 360.0
        curve = ring_curve(args.cx, args.cy, args.radius, start, sweep)
        return curve, 0.0
    if args.shape == "arc":
        sweep = args.to_deg - args.from_deg
        curve = ring_curve(args.cx, args.cy, args.radius, args.from_deg, sweep)
        # 円弧の中央へ寄せる (短ければ両端が空き、長ければ両端からはみ出す)
        return curve, (curve.length - total) / 2
    if args.shape == "spiral":
        start = args.start if args.start is not None else 0.0
        curve = spiral_curve(
            args.cx, args.cy, args.r0, args.r1, start, 360.0 * args.turns
        )
        return curve, 0.0
    reach = max(total * 1.5, args.wavelength)
    curve = wave_curve(args.x0, args.y0, args.amp, args.wavelength, reach)
    return curve, 0.0


def parse_frame(raw: str) -> tuple[int, int]:
    match = re.fullmatch(r"(\d+)x(\d+)", raw)
    if not match:
        message = "--frame は 1920x1080 の形"
        raise argparse.ArgumentTypeError(message)
    return int(match.group(1)), int(match.group(2))


def common(sub: argparse.ArgumentParser) -> None:
    sub.add_argument("--text", required=True, help="並べる文字列 (空白も幅に数える)")
    sub.add_argument("--size", type=float, default=54.0, help="字高 (px)")
    sub.add_argument("--tracking", type=float, default=0.0, help="字間に足す px")
    sub.add_argument("--font", choices=tuple(FONTS), default="serif")
    sub.add_argument("--weight", type=int, choices=(400, 700, 900), default=400)
    sub.add_argument("--color", default="#ffffff")
    sub.add_argument("--outline", action="store_true", help="中抜き (縁だけ)")
    sub.add_argument("--stroke", type=float, default=0.0, help="縁の太さ (px)")
    sub.add_argument("--stroke-color", default="#ffffff")
    sub.add_argument("--anchor", choices=("baseline", "center"), default="baseline")
    sub.add_argument("--fit", action="store_true", help="曲線の長さに字間で合わせる")
    sub.add_argument("--frame", type=parse_frame, default=(1920, 1080))
    sub.add_argument("--cx", type=float, help="中心 x (既定はフレームの中央)")
    sub.add_argument("--cy", type=float, help="中心 y (既定はフレームの中央)")
    sub.add_argument(
        "--reveal", type=float, default=0.04, help="字ごとの出現の間隔 (秒)"
    )
    sub.add_argument("--spin", type=float, default=0.0, help="回す度数 (時計回りが正)")
    sub.add_argument("--spin-from", type=float, default=0.0)
    sub.add_argument("--duration", type=float, default=8.0, help="回す秒数")
    sub.add_argument("--id", default="text-path")
    sub.add_argument("--name")
    sub.add_argument("--place", choices=("front", "back"), default="front")
    sub.add_argument(
        "--at", type=float, default=0.0, help="レイヤーの出 (シーン内の秒)"
    )
    sub.add_argument(
        "--layer-duration", type=float, help="レイヤーの尺 (省略は終わりまで)"
    )
    sub.add_argument(
        "--ops", action="store_true", help="patch_previz_scene の操作で出す"
    )


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    sub = parser.add_subparsers(dest="shape", required=True)

    p = sub.add_parser("ring", help="円周に沿って並べる")
    common(p)
    p.add_argument("--radius", type=float, default=300.0)
    p.add_argument("--side", choices=("out", "in"), default="out")
    p.add_argument("--start", type=float, help="最初の字の角度 (12 時 = 0)")

    p = sub.add_parser("arc", help="円弧に沿って並べる")
    common(p)
    p.add_argument("--radius", type=float, default=300.0)
    p.add_argument("--from-deg", type=float, default=-60.0)
    p.add_argument("--to-deg", type=float, default=60.0)

    p = sub.add_parser("spiral", help="渦巻きに沿って並べる")
    common(p)
    p.add_argument("--r0", type=float, default=400.0, help="始まりの半径")
    p.add_argument("--r1", type=float, default=120.0, help="終わりの半径")
    p.add_argument("--turns", type=float, default=1.5)
    p.add_argument("--start", type=float, help="最初の角度 (12 時 = 0)")
    # 渦は曲線全体へ字を広げる。短い文字列だと始めの弧にしか載らず、渦に見えない
    p.set_defaults(fit=True)
    p.add_argument(
        "--no-fit",
        dest="fit",
        action="store_false",
        help="字間を足さず、始めの弧だけに並べる",
    )

    p = sub.add_parser("wave", help="正弦波に沿って並べる")
    common(p)
    p.add_argument("--x0", type=float, default=0.0)
    p.add_argument("--y0", type=float, default=540.0)
    p.add_argument("--amp", type=float, default=40.0)
    p.add_argument("--wavelength", type=float, default=400.0)
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    width, height = args.frame
    if args.cx is None:
        args.cx = width / 2
    if args.cy is None:
        args.cy = height / 2
    result = build(args)
    if args.ops:
        result["ops"] = [{"op": "add", "path": "/layers/-", "value": result["layer"]}]
    json.dump(result, sys.stdout, ensure_ascii=False)
    sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
