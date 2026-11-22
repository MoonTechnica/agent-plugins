"""MV の字コンテを、生成と配置の前に曲の地図と突き合わせる.

    python3 <SKILL_DIR>/scripts/mv_check.py --map <map.json> --sheet [--json]
    python3 <SKILL_DIR>/scripts/mv_check.py --map <map.json> <scenes.json> [--json]

## 何のためにあるか

MV のシーンの境目・カットの尺・サビの密度・**どのカットがどの歌詞を受け持つか**は
**曲の地図から機械で決まる**のに、手で数えていた。境目がフレーズの途中に入る・
尺が拍に乗らない・歌詞の行の途中で切る・歌の無い所に歌唱カットを置く・サビが
のっぺりする、はどれも**生成してから**気づくと撮り直しになる。

根拠は references/other-formats.md §2 (境界・尺・区間の頭・歌詞) と、genre-playbook の
references/mv-dynamics.md §6 (のっぺりチェックのうち機械で読める項目)・§7 (編成を
画に写す)。大きな変化が境目になっているか・隣のシーンが画の説明を使い回していないかは
地図を保存するときに検査済み (`put_document` が断る) なので、ここでは見ない。

## 2 つの使い方

- `--sheet` (**書く前**): シーンごとに小節の表を出す。小節番号・頭の秒・
  フレーズ / 区間の頭・出来事・**その小節で始まる歌詞の行**。
  これを見て、どの小節で切り、どのカットがどの行を受け持つかを決める
- 位置引数 (**書いた後**): **シーンごとのカット列** `[{"cuts": [...]}, ...]` を
  `scene_plan` と同じ順で (`list_cuts` をシーンの順に並べたもの) 渡し、所見を出す

カットの位置は `note` の `♪ n bars` / `♪ n beats` を**小節の格子の上で**積んで数える
(整数秒の尺を積むと 1 カットごとに拍から外れていく)。
小節数の無いカットからは整数秒で数える。

## 入れるもの

- `--map`: 曲の地図 (`get_document(<audio_map の asset_id>)` の doc。`audio_map.v2`)

出すもの: `apply_scene_proposal` にそのまま渡す `boundaries_sec` (シーン数 + 1)、
シーンごとの `cut_starts_sec` (`align_scene_cuts` に渡す各カットの頭)、
カットごとの受け持つ歌詞 (`cuts[].lyrics`)。

## やらないこと (画を見る判断)

- `note` の動作に始点と終点があるか・歌唱アップに口以外の動きがあるか
- 2 番サビが 1 番と向きかスケールで違うか (意図の比較)
- 歌詞と画の関係 (比喩・反対・並走。genre-playbook の mv.md §2)

## 依存と呼び方

**標準ライブラリだけ**。`python3 <path>` で呼ぶ (shebang は置いていない)。
`shot_lint.py` とサイズの表が重なるが、`-I` で走るので兄弟を import できない
(同じ表を 2 か所に持つ。変えるときは両方)。

終了コード: 0 = 所見なし / 1 = 所見あり / 2 = 読めなかった.
"""

from __future__ import annotations

import argparse
import json
import math
import re
import sys
from collections.abc import Callable, Iterable, Iterator
from dataclasses import dataclass, replace
from itertools import tee
from pathlib import Path
from typing import Any, TypeVar

_T = TypeVar("_T")


def pairwise(items: Iterable[_T]) -> Iterator[tuple[_T, _T]]:
    """隣り合う 2 つずつ (pairwise は 3.10 から。macOS の python3 は 3.9)."""
    first, second = tee(items)
    next(second, None)
    return zip(first, second)


