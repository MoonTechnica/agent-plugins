"""字コンテのカット列から、尺の配り方 (平均カット長・台詞の入り・等間隔) を数える.

    python3 <SKILL_DIR>/scripts/cut_pacing.py <cuts.json> --format <形式> [--json]
    python3 <SKILL_DIR>/scripts/cut_pacing.py - --format anime   # 標準入力
    python3 <SKILL_DIR>/scripts/cut_pacing.py <cuts.json> --target 150-200  # 秒

`--target` は**作品全体を測るときだけ**渡す (形式ごとの目標尺は
references/cut-timing.md §3)。1 シーンだけ測るときに渡すと必ず足りない。

## 何のためにあるか

生成モデルのネイティブ尺 (8〜10 秒) のままカットを置くと、**平均カット長が
現代映画 (3〜5 秒) の倍以上**になる。1 カットずつ見れば「台詞が入る長さ」で
もっともらしいので、**書いている最中には見えない**。見えるのは合計を割ったとき
だけなので、ここはそれを数える。

判定の根拠 (形式ごとの実測と出典) は references/cut-timing.md §4。

## 入れるもの

`list_cuts(scene_id)` の戻り値 (JSON)。シーンをまたいで測るときは連結した 1 つの
配列にする (`dialogue_report.py` と同じ 3 つの形を読む)。

`--format` は作品の形式 (`anime` / `vertical_anime` / `short_drama` / `drama_film`)。
渡さないと平均カット長の判定だけを飛ばす。**`mv` は受けない** —— MV の密度は
曲の区間が決める (genre-playbook の references/mv-dynamics.md §1)。MV は `mv_check.py`。

## やらないこと

- 台詞の総量・冒頭で立てる 4 点 … `dialogue_report.py`
- 個々のカットの尺が画の情報量に合っているか … 画を見る判断 (film-grammar §4)

## 依存と呼び方

**標準ライブラリだけ**。`python3 <path>` で呼ぶ (shebang は置いていない。
ローカルへ展開する materialize-skills が実行ビットを付けられないため)。

終了コード: 0 = 所見なし / 1 = 所見あり / 2 = 読めなかった・形式が対象外.
"""

from __future__ import annotations

import json
import math
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

#: 形式ごとの平均カット長の帯 (秒). 根拠は references/cut-timing.md §4:
#: TV アニメ 1 話約 300 カット (22〜24 分 → 約 4.5 秒) /
#: 現代映画 3〜5 秒・アクション約 2 秒 (Bordwell)・約 4 秒 (Cutting et al. 2010) /
#: 縦型ショートドラマ 2〜4 秒 / 縦型ショートアニメ 2〜3 秒
BANDS: dict[str, tuple[float, float]] = {
    "anime": (3, 6),
    "drama_film": (2.5, 6),
    "short_drama": (2, 4.5),
    "vertical_anime": (2, 3.5),
}
#: 生成するカットの最短. 多ショット生成の公式例は最短 2 秒、それより短い刻みは
#: タイムラインで既存クリップから切る (mv-dynamics.md「生成するカットは 2 秒以上」)
MIN_GENERATED_SECONDS = 2
#: 日本語の標準話速 (1 秒 ≒ 5 字) と、言い終わりの間の下限
CHARS_PER_SECOND = 5
TRAILING_PAUSE_SECONDS = 0.5
#: 同じ長さがこれだけ続いたら「編集していない」に見える
MAX_EQUAL_RUN = 3
#: 縦型の 1 カットの上限 (秒). vertical-shortform「2〜3 秒」/ short-drama.md「2〜4 秒」
VERTICAL_MAX_CUT: dict[str, int] = {"vertical_anime": 3, "short_drama": 4}
#: 1 話のカット数 (genre-playbook の references/short-drama.md §1)
EPISODE_CUTS: dict[str, tuple[int, int]] = {"short_drama": (20, 50)}
#: 台詞に対して余った秒数がこれ以上なら間延び (cut-timing.md §1「7 字に 6 秒」)
DRAG_SLACK_SECONDS = 3
#: 読み上げの時間を持たない文字 (dialogue_report.py と同じ集合)
PUNCTUATION = "…‥・、。，．！？!?「」『』〈〉《》()[]〔〕【】 　\t\n\r-—ー~〜:：;；"  # noqa: RUF001


@dataclass(frozen=True)
class Cut:
    """カット 1 つ (尺と発話の字数だけ)."""

    key: str
    seconds: int
    spoken_chars: list[int] = field(default_factory=list)

    @property
    def needed_seconds(self) -> int:
        """台詞を言い切れる最短の尺. 台詞が無ければ 0."""
        total = sum(self.spoken_chars)
        if not total:
            return 0
        return math.ceil(total / CHARS_PER_SECOND + TRAILING_PAUSE_SECONDS)


