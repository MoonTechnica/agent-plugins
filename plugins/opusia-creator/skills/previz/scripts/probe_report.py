"""probe の数値を構図の言葉へ換算する (previz スキル). 標準ライブラリだけで動く.

    python3 <SKILL_DIR>/scripts/probe_report.py <probe.json> [--subject <id>] [--json]

## 何のためにあるか

エージェントは絵を見られないので、`probe_previz_scene` の ndc と距離から
頭頂・目線・足元の位置、画面の縦に入っている実寸、隣り合うカットの振り角を
**式で**出す必要がある (references/framing.md §1)。毎回手で解くと符号と単位を
取り違えるので、ここが解いて規則 (framing.md §3・§4) と突き合わせる。

## 入れるもの

`probe_previz_scene` の戻り値 (`{"doc": ..., "result": ...}`)。`doc` が無い
(`result` だけ) ときは身長が分からないので、頭頂・目線・足元を出さない。

- 身長はカプセルの寸法から (`size.height + 2 x size.radius`。原点は全高の半分)
- `--subject` (複数可) を渡すと、構図の規則はその人物だけに当てる。省くと全員

## 出すもの

カットごと・サンプルごとに、各人物の `head_y` / `eye_y` / `feet_y` (ndc) と
`frame_height_m` (画面の縦に入っている実寸)。所見は
`offscreen` / `headroom` / `eye_line` / `feet` / `line_flip` / `screen_direction` /
`thirty_degree`。

## やらないこと

- 強いアオリ / フカンの補正 (近似が崩れる。framing.md §2 のヘッドノードで測る)
- 構図の良し悪しそのもの (規則の範囲外の意図は notes に書く)

終了コード: 0 = 所見なし / 1 = 所見あり / 2 = 読めなかった.
"""

from __future__ import annotations

import argparse
import json
import math
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


HALF_SENSOR_MM = 12.0
#: 目線の高さ (身長比。framing.md §1)
EYE_RATIO = 0.43
#: 頭頂の ndc.y の帯 (引き〜ミディアム。framing.md §3)
HEADROOM_TIGHT = 0.95
HEADROOM_DEAD = 0.6
#: 目線の帯 (引きの許容。framing.md §3)
EYE_BAND = (0.2, 0.5)
#: 足元が枠の下端に貼り付く帯 (framing.md §3)
FEET_STUCK = -0.95
#: 30 度ルールと同サイズの幅 (framing.md §4.2・§4.3)
MIN_SWING_DEG = 30.0
SAME_SIZE_RATIO = 0.2
#: 画面方向の入れ替わりとみなす最小の寄り (中央付近の揺れは数えない)
SIDE_MIN = 0.1

Finding = dict[str, str]


@dataclass(frozen=True)
class Placed:
    """1 サンプルの 1 人物の換算結果."""

    node_id: str
    label: str
    onscreen: bool
    x: float | None
    distance: float
    frame_height_m: float
    height_m: float | None
    head_y: float | None
    eye_y: float | None
    feet_y: float | None


def _focal(fov: float) -> float:
    return HALF_SENSOR_MM / math.tan(math.radians(fov) / 2)


def heights(doc: dict[str, Any] | None) -> dict[str, float]:
    """カプセルの全高 (m). 胴の長さ + 直径."""
    nodes = (doc or {}).get("nodes") or []
    return {
        str(n["id"]): float(n["size"]["height"]) + 2 * float(n["size"]["radius"])
        for n in nodes
        if n.get("kind") == "capsule" and isinstance(n.get("size"), dict)
    }


def positions(doc: dict[str, Any] | None) -> dict[str, tuple[float, float]]:
    """人物の床の上の位置 (x, z). 静止している前提 (transform.t)."""
    nodes = (doc or {}).get("nodes") or []
    return {
        str(n["id"]): (float(n["transform"]["t"][0]), float(n["transform"]["t"][2]))
        for n in nodes
        if isinstance((n.get("transform") or {}).get("t"), list)
    }


def _offset(y: float, metres: float, unit: float) -> float:
    return round(y + metres / unit, 3)


