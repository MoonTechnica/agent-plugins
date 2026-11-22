"""タイムライン (HyperFrames のバンドル HTML) の形を数行で返す.

    python3 <SKILL_DIR>/scripts/timeline_report.py <index.html> [--json]

## 何のためにあるか

`get_composition_bundle` で手元に落とした本文は数千行になる。**読むとその分だけ
トークンを食う**のに、知りたいのはたいてい「尺・クリップ数・トラックの埋まり方・
どの枠がどこにあるか」だけ。ここはそれを数える。読むのは 1 行の要約で、
中身が要るときだけ `--json`。

**絵の無い区間 (gap) を書き出す前に見つける**のがもう 1 つの役目。隙間は
書き出すと背景 (黒) になる。L2 の `no_black` でも見つかるが、それは**レンダー代を
払ったあと**で、直すにはもう一度払うことになる。

**効果の素性**も見る (持ち主の `data-hf-id` が在るか・`data-name`・出の遅延)。
references/effects.md の決まりで、書き落としても絵は正しく出るので気づけない。

## やらないこと

- クリップの作法・CSS の禁じ手・同じトラックでの重なり
  → `npx hyperframes check` と `put_composition_bundle` の warnings が見る。
    二重に持つと、どちらが正しいか分からなくなる
- 束ねの状態 (空枠・打ち間違い) → `list_composition_variables`

## 依存と呼び方

**標準ライブラリだけ**。サンドボックスの python3 でそのまま動く
(pip を足すと environment の作り直しが要り、既存 project には届かない)。

**`python3 <path>` で呼ぶ。** shebang を置いていないのは、ローカルへ展開する
`materialize-skills` が実行ビットを付けられないため (`./` で呼べると書くと、
Managed Agent では動いてローカルでだけ落ちる)。

終了コード: 0 = 所見なし / 1 = 所見あり / 2 = 読めなかった。
"""

from __future__ import annotations

import json
import re
import sys
from html.parser import HTMLParser
from pathlib import Path

ROOT_ATTR = "data-composition-id"
LANE_ATTRS = ("data-track-index", "data-layer")
VAR_ATTR = "data-var-src"
MOTION_ATTR = "data-previz-scene"
MOTION_Z_ATTR = "data-previz-z"
#: これ未満の隙間は詰め忘れではなく間 (フレーム境界の丸めでも出る)
GAP_TOLERANCE_S = 0.04
#: 効果の素性 (references/effects.md「効果の素性」)
FX_KEY, FX_OF, FX_OUT = "data-studio-fx-key", "data-studio-fx-of", "data-studio-fx-out"
#: `animation: <name> <尺>s <timing> <遅延>s` の尺と遅延
ANIMATION = re.compile(r"animation:\s*[\w-]+\s+([\d.]+)s\s+[\w-]+\s+([\d.]+)s")


class _Tag:
    """開始タグ 1 つ (名前と属性だけ)."""

    def __init__(self, name: str, attrs: dict[str, str]) -> None:
        self.name = name
        self.attrs = attrs

    @property
    def track(self) -> int | None:
        for attr in LANE_ATTRS:
            if attr in self.attrs:
                return _as_int(self.attrs[attr])
        return None

    @property
    def start_s(self) -> float | None:
        """秒. `intro + 2` のようなクリップ参照は None (解決できない)."""
        return _as_float(self.attrs.get("data-start"))

    @property
    def end_s(self) -> float | None:
        end = _as_float(self.attrs.get("data-end"))
        if end is not None:
            return end
        start, duration = self.start_s, _as_float(self.attrs.get("data-duration"))
        if start is None or duration is None:
            return None
        return start + duration

    @property
    def picture(self) -> bool:
        """画そのものか (`<video>` / `<img>`).

        テロップや図形 (`<div class="clip">`) は**画を埋めない**ので数えない。
        テロップは出ている時間のほうが短いのが普通で、数えると
        「16 秒の隙間」のような所見が毎回出て、本物の指摘が埋もれる。
        音のクリップも同じ (台詞の間は無音で当たり前)。
        """
        return self.name in ("video", "img") or self.motion_scene is not None

    @property
    def motion_scene(self) -> str | None:
        """モーションの層なら、参照しているシーンの id (`data-previz-scene`).

        器は `<div>` だが 3D / 2D の絵を描くので、画として数える。
        """
        return self.attrs.get(MOTION_ATTR) or None


