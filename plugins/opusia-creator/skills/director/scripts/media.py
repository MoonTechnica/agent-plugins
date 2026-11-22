"""手元でやる素材の加工を、決まった ffmpeg の手順で走らせる.

    python3 <SKILL_DIR>/scripts/media.py probe <file> [--json]
    python3 <SKILL_DIR>/scripts/media.py concat <a> <b> ... -o <out>
    python3 <SKILL_DIR>/scripts/media.py remux <video> <sound> -o <out>
    python3 <SKILL_DIR>/scripts/media.py convert <in> -o <out> [--fps 24] [--size WxH]
    python3 <SKILL_DIR>/scripts/media.py loudnorm <in> -o <out> [--lufs -14]
    python3 <SKILL_DIR>/scripts/media.py md5 <file>

## 何のためにあるか

references/local-vs-server.md の「手元でやるもの」(結合・音の差し替え・変換・整音) は、
毎回 ffmpeg の引数を組み立て直すと取り違える (`-c copy` で頭がずれる・音が消える・
`-map` を落とす)。ここに手順を固定する。どの subcommand も `--dry-run` で
コマンドだけを出す。

**サーバーでやるものはここに無い**: 区間の切り出しと消音は `slice_media`、
指定秒のコマは `get_asset_frames`、尺・黒・無音・音量の実測は `get_asset` の `qc`。
作ったファイルは `create_upload_ticket` → PUT → `register_upload(source_asset_id=元)`
で戻す。

## 依存と呼び方

**標準ライブラリだけ** (ffmpeg / ffprobe は外部コマンド)。ffmpeg が無い環境では
終了コード 3 を返す (`slice_media` などサーバーの tool を使う)。
終了コード: 0 = 成功 / 2 = 引数が読めなかった / 3 = ffmpeg が無い / 4 = ffmpeg が失敗.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import shlex
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Any

#: 配信の既定のラウドネス (compositor の書き出しと揃える)
DEFAULT_LUFS = -14.0
VIDEO_ENCODE = [
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "20",
    "-pix_fmt",
    "yuv420p",
]
NO_FFMPEG, FFMPEG_FAILED = 3, 4


def _ffmpeg(*args: str) -> list[str]:
    return ["ffmpeg", "-v", "error", "-y", *args]


def concat(args: argparse.Namespace, workdir: Path) -> list[str]:
    """再エンコードして繋ぐ (`-c copy` はキーフレームでしか切れず頭がずれる)."""
    listing = workdir / "list.txt"
    listing.write_text(
        "".join(f"file '{Path(p).resolve()}'\n" for p in args.inputs), encoding="utf-8"
    )
    return _ffmpeg(
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        str(listing),
        *VIDEO_ENCODE,
        "-c:a",
        "aac",
        args.output,
    )


def remux(args: argparse.Namespace, _: Path) -> list[str]:
    """映像は 1 本目から、音は 2 本目から (`-shortest` で短いほうに合わせる)."""
    video, sound = args.inputs
    return _ffmpeg(
        "-i",
        video,
        "-i",
        sound,
        "-map",
        "0:v:0",
        "-map",
        "1:a:0",
        "-c:v",
        "copy",
        "-c:a",
        "aac",
        "-shortest",
        args.output,
    )


def convert(args: argparse.Namespace, _: Path) -> list[str]:
    filters = [f"fps={args.fps}"] if args.fps else []
    if args.size:
        width, height = args.size.lower().split("x")
        filters.append(f"scale={width}:{height}")
    vf = ["-vf", ",".join(filters)] if filters else []
    return _ffmpeg("-i", args.inputs[0], *vf, args.output)


def loudnorm(args: argparse.Namespace, _: Path) -> list[str]:
    return _ffmpeg(
        "-i",
        args.inputs[0],
        "-af",
        f"loudnorm=I={args.lufs:g}:TP=-1:LRA=11",
        args.output,
    )


BUILDERS = {"concat": concat, "remux": remux, "convert": convert, "loudnorm": loudnorm}


def probe(path: str) -> dict[str, Any]:
    raw = subprocess.run(  # noqa: S603
        [  # noqa: S607 - PATH 上の ffprobe を使う (サンドボックスと手元で場所が違う)
            "ffprobe",
            "-v",
            "error",
            "-show_streams",
            "-show_format",
            "-of",
            "json",
            path,
        ],
        capture_output=True,
        text=True,
        check=True,
    ).stdout
    data = json.loads(raw)
    video = next((s for s in data["streams"] if s.get("codec_type") == "video"), {})
    return {
        "duration_s": float(data["format"].get("duration") or 0),
        "width": video.get("width"),
        "height": video.get("height"),
        "fps": video.get("avg_frame_rate"),
        "has_audio": any(s.get("codec_type") == "audio" for s in data["streams"]),
    }


def md5(path: str) -> str:
    digest = hashlib.md5()  # noqa: S324 - 同一ファイルかの照合で、暗号用途ではない
    with Path(path).open("rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=(__doc__ or "").splitlines()[0])
    sub = parser.add_subparsers(dest="command", required=True)
    for name in ("probe", "md5"):
        one = sub.add_parser(name)
        one.add_argument("path")
        one.add_argument("--json", action="store_true")
    counts = {"concat": "+", "remux": 2, "convert": 1, "loudnorm": 1}
    for name, nargs in counts.items():
        cmd = sub.add_parser(name)
        cmd.add_argument("inputs", nargs=nargs)
        cmd.add_argument("-o", "--output", required=True)
        cmd.add_argument("--dry-run", action="store_true")
        cmd.add_argument("--fps", type=float)
        cmd.add_argument("--size")
        cmd.add_argument("--lufs", type=float, default=DEFAULT_LUFS)
    return parser


def _run_edit(args: argparse.Namespace) -> int:
    with tempfile.TemporaryDirectory(prefix="media-") as tmp:
        command = BUILDERS[args.command](args, Path(tmp))
        if args.dry_run:
            print(shlex.join(command))
            return 0
        done = subprocess.run(command, capture_output=True, text=True, check=False)  # noqa: S603
    if done.returncode:
        print(done.stderr.strip(), file=sys.stderr)
        return FFMPEG_FAILED
    print(args.output)
    return 0


def _inspect(args: argparse.Namespace) -> int:
    if args.command == "md5":
        print(f"{md5(args.path)}  {args.path}")
        return 0
    info = probe(args.path)
    print(json.dumps(info) if args.json else info)
    return 0


def _needs_ffmpeg(args: argparse.Namespace) -> bool:
    uses = args.command != "md5" and not getattr(args, "dry_run", False)
    return uses and shutil.which("ffmpeg") is None


def main(argv: list[str] | None = None) -> int:
    args = _parser().parse_args(argv)
    if _needs_ffmpeg(args):
        print(
            "ffmpeg が無い: slice_media / get_asset_frames などサーバーの tool を使う",
            file=sys.stderr,
        )
        return NO_FFMPEG
    return _inspect(args) if args.command in {"md5", "probe"} else _run_edit(args)


if __name__ == "__main__":
    sys.exit(main())
