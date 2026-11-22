# ruff: noqa: C901, PLR0913, FBT001, FBT003, PLW2901
# (パターンごとの配置と引数が多い CLI。camera_math.py と同じ型)
"""歌詞の行と時刻から、リリックモーションの文字レイヤー (2D) を面付けする.

標準ライブラリだけで動く。乱数は使わない (同じ引数なら同じ出力)。

    python3 <SKILL_DIR>/scripts/lyric_layers.py --lines lines.json \
        --pattern surround --avoid 560,120,1360,1080 --scene-start 9 --ops

## 入力

`--lines` は JSON の配列。各行は曲の地図の `lyric_lines[]` と同じ形で、`text` に
**語の区切り**を書く。`|` が語の区切り、語頭の `!` が主役 (特大)、`,` が助詞
(小さく添える)、無印は普通。

    {"start_sec": 10.0, "end_sec": 13.0, "text": "!俺|,の|!私|,の|折の中で|!だけの"}

語ごとの時刻は、行に `words` (`text` / `weight` / `start_sec` /
`end_sec`) を書けばそれを使い、持たない語は**行の中で文字数に比例して配る**。
これは推定で、聴き取りではない。

## 面付けのパターン (`--pattern`)

  surround  語を画面の四隅へ交互に置き、`--avoid` の箱 (キャラの顔・体) を空ける
  column    縦組みの列を右端から並べる (高さをずらし、`--bleed` で下端から見切れさせる)
  stack     中央に縦積みする (語のブロック組み)

## 見た目 (`--style`)

  tone   明朝・濃い灰・主役は細く (地色に近い単色。落ち着いた歌)
  bold   極太ゴシック・白 (叫び・サビ)
  pair   極太の塗りと中抜きの縁を交互に (縦組みの重ね)

出力 (JSON): `layers` (`patch_previz_scene` の `/layers/-` へ入れる文字レイヤー)、
`boxes` (レイヤーごとの占める矩形 [左, 上, 右, 下] px)、`warnings`、`notes`。
`--ops` で操作列も付ける。
詳しい使い方・構図の根拠は references/lyric-composition.md。
"""

from __future__ import annotations

import argparse
import json
import math
import re
import sys
import unicodedata
from pathlib import Path
from typing import Any, NoReturn

WIDE_ADVANCE = 1.0
NARROW_ADVANCE = 0.56
LINE_HEIGHT = 1.25
# 重み (語頭の印): 主役 / 普通 / 助詞
HERO, NORMAL, PARTICLE = 3, 2, 1
MARK_WEIGHT = {"!": HERO, ",": PARTICLE}
# 字の大きさ (フレーム高さに対する比)。主役は助詞の 3 倍前後 (ジャンプ率)
SIZE_RATIO = {HERO: 0.34, NORMAL: 0.17, PARTICLE: 0.085}
# 横組みの語の幅の上限 (フレーム幅に対する比)。超えたら字を縮める
MAX_WORD_WIDTH = 0.4
MARGIN_RATIO = 0.04
# 出は行 (語) の頭の 2 コマ前 / 消えは行の end の 0.3 秒後 (SKILL.md「MV の歌詞」)
LEAD_FRAMES = 2
OUT_AFTER = 0.3
SHRINK = 0.9
SHRINK_LIMIT = 3
# 入り方。主役は叩きつけ、普通は弾む、助詞はそっと
PRESETS = {HERO: ("slam", 0.22), NORMAL: ("pop", 0.3), PARTICLE: ("fade", 0.25)}
ID_SAFE = re.compile(r"[^A-Za-z0-9_-]")


def fail(message: str) -> NoReturn:
    raise SystemExit(message)


def jitter(n: float) -> float:
    """決定論のハッシュ (0〜1)."""
    s = math.sin(n * 127.1 + 311.7) * 43758.5453
    return s - math.floor(s)


# ---------------------------------------------------------------- 語


def advance(char: str, vertical: bool) -> float:
    if char.isspace():
        return 0.3
    if vertical:
        return 1.0 if unicodedata.east_asian_width(char) in ("W", "F") else 0.6
    return (
        WIDE_ADVANCE
        if unicodedata.east_asian_width(char) in ("W", "F")
        else NARROW_ADVANCE
    )


def parse_words(text: str) -> list[dict[str, Any]]:
    """`|` で区切り、語頭の `!` / `,` を重みにする."""
    words = []
    for raw in text.split("|"):
        raw = raw.strip()
        if not raw:
            continue
        weight = NORMAL
        if raw[0] in MARK_WEIGHT:
            weight = MARK_WEIGHT[raw[0]]
            raw = raw[1:].strip()
        if raw:
            words.append({"text": raw, "weight": weight})
    return words