def place(node: dict[str, Any], fov: float, height: float | None) -> Placed:
    ndc = node.get("ndc")
    distance = float(node.get("distance") or 0)
    focal = _focal(fov)
    unit = HALF_SENSOR_MM * distance / focal if distance > 0 else 0.0
    y = float(ndc[1]) if ndc else None
    known = height is not None and y is not None and unit > 0
    return Placed(
        node_id=str(node["id"]),
        label=str(node.get("label") or node["id"]),
        onscreen=bool(node.get("onscreen")),
        x=float(ndc[0]) if ndc else None,
        distance=distance,
        frame_height_m=round(2 * HALF_SENSOR_MM * distance / focal, 3),
        height_m=height,
        head_y=_offset(y, height / 2, unit) if known else None,  # type: ignore[arg-type,operator]
        eye_y=_offset(y, (EYE_RATIO) * height, unit) if known else None,  # type: ignore[arg-type,operator]
        feet_y=_offset(y, -height / 2, unit) if known else None,  # type: ignore[arg-type,operator]
    )


# ===== 1 サンプルの規則 =====


def _offscreen(cut: str, p: Placed) -> list[Finding]:
    if p.onscreen:
        return []
    return [{"code": "offscreen", "message": f"{cut}: {p.label} が枠の外"}]


def _headroom_problem(head: float) -> str | None:
    if head > HEADROOM_TIGHT:
        return "頭上が窮屈"
    if head < HEADROOM_DEAD:
        return "頭上が空きすぎ (寄るかカメラを下げる)"
    return None


def _headroom(cut: str, p: Placed) -> list[Finding]:
    if p.head_y is None or p.head_y > 1 or not p.onscreen:
        return []
    problem = _headroom_problem(p.head_y)
    if problem is None:
        return []
    message = f"{cut}: {p.label} の{problem} (頭頂 {p.head_y:+.2f}。+0.75〜+0.95)"
    return [{"code": "headroom", "message": message}]


def _eye_line(cut: str, p: Placed) -> list[Finding]:
    if p.eye_y is None or not p.onscreen or p.head_y is None or p.head_y > 1:
        return []
    low, high = EYE_BAND
    if low <= p.eye_y <= high:
        return []
    return [
        {
            "code": "eye_line",
            "message": f"{cut}: {p.label} の目線 {p.eye_y:+.2f}"
            f" (上 1/3 = +0.33。{low:+.1f}〜{high:+.1f})",
        }
    ]


def _feet(cut: str, p: Placed) -> list[Finding]:
    if p.feet_y is None or not p.onscreen or not -1 <= p.feet_y < FEET_STUCK:
        return []
    return [
        {
            "code": "feet",
            "message": f"{cut}: {p.label} の足元が下端に貼り付く"
            f" ({p.feet_y:+.2f}。-0.85〜-0.95)",
        }
    ]


SAMPLE_CHECKS: tuple[Callable[[str, Placed], list[Finding]], ...] = (
    _offscreen,
    _headroom,
    _eye_line,
    _feet,
)


# ===== 隣り合うカット =====


@dataclass(frozen=True)
class Shot:
    key: str
    camera: tuple[float, float]
    placed: dict[str, Placed]


def _swing(
    a: tuple[float, float], b: tuple[float, float], s: tuple[float, float]
) -> float:
    v1, v2 = (a[0] - s[0], a[1] - s[1]), (b[0] - s[0], b[1] - s[1])
    norm = math.hypot(*v1) * math.hypot(*v2)
    if norm == 0:
        return 0.0
    cos = max(-1.0, min(1.0, (v1[0] * v2[0] + v1[1] * v2[1]) / norm))
    return math.degrees(math.acos(cos))


def _thirty(a: Shot, b: Shot, where: dict[str, tuple[float, float]]) -> list[Finding]:
    found: list[Finding] = []
    for node_id in a.placed.keys() & b.placed.keys() & where.keys():
        pa, pb = a.placed[node_id], b.placed[node_id]
        same = abs(pa.frame_height_m - pb.frame_height_m) <= SAME_SIZE_RATIO * max(
            pa.frame_height_m, pb.frame_height_m
        )
        angle = _swing(a.camera, b.camera, where[node_id])
        if pa.onscreen and pb.onscreen and same and angle < MIN_SWING_DEG:
            found.append(
                {
                    "code": "thirty_degree",
                    "message": f"{a.key} → {b.key}: {pa.label} を {angle:.0f} 度・"
                    "同じサイズで続けている (30 度以上振るか、サイズを 1 段変える)",
                }
            )
    return found


