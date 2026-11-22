"""クリップのモーション (`data-motion`) を、画面 (Studio) と同じ形で作る.

    python3 <SKILL_DIR>/scripts/clip_motion.py --spec '<motion の JSON>' \
        [--animation '<今ある animation>']

## 何のためにあるか

クリップに位置・スケール・回転・不透明度のキーを付けるには、**3 つを揃えて書く**:

1. クリップの `data-motion` (キーの正本。JSON)
2. keyframes を持つカリアー
   (`<div data-studio-motion="<ハッシュ>" style="display: none"><style>…`)
3. クリップのインライン `animation` (**効果の animation と 1 つの並び**。モーションが先)

名前 (`m-<ハッシュ>-<プロパティ>`) は**中身のハッシュ**で決まるので、
手で組むと一字違いで動かない。しかも書き落としても画面は普通に出る
(動かないだけ) ので気づけない。
ここはその 3 つを、画面と**同じ結果**で出す。ハッシュ・属性・keyframes・animation が
画面 (`entities/composition/lib/motion.ts`) と一致することは、実出力から作った
フィクスチャ (`motion.cases.json`) を両側のテストが読んで縛っている。

## 入力 (`--spec`)

`data-motion` と同じ形。**時刻はクリップの頭からの秒**。

    {"scale":   [{"t": 0, "v": 1, "ease": "ease-in-out"}, {"t": 0.5, "v": 1.2}],
     "opacity": [{"t": 0, "v": 0}, {"t": 0.5, "v": 1}],
     "position":[{"t": 0, "v": [-600, 0]}],
     "rotation":[{"t": 0, "v": -20}]}

- プロパティ: `anchor` (回転・拡縮の中心。要素の中心からのずれ px。`[x, y]`) /
  `position` (元の置き場所からのずれ px。`[x, y]`) /
  `scale` (倍率。1 = 100%) / `rotation` (度) / `opacity` (0〜1)
- `ease` は**そのキーから次のキーまで**に効く: `linear` /
  `ease-in-out` (Easy Ease) / `ease-in` / `ease-out` / `hold`。省略は `linear`
- 最初のキーより前は最初の値、最後のキーより後は最後の値を保つ
- 不透明度は 0〜1、スケールは 0 以上に収める。キーは時刻の順に並べ直す

## 出力 (JSON)

`hash` / `attr` (クリップの `data-motion` に入れる文字列。空なら null) /
`carrier` (ルートの直下へ足す HTML。空なら null) / `keyframes` /
`animation` (クリップの `style` の `animation` に入れる値)。

`--animation` に**今ある animation** を渡すと、古いモーションの部分 (`m-…`) だけを
捨てて新しいモーションを先頭に、効果の部分 (括弧の中のカンマも含めて) は
**一字も変えずに後ろへ**並べる。

## やらないこと

- 同じ名前のカリアーが既にあるかは見ない
  (ルートに `data-studio-motion="<hash>"` が無ければ足す、は呼ぶ側)
- 使われなくなった古いカリアーは消さない
  (使っているクリップが無い `data-studio-motion` を消すのは呼ぶ側)

## 依存と呼び方

**標準ライブラリだけ**。サンドボックスの python3 でそのまま動く (3.9 でも動くよう、
実行時に評価される型の書き方を避けている)。`python3 <path>` で呼ぶ
(実行ビットは付かない)。

終了コード: 0 = 出力した / 2 = spec が読めない (理由を stderr へ。黙って書かない)。
"""

from __future__ import annotations

import argparse
import json
import math
import re
import sys
from collections.abc import Callable
from decimal import Decimal
from typing import Any, cast