def given_words(line: dict[str, Any]) -> list[dict[str, Any]]:
    """行に `words` (text / weight / start_sec / end_sec) があれば、それを使う."""
    found = []
    for item in line.get("words") or []:
        text = str(item.get("text", "")).strip()
        if text:
            found.append(
                {**item, "text": text, "weight": int(item.get("weight", NORMAL))}
            )
    return found


def assign_times(words: list[dict[str, Any]], start: float, end: float) -> None:
    """語の時刻を、行の中で文字数に比例して配る (語が自分の時刻を持てばそれを使う)."""
    total = sum(len(w["text"]) for w in words) or 1
    cursor = start
    for word in words:
        span = (end - start) * len(word["text"]) / total
        word.setdefault("start_sec", cursor)
        word.setdefault("end_sec", word["start_sec"] + span)
        cursor += span


# ---------------------------------------------------------------- 寸法


def word_size(word: dict[str, Any], args: argparse.Namespace, vertical: bool) -> float:
    base = SIZE_RATIO[word["weight"]] * args.height
    length = sum(advance(c, vertical) for c in word["text"])
    if vertical:
        return float(min(base, 1.1 * args.height / (length * LINE_HEIGHT * 0.8)))
    return float(min(base, MAX_WORD_WIDTH * args.width / max(length, 0.5)))


def extent(text: str, size: float, vertical: bool) -> tuple[float, float]:
    """語が占める (幅, 高さ) px。縦組みは字が縦に並ぶ."""
    length = sum(advance(c, vertical) for c in text) * size
    if vertical:
        return size * LINE_HEIGHT, length
    return length, size * LINE_HEIGHT


def box_of(
    x: float, y: float, w: float, h: float, align: str, vertical: bool
) -> list[float]:
    """(x, y, 揃え) から矩形 [左, 上, 右, 下]。y は縦の中央、縦組みの x は中央."""
    if vertical or align == "center":
        left = x - w / 2
    elif align == "left":
        left = x
    else:
        left = x - w
    return [
        round(left, 1),
        round(y - h / 2, 1),
        round(left + w, 1),
        round(y + h / 2, 1),
    ]


def overlaps(a: list[float], b: list[float]) -> bool:
    return min(a[2], b[2]) > max(a[0], b[0]) and min(a[3], b[3]) > max(a[1], b[1])


# ---------------------------------------------------------------- 配置


def place_surround(words: list[dict[str, Any]], args: argparse.Namespace) -> None:
    margin = MARGIN_RATIO * args.width
    chains: list[list[dict[str, Any]]] = []
    for word in words:
        if word["weight"] == PARTICLE and chains:
            chains[-1].append(word)
        else:
            chains.append([word])
    top_count = math.ceil(len(chains) / 2)
    for index, chain in enumerate(chains):
        left_side = index % 2 == 0
        top_row = index < top_count
        hero = chain[0]
        hero["size"] = word_size(hero, args, vertical=False)
        w, h = extent(hero["text"], hero["size"], False)
        hero["align"] = "left" if left_side else "right"
        hero["x"] = margin if left_side else args.width - margin
        if top_row:
            hero["y"] = margin + h / 2 + (0 if left_side else 0.07 * args.height)
        else:
            hero["y"] = (
                args.height - margin - h / 2 - (0.05 * args.height if left_side else 0)
            )
        previous = (hero, w, h)
        for word in chain[1:]:
            word["size"] = word_size(word, args, vertical=False)
            pw, ph = extent(word["text"], word["size"], False)
            word["align"] = hero["align"]
            hero_box = box_of(
                hero["x"], hero["y"], previous[1], previous[2], hero["align"], False
            )
            if top_row:
                # 主役の下に、少し内側へ寄せて添える
                inset = 0.4 * previous[1]
                word["x"] = hero["x"] + inset if left_side else hero["x"] - inset
                word["y"] = hero_box[3] - 0.12 * previous[2] + ph / 2
            else:
                gap = 0.15 * word["size"]
                word["x"] = hero_box[2] + gap if left_side else hero_box[0] - gap
                word["y"] = hero["y"] + (h - ph) / 2 - 0.1 * h
            previous = (word, pw, ph)