#: サビ・ドロップの密度 (mv-dynamics.md §6-1): 15 秒あたりのカット数
CHORUS_CUTS_PER_15S = 5
#: サビの static の上限 (mv-dynamics.md §6-4): 1/3
CHORUS_STATIC_MAX = 1 / 3
#: サイズの跳躍とみなす段差 (mv-dynamics.md §6-3)
SIZE_JUMP = 2
#: 区間の頭を跨ぐとみなす余白 (地図の時刻は計測の小節頭。コマへの丸めぶん)
TOLERANCE = 0.05
#: キメの打点からこの距離にカットの頭が無ければ所見。字コンテの尺は整数秒なので
#: ぴったりには置けない。近くで割り、配置後に align_scene_cuts でキメへ寄せる
KIME_REACH = 1.0
#: 小節数が読めないときの 1 小節 (120 BPM・4/4)。歌詞の頭を探す窓にだけ使う
FALLBACK_BAR = 2.0
#: シーンをサビ (密度・跳躍を見る区間) として扱う始まりの出来事
CHORUS_OPENERS = ("full_band_in", "drop")
#: 歌詞の行で切る区間 (scene_plan[].cut_hint)。行の途中で切らない
PHRASE_FLOW = "phrase_flow"
#: 曲の打点 (シーンを割らず、カットを打つ出来事)。地図の `hits_sec` に入っている
#: サイズの段 (shot_lint.py と同じ表)
SIZES: tuple[tuple[str, int], ...] = (
    ("extreme close-up", 7),
    ("medium close-up", 5),
    ("extreme wide shot", 0),
    ("close-up", 6),
    ("medium shot", 4),
    ("full shot", 2),
    ("wide shot", 1),
)
CAMERA_MOVES = (
    "push in",
    "dolly in",
    "dolly out",
    "pull back",
    "pan left",
    "pan right",
    "tilt up",
    "tilt down",
    "truck left",
    "truck right",
    "crane up",
    "crane down",
    "orbit",
    "arc",
    "tracking shot",
    "handheld",
)
#: 生成に頼らずタイムラインで作るもの (mv-dynamics.md §6-13)
TIMELINE_EFFECTS = ("whip pan", "crash zoom", "flash", "freeze frame", "speed ramp")
MEASURE = re.compile(r"♪\s*(\d+(?:\.\d+)?)\s*(bars?|beats?)")
REASON = re.compile(r"♪\s*\d+(?:\.\d+)?\s*(?:bars?|beats?)|cut:")
HOLD = re.compile(r"hold|長回し|long take", re.IGNORECASE)
#: 歌唱カット (ai-video-craft の lip-sync.md §3 のト書き)
SINGING = re.compile(r"\bsings?\b|\bsinging\b|lip[- ]?sync|歌唱|歌う|歌って")
#: 語の頭で切るカット (`cut: lyric "word"`)
LYRIC_CUE = re.compile(r"cut:\s*lyric\s*[\"“「']([^\"”」']+)")


@dataclass(frozen=True)
class Line:
    start: float
    end: float
    text: str


@dataclass(frozen=True)
class Cut:
    key: str
    seconds: int
    shot: str
    note: str
    start: float = 0.0
    #: 次のカットの頭 (小節の格子の上。読めなければ start + seconds)
    stop: float = math.inf
    #: シーンの尻. これより後は生成しても タイムラインで捨てる
    slot_end: float = math.inf
    #: note の `♪ n bars` / `♪ n beats` を小節に直したもの (無ければ None)
    bars: float | None = None
    #: シーンの 1 カット目 (シーンの境目は地図の検査に任せる)
    opens_scene: bool = False
    #: シーンの切る根拠の既定 (scene_plan[].cut_hint)
    hint: str = ""

    @property
    def shown_end(self) -> float:
        return min(self.stop, self.slot_end)


@dataclass(frozen=True)
class Scene:
    start: float
    end: float
    sections: tuple[str, ...]
    cuts: tuple[Cut, ...]
    chorus: bool
    #: シーンの頭の理由 (`scene_plan[].reason.kind`。full_band_in など)
    opener: str = ""
    #: キメの打点 (`scene_plan[].hits_sec`)
    hits: tuple[float, ...] = ()
    #: 前のシーンの最後のカットのショット (サイズの跳躍を見る)
    previous_shot: str = ""
    #: シーンの小節数 (`scene_plan[].bars`)
    bars: int | None = None

    @property
    def slot(self) -> float:
        return self.end - self.start


