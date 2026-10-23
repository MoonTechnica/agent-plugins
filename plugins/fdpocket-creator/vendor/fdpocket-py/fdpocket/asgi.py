"""HTTP サーバー (python-backend.md §4.3) の補助.

Platform の origin が利用者のトークンを確かめてから、
`X-Fdpocket-Authorization: Bearer <token>` に載せてサーバーへ転送する
(Authorization は Modal の Tunnel の資格情報に使う)。
"""

from collections.abc import Mapping

USER_TOKEN_HEADER = "x-fdpocket-authorization"  # noqa: S105 - ヘッダーの名前


def user_token(headers: Mapping[str, str]) -> str | None:
    """利用者の Project トークン (`client.as_user(token)` に渡す). 無ければ None."""
    value = next(
        (v for k, v in headers.items() if k.lower() == USER_TOKEN_HEADER), None
    )
    if value is None or not value.startswith("Bearer "):
        return None
    return value.removeprefix("Bearer ").strip() or None
