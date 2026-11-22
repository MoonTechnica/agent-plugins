"""字コンテのカット列から、台詞の量と間の取り方を数える.

    python3 <SKILL_DIR>/scripts/dialogue_report.py <cuts.json> [--json]
    python3 <SKILL_DIR>/scripts/dialogue_report.py -            # 標準入力

## 何のためにあるか

「セリフが少なすぎて、どういう場面なのか分からない」は**書いている最中には
見えない**。1 カットずつ見れば、どれも静かで良い芝居に見えるからである。
見えるのは合計を割ったときだけなので、ここはそれを数える。

判定の根拠と直し方は references/dialogue-and-exposition.md。

## 入れるもの

`list_cuts(scene_id)` の戻り値 (JSON)。シーンをまたいで測るときは、
各シーンぶんを連結した 1 つの配列にする。次のどれでも読む:

    [ {..cut..}, ... ]
    { "cuts": [ ... ] }
    [ { "scene": {...}, "cuts": [ ... ] }, ... ]   # plan_scenes の戻り値

## やらないこと

- **誰・どこ・いつ・望み・障害が言葉に載っているか** … 意味を読む検査なので
  人が見る (reference の §8)。ここは数えられるものだけを数える
- 尺の妥当性 (台詞の文字数に対して秒が足りているか・平均カット長) … cut_pacing.py

## 依存と呼び方

**標準ライブラリだけ**。`python3 <path>` で呼ぶ (shebang は置いていない。
ローカルへ展開する materialize-skills が実行ビットを付けられないため)。

終了コード: 0 = 所見なし / 1 = 所見あり / 2 = 読めなかった.
"""

from __future__ import annotations

import json
import sys
from dataclasses import dataclass, field, replace
from pathlib import Path
from typing import Any

#: 1 分あたりの台詞の字数。下限を割った稿は「静かな演出」ではなく情報不足
MIN_CHARS_PER_MIN = 150
STD_CHARS_PER_MIN_LOW = 200
STD_CHARS_PER_MIN_HIGH = 280
#: 話す速さの限界。超えると早口で潰れる
MAX_CHARS_PER_MIN = 300
#: 1 発話の上限。字幕は 2 行 x 13〜16 全角字までしか出せない
MAX_LINE_CHARS = 30
#: 1 分あたりの発話回数。下回ると会話が成立していない
MIN_LINES_PER_MIN = 12
STD_LINES_PER_MIN = 20
#: 画も音も台詞も変わらない時間の上限
MAX_SILENT_RUN_SECONDS = 3
#: 冒頭で「誰・どこ・望み・障害」を立て終える窓。短い作品ほど前倒し
OPENING_WINDOW_SECONDS = 20
SHORT_OPENING_WINDOW_SECONDS = 10
SHORT_TOTAL_SECONDS = 30
SECONDS_PER_MINUTE = 60
#: 読み上げの時間を持たない文字。字数に数えると密度を過大に見積もる
PUNCTUATION = "…‥・、。，．！？!?「」『』〈〉《》()[]〔〕【】 　\t\n\r-—ー~〜:：;；"  # noqa: RUF001


@dataclass(frozen=True)
class Line:
    """発話 1 つ."""

    cut_key: str
    text: str
    speaker: str | None

    @property
    def spoken_chars(self) -> int:
        return sum(1 for ch in self.text if ch not in PUNCTUATION)


@dataclass(frozen=True)
class Cut:
    """カット 1 つ (尺と発話だけ)."""

    key: str
    seconds: int
    lines: list[Line] = field(default_factory=list)


def _as_rows(payload: Any) -> list[dict[str, Any]]:  # noqa: ANN401
    """3 つの入力の形を、カットの配列に揃える."""
    if isinstance(payload, dict):
        return _as_rows(payload.get("cuts", []))
    if not isinstance(payload, list):
        return []
    return [row for item in payload for row in _rows_of(item)]