PROPS = ("anchor", "position", "scale", "rotation", "opacity")
EASES = ("linear", "ease-in-out", "ease-in", "ease-out", "hold")
CSS_EASE = {
    "linear": "linear",
    "ease-in-out": "ease-in-out",
    "ease-in": "ease-in",
    "ease-out": "ease-out",
    "hold": "step-end",
}
#: アニメの長さの下限。キーが 0 秒の 1 つだけでも静的な値として効かせる短い定数アニメ
MIN_ANIMATION_SECONDS = 0.1
#: モーションが書いた animation の 1 つ (`m-` + 8 桁の 16 進 + `-プロパティ`)
MOTION_ANIMATION_PART = re.compile(r"^m-[0-9a-f]{8}-[a-z]+\s")
#: 同じ時刻とみなす幅 (秒)
SAME_TIME = 0.001
#: JavaScript が指数表記にしない整数の上限
JS_INTEGER_LIMIT = 1e21
JS_DECIMAL_FLOOR = 1e-6
POINT_SIZE = 2
#: `[x, y]` を値に持つプロパティ
POINT_PROPS = ("anchor", "position")
FNV_OFFSET = 0x811C9DC5
FNV_PRIME = 0x01000193
MASK_32 = 0xFFFFFFFF

Keys = list[dict[str, Any]]
Motion = dict[str, Keys]


class SpecError(ValueError):
    """spec が読めない (理由は人 / エージェントが読む文)."""


def is_finite(item: Any) -> bool:  # noqa: ANN401
    """有限の数か (bool は数に入れない)."""
    return (
        isinstance(item, (int, float))
        and not isinstance(item, bool)
        and math.isfinite(item)
    )


def check_number(value: Any) -> None:  # noqa: ANN401
    """数でなければ落とす."""
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        msg = "a number is required"
        raise SpecError(msg)
    if not math.isfinite(value):
        msg = "a finite number is required"
        raise SpecError(msg)


def expand_exponent(text: str, value: float) -> str:
    """`repr` が指数表記にした数を、JavaScript の書き方にする."""
    if "e" not in text:
        return text
    if JS_DECIMAL_FLOOR <= abs(value) < JS_INTEGER_LIMIT:
        return format(Decimal(text), "f")
    mantissa, exponent = text.split("e")
    number = int(exponent)
    return "{}e{}{}".format(mantissa, "+" if number >= 0 else "-", abs(number))


def js_number(value: float) -> str:
    """JavaScript の `String(number)` と同じ文字列 (ハッシュが画面と一致するため)."""
    check_number(value)
    if float(value).is_integer() and abs(value) < JS_INTEGER_LIMIT:
        return str(int(value))
    return expand_exponent(repr(float(value)), value)


def encode_dict(value: dict[str, Any]) -> str:
    body = ",".join(f"{json.dumps(key)}:{js_json(item)}" for key, item in value.items())
    return "{" + body + "}"


def encode_list(value: list[Any]) -> str:
    return "[" + ",".join(js_json(item) for item in value) + "]"


def encode_str(value: str) -> str:
    return json.dumps(value, ensure_ascii=False)


JSON_ENCODERS: dict[type, Callable[[Any], str]] = {
    dict: encode_dict,
    list: encode_list,
    str: encode_str,
}


def js_json(value: Any) -> str:  # noqa: ANN401
    """`JSON.stringify` と同じ並び・同じ数の書き方 (空白なし)."""
    encode = JSON_ENCODERS.get(type(value))
    return encode(value) if encode else js_number(value)


def fmt(value: float) -> str:
    """CSS に書く数 (小数 4 桁まで。`String(Number(n.toFixed(4)))` と同じ)."""
    return js_number(float(format(value, ".4f")))


def parse_position(value: Any) -> list[float]:  # noqa: ANN401
    ok = isinstance(value, list) and len(value) == POINT_SIZE
    if not (ok and all(map(is_finite, value))):
        msg = "position must be [x, y] numbers"
        raise SpecError(msg)
    return [value[0], value[1]]


def parse_number(prop: str, value: object) -> float:
    if not is_finite(value):
        msg = f"{prop} must be a finite number"
        raise SpecError(msg)
    return cast(float, value)


