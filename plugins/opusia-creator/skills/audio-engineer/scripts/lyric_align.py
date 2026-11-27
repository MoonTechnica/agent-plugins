r"""正本の歌詞の各行に、文字起こしの時刻を割り当てて `lyric_lines[]` を作る.

    python3 <SKILL_DIR>/scripts/lyric_align.py --lyrics <歌詞.txt> \\
        --transcript <transcript.json> [--map <audio_map.json>] [--json]

## 何のためにあるか

歌詞の**文字の正本**は渡された歌詞 (無ければ地図の `phrases[].lyric`)、**時刻**は
文字起こしから取る (SKILL.md「歌のある曲は、地図の直後に歌詞の時刻を取る」の 3)。
聴き取りは誤字が出るので、文字は似ている度合いで突き合わせて時刻だけを写す。
手で 1 行ずつ探すと取り違えるので、ここが順に割り当てる。

## 入れるもの

- `--lyrics`: 正本の歌詞 (1 行 1 行。空行は区切りとして捨てる)
- `--transcript`: 文字起こしの行 `[{"start_sec", "end_sec", "text"}, ...]`
  (`read_transcript` の行を読んだもの。`{"lines": [...]}` も可)
- `--map`: 曲の地図の doc。渡すと `lyric_lines` を入れた地図を出す
  (そのまま `put_document(asset_id=<地図>)` で書き戻す)

## 出すもの

`lyric_lines` (`start_sec` / `end_sec` / `text` / `section` /
`source: "transcript"`) と、
文字起こしに見つからなかった行 (`missing`。手元の歌詞から補い `source: "agent"`)。

標準ライブラリだけ。終了コード: 0 = 全行に時刻 / 1 = 見つからない行あり /
2 = 読めなかった.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from difflib import SequenceMatcher
from pathlib import Path
from typing import Any

#: 1 行に束ねる文字起こしの行の最大数 / 先を探す行数
MAX_SPAN = 3
LOOKAHEAD = 4
#: 似ていると見なす下限 (聴き取りの誤字を許す)
MIN_RATIO = 0.5
NOISE = re.compile(r"[\s、。，．・「」『』!?！？…~〜ー\-()（）]")  # noqa: RUF001


def _plain(text: str) -> str:
    return NOISE.sub("", text).lower()


def _ratio(a: str, b: str) -> float:
    return SequenceMatcher(None, _plain(a), _plain(b)).ratio()


def _best(lyric: str, lines: list[dict[str, Any]], at: int) -> tuple[float, int, int]:
    """(似ている度合い, 先頭, 行数). 先頭は at から LOOKAHEAD 行の中で探す."""
    candidates = [
        (_ratio(lyric, "".join(str(x["text"]) for x in lines[k : k + n])), k, n)
        for k in range(at, min(at + LOOKAHEAD, len(lines)))
        for n in range(1, MAX_SPAN + 1)
        if k + n <= len(lines)
    ]
    return max(candidates, default=(0.0, at, 0))


def _section(at: float, sections: list[dict[str, Any]]) -> str | None:
    return next(
        (
            str(s.get("label"))
            for s in sections
            if float(s.get("start_sec", 0)) <= at < float(s.get("end_sec", 0))
        ),
        None,
    )


def align(
    lyrics: list[str], lines: list[dict[str, Any]], sections: list[dict[str, Any]]
) -> dict[str, Any]:
    found: list[dict[str, Any]] = []
    missing: list[str] = []
    at = 0
    for lyric in lyrics:
        ratio, start, span = _best(lyric, lines, at)
        if span == 0 or ratio < MIN_RATIO:
            missing.append(lyric)
            continue
        first, last = lines[start], lines[start + span - 1]
        begin = float(first["start_sec"])
        found.append(
            {
                "start_sec": begin,
                "end_sec": float(last["end_sec"]),
                "text": lyric,
                "section": _section(begin, sections),
                "source": "transcript",
            }
        )
        at = start + span
    return {"lyric_lines": found, "missing": missing}


def _lines(payload: Any) -> list[dict[str, Any]]:  # noqa: ANN401
    rows = payload.get("lines") if isinstance(payload, dict) else payload
    return sorted(
        (r for r in rows or [] if isinstance(r, dict) and "start_sec" in r),
        key=lambda r: float(r["start_sec"]),
    )


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=(__doc__ or "").splitlines()[0])
    parser.add_argument("--lyrics", required=True)
    parser.add_argument("--transcript", required=True)
    parser.add_argument("--map")
    parser.add_argument("--json", action="store_true", help="JSON で出す")
    args = parser.parse_args(argv)
    try:
        lyrics = [
            ln.strip() for ln in Path(args.lyrics).read_text("utf-8").splitlines()
        ]
        lines = _lines(json.loads(Path(args.transcript).read_text("utf-8")))
        audio_map = json.loads(Path(args.map).read_text("utf-8")) if args.map else None
    except (OSError, ValueError) as exc:
        print(f"読めなかった: {exc}", file=sys.stderr)
        return 2
    sections = (audio_map or {}).get("sections") or []
    out = align([ln for ln in lyrics if ln], lines, sections)
    if audio_map is not None:
        out["map"] = {**audio_map, "lyric_lines": out["lyric_lines"]}
    print(json.dumps(out, ensure_ascii=False, indent=None if args.json else 2))
    return 1 if out["missing"] else 0


if __name__ == "__main__":
    sys.exit(main())