class _Collector(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.tags: list[_Tag] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        self.tags.append(_Tag(tag, {name: value or "" for name, value in attrs}))

    def handle_startendtag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        self.handle_starttag(tag, attrs)


def _as_float(raw: str | None) -> float | None:
    if raw is None:
        return None
    try:
        return float(raw.strip())
    except ValueError:
        return None


def _as_int(raw: str) -> int | None:
    value = _as_float(raw)
    return None if value is None else int(value)


def _gaps(spans: list[tuple[float, float]], until: float | None) -> list[list[float]]:
    """並べたクリップの間に空いている区間. 先頭と末尾の空きも隙間として数える."""
    found: list[list[float]] = []
    cursor = 0.0
    for start, end in sorted(spans):
        found.extend(_hole(cursor, start))
        cursor = max(cursor, end)
    return found + _hole(cursor, until)


def _hole(start: float, end: float | None) -> list[list[float]]:
    """許容より広い空きだけを区間にする (無ければ空)."""
    if end is None or end - start <= GAP_TOLERANCE_S:
        return []
    return [[round(start, 3), round(end, 3)]]


def _spans(clips: list[_Tag]) -> list[tuple[float, float]]:
    """秒として読めたクリップの区間だけ."""
    return [
        (clip.start_s, clip.end_s)
        for clip in clips
        if clip.start_s is not None and clip.end_s is not None
    ]


def _track_report(index: int, clips: list[_Tag]) -> dict:
    spans = _spans(clips)
    return {
        "index": index,
        "clips": len(clips),
        "picture": any(clip.picture for clip in clips),
        "span_s": [min(s for s, _ in spans), max(e for _, e in spans)] if spans else [],
        "unresolved_starts": len(clips) - len(spans),
    }


def _picture_gaps(clips: list[_Tag], duration_s: float | None) -> list[list[float]]:
    """画がどこにも無い区間. **トラックを跨いで**数える.

    黒くなるかどうかは「そのトラックが空いているか」ではなく「画が 1 枚も
    出ていないか」で決まる (別のトラックに絵があるなら黒くない)。

    画のクリップが 1 枚も無いバンドル (音だけを組み立てている途中) は判定しない。
    開始を秒で読めないクリップが 1 本でもあれば数えない —— どこに来るか
    決まらないものを、推測で「隙間」と言わない。
    """
    picture = [clip for clip in clips if clip.picture]
    spans = _spans(picture)
    if not picture or len(spans) != len(picture):
        return []
    return _gaps(spans, duration_s)


def _variables(clips: list[_Tag]) -> list[dict]:
    return [
        {
            "id": clip.attrs[VAR_ATTR],
            "element": clip.name,
            "track": clip.track,
            "start_s": clip.start_s,
        }
        for clip in clips
        if clip.attrs.get(VAR_ATTR)
    ]


def _motion_layers(clips: list[_Tag]) -> list[dict]:
    """モーションの層 (シーンへの参照). 直す先は `get_previz_scene` のシーン側."""
    return [
        {
            "id": clip.attrs.get("id"),
            "scene": clip.motion_scene,
            "track": clip.track,
            "start_s": clip.start_s,
            "end_s": clip.end_s,
            "z": _as_int(clip.attrs[MOTION_Z_ATTR])
            if MOTION_Z_ATTR in clip.attrs
            else None,
        }
        for clip in clips
        if clip.motion_scene
    ]


def _findings(gaps: list[list[float]]) -> list[str]:
    """直す先が 1 つに決まるものだけ載せる (「見ろ」で終わる所見は書かない)."""
    return [
        f"no picture for {end - start:.1f} s at {start:.1f} s "
        f"(the render shows the background there)"
        for start, end in gaps
    ]


def _dangling_owner(tag: _Tag, owners: set[str]) -> list[str]:
    owner = tag.attrs.get(FX_OF)
    if not owner or owner in owners:
        return []
    return [
        f"effect {tag.attrs.get(FX_KEY)} points at {owner}, which no clip carries as "
        "data-hf-id (people cannot remove it; it will not follow trims)"
    ]


def _unnamed(tag: _Tag, _: set[str]) -> list[str]:
    if tag.attrs.get("data-name"):
        return []
    return [f"effect {tag.attrs.get(FX_KEY)} has no data-name (the lane shows its id)"]


def _exit_delay(tag: _Tag) -> list[str]:
    """出の効果は尺の終わりで演じ終える: 遅延 = クリップの尺 - 効果の尺."""
    found = ANIMATION.search(tag.attrs.get("style") or "")
    start, end = tag.start_s, tag.end_s
    if not found or start is None or end is None:
        return []
    length, delay = float(found.group(1)), float(found.group(2))
    expected = round(end - start - length, 3)
    if abs(delay - expected) <= GAP_TOLERANCE_S:
        return []
    return [
        f"exit effect {tag.attrs.get(FX_OUT)} starts at {delay:g} s; "
        f"it should start at {expected:g} s (clip length - effect length)"
    ]


def _effect_findings(tags: list[_Tag]) -> list[str]:
    owners = {t.attrs["data-hf-id"] for t in tags if t.attrs.get("data-hf-id")}
    effects = [t for t in tags if t.attrs.get(FX_KEY)]
    return [
        *(
            f
            for t in effects
            for check in (_dangling_owner, _unnamed)
            for f in check(t, owners)
        ),
        *(f for t in tags if t.attrs.get(FX_OUT) for f in _exit_delay(t)),
    ]


def _grouped(clips: list[_Tag]) -> dict[int, list[_Tag]]:
    tracks: dict[int, list[_Tag]] = {}
    for clip in clips:
        track = clip.track
        if track is not None:
            tracks.setdefault(track, []).append(clip)
    return tracks


def _report(html: str) -> dict:
    collector = _Collector()
    collector.feed(html)
    root = next((tag for tag in collector.tags if ROOT_ATTR in tag.attrs), None)
    if root is None:
        msg = f"no composition root ({ROOT_ATTR}) in this file"
        raise ValueError(msg)
    duration_s = _as_float(root.attrs.get("data-duration"))
    clips = [tag for tag in collector.tags if tag.track is not None]
    gaps = _picture_gaps(clips, duration_s)
    return {
        "duration_s": duration_s,
        "clips": len(clips),
        "tracks": [
            _track_report(index, grouped)
            for index, grouped in sorted(_grouped(clips).items())
        ],
        "picture_gaps_s": gaps,
        "variables": _variables(clips),
        "motion_layers": _motion_layers(clips),
        "findings": [*_findings(gaps), *_effect_findings(collector.tags)],
    }


def _summary(report: dict) -> str:
    head = (
        f"{report['duration_s']} s · {report['clips']} clips · "
        f"{len(report['tracks'])} tracks · {len(report['variables'])} variables"
    )
    if report["motion_layers"]:
        head += f" · {len(report['motion_layers'])} motion layers"
    return "\n".join([head, *(f"! {finding}" for finding in report["findings"])])


def main(argv: list[str]) -> int:
    args = [arg for arg in argv if not arg.startswith("-")]
    if not args:
        print(__doc__, file=sys.stderr)
        return 2
    source = Path(args[0])
    try:
        report = _report(source.read_text(encoding="utf-8"))
    except (OSError, ValueError) as exc:
        print(f"{source}: {exc}", file=sys.stderr)
        return 2
    as_json = "--json" in argv
    print(json.dumps(report, ensure_ascii=False) if as_json else _summary(report))
    return 1 if report["findings"] else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