@dataclass(frozen=True)
class Song:
    #: 1 小節の秒 (地図の小節番号と秒から求める。求まらなければ None)
    bar_seconds: float | None
    section_heads: tuple[float, ...]
    #: 0 秒から 0 小節目の小節頭までの弱起 (最初のシーンは 0 秒から始まり、これを含む)
    lead_in: float = 0.0
    beats_per_bar: int = 4
    #: 歌詞の行と時刻 (`lyric_lines[]`)
    lyrics: tuple[Line, ...] = ()
    #: 歌のある曲なのに歌詞の時刻が無い (歌詞の検査はできない)
    untimed: bool = False


Finding = str


def _found(text: str, words: tuple[str, ...]) -> list[str]:
    lowered = text.lower()
    return [
        w for w in words if re.search(rf"(?<![\w-]){re.escape(w)}(?![\w-])", lowered)
    ]


def _size(shot: str) -> int | None:
    lowered = shot.lower()
    return next(
        (
            r
            for n, r in SIZES
            if re.search(rf"(?<![\w-]){re.escape(n)}(?![\w-])", lowered)
        ),
        None,
    )


def _anchors(audio_map: dict[str, Any]) -> dict[int, float]:
    """小節番号 → 秒 (区間・フレーズ・シーンの頭から).

    0 小節目は弱起ごと 0 秒から始まる範囲があるので除く。
    """
    items = [
        item
        for key in ("sections", "phrases", "scene_plan")
        for item in audio_map.get(key) or []
    ]
    return {
        int(item["start_bar"]): float(item["start_sec"])
        for item in items
        if isinstance(item.get("start_bar"), int)
        and item["start_bar"] > 0
        and "start_sec" in item
    }


def _bar_seconds(audio_map: dict[str, Any]) -> float | None:
    anchors = _anchors(audio_map)
    if len(anchors) < 2:  # noqa: PLR2004 - 2 点で傾きが決まる
        return None
    first, last = min(anchors), max(anchors)
    return (anchors[last] - anchors[first]) / (last - first)


def _lead_in(audio_map: dict[str, Any]) -> float:
    """0 小節目のフレーズの頭 = 最初の小節頭 (地図はそこを計測の小節頭で持つ)."""
    heads = [
        float(p["start_sec"])
        for p in audio_map.get("phrases") or []
        if p.get("start_bar") == 0 and "start_sec" in p
    ]
    return heads[0] if heads else 0.0


def _beats_per_bar(audio_map: dict[str, Any]) -> int:
    head = str(audio_map.get("time_signature") or "4/4").split("/")[0]
    return int(head) if head.isdigit() and int(head) > 0 else 4


def _lyrics(audio_map: dict[str, Any]) -> tuple[Line, ...]:
    return tuple(
        Line(float(line["start_sec"]), float(line["end_sec"]), str(line["text"]))
        for line in audio_map.get("lyric_lines") or []
        if "start_sec" in line and "end_sec" in line and "text" in line
    )


def _untimed(audio_map: dict[str, Any]) -> bool:
    sung = any(p.get("lyric") for p in audio_map.get("phrases") or [])
    return sung and not audio_map.get("lyric_lines")


def _song(audio_map: dict[str, Any]) -> Song:
    heads = [float(s.get("start_sec", 0)) for s in audio_map.get("sections") or []]
    return Song(
        bar_seconds=_bar_seconds(audio_map),
        section_heads=tuple(heads),
        lead_in=_lead_in(audio_map),
        beats_per_bar=_beats_per_bar(audio_map),
        lyrics=_lyrics(audio_map),
        untimed=_untimed(audio_map),
    )


def _energies(audio_map: dict[str, Any]) -> dict[str, str]:
    return {
        str(s.get("label")): str(s.get("energy"))
        for s in audio_map.get("sections") or []
    }


def _measure(note: str, beats_per_bar: int) -> float | None:
    match = MEASURE.search(note)
    if not match:
        return None
    count = float(match.group(1))
    return count if match.group(2).startswith("bar") else count / beats_per_bar


def _origin(start: float, song: Song) -> float:
    """シーンの最初の小節頭 (最初のシーンは 0 秒から始まり弱起を含む)."""
    return song.lead_in if start == 0 else start


