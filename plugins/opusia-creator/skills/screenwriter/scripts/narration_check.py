"""説明もの (explainer) のナレーションを、ビートの尺と読み上げで検める.

    python3 <SKILL_DIR>/scripts/narration_check.py <beats.json> [--lang ja|en] [--json]

## 何のためにあるか

ナレーションの量は秒数で決まり (日本語およそ 300 字/分、英語 2.5 語/秒)、
TTS は字面どおりに読む (`135+` / `API` / `99.999%` / `stripe.com`)。どちらも
書いた文字から機械で分かるので、`text_to_speech` で課金する前にここで見る。
根拠は genre-playbook の references/explainer.md §2・§3。

## 入れるもの

ビートの配列 (ビート表の行):

```json
[{"role": "hook", "narration": "…", "seconds": 4},
 {"role": "product_intro", "narration": "…", "seconds": 6, "promise": true}]
```

`seconds` の代わりに `cuts` (`list_cuts` の行) を渡すと、尺は `duration_seconds` の
合計、本文は `cut_lines` の連結になる。`promise: true` を付けたビートが約束で、
2 ビート目までに無ければ指摘する (付けていなければ判定しない)。

標準ライブラリだけ。終了コード: 0 = 所見なし / 1 = 所見あり / 2 = 読めなかった.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Any

#: explainer.md §3: 日本語およそ 300 字/分 (= 5 字/秒)、英語 2.5 語/秒
CHARS_PER_SECOND_JA = 5.0
WORDS_PER_SECOND_EN = 2.5
#: 約束を着地させる位置 (explainer.md §2: 2 ビート目まで)
PROMISE_BY = 2
SILENT = re.compile(r"[\s、。，．・「」『』!?！？…ー\-]")  # noqa: RUF001
#: TTS が字面どおりに読むもの (数字と記号 / 英大文字の略語 / ドメイン)
LITERAL = re.compile(
    r"\d[\d,.]*\s*[+%$]|[$¥€]\s*\d|\b[A-Z]{2,}\b|\b[\w-]+\.(?:com|io|ai|jp|net|org|dev)\b"
)


def _beat(row: dict[str, Any]) -> dict[str, Any]:
    cuts = [c for c in row.get("cuts") or [] if isinstance(c, dict)]
    if cuts:
        text = "".join(
            str(line.get("text") or "")
            for c in cuts
            for line in c.get("cut_lines") or []
        )
        seconds = sum(float(c.get("duration_seconds") or 0) for c in cuts)
    else:
        text, seconds = str(row.get("narration") or ""), float(row.get("seconds") or 0)
    return {
        "role": row.get("role"),
        "text": text,
        "seconds": seconds,
        "promise": bool(row.get("promise")),
    }


def needed_seconds(text: str, lang: str) -> float:
    if lang == "en":
        return len(text.split()) / WORDS_PER_SECOND_EN
    return len(SILENT.sub("", text)) / CHARS_PER_SECOND_JA


def _overflow(i: int, beat: dict[str, Any], lang: str) -> list[str]:
    need = needed_seconds(beat["text"], lang)
    if not beat["text"] or need <= beat["seconds"]:
        return []
    return [
        f"ビート {i + 1} ({beat['role']}): ナレーションに {need:.1f} 秒要る"
        f" ({beat['seconds']:g} 秒に入らない。削るか尺を足す)"
    ]


def _literal(i: int, beat: dict[str, Any], _: str) -> list[str]:
    found = sorted({m.group(0).strip() for m in LITERAL.finditer(beat["text"])})
    if not found:
        return []
    return [
        f"ビート {i + 1}: {', '.join(found)} は TTS が字面どおりに読む。"
        "読み方で書く (画面は正確な数字・声は丸める。glossary.v1 も使える)"
    ]


def _promise(beats: list[dict[str, Any]]) -> list[str]:
    marked = [i for i, b in enumerate(beats) if b["promise"]]
    if not marked or marked[0] < PROMISE_BY:
        return []
    return [
        f"約束がビート {marked[0] + 1} にある ({PROMISE_BY} ビート目までに着地させる)"
    ]


def check(rows: list[dict[str, Any]], lang: str) -> list[str]:
    beats = [_beat(r) for r in rows if isinstance(r, dict)]
    per_beat = [
        f
        for i, b in enumerate(beats)
        for c in (_overflow, _literal)
        for f in c(i, b, lang)
    ]
    return [*_promise(beats), *per_beat]


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=(__doc__ or "").splitlines()[0])
    parser.add_argument("beats", help="ビートの JSON (- で標準入力)")
    parser.add_argument("--lang", choices=["ja", "en"], default="ja")
    parser.add_argument("--json", action="store_true", help="JSON で出す")
    args = parser.parse_args(argv)
    try:
        raw = (
            sys.stdin.read()
            if args.beats == "-"
            else Path(args.beats).read_text("utf-8")
        )
        rows = json.loads(raw)
    except (OSError, ValueError) as exc:
        print(f"読めなかった: {exc}", file=sys.stderr)
        return 2
    findings = check(rows if isinstance(rows, list) else [], args.lang)
    if args.json:
        print(json.dumps({"findings": findings}, ensure_ascii=False))
    else:
        print("\n".join(findings) or "所見なし")
    return 1 if findings else 0


if __name__ == "__main__":
    sys.exit(main())
