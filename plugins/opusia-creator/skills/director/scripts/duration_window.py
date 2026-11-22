"""尺の指定 (「3 分」) を、納品物の `duration` 基準の窓 `{min_s, max_s}` にする.

    python3 <SKILL_DIR>/scripts/duration_window.py --minutes 3 [--json]
    python3 <SKILL_DIR>/scripts/duration_window.py --seconds 90

## 何のためにあるか

`declare_deliverable` の `duration` は**窓で**書く (ぴったりの秒は通らない)。
窓の幅は references/closing-the-loop.md の規則 (指定の 5/6 〜 10/9 倍。
「3 分なら 150〜200 秒」) で決まるので、その場で丸め方を考えない。

標準ライブラリだけ。終了コード: 0 = 出せた / 2 = 引数が読めなかった.
"""

from __future__ import annotations

import argparse
import json
import sys
from fractions import Fraction

#: closing-the-loop.md: 短い側は 1/6 まで、長い側は 1/9 まで許す (180 秒 → 150〜200)
LOWER, UPPER = Fraction(5, 6), Fraction(10, 9)


def window(seconds: float) -> dict[str, int]:
    exact = Fraction(seconds).limit_denominator()
    return {"min_s": round(exact * LOWER), "max_s": round(exact * UPPER)}


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=(__doc__ or "").splitlines()[0])
    given = parser.add_mutually_exclusive_group(required=True)
    given.add_argument("--seconds", type=float)
    given.add_argument("--minutes", type=float)
    parser.add_argument("--json", action="store_true", help="JSON で出す")
    args = parser.parse_args(argv)
    seconds = args.seconds if args.seconds is not None else args.minutes * 60
    params = window(seconds)
    out = {"kind": "duration", "params": params}
    print(json.dumps(out) if args.json else f"duration {params}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