@dataclass(frozen=True)
class _Cursor:
    """カットの頭を数える位置. 格子の上にいる間は累積小節から秒を出す."""

    at: float
    bars: float = 0.0
    on_grid: bool = True

    def advance(self, cut: Cut, origin: float, song: Song) -> _Cursor:
        on_grid = self.on_grid and cut.bars is not None and song.bar_seconds is not None
        if not on_grid:
            return _Cursor(at=cut.start + cut.seconds, on_grid=False)
        bars = self.bars + (cut.bars or 0.0)
        return _Cursor(
            at=round(origin + bars * (song.bar_seconds or 0.0), 3), bars=bars
        )


def _cuts(
    rows: list[dict[str, Any]], scene: dict[str, Any], song: Song
) -> tuple[Cut, ...]:
    start, end = float(scene["start_sec"]), float(scene["end_sec"])
    origin = _origin(start, song)
    cursor = _Cursor(at=start)
    cuts: list[Cut] = []
    for i, row in enumerate(rows, start=1):
        note = str(row.get("note") or "")
        cut = Cut(
            key=str(row.get("key") or f"#{i}"),
            seconds=int(row.get("duration_seconds") or 0),
            shot=str(row.get("shot") or ""),
            note=note,
            start=cursor.at,
            slot_end=end,
            bars=_measure(note, song.beats_per_bar),
            opens_scene=i == 1,
            hint=str(scene.get("cut_hint") or ""),
        )
        cursor = cursor.advance(cut, origin, song)
        cuts.append(replace(cut, stop=cursor.at))
    return tuple(cuts)


def _opener(entry: dict[str, Any]) -> str:
    reason = entry.get("reason")
    return str(reason.get("kind") or "") if isinstance(reason, dict) else ""


def _scene(
    entry: dict[str, Any],
    rows: list[dict[str, Any]],
    energy: dict[str, str],
    song: Song,
) -> Scene:
    sections = tuple(entry.get("sections") or ())
    opener = _opener(entry)
    bars = entry.get("bars")
    return Scene(
        start=float(entry["start_sec"]),
        end=float(entry["end_sec"]),
        sections=sections,
        cuts=_cuts(rows, entry, song),
        chorus=opener in CHORUS_OPENERS
        or any(energy.get(s) == "high" for s in sections),
        opener=opener,
        hits=tuple(float(h) for h in entry.get("hits_sec") or ()),
        bars=bars if isinstance(bars, int) else None,
    )


def build(audio_map: dict[str, Any], payload: Any) -> list[Scene]:  # noqa: ANN401
    plan = audio_map.get("scene_plan") or []
    groups = [item.get("cuts", []) for item in payload if isinstance(item, dict)]
    energy = _energies(audio_map)
    song = _song(audio_map)
    scenes = [_scene(entry, rows, energy, song) for entry, rows in zip(plan, groups)]
    return [
        replace(scene, previous_shot=before.cuts[-1].shot if before.cuts else "")
        if before is not None
        else scene
        for before, scene in zip([None, *scenes[:-1]], scenes)
    ]


def _sung(cut: Cut, song: Song) -> list[Line]:
    """カットの見える範囲で歌われる行 (端が触れるだけの行は数えない)."""
    return [
        line
        for line in song.lyrics
        if line.start < cut.shown_end - TOLERANCE and line.end > cut.start + TOLERANCE
    ]


# ===== シーン =====


def check_slot(scene: Scene, _: Song) -> list[Finding]:
    generated = sum(c.seconds for c in scene.cuts)
    if generated >= scene.slot - TOLERANCE:
        return []
    return [
        f"{scene.cuts[0].key if scene.cuts else '?'}〜: シーンの生成尺 {generated} 秒が"
        f"枠 {scene.slot:g} 秒より短い (サーバが断る。尻が黒になる)"
    ]


def check_bars_total(scene: Scene, _: Song) -> list[Finding]:
    measured = [c.bars for c in scene.cuts]
    if scene.bars is None or not measured or None in measured:
        return []
    total = sum(b for b in measured if b is not None)
    if abs(total - scene.bars) < 1e-6:  # noqa: PLR2004 - 小節の端数の誤差
        return []
    return [
        f"{scene.cuts[0].key}〜: カットの合計が {total:g} 小節、"
        f"シーンは {scene.bars} 小節。"
        "合わないと後ろのカットの頭が拍からずれる (小節数を足して合わせる)"
    ]


