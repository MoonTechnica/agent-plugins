"""Gateway の失敗 (sdk.md §3.5 と同じコード)."""

GATEWAY_UNAVAILABLE = "GATEWAY_UNAVAILABLE"
UNAUTHENTICATED = "UNAUTHENTICATED"
PAYLOAD_TOO_LARGE = "PAYLOAD_TOO_LARGE"
#: 開発中の本物の GPU の実行 (ライブプレビュー・kit dev --python modal) には
#: サービスの資格情報が無い。DB・Storage・通知・jobs は main / prod の実行で使う
NOT_AVAILABLE_IN_DEVELOPMENT = "NOT_AVAILABLE_IN_DEVELOPMENT"
RETRYABLE = frozenset({GATEWAY_UNAVAILABLE, "RATE_LIMITED"})


class FdpocketError(Exception):
    """Gateway が断った・届かなかった。`code` は SDK のエラーコード."""

    def __init__(self, code: str, message: str, *, status: int | None = None) -> None:
        super().__init__(f"{code}: {message}")
        self.code = code
        self.message = message
        self.status = status
        self.retryable = code in RETRYABLE
