"""タイムラインの音のミックスを読み、画面と噛み合わない書き方と音量を数える.

    python3 <SKILL_DIR>/scripts/mix_report.py <index.html> [--at <秒>] [--json]

## 何のためにあるか

音の書き方は**壊しても鳴るか、黙って何も起きない**ので、プレビューを聞いても
気づけない (§11.2)。名前の無いノード (画面で説明できない)、速度を変えたクリップの
効果 (プレビューで丸ごと消音)、`data-has-audio` と `muted` の併記、天井 (limiter)
の後ろのノード、AudioParam の無いパラメータへのレーン (動かない)、存在しない
ノードへのレーン。どれも本文を読めば決まる。

`--at <秒>` は、その時刻 (タイムラインの秒) に鳴っている音と実効音量
(音量レーンがあればその値、無ければ `data-volume`。掛け算ではない) を出す。
音量を手で計算し直さないため。

書式の正本は hyperframes-audio の references/attributes.md (チェーンとレーンの JSON)。

## やらないこと

- 音が良いか (聞く判断) / ワンノブの値が曲線上か (`rack.ts` の逆算はサーバ側)
- `hf-audio-group` の中のメンバーの合算 (バスは 1 本の音として数える)

標準ライブラリだけ。終了コード: 0 = 所見なし / 1 = 所見あり / 2 = 読めなかった.
"""

from __future__ import annotations

import argparse
import json
import sys
from collections.abc import Callable, Iterable, Iterator
from dataclasses import dataclass, field
from html.parser import HTMLParser
from itertools import tee
from pathlib import Path
from typing import Any, TypeVar

_T = TypeVar("_T")


def pairwise(items: Iterable[_T]) -> Iterator[tuple[_T, _T]]:
    """隣り合う 2 つずつ (pairwise は 3.10 から。macOS の python3 は 3.9)."""
    first, second = tee(items)
    next(second, None)
    return zip(first, second)


#: AudioParam を持たない (worklet) 効果。レーンを引いても黙って動かない (§11.2-6)
WORKLET_TYPES = frozenset({"compressor", "limiter", "gate", "bitcrush"})
#: サーバが付ける印。手で付けない / 名前は要らない (§11.2-4)
GENERATED_MARKS = ("fromCarve", "fromLeveller", "fromPreset")
AUDIO_TAGS = frozenset({"audio", "hf-audio-group"})

Finding = dict[str, str]


@dataclass(frozen=True)
class Clip:
    clip_id: str
    tag: str
    attrs: dict[str, str | None]
    chain: list[dict[str, Any]] = field(default_factory=list)
    lanes: list[dict[str, Any]] = field(default_factory=list)

    @property
    def name(self) -> str:
        return str(
            self.attrs.get("data-label") or self.attrs.get("data-name") or self.clip_id
        )

    @property
    def start(self) -> float:
        return _number(self.attrs.get("data-start")) or 0.0

    @property
    def end(self) -> float | None:
        end = _number(self.attrs.get("data-end"))
        duration = _number(self.attrs.get("data-duration"))
        return (
            end
            if end is not None
            else (self.start + duration if duration is not None else None)
        )


def _number(raw: str | None) -> float | None:
    try:
        return float(raw) if raw is not None else None
    except ValueError:
        return None


def _json(raw: str | None, key: str) -> list[dict[str, Any]]:
    if not raw:
        return []
    try:
        loaded = json.loads(raw)
    except ValueError:
        return []
    items = loaded.get(key) if isinstance(loaded, dict) else None
    return [i for i in items or [] if isinstance(i, dict)]