def _as_rows(payload: Any) -> list[dict[str, Any]]:  # noqa: ANN401
    """3 つの入力の形を、カットの配列に揃える."""
    if isinstance(payload, dict):
        return _as_rows(payload.get("cuts", []))
    if not isinstance(payload, list):
        return []
    return [row for item in payload for row in _rows_of(item)]


def _rows_of(item: Any) -> list[dict[str, Any]]:  # noqa: ANN401
    if not isinstance(item, dict):
        return []
    nested = item.get("cuts")
    return _as_rows(nested) if isinstance(nested, list) else [item]


def _spoken(text: str) -> int:
    return sum(1 for ch in text if ch not in PUNCTUATION)


def _to_cut(row: dict[str, Any]) -> Cut:
    lines = row.get("cut_lines") or row.get("lines") or []
    return Cut(
        key=str(row.get("key") or row.get("id") or "?"),
        seconds=int(row.get("duration_seconds") or 0),
        spoken_chars=[
            _spoken(str(line.get("text") or ""))
            for line in lines
            if isinstance(line, dict)
        ],
    )


def load_cuts(source: str) -> list[Cut]:
    """ファイルか標準入力から読み、カット列にして返す."""
    return [cut for scene in load_scenes(source) for cut in scene]


def load_scenes(source: str) -> list[list[Cut]]:
    """シーンごとのカット列. `[{"cuts": [...]}, ...]` ならシーンに分け、他は 1 つ."""
    raw = sys.stdin.read() if source == "-" else Path(source).read_text("utf-8")
    payload = json.loads(raw)
    grouped = isinstance(payload, list) and all(
        isinstance(i, dict) and isinstance(i.get("cuts"), list) for i in payload
    )
    groups = [i["cuts"] for i in payload] if grouped and payload else [payload]
    return [[_to_cut(row) for row in _as_rows(group)] for group in groups]


@dataclass(frozen=True)
class Run:
    """同じ長さが続いた区間."""

    first: str
    last: str
    seconds: int
    length: int


def _equal_runs(cuts: list[Cut]) -> list[Run]:
    runs: list[Run] = []
    start = 0
    for i in range(1, len(cuts) + 1):
        if i < len(cuts) and cuts[i].seconds == cuts[start].seconds:
            continue
        runs.append(
            Run(cuts[start].key, cuts[i - 1].key, cuts[start].seconds, i - start)
        )
        start = i
    return runs


def _fmt(value: float) -> str:
    return f"{value:g}"


def _check_band(cuts: list[Cut], seconds: int, fmt: str | None) -> list[str]:
    return [] if fmt is None else _band_findings(len(cuts), seconds, fmt)


def _band_findings(count: int, seconds: int, fmt: str) -> list[str]:
    low, high = BANDS[fmt]
    average = seconds / count
    band = f"{fmt} の目安 {_fmt(low)}〜{_fmt(high)} 秒"
    if average > high:
        return [_too_slow(average, band, math.ceil(seconds / high) - count)]
    if average < low:
        return [f"平均 {average:.1f} 秒は {band} より短い。カットを束ねる"]
    return []


def _too_slow(average: float, band: str, more: int) -> str:
    return (
        f"平均 {average:.1f} 秒は {band} より長い。同じ尺なら"
        f"あと {more} カット割る (会話は聞き手の顔へ切り返す・"
        "情報の少ない画を縮める)"
    )


def _check_too_short(cuts: list[Cut]) -> list[str]:
    short = [cut.key for cut in cuts if 0 < cut.seconds < MIN_GENERATED_SECONDS]
    if not short:
        return []
    return [
        f"{', '.join(short)} が {MIN_GENERATED_SECONDS} 秒未満で短すぎる。"
        "生成せずタイムラインで既存クリップから切るか、隣と束ねる"
    ]


def _check_lines_fit(cuts: list[Cut]) -> list[str]:
    return [
        f"{cut.key} の台詞 {sum(cut.spoken_chars)} 字は {cut.needed_seconds} 秒要る"
        f" ({cut.seconds} 秒では早口で潰れる)。尺を足すか台詞を割る"
        for cut in cuts
        if cut.seconds < cut.needed_seconds
    ]


def _check_equal_runs(runs: list[Run]) -> list[str]:
    return [
        f"{run.first}〜{run.last} の {run.length} カットが同じ {run.seconds} 秒。"
        "等間隔は「編集していない」に見えるので長短を混ぜる"
        for run in runs
        if run.length > MAX_EQUAL_RUN
    ]


def _check_target(seconds: int, target: tuple[int, int] | None) -> list[str]:
    if target is None or target[0] <= seconds <= target[1]:
        return []
    side = (
        "足りない" if seconds < target[0] else "超えている (削る先は前置き。山ではない)"
    )
    return [f"合計 {seconds} 秒は目標 {target[0]}〜{target[1]} 秒に{side}"]


def _check_drag(cuts: list[Cut]) -> list[str]:
    return [
        f"{cut.key} は台詞 {sum(cut.spoken_chars)} 字に {cut.seconds} 秒で間延びする"
        f" (言い切りは {cut.needed_seconds} 秒)。尺を詰めるか画で埋める動作を書く"
        for cut in cuts
        if cut.needed_seconds and cut.seconds - cut.needed_seconds >= DRAG_SLACK_SECONDS
    ]


