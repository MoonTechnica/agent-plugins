"""撮影済み素材の文字起こしから、切れ目の候補と `plan_footage_scenes` の区間を作る.

    python3 <SKILL_DIR>/scripts/footage_segments.py <transcript.json> [--pick <p.json>]

## 何のためにあるか

撮影済み素材は**話の単位で切り、言い直し・咳・沈黙は区間の外に出し、カット尻に
0.3〜0.5 秒の余白を足し、時系列順で重ねない** (references/other-formats.md §1)。
行と行の間の空きと余白の足し算は機械で決まるので、手で秒を数えない。

## 入れるもの

- 位置引数: 文字起こしの行 `[{"start_sec", "end_sec", "text"}, ...]`
  (`read_transcript` の `[MM:SS.s-MM:SS.s] 本文` を読んだもの。`{"lines": [...]}` も可)
- `--pick`: 使う区間 `[{"from": 行番号, "to": 行番号, "title": ..., "note": ...}]`
  (行番号は 1 始まり・両端含む)。渡すと `plan_footage_scenes` の `segments` を出す

## 出すもの

- `pauses`: 行間の空き (0.7 秒以上。沈黙・言い直しの切れ目の候補)
- `segments`: 余白 (尻 +0.4 秒・頭 -0.1 秒。隣と重ならない範囲で) を足した ms の区間

標準ライブラリだけ。終了コード: 0 = 所見なし / 1 = 所見あり / 2 = 読めなかった.
"""

from __future__ import annotations

import argparse
import json
import sys
from collections.abc import Iterable, Iterator
from itertools import tee
from pathlib import Path
from typing import Any, TypeVar

_T = TypeVar("_T")


def pairwise(items: Iterable[_T]) -> Iterator[tuple[_T, _T]]:
    """隣り合う 2 つずつ (pairwise は 3.10 から。macOS の python3 は 3.9)."""
    first, second = tee(items)
    next(second, None)
    return zip(first, second)


#: 切れ目の候補にする行間の空き (秒)
PAUSE_MIN = 0.7
#: カット尻の余白 (other-formats.md §1: 0.3〜0.5 秒) と、頭の食い込み防止
TAIL_PAD = 0.4
HEAD_PAD = 0.1


def lines_of(payload: Any) -> list[dict[str, Any]]:  # noqa: ANN401
    rows = payload.get("lines") if isinstance(payload, dict) else payload
    return sorted(
        (r for r in rows or [] if isinstance(r, dict) and "start_sec" in r),
        key=lambda r: float(r["start_sec"]),
    )


def pauses(lines: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [
        {
            "after_line": i + 1,
            "start_sec": float(a["end_sec"]),
            "seconds": round(float(b["start_sec"]) - float(a["end_sec"]), 3),
        }
        for i, (a, b) in enumerate(pairwise(lines))
        if float(b["start_sec"]) - float(a["end_sec"]) >= PAUSE_MIN
    ]


def _bounds(lines: list[dict[str, Any]], pick: dict[str, Any]) -> tuple[float, float]:
    first, last = int(pick["from"]) - 1, int(pick["to"]) - 1
    start = float(lines[first]["start_sec"]) - HEAD_PAD
    end = float(lines[last]["end_sec"]) + TAIL_PAD
    floor = float(lines[first - 1]["end_sec"]) if first > 0 else 0.0
    ceiling = float(lines[last + 1]["start_sec"]) if last + 1 < len(lines) else end
    return max(start, floor, 0.0), min(end, ceiling)


def segments(
    lines: list[dict[str, Any]], picks: list[dict[str, Any]]
) -> list[dict[str, Any]]:
    out = []
    for pick in picks:
        start, end = _bounds(lines, pick)
        out.append(
            {
                "start_ms": round(start * 1000),
                "end_ms": round(end * 1000),
                "title": pick.get("title") or "",
                "note": pick.get("note") or "",
            }
        )
    return out


def overlaps(found: list[dict[str, Any]]) -> list[str]:
    return [
        f"区間 {i + 1} と {i + 2} が重なるか順が逆 (時系列順で重ねない)"
        for i, (a, b) in enumerate(pairwise(found))
        if b["start_ms"] < a["end_ms"]
    ]


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=(__doc__ or "").splitlines()[0])
    parser.add_argument("transcript", help="文字起こしの行の JSON")
    parser.add_argument("--pick", help="使う区間 (行番号) の JSON")
    parser.add_argument("--json", action="store_true", help="JSON で出す")
    args = parser.parse_args(argv)
    try:
        lines = lines_of(json.loads(Path(args.transcript).read_text("utf-8")))
        picks = json.loads(Path(args.pick).read_text("utf-8")) if args.pick else []
        found = segments(lines, picks)
    except (OSError, ValueError, IndexError, KeyError) as exc:
        print(f"読めなかった: {exc}", file=sys.stderr)
        return 2
    report = {"pauses": pauses(lines), "segments": found, "findings": overlaps(found)}
    if args.json:
        print(json.dumps(report, ensure_ascii=False))
    else:
        print(json.dumps(report, ensure_ascii=False, indent=2))
    return 1 if report["findings"] else 0


if __name__ == "__main__":
    sys.exit(main())