def _direction(a: Shot, b: Shot) -> list[Finding]:
    return [
        {
            "code": "screen_direction",
            "message": f"{a.key} → {b.key}: {a.placed[i].label} の左右が入れ替わる",
        }
        for i in a.placed.keys() & b.placed.keys()
        if (xa := a.placed[i].x) is not None
        and (xb := b.placed[i].x) is not None
        and abs(xa) > SIDE_MIN
        and abs(xb) > SIDE_MIN
        and (xa > 0) != (xb > 0)
    ]


# ===== 組み立て =====


def _shots(
    result: dict[str, Any], tall: dict[str, float], subjects: set[str]
) -> list[tuple[dict[str, Any], list[list[Placed]]]]:
    out = []
    for cut in result.get("cuts") or []:
        samples = [
            [
                place(n, float(s["camera"]["fov"]), tall.get(str(n["id"])))
                for n in s.get("nodes") or []
                if n.get("visible", True) and (not subjects or n["id"] in subjects)
            ]
            for s in cut.get("samples") or []
        ]
        out.append((cut, samples))
    return out


def _sample_findings(key: str, samples: list[list[Placed]]) -> list[Finding]:
    """1 カットの所見. 同じ人物の同じ所見はサンプルをまたいで 1 回だけ."""
    every = [
        ((f["code"], p.node_id), f)
        for placed in samples
        for p in placed
        for check in SAMPLE_CHECKS
        for f in check(key, p)
    ]
    found: dict[tuple[str, str], Finding] = {}
    for seen, f in every:
        found.setdefault(seen, f)
    return list(found.values())


def _key(cut: dict[str, Any]) -> str:
    return str(cut.get("key") or cut.get("id"))


def _first_shot(cut: dict[str, Any], samples: list[list[Placed]]) -> Shot | None:
    if not samples or not cut.get("samples"):
        return None
    pos = cut["samples"][0]["camera"]["position"]
    placed = {p.node_id: p for p in samples[0]}
    return Shot(_key(cut), (float(pos[0]), float(pos[2])), placed)


def _line_flips(result: dict[str, Any]) -> list[Finding]:
    keys = {str(c.get("id")): _key(c) for c in result.get("cuts") or []}
    return [
        {
            "code": "line_flip",
            "message": f"{keys.get(f['from'], f['from'])} → "
            f"{keys.get(f['to'], f['to'])}: イマジナリーラインを跨いでいる"
            " (同じ側へ回す。意図なら跨ぐ瞬間を見せる)",
        }
        for f in result.get("lineFlips") or []
    ]


def _cut_rows(built: list[tuple[dict[str, Any], list[list[Placed]]]]) -> list[Any]:
    return [
        {
            "key": _key(c),
            "samples": [
                {"time": s.get("time"), "nodes": [p.__dict__ for p in placed]}
                for s, placed in zip(c.get("samples") or [], samples)
            ],
        }
        for c, samples in built
    ]


def report(payload: dict[str, Any], subjects: set[str]) -> dict[str, Any]:
    doc = payload.get("doc") if "result" in payload else None
    result = payload.get("result", payload)
    where = positions(doc)
    built = _shots(result, heights(doc), subjects)
    firsts = [s for s in (_first_shot(c, samples) for c, samples in built) if s]
    findings = [
        *(f for c, samples in built for f in _sample_findings(_key(c), samples)),
        *(f for a, b in pairwise(firsts) for f in _thirty(a, b, where)),
        *(f for a, b in pairwise(firsts) for f in _direction(a, b)),
        *_line_flips(result),
    ]
    return {"cuts": _cut_rows(built), "findings": findings}


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=(__doc__ or "").splitlines()[0])
    parser.add_argument("probe", help="probe_previz_scene の JSON (- で標準入力)")
    parser.add_argument("--subject", action="append", default=[], help="主役の node id")
    parser.add_argument("--json", action="store_true", help="JSON で出す")
    args = parser.parse_args(argv)
    try:
        raw = (
            sys.stdin.read()
            if args.probe == "-"
            else Path(args.probe).read_text("utf-8")
        )
        payload = json.loads(raw)
    except (OSError, ValueError) as exc:
        print(f"読めなかった: {exc}", file=sys.stderr)
        return 2
    out = report(payload, set(args.subject))
    if args.json:
        print(json.dumps(out, ensure_ascii=False))
    else:
        print(
            "\n".join(f"[{f['code']}] {f['message']}" for f in out["findings"])
            or "所見なし"
        )
    return 1 if out["findings"] else 0


if __name__ == "__main__":
    sys.exit(main())
