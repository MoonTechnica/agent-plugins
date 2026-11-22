# ruff: noqa: C901, PLR2004, FBT001, PLW2901
# (配置アルゴリズムごとの分岐と引数が多い CLI。camera_math.py と同じ型)
"""語・字をセンスよく散らす / 幾何学的に並べる (compositor スキル).

標準ライブラリだけで動く.

乱数は自前の LCG (seed 付き。語ごとに独立ストリーム)。同じ引数なら同じ出力。
規則の出どころは docs/_research/2026-11-17-lyric-motion-technique-catalog.md §9。

    python3 <SKILL_DIR>/scripts/glyph_layout.py scatter \
        --words "!夜空|を|駆ける|,の" --seed 3 --ops

## 配置 (最初の引数)

  scatter     ジッタ付きの格子 (既定の散らし。整って見える)
  noise       ブルーノイズ (Bridson。有機的に散る)
  pack        ワードクラウド詰め (螺旋サーチ。ぎっしり)
  grid        モジュラーグリッド (整然。空きマスを残す)
  burst       放射 (中心の主役から外へ。字は外向き)
  rings       同心リング (内ほど小さく、輪ごとに向きが交互)
  cascade     斜めカスケード (1 つの傾き。段ごとに小さく薄く)
  silhouette  形に沿って並べる (`--shape heart|star|circle`)

## 入力

`--words "!主役|普通|,助詞"` (`|` が語の区切り、`!` が主役、`,` が助詞) か、
`--text "…" --unit char` (1 字ずつ。`--size` で字高)。

## センスの規則 (§9.3。守れなければ `check.issues` に出す)

大きさは 3 段まで・主役は 1 つ。回転は {0 60%, ±90 20%, ±8 20%} の集合から
(主役と小さい語は 0)。語どうしは重ならず、近接 (0 < すき間 < 12px) も作らない。
外周に余白を取り、主役は三分割の交点へ。
置けない語は黙って捨てず `failed` に出す。収まらなければ字を 0.92 倍にして再試行する。

## 動き (`--assemble`)

最終位置を正本にして、開始位置をそこから逆算する (散 → 集)。`outward` 外から戻る /
`inplace` その場で回って縮む / `flow` 左から流れ込む / `random` seed の位置から。
主役は 0.2〜0.4 秒止まってから動く。

出力 (JSON): `layers` (`patch_previz_scene` の `/layers/-` へ。語ごとに 1 レイヤーで、
回転・移動はレイヤーのモーションのキー)、`items` (x / y / 回転 / 箱)、`check`、
`failed`、`hero`、`notes`。
"""

from __future__ import annotations

import argparse
import json
import math
import re
import sys
import unicodedata
from typing import Any, NoReturn

WIDE = 1.0
NARROW = 0.56
BOX_H = 1.15
HERO, NORMAL, PARTICLE = 3, 2, 1
MARKS = {"!": HERO, ",": PARTICLE}
# 大きさの段 (主役 : 準主役 : 脇)。落ち着いた曲 / ジャンプ率の高い曲
TIERS = {"calm": (1.0, 0.67, 0.44), "bold": (1.0, 0.38, 0.15)}
MIN_SIZE = 36
MAX_WORD_W = 0.45
MIN_PAD = 16
NEAR_MISS = 12
ROT_SMALL = 60
SHRINK = 0.92
RETRIES = 8
ID_PATTERN = re.compile(r"^[A-Za-z0-9_-]{1,40}$")


def fail(message: str) -> NoReturn:
    raise SystemExit(message)


# 乱数 (LCG。語ごとに独立したストリーム)


class Rng:
    def __init__(self, seed: int) -> None:
        self.state = (seed * 2654435761 + 12345) & 0xFFFFFFFF

    def next(self) -> float:
        self.state = (1664525 * self.state + 1013904223) & 0xFFFFFFFF
        return self.state / 4294967296

    def pick(self, n: int) -> int:
        return min(int(self.next() * n), n - 1)


def stream(seed: int, index: int) -> Rng:
    return Rng(seed * 1000003 + index * 7919 + 17)


# 箱と衝突 (回転した矩形を SAT で判定)


def advance(char: str) -> float:
    if char.isspace():
        return 0.3
    return WIDE if unicodedata.east_asian_width(char) in ("W", "F") else NARROW


def measure(text: str, size: float) -> tuple[float, float]:
    return sum(advance(c) for c in text) * size, size * BOX_H