class _Collector(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.clips: list[Clip] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        found = dict(attrs)
        sounding = tag in AUDIO_TAGS or (
            tag == "video" and found.get("data-has-audio") == "true"
        )
        if not sounding:
            return
        self.clips.append(
            Clip(
                clip_id=str(found.get("id") or f"{tag}#{len(self.clips) + 1}"),
                tag=tag,
                attrs=found,
                chain=_json(found.get("data-fx-chain"), "nodes"),
                lanes=_json(found.get("data-automation"), "lanes"),
            )
        )

    def handle_startendtag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        self.handle_starttag(tag, attrs)


def load(html: str) -> list[Clip]:
    collector = _Collector()
    collector.feed(html)
    return collector.clips


# ===== 不変条件 (§11.2) =====


def _finding(code: str, clip: Clip, message: str) -> Finding:
    return {"code": code, "message": f"{clip.name}: {message}"}


def unlabelled(clip: Clip) -> list[Finding]:
    return [
        _finding(
            "unlabelled_node",
            clip,
            f"ノード {n.get('id')} ({n.get('type')})"
            " に label が無い (画面で何のつまみか説明できない)",
        )
        for n in clip.chain
        if not n.get("label") and not any(n.get(mark) for mark in GENERATED_MARKS)
    ]


def rate_with_fx(clip: Clip) -> list[Finding]:
    rate = _number(clip.attrs.get("data-playback-rate"))
    if rate in (None, 1.0) or not (clip.chain or clip.lanes):
        return []
    return [
        _finding(
            "rate_with_fx",
            clip,
            f"再生速度 {rate:g} のクリップに効果 /"
            " レーンがある (プレビューで音が丸ごと消える)",
        )
    ]


def muted_with_audio(clip: Clip) -> list[Finding]:
    if "muted" not in clip.attrs or clip.attrs.get("data-has-audio") != "true":
        return []
    return [
        _finding(
            "muted_with_audio",
            clip,
            "data-has-audio と muted を併記している"
            " (lint の error。鳴らすなら muted を消す)",
        )
    ]


def after_limiter(clip: Clip) -> list[Finding]:
    kinds = [str(n.get("type")) for n in clip.chain]
    if "limiter" not in kinds or kinds[-1] == "limiter":
        return []
    return [
        _finding(
            "after_limiter",
            clip,
            "limiter の後ろにノードがある (天井ではなくなる。limiter を最後に)",
        )
    ]


def _lane_node(lane: dict[str, Any]) -> str | None:
    parts = str(lane.get("target") or "").split(".")
    return parts[1] if len(parts) == 3 and parts[0] == "fx" else None  # noqa: PLR2004


def automation_targets(clip: Clip) -> list[Finding]:
    types = {str(n.get("id")): str(n.get("type")) for n in clip.chain}
    targets = [(lane.get("target"), _lane_node(lane)) for lane in clip.lanes]
    return [
        _finding("automation_missing_node", clip, f"レーン {target} のノードが無い")
        for target, node in targets
        if node is not None and node not in types
    ] + [
        _finding(
            "automation_on_worklet",
            clip,
            f"レーン {target} は {types[node]}"
            " に引いている (AudioParam が無く動かない。手前の gain へ引く)",
        )
        for target, node in targets
        if node is not None and types.get(node) in WORKLET_TYPES
    ]


CHECKS: tuple[Callable[[Clip], list[Finding]], ...] = (
    unlabelled,
    rate_with_fx,
    muted_with_audio,
    after_limiter,
    automation_targets,
)


# ===== 時刻の音量 =====


def _segment_value(segment: tuple[tuple[float, float], ...], t: float) -> float:
    (t0, v0), (t1, v1) = segment
    return v1 if t1 <= t0 else v0 + (v1 - v0) * (t - t0) / (t1 - t0)


def _lane_value(points: list[dict[str, Any]], t: float) -> float:
    """レーンの値を t (クリップ内の秒) で線形補間する. 端は保持."""
    known = sorted(
        (float(p["t"]), float(p["v"])) for p in points if "t" in p and "v" in p
    )
    if not known:
        return 1.0
    clamped = min(max(t, known[0][0]), known[-1][0])
    segment = next(
        ((a, b) for a, b in pairwise(known) if a[0] <= clamped <= b[0]),
        (known[-1], known[-1]),
    )
    return _segment_value(segment, clamped)


def volume_at(clip: Clip, at: float) -> float:
    """その時刻の音量. **音量レーンがあればその値そのもの** (data-volume は使わない).

    HyperFrames の runtime/media.js: "An explicit volume lane owns the fader"
    (レーンが無いときだけ data-volume。既定 1)。掛け算ではない。
    """
    lane = next((x for x in clip.lanes if x.get("target") == "volume"), None)
    if lane and lane.get("points"):
        return round(_lane_value(lane["points"], at - clip.start), 4)
    base = _number(clip.attrs.get("data-volume"))
    return 1.0 if base is None else base


def sounding_at(clips: list[Clip], at: float) -> dict[str, Any]:
    playing = [c for c in clips if c.start <= at and (c.end is None or at < c.end)]
    return {
        "time": at,
        "clips": [
            {"id": c.clip_id, "name": c.name, "volume": volume_at(c, at)}
            for c in playing
        ],
    }


def report(html: str, at: float | None) -> dict[str, Any]:
    clips = load(html)
    out: dict[str, Any] = {
        "clips": [
            {
                "id": c.clip_id,
                "name": c.name,
                "start": c.start,
                "end": c.end,
                "nodes": len(c.chain),
                "lanes": len(c.lanes),
            }
            for c in clips
        ],
        "findings": [f for clip in clips for check in CHECKS for f in check(clip)],
    }
    if at is not None:
        out["at"] = sounding_at(clips, at)
    return out


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=(__doc__ or "").splitlines()[0])
    parser.add_argument("html", help="タイムラインの本文 (get_composition_bundle)")
    parser.add_argument("--at", type=float, help="この秒の実効音量を出す")
    parser.add_argument("--json", action="store_true", help="JSON で出す")
    args = parser.parse_args(argv)
    try:
        html = Path(args.html).read_text("utf-8")
    except OSError as exc:
        print(f"読めなかった: {exc}", file=sys.stderr)
        return 2
    out = report(html, args.at)
    if args.json:
        print(json.dumps(out, ensure_ascii=False))
    else:
        lines = [f"[{f['code']}] {f['message']}" for f in out["findings"]]
        lines += [
            f"{c['name']}: {c['volume']:g}" for c in out.get("at", {}).get("clips", [])
        ]
        print("\n".join(lines) or "所見なし")
    return 1 if out["findings"] else 0


if __name__ == "__main__":
    sys.exit(main())
