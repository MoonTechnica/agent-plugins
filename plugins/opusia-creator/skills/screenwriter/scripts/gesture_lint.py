"""字コンテのト書き (`note`) と生成の本文から、所作の書き落としを拾う.

    python3 <SKILL_DIR>/scripts/gesture_lint.py <cuts.json> [--json]

## 何のためにあるか

**書かなかった所作は学習データの最頻値 (西洋の既定値) で出る** —— 食べる → フォーク、
家に入る → 土足 (references/acting-and-gestures.md §2 の 3)。出た瞬間に
「日本を知らない絵」になり、直すには撮り直しが要る。語の有無で分かるところだけ見る。

## 見るもの

- 食べる・飲むのに、道具 (箸・茶碗・レンゲ・椀・湯呑・カップ …) が書かれていない
- ト書きに negative の語 (fork / handshake / shoes indoors …) が混ざっている
  (それは negative_prompt に入れるもので、本文に書くと出る)
- セル撮影の手段名 (T光 / 半露 / BOOK) を書いている (モデルに渡らない。§2 の 4)

## 入れるもの

`list_cuts(scene_id)` の戻り値。`note` と `gen_prompt` (あれば) を読む。

標準ライブラリだけ。終了コード: 0 = 所見なし / 1 = 所見あり / 2 = 読めなかった.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from collections.abc import Callable
from pathlib import Path
from typing import Any

EATING = re.compile(r"食べ|食う|すする|啜る|飲む|飲み|eat|drink|sip", re.IGNORECASE)
UTENSILS = re.compile(
    r"箸|はし|茶碗|椀|お椀|レンゲ|蓮華|湯呑|湯のみ|カップ|コップ|グラス|杯|盃|丼|皿|"
    r"chopsticks|bowl|cup|glass|mug|spoon|ladle",
    re.IGNORECASE,
)
#: acting-and-gestures.md §7 (本文に書かず negative_prompt に入れる語)
NEGATIVE_WORDS = (
    "fork",
    "knife",
    "handshake",
    "hug",
    "shoes indoors",
    "wearing shoes",
    "fist grip",
    "eating rice with the hands",
)
CEL_TERMS = re.compile(r"T光|透過光|半露|BOOK|ブック", re.IGNORECASE)


def _text(cut: dict[str, Any]) -> str:
    return " ".join(str(cut.get(k) or "") for k in ("note", "gen_prompt"))


def _key(cut: dict[str, Any]) -> str:
    return str(cut.get("key") or cut.get("id") or "?")


def no_utensil(cut: dict[str, Any]) -> list[str]:
    text = _text(cut)
    if not EATING.search(text) or UTENSILS.search(text):
        return []
    return [
        f"{_key(cut)}: 食べる / 飲むのに道具が無い (箸・茶碗・湯呑を名指しする。"
        "書かないと手掴みかフォークになる)"
    ]


def negative_in_text(cut: dict[str, Any]) -> list[str]:
    lowered = _text(cut).lower()
    found = [w for w in NEGATIVE_WORDS if re.search(rf"\b{re.escape(w)}\b", lowered)]
    if not found:
        return []
    return [
        f"{_key(cut)}: 本文に {', '.join(found)} がある"
        " (出したくない所作は negative_prompt に単語で入れる。本文に書くと出る)"
    ]


def cel_terms(cut: dict[str, Any]) -> list[str]:
    found = CEL_TERMS.findall(_text(cut))
    if not found:
        return []
    return [
        f"{_key(cut)}: セル撮影の手段名 ({', '.join(found)}) はモデルに渡らない。"
        "何がどう見えるかを書く (窓の光が白く滲んで輪郭を溶かす)"
    ]


CHECKS: tuple[Callable[[dict[str, Any]], list[str]], ...] = (
    no_utensil,
    negative_in_text,
    cel_terms,
)


def cuts_of(payload: Any) -> list[dict[str, Any]]:  # noqa: ANN401
    if isinstance(payload, dict):
        return cuts_of(payload.get("cuts", []))
    if not isinstance(payload, list):
        return []
    return [
        row
        for item in payload
        if isinstance(item, dict)
        for row in (
            cuts_of(item["cuts"]) if isinstance(item.get("cuts"), list) else [item]
        )
    ]


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=(__doc__ or "").splitlines()[0])
    parser.add_argument("cuts", help="list_cuts の JSON (- で標準入力)")
    parser.add_argument("--json", action="store_true", help="JSON で出す")
    args = parser.parse_args(argv)
    try:
        raw = (
            sys.stdin.read() if args.cuts == "-" else Path(args.cuts).read_text("utf-8")
        )
        cuts = cuts_of(json.loads(raw))
    except (OSError, ValueError) as exc:
        print(f"読めなかった: {exc}", file=sys.stderr)
        return 2
    findings = [f for cut in cuts for check in CHECKS for f in check(cut)]
    if args.json:
        print(json.dumps({"findings": findings}, ensure_ascii=False))
    else:
        print("\n".join(findings) or "所見なし")
    return 1 if findings else 0


if __name__ == "__main__":
    sys.exit(main())