def corners(item: dict[str, Any]) -> list[tuple[float, float]]:
    rad = math.radians(item["rotation"])
    c, s = math.cos(rad), math.sin(rad)
    hw, hh = item["w"] / 2, item["h"] / 2
    return [
        (item["x"] + dx * c - dy * s, item["y"] + dx * s + dy * c)
        for dx, dy in ((-hw, -hh), (hw, -hh), (hw, hh), (-hw, hh))
    ]


def separation(a: dict[str, Any], b: dict[str, Any]) -> float:
    """分離距離の下限 (SAT。負なら重なっている)."""
    pa_all, pb_all = corners(a), corners(b)
    best: float = -1e9
    for pts in (pa_all, pb_all):
        for i in range(2):
            ex, ey = pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]
            norm = math.hypot(ex, ey) or 1.0
            ax, ay = -ey / norm, ex / norm
            pa = [x * ax + y * ay for x, y in pa_all]
            pb = [x * ax + y * ay for x, y in pb_all]
            best = max(best, min(pa) - max(pb), min(pb) - max(pa))
    return float(best)


def pad_of(a: dict[str, Any], b: dict[str, Any]) -> float:
    return float(max(MIN_PAD, 0.25 * min(a["size"], b["size"])))


def aabb(item: dict[str, Any]) -> tuple[float, float, float, float]:
    pts = corners(item)
    xs, ys = [p[0] for p in pts], [p[1] for p in pts]
    return min(xs), min(ys), max(xs), max(ys)


class Frame:
    def __init__(self, width: int, height: int) -> None:
        self.w, self.h = width, height
        self.mx, self.my = 0.0625 * width, 0.074 * height

    def thirds(self) -> list[tuple[float, float]]:
        return [(self.w * i / 3, self.h * j / 3) for i in (1, 2) for j in (1, 2)]

    def inside(self, item: dict[str, Any]) -> bool:
        x0, y0, x1, y1 = aabb(item)
        return (
            x0 >= self.mx
            and y0 >= self.my
            and x1 <= self.w - self.mx
            and y1 <= self.h - self.my
        )


def clear_of(item: dict[str, Any], others: list[dict[str, Any]]) -> bool:
    return all(separation(item, o) >= pad_of(item, o) for o in others)


# ---------------------------------------------------------------- 語


def parse(args: argparse.Namespace) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    if args.words:
        for raw in args.words.split("|"):
            raw = raw.strip()
            if not raw:
                continue
            weight = NORMAL
            if raw[0] in MARKS:
                weight, raw = MARKS[raw[0]], raw[1:].strip()
            if raw:
                items.append({"text": raw, "weight": weight})
    elif args.text:
        items = [{"text": c, "weight": NORMAL} for c in args.text if not c.isspace()]
    if not items:
        fail("--words か --text に 1 つ以上の語が要る")
    return items


def assign_sizes(
    items: list[dict[str, Any]], args: argparse.Namespace, frame: Frame, k: float
) -> None:
    """3 段の大きさ (段ごとに同じ字高)。主役は 1 つ (最初の `!`、無ければ最初の語).

    `k` は再試行の縮小率。主役は 3 回目の再試行から縮める (最初は主役を守る).
    """
    uniform = bool(args.text) and not args.words
    hero = next((i for i, it in enumerate(items) if it["weight"] == HERO), 0)
    ratios = TIERS[args.tone]
    base = args.size if uniform else (args.hero_size or round(0.2 * frame.h))
    tiers: dict[int, list[dict[str, Any]]] = {0: [], 1: [], 2: []}
    for i, item in enumerate(items):
        if uniform or i == hero:
            tier = 0
        elif item["weight"] == PARTICLE:
            tier = 2
        else:
            tier = 1
        item["rank"] = tier
        tiers[tier].append(item)
    for tier, members in tiers.items():
        if not members:
            continue
        shrink = 1.0 if (tier == 0 and k > 0.8 and not uniform) else k
        widest = max(sum(advance(c) for c in m["text"]) for m in members)
        size = min(
            base * ratios[tier] * shrink, MAX_WORD_W * frame.w / max(widest, 0.5)
        )
        for member in members:
            member["size"] = round(max(size, MIN_SIZE), 1)
            member["w"], member["h"] = measure(member["text"], member["size"])
            member["rotation"] = 0
    items[hero]["hero"] = True


def pick_rotation(item: dict[str, Any], seed: int, index: int, mode: str) -> float:
    """回転は少数の集合から。主役と小さい語は回さない."""
    if mode == "none" or item.get("hero") or item["size"] < ROT_SMALL:
        return 0
    if mode.startswith("dominant:"):
        return float(mode.split(":")[1]) + (stream(seed, index).next() - 0.5) * 4
    rng = stream(seed, index)
    roll = rng.next()
    sign = 1 if rng.next() < 0.5 else -1
    if roll < 0.6:
        return 0
    return 90 * sign if roll < 0.8 else 8 * sign