def place_column(words: list[dict[str, Any]], args: argparse.Namespace) -> None:
    margin = MARGIN_RATIO * args.width
    # pair: 極太の塗りは左の端から、中抜きは右の端から並べる (左右に分けて画面を挟む)
    cursors = {"left": margin, "right": args.width - margin}
    for index, word in enumerate(words):
        word["size"] = min(
            SIZE_RATIO[word["weight"]] * args.height * 0.8,
            1.1
            * args.height
            / (sum(advance(c, True) for c in word["text"]) * LINE_HEIGHT * 0.8),
        )
        w, h = extent(word["text"], word["size"], True)
        word["vertical"] = True
        word["align"] = "center"
        side = (
            ("left" if index % 2 == 0 else "right") if args.style == "pair" else "right"
        )
        if side == "left":
            word["x"] = cursors["left"] + w / 2
            cursors["left"] += w * 1.15
        else:
            word["x"] = cursors["right"] - w / 2
            cursors["right"] -= w * 1.15
        if word["weight"] == HERO and args.bleed > 0:
            # 主役は下端から見切れさせる: 箱の下辺をフレームの外へ (bleed は高さの比)
            word["y"] = args.height * (1 + args.bleed) - h / 2
        else:
            word["y"] = margin + (0.12 * args.height if index % 2 else 0) + h / 2


def place_stack(words: list[dict[str, Any]], args: argparse.Namespace) -> None:
    sizes = [word_size(w, args, vertical=False) for w in words]
    heights = [extent(w["text"], s, False)[1] for w, s in zip(words, sizes)]
    cursor = (args.height - sum(heights)) / 2
    for word, size, h in zip(words, sizes, heights):
        word["size"] = size
        word["align"] = "center"
        word["x"] = args.width / 2
        word["y"] = cursor + h / 2
        cursor += h


PATTERNS = {
    "surround": place_surround,
    "column": place_column,
    "stack": place_stack,
}


# ---------------------------------------------------------------- 避ける・収める


def fit_beside(
    word: dict[str, Any], avoid: list[float], args: argparse.Namespace
) -> bool:
    """箱の横の空きに収まる大きさへ縮める (横組みだけ). 収まれば True."""
    if word.get("vertical"):
        return False
    margin = MARGIN_RATIO * args.width
    gap = 0.02 * args.width
    left_of_box = word["x"] < (avoid[0] + avoid[2]) / 2
    room = (
        (avoid[0] - margin - gap)
        if left_of_box
        else (args.width - margin - avoid[2] - gap)
    )
    length = sum(advance(c, False) for c in word["text"])
    floor = SIZE_RATIO[PARTICLE] * args.height * 0.7
    if room <= 0 or room / length < floor:
        return False
    word["size"] = round(min(word["size"], room / length), 1)
    return True


def resolve_avoid(
    words: list[dict[str, Any]], avoid: list[float] | None, args: argparse.Namespace
) -> list[str]:
    """顔・体の箱に重なる語は、箱の横の空きへ字を縮めて収める。それでも重なれば所見に残す."""
    warnings: list[str] = []
    if not avoid:
        return warnings
    for word in words:
        vertical = bool(word.get("vertical"))

        def hit(word: dict[str, Any] = word, vertical: bool = vertical) -> bool:
            w, h = extent(word["text"], word["size"], vertical)
            return overlaps(
                box_of(word["x"], word["y"], w, h, word["align"], vertical), avoid
            )

        if hit():
            fit_beside(word, avoid, args)
        shrunk = 0
        while hit() and shrunk < SHRINK_LIMIT:
            word["size"] = round(word["size"] * SHRINK, 1)
            shrunk += 1
        if hit():
            warnings.append(
                f"「{word['text']}」が避ける箱に重なっている (位置を手で直す)"
            )
    return warnings


# ---------------------------------------------------------------- 見た目

STYLES = {
    "tone": {"font": "serif", "color": "#555555"},
    "bold": {"font": "sans", "color": "#ffffff"},
    "pair": {"font": "sans", "color": "#ffffff"},
}


def look(word: dict[str, Any], index: int, args: argparse.Namespace) -> dict[str, Any]:
    spec: dict[str, Any] = {
        "font": STYLES[args.style]["font"],
        "color": args.color or STYLES[args.style]["color"],
    }
    if args.style == "tone":
        spec["weight"] = 400 if word["weight"] == HERO else 700
    elif args.style == "bold" or index % 2 == 0:
        spec["weight"] = 900
    else:
        spec["weight"] = 700
        spec["stroke"] = {"width": 2, "color": spec["color"], "hollow": True}
    return spec


# ---------------------------------------------------------------- レイヤー