def _check_vertical(cuts: list[Cut], fmt: str | None) -> list[str]:
    cap = VERTICAL_MAX_CUT.get(fmt or "")
    long = [cut.key for cut in cuts if cap is not None and cut.seconds > cap]
    if not long:
        return []
    return [f"{', '.join(long)} が {cap} 秒を超える (縦型は同じ画が続くと落ちる)"]


def _check_episode_cuts(cuts: list[Cut], fmt: str | None) -> list[str]:
    band = EPISODE_CUTS.get(fmt or "")
    if band is None or band[0] <= len(cuts) <= band[1]:
        return []
    return [f"{len(cuts)} カットは 1 話の目安 {band[0]}〜{band[1]} の外"]


def _check_silent_cut(scenes: list[list[Cut]]) -> list[str]:
    return [
        f"{scene[0].key}〜{scene[-1].key} に台詞の無いカットが無い"
        " (山の直後にリアクションを置く。scene-writing.md #9)"
        for scene in scenes
        if len(scene) > 1 and all(cut.spoken_chars for cut in scene)
    ]


def build_report(
    cuts: list[Cut],
    fmt: str | None,
    *,
    target: tuple[int, int] | None = None,
    scenes: list[list[Cut]] = (),  # type: ignore[assignment]
) -> dict[str, Any]:
    """カット列を数え、外れているところを所見にして返す."""
    seconds = sum(cut.seconds for cut in cuts)
    runs = _equal_runs(cuts)
    goal = target
    report: dict[str, Any] = {
        "cuts": len(cuts),
        "seconds": seconds,
        "average_seconds": round(seconds / len(cuts), 2) if cuts else 0.0,
        "band_seconds": list(BANDS[fmt]) if fmt else None,
        "target_seconds": list(goal) if goal else None,
        "longest_equal_run": max((run.length for run in runs), default=0),
        "findings": [],
    }
    if not seconds:
        return report
    report["findings"] = [
        *_check_band(cuts, seconds, fmt),
        *_check_target(seconds, goal),
        *_check_too_short(cuts),
        *_check_lines_fit(cuts),
        *_check_drag(cuts),
        *_check_vertical(cuts, fmt),
        *_check_episode_cuts(cuts, fmt),
        *_check_equal_runs(runs),
        *_check_silent_cut(list(scenes)),
    ]
    return report


def _text(report: dict[str, Any]) -> str:
    head = (
        f"{report['cuts']} カット / {report['seconds']} 秒 / "
        f"平均 {report['average_seconds']} 秒"
    )
    body = [f"[!] {finding}" for finding in report["findings"]] or ["所見なし"]
    return "\n".join([head, *body])


def _emit(report: dict[str, Any], *, as_json: bool) -> int:
    if as_json:
        print(json.dumps(report, ensure_ascii=False, indent=2))
    else:
        print(_text(report))
    return 1 if report["findings"] else 0


def _option(argv: list[str], name: str) -> str | None:
    if name in argv[:-1]:
        return argv[argv.index(name) + 1]
    return None


def _source(argv: list[str]) -> str | None:
    values = {_option(argv, "--format"), _option(argv, "--target")}
    rest = [a for a in argv[1:] if not a.startswith("--") and a not in values]
    return rest[0] if rest else None


def _refuse_format(fmt: str | None) -> bool:
    """対象外の形式なら理由を出して True."""
    if fmt is None or fmt in BANDS:
        return False
    print(
        f"形式 {fmt} は対象外 ({' / '.join(BANDS)})。MV の密度は曲の区間で"
        " 決める: genre-playbook の references/mv-dynamics.md §1",
        file=sys.stderr,
    )
    return True


def _target(raw: str | None) -> tuple[int, int] | None:
    """`150-200` → (150, 200). 1 つだけなら上下とも同じ."""
    if raw is None:
        return None
    low, _, high = raw.partition("-")
    return int(low), int(high or low)


def _run(source: str, fmt: str | None, target: str | None, *, as_json: bool) -> int:
    try:
        scenes = load_scenes(source)
        goal = _target(target)
    except (OSError, ValueError) as error:
        print(f"読めなかった: {error}", file=sys.stderr)
        return 2
    cuts = [cut for scene in scenes for cut in scene]
    grouped = scenes if len(scenes) > 1 else []
    report = build_report(cuts, fmt, target=goal, scenes=grouped)
    return _emit(report, as_json=as_json)


def main(argv: list[str]) -> int:
    source = _source(argv)
    fmt = _option(argv, "--format")
    if source is None:
        print(__doc__)
        return 2
    if _refuse_format(fmt):
        return 2
    target = _option(argv, "--target")
    return _run(source, fmt, target, as_json="--json" in argv[1:])


if __name__ == "__main__":
    sys.exit(main(sys.argv))
