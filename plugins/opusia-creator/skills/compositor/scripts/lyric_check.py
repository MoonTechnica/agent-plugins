"""MV の歌詞クリップを、曲の地図の `lyric_lines[]` と時刻で突き合わせる.

    python3 <SKILL_DIR>/scripts/lyric_check.py <index.html> --map <map.json> [--json]

## 何のためにあるか

歌詞は「行の 1〜2 コマ前に出し、`end_sec` + 0.2〜0.5 秒で消す。次の行まで
出し続けない」(SKILL.md「MV の歌詞」)。出入りの秒は本文の `data-start` /
`data-duration` と地図の時刻だけで決まるので、保存版を読んで目で測らない。

## 入れるもの

- 位置引数: 歌詞が載っているファイル (`index.html` か字幕のサブ composition)
- `--map`: 曲の地図の doc (`get_document(<地図>)`。`lyric_lines[]` を読む)
- `--fps`: コマの秒数 (既定 24)

歌詞のクリップは、**`data-start` を持つ要素の文字**が行の文字を含むもので見分ける
(空白は無視)。1 行も載っていなければ「出さない企画」として何も言わない。

## やらないこと

- 位置 (顔や口を覆わないか)・読めるか・動き … 画を見る判断
- 文字の正誤 … 正本は地図。文字起こしと比べない

標準ライブラリだけ。終了コード: 0 = 所見なし / 1 = 所見あり / 2 = 読めなかった.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import dataclass
from html.parser import HTMLParser
from pathlib import Path
from typing import Any

#: 出は行の頭の 1〜2 コマ前 / 消えは end + 0.2〜0.5 秒 (SKILL.md「MV の歌詞」)
EARLY_FRAMES = 2
OUT_AFTER = (0.2, 0.5)
#: 地図の聴き取りと丸めの余白
TOLERANCE = 0.05
SPACE = re.compile(r"\s+")


@dataclass
class Caption:
    start: float
    end: float
    text: str = ""


def _number(raw: str | None) -> float | None:
    try:
        return float(raw) if raw is not None else None
    except ValueError:
        return None


class _Collector(HTMLParser):
    """`data-start` を持つ要素ごとに、その中の文字を集める."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.captions: list[Caption] = []
        self._open: list[tuple[str, Caption | None]] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        found = dict(attrs)
        start = _number(found.get("data-start"))
        duration = _number(found.get("data-duration"))
        end = _number(found.get("data-end"))
        if start is not None and (end is not None or duration is not None):
            caption = Caption(
                start, end if end is not None else start + (duration or 0)
            )
            self.captions.append(caption)
            self._open.append((tag, caption))
        else:
            self._open.append((tag, None))

    def handle_endtag(self, tag: str) -> None:
        while self._open:
            name, _ = self._open.pop()
            if name == tag:
                return

    def handle_data(self, data: str) -> None:
        for _, caption in self._open:
            if caption is not None:
                caption.text += data


def captions_of(html: str) -> list[Caption]:
    collector = _Collector()
    collector.feed(html)
    return [c for c in collector.captions if _plain(c.text)]


def _plain(text: str) -> str:
    return SPACE.sub("", text)


def _match(
    lines: list[dict[str, Any]], captions: list[Caption]
) -> list[Caption | None]:
    """行ごとに、文字を含むクリップを頭の近い順に 1 つ割り当てる."""
    free = list(captions)
    picked: list[Caption | None] = []
    for line in lines:
        text = _plain(str(line.get("text") or ""))
        hits = [c for c in free if text and text in _plain(c.text)]
        best = min(
            hits, key=lambda c: abs(c.start - float(line["start_sec"])), default=None
        )
        if best is not None:
            free.remove(best)
        picked.append(best)
    return picked


def _entry(early: float, fps: float) -> tuple[str, str] | None:
    if early < -TOLERANCE:
        return ("late_in", f"{-early:.2f} 秒遅れて出る (1〜2 コマ前に出す)")
    if early > EARLY_FRAMES / fps + TOLERANCE:
        return ("early_in", f"{early:.2f} 秒早く出る (1〜2 コマ前まで)")
    return None


def _exit(tail: float) -> tuple[str, str] | None:
    if OUT_AFTER[0] - TOLERANCE <= tail <= OUT_AFTER[1] + TOLERANCE:
        return None
    return ("out_timing", f"消えが end から {tail:+.2f} 秒 (+0.2〜+0.5)")


def _linger(cap: Caption, upcoming: float | None) -> tuple[str, str] | None:
    if upcoming is None or cap.end <= upcoming + TOLERANCE:
        return None
    return ("lingers", f"次の行 ({upcoming:g} 秒) まで居残る")


def _line_findings(
    lines: list[dict[str, Any]], i: int, cap: Caption | None, fps: float
) -> list[dict[str, str]]:
    line = lines[i]
    label = f"行 {i + 1}「{line.get('text')}」"
    if cap is None:
        return [{"code": "missing_line", "message": f"{label}が画面に無い"}]
    upcoming = float(lines[i + 1]["start_sec"]) if i + 1 < len(lines) else None
    found = (
        _entry(float(line["start_sec"]) - cap.start, fps),
        _exit(cap.end - float(line["end_sec"])),
        _linger(cap, upcoming),
    )
    return [
        {"code": code, "message": f"{label}: {msg}"}
        for code, msg in filter(None, found)
    ]


def check(html: str, audio_map: dict[str, Any], fps: float) -> dict[str, Any]:
    lines = [ln for ln in audio_map.get("lyric_lines") or [] if "start_sec" in ln]
    picked = _match(lines, captions_of(html))
    if not any(picked):
        return {"matched": [], "findings": []}
    return {
        "matched": [
            {"line": i, "start": c.start, "end": c.end}
            for i, c in enumerate(picked)
            if c is not None
        ],
        "findings": [
            f
            for i, cap in enumerate(picked)
            for f in _line_findings(lines, i, cap, fps)
        ],
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=(__doc__ or "").splitlines()[0])
    parser.add_argument("html", help="歌詞が載っている本文")
    parser.add_argument("--map", required=True, help="曲の地図の doc (JSON)")
    parser.add_argument("--fps", type=float, default=24.0)
    parser.add_argument("--json", action="store_true", help="JSON で出す")
    args = parser.parse_args(argv)
    try:
        html = Path(args.html).read_text("utf-8")
        audio_map = json.loads(Path(args.map).read_text("utf-8"))
    except (OSError, ValueError) as exc:
        print(f"読めなかった: {exc}", file=sys.stderr)
        return 2
    out = check(html, audio_map, args.fps)
    if args.json:
        print(json.dumps(out, ensure_ascii=False))
    else:
        print(
            "\n".join(f"[{f['code']}] {f['message']}" for f in out["findings"])
            or "所見なし"
        )
    return 1 if out["findings"] else 0


if __name__ == "__main__":
    sys.exit(main())