def refresh(item: dict[str, Any]) -> None:
    item["w"], item["h"] = measure(item["text"], item["size"])


# ---------------------------------------------------------------- 配置


def third_point(frame: Frame, seed: int) -> tuple[float, float]:
    points = frame.thirds()
    return points[stream(seed, 99).pick(len(points))]


def place_scatter(
    items: list[dict[str, Any]], args: argparse.Namespace, frame: Frame
) -> None:
    n = len(items)
    total = math.ceil(n / 0.7)
    aw, ah = frame.w - 2 * frame.mx, frame.h - 2 * frame.my
    cols = max(2, math.ceil(math.sqrt(total * aw / ah)))
    rows = max(2, math.ceil(total / cols))
    cw, ch = aw / cols, ah / rows
    centres = [
        (frame.mx + (c + 0.5) * cw, frame.my + (r + 0.5) * ch)
        for r in range(rows)
        for c in range(cols)
    ]
    hero = next(i for i, it in enumerate(items) if it.get("hero"))
    target = third_point(frame, args.seed)
    hero_cell = min(range(len(centres)), key=lambda k: math.dist(centres[k], target))
    pool = [k for k in range(len(centres)) if k != hero_cell]
    order = sorted(pool, key=lambda k: stream(args.seed, 500 + k).next())[: n - 1]
    cells = sorted(order)  # 読み順 (行 → 列) に並べ直す
    mapping = {hero: hero_cell}
    rest = [i for i in range(n) if i != hero]
    mapping.update(zip(rest, cells))
    axes = [frame.mx + aw * f for f in (1 / 6, 0.5, 5 / 6)]
    for i, item in enumerate(items):
        cx, cy = centres[mapping[i]]
        rng = stream(args.seed, i)
        jx, jy = (rng.next() - 0.5) * 0.6 * cw, (rng.next() - 0.5) * 0.6 * ch
        item["x"], item["y"] = cx + jx, cy + jy
        # 3 割ほどの語は最寄りの縦の軸へ寄せる (意図が出る)
        if rng.next() < 0.4 and not item.get("hero"):
            axis = min(axes, key=lambda a: abs(a - item["x"]))
            if abs(axis - item["x"]) < cw * 0.45:
                item["x"] = axis
        item["rotation"] = pick_rotation(item, args.seed, i, args.rot)


def bridson(
    frame: Frame, radius: float, seed: int, limit: int
) -> list[tuple[float, float]]:
    rng = Rng(seed * 31 + 7)
    x0, y0, x1, y1 = frame.mx, frame.my, frame.w - frame.mx, frame.h - frame.my
    cell = radius / math.sqrt(2)
    gw, gh = math.ceil((x1 - x0) / cell), math.ceil((y1 - y0) / cell)
    grid: dict[tuple[int, int], tuple[float, float]] = {}
    first = (x0 + rng.next() * (x1 - x0), y0 + rng.next() * (y1 - y0))
    points, active = [first], [first]
    grid[(int((first[0] - x0) / cell), int((first[1] - y0) / cell))] = first
    while active and len(points) < limit:
        index = rng.pick(len(active))
        px, py = active[index]
        found = False
        for _ in range(30):
            ang, dist = rng.next() * math.tau, radius * (1 + rng.next())
            cx, cy = px + dist * math.cos(ang), py + dist * math.sin(ang)
            if not (x0 <= cx <= x1 and y0 <= cy <= y1):
                continue
            gx, gy = int((cx - x0) / cell), int((cy - y0) / cell)
            near = any(
                math.dist((cx, cy), grid[(a, b)]) < radius
                for a in range(max(gx - 2, 0), min(gx + 3, gw))
                for b in range(max(gy - 2, 0), min(gy + 3, gh))
                if (a, b) in grid
            )
            if not near:
                points.append((cx, cy))
                active.append((cx, cy))
                grid[(gx, gy)] = (cx, cy)
                found = True
                break
        if not found:
            active.pop(index)
    return points


