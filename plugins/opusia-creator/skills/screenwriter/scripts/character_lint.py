r"""登場人物の設定と台詞から、機械で分かる書き落としを拾う.

    python3 <SKILL_DIR>/scripts/character_lint.py --characters <list_characters.json> \\
        --cuts <list_cuts.json> [--relationships <relationships.v1.json>] \\
        [--format short_drama] [--json]

## 何のためにあるか

- `height_cm` が 1 人でも欠けると身長比較表 (lineup) をサーバが断り、並ぶカットで
  身長が入れ替わる (references/characters.md §2)
- `note` に口調の 5 項目 (一人称 / 語尾 / 敬語 / 口癖 / 禁句) が無いと、全員が同じ
  喋り方になる (同 §1)
- 人物は初登場から 2 発話以内に名前か呼称で呼ばれる (dialogue-and-exposition.md §4。
  scene-writing.md #25。以前は「人が見る」だった)
- 短尺 (`short_drama` / `vertical_anime`) は 1 話に 3 人まで
  (genre-playbook の references/short-drama.md §2)

## 入れるもの

- `--characters`: `list_characters` の戻り値
- `--cuts`: `list_cuts` の戻り値 (話の順。シーンをまたぐなら連結した配列)
- `--relationships`: `relationships.v1` の doc (`edges[].to` と `address`)。
  呼称を名前以外でも数える

標準ライブラリだけ。終了コード: 0 = 所見なし / 1 = 所見あり / 2 = 読めなかった.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Any

#: note に書く口調の 5 項目 (characters.md §1)。見出しの語で有無を見る
TONE_ITEMS = (
    ("一人称", re.compile(r"一人称")),
    ("語尾", re.compile(r"語尾|文末")),
    ("敬語", re.compile(r"敬語|タメ")),
    ("口癖", re.compile(r"口癖|言い回し")),
    ("禁句", re.compile(r"禁句|言わない")),
)
#: 初登場から何発話以内に呼ばれるか (dialogue-and-exposition.md §4)
ADDRESS_WITHIN = 2
SHORT_FORMATS = frozenset({"short_drama", "vertical_anime"})
MAX_SHORT_SPEAKERS = 3


def _load(path: str | None) -> Any:  # noqa: ANN401
    return json.loads(Path(path).read_text("utf-8")) if path else None


def _rows(payload: Any) -> list[dict[str, Any]]:  # noqa: ANN401
    if isinstance(payload, dict):
        return _rows(payload.get("cuts", []))
    if not isinstance(payload, list):
        return []
    return [
        row
        for item in payload
        if isinstance(item, dict)
        for row in (
            _rows(item["cuts"]) if isinstance(item.get("cuts"), list) else [item]
        )
    ]


def utterances(cuts: Any) -> list[tuple[str, str]]:  # noqa: ANN401
    """(話者の id か名前, 本文) を話の順に."""
    return [
        (
            str(line.get("character_id") or line.get("speaker_label") or ""),
            str(line["text"]),
        )
        for cut in _rows(cuts)
        for line in sorted(cut.get("cut_lines") or [], key=lambda x: x.get("ord", 0))
        if isinstance(line, dict) and line.get("text")
    ]


def _names(character: dict[str, Any], edges: list[dict[str, Any]]) -> set[str]:
    ids = {str(character.get(k)) for k in ("id", "key", "name") if character.get(k)}
    called = {
        str(e["address"]) for e in edges if str(e.get("to")) in ids and e.get("address")
    }
    return {str(character.get("name") or ""), *called} - {""}


def height_missing(characters: list[dict[str, Any]]) -> list[str]:
    missing = [str(c.get("name")) for c in characters if not c.get("height_cm")]
    if not missing:
        return []
    return [
        f"height_cm が無い: {', '.join(missing)} (身長比較表が作れず、並ぶと入れ替わる)"
    ]


def tone_missing(characters: list[dict[str, Any]]) -> list[str]:
    found = []
    for c in characters:
        note = str(c.get("note") or "")
        absent = [label for label, pattern in TONE_ITEMS if not pattern.search(note)]
        if absent:
            found.append(f"{c.get('name')}: note に口調の {' / '.join(absent)} が無い")
    return found


def not_addressed(
    characters: list[dict[str, Any]],
    lines: list[tuple[str, str]],
    edges: list[dict[str, Any]],
) -> list[str]:
    return [
        f"{c.get('name')}: 初登場から {ADDRESS_WITHIN} 発話以内に名前・呼称で"
        "呼ばれない (関係は呼称で立つ)"
        for c in characters
        if not _addressed(c, lines, edges)
    ]


def _addressed(
    character: dict[str, Any],
    lines: list[tuple[str, str]],
    edges: list[dict[str, Any]],
) -> bool:
    """喋らない人物は対象外. 呼ばれてから喋る (直前の行で名指し) も数える."""
    ids = {str(character.get(k)) for k in ("id", "name") if character.get(k)}
    first = next((i for i, (who, _) in enumerate(lines) if who in ids), None)
    if first is None:
        return True
    window = " ".join(text for _, text in lines[: first + ADDRESS_WITHIN])
    return any(name in window for name in _names(character, edges))


def too_many_speakers(lines: list[tuple[str, str]], fmt: str | None) -> list[str]:
    speakers = {who for who, _ in lines if who}
    if fmt not in SHORT_FORMATS or len(speakers) <= MAX_SHORT_SPEAKERS:
        return []
    return [f"話者が {len(speakers)} 人 (短尺は 1 話に {MAX_SHORT_SPEAKERS} 人まで)"]


def check(
    characters: list[dict[str, Any]],
    cuts: Any,  # noqa: ANN401 - list_cuts の JSON (形は呼び出しで揃える)
    relationships: Any,  # noqa: ANN401 - relationships.v1 の doc
    fmt: str | None,
) -> list[str]:
    edges = (
        (relationships or {}).get("edges") or []
        if isinstance(relationships, dict)
        else []
    )
    lines = utterances(cuts)
    return [
        *height_missing(characters),
        *tone_missing(characters),
        *not_addressed(characters, lines, edges),
        *too_many_speakers(lines, fmt),
    ]


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=(__doc__ or "").splitlines()[0])
    parser.add_argument("--characters", required=True)
    parser.add_argument("--cuts", required=True)
    parser.add_argument("--relationships")
    parser.add_argument("--format")
    parser.add_argument("--json", action="store_true", help="JSON で出す")
    args = parser.parse_args(argv)
    try:
        characters = _load(args.characters)
        cuts, relationships = _load(args.cuts), _load(args.relationships)
    except (OSError, ValueError) as exc:
        print(f"読めなかった: {exc}", file=sys.stderr)
        return 2
    findings = check(characters or [], cuts, relationships, args.format)
    if args.json:
        print(json.dumps({"findings": findings}, ensure_ascii=False))
    else:
        print("\n".join(findings) or "所見なし")
    return 1 if findings else 0


if __name__ == "__main__":
    sys.exit(main())
