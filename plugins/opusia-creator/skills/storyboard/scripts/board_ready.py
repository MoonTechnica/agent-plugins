"""絵コンテのシートを描く前に、カットの文字が描ける状態かを見る.

    python3 <SKILL_DIR>/scripts/board_ready.py <cuts.json> [--json]

## 何のためにあるか

シートは**カットの記述から描かれる**ので、要約のまま・`shot` が空・尺が均等の
カットは、6 コマとも似た構図か読めない絵になる (SKILL.md §1・§2.5)。
**シートを作り直すより文字を直すほうが桁違いに安い**ので、描く前にここで見る。

## 入れるもの

`list_cuts(scene_id)` の戻り値。複数シーンは `[{"cuts": [...]}, ...]`。

## 見るもの

- 1 シーンのカット数が 6 を超える (同一性が崩れる。シーンを割る)
- `location` / `time_of_day` / `shot` が空
- `note` が短すぎる (動詞 1 個で止まっている目安: 12 字未満)
- 尺が全部同じ (3 カット以上)

所作 (箸・靴・お辞儀) と negative 語は `screenwriter` の `scripts/gesture_lint.py`。

標準ライブラリだけ。終了コード: 0 = 所見なし / 1 = 所見あり / 2 = 読めなかった.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

#: 1 枚に載せる上限 (SKILL.md §1: 6〜8 コマを超えると顔が破綻する)
MAX_PANELS = 6
#: これ未満の note は「動詞 1 個」の目安 (「食べる」「話す」)
MIN_NOTE_CHARS = 12
#: 均等を数えるカット数の下限
MIN_CUTS_FOR_EVEN = 3
REQUIRED = (("location", "場所"), ("time_of_day", "時間帯"), ("shot", "寄りとカメラ"))


def scenes_of(payload: Any) -> list[list[dict[str, Any]]]:  # noqa: ANN401
    if isinstance(payload, dict):
        payload = payload.get("cuts", [])
    items = payload if isinstance(payload, list) else []
    grouped = items and all(
        isinstance(i, dict) and isinstance(i.get("cuts"), list) for i in items
    )
    groups = [i["cuts"] for i in items] if grouped else [items]
    return [[c for c in g if isinstance(c, dict)] for g in groups]


def _key(cut: dict[str, Any]) -> str:
    return str(cut.get("key") or cut.get("id") or "?")


def _missing(cut: dict[str, Any]) -> list[str]:
    empty = [
        label for field, label in REQUIRED if not str(cut.get(field) or "").strip()
    ]
    if not empty:
        return []
    return [f"{_key(cut)}: {' / '.join(empty)} が空 (コマに何を描くか決まらない)"]


def _thin_note(cut: dict[str, Any]) -> list[str]:
    note = str(cut.get("note") or "").strip()
    if len(note) >= MIN_NOTE_CHARS:
        return []
    return [
        f"{_key(cut)}: note が「{note}」だけ。誰が何をどの手でどう動くかに割る"
        " (screenwriter に戻す)"
    ]


def _too_many(cuts: list[dict[str, Any]]) -> list[str]:
    if len(cuts) <= MAX_PANELS:
        return []
    return [
        f"{_key(cuts[0])}〜: {len(cuts)} カットは 1 枚に載らない"
        f" ({MAX_PANELS} まで。シーンを割る: move_cut)"
    ]


def _even(cuts: list[dict[str, Any]]) -> list[str]:
    lengths = {c.get("duration_seconds") for c in cuts}
    if len(cuts) < MIN_CUTS_FOR_EVEN or len(lengths) != 1:
        return []
    return [
        f"{_key(cuts[0])}〜: 尺が全部 {lengths.pop()} 秒 (編集していない映像になる)"
    ]


def check(scenes: list[list[dict[str, Any]]]) -> list[str]:
    per_cut = [f for s in scenes for c in s for f in (*_missing(c), *_thin_note(c))]
    per_scene = [f for s in scenes for f in (*_too_many(s), *_even(s))]
    return per_scene + per_cut


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=(__doc__ or "").splitlines()[0])
    parser.add_argument("cuts", help="list_cuts の JSON (- で標準入力)")
    parser.add_argument("--json", action="store_true", help="JSON で出す")
    args = parser.parse_args(argv)
    try:
        raw = (
            sys.stdin.read() if args.cuts == "-" else Path(args.cuts).read_text("utf-8")
        )
        scenes = scenes_of(json.loads(raw))
    except (OSError, ValueError) as exc:
        print(f"読めなかった: {exc}", file=sys.stderr)
        return 2
    findings = check(scenes)
    if args.json:
        print(json.dumps({"findings": findings}, ensure_ascii=False))
    else:
        print("\n".join(findings) or "所見なし")
    return 1 if findings else 0


if __name__ == "__main__":
    sys.exit(main())