def _static(cut: Cut) -> bool:
    return "static" in cut.shot.lower() or not _found(cut.shot, CAMERA_MOVES)


def check_density(scene: Scene, _: Song) -> list[Finding]:
    if not scene.chorus or not scene.slot:
        return []
    per_15 = len(scene.cuts) / scene.slot * 15
    if per_15 >= CHORUS_CUTS_PER_15S:
        return []
    return [
        f"{scene.cuts[0].key}〜: サビが 15 秒あたり {per_15:.1f} カット"
        f" ({CHORUS_CUTS_PER_15S} 以上にする。2〜3 秒・1 小節で割る)"
    ]


def check_static(scene: Scene, _: Song) -> list[Finding]:
    if not scene.chorus or not scene.cuts:
        return []
    ratio = sum(_static(c) for c in scene.cuts) / len(scene.cuts)
    if ratio <= CHORUS_STATIC_MAX:
        return []
    return [f"{scene.cuts[0].key}〜: サビの {ratio:.0%} が static (1/3 以下にする)"]


def check_size_jump(scene: Scene, _: Song) -> list[Finding]:
    sizes = [s for s in (_size(c.shot) for c in scene.cuts) if s is not None]
    if not scene.chorus or len(sizes) < 2:  # noqa: PLR2004 - 隣り合う 2 つが要る
        return []
    if any(abs(a - b) >= SIZE_JUMP for a, b in pairwise(sizes)):
        return []
    return [f"{scene.cuts[0].key}〜: サビにサイズの 2 段以上の跳躍が無い"]


def check_repeated_move(scene: Scene, _: Song) -> list[Finding]:
    if not scene.chorus:
        return []
    return [
        f"{a.key} → {b.key}: サビで同じカメラの動きが続く ({move})"
        for a, b in pairwise(scene.cuts)
        for move in set(_found(a.shot, CAMERA_MOVES))
        & set(_found(b.shot, CAMERA_MOVES))
    ]


def check_kime(scene: Scene, _: Song) -> list[Finding]:
    heads = [c.start for c in scene.cuts]
    return [
        f"{scene.cuts[0].key if scene.cuts else '?'}〜: キメ {hit:g} 秒の"
        f" {KIME_REACH:g} 秒以内にカットの頭が無い。近くでカットを割り、"
        "配置後に align_scene_cuts でキメの時刻へ寄せる"
        for hit in scene.hits
        if not any(abs(head - hit) <= KIME_REACH for head in heads)
    ]


def check_full_band_jump(scene: Scene, _: Song) -> list[Finding]:
    """全員が入る頭は、前のシーンの最後からサイズを 2 段以上跳ばす (mv-dynamics §7)."""
    if scene.opener != "full_band_in" or not scene.cuts:
        return []
    before, after = _size(scene.previous_shot), _size(scene.cuts[0].shot)
    if before is None or after is None or abs(after - before) >= SIZE_JUMP:
        return []
    return [
        f"{scene.cuts[0].key}: 全員が入る頭なのにサイズが {abs(after - before)} 段しか"
        f"跳ばない ({SIZE_JUMP} 段以上。初めて全景を見せるか、手元から引く)"
    ]


# ===== カット =====


def check_reason(cut: Cut, _: Song) -> list[Finding]:
    if REASON.search(cut.note):
        return []
    return [f"{cut.key}: note に切る根拠が無い (`♪ n bars · cut: beat` などを書く)"]


def check_on_grid(cut: Cut, _: Song) -> list[Finding]:
    if cut.bars is not None:
        return []
    return [
        f"{cut.key}: 尺の小節数が無い (`♪ n bars` か `♪ n beats` を note に書く。"
        "小節で数えないと、このカットから後ろの頭が拍に乗らない)"
    ]


