"""動画生成の本文を、課金する前に機械で見られるところまで見る.

    python3 <SKILL_DIR>/scripts/prompt_lint.py <prompt.txt> --model <slug> [--json]
    python3 <SKILL_DIR>/scripts/prompt_lint.py - --model seedance-2.5   # 標準入力

## 何のためにあるか

生成は 1 本ごとに課金され、書き損じは**出来上がりを見るまで分からない**。
矛盾したカメラ指示・品質語・本文の否定形・モデルごとに逆を向く台詞の記法は、
どれも本文を読めば機械で分かる。ここはそれだけを見る。

規則の正本は SKILL.md §3〜§6.5、references/action-prompting.md §3・§5、
references/lip-sync.md。

## 入れるもの

`generate_scene` / `generate_asset` に渡す `fields.prompt` の本文 (テキスト)。
`--model` は渡す model の slug (`seedance-2.5` / `minimax-h3` / `kling-v3-pro` …)。
`--singing` は歌唱カット (`reference_audio` で口を合わせる)。

**ショット列** (`Shot 1:` / `[0-3s]` / `ショット1` で始まる行) は、サイズと
カメラの検査をショットごとに行う (ショットが違えばサイズも動きも違ってよい)。

## やらないこと (画を見る判断)

- 修飾語の数・出来事の数・所作の 5 項目が埋まっているか … 文の意味が要る
- 構図の良し悪し・破綻しやすい題材 (手指・文字・群衆) を避けているか

## 依存と呼び方

**標準ライブラリだけ**。`python3 <path>` で呼ぶ (shebang は置いていない。
ローカルへ展開する materialize-skills が実行ビットを付けられないため)。

終了コード: 0 = 所見なし / 1 = 所見あり / 2 = 読めなかった.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path

#: 画面に映らない語 (SKILL.md §3 / action-prompting.md §3-1)
QUALITY_WORDS = (
    "cinematic",
    "beautiful",
    "stunning",
    "masterpiece",
    "high quality",
    "best quality",
    "ultra realistic",
    "8k",
    "4k",
    "映画的",
    "美しい",
    "高品質",
    "最高品質",
    "傑作",
)
#: 同時に言えないカメラ指示 (SKILL.md §4)
CAMERA_CONFLICTS = (
    (("static", "fixed camera", "locked-off", "locked off"), ("handheld",)),
    (("dolly in", "push in"), ("zoom out",)),
    (("dolly out", "pull out", "pull back"), ("zoom in",)),
)
#: ショットサイズ (1 ショットに 1 つ)。長い語から当てる
SHOT_SIZES = (
    "extreme close-up",
    "medium close-up",
    "extreme wide shot",
    "close-up",
    "medium shot",
    "full shot",
    "wide shot",
)
#: 時間帯 (1 つに決める)
TIMES_OF_DAY = ("golden hour", "midday", "noon", "night", "midnight", "dawn", "dusk")
_TIME_COMPATIBLE = (
    {"golden hour", "dusk"},
    {"golden hour", "dawn"},
    {"night", "midnight"},
)
#: 主要軌道 (1 ショットに 1 つ)。head bob / sway / 呼吸は補助なので数えない
CAMERA_MOVES = (
    "dolly zoom",
    "dolly in",
    "dolly out",
    "push in",
    "pull out",
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
    "arc shot",
    "zoom in",
    "zoom out",
    "tracking shot",
    "whip pan",
    "dronie",
    "helix",
    "boomerang",
    "rocket shot",
    "flyover",
    "flyby",
    "fly-through",
    "fpv chase",
    "ground skimming",
    "water skimming",
    "spiral descent",
)
#: 本文の否定形 (action-prompting.md §3-4). negative_prompt に単語で入れる
NEGATIVE = re.compile(
    r"\b(?:no|not|don't|do not|never|without|avoid)\b|しない|写さない|入れない|禁止",
    re.IGNORECASE,
)
#: Seedance だけは字幕・音の抑止を本文に書く (action-prompting.md §5)
SEEDANCE_ALLOWED_NEGATIVE = re.compile(
    r"\bno (?:subtitles?|captions?|music|background music|text)\b", re.IGNORECASE
)
REQUEST_PHRASES = re.compile(
    r"\bplease\b|してください|して下さい|お願い", re.IGNORECASE
)
SHOT_START = re.compile(
    r"^\s*(?:shot\s*\d+|\[\s*\d|ショット\s*\d|カット\s*\d)", re.IGNORECASE
)
#: 全角の括弧とコロン (日本語の本文はこちらで書かれる)
_OPEN, _CLOSE, _COLON = "（", "）", "："  # noqa: RUF001 - 全角で書かれた本文を読むため
#: Seedance の台詞のあとの括弧 (演技指示) は字幕になる
SEEDANCE_TRAILING_DIRECTION = re.compile(
    rf"[:{_COLON}][^\n]*[({_OPEN}][^){_CLOSE}\n]*[){_CLOSE}]\s*$", re.MULTILINE
)
QUOTED_JAPANESE = re.compile(r"[「」\"“”][^\"“”「」]*[぀-ヿ]")
#: 本文の上限 (action-prompting.md §2: MiniMax H3 = 7000 文字)
PROMPT_LIMITS = {
    "minimax-h3": 7000,
    "minimax-h3-max": 7000,
    "minimax-h3-max-turbo": 7000,
}
SILENCED = (
    f"{_OPEN}台詞なし{_CLOSE}",
    "(台詞なし)",
    "(no dialogue)",
    "no dialogue",
    "台詞なし",
)


@dataclass(frozen=True)
class Draft:
    """検める本文と、その渡し先."""

    prompt: str
    model: str
    singing: bool

    @property
    def lowered(self) -> str:
        return self.prompt.lower()


Finding = tuple[str, str]
Check = Callable[[Draft], list[Finding]]


def _found(text: str, words: tuple[str, ...]) -> list[str]:
    return [w for w in words if re.search(rf"(?<![\w-]){re.escape(w)}(?![\w-])", text)]


def _when(condition: object, code: str, message: str) -> list[Finding]:
    return [(code, message)] if condition else []


def _is_json(text: str) -> bool:
    stripped = text.strip()
    if not stripped.startswith(("{", "[")):
        return False
    try:
        json.loads(stripped)
    except ValueError:
        return False
    return True


def check_json(draft: Draft) -> list[Finding]:
    return _when(
        _is_json(draft.prompt),
        "json_prompt",
        "JSON で書かない (どのベンダーも推奨していない)。ラベル付きの平文にする",
    )


def check_length(draft: Draft) -> list[Finding]:
    limit = PROMPT_LIMITS.get(draft.model)
    return _when(
        limit is not None and len(draft.prompt) > limit,
        "too_long",
        f"{draft.model} の本文は {limit} 文字まで (今 {len(draft.prompt)} 文字)",
    )


def check_quality(draft: Draft) -> list[Finding]:
    words = _found(draft.lowered, QUALITY_WORDS)
    return _when(
        words,
        "quality_word",
        f"情報を持たない語: {', '.join(words)}。画の言葉 (レンズ・光・色) に直すか消す",
    )


def check_requests(draft: Draft) -> list[Finding]:
    return _when(
        REQUEST_PHRASES.search(draft.prompt),
        "request_phrase",
        "依頼文 (please / してください) は枠を食うだけ。描写に直す",
    )


def check_negative(draft: Draft) -> list[Finding]:
    text = draft.prompt
    if draft.model == "seedance-2.5":
        text = SEEDANCE_ALLOWED_NEGATIVE.sub("", text)
    hits = sorted({m.group(0).lower() for m in NEGATIVE.finditer(text)})
    return _when(
        hits,
        "negative_phrasing",
        f"本文の否定形 ({', '.join(hits)}) は逆に出ることがある。"
        "negative_prompt に単語で入れる (受けないモデルは編集で直す)",
    )


def _shots(lowered: str) -> list[str]:
    """ショット列ならショットごとに、そうでなければ全体を 1 つとして返す."""
    shots: list[list[str]] = [[]]
    for line in lowered.splitlines():
        if SHOT_START.match(line) and shots[-1]:
            shots.append([])
        shots[-1].append(line)
    return ["\n".join(lines) for lines in shots if lines]


def _distinct_sizes(shot: str) -> list[str]:
    """長い語から拾い、拾った範囲は短い語で数え直さない (close-up ⊂ medium close-up)."""
    remaining = shot
    found: list[str] = []
    for size in SHOT_SIZES:
        pattern = rf"(?<![\w-]){re.escape(size)}(?![\w-])"
        if re.search(pattern, remaining):
            found.append(size)
            remaining = re.sub(pattern, " ", remaining)
    return found


def _dolly_zoom_components(shot: str) -> set[str]:
    """明示したドリーズームの移動・画角変化は 1 技法."""
    named = _found(shot, ("dolly zoom",))
    legs = tuple(
        word for pair in CAMERA_CONFLICTS[1:] for group in pair for word in group
    )
    all_legs = set(_found(shot, legs))
    for a, b in CAMERA_CONFLICTS[1:]:
        components = set(_found(shot, (*a, *b)))
        if named and _found(shot, a) and _found(shot, b) and all_legs == components:
            return components
    return set()


def _conflicts(shot: str, components: set[str]) -> list[Finding]:
    pairs = [(_found(shot, a), _found(shot, b)) for a, b in CAMERA_CONFLICTS]
    return [
        ("camera_conflict", f"同時に言えない: {a[0]} と {b[0]}。1 つに決める")
        for a, b in pairs
        if a and b and not set(a + b) <= components
    ]


def _one_shot(shot: str) -> list[Finding]:
    sizes = _distinct_sizes(shot)
    components = _dolly_zoom_components(shot)
    moves = [move for move in _found(shot, CAMERA_MOVES) if move not in components]
    return [
        *_conflicts(shot, components),
        *_when(
            len(sizes) > 1,
            "camera_conflict",
            f"1 ショットにサイズが {len(sizes)} つ: {', '.join(sizes)}",
        ),
        *_when(
            len(moves) > 1,
            "camera_moves",
            f"1 ショットにカメラの動きが {len(moves)} つ: {', '.join(moves)}",
        ),
    ]


def check_shots(draft: Draft) -> list[Finding]:
    return [f for shot in _shots(draft.lowered) for f in _one_shot(shot)]


def check_time_of_day(draft: Draft) -> list[Finding]:
    times = set(_found(draft.lowered, TIMES_OF_DAY))
    clash = len(times) > 1 and not any(times <= ok for ok in _TIME_COMPATIBLE)
    return _when(
        clash,
        "time_conflict",
        f"時間帯が {len(times)} つ: {', '.join(sorted(times))}",
    )


def check_seedance_dialogue(draft: Draft) -> list[Finding]:
    return _when(
        draft.model == "seedance-2.5"
        and SEEDANCE_TRAILING_DIRECTION.search(draft.prompt),
        "dialogue_subtitles",
        "Seedance は台詞のあとの括弧の演技指示で字幕が出る。感情は話者の側に書く",
    )


def check_kling_dialogue(draft: Draft) -> list[Finding]:
    return _when(
        draft.model.startswith("kling") and QUOTED_JAPANESE.search(draft.prompt),
        "japanese_dialogue",
        "Kling は日本語の台詞を黙って英訳する。日本語を喋らせるなら Seedance",
    )


def check_singing_silenced(draft: Draft) -> list[Finding]:
    return _when(
        draft.singing and any(word in draft.lowered for word in SILENCED),
        "singing_silenced",
        "歌唱カットに「台詞なし」を書かない (口が動かなくなる)",
    )


def _audio_reference_wrong(draft: Draft) -> bool:
    if draft.model == "seedance-2.5":
        return "@Audio1" not in draft.prompt
    if draft.model.startswith("minimax-h3"):
        return "@Audio" in draft.prompt or not re.search(r"\bAudio 1\b", draft.prompt)
    return False


def check_audio_reference(draft: Draft) -> list[Finding]:
    return _when(
        draft.singing and _audio_reference_wrong(draft),
        "audio_reference",
        "参照音声の名指しがモデルと合わない: Seedance は @Audio1、"
        "MiniMax H3 は Audio 1 (誰が歌うかを本文で言う)",
    )


CHECKS: tuple[Check, ...] = (
    check_json,
    check_length,
    check_quality,
    check_requests,
    check_negative,
    check_shots,
    check_time_of_day,
    check_seedance_dialogue,
    check_kling_dialogue,
    check_singing_silenced,
    check_audio_reference,
)


def lint(draft: Draft) -> list[Finding]:
    return [finding for check in CHECKS for finding in check(draft)]


def _read(source: str) -> str:
    return sys.stdin.read() if source == "-" else Path(source).read_text("utf-8")


def _print(findings: list[Finding], model: str, *, as_json: bool) -> None:
    if as_json:
        rows = [{"code": code, "message": message} for code, message in findings]
        print(json.dumps({"model": model, "findings": rows}, ensure_ascii=False))
        return
    lines = [f"[{code}] {message}" for code, message in findings]
    print("\n".join(lines) or "所見なし")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=(__doc__ or "").splitlines()[0])
    parser.add_argument("prompt", help="本文のファイル (- で標準入力)")
    parser.add_argument("--model", default="", help="model の slug")
    parser.add_argument("--singing", action="store_true", help="歌唱カット")
    parser.add_argument("--json", action="store_true", help="JSON で出す")
    args = parser.parse_args(argv)
    try:
        prompt = _read(args.prompt)
    except OSError as exc:
        print(f"読めなかった: {exc}", file=sys.stderr)
        return 2
    findings = lint(Draft(prompt=prompt, model=args.model, singing=args.singing))
    _print(findings, args.model, as_json=args.json)
    return 1 if findings else 0


if __name__ == "__main__":
    sys.exit(main())
