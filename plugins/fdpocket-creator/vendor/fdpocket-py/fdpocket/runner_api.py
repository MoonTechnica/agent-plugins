"""ランナーの Gateway の経路 (`/v1/python/runner/{run_id}/...`).

資格情報は実行ごとの `PLATFORM_RUN_TOKEN`。
"""

from typing import Any

import httpx

from fdpocket._transport import Transport


class RunnerApi:
    def __init__(
        self, http: httpx.Client, gateway: str, run_id: str, token: str
    ) -> None:
        self._transport = Transport(http, gateway, lambda: token)
        self._path = f"/v1/python/runner/{run_id}"

    def input(self) -> dict[str, Any]:
        result: dict[str, Any] = self._transport.send("POST", f"{self._path}/input")
        return result

    def progress(self, fraction: float | None, message: str | None) -> None:
        body: dict[str, object] = {"progress": fraction}
        if message is not None:
            body["message"] = message[:200]
        self._transport.send("POST", f"{self._path}/progress", body=body)

    def succeed(self, output: object) -> None:
        body = {"succeeded": True, "output": output}
        self._finish(body)

    def fail(self, code: str, message: str) -> None:
        error = {"code": code[:64], "message": message[:500]}
        self._finish({"succeeded": False, "error": error})

    def interrupted(self) -> None:
        """外からの停止の合図を受けた (Platform が止めたのでなければ GPU の途中停止)."""
        self._transport.send("POST", f"{self._path}/interrupted")

    def _finish(self, body: dict[str, object]) -> None:
        self._transport.send("POST", f"{self._path}/finish", body=body)