def check_bars(cut: Cut, song: Song) -> list[Finding]:
    if cut.bars is None or song.bar_seconds is None:
        return []
    lead_in = song.lead_in if cut.start == 0 else 0.0
    expected = math.ceil(cut.bars * song.bar_seconds + lead_in - 1e-9)
    # シーンの残りをちょうど埋める長さも正しい。最初の弱起と最後の余韻はシーンが持つ
    fills = math.ceil(cut.slot_end - cut.start - 1e-9)
    if cut.seconds in (expected, fills):
        return []
    measure = MEASURE.search(cut.note)
    written = f"{measure.group(1)} {measure.group(2)}" if measure else f"{cut.bars:g}"
    return [
        f"{cut.key}: ♪ {written} は {expected} 秒 (切り上げの整数秒)。"
        f"今 {cut.seconds} 秒"
    ]


def check_timeline_effects(cut: Cut, _: Song) -> list[Finding]:
    effects = _found(cut.shot, TIMELINE_EFFECTS)
    if not effects:
        return []
    return [
        f"{cut.key}: {', '.join(effects)} は生成に頼らない。"
        "note に TL: で書き、compositor で作る"
    ]


def check_section_head(cut: Cut, song: Song) -> list[Finding]:
    inside = [
        h
        for h in song.section_heads
        if cut.start + TOLERANCE < h < cut.shown_end - TOLERANCE
    ]
    if not inside or HOLD.search(cut.note):
        return []
    return [
        f"{cut.key}: 区間の頭 ({inside[0]:g} 秒) を跨ぐ。"
        "区間の頭で画を変える (通す意図なら note に hold / 長回しと書く)"
    ]


def check_lyric_split(cut: Cut, song: Song) -> list[Finding]:
    """歌詞で切る区間 (A メロ等) で、行の途中にカットの頭を置かない."""
    if cut.hint != PHRASE_FLOW or cut.opens_scene or LYRIC_CUE.search(cut.note):
        return []
    return [
        f"{cut.key}: 歌詞の行「{line.text}」({line.start:g}〜{line.end:g} 秒) の途中"
        f" {cut.start:g} 秒で切っている。歌詞で切る区間は行の頭の前か行の終わりの後の"
        '小節頭で切る (語で切る意図なら note に cut: lyric "語" と書く)'
        for line in song.lyrics
        if line.start + TOLERANCE < cut.start < line.end - TOLERANCE
    ]


def check_singing(cut: Cut, song: Song) -> list[Finding]:
    """歌唱カットは歌詞の行と重なる所にだけ置く (mv.md §4・§7)."""
    if song.untimed or not SINGING.search(cut.note) or _sung(cut, song):
        return []
    return [
        f"{cut.key}: 歌唱カットだが {cut.start:g}〜{cut.shown_end:g} 秒に歌詞の行が無い"
        " (歌の無い所で口を動かさない。歌唱は行のあるカットへ移す)"
    ]


def check_lyric_cue(cut: Cut, song: Song) -> list[Finding]:
    """`cut: lyric "語"` の語は、カットの頭の前後で本当に歌われている."""
    cue = LYRIC_CUE.search(cut.note)
    if not cue or song.untimed:
        return []
    reach = song.bar_seconds or FALLBACK_BAR
    near = [
        line
        for line in song.lyrics
        if line.end > cut.start - TOLERANCE and line.start < cut.start + reach
    ]
    word = cue.group(1).strip()
    if any(word in line.text for line in near):
        return []
    sung = "・".join(f"「{line.text}」" for line in near) or "どの行も無い"
    return [
        f'{cut.key}: cut: lyric "{word}" だが、{cut.start:g} 秒の頭の前後 1 小節で'
        f"歌われるのは {sung}。語の頭に最も近い小節頭 / 拍へカットを動かす"
    ]


SCENE_CHECKS: tuple[Callable[[Scene, Song], list[Finding]], ...] = (
    check_slot,
    check_bars_total,
    check_density,
    check_static,
    check_size_jump,
    check_repeated_move,
    check_kime,
    check_full_band_jump,
)
CUT_CHECKS: tuple[Callable[[Cut, Song], list[Finding]], ...] = (
    check_reason,
    check_on_grid,
    check_bars,
    check_timeline_effects,
    check_section_head,
    check_lyric_split,
    check_singing,
    check_lyric_cue,
)


