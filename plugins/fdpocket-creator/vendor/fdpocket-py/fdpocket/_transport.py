"""Gateway への送信.

失敗はすべて FdpocketError にする (5xx・届かないは GATEWAY_UNAVAILABLE)。
"""

from collections.abc import Callable, Mapping
from typing import Any

import httpx

from fdpocket.errors import GATEWAY_UNAVAILABLE, FdpocketError

HTTP_SERVER_ERROR = 500
HTTP_NO_CONTENT = 204
UNREACHABLE = "gateway is unreachable"
# 本文が読めないときの status → コード
# (project-protocol の sdkErrorCodeForStatus と同じ)
CODE_BY_STATUS = {
    400: "VALIDATION_FAILED",
    401: "UNAUTHENTICATED",
    403: "FORBIDDEN",
    404: "NOT_FOUND",
    409: "CONFLICT",
    413: "PAYLOAD_TOO_LARGE",
    422: "VALIDATION_FAILED",
    429: "RATE_LIMITED",
}


class Transport:
    """認証のヘッダーと文脈のヘッダーを付けて Gateway に JSON を送る."""

    def __init__(
        self,
        http: httpx.Client,
        base: str,
        token: Callable[[], str],
        headers: Mapping[str, str] | None = None,
    ) -> None:
        self.http = http
        self.base = base.rstrip("/")
        self.token = token
        self.headers = dict(headers or {})

    def with_headers(self, headers: Mapping[str, str]) -> "Transport":
        merged = {**self.headers, **headers}
        return Transport(self.http, self.base, self.token, merged)

    def send(
        self,
        method: str,
        path: str,
        *,
        body: object = None,
        params: Mapping[str, str] | None = None,
    ) -> Any:  # noqa: ANN401 - Gateway の JSON をそのまま返す
        headers = {**self.headers, "authorization": f"Bearer {self.token()}"}
        try:
            response = self.http.request(
                method, f"{self.base}{path}", headers=headers, params=params, json=body
            )
        except httpx.HTTPError as error:
            raise FdpocketError(GATEWAY_UNAVAILABLE, UNREACHABLE) from error
        return read(response)


def read(response: httpx.Response) -> Any:  # noqa: ANN401 - 応答の JSON
    if not response.is_success:
        raise error_of(response)
    if response.status_code == HTTP_NO_CONTENT or not response.content:
        return None
    return response.json()


def error_of(response: httpx.Response) -> FdpocketError:
    status = response.status_code
    if status >= HTTP_SERVER_ERROR:
        return FdpocketError(GATEWAY_UNAVAILABLE, "gateway failed", status=status)
    try:
        error = response.json()["error"]
        return FdpocketError(str(error["code"]), str(error["message"]), status=status)
    except (ValueError, KeyError, TypeError):
        code = CODE_BY_STATUS.get(status, GATEWAY_UNAVAILABLE)
        return FdpocketError(code, response.text[:200], status=status)
