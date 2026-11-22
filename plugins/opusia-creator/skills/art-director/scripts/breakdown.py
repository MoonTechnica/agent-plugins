r"""字コンテから設定素材の不足を数える (④' 設定の洗い出し / 香盤表).

    python3 <SKILL_DIR>/scripts/breakdown.py --cuts <list_cuts.json> \\
        --slots <list_slots.json> [--characters <list_characters.json>] [--json]

## 何のためにあるか

何をいくつ作るかは字コンテを読むまで決まらず、**数えずに作り始めると本に出ない
場所を作る** (SKILL.md §1.5)。人物と場所 x 時間帯は `cut_lines.character_id` と
`cuts.location` / `cuts.time_of_day` から数えられるので、手で数えない。
小物 (人が手に触れる物) は `note` を読む判断なのでここでは数えない。

## 入れるもの

- `--cuts`: `list_cuts` の戻り値 (複数シーンは `[{"cuts": [...]}, ...]`。
  シーン数も数える)
- `--slots`: `list_slots` の戻り値 (`key` と `current_asset_id`)
- `--characters`: `list_characters` の戻り値 (id → key と `height_cm`)

## 出すもの

- `backgrounds`: 場所 x 時間帯ごとのカット数・シーン数と、スロット
  `background.<場所>.<時間帯>` があるか。1 カットだけなら「シートにせず 1 枚」
- `characters`: 出る人物と `character.<key>.base` があるか
- 所見: 不足の一覧・身長比較表 (2〜6 人・全員 `height_cm`)・
  カラースクリプト (12 シーンまで)

標準ライブラリだけ。終了コード: 0 = 不足なし / 1 = 不足・所見あり / 2 = 読めなかった.
"""

from __future__ import annotations

import argparse
import json
import sys
from collections import Counter
from pathlib import Path
from typing import Any

#: 身長比較表の人数 (SKILL.md: 2〜6 人) とカラースクリプトのシーン数 (12 まで)
LINEUP_RANGE = (2, 6)
COLORSCRIPT_MAX_SCENES = 12


def _load(path: str | None) -> Any:  # noqa: ANN401
    return json.loads(Path(path).read_text("utf-8")) if path else None


def scenes_of(payload: Any) -> list[list[dict[str, Any]]]:  # noqa: ANN401
    items = payload.get("cuts", []) if isinstance(payload, dict) else payload or []
    grouped = items and all(
        isinstance(i, dict) and isinstance(i.get("cuts"), list) for i in items
    )
    groups = [i["cuts"] for i in items] if grouped else [items]
    return [[c for c in g if isinstance(c, dict)] for g in groups]


def _filled(slots: Any) -> set[str]:  # noqa: ANN401
    rows = slots if isinstance(slots, list) else []
    return {
        str(s["key"]) for s in rows if isinstance(s, dict) and s.get("current_asset_id")
    }


def backgrounds(
    scenes: list[list[dict[str, Any]]], filled: set[str]
) -> list[dict[str, Any]]:
    cuts = Counter()
    scene_count: Counter[tuple[str, str]] = Counter()
    for scene in scenes:
        places = {
            (str(c.get("location") or ""), str(c.get("time_of_day") or ""))
            for c in scene
        }
        scene_count.update(places)
        cuts.update(
            (str(c.get("location") or ""), str(c.get("time_of_day") or ""))
            for c in scene
        )
    return [
        {
            "slot": f"background.{place}.{time}",
            "cuts": n,
            "scenes": scene_count[(place, time)],
            "exists": f"background.{place}.{time}" in filled,
            "advice": "1 カットだけ: シートにせず generate_asset で 1 枚"
            if n == 1
            else "",
        }
        for (place, time), n in sorted(cuts.items())
        if place and time
    ]


def _speakers(scenes: list[list[dict[str, Any]]]) -> list[str]:
    """話した順の人物 id (重複なし)."""
    ids = [
        str(line["character_id"])
        for scene in scenes
        for cut in scene
        for line in cut.get("cut_lines") or []
        if isinstance(line, dict) and line.get("character_id")
    ]
    return list(dict.fromkeys(ids))


def characters(
    scenes: list[list[dict[str, Any]]], known: list[dict[str, Any]], filled: set[str]
) -> list[dict[str, Any]]:
    by_id = {str(c.get("id")): c for c in known}
    out = []
    for cid in _speakers(scenes):
        row = by_id.get(cid, {})
        key = str(row.get("key") or cid)
        slot = f"character.{key}.base"
        out.append(
            {
                "id": cid,
                "name": row.get("name"),
                "slot": slot,
                "exists": slot in filled,
                "height_cm": row.get("height_cm"),
            }
        )
    return out


def _missing(bgs: list[dict[str, Any]], cast: list[dict[str, Any]]) -> list[str]:
    slots = [r["slot"] for r in (*bgs, *cast) if not r["exists"]]
    return [f"作る対象 (スロットに無い): {', '.join(slots)}"] if slots else []


def _lineup(cast: list[dict[str, Any]]) -> list[str]:
    if len(cast) < LINEUP_RANGE[0]:
        return []
    no_height = [str(c["name"] or c["id"]) for c in cast if not c["height_cm"]]
    over = len(cast) > LINEUP_RANGE[1]
    return [
        *(
            [
                f"身長比較表: height_cm が無い {', '.join(no_height)}"
                " (1 人でも欠けると断られる)"
            ]
            if no_height
            else []
        ),
        *(
            [
                f"身長比較表は {LINEUP_RANGE[1]} 人まで ({len(cast)} 人。"
                "key でグループを分ける)"
            ]
            if over
            else []
        ),
    ]


def _colorscript(scenes: int) -> list[str]:
    if scenes <= COLORSCRIPT_MAX_SCENES:
        return []
    return [
        f"カラースクリプトは {COLORSCRIPT_MAX_SCENES} シーンまで"
        f" ({scenes} シーン。前半 / 後半で 2 枚)"
    ]


def findings(
    bgs: list[dict[str, Any]], cast: list[dict[str, Any]], scenes: int
) -> list[str]:
    return [*_missing(bgs, cast), *_lineup(cast), *_colorscript(scenes)]


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=(__doc__ or "").splitlines()[0])
    parser.add_argument("--cuts", required=True)
    parser.add_argument("--slots", required=True)
    parser.add_argument("--characters")
    parser.add_argument("--json", action="store_true", help="JSON で出す")
    args = parser.parse_args(argv)
    try:
        scenes = scenes_of(_load(args.cuts))
        filled, known = _filled(_load(args.slots)), _load(args.characters) or []
    except (OSError, ValueError) as exc:
        print(f"読めなかった: {exc}", file=sys.stderr)
        return 2
    bgs, cast = backgrounds(scenes, filled), characters(scenes, known, filled)
    report = {
        "backgrounds": bgs,
        "characters": cast,
        "findings": findings(bgs, cast, len(scenes)),
    }
    print(json.dumps(report, ensure_ascii=False, indent=None if args.json else 2))
    return 1 if report["findings"] else 0


if __name__ == "__main__":
    sys.exit(main())