def parse_value(prop: str, value: object) -> float | list[float]:
    """値を検査して範囲に収める (型が違えば落とす)."""
    if prop in POINT_PROPS:
        return parse_position(value)
    number = parse_number(prop, value)
    clamps: dict[str, Callable[[float], float]] = {
        "opacity": lambda n: min(1.0, max(0.0, n)),
        "scale": lambda n: max(0.0, n),
    }
    return clamps.get(prop, float)(number)


def check_time(prop: str, item: Any) -> float:  # noqa: ANN401
    time = item.get("t") if isinstance(item, dict) else None
    if not is_finite(time) or cast(float, time) < 0:
        msg = f"{prop} has a key with an invalid time"
        raise SpecError(msg)
    return cast(float, time)


def parse_key(prop: str, item: Any) -> dict[str, Any]:  # noqa: ANN401
    time = check_time(prop, item)
    ease = item.get("ease", "linear")
    if ease not in EASES:
        msg = f"{prop} has a key with an unknown ease: {ease}"
        raise SpecError(msg)
    value = parse_value(prop, item.get("v"))
    return {"t": time, "v": value, "ease": ease}


def parse_keys(prop: str, raw: Any) -> Keys:  # noqa: ANN401
    if not isinstance(raw, list):
        msg = f"{prop} must be a list of keys"
        raise SpecError(msg)
    keys = [parse_key(prop, item) for item in raw]
    return sorted(keys, key=lambda key: key["t"])


def check_spec(spec: object) -> dict[str, Any]:
    if not isinstance(spec, dict):
        msg = "the motion must be a JSON object"
        raise SpecError(msg)
    unknown = [key for key in spec if key not in PROPS]
    if unknown:
        msg = "unknown properties: {}".format(", ".join(unknown))
        raise SpecError(msg)
    return spec


def parse_motion(spec: object) -> Motion:
    """Spec を正規の形 (`{prop: [{t, v, ease}]}`、時刻順、既定の緩急つき) にする."""
    checked = check_spec(spec)
    parsed = {
        prop: parse_keys(prop, checked[prop]) for prop in PROPS if prop in checked
    }
    return {prop: keys for prop, keys in parsed.items() if keys}


def serialize(motion: Motion) -> str | None:
    """`data-motion` の文字列 (空なら None)."""
    return js_json(motion) if motion else None


def motion_hash(motion: Motion) -> str:
    """中身から決まる 8 桁の 16 進 (FNV-1a。画面の `motionHash` と同じ)."""
    value = FNV_OFFSET
    for char in serialize(motion) or "":
        value = ((value ^ ord(char)) * FNV_PRIME) & MASK_32
    return format(value, "08x")


POINT_CSS: dict[str, Callable[[str, str], str]] = {
    "anchor": lambda x, y: f"transform-origin: calc(50% + {x}px) calc(50% + {y}px)",
    "position": lambda x, y: f"translate: {x}px {y}px",
}


def declaration(prop: str, value: float | list[float]) -> str:
    """プロパティ 1 つぶんの CSS 宣言."""
    if prop in POINT_CSS:
        x, y = cast(list[float], value)
        return POINT_CSS[prop](fmt(x), fmt(y))
    if prop == "rotation":
        return f"rotate: {fmt(cast(float, value))}deg"
    return f"{prop}: {fmt(cast(float, value))}"


def frame_value(keys: Keys, time: float) -> tuple[Any, str]:
    """その時刻のフレームの値と、次のキーへ向かう緩急."""
    at = [key for key in keys if abs(key["t"] - time) <= SAME_TIME]
    if at:
        return at[0]["v"], CSS_EASE[at[0]["ease"]]
    edge = keys[0] if time <= keys[0]["t"] else keys[-1]
    return edge["v"], CSS_EASE["linear"]


def frame_line(prop: str, keys: Keys, time: float, duration: float) -> str:
    value, timing = frame_value(keys, time)
    percent = fmt(time / duration * 100)
    css = declaration(prop, value)
    return f"  {percent}% {{ {css}; animation-timing-function: {timing} }}"


