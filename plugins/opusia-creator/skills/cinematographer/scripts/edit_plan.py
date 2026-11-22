"""カットの部分修正に使うモデル・`max_seconds`・部品の数を、カットの秒数から決める.

    python3 <SKILL_DIR>/scripts/edit_plan.py --seconds 12.5 [--region eu] [--json]
    python3 <SKILL_DIR>/scripts/edit_plan.py --preview <preview.json> [--short-edge 720]

## 何のためにあるか

カットの差し替え (references/partial-edit.md §2) は、カットの秒数で使うモデルと
`max_seconds` が決まり、長いカットは部品に分かれる (継ぎ目の前後 0.5 秒ずつ重なる)。
表を引いて手で割り算しない。金額は `estimate_asset_generation` で引く (ここは出さない)。

## 入れるもの

- `--seconds`: カットの秒数 (`get_asset_preview` の `cuts[].seconds`)
- `--preview`: `get_asset_preview` の戻り値。全カットの計画を出す
- `--region eu`: EEA・スイス・英国 (gemini-omni-flash が使えない)
- `--short-edge`: テイクの短辺 (px)。Kling は 720 以上が要る

## 出すもの

カットごとに `model` / `max_seconds` / 部品の最少数 `parts` (実際の切り目は
`extract_cut` が画の動きの少ない所で決める)。

標準ライブラリだけ。終了コード: 0 = 計画できた / 1 = 注意あり / 2 = 読めなかった.
"""

from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path
from typing import Any

OMNI, KLING = "gemini-omni-flash", "kling-o3-pro"
#: 入力の上限 (partial-edit.md §2)
OMNI_MAX, KLING_MAX = 10.0, 15.0
#: Kling の入力の下限 (3 秒) と短辺 (720px)
KLING_MIN_SECONDS, KLING_MIN_EDGE = 3.0, 720
#: 継ぎ目の前後に重ねる秒 (§2.1: 0.5 秒ずつ → 1 継ぎ目で 1 秒)
SEAM_OVERLAP = 1.0


def parts_for(seconds: float, limit: float) -> int:
    """重なりを足しても limit に収まる最少の部品数."""
    if seconds <= limit:
        return 1
    return math.ceil((seconds - SEAM_OVERLAP) / (limit - SEAM_OVERLAP))


def _model(seconds: float, *, eu: bool) -> tuple[str, float]:
    """EU は Kling だけ. 他は 10 秒まで Omni・15 秒まで Kling・その先は Omni の部品."""
    kling_whole = eu or OMNI_MAX < seconds <= KLING_MAX
    return (KLING, KLING_MAX) if kling_whole else (OMNI, OMNI_MAX)


def _notes(model: str, seconds: float, short_edge: int | None) -> list[str]:
    if model != KLING:
        return ["解像度をテイクに揃える (360p / 720p / 1080p / 4k)。声は編集されない"]
    narrow = short_edge is not None and short_edge < KLING_MIN_EDGE
    return [
        *(
            [f"Kling は入力 {KLING_MIN_SECONDS:g} 秒以上が要る (短すぎる)"]
            if seconds < KLING_MIN_SECONDS
            else []
        ),
        *(
            [f"Kling は短辺 {KLING_MIN_EDGE}px 以上が要る (今 {short_edge}px)"]
            if narrow
            else []
        ),
    ]


def plan(seconds: float, *, eu: bool, short_edge: int | None) -> dict[str, Any]:
    model, limit = _model(seconds, eu=eu)
    return {
        "seconds": seconds,
        "model": model,
        "max_seconds": int(limit),
        "parts": parts_for(seconds, limit),
        "notes": _notes(model, seconds, short_edge),
    }


def _cut_seconds(args: argparse.Namespace) -> list[tuple[int | None, float]]:
    if args.preview:
        preview = json.loads(Path(args.preview).read_text("utf-8"))
        return [(int(c["cut"]), float(c["seconds"])) for c in preview.get("cuts") or []]
    return [(None, float(args.seconds))]


def _text(plans: list[dict[str, Any]]) -> str:
    return "\n".join(
        f"cut {p['cut']}: {p['seconds']:g}s → {p['model']}"
        f" max_seconds={p['max_seconds']} parts>={p['parts']}"
        + "".join(f"\n  ! {n}" for n in p["notes"])
        for p in plans
    )


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=(__doc__ or "").splitlines()[0])
    parser.add_argument("--seconds", type=float)
    parser.add_argument("--preview", help="get_asset_preview の JSON")
    parser.add_argument("--region", choices=["eu", "other"], default="other")
    parser.add_argument("--short-edge", type=int)
    parser.add_argument("--json", action="store_true", help="JSON で出す")
    args = parser.parse_args(argv)
    try:
        cuts = _cut_seconds(args)
    except (OSError, ValueError, TypeError, KeyError) as exc:
        print(f"読めなかった: {exc}", file=sys.stderr)
        return 2
    plans = [
        {"cut": cut, **plan(s, eu=args.region == "eu", short_edge=args.short_edge)}
        for cut, s in cuts
    ]
    print(
        json.dumps({"plans": plans}, ensure_ascii=False) if args.json else _text(plans)
    )
    return 1 if any(p["notes"] and p["model"] == KLING for p in plans) else 0


if __name__ == "__main__":
    sys.exit(main())