def _rows_of(item: Any) -> list[dict[str, Any]]:  # noqa: ANN401
    """1 要素を、カットの配列へ. シーンに梱包済みなら中の cuts を開く."""
    if not isinstance(item, dict):
        return []
    nested = item.get("cuts")
    return _as_rows(nested) if isinstance(nested, list) else [item]


def _speaker(row: dict[str, Any]) -> str | None:
    """話者の表示名. ラベル → 埋め込みキャラ → id の順に拾う."""
    names = (
        row.get("speaker_label"),
        row.get("speaker"),
        _character_name(row),
        row.get("character_id"),
    )
    return next((str(n).strip() for n in names if str(n or "").strip()), None)


def _character_name(row: dict[str, Any]) -> Any:  # noqa: ANN401
    """発話に埋め込まれた登場人物 (`cut_lines(*, characters(...))`) の名前."""
    character = row.get("characters") or row.get("character") or {}
    return character.get("name") if isinstance(character, dict) else None


def _to_cut(row: dict[str, Any]) -> Cut:
    key = str(row.get("key") or row.get("id") or "?")
    lines = [
        Line(cut_key=key, text=str(line.get("text") or ""), speaker=_speaker(line))
        for line in row.get("cut_lines") or row.get("lines") or []
        if isinstance(line, dict)
    ]
    return Cut(key=key, seconds=int(row.get("duration_seconds") or 0), lines=lines)


def load_cuts(source: str) -> list[Cut]:
    """ファイルか標準入力から読み、カット列にして返す."""
    raw = sys.stdin.read() if source == "-" else Path(source).read_text("utf-8")
    return [_to_cut(row) for row in _as_rows(json.loads(raw))]


@dataclass(frozen=True)
class Report:
    """数えた結果. `findings` が空なら所見なし."""

    cuts: int
    seconds: int
    lines: int
    chars: int
    spoken_chars: int
    chars_per_min: float
    lines_per_min: float
    voiced_cuts: int
    longest_silence: int
    findings: list[str]

    def as_dict(self) -> dict[str, Any]:
        return {
            "cuts": self.cuts,
            "seconds": self.seconds,
            "lines": self.lines,
            "chars": self.chars,
            "spoken_chars": self.spoken_chars,
            "chars_per_min": round(self.chars_per_min, 1),
            "lines_per_min": round(self.lines_per_min, 1),
            "voiced_cuts": self.voiced_cuts,
            "longest_silence_seconds": self.longest_silence,
            "findings": self.findings,
        }


def _longest_silent_run(cuts: list[Cut]) -> int:
    longest = 0
    run = 0
    for cut in cuts:
        run = 0 if cut.lines else run + cut.seconds
        longest = max(longest, run)
    return longest


def _opening_window(total_seconds: int) -> int:
    if total_seconds <= SHORT_TOTAL_SECONDS:
        return SHORT_OPENING_WINDOW_SECONDS
    return OPENING_WINDOW_SECONDS


def _lines_within(cuts: list[Cut], window_seconds: int) -> int:
    elapsed = 0
    spoken = 0
    for cut in cuts:
        if elapsed >= window_seconds:
            break
        spoken += len(cut.lines)
        elapsed += cut.seconds
    return spoken


def _check_density(report: Report) -> list[str]:
    if report.chars_per_min < MIN_CHARS_PER_MIN:
        short_by = int(
            MIN_CHARS_PER_MIN * report.seconds / SECONDS_PER_MINUTE
            - report.spoken_chars
        )
        return [
            f"台詞が {report.chars_per_min:.0f} 字/分 しかない"
            f" (下限 {MIN_CHARS_PER_MIN} / 標準 {STD_CHARS_PER_MIN_LOW}"
            f"〜{STD_CHARS_PER_MIN_HIGH})。あと {short_by} 字ぶん足りない"
        ]
    if report.chars_per_min > MAX_CHARS_PER_MIN:
        return [
            f"台詞が {report.chars_per_min:.0f} 字/分 で速すぎる"
            f" (上限 {MAX_CHARS_PER_MIN})。尺を足すか台詞を削る"
        ]
    return []


