r"""ビート表の位置 (全体に対する割合) を目標尺の秒に直し、箱書きの尺と突き合わせる.

    python3 <SKILL_DIR>/scripts/beat_position.py --sheet stc|short --target <秒> \\
        [--boxes <boxes.json>] [--json]

## 何のためにあるか

ビートの型は**位置を割合で**書く (genre-playbook の references/beat-sheets.md)。
「ミッドポイントは 50%」を 7 分の作品の何秒にするか、箱書きの概算尺を積んだとき
どのビートがどの箱に落ちるかは割り算と足し算なので、手でやらない。

- `--sheet stc`: セーブ・ザ・キャットの 15 ビート (§1)
- `--sheet short`: 短尺の 5 ブロック (§5。60 秒での位置を目標尺へ比例で伸縮)
- `--boxes`: 箱書きの行 `[{"title": ..., "seconds": ...}]`。合計を目標尺と比べ、
  各ビートが何番目の箱に落ちるかを出す

位置は**目安**で、壊れるのは順番と有無のほう (beat-sheets.md §1)。所見は合計の
過不足だけを出す。

標準ライブラリだけ。終了コード: 0 = 所見なし / 1 = 所見あり / 2 = 読めなかった.
"""

from __future__ import annotations

import argparse
import json
import sys
from itertools import accumulate
from pathlib import Path
from typing import Any

#: beat-sheets.md §1 (位置 %)
STC: tuple[tuple[str, float], ...] = (
    ("オープニング・イメージ", 1),
    ("テーマの提示", 5),
    ("セットアップ", 1),
    ("きっかけ", 11),
    ("悩みの時間", 11),
    ("第一幕の転換", 23),
    ("サブプロット", 27),
    ("お楽しみ", 27),
    ("ミッドポイント", 50),
    ("敵が迫る", 50),
    ("すべてを失う", 68),
    ("心の暗闇", 68),
    ("第三幕の転換", 77),
    ("フィナーレ", 77),
    ("ファイナル・イメージ", 100),
)
#: beat-sheets.md §5 (60 秒での開始秒 → 割合)
SHORT: tuple[tuple[str, float], ...] = (
    ("フック", 0 / 60 * 100),
    ("設定", 3 / 60 * 100),
    ("展開", 10 / 60 * 100),
    ("山", 30 / 60 * 100),
    ("オチ", 48 / 60 * 100),
)
SHEETS = {"stc": STC, "short": SHORT}
#: 箱書きの合計が目標尺から外れたとみなす幅
TOLERANCE = 0.1


def positions(sheet: str, target: float) -> list[dict[str, Any]]:
    return [
        {"beat": name, "percent": round(pct, 1), "at_sec": round(target * pct / 100, 1)}
        for name, pct in SHEETS[sheet]
    ]


def _box_of(at: float, ends: list[float]) -> int:
    return next((i + 1 for i, end in enumerate(ends) if at < end), len(ends))


def place(
    beats: list[dict[str, Any]], boxes: list[dict[str, Any]]
) -> list[dict[str, Any]]:
    ends = list(accumulate(float(b.get("seconds") or 0) for b in boxes))
    return [{**b, "box": _box_of(b["at_sec"], ends)} for b in beats] if ends else beats


def total_findings(boxes: list[dict[str, Any]], target: float) -> list[str]:
    total = sum(float(b.get("seconds") or 0) for b in boxes)
    if not boxes or abs(total - target) <= target * TOLERANCE:
        return []
    side = "足りない" if total < target else "超えている"
    return [f"箱書きの合計 {total:g} 秒は目標 {target:g} 秒に{side} (±{TOLERANCE:.0%})"]


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=(__doc__ or "").splitlines()[0])
    parser.add_argument("--sheet", choices=list(SHEETS), required=True)
    parser.add_argument("--target", type=float, required=True, help="目標尺 (秒)")
    parser.add_argument("--boxes", help="箱書きの JSON")
    parser.add_argument("--json", action="store_true", help="JSON で出す")
    args = parser.parse_args(argv)
    try:
        boxes = json.loads(Path(args.boxes).read_text("utf-8")) if args.boxes else []
    except (OSError, ValueError) as exc:
        print(f"読めなかった: {exc}", file=sys.stderr)
        return 2
    beats = place(positions(args.sheet, args.target), boxes)
    report = {"beats": beats, "findings": total_findings(boxes, args.target)}
    if args.json:
        print(json.dumps(report, ensure_ascii=False))
    else:
        rows = [
            f"{b['at_sec']:>7.1f}s {b['beat']}"
            + (f" (箱 {b['box']})" if "box" in b else "")
            for b in beats
        ]
        print("\n".join(rows + [f"! {f}" for f in report["findings"]]))
    return 1 if report["findings"] else 0


if __name__ == "__main__":
    sys.exit(main())
