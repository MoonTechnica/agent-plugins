"""Gateway の失敗 (sdk.md §3.5 と同じコード)."""

GATEWAY_UNAVAILABLE = "GATEWAY_UNAVAILABLE"
UNAUTHENTICATED = "UNAUTHENTICATED"
PAYLOAD_TOO_LARGE = "PAYLOAD_TOO_LARGE"
RETRYABLE = frozenset({GATEWAY_UNAVAILABLE, "RATE_LIMITED"})


class FdpocketError(Exception):
    """Gateway が断った・届かなかった。`code` は SDK のエラーコード."""

    def __init__(self, code: str, message: str, *, status: int | None = None) -> None:
        super().__init__(f"{code}: {message}")
        self.code = code
        self.message = message
        self.status = status
        self.retryable = code in RETRYABLE
