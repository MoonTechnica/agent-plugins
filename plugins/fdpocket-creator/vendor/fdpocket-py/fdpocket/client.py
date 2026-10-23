"""Gateway のサービスのクライアント (python-backend.md §6).

ミニアプリのタスク (PyTorch など) は同期のコードなので、SDK も同期
(httpx.Client) にする。ASGI のサーバーからは `def` のエンドポイント
(FastAPI はスレッドで動かす) から呼ぶ。
"""

import json
import os
import threading
import time
from collections.abc import Callable, Mapping
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any
from urllib.parse import quote

import httpx

from fdpocket._transport import UNREACHABLE, Transport, read
from fdpocket.errors import (
    GATEWAY_UNAVAILABLE,
    UNAUTHENTICATED,
    FdpocketError,
)
from fdpocket.storage import Storage

ACT_AS_HEADER = "x-act-as"
RUN_CONTEXT_HEADER = "x-fdpocket-run"
DB_TAKE_DEFAULT = 50
DB_TAKE_MAX = 200
FINAL_STATUSES = frozenset({"succeeded", "failed", "cancelled", "timed_out", "stopped"})
# 期限の 1 分前に取り直す (TS の SDK と同じ)
REFRESH_MARGIN = timedelta(minutes=1)
READS = (
    "findMany",
    "findUnique",
    "findFirst",
    "count",
    "aggregate",
    "groupBy",
    "exists",
)
DELETES = ("delete", "deleteMany")
UPDATES = ("update", "updateMany", "updateManyAndReturn")
BINDINGS_MISSING = "GATEWAY_URL and PLATFORM_SERVICE_CREDENTIAL are not set"


class ServiceToken:
    """`PLATFORM_SERVICE_CREDENTIAL` を 10 分のサービストークンに替える.

    期限の 1 分前に取り直す。
    """

    def __init__(self, http: httpx.Client, base: str, credential: str) -> None:
        self._http = http
        self._base = base
        self._credential = credential
        self._token: tuple[str, datetime] | None = None
        self._lock = threading.Lock()

    def __call__(self) -> str:
        with self._lock:
            if self._token is None or self._expiring(self._token[1]):
                self._token = self._exchange()
            return self._token[0]

    @staticmethod
    def _expiring(expires: datetime) -> bool:
        return expires - REFRESH_MARGIN <= datetime.now(UTC)

    def _exchange(self) -> tuple[str, datetime]:
        try:
            response = self._http.post(
                f"{self._base}/v1/token/service",
                headers={"authorization": f"Bearer {self._credential}"},
            )
        except httpx.HTTPError as error:
            raise FdpocketError(GATEWAY_UNAVAILABLE, UNREACHABLE) from error
        body = read(response)
        return str(body["token"]), datetime.fromisoformat(str(body["expiresAt"]))


class Db:
    """`client.db`. ZenStack の RPC の形で `/v1/db/{model}/{op}` に送る.

    権限は Gateway が判定する。値は JSON のまま (日時は ISO 8601 の文字列)。
    """

    def __init__(self, transport: Transport) -> None:
        self._transport = transport

    def call(self, model: str, op: str, args: Mapping[str, Any] | None = None) -> Any:  # noqa: ANN401 - ZenStack の結果をそのまま返す
        payload = dict(args or {})
        if op == "findMany":
            payload["take"] = clamp_take(payload.get("take"))
        path = f"/v1/db/{quote(model[:1].lower() + model[1:])}/{op}"
        if op in READS or op in DELETES:
            params = {"q": json.dumps(payload, separators=(",", ":"))}
            method = "GET" if op in READS else "DELETE"
            return self._transport.send(method, path, params=params)["data"]
        method = "PUT" if op in UPDATES else "POST"
        return self._transport.send(method, path, body=payload)["data"]

    def find_many(self, model: str, **args: Any) -> Any:  # noqa: ANN401
        return self.call(model, "findMany", args)

    def find_first(self, model: str, **args: Any) -> Any:  # noqa: ANN401
        return self.call(model, "findFirst", args)

    def find_unique(self, model: str, **args: Any) -> Any:  # noqa: ANN401
        return self.call(model, "findUnique", args)

    def count(self, model: str, **args: Any) -> Any:  # noqa: ANN401
        return self.call(model, "count", args)

    def create(self, model: str, **args: Any) -> Any:  # noqa: ANN401
        return self.call(model, "create", args)

    def update(self, model: str, **args: Any) -> Any:  # noqa: ANN401
        return self.call(model, "update", args)

    def delete(self, model: str, **args: Any) -> Any:  # noqa: ANN401
        return self.call(model, "delete", args)