def _map_findings(audio_map: dict[str, Any], payload: list[Any]) -> list[Finding]:
    plan = audio_map.get("scene_plan") or []
    counted = (
        []
        if len(plan) == len(payload)
        else [
            f"シーンが {len(payload)} 個、scene_plan が {len(plan)} 項目。"
            "1 項目 = 1 シーンにする (割るならフレーズの頭で)"
        ]
    )
    untimed = (
        [
            "地図に歌詞の時刻 (lyric_lines) が無い。"
            "audio-engineer §7 の歌詞の時刻合わせを"
            "先にやる (歌詞で切るカット・歌唱カットの割り当てが検査できない)"
        ]
        if _untimed(audio_map)
        else []
    )
    return [*counted, *untimed]


def _cut_row(cut: Cut, song: Song) -> dict[str, Any]:
    return {
        "key": cut.key,
        "start_sec": cut.start,
        "end_sec": cut.shown_end,
        "bars": cut.bars,
        "lyrics": [line.text for line in _sung(cut, song)],
    }


def check(audio_map: dict[str, Any], payload: Any) -> dict[str, Any]:  # noqa: ANN401
    scenes = build(audio_map, payload)
    song = _song(audio_map)
    findings = [
        *_map_findings(audio_map, payload),
        *(f for s in scenes for c in SCENE_CHECKS for f in c(s, song)),
        *(
            f
            for s in scenes
            for cut in s.cuts
            for c in CUT_CHECKS
            for f in c(cut, song)
        ),
    ]
    boundaries = [s.start for s in scenes] + ([scenes[-1].end] if scenes else [])
    return {
        "boundaries_sec": boundaries,
        "findings": findings,
        "scenes": [
            {
                "start_sec": s.start,
                "end_sec": s.end,
                "cut_starts_sec": [c.start for c in s.cuts],
            }
            for s in scenes
        ],
        "cuts": [_cut_row(cut, song) for s in scenes for cut in s.cuts],
    }


# ===== 書く前の小節の表 =====


def _bar_row(
    bar: int, at: float, window: tuple[float, float], audio_map: dict[str, Any]
) -> dict[str, Any]:
    low, high = window
    return {
        "bar": bar,
        "start_sec": round(at, 3),
        "section_head": any(
            s.get("start_bar") == bar for s in audio_map.get("sections") or []
        ),
        "phrase_head": any(
            p.get("start_bar") == bar for p in audio_map.get("phrases") or []
        ),
        "events": [
            str(e.get("kind"))
            for e in audio_map.get("events") or []
            if low - TOLERANCE <= float(e.get("at_sec", -1)) < high - TOLERANCE
        ],
        "lyrics": [
            {"text": line.text, "start_sec": line.start, "end_sec": line.end}
            for line in _lyrics(audio_map)
            if low - TOLERANCE <= line.start < high - TOLERANCE
        ],
    }


def _sheet_scene(
    entry: dict[str, Any], audio_map: dict[str, Any], song: Song, bar_seconds: float
) -> dict[str, Any]:
    start, end = float(entry["start_sec"]), float(entry["end_sec"])
    origin = _origin(start, song)
    count = int(entry.get("bars") or 0)
    heads = [origin + k * bar_seconds for k in range(count)]
    windows = list(zip([start, *heads[1:]], [*heads[1:], end]))
    return {
        "start_sec": start,
        "end_sec": end,
        "sections": list(entry.get("sections") or []),
        "cut_hint": str(entry.get("cut_hint") or ""),
        "reason": _opener(entry),
        "hits_sec": [float(h) for h in entry.get("hits_sec") or []],
        "visual": str(entry.get("visual") or ""),
        "bars": [
            _bar_row(int(entry.get("start_bar") or 0) + k, at, window, audio_map)
            for k, (at, window) in enumerate(zip(heads, windows))
        ],
    }


def sheet(audio_map: dict[str, Any], song: Song, bar_seconds: float) -> dict[str, Any]:
    return {
        "bar_seconds": round(bar_seconds, 4),
        "beats_per_bar": song.beats_per_bar,
        "untimed_lyrics": song.untimed,
        "scenes": [
            _sheet_scene(entry, audio_map, song, bar_seconds)
            for entry in audio_map.get("scene_plan") or []
        ],
    }