def place_noise(
    items: list[dict[str, Any]], args: argparse.Namespace, frame: Frame
) -> None:
    n = len(items)
    area = (frame.w - 2 * frame.mx) * (frame.h - 2 * frame.my)
    radius = 0.9 * math.sqrt(area / n)
    points: list[tuple[float, float]] = []
    for _ in range(12):
        points = bridson(frame, radius, args.seed, n)
        if len(points) >= n:
            break
        radius *= 0.95
    points = points[:n]
    hero = next(i for i, it in enumerate(items) if it.get("hero"))
    target = third_point(frame, args.seed)
    near = min(range(len(points)), key=lambda k: math.dist(points[k], target))
    rest_points = sorted(
        (p for k, p in enumerate(points) if k != near),
        key=lambda p: (round(p[1] / (frame.h / 3)), p[0]),
    )
    rest = [i for i in range(len(items)) if i != hero]
    items[hero]["x"], items[hero]["y"] = points[near]
    for i, point in zip(rest, rest_points):
        items[i]["x"], items[i]["y"] = point
    for i, item in enumerate(items):
        item["rotation"] = pick_rotation(item, args.seed, i, args.rot)


def place_pack(
    items: list[dict[str, Any]], args: argparse.Namespace, frame: Frame
) -> None:
    order = sorted(range(len(items)), key=lambda i: -items[i]["size"])
    cx, cy = (
        third_point(frame, args.seed)
        if args.pack_centre == "third"
        else (frame.w / 2, frame.h / 2)
    )
    placed: list[dict[str, Any]] = []
    for i in order:
        item = items[i]
        item["rotation"] = (
            0
            if item.get("hero")
            else (
                90
                if stream(args.seed, i).next() < 0.25 and item["size"] >= ROT_SMALL
                else 0
            )
        )
        step = 0
        while step < 6000:
            t = step * 0.12
            r = 4.0 * t
            item["x"], item["y"] = cx + 1.3 * r * math.cos(t), cy + r * math.sin(t)
            if frame.inside(item) and clear_of(item, placed):
                break
            step += 1
        else:
            item["x"] = None
            continue
        placed.append(item)