def _check_line_rate(report: Report) -> list[str]:
    if report.lines_per_min < MIN_LINES_PER_MIN:
        return [
            f"やりとりが {report.lines_per_min:.0f} 回/分 しかない"
            f" (下限 {MIN_LINES_PER_MIN} / 標準 {STD_LINES_PER_MIN}〜24)"
        ]
    return []


def _check_long_lines(cuts: list[Cut]) -> list[str]:
    return [
        f"{line.cut_key} の発話が {len(line.text)} 字"
        f" (上限 {MAX_LINE_CHARS})。字幕で読み切れないので割る: {line.text[:20]}…"
        for cut in cuts
        for line in cut.lines
        if len(line.text) > MAX_LINE_CHARS
    ]


def _check_silence(cuts: list[Cut]) -> list[str]:
    longest = _longest_silent_run(cuts)
    if longest > MAX_SILENT_RUN_SECONDS:
        return [
            f"台詞の無い区間が {longest} 秒続く"
            f" (上限 {MAX_SILENT_RUN_SECONDS})。間は 1〜2 秒に切り、言葉で挟む"
        ]
    return []


def _check_opening(cuts: list[Cut], total_seconds: int) -> list[str]:
    window = _opening_window(total_seconds)
    if _lines_within(cuts, window) == 0:
        return [
            f"冒頭 {window} 秒に発話が 1 つも無い。"
            "誰・どこ・望み・障害はここで立て終える"
        ]
    return []


def _check_speakers(cuts: list[Cut]) -> list[str]:
    return [
        f"{line.cut_key} の発話に話者が無い: {line.text[:20]}"
        for cut in cuts
        for line in cut.lines
        if not line.speaker
    ]


def build_report(cuts: list[Cut]) -> Report:
    """カット列を数え、下限を割っているところを所見にして返す."""
    lines = [line for cut in cuts for line in cut.lines]
    seconds = sum(cut.seconds for cut in cuts)
    spoken = sum(line.spoken_chars for line in lines)
    minutes = seconds / SECONDS_PER_MINUTE if seconds else 0.0
    report = Report(
        cuts=len(cuts),
        seconds=seconds,
        lines=len(lines),
        chars=sum(len(line.text) for line in lines),
        spoken_chars=spoken,
        chars_per_min=spoken / minutes if minutes else 0.0,
        lines_per_min=len(lines) / minutes if minutes else 0.0,
        voiced_cuts=sum(1 for cut in cuts if cut.lines),
        longest_silence=_longest_silent_run(cuts),
        findings=[],
    )
    if not seconds:
        return report
    findings = [
        *_check_density(report),
        *_check_line_rate(report),
        *_check_opening(cuts, seconds),
        *_check_silence(cuts),
        *_check_long_lines(cuts),
        *_check_speakers(cuts),
    ]
    return replace(report, findings=findings)


def _summary(report: Report) -> str:
    return (
        f"{report.cuts} カット / {report.seconds} 秒 / "
        f"発話 {report.lines} ({report.voiced_cuts} カット) / "
        f"{report.spoken_chars} 字 -> {report.chars_per_min:.0f} 字/分"
    )


def _print_findings(findings: list[str]) -> None:
    for finding in findings:
        print(f"[!] {finding}")
    if not findings:
        print("所見なし")


def _emit(report: Report, *, as_json: bool) -> int:
    if as_json:
        print(json.dumps(report.as_dict(), ensure_ascii=False, indent=2))
    else:
        print(_summary(report))
        _print_findings(report.findings)
    return 1 if report.findings else 0


def _sources(argv: list[str]) -> list[str]:
    return [a for a in argv[1:] if not a.startswith("--")]


def main(argv: list[str]) -> int:
    sources = _sources(argv)
    if not sources:
        print(__doc__)
        return 2
    try:
        cuts = load_cuts(sources[0])
    except (OSError, ValueError) as error:
        print(f"読めなかった: {error}", file=sys.stderr)
        return 2
    return _emit(build_report(cuts), as_json="--json" in argv[1:])


if __name__ == "__main__":
    sys.exit(main(sys.argv))