def make_layers(
    lines: list[dict[str, Any]], args: argparse.Namespace
) -> dict[str, Any]:
    layers: list[dict[str, Any]] = []
    boxes: dict[str, list[float]] = {}
    warnings: list[str] = []
    lead = LEAD_FRAMES / args.fps
    avoid = [float(v) for v in args.avoid.split(",")] if args.avoid else None
    for li, line in enumerate(lines):
        words = given_words(line) or parse_words(str(line["text"]))
        if not words:
            continue
        assign_times(words, float(line["start_sec"]), float(line["end_sec"]))
        PATTERNS[args.pattern](words, args)
        warnings += resolve_avoid(words, avoid, args)
        end = float(line["end_sec"]) + OUT_AFTER - args.scene_start
        for wi, word in enumerate(words):
            start = max(0.0, word["start_sec"] - lead - args.scene_start)
            preset, each = PRESETS[word["weight"]]
            text: dict[str, Any] = {
                "content": word["text"],
                "preset": preset,
                "unit": "char" if word["weight"] != HERO else "line",
                "stagger": 0.04,
                "each": each,
                "size": round(word["size"], 1),
                "align": word["align"],
                "x": round(word["x"], 1),
                "y": round(word["y"], 1),
                **look(word, wi, args),
            }
            if word.get("vertical"):
                text["vertical"] = True
            if args.karaoke:
                span = (word["end_sec"] - word["start_sec"]) / len(word["text"])
                text["unit"] = "char"
                text["karaoke"] = {
                    "color": args.karaoke,
                    "each": round(max(span, 0.05), 3),
                    "at": [
                        round(
                            word["start_sec"] - args.scene_start - start + span * i, 3
                        )
                        for i in range(len(word["text"]))
                    ],
                }
            ident = f"lyric-{li}-{wi}"
            layers.append(
                {
                    "id": ident,
                    "name": ID_SAFE.sub("", ident) and word["text"],
                    "place": args.place,
                    "start": round(start, 3),
                    "duration": round(max(end - start, 0.1), 3),
                    "text": text,
                }
            )
            vertical = bool(word.get("vertical"))
            w, h = extent(word["text"], word["size"], vertical)
            boxes[ident] = box_of(word["x"], word["y"], w, h, word["align"], vertical)
    return {"layers": layers, "boxes": boxes, "warnings": warnings}


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument("--lines", required=True, help="歌詞の行の JSON (配列)")
    parser.add_argument("--pattern", choices=tuple(PATTERNS), default="surround")
    parser.add_argument("--style", choices=tuple(STYLES), default="tone")
    parser.add_argument("--color", help="文字色 (省略はスタイルの既定)")
    parser.add_argument("--avoid", help="避ける箱 x0,y0,x1,y1 (px。キャラの顔・体)")
    parser.add_argument(
        "--bleed",
        type=float,
        default=0.0,
        help="column: 主役を下端から見切れさせる量 (高さ比)",
    )
    parser.add_argument(
        "--scene-start", type=float, default=0.0, help="シーンが曲のこの秒から始まる"
    )
    parser.add_argument("--fps", type=float, default=30.0)
    parser.add_argument("--frame", default="1920x1080")
    parser.add_argument(
        "--place",
        choices=("back", "front"),
        default="back",
        help="back = 3D のキャラの後ろ",
    )
    parser.add_argument(
        "--karaoke", help="歌に合わせて変わる色 (字ごとに歌詞の時刻で塗る)"
    )
    parser.add_argument("--seed", type=int, default=1)
    parser.add_argument(
        "--ops", action="store_true", help="patch_previz_scene の操作を付ける"
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    match = re.fullmatch(r"(\d+)x(\d+)", args.frame)
    if not match:
        fail("--frame は 1920x1080 の形")
    args.width, args.height = int(match.group(1)), int(match.group(2))
    try:
        lines = json.loads(Path(args.lines).read_text(encoding="utf-8"))
    except (OSError, ValueError) as error:
        fail(f"--lines を読めない: {error}")
    if not isinstance(lines, list) or not lines:
        fail("--lines は行の配列 (1 行以上)")
    result = make_layers(lines, args)
    result["notes"] = [
        "語の時刻は、行の中で文字数に比例して配った推定 (聴き取りではない)。"
        "語ごとの時刻があれば行の words に start_sec を書く",
        "文字はキャラの後ろ (place: back)。キャラが 2D の層なら place を合わせる",
    ]
    if args.ops:
        result["ops"] = [
            {"op": "add", "path": "/layers/-", "value": layer}
            for layer in result["layers"]
        ]
    json.dump(result, sys.stdout, ensure_ascii=False)
    sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
