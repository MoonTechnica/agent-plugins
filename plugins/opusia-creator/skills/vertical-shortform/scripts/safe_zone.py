"""縦型のセーフゾーンを、実際の寸法の矩形 (px) で出す.

    python3 <SKILL_DIR>/scripts/safe_zone.py [--size 720x1280] [--platform tiktok]

## 何のためにあるか

UI が覆う量は 1080 x 1920 基準の px で公表されている (references/safe-zones.md §2)。
別の寸法で組むとき・矩形として配置に使うときの比例計算を手でやらない。

- `common`: 全プラットフォームで一番深い値 (上 140 / 下 500 / 左 60 / 右 180) の内側。
  1 か所で作って複数へ出すならこれ
- `platforms`: 表に数字のある辺はその値、無い辺 (「—」「操作列あり」) は共通の値で
  数える (安全側)

標準ライブラリだけ。終了コード: 0 = 出せた / 2 = 引数が読めなかった.
"""

from __future__ import annotations

import argparse
import json
import sys

BASE_W, BASE_H = 1080, 1920
#: safe-zones.md §2 (1080 x 1920 基準の px)。None は表に数字が無い辺
INSETS: dict[str, dict[str, int | None]] = {
    "tiktok": {"top": 140, "bottom": 400, "left": 60, "right": 180},
    "reels": {"top": 100, "bottom": 500, "left": None, "right": None},
    "shorts": {"top": None, "bottom": 320, "left": None, "right": None},
}
SIDES = ("top", "bottom", "left", "right")
COMMON = {s: max(v[s] or 0 for v in INSETS.values()) for s in SIDES}


def rect(insets: dict[str, int], width: int, height: int) -> dict[str, int]:
    """辺を比例で直してから矩形にする (幅と高さを個別に丸めると 1px ずれる)."""
    sx, sy = width / BASE_W, height / BASE_H
    x0, y0 = round(insets["left"] * sx), round(insets["top"] * sy)
    x1 = round((BASE_W - insets["right"]) * sx)
    y1 = round((BASE_H - insets["bottom"]) * sy)
    return {"x": x0, "y": y0, "width": x1 - x0, "height": y1 - y0}


def platform_insets(name: str) -> dict[str, int]:
    given = INSETS[name]
    return {s: given[s] if given[s] is not None else COMMON[s] for s in SIDES}


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=(__doc__ or "").splitlines()[0])
    parser.add_argument("--size", default=f"{BASE_W}x{BASE_H}", help="WxH")
    parser.add_argument("--platform", choices=list(INSETS), action="append")
    parser.add_argument("--json", action="store_true", help="JSON で出す")
    args = parser.parse_args(argv)
    try:
        width, height = (int(v) for v in args.size.lower().split("x"))
    except ValueError:
        print(f"--size は WxH: {args.size}", file=sys.stderr)
        return 2
    names = args.platform or list(INSETS)
    out = {
        "size": [width, height],
        "common": rect(COMMON, width, height),
        "platforms": {n: rect(platform_insets(n), width, height) for n in names},
    }
    print(json.dumps(out) if args.json else json.dumps(out, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
