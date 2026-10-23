"""HTTP サーバーの負荷 (python-backend.md §4.3).

ランナーが ASGI の app を包み、同時に処理している要求の数を時間で重み付けして
平均し、10 秒ごとに Platform が渡した `PLATFORM_LOAD_FILE` (LOAD_FILE) へ書く
(直近 6 回 = 約 1 分の平均)。Platform の tick が Sandbox から読み、宣言した台数まで
足す判断と、余裕のある台へ要求を寄せる振り分けに使う。
"""

import json
import threading
import time
from collections import deque
from collections.abc import Awaitable, Callable
from pathlib import Path
from typing import Any

#: Platform が渡し、`cat` で読む場所 (backend-py の ModalComputeGateway.read_load)
LOAD_FILE = Path("/tmp/fdpocket-load.json")  # noqa: S108 - Sandbox の中だけの一時ファイル
SAMPLE_SECONDS = 10.0
SAMPLES = 6

Asgi = Callable[[Any, Any, Any], Awaitable[None]]


class LoadMeter:
    def __init__(
        self, clock: Callable[[], float] = time.monotonic, samples: int = SAMPLES
    ) -> None:
        self._clock = clock
        self._lock = threading.Lock()
        self._samples: deque[float] = deque(maxlen=samples)
        self.in_flight = 0
        self._area = 0.0
        self._since = self._last = clock()

    def _advance(self) -> float:
        now = self._clock()
        self._area += self.in_flight * (now - self._last)
        self._last = now
        return now

    def enter(self) -> None:
        with self._lock:
            self._advance()
            self.in_flight += 1

    def leave(self) -> None:
        with self._lock:
            self._advance()
            self.in_flight -= 1

    def sample(self) -> float:
        """前の標本からの平均を足し、直近の標本の平均を返す."""
        with self._lock:
            now = self._advance()
            elapsed = now - self._since
            average = self._area / elapsed if elapsed > 0 else float(self.in_flight)
            self._samples.append(average)
            self._area, self._since = 0.0, now
            return sum(self._samples) / len(self._samples)


def track(app: Asgi, meter: LoadMeter) -> Asgi:
    """Http / websocket の接続が続く間を 1 件として数える."""

    async def tracked(scope: Any, receive: Any, send: Any) -> None:  # noqa: ANN401 - ASGI
        if scope["type"] not in ("http", "websocket"):
            await app(scope, receive, send)
            return
        meter.enter()
        try:
            await app(scope, receive, send)
        finally:
            meter.leave()

    return tracked


def write_sample(meter: LoadMeter, path: Path = LOAD_FILE) -> None:
    path.write_text(json.dumps({"concurrency": round(meter.sample(), 3)}))


def report_forever(meter: LoadMeter, path: Path = LOAD_FILE) -> threading.Thread:
    """10 秒ごとに書く (サーバーと一緒に終わる daemon thread)."""

    def loop() -> None:
        while True:
            time.sleep(SAMPLE_SECONDS)
            write_sample(meter, path)

    thread = threading.Thread(target=loop, name="fdpocket-load", daemon=True)
    thread.start()
    return thread