def place_grid(
    items: list[dict[str, Any]], args: argparse.Namespace, frame: Frame
) -> None:
    cols, rows = 12, 6
    gutter = 24
    cw = (frame.w - 2 * frame.mx - gutter * (cols - 1)) / cols
    ch = (frame.h - 2 * frame.my - gutter * (rows - 1)) / rows
    free = [[True] * cols for _ in range(rows)]
    target = third_point(frame, args.seed)
    order = sorted(range(len(items)), key=lambda i: (not items[i].get("hero"), i))

    def span(item: dict[str, Any]) -> tuple[int, int]:
        return (
            max(1, math.ceil((item["w"] + gutter) / (cw + gutter))),
            max(1, math.ceil((item["h"] + gutter) / (ch + gutter))),
        )

    def fits(r: int, c: int, sr: int, sc: int) -> bool:
        return all(free[r + a][c + b] for a in range(sr) for b in range(sc))

    def take(item: dict[str, Any], r: int, c: int, sr: int, sc: int) -> None:
        for a in range(sr):
            for b in range(sc):
                free[r + a][c + b] = False
        # 左上基準で揃える。中心揃えより締まる
        item["x"] = frame.mx + c * (cw + gutter) + item["w"] / 2
        item["y"] = frame.my + r * (ch + gutter) + item["h"] / 2

    for i in order:
        item = items[i]
        item["rotation"] = 0
        sc, sr = span(item)
        if sc > cols or sr > rows:
            item["x"] = None
            continue
        candidates = [
            (r, c)
            for r in range(rows - sr + 1)
            for c in range(cols - sc + 1)
            if fits(r, c, sr, sc)
        ]
        if not candidates:
            item["x"] = None
            continue
        if item.get("hero"):
            r, c = min(
                candidates,
                key=lambda rc: math.dist(
                    (
                        frame.mx + rc[1] * (cw + gutter),
                        frame.my + rc[0] * (ch + gutter),
                    ),
                    target,
                ),
            )
            take(item, r, c, sr, sc)
            # 主役を置いたあとで空きマスを決める (3 割。主役のマスは対象外)
            for k in range(cols * rows):
                if (
                    free[k // cols][k % cols]
                    and stream(args.seed, 800 + k).next() < 0.3
                ):
                    free[k // cols][k % cols] = False
            continue
        # 読み順に行を割り当てて、画面の上から下まで散らす (左上に固まらない)
        preferred = min(rows - 1, (order.index(i) - 1) * rows // max(len(items) - 1, 1))
        r, c = min(candidates, key=lambda rc: (abs(rc[0] - preferred), rc[1]))
        take(item, r, c, sr, sc)


def fold(deg: float) -> float:
    """向きを [-90, 90] へ折り返す (逆さまにしない)."""
    deg = (deg + 180) % 360 - 180
    if deg > 90:
        deg -= 180
    elif deg < -90:
        deg += 180
    return deg


def place_burst(
    items: list[dict[str, Any]], _args: argparse.Namespace, frame: Frame
) -> None:
    hero = next(i for i, it in enumerate(items) if it.get("hero"))
    cx, cy = frame.w / 2, frame.h / 2
    others = [i for i in range(len(items)) if i != hero]
    items[hero]["x"], items[hero]["y"], items[hero]["rotation"] = cx, cy, 0
    rx = frame.w / 2 - frame.mx - max(items[i]["w"] for i in others) / 2
    ry = frame.h / 2 - frame.my - max(items[i]["h"] for i in others) / 2
    for k, i in enumerate(others):
        theta = -90 + k * 360 / len(others)
        rad = math.radians(theta)
        items[i]["x"] = cx + rx * math.cos(rad)
        items[i]["y"] = cy + ry * math.sin(rad)
        items[i]["rotation"] = (
            round(fold(theta + 90), 2) if abs(math.cos(rad)) < 0.5 else 0
        )


def place_rings(
    items: list[dict[str, Any]], _args: argparse.Namespace, frame: Frame
) -> None:
    hero = next(i for i, it in enumerate(items) if it.get("hero"))
    cx, cy = frame.w / 2, frame.h / 2
    groups: list[list[int]] = [[], [], []]
    order = sorted(range(len(items)), key=lambda i: items[i]["size"])
    for k, i in enumerate(order):
        groups[min(2, k * 3 // len(order))].append(i)
    # 主役は中の輪へ (中心に置かない。内の輪は小さい語)
    for g in groups:
        if hero in g:
            g.remove(hero)
    groups[1].append(hero)
    stretch = 1.45
    floor = 0.0
    for ring, members in enumerate(groups):
        if not members:
            continue
        # 輪の長さが、語の幅の合計 + すき間に足りるように半径を決める
        need = sum(items[i]["w"] + pad_of(items[i], items[i]) for i in members) * 1.25
        base = (0.2, 0.32, 0.46)[ring] * frame.h
        radius = max(base, need / math.tau / stretch, floor)
        tallest = max(items[i]["h"] for i in members)
        floor = radius + tallest + MIN_PAD
        direction = 1 if ring % 2 == 0 else -1
        offset = -60 + ring * 25
        for k, i in enumerate(members):
            theta = offset + direction * k * 360 / len(members)
            rad = math.radians(theta)
            items[i]["x"] = cx + radius * stretch * math.sin(rad)
            items[i]["y"] = cy - radius * math.cos(rad)
            items[i]["rotation"] = 0 if i == hero else round(fold(theta), 2)


def place_cascade(
    items: list[dict[str, Any]], _args: argparse.Namespace, frame: Frame
) -> None:
    """1 つの傾きで、段ごとに小さく薄く。次の語は前の語から十分離れるまで下げる."""
    slope = -10.0
    rad = math.radians(slope)
    x, y = frame.w / 3 - 200, frame.h / 4 - 80
    placed: list[dict[str, Any]] = []
    for k, item in enumerate(items):
        if k:
            item["size"] = round(max(item["size"] * (0.92**k), 48), 1)
            refresh(item)
        item["rotation"] = slope
        item["opacity"] = round(0.85**k, 3)
        item["x"], item["y"] = (
            x + item["w"] / 2 * math.cos(rad),
            y + item["w"] / 2 * math.sin(rad),
        )
        while placed and not clear_of(item, placed[-1:]):
            item["y"] += 4
        placed.append(item)
        x += 0.35 * item["w"]
        y = item["y"] + item["h"] * 0.5 - item["w"] / 2 * math.sin(rad) * 0


def outline_points(
    shape: str, n: int, frame: Frame
) -> list[tuple[float, float, float]]:
    """輪郭を弧長等分した (x, y, 接線の度). 頂点を避けるため半歩ずらす."""
    cx, cy = frame.w / 2, frame.h / 2
    dense: list[tuple[float, float]] = []
    steps = 720
    for s in range(steps):
        t = math.tau * s / steps
        if shape == "heart":
            sc = 0.62 * frame.h / 29
            dense.append(
                (
                    cx + 16 * math.sin(t) ** 3 * sc,
                    cy
                    - (
                        13 * math.cos(t)
                        - 5 * math.cos(2 * t)
                        - 2 * math.cos(3 * t)
                        - math.cos(4 * t)
                    )
                    * sc
                    + 0.02 * frame.h,
                )
            )
        elif shape == "star":
            r_out, r_in = 0.44 * frame.h, 0.12 * frame.h
            pos = (s * 10) / steps
            k, frac = int(pos), pos - int(pos)
            a_ang = math.tau * k / 10 - math.pi / 2
            b_ang = math.tau * (k + 1) / 10 - math.pi / 2
            ra, rb = (r_out, r_in) if k % 2 == 0 else (r_in, r_out)
            ax, ay = cx + ra * math.cos(a_ang), cy + ra * math.sin(a_ang)
            bx, by = cx + rb * math.cos(b_ang), cy + rb * math.sin(b_ang)
            dense.append((ax + (bx - ax) * frac, ay + (by - ay) * frac))
        else:
            r = 0.36 * frame.h
            dense.append(
                (
                    cx + 1.2 * r * math.cos(t - math.pi / 2),
                    cy + r * math.sin(t - math.pi / 2),
                )
            )
    cum = [0.0]
    for a, b in zip(dense, dense[1:] + dense[:1]):
        cum.append(cum[-1] + math.dist(a, b))
    out = []
    for k in range(n):
        target = cum[-1] * (k + 0.5) / n
        j = max(i for i in range(len(dense)) if cum[i] <= target)
        a, b = dense[j], dense[(j + 1) % len(dense)]
        out.append((a[0], a[1], math.degrees(math.atan2(b[1] - a[1], b[0] - a[0]))))
    return out


def place_silhouette(
    items: list[dict[str, Any]], args: argparse.Namespace, frame: Frame
) -> None:
    points = outline_points(args.shape, len(items), frame)
    for item, (x, y, tangent) in zip(items, points):
        item["x"], item["y"] = x, y
        # 輪郭に沿わせる。ただし傾きは ±8° まで (読めなくなる)
        item["rotation"] = (
            round(max(-8.0, min(8.0, fold(tangent))), 2) if not item.get("hero") else 0
        )


LAYOUTS = {
    "scatter": place_scatter,
    "noise": place_noise,
    "pack": place_pack,
    "grid": place_grid,
    "burst": place_burst,
    "rings": place_rings,
    "cascade": place_cascade,
    "silhouette": place_silhouette,
}


# ---------------------------------------------------------------- 整える・検査


def relax(items: list[dict[str, Any]], frame: Frame, iterations: int = 400) -> None:
    """重なり・近接を、中心を結ぶ向きに押し分けて解く (決定論)."""
    for _ in range(iterations):
        moved = False
        for i, a in enumerate(items):
            for b in items[i + 1 :]:
                gap = separation(a, b)
                need = pad_of(a, b)
                if gap >= need:
                    continue
                dx, dy = b["x"] - a["x"], b["y"] - a["y"]
                norm = math.hypot(dx, dy) or 1.0
                push = (need - gap) / 2 + 1
                wa, wb = (
                    (0.15, 0.85)
                    if a.get("hero")
                    else ((0.85, 0.15) if b.get("hero") else (0.5, 0.5))
                )
                a["x"] -= dx / norm * push * 2 * wa
                a["y"] -= dy / norm * push * 2 * wa
                b["x"] += dx / norm * push * 2 * wb
                b["y"] += dy / norm * push * 2 * wb
                moved = True
        for item in items:
            x0, y0, x1, y1 = aabb(item)
            if x0 < frame.mx:
                item["x"] += frame.mx - x0
            if x1 > frame.w - frame.mx:
                item["x"] -= x1 - (frame.w - frame.mx)
            if y0 < frame.my:
                item["y"] += frame.my - y0
            if y1 > frame.h - frame.my:
                item["y"] -= y1 - (frame.h - frame.my)
        if not moved:
            break


def repair(items: list[dict[str, Any]], frame: Frame) -> None:
    """押し分けで解けなかった語を、今の位置から螺旋に探して置き直す (重ならない所へ)."""
    for _ in range(2):
        for item in sorted(items, key=lambda it: it.get("hero", False)):
            others = [o for o in items if o is not item]
            if frame.inside(item) and clear_of(item, others):
                continue
            ox, oy = item["x"], item["y"]
            for step in range(8000):
                t = step * 0.1
                item["x"], item["y"] = (
                    ox + 3.0 * t * math.cos(t) * 1.3,
                    oy + 3.0 * t * math.sin(t),
                )
                if frame.inside(item) and clear_of(item, others):
                    break


def check(items: list[dict[str, Any]], frame: Frame, bleed: bool) -> dict[str, Any]:
    """センスの規則の検査 (§9.5)。通らなければ issues に出す (握りつぶさない)."""
    issues: list[str] = []
    for i, a in enumerate(items):
        for b in items[i + 1 :]:
            gap = separation(a, b)
            if gap < 0:
                issues.append(f"「{a['text']}」と「{b['text']}」が重なっている")
            elif gap < NEAR_MISS:
                issues.append(
                    f"「{a['text']}」と「{b['text']}」が近すぎる ({gap:.0f}px)"
                )
    if not bleed:
        issues.extend(
            f"「{item['text']}」が外周の余白に入っている"
            for item in items
            if not frame.inside(item) and not item.get("hero")
        )
    for item in items:
        x0, y0, x1, y1 = aabb(item)
        if x0 < -1 or y0 < -1 or x1 > frame.w + 1 or y1 > frame.h + 1:
            issues.append(f"「{item['text']}」が画面の外にはみ出している")
    cells = {
        (int(it["x"] / (frame.w / 3)) % 3, int(it["y"] / (frame.h / 3)) % 3)
        for it in items
    }
    info = {"empty_cells": 9 - len(cells)}
    return {"pass": not issues, "issues": issues, "info": info}


# 解く。収まらなければ縮めて再試行する


def solve(
    args: argparse.Namespace, frame: Frame, source: list[dict[str, Any]]
) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for attempt in range(RETRIES):
        items = [dict(it) for it in source]
        assign_sizes(items, args, frame, SHRINK**attempt)
        LAYOUTS[args.layout](items, args, frame)
        failed = [it["text"] for it in items if it.get("x") is None]
        placed = [it for it in items if it.get("x") is not None]
        if args.layout in ("scatter", "noise", "grid", "rings", "silhouette"):
            relax(placed, frame)
            repair(placed, frame)
        report = check(placed, frame, args.layout == "cascade")
        result = {
            "items": placed,
            "failed": failed,
            "check": report,
            "shrink": round(SHRINK**attempt, 3),
        }
        if report["pass"] and not failed:
            break
    return result


# ---------------------------------------------------------------- レイヤー


def start_offset(
    item: dict[str, Any], mode: str, frame: Frame, seed: int, index: int
) -> tuple[float, float]:
    """散 → 集: 開始位置を最終位置から逆算する (最終位置を正本にする)."""
    cx, cy = frame.w / 2, frame.h / 2
    if mode == "outward":
        return (item["x"] - cx) * 1.0, (item["y"] - cy) * 1.0
    if mode == "flow":
        return -frame.w * 0.6, 0.0
    if mode == "random":
        rng = stream(seed, 300 + index)
        return frame.w * (rng.next() - 0.5) * 0.9 - 0 * item["x"], frame.h * (
            rng.next() - 0.5
        ) * 0.9
    return 0.0, 0.0


def build_layers(
    items: list[dict[str, Any]], args: argparse.Namespace, frame: Frame
) -> list[dict[str, Any]]:
    layers = []
    count = len(items)
    step = args.step if args.step is not None else min(0.18, 0.9 / max(count - 1, 1))
    for i, item in enumerate(items):
        text: dict[str, Any] = {
            "content": item["text"],
            "preset": "fade",
            "unit": "line",
            "stagger": 0,
            "each": 0.2,
            "size": item["size"],
            "color": args.color,
            "weight": args.weight,
            "font": args.font,
            "align": "center",
            "x": round(item["x"], 1),
            "y": round(item["y"], 1),
        }
        motion: dict[str, Any] = {
            "anchor": [
                {
                    "t": 0,
                    "v": [
                        round(item["x"] - frame.w / 2, 1),
                        round(item["y"] - frame.h / 2, 1),
                    ],
                }
            ]
        }
        rot = item["rotation"]
        if args.assemble != "none":
            dx, dy = start_offset(item, args.assemble, frame, args.seed, i)
            hold = 0.3 if item.get("hero") else 0.0
            t0, t1 = hold, hold + args.duration
            if args.assemble == "inplace":
                dx = dy = 0.0
            motion["position"] = [
                {
                    "t": round(t0, 3),
                    "v": [round(dx, 1), round(dy, 1)],
                    "ease": "linear",
                },
                {"t": round(t1, 3), "v": [0, 0], "ease": "ease-out"},
            ]
            spin = 20 if args.assemble == "inplace" else 15
            sign = 1 if stream(args.seed, 400 + i).next() < 0.5 else -1
            motion["rotation"] = [
                {"t": round(t0, 3), "v": round(rot + sign * spin, 2), "ease": "linear"},
                {"t": round(t1, 3), "v": rot, "ease": "ease-out"},
            ]
            start_scale = 0.6 if args.assemble == "inplace" else 1.3
            motion["scale"] = [
                {"t": round(t0, 3), "v": start_scale, "ease": "linear"},
                {"t": round(t1, 3), "v": 1, "ease": "ease-out"},
            ]
            motion["opacity"] = [
                {"t": 0, "v": 0, "ease": "linear"},
                {
                    "t": round(t0 + 0.15, 3),
                    "v": item.get("opacity", 1),
                    "ease": "ease-out",
                },
            ]
        else:
            if rot:
                motion["rotation"] = [{"t": 0, "v": rot}]
            if item.get("opacity", 1) < 1:
                motion["opacity"] = [{"t": 0, "v": item["opacity"]}]
        layer: dict[str, Any] = {
            "id": f"{args.prefix}-{i}",
            "name": item["text"],
            "place": args.place,
            "start": round(args.at + i * step, 3),
            "text": text,
            "motion": motion,
        }
        if args.layer_duration is not None:
            layer["duration"] = round(max(args.layer_duration - i * step, 0.1), 3)
        layers.append(layer)
    return layers


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument("layout", choices=tuple(LAYOUTS))
    parser.add_argument("--words", help="'!主役|普通|,助詞' (| 区切り)")
    parser.add_argument("--text", help="1 字ずつ並べる文字列 (--unit char)")
    parser.add_argument("--unit", choices=("word", "char"), default="word")
    parser.add_argument(
        "--size", type=float, default=110.0, help="--text のときの字高 (px)"
    )
    parser.add_argument(
        "--hero-size", type=float, help="主役の字高 (px。既定は画面高の 20%)"
    )
    parser.add_argument(
        "--tone", choices=tuple(TIERS), default="calm", help="大きさの段 (calm / bold)"
    )
    parser.add_argument("--rot", default="set", help="set (既定) / none / dominant:-12")
    parser.add_argument("--shape", choices=("heart", "star", "circle"), default="heart")
    parser.add_argument("--pack-centre", choices=("third", "centre"), default="third")
    parser.add_argument(
        "--assemble",
        choices=("none", "outward", "inplace", "flow", "random"),
        default="none",
    )
    parser.add_argument(
        "--duration", type=float, default=0.5, help="1 語が最終位置へ着くまで (秒)"
    )
    parser.add_argument(
        "--step", type=float, help="語ごとの出の間隔 (秒。既定は全体 0.9 秒以内)"
    )
    parser.add_argument(
        "--at", type=float, default=0.0, help="最初の語の出 (シーン内の秒)"
    )
    parser.add_argument("--layer-duration", type=float)
    parser.add_argument("--seed", type=int, default=1)
    parser.add_argument("--frame", default="1920x1080")
    parser.add_argument("--color", default="#ffffff")
    parser.add_argument("--font", choices=("sans", "serif"), default="sans")
    parser.add_argument("--weight", type=int, choices=(400, 700, 900), default=900)
    parser.add_argument("--place", choices=("back", "front"), default="front")
    parser.add_argument("--prefix", default="gl")
    parser.add_argument("--ops", action="store_true")
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    match = re.fullmatch(r"(\d+)x(\d+)", args.frame)
    if not match:
        fail("--frame は 1920x1080 の形")
    if not ID_PATTERN.match(args.prefix):
        fail("--prefix は英数字・_・- の 1〜40 字")
    args.layout = args.layout
    frame = Frame(int(match.group(1)), int(match.group(2)))
    if args.unit == "char" and args.words:
        fail("--unit char は --text で使う")
    source = parse(args)
    result = solve(args, frame, source)
    items = result["items"]
    hero = next((it["text"] for it in items if it.get("hero")), "")
    out = {
        "layers": build_layers(items, args, frame),
        "items": [
            {
                k: (round(v, 2) if isinstance(v, float) else v)
                for k, v in it.items()
                if k != "weight"
            }
            for it in items
        ],
        "check": result["check"],
        "failed": result["failed"],
        "hero": hero,
        "notes": [
            "配置の規則: 3 段・主役 1 つ・回転は集合・すき間 16px 以上 (結果は check)",
            f"収まらず字を {result['shrink']} 倍に縮めた"
            if result["shrink"] < 1
            else "縮小なし",
        ],
    }
    if args.ops:
        out["ops"] = [
            {"op": "add", "path": "/layers/-", "value": layer}
            for layer in out["layers"]
        ]
    json.dump(out, sys.stdout, ensure_ascii=False)
    sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