def clamp_take(take: object) -> int:
    """既定 50・最大 200 (Gateway も同じくクランプする)."""
    value = take if isinstance(take, int) else DB_TAKE_DEFAULT
    return max(-DB_TAKE_MAX, min(value, DB_TAKE_MAX))


class Notifications:
    def __init__(self, transport: Transport) -> None:
        self._transport = transport

    def send(
        self,
        *,
        template: str,
        to: list[str],
        params: Mapping[str, str | int | float | bool],
        dedupe_key: str | None = None,
    ) -> Any:  # noqa: ANN401 - Gateway の応答
        body: dict[str, object] = {
            "template": template,
            "to": to,
            "params": dict(params),
        }
        if dedupe_key is not None:
            body["dedupeKey"] = dedupe_key
        return self._transport.send("POST", "/v1/notifications/send", body=body)


class Jobs:
    """`client.jobs`. 同じ環境の jobs の App にジョブを登録する (main / prod だけ).

    python の App の `servicePermissions` に `jobs.schedule`、宛先の jobs の App に
    `jobs.consume` が要る。ジョブの中の AI・python は、登録した文脈の払う人が払う
    (`ctx.jobs` はその実行の払う人、`as_user(...)` はその利用者。サービスとしての
    登録では使えない)。
    """

    def __init__(self, transport: Transport) -> None:
        self._transport = transport

    def schedule(
        self,
        app: str,
        handler: str,
        payload: object,
        *,
        idempotency_key: str,
        run_at: datetime | None = None,
    ) -> dict[str, Any]:
        """Payload は JSON で 64 KiB まで. run_at は 30 日先まで."""
        body: dict[str, object] = {
            "app": app,
            "handler": handler,
            "payload": payload,
            "idempotencyKey": idempotency_key,
        }
        if run_at is not None:
            body["runAt"] = run_at.astimezone(UTC).isoformat().replace("+00:00", "Z")
        result: dict[str, Any] = self._transport.send(
            "POST", "/v1/jobs/schedule", body=body
        )
        return result

    def cancel(self, job_id: str) -> dict[str, Any]:
        """まだ始まっていないジョブだけ取り消せる."""
        result: dict[str, Any] = self._transport.send(
            "POST", "/v1/jobs/cancel", body={"id": job_id}
        )
        return result


@dataclass
class RunHandle:
    """依頼した python のタスク. `wait()` で終わるまで待つ."""

    run_id: str
    _python: "Python"

    def get(self) -> dict[str, Any]:
        return self._python.get(self.run_id)

    def cancel(self) -> dict[str, Any]:
        return self._python.cancel(self.run_id)

    def wait(self, *, timeout: float = 3600, interval: float = 2) -> dict[str, Any]:
        deadline = time.monotonic() + timeout
        run = self.get()
        while run["status"] not in FINAL_STATUSES:
            self._check_deadline(deadline, timeout)
            self._python.sleep(interval)
            run = self.get()
        return run

    def _check_deadline(self, deadline: float, timeout: float) -> None:
        if time.monotonic() >= deadline:
            message = f"run {self.run_id} did not finish in {timeout} seconds"
            raise TimeoutError(message)


class Python:
    """`client.python`. 同じ Project の python の App のタスクを依頼する."""

    def __init__(self, transport: Transport, sleep: Callable[[float], None]) -> None:
        self._transport = transport
        self.sleep = sleep

    def run(
        self,
        app: str,
        task: str,
        input: object,  # noqa: A002 - Gateway の契約の名前
        *,
        idempotency_key: str | None = None,
    ) -> RunHandle:
        body: dict[str, object] = {"app": app, "task": task, "input": input}
        if idempotency_key is not None:
            body["idempotencyKey"] = idempotency_key
        accepted = self._transport.send("POST", "/v1/python/runs", body=body)
        return RunHandle(str(accepted["runId"]), self)

    def get(self, run_id: str) -> dict[str, Any]:
        path = f"/v1/python/runs/{run_id}"
        result: dict[str, Any] = self._transport.send("GET", path)
        return result

    def cancel(self, run_id: str) -> dict[str, Any]:
        path = f"/v1/python/runs/{run_id}/cancel"
        result: dict[str, Any] = self._transport.send("POST", path)
        return result


