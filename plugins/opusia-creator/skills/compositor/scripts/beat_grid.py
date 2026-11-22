"""拍の格子 (compositor スキル). 標準ライブラリだけで動く.

音楽に合わせてカットを置くときの決定論的な計算。根拠は film-grammar の
references/beat-sync.md。拍は**絶対時刻**で持ち、置く拍だけ最寄りコマへ丸める
(毎拍丸めを累積すると 128 BPM・24fps で 32 拍後に 333 ms ずれる)。

  grid     アンカー (小節頭の時刻) から n 小節ごとのカット境界を出す
           t_cut = t_beat - lead (拍の 1〜2 コマ前)。--fps を渡すとコマへ丸めた値も
  fit      n 小節の尺 → 生成に頼む整数秒 (切り上げ) と、タイムラインで捨てる余り
  nearest  ある時刻に最も近い拍と、小節内の何拍目か

すべて `--json` で機械可読。人が読む既定の出力は 1〜3 行。

**MV では `--analysis <music_analysis.json>` を渡す**
(`get_document(<analysis_asset_id>)` の doc を保存したもの)。grid は計測の小節頭、
nearest は計測の拍をそのまま使い、`--bpm` / `--meter` / `--anchor` は計測から決まる。
BPM からの外挿は ±1 BPM で 1 分に約 1 拍ずれ、テンポの揺れにも付いていけない。
"""

from __future__ import annotations

import argparse
import json
import math
import sys
from bisect import bisect_left, bisect_right
from pathlib import Path
from typing import Any, NoReturn

EPSILON = 1e-9
# 「コマに乗る / 整数秒に乗る」の判定幅
WHOLE_TOLERANCE = 1e-6
# 「整数秒に乗る小節数」を探す範囲 (1 フレーズ 4 小節 x 4 = 16 小節まで)
MAX_BARS_TO_SCAN = 16


def _fail(message: str) -> NoReturn:
    raise SystemExit(message)


def _require(condition: bool, message: str) -> None:  # noqa: FBT001
    if not condition:
        _fail(message)


def _check_tempo(args: argparse.Namespace) -> None:
    _require(args.bpm is not None, "bpm: --bpm か --analysis (計測) を渡す")
    _require(args.bpm > 0, "bpm: 正の値 (拍/分)")
    _require(args.meter > 0, "meter: 1 小節の拍数は正の整数")


def _measured(args: argparse.Namespace) -> None:
    """計測を読み、テンポと拍子を埋める (明示した値より計測が優先)."""
    args.beats, args.downbeats = [], []
    if not args.analysis:
        return
    doc = json.loads(Path(args.analysis).read_text("utf-8"))
    args.beats = [float(b) for b in doc["beats_sec"]]
    args.downbeats = [float(d) for d in doc["downbeats_sec"]]
    args.bpm = float(doc["bpm_measured"])
    args.meter = int(doc["beats_per_bar"])


def _is_whole(value: float) -> bool:
    return abs(value - round(value)) < WHOLE_TOLERANCE


# ---------------------------------------------------------------- grid


def _cut(args: argparse.Namespace, k: int, step: float) -> dict[str, Any]:
    t_beat = args.anchor + k * step
    t_cut = t_beat - args.lead
    out: dict[str, Any] = {
        "bar": k * args.bars,
        "t_beat": round(t_beat, 4),
        "t_cut": round(t_cut, 4),
    }
    if args.fps:
        frame = round(t_cut * args.fps)
        out["t_cut_frame"] = frame
        out["t_cut_snapped"] = round(frame / args.fps, 4)
    return out


def _cuts(args: argparse.Namespace, step: float) -> list[dict[str, Any]]:
    first = math.ceil((args.from_ - args.anchor) / step - EPSILON)
    count = math.ceil((args.to - args.anchor) / step - EPSILON) - first
    return [_cut(args, first + i, step) for i in range(max(0, count))]


def _check_grid(args: argparse.Namespace) -> None:
    _check_tempo(args)
    _require(
        args.downbeats or args.anchor is not None, "anchor: --anchor か --analysis"
    )
    _require(args.bars > 0, "bars: 正の整数")
    _require(args.to > args.from_, "to: --from より後の時刻")
    _require(args.lead >= 0, "lead: 0 以上の秒")
    _require(args.fps is None or args.fps > 0, "fps: 正の値")


def _measured_cuts(args: argparse.Namespace) -> list[dict[str, Any]]:
    """計測の小節頭のうち [from, to) にあるものを n 小節おきに."""
    heads = args.downbeats
    first = bisect_left(heads, args.from_ - EPSILON)
    last = bisect_left(heads, args.to - EPSILON)
    out = []
    for bar in range(first, last, args.bars):
        args.anchor = heads[bar]
        out.append({**_cut(args, 0, 0.0), "bar": bar})
    return out


def cmd_grid(args: argparse.Namespace) -> dict[str, Any]:
    _check_grid(args)
    beat_sec = 60 / args.bpm
    bar_sec = beat_sec * args.meter
    cuts = _measured_cuts(args) if args.downbeats else _cuts(args, bar_sec * args.bars)
    return {
        "bpm": args.bpm,
        "meter": args.meter,
        "beat_sec": round(beat_sec, 4),
        "bar_sec": round(bar_sec, 4),
        "bars_per_cut": args.bars,
        "lead": args.lead,
        "cuts": cuts,
    }


# ---------------------------------------------------------------- fit


def _integer_bars(bar_sec: float) -> list[int]:
    return [n for n in range(1, MAX_BARS_TO_SCAN + 1) if _is_whole(n * bar_sec)]