def prop_css(name: str, prop: str, keys: Keys) -> tuple[str, str]:
    """プロパティ 1 つぶんの `@keyframes` と `animation` の 1 要素."""
    duration = max(keys[-1]["t"], MIN_ANIMATION_SECONDS)
    stamps = {0, duration, *(key["t"] for key in keys)}
    times = sorted(stamps)
    frames = "\n".join(frame_line(prop, keys, time, duration) for time in times)
    block = f"@keyframes {name}-{prop} {{\n{frames}\n}}"
    return block, f"{name}-{prop} {fmt(duration)}s linear 1 forwards"


def motion_css(name: str, motion: Motion) -> tuple[str, str]:
    """`@keyframes` (プロパティごとに 1 つ) と `animation` の値.

    アニメの長さは**最後のキーの時刻**で、`forwards` で最後の値を保つ
    (クリップの尺に依らない)。頭 (0%) には最初の値を置く。
    フレームの値はキーの値そのもの (補間は CSS がする)。
    """
    parts = [prop_css(name, prop, motion[prop]) for prop in PROPS if motion.get(prop)]
    return "\n".join(block for block, _ in parts), ", ".join(a for _, a in parts)


class Splitter:
    """括弧と引用符の外にある区切りで分ける状態機械 (1 文字ずつ食べる)."""

    def __init__(self, delimiter: str) -> None:
        self.delimiter = delimiter
        self.parts: list[str] = []
        self.current = ""
        self.depth = 0
        self.quote: str | None = None

    def in_quote(self, char: str) -> None:
        self.quote = None if char == self.quote else self.quote

    def outside(self, char: str) -> bool:
        """区切りで切ったら True (その文字は捨てる)."""
        if char in "\"'":
            self.quote = char
        self.depth = max(0, self.depth + (char == "(") - (char == ")"))
        return char == self.delimiter and self.depth == 0

    def feed(self, char: str) -> None:
        if self.quote:
            self.in_quote(char)
        elif self.outside(char):
            self.parts.append(self.current)
            self.current = ""
            return
        self.current += char

    def finish(self) -> list[str]:
        return [*self.parts, self.current]


def split_top_level(text: str, delimiter: str) -> list[str]:
    """括弧と引用符の外で分ける (`cubic-bezier(0.3, 1, 0.6, 1)` を壊さない)."""
    splitter = Splitter(delimiter)
    for char in text:
        splitter.feed(char)
    return splitter.finish()


def merge_animation(motion_animation: str, existing: str | None) -> str | None:
    """モーションの animation を先頭に、効果の部分は一字も変えずに後ろへ."""
    parts = [part.strip() for part in split_top_level(existing or "", ",")]
    effects = [p for p in parts if p and not MOTION_ANIMATION_PART.match(p)]
    merged = ([motion_animation] if motion_animation else []) + effects
    return ", ".join(merged) if merged else None


def carrier_html(hash_: str, keyframes: str) -> str | None:
    if not keyframes:
        return None
    return (
        f'<div data-studio-motion="{hash_}" style="display: none">'
        f"<style>{keyframes}</style></div>"
    )


def build(spec: object, existing_animation: str | None) -> dict[str, Any]:
    motion = parse_motion(spec)
    hash_ = motion_hash(motion)
    keyframes, animation = motion_css("m-" + hash_, motion)
    return {
        "hash": hash_,
        "attr": serialize(motion),
        "carrier": carrier_html(hash_, keyframes),
        "keyframes": keyframes,
        "animation": merge_animation(animation, existing_animation),
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n", 1)[0])
    parser.add_argument(
        "--spec", required=True, help="motion の JSON (`-` なら標準入力)"
    )
    parser.add_argument("--animation", default=None, help="今ある animation の値")
    args = parser.parse_args(argv)
    try:
        raw = sys.stdin.read() if args.spec == "-" else args.spec
        result = build(json.loads(raw), args.animation)
    except (SpecError, json.JSONDecodeError) as error:
        sys.stderr.write(f"clip_motion: {error}\n")
        return 2
    sys.stdout.write(json.dumps(result, ensure_ascii=False) + "\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