def _bar_text(row: dict[str, Any]) -> str:
    marks = [
        *(["区間頭"] if row["section_head"] else []),
        *(["フレーズ頭"] if row["phrase_head"] else []),
        *row["events"],
    ]
    lyrics = " ".join(
        f"「{line['text']}」{line['start_sec']:g}〜{line['end_sec']:g}"
        for line in row["lyrics"]
    )
    return (
        f"  bar {row['bar']:>3}  {row['start_sec']:>8.2f}  "
        f"{' / '.join(marks):<24} {lyrics}".rstrip()
    )


def _sheet_text(report: dict[str, Any]) -> str:
    lines = [
        f"1 小節 = {report['bar_seconds']:g} 秒 ({report['beats_per_bar']} 拍)",
        *(
            ["⚠ 歌詞の時刻 (lyric_lines) が無い。先に歌詞の時刻合わせをする"]
            if report["untimed_lyrics"]
            else []
        ),
    ]
    for i, scene in enumerate(report["scenes"], start=1):
        lines.append(
            f"S{i} {scene['start_sec']:g}〜{scene['end_sec']:g} 秒 · "
            f"{len(scene['bars'])} 小節 · {'/'.join(scene['sections'])} · "
            f"{scene['cut_hint']} · {scene['reason']} · キメ {scene['hits_sec']}"
        )
        lines.extend(_bar_text(row) for row in scene["bars"])
    return "\n".join(lines)


# ===== 入口 =====


def _load(path: str) -> Any:  # noqa: ANN401
    return json.loads(Path(path).read_text("utf-8"))


def _check_text(report: dict[str, Any]) -> str:
    starts = "\n".join(
        f"S{i} cut_starts_sec: {s['cut_starts_sec']}"
        for i, s in enumerate(report["scenes"], start=1)
    )
    sung = "\n".join(
        f"{c['key']}: {'・'.join(c['lyrics'])}" for c in report["cuts"] if c["lyrics"]
    )
    return "\n".join(
        [
            f"boundaries_sec: {report['boundaries_sec']}",
            starts,
            *(["歌詞の受け持ち:", sung] if sung else []),
            "\n".join(report["findings"]) or "所見なし",
        ]
    )


def _run_sheet(audio_map: dict[str, Any], as_json: bool) -> int:  # noqa: FBT001
    song = _song(audio_map)
    if song.bar_seconds is None:
        print(
            "読めなかった: 地図から 1 小節の秒が求まらない"
            " (小節頭の時刻が 2 つ以上要る)",
            file=sys.stderr,
        )
        return 2
    report = sheet(audio_map, song, song.bar_seconds)
    print(json.dumps(report, ensure_ascii=False) if as_json else _sheet_text(report))
    return 0


def _run_check(audio_map: dict[str, Any], payload: Any, as_json: bool) -> int:  # noqa: ANN401, FBT001
    report = check(audio_map, payload if isinstance(payload, list) else [])
    print(json.dumps(report, ensure_ascii=False) if as_json else _check_text(report))
    return 1 if report["findings"] else 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=(__doc__ or "").splitlines()[0])
    parser.add_argument("--map", required=True, help="曲の地図 (audio_map.v2) の JSON")
    parser.add_argument("scenes", nargs="?", help="シーンごとのカット列の JSON")
    parser.add_argument(
        "--sheet",
        action="store_true",
        help="書く前の小節の表を出す (scenes は要らない)",
    )
    parser.add_argument("--json", action="store_true", help="JSON で出す")
    args = parser.parse_args(argv)
    if not args.sheet and args.scenes is None:
        parser.error("scenes (シーンごとのカット列) か --sheet を渡す")
    return _run(args)


def _run(args: argparse.Namespace) -> int:
    try:
        audio_map = _load(args.map)
        payload = None if args.sheet else _load(args.scenes)
    except (OSError, ValueError) as exc:
        print(f"読めなかった: {exc}", file=sys.stderr)
        return 2
    if args.sheet:
        return _run_sheet(audio_map, args.json)
    return _run_check(audio_map, payload, args.json)


if __name__ == "__main__":
    sys.exit(main())
