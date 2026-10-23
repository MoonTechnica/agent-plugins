"""Platform が Modal の Sandbox で起動するランナー (python-backend.md §4.2・§4.3).

    python -m fdpocket.runner task
        入力を受け、handler を呼び、結果を報告する
    python -m fdpocket.runner server <module:app>
        ASGI の app を 8080 で待ち受ける

handler の例外は失敗として報告し (型名とメッセージの先頭だけ)、終了コードは 0 にする。
報告そのものができなければ 1 で終わる (Platform は `runner_exited` として扱う)。
SIGTERM / SIGINT を受けたら合図を報告してすぐ終わる。Platform が止めたのでなければ、
Modal が GPU の Sandbox を途中で止めた (preemption) として最初からやり直す (§4.2)。
"""

import asyncio
import importlib
import inspect
import json
import logging
import os
import signal
import sys
from collections.abc import Callable
from pathlib import Path
from types import FrameType
from typing import Any

import httpx

from fdpocket.client import Client
from fdpocket.context import RunContext
from fdpocket.errors import FdpocketError
from fdpocket.load import LoadMeter, report_forever, track
from fdpocket.runner_api import RunnerApi

SERVER_PORT = 8080
USAGE = "usage: python -m fdpocket.runner task | server <module:app>"
logger = logging.getLogger("fdpocket.runner")


def load(handler: str) -> Callable[..., Any]:
    """`module.path:attr` を import する."""
    module_name, _, attr = handler.partition(":")
    target = getattr(importlib.import_module(module_name), attr)
    if not callable(target):
        message = f"{handler} is not callable"
        raise TypeError(message)
    return target  # type: ignore[no-any-return]


def call(handler: Callable[..., Any], ctx: RunContext, payload: object) -> object:
    """同期の handler も `async def` の handler も受ける."""
    result = handler(ctx, payload)
    return asyncio.run(result) if inspect.iscoroutine(result) else result


def execute(api: RunnerApi, ctx: RunContext, handler: str, payload: object) -> None:
    try:
        output = call(load(handler), ctx, payload)
        json.dumps(output)
    except Exception as error:
        logger.exception("The task failed")
        api.fail(type(error).__name__, str(error))
        return
    api.succeed(output)


def report_interrupted(api: RunnerApi) -> None:
    try:
        api.interrupted()
    except Exception:
        logger.exception("Could not report the stop signal")


def interrupt_handler(
    api: RunnerApi, exit_now: Callable[[int], object] = os._exit
) -> Callable[[int, FrameType | None], None]:
    """停止の合図を報告して、handler の途中でも終わる (終了コードは 128 + 合図)."""

    def handle(signum: int, _frame: FrameType | None) -> None:
        report_interrupted(api)
        exit_now(128 + signum)

    return handle


def run_task(
    env: dict[str, str],
    transport: httpx.BaseTransport | None = None,
    *,
    handle_signals: bool = False,
) -> None:
    run_id = env["PLATFORM_RUN_ID"]
    http = httpx.Client(timeout=httpx.Timeout(120), transport=transport)
    api = RunnerApi(http, env["GATEWAY_URL"], run_id, env["PLATFORM_RUN_TOKEN"])
    if handle_signals:
        handler = interrupt_handler(api)
        signal.signal(signal.SIGTERM, handler)
        signal.signal(signal.SIGINT, handler)
    client = Client(
        gateway_url=env["GATEWAY_URL"],
        credential=env["PLATFORM_SERVICE_CREDENTIAL"],
        transport=transport,
    )
    cache = env.get("PLATFORM_CACHE_DIR")
    ctx = RunContext(run_id, client, api, Path(cache) if cache else None)
    received = api.input()
    execute(api, ctx, str(received["handler"]), received.get("input"))


def server_port(env: dict[str, str]) -> int:
    """Modal では 8080. kit dev は App ごとに `PLATFORM_SERVER_PORT` で分ける."""
    return int(env.get("PLATFORM_SERVER_PORT", SERVER_PORT))


def run_server(handler: str) -> None:
    """ASGI の app を負荷の計測で包んで待ち受ける (台数の判断に使う。§4.3)."""
    import uvicorn  # noqa: PLC0415 - サーバーを持つ App だけが依存に入れる

    meter = LoadMeter()
    # Platform の Sandbox だけが置き場所を渡す (kit dev の手元では書かない)
    if load_file := os.environ.get("PLATFORM_LOAD_FILE"):
        report_forever(meter, Path(load_file))
    host = "0.0.0.0"  # noqa: S104 - Modal の Tunnel から届く
    port = server_port(dict(os.environ))
    uvicorn.run(track(load(handler), meter), host=host, port=port, proxy_headers=True)


def task_exit_code() -> int:
    try:
        run_task(dict(os.environ), handle_signals=True)
    except (FdpocketError, KeyError):
        logger.exception("The runner could not report to the Platform")
        return 1
    return 0


def main(argv: list[str]) -> int:
    logging.basicConfig(level=logging.INFO)
    match argv[1:]:
        case ["server", handler]:
            run_server(handler)
            return 0
        case ["task"]:
            return task_exit_code()
        case _:
            logger.error(USAGE)
            return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv))
