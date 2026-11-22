r"""まばたきと口パクの時刻を出す (compositor スキル). 標準ライブラリだけ.

静止画を動かすシーン (references/motion-scene.md §3) で、差分の絵 (目を閉じた顔・
口を開けた顔) を**時刻で 1 枚だけ見せる**ための時刻表を作る。出力は
references/face-cues.html の `<script id="face-cues">` にそのまま貼る JSON。

  python3 face_cues.py --start 12.0 --duration 8 \
      [--map map.json | --transcript transcript.json] \
      [--speaker aoi=speaker_0 --speaker ren=speaker_1] [--singer A] \
      [--seed 1] [--fps 30] [--json]

- `--start` / `--duration` はシーンの頭 (曲・本編の絶対秒) と尺。
  出力はシーンの頭からの相対
- `--map` は曲の地図 (`get_document` の audio_map.v2)。`lyric_lines[]` の行の間だけ
  口が動く (口は `--singer` の名前。既定 A)
- `--transcript` は文字起こし (transcript.v1)。`words[]` の語の間だけ口が動く。
  話者が複数なら `--speaker <口の名前>=<speaker_id>` を人数ぶん (無ければ全員 A)
- まばたきは 2〜6 秒おきの不規則な間隔 (`--seed` で決まる)。閉じは 3 コマ

口は語 (行) の頭で必ず開き、0.12 秒開いて 0.08 秒閉じるのを語の終わりまで繰り返す。
語単位なので音 (モーラ) までは合わない —— 開閉 2〜3 段の口パクには足りる。

既定の出力は数行の要約。`--json` で機械可読。
"""

from __future__ import annotations

import argparse
import json
import random
import sys
from pathlib import Path
from typing import Any, NoReturn

OPEN_S = 0.12
"""口を開けている長さ (秒)."""
CLOSED_S = 0.08
"""開閉のあいだに閉じている長さ (秒)."""
BLINK_FRAMES = 3
"""まばたきで目を閉じているコマ数."""
FIRST_BLINK_S = (0.5, 2.0)
BLINK_GAP_S = (2.0, 6.0)

Span = tuple[float, float]


def _fail(message: str) -> NoReturn:
    print(message, file=sys.stderr)
    raise SystemExit(2)


def _load(path: str) -> dict[str, Any]:
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        _fail(f"{path}: expected a JSON object")
    return data


def _speaker_map(pairs: list[str]) -> dict[str, str]:
    """`label=speaker_id` を speaker_id → label に."""
    found: dict[str, str] = {}
    for pair in pairs:
        label, sep, speaker = pair.partition("=")
        if not sep or not label or not speaker:
            _fail(f"--speaker expects <label>=<speaker_id>, got {pair!r}")
        found[speaker] = label
    return found


def _spoken_from_transcript(
    doc: dict[str, Any], speakers: dict[str, str]
) -> dict[str, list[Span]]:
    words = [w for w in doc.get("words") or [] if w.get("type", "word") == "word"]
    _check_speakers(words, speakers)
    spans: dict[str, list[Span]] = {}
    for word in words:
        label = speakers.get(str(word.get("speaker_id"))) if speakers else "A"
        if label is not None:
            spans.setdefault(label, []).append(
                (float(word["start"]), float(word["end"]))
            )
    return spans


def _check_speakers(words: list[dict[str, Any]], speakers: dict[str, str]) -> None:
    present = sorted({str(w.get("speaker_id")) for w in words if w.get("speaker_id")})
    missing = sorted(set(speakers) - set(present))
    if missing:
        _fail(f"speaker ids {missing} are not in the transcript (it has {present})")


def _spoken_from_map(doc: dict[str, Any], singer: str) -> dict[str, list[Span]]:
    lines = doc.get("lyric_lines") or []
    if not lines:
        return {}
    return {singer: [(float(x["start_sec"]), float(x["end_sec"])) for x in lines]}


def _clip(span: Span, start: float, duration: float) -> Span | None:
    a = max(span[0] - start, 0.0)
    b = min(span[1] - start, duration)
    return (a, b) if b > a else None


def _flaps(span: Span) -> list[list[float]]:
    out: list[list[float]] = []
    t, end = span
    while t < end - 1e-9:
        b = min(t + OPEN_S, end)
        out.append([round(t, 3), round(b, 3)])
        t = b + CLOSED_S
    return out


def mouths(
    spoken: dict[str, list[Span]], start: float, duration: float
) -> dict[str, list[list[float]]]:
    result: dict[str, list[list[float]]] = {}
    for label, spans in spoken.items():
        clipped = [c for c in (_clip(s, start, duration) for s in spans) if c]
        flaps = [f for span in sorted(clipped) for f in _flaps(span)]
        if flaps:
            result[label] = flaps
    return result


def blinks(duration: float, seed: int, fps: float) -> list[list[float]]:
    rng = random.Random(seed)  # noqa: S311 - 暗号ではない。シードで決まる間隔の揺らぎ
    closed = BLINK_FRAMES / fps
    out: list[list[float]] = []
    t = round(rng.uniform(*FIRST_BLINK_S), 3)
    while t + closed <= duration:
        out.append([t, round(t + closed, 3)])
        t = round(t + rng.uniform(*BLINK_GAP_S), 3)
    return out


def _summary(cues: dict[str, Any]) -> str:
    rows = [f"blinks: {len(cues['blinks'])}"]
    for label, flaps in cues["mouths"].items():
        rows.append(f"{label}: {len(flaps)} flaps {flaps[0][0]}s-{flaps[-1][1]}s")
    return "\n".join(rows)


def _spoken(args: argparse.Namespace) -> dict[str, list[Span]]:
    if args.map:
        return _spoken_from_map(_load(args.map), args.singer)
    if args.transcript:
        return _spoken_from_transcript(
            _load(args.transcript), _speaker_map(args.speaker)
        )
    return {}


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=(__doc__ or "").split("\n", 1)[0])
    parser.add_argument("--start", type=float, required=True)
    parser.add_argument("--duration", type=float, required=True)
    source = parser.add_mutually_exclusive_group()
    source.add_argument("--map")
    source.add_argument("--transcript")
    parser.add_argument("--speaker", action="append", default=[])
    parser.add_argument("--singer", default="A")
    parser.add_argument("--seed", type=int, default=1)
    parser.add_argument("--fps", type=float, default=30.0)
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args(argv)
    if args.duration <= 0:
        _fail("--duration must be positive")
    spoken = _spoken(args)
    cues = {
        "duration": args.duration,
        "blinks": blinks(args.duration, args.seed, args.fps),
        "mouths": mouths(spoken, args.start, args.duration),
    }
    print(json.dumps(cues, ensure_ascii=False) if args.json else _summary(cues))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