def cmd_fit(args: argparse.Namespace) -> dict[str, Any]:
    _check_tempo(args)
    _require(args.bars > 0, "bars: 正の整数")
    bar_sec = 60 / args.bpm * args.meter
    duration = args.bars * bar_sec
    generate = math.ceil(duration - EPSILON)
    out: dict[str, Any] = {
        "bpm": args.bpm,
        "bars": args.bars,
        "bar_sec": round(bar_sec, 4),
        "duration_sec": round(duration, 4),
        "generate_sec": generate,
        "trim_sec": round(generate - duration, 4),
        "integer_bars": _integer_bars(bar_sec),
    }
    if args.fps:
        frames = duration * args.fps
        out["frames"] = round(frames, 3)
        out["on_frame"] = _is_whole(frames)
    return out


# ---------------------------------------------------------------- nearest


def _nearest_measured(args: argparse.Namespace) -> dict[str, Any]:
    beats, heads = args.beats, args.downbeats
    at = bisect_left(beats, args.time)
    index = min(
        (i for i in (at - 1, at) if 0 <= i < len(beats)),
        key=lambda i: abs(beats[i] - args.time),
    )
    t_beat = beats[index]
    bar = max(bisect_right(heads, t_beat + EPSILON) - 1, 0)
    in_bar = index - bisect_left(beats, heads[bar] - EPSILON)
    return {
        "beat_index": index,
        "t_beat": round(t_beat, 4),
        "offset_sec": round(args.time - t_beat, 4),
        "bar": bar,
        "beat_in_bar": in_bar + 1,
    }


def cmd_nearest(args: argparse.Namespace) -> dict[str, Any]:
    _check_tempo(args)
    if args.beats:
        return _nearest_measured(args)
    _require(args.anchor is not None, "anchor: --anchor か --analysis")
    beat_sec = 60 / args.bpm
    index = round((args.time - args.anchor) / beat_sec)
    t_beat = args.anchor + index * beat_sec
    return {
        "beat_index": index,
        "t_beat": round(t_beat, 4),
        "offset_sec": round(args.time - t_beat, 4),
        "bar": index // args.meter,
        "beat_in_bar": index % args.meter + 1,
    }


# ---------------------------------------------------------------- CLI


def build_parser() -> argparse.ArgumentParser:
    """サブコマンドを組む. `--json` はどのサブコマンドの後ろにも置ける."""
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    common = argparse.ArgumentParser(add_help=False)
    common.add_argument("--json", action="store_true", help="機械可読で出す")
    common.add_argument("--bpm", type=float, help="--analysis を渡せば不要")
    common.add_argument("--meter", type=int, default=4, help="1 小節の拍数. 既定 4")
    common.add_argument(
        "--analysis", help="曲の計測 (music_analysis.v1) の JSON. MV はこれを渡す"
    )
    sub = parser.add_subparsers(dest="command", required=True)

    grid = sub.add_parser("grid", parents=[common], help="n 小節ごとのカット境界")
    grid.add_argument("--anchor", type=float, help="小節頭の時刻 (秒)")
    grid.add_argument("--from", dest="from_", type=float, required=True)
    grid.add_argument("--to", type=float, required=True, help="この時刻は含まない")
    grid.add_argument("--bars", type=int, default=2, help="何小節ごとに切るか. 既定 2")
    grid.add_argument(
        "--lead", type=float, default=0.0, help="拍より前に置く秒. 0.04〜0.08"
    )
    grid.add_argument("--fps", type=float, help="渡すとコマへ丸めた値も出す")
    grid.set_defaults(func=cmd_grid)

    fit = sub.add_parser("fit", parents=[common], help="n 小節 → 生成の整数秒と余り")
    fit.add_argument("--bars", type=int, required=True)
    fit.add_argument("--fps", type=float, help="渡すとコマに乗るかも出す")
    fit.set_defaults(func=cmd_fit)

    nearest = sub.add_parser("nearest", parents=[common], help="時刻に最も近い拍")
    nearest.add_argument("--anchor", type=float, help="小節頭の時刻 (秒)")
    nearest.add_argument("--time", type=float, required=True)
    nearest.set_defaults(func=cmd_nearest)
    return parser


def _describe_grid(out: dict[str, Any]) -> str:
    times = ", ".join(str(c["t_cut"]) for c in out["cuts"])
    return (
        f"beat {out['beat_sec']} s / bar {out['bar_sec']} s,"
        f" every {out['bars_per_cut']} bars → {len(out['cuts'])} cuts at: {times}"
    )


def _describe_fit(out: dict[str, Any]) -> str:
    frame = f", {out['frames']} frames" if "frames" in out else ""
    return (
        f"{out['bars']} bars = {out['duration_sec']} s"
        f" → generate {out['generate_sec']} s, trim {out['trim_sec']} s{frame};"
        f" integer-second bar counts: {out['integer_bars']}"
    )


def _describe_nearest(out: dict[str, Any]) -> str:
    return (
        f"beat {out['beat_index']} at {out['t_beat']} s (offset {out['offset_sec']} s),"
        f" bar {out['bar']} beat {out['beat_in_bar']}"
    )


DESCRIBERS = {
    "grid": _describe_grid,
    "fit": _describe_fit,
    "nearest": _describe_nearest,
}


def main(argv: list[str] | None = None) -> int:
    """引数を読んで結果を標準出力へ."""
    args = build_parser().parse_args(argv)
    _measured(args)
    out = args.func(args)
    if args.json:
        print(json.dumps(out, ensure_ascii=False))
    else:
        print(DESCRIBERS[args.command](out))
    return 0


if __name__ == "__main__":
    sys.exit(main())
