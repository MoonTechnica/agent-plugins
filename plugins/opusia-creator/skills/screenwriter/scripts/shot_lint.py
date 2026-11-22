"""字コンテのカット列から、繋がらないカットの並びを絵コンテの前に見つける.

    python3 <SKILL_DIR>/scripts/shot_lint.py <cuts.json> [--json]
    python3 <SKILL_DIR>/scripts/shot_lint.py -          # 標準入力

## 何のためにあるか

繋がらないカットは**動画にしてから気づくと、そのカットの生成費が丸ごと無駄になる**
(film-grammar §7)。サイズの並び・場所の変わり目・カメラの向きは `shot` の英語の
カメラ用語と `location` から機械で読めるので、絵コンテを作る前にここで見る。

判定の根拠は film-grammar の SKILL.md §1・§3・§7、references/cut-to-cut.md §3・§11、
references/scene-camera.md §3、用語は references/shot-vocabulary.md §1。

## 入れるもの

`list_cuts(scene_id)` の戻り値 (JSON)。**シーンごとの規則** (頭・寄りっぱなし) は
シーン単位で見るので (頭の規則は**場所が変わって始まるシーン**だけ。同じ場所の続きは
見せ直す場所が無い)、複数シーンを測るときは `[{"cuts": [...]}, {"cuts": [...]}]`
(シーンごとの配列) で渡す。カットの配列をそのまま渡すと 1 シーンとして読む。

## やらないこと (画を見る判断)

- イマジナリーライン・視線・画面上の左右 … 立ち位置は `shot` から読めない
  (プリビズで見る)
- 同じ軸で 1 段だけ寄っているか … 軸 (カメラの向き) が文字に無い
- そのサイズが感情の狙いに合っているか

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
from collections.abc import Callable, Iterable, Iterator
from dataclasses import dataclass
from itertools import tee
from pathlib import Path
from typing import Any, TypeVar

_T = TypeVar("_T")


def pairwise(items: Iterable[_T]) -> Iterator[tuple[_T, _T]]:
    """隣り合う 2 つずつ (pairwise は 3.10 から。macOS の python3 は 3.9)."""
    first, second = tee(items)
    next(second, None)
    return zip(first, second)


#: ショットサイズの段 (引き = 小さい数). shot-vocabulary.md §1 の英語表現.
#: 長い語から当てる (close-up ⊂ medium close-up ⊂ extreme close-up)
SIZES: tuple[tuple[str, int], ...] = (
    ("extreme close-up", 7),
    ("extreme closeup", 7),
    ("medium close-up", 5),
    ("medium closeup", 5),
    ("medium full shot", 3),
    ("extreme wide shot", 0),
    ("extreme long shot", 0),
    ("close-up", 6),
    ("closeup", 6),
    ("medium shot", 4),
    ("full shot", 2),
    ("wide shot", 1),
    ("long shot", 1),
    ("establishing shot", 0),
)
SIZE_NAMES = {
    0: "大ロング",
    1: "ロング",
    2: "フル",
    3: "ニー",
    4: "ミディアム",
    5: "バスト",
    6: "アップ",
    7: "大アップ",
}
#: 確立ショットとして読める段 (引き)
ESTABLISHING_MAX = 2
#: アップとして読める段
CLOSE_MIN = 6
#: 絵コンテの日本語の略記 (プロンプトにそのまま書かない。shot-vocabulary.md §3)
STORYBOARD_TERMS = re.compile(r"\bT\.?U\b|\bT\.?B\b|\bFIX\b|\bF\.?I\b|\bF\.?O\b")
JAPANESE = re.compile(r"[぀-ヿ一-鿿]")
PAN = re.compile(r"\b(?:pan|truck|whip pan) (left|right)\b", re.IGNORECASE)
#: 寄りっぱなし / 引きっぱなしを数えるカット数の下限
MIN_CUTS_FOR_BALANCE = 4


@dataclass(frozen=True)
class Cut:
    key: str
    shot: str
    location: str
    size: int | None


def size_of(shot: str) -> int | None:
    lowered = shot.lower()
    return next(
        (
            rank
            for name, rank in SIZES
            if re.search(rf"(?<![\w-]){re.escape(name)}(?![\w-])", lowered)
        ),
        None,
    )


def _cut(row: dict[str, Any], ordinal: int) -> Cut:
    shot = str(row.get("shot") or "").strip()
    return Cut(
        key=str(row.get("key") or f"#{ordinal}"),
        shot=shot,
        location=str(row.get("location") or "").strip(),
        size=size_of(shot),
    )


def _is_scene(item: object) -> bool:
    return isinstance(item, dict) and isinstance(item.get("cuts"), list)


def _scenes(payload: Any) -> list[list[dict[str, Any]]]:  # noqa: ANN401
    """シーンごとのカット列にそろえる. カットの配列は 1 シーン."""
    if isinstance(payload, dict):
        payload = payload.get("cuts", [])
    items = payload if isinstance(payload, list) else []
    groups = (
        [item["cuts"] for item in items]
        if items and all(_is_scene(i) for i in items)
        else [items]
    )
    return [[row for row in group if isinstance(row, dict)] for group in groups]


def load_scenes(source: str) -> list[list[Cut]]:
    raw = sys.stdin.read() if source == "-" else Path(source).read_text("utf-8")
    return [
        [_cut(row, i) for i, row in enumerate(rows, start=1)]
        for rows in _scenes(json.loads(raw))
    ]


# ===== 1 カット =====


def _empty_shot(cut: Cut) -> list[str]:
    return (
        []
        if cut.shot
        else [f"{cut.key}: shot が空。サイズとカメラを英語で書く (生成の本文に載る)"]
    )


def _storyboard_notation(cut: Cut) -> list[str]:
    found = JAPANESE.search(cut.shot) or STORYBOARD_TERMS.search(cut.shot)
    return (
        [
            f"{cut.key}: shot に絵コンテの日本語表記がある ({cut.shot})。"
            "英語のカメラ用語に直す (shot-vocabulary.md)"
        ]
        if found
        else []
    )


# ===== シーン =====


def _continues(before: Cut | None, head: Cut) -> bool:
    """前のシーンと同じ場所の続き (見せ直す新しい場所が無い)."""
    return (
        before is not None and bool(head.location) and before.location == head.location
    )


def _opens_close(before: Cut | None, cuts: list[Cut]) -> list[str]:
    """場所が変わって始まるシーンの頭がアップ. 同じ場所の続きは見ない."""
    head = cuts[0] if cuts else None
    if head is None or head.size is None or head.size < CLOSE_MIN:
        return []
    if _continues(before, head):
        return []
    return [
        f"{head.key}: シーンの頭が{SIZE_NAMES[head.size]}。"
        "引きで場所と位置関係を見せてから寄る"
    ]


def _sized(cuts: list[Cut]) -> list[int]:
    return [c.size for c in cuts if c.size is not None]


def _stays_close(cuts: list[Cut]) -> list[str]:
    sizes = _sized(cuts)
    if len(sizes) < MIN_CUTS_FOR_BALANCE or min(sizes) < CLOSE_MIN:
        return []
    return [
        f"{cuts[0].key}〜{cuts[-1].key}: 寄りっぱなし。どこで何が起きているか分からない"
    ]


def _stays_wide(cuts: list[Cut]) -> list[str]:
    sizes = _sized(cuts)
    if len(sizes) < MIN_CUTS_FOR_BALANCE or max(sizes) > ESTABLISHING_MAX:
        return []
    return [
        f"{cuts[0].key}〜{cuts[-1].key}: 引きっぱなし。誰の話か分からず感情が乗らない"
    ]


# ===== 隣り合う 2 カット =====


def _no_establishing(before: Cut, after: Cut) -> list[str]:
    moved = after.location and before.location and after.location != before.location
    if not moved or after.size is None or after.size <= ESTABLISHING_MAX:
        return []
    return [
        f"{after.key}: 場所が変わった ({before.location} → {after.location}) のに"
        f"{SIZE_NAMES[after.size]}から入っている。確立ショット (引き) を置く"
    ]


def _jumps_in(before: Cut, after: Cut) -> list[str]:
    wide = before.size is not None and before.size <= ESTABLISHING_MAX
    close = after.size is not None and after.size >= CLOSE_MIN
    if not (wide and close and before.location == after.location):
        return []
    return [
        f"{before.key} → {after.key}: 引きからアップへ直接飛ぶ。"
        "間にミディアム (別角度) を挟む (衝撃を狙うときだけ許す)"
    ]


def _reverses_pan(before: Cut, after: Cut) -> list[str]:
    a, b = PAN.search(before.shot), PAN.search(after.shot)
    if not (a and b) or a.group(1).lower() == b.group(1).lower():
        return []
    return [
        f"{before.key} → {after.key}: カメラの向きが反転する"
        f" ({a.group(0)} → {b.group(0)})。動→動は向きと速さを揃える"
    ]


CUT_CHECKS: tuple[Callable[[Cut], list[str]], ...] = (
    _empty_shot,
    _storyboard_notation,
)
SCENE_CHECKS: tuple[Callable[[list[Cut]], list[str]], ...] = (
    _stays_close,
    _stays_wide,
)
PAIR_CHECKS: tuple[Callable[[Cut, Cut], list[str]], ...] = (
    _no_establishing,
    _jumps_in,
    _reverses_pan,
)


def _with_previous(
    scenes: list[list[Cut]],
) -> list[tuple[Cut | None, list[Cut]]]:
    """各シーンと、その直前のシーンの最後のカット (最初のシーンは None)."""
    lasts: list[Cut | None] = [
        None,
        *(scene[-1] if scene else None for scene in scenes),
    ]
    return list(zip(lasts, scenes))


def lint(scenes: list[list[Cut]]) -> list[str]:
    cuts = [cut for scene in scenes for cut in scene]
    return [
        *(f for cut in cuts for check in CUT_CHECKS for f in check(cut)),
        *(f for scene in scenes for check in SCENE_CHECKS for f in check(scene)),
        *(
            f
            for before, scene in _with_previous(scenes)
            for f in _opens_close(before, scene)
        ),
        *(
            f
            for before, after in pairwise(cuts)
            for check in PAIR_CHECKS
            for f in check(before, after)
        ),
    ]


def _print(findings: list[str], scenes: list[list[Cut]], *, as_json: bool) -> None:
    cuts = sum(len(scene) for scene in scenes)
    if as_json:
        report = {"scenes": len(scenes), "cuts": cuts, "findings": findings}
        print(json.dumps(report, ensure_ascii=False))
        return
    print("\n".join(findings) or f"所見なし ({len(scenes)} シーン / {cuts} カット)")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=(__doc__ or "").splitlines()[0])
    parser.add_argument("cuts", help="list_cuts の JSON (- で標準入力)")
    parser.add_argument("--json", action="store_true", help="JSON で出す")
    args = parser.parse_args(argv)
    try:
        scenes = load_scenes(args.cuts)
    except (OSError, ValueError) as exc:
        print(f"読めなかった: {exc}", file=sys.stderr)
        return 2
    findings = lint(scenes)
    _print(findings, scenes, as_json=args.json)
    return 1 if findings else 0


if __name__ == "__main__":
    sys.exit(main())
