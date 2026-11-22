r"""揺らすパーツの設定を出す (compositor スキル). 標準ライブラリだけ.

髪・服・リボン・マント・旗のような**二次運動**を、1 枚の絵を
分けたレイヤーで付けるときに使う。入力は `seedream-5-layerize` の
素材の `asset_versions[].meta.layers` (または meta 全体) を保存した
JSON。出力は references/layer-rig.html の `<script id="rig">` に
そのまま貼る JSON。

  python3 rig_parts.py --layers layers.json --size 1024x1536 \
      --part "Left twin tail=hair-strand" --part "Right twin tail=hair-strand" \
      [--pin "Left twin tail=0.8,0.05"] [--duration 8] [--wind gust|breeze] \
      [--back "Left twin tail"] [--keep-base] [--json]

- `--size` はベース画像の画素寸法(layerize の座標はベース画像の座標系)
- `--part` に無いレイヤーは動かさない(体・顔など)。名前はモデルが付けた `name`
- `--pin` は支点をパーツの左上からの比率で上書きする(結び目が上端の中央に無いとき)
- `--back` に挙げたレイヤーは一番奥へ回す (ベースの上)。layerize の重ね順は
  止まった絵の順なので、揺れて体の前へ回り込む房 (肩の後ろに垂れる髪) は服より奥へ
- ベース(z_index 0)は既定で捨てる。背景として使うなら `--keep-base`
- 揺れ方の既定値は KINDS。種類が合わなければ一番近いものを選び、見てから直す

既定の出力は 1 パーツ 1 行。`--json` で機械可読。
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any, NoReturn

#: 揺れ方の既定値。mode は 3 つ:
#:   swing … 支点を中心に回す。細い房・リボン(根元から曲がる)
#:   shear … 支点の辺は動かさず、離れるほど横へずらす。幅のあるスカート・裾・後ろ髪
#:   wave  … 進行波で波打たせる。マント・旗(布が波になる)
#: amp は swing ならラジアン、shear / wave なら長さに対する比率。
#: speed は角速度 (rad/s)、lag は根元から先端までの位相の遅れ (rad)、curve は
#: 先端ほど大きく揺らす指数、drift は突風で流れる量(amp と同じ単位)、grid は網の頂点数
KINDS: dict[str, dict[str, Any]] = {
    "hair-strand": {
        "mode": "swing",
        "axis": "down",
        "amp": 0.045,
        "speed": 2.4,
        "lag": 2.2,
        "curve": 1.35,
        "drift": 0.09,
        "grid": [8, 40],
    },
    "hair-bangs": {
        "mode": "swing",
        "axis": "down",
        "amp": 0.02,
        "speed": 3.2,
        "lag": 1.6,
        "curve": 1.2,
        "drift": 0.03,
        "grid": [10, 12],
    },
    "hair-back": {
        "mode": "shear",
        "axis": "down",
        "amp": 0.03,
        "speed": 2.0,
        "lag": 1.8,
        "curve": 1.6,
        "drift": 0.05,
        "grid": [16, 32],
    },
    "ribbon": {
        "mode": "swing",
        "axis": "down",
        "amp": 0.08,
        "speed": 4.0,
        "lag": 3.0,
        "curve": 1.2,
        "drift": 0.12,
        "grid": [6, 24],
    },
    "skirt": {
        "mode": "shear",
        "axis": "down",
        "amp": 0.018,
        "speed": 2.6,
        "lag": 1.2,
        "curve": 1.8,
        "drift": 0.025,
        "grid": [16, 12],
    },
    "coat-hem": {
        "mode": "shear",
        "axis": "down",
        "amp": 0.012,
        "speed": 2.2,
        "lag": 1.0,
        "curve": 2.0,
        "drift": 0.02,
        "grid": [12, 12],
    },
    "cape": {
        "mode": "wave",
        "axis": "down",
        "amp": 0.035,
        "speed": 3.0,
        "lag": 2.6,
        "curve": 1.3,
        "drift": 0.06,
        "grid": [16, 24],
    },
    "flag": {
        "mode": "wave",
        "axis": "right",
        "amp": 0.06,
        "speed": 4.2,
        "lag": 6.0,
        "curve": 1.0,
        "drift": 0.0,
        "grid": [32, 8],
    },
}

#: 支点の既定位置(パーツの左上からの比率)。辺のまんなかに置く
PIN_BY_AXIS: dict[str, tuple[float, float]] = {
    "down": (0.5, 0.0),
    "up": (0.5, 1.0),
    "right": (0.0, 0.5),
    "left": (1.0, 0.5),
}

#: 突風の位置 (尺に対する比率)。上がり → 収まり。dir は -1 = 左へ流れる (右から吹く)
GUST_RISE = (0.25, 0.375)
GUST_FALL = (0.625, 0.8)
GOLDEN = 2.399963  # 隣のパーツと位相が揃わないための黄金角 (rad)


def _fail(message: str) -> NoReturn:
    print(message, file=sys.stderr)
    raise SystemExit(2)


def _size(text: str) -> tuple[int, int]:
    try:
        width, height = (int(v) for v in text.lower().split("x"))
    except ValueError:
        _fail(f"--size は WxH で渡す(例: 1024x1536): {text!r}")
    return width, height


def _pairs(values: list[str], flag: str) -> dict[str, str]:
    out: dict[str, str] = {}
    for value in values:
        name, sep, rest = value.rpartition("=")
        if not sep or not name:
            _fail(f"{flag} は「レイヤー名=値」で渡す: {value!r}")
        out[name] = rest
    return out


def _load_layers(path: Path) -> list[dict[str, Any]]:
    data = json.loads(path.read_text())
    layers = data.get("layers") if isinstance(data, dict) else data
    if not isinstance(layers, list) or not layers:
        _fail(f"{path} に layers の配列が無い (meta.layers を保存する)")
    return sorted(layers, key=lambda layer: int(layer.get("z_index", 0)))


def _box(layer: dict[str, Any], size: tuple[int, int]) -> tuple[int, int, int, int]:
    box = (layer.get("bounding_box") or {}).get("absolute")
    if box is None:
        return 0, 0, size[0], size[1]
    left, top, right, bottom = (round(v) for v in box)
    return left, top, right - left, bottom - top


def _rig(kind: str, index: int, w: int, h: int, pin: str | None) -> dict[str, Any]:
    preset = dict(KINDS[kind])
    px, py = PIN_BY_AXIS[preset["axis"]]
    if pin is not None:
        try:
            px, py = (float(v) for v in pin.split(","))
        except ValueError:
            _fail(f"--pin は「レイヤー名=x,y」(0〜1 の比率) で渡す: {pin!r}")
    preset["pin"] = {"x": round(px * w, 1), "y": round(py * h, 1)}
    preset["phase"] = round((index * GOLDEN) % 6.283185, 3)
    preset["kind"] = kind
    return preset


def _wind(kind: str, duration: float) -> dict[str, Any]:
    if kind == "breeze":
        return {"base": 1.0, "gust": 0, "rise": [0, 0], "fall": [0, 0], "dir": -1}

    def scale(pair: tuple[float, float]) -> list[float]:
        return [round(pair[0] * duration, 2), round(pair[1] * duration, 2)]

    return {
        "base": 1.0,
        "gust": 1.2,
        "rise": scale(GUST_RISE),
        "fall": scale(GUST_FALL),
        "dir": -1,
    }


def _check(
    layers: list[dict[str, Any]], kinds: dict[str, str], back: list[str]
) -> None:
    names = [str(layer.get("name")) for layer in layers if layer.get("name")]
    unknown_names = [name for name in [*kinds, *back] if name not in names]
    if unknown_names:
        _fail(f"レイヤー {unknown_names[0]!r} が無い。あるのは: {', '.join(names)}")
    unknown_kinds = [kind for kind in kinds.values() if kind not in KINDS]
    if unknown_kinds:
        _fail(f"種類 {unknown_kinds[0]!r} は無い。使えるのは: {', '.join(KINDS)}")


def _part(
    index: int,
    layer: dict[str, Any],
    size: tuple[int, int],
    kinds: dict[str, str],
    pins: dict[str, str],
) -> dict[str, Any]:
    name = str(layer.get("name") or "base")
    x, y, w, h = _box(layer, size)
    kind = kinds.get(name)
    return {
        "layer": name,
        "index": index,
        "z": int(layer.get("z_index", 0)),
        "x": x,
        "y": y,
        "w": w,
        "h": h,
        "rig": _rig(kind, index, w, h, pins.get(name)) if kind else None,
    }


def build(args: argparse.Namespace) -> dict[str, Any]:
    size = _size(args.size)
    layers = _load_layers(Path(args.layers))
    kinds = _pairs(args.part, "--part")
    _check(layers, kinds, args.back)
    pins = _pairs(args.pin, "--pin")
    # index は layerize が返した並び (= images の何番目か) のまま持つ。並べ替えた後に
    # 振ると、描く順と画像の対応がずれる (別のレイヤーの画像が別の位置に貼られる)
    numbered = list(enumerate(layers))

    # 奥へ回すものはベースの直後へ (互いの順は元の z のまま)。sort は安定
    def depth(item: tuple[int, dict[str, Any]]) -> int:
        name = item[1].get("name")
        return 0 if not name else 1 + (name not in args.back)

    numbered.sort(key=depth)
    parts = [
        _part(index, layer, size, kinds, pins)
        for index, layer in numbered
        if layer.get("name") or args.keep_base
    ]
    return {
        "width": size[0],
        "height": size[1],
        "parts": parts,
        "wind": _wind(args.wind, args.duration),
    }


def _line(part: dict[str, Any]) -> str:
    rig = part["rig"]
    at = f"@({part['x']},{part['y']}) {part['w']}x{part['h']}"
    where = f"z{part['z']} {part['layer']} {at}"
    if rig is None:
        return f"{where}  static"
    pin = rig["pin"]
    at_pin = f"pin=({pin['x']},{pin['y']})"
    return f"{where}  {rig['mode']} {rig['kind']} {at_pin} amp={rig['amp']}"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--layers", required=True)
    parser.add_argument("--size", required=True)
    parser.add_argument("--part", action="append", default=[])
    parser.add_argument("--pin", action="append", default=[])
    parser.add_argument("--back", action="append", default=[])
    parser.add_argument("--duration", type=float, default=8.0)
    parser.add_argument("--wind", choices=("gust", "breeze"), default="gust")
    parser.add_argument("--keep-base", action="store_true")
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args()
    rig = build(args)
    if args.json:
        print(json.dumps(rig, ensure_ascii=False))
        return
    for part in rig["parts"]:
        print(_line(part))


if __name__ == "__main__":
    main()