class Ai:
    """Platform の AI (OpenAI 互換). OpenAI SDK・LangChain にそのまま渡す."""

    def __init__(self, transport: Transport, wire: httpx.BaseTransport | None) -> None:
        self._transport = transport
        self._wire = wire

    def openai(self) -> dict[str, Any]:
        """`OpenAI(**client.ai.openai())` / `ChatOpenAI(**...)` の引数.

        トークンは 10 分で切れるので、`http_client` が送るたびに付け直す
        (`api_key` は使われない)。
        """
        http = httpx.Client(
            auth=_BearerAuth(self._transport.token),
            timeout=httpx.Timeout(600),
            transport=self._wire,
        )
        return {
            "base_url": f"{self._transport.base}/v1/ai/openai",
            "api_key": "fdpocket",
            "default_headers": dict(self._transport.headers),
            "http_client": http,
        }


class _BearerAuth(httpx.Auth):
    def __init__(self, token: Callable[[], str]) -> None:
        self._token = token

    def auth_flow(self, request: httpx.Request) -> Any:  # noqa: ANN401 - generator
        request.headers["authorization"] = f"Bearer {self._token()}"
        yield request


class UserClient:
    """`client.as_user(token)`. その利用者として呼ぶ (払うのはその利用者)."""

    def __init__(
        self,
        transport: Transport,
        http: httpx.Client,
        wire: httpx.BaseTransport | None,
        sleep: Callable[[float], None],
    ) -> None:
        self.db = Db(transport)
        self.storage = Storage(transport, http)
        self.ai = Ai(transport, wire)
        self.python = Python(transport, sleep)
        self.jobs = Jobs(transport)


class RunClient:
    """`client.for_run(run_id)`. 動いているタスクとして呼ぶ.

    払うのはその実行の払う人。
    """

    def __init__(
        self,
        transport: Transport,
        wire: httpx.BaseTransport | None,
        sleep: Callable[[float], None],
    ) -> None:
        self.ai = Ai(transport, wire)
        self.python = Python(transport, sleep)
        self.jobs = Jobs(transport)


class Client:
    """サービスとして Gateway を呼ぶ (python の App の `servicePermissions` の範囲)."""

    def __init__(
        self,
        *,
        gateway_url: str,
        credential: str,
        transport: httpx.BaseTransport | None = None,
        sleep: Callable[[float], None] = time.sleep,
    ) -> None:
        # transport はテストで差し替える I/O の境界 (AI の http_client も同じものを使う)
        self._wire = transport
        self._http = httpx.Client(timeout=httpx.Timeout(60), transport=transport)
        base = gateway_url.rstrip("/")
        token = ServiceToken(self._http, base, credential)
        self._transport = Transport(self._http, base, token)
        self._sleep = sleep
        self.db = Db(self._transport)
        self.storage = Storage(self._transport, self._http)
        self.notifications = Notifications(self._transport)
        self.python = Python(self._transport, sleep)
        self.jobs = Jobs(self._transport)

    @classmethod
    def from_env(cls) -> "Client":
        """Sandbox の `GATEWAY_URL` と `PLATFORM_SERVICE_CREDENTIAL` から作る."""
        gateway = os.environ.get("GATEWAY_URL")
        credential = os.environ.get("PLATFORM_SERVICE_CREDENTIAL")
        if not gateway or not credential:
            raise FdpocketError(UNAUTHENTICATED, BINDINGS_MISSING)
        return cls(gateway_url=gateway, credential=credential)

    def as_user(self, token: str) -> UserClient:
        transport = self._transport.with_headers({ACT_AS_HEADER: token})
        return UserClient(transport, self._http, self._wire, self._sleep)

    def for_run(self, run_id: str) -> RunClient:
        header = {RUN_CONTEXT_HEADER: f"python:{run_id}"}
        return RunClient(self._transport.with_headers(header), self._wire, self._sleep)
