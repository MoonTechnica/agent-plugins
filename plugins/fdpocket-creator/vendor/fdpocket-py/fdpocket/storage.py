"""`client.storage`: Storage のファイルの受け渡し.

python-backend.md §6・storage.md §4.4。大きな教師データはディスクへ流し込み
(メモリに載せない)、学習の結果 (重みなど) は 100 MiB を超えたら Multipart で上げる。
TS の SDK と同じ契約: 16 MiB の part を同時 4 本、署名は 100 個ずつ、届かない・5xx は
同じ URL で、署名切れ (403) は取り直して、part ごとに 3 回まで。
"""

import os
import threading
from collections.abc import Iterable
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Any, BinaryIO
from urllib.parse import quote

import httpx

from fdpocket._transport import Transport
from fdpocket.errors import GATEWAY_UNAVAILABLE, FdpocketError

#: 同時に送る part・同時に落とすファイルの数
WORKERS = 4
PART_ATTEMPTS = 3
SIGN_BATCH = 100
#: ディスクへ書く単位
CHUNK_BYTES = 1024 * 1024
HTTP_FORBIDDEN = 403
HTTP_SERVER_ERROR = 500
TRANSFER_FAILED = "storage transfer failed"
#: 署名 URL の転送は大きいので、読み書きの待ちだけ長くする
TRANSFER_TIMEOUT = httpx.Timeout(30.0, read=300.0, write=300.0)


def transfer_error(status: int) -> FdpocketError:
    """R2 への転送の失敗. 5xx は届かないのと同じく、やり直せる."""
    code = GATEWAY_UNAVAILABLE if status >= HTTP_SERVER_ERROR else "TRANSFER_FAILED"
    return FdpocketError(code, TRANSFER_FAILED, status=status)


class Source:
    """上げる中身 (bytes かファイル). part ごとに読む."""

    def __init__(self, data: bytes | str | os.PathLike[str]) -> None:
        self._data = data if isinstance(data, bytes) else None
        self._path = None if isinstance(data, bytes) else Path(data)
        self.size = len(data) if isinstance(data, bytes) else Path(data).stat().st_size

    def read(self, offset: int, length: int) -> bytes:
        if self._data is not None:
            return self._data[offset : offset + length]
        with Path(str(self._path)).open("rb") as file:
            file.seek(offset)
            return file.read(length)


class Storage:
    def __init__(self, transport: Transport, http: httpx.Client) -> None:
        self._transport = transport
        self._http = http

    def download_url(self, file_id: str) -> str:
        path = f"/v1/storage/files/{quote(file_id)}/download"
        url = str(self._transport.send("GET", path)["url"])
        return f"{self._transport.base}{url}" if url.startswith("/") else url

    def download(self, file_id: str) -> bytes:
        """小さなファイルだけ (全部をメモリに読む). 大きなものは `download_to`."""
        response = self._http.get(self.download_url(file_id))
        return response.raise_for_status().content

    def download_to(self, file_id: str, path: str | os.PathLike[str]) -> Path:
        """ディスクへ流し込む (メモリに載せない).

        途中で落ちても、壊れたファイルを残さない (`.part` に書いてから置き換える)。
        """
        target = Path(path)
        target.parent.mkdir(parents=True, exist_ok=True)
        partial = target.with_name(f"{target.name}.part")
        url = self.download_url(file_id)
        with self._http.stream("GET", url, timeout=TRANSFER_TIMEOUT) as response:
            if not response.is_success:
                raise transfer_error(response.status_code)
            _write(response.iter_bytes(CHUNK_BYTES), partial)
        partial.replace(target)
        return target

    def download_all(
        self, file_ids: Iterable[str], directory: str | os.PathLike[str]
    ) -> dict[str, Path]:
        """教師データのシャードなどを `directory/<fileId>` に落とす (同時 4 本)."""
        root = Path(directory)
        ids = list(dict.fromkeys(file_ids))
        with ThreadPoolExecutor(max_workers=WORKERS) as pool:
            paths = pool.map(
                lambda file_id: self.download_to(file_id, root / file_id), ids
            )
            return dict(zip(ids, paths, strict=True))

    def upload(
        self,
        bucket: str,
        name: str,
        data: bytes | str | os.PathLike[str],
        content_type: str,
        *,
        workspace_id: str | None = None,
    ) -> Any:  # noqa: ANN401 - 保存したファイルの情報
        """Bytes かファイルのパスを上げる.

        100 MiB を超えれば Multipart (ファイルから part ずつ読む)。
        """
        source = Source(data)
        body: dict[str, object] = {
            "name": name,
            "contentType": content_type,
            "expectedSize": source.size,
        }
        if workspace_id is not None:
            body["workspaceId"] = workspace_id
        begun = self._transport.send(
            "POST", f"/v1/storage/{quote(bucket)}/uploads", body=body
        )
        complete = self._send(begun, source)
        path = f"/v1/storage/uploads/{quote(str(begun['uploadId']))}/complete"
        return self._transport.send("POST", path, body=complete)["file"]

    def _send(self, begun: dict[str, Any], source: Source) -> dict[str, str]:
        if "multipart" not in begun:
            headers = begun["headers"]
            content = source.read(0, source.size)
            response = self._http.put(
                str(begun["url"]), content=content, headers=headers
            )
            if not response.is_success:
                raise transfer_error(response.status_code)
            return {}
        Parts(self._transport, self._http, begun, source).send()
        return {"r2UploadId": str(begun["multipart"]["r2UploadId"])}


def give_up_unless_retryable(status: int, attempt: int) -> None:
    """届かない・5xx・署名切れ (403) は回数の内ならやり直す. それ以外は投げる."""
    again = status == HTTP_FORBIDDEN or status >= HTTP_SERVER_ERROR
    if not again or attempt >= PART_ATTEMPTS:
        raise transfer_error(status)


def _write(chunks: Iterable[bytes], partial: Path) -> None:
    with partial.open("wb") as file:
        _copy(chunks, file)


def _copy(chunks: Iterable[bytes], file: BinaryIO) -> None:
    file.writelines(chunks)


class Parts:
    """1 つの Multipart の upload.

    part を同時 4 本で送る。送れなければ abort して投げる。
    """

    def __init__(
        self,
        transport: Transport,
        http: httpx.Client,
        begun: dict[str, Any],
        source: Source,
    ) -> None:
        self._transport = transport
        self._http = http
        self._source = source
        self._uploads = f"/v1/storage/uploads/{quote(str(begun['uploadId']))}"
        multipart = begun["multipart"]
        self._r2_upload_id = str(multipart["r2UploadId"])
        self._part_size = int(multipart["partSize"])
        self._count = int(multipart["partCount"])
        self._signed: dict[int, str] = {}
        self._lock = threading.Lock()

    def send(self) -> None:
        try:
            with ThreadPoolExecutor(max_workers=WORKERS) as pool:
                list(pool.map(self._part, range(1, self._count + 1)))
        except Exception:
            self._abort()
            raise

    def _part(self, number: int) -> None:
        offset = (number - 1) * self._part_size
        content = self._source.read(offset, self._part_size)
        renew = False
        for attempt in range(1, PART_ATTEMPTS + 1):
            status = self._put(self._url(number, renew=renew), content)
            if status is None:
                return
            give_up_unless_retryable(status, attempt)
            renew = status == HTTP_FORBIDDEN

    def _put(self, url: str, content: bytes) -> int | None:
        """送れたら None、だめなら status (届かなければ 5xx と同じに扱う)."""
        try:
            response = self._http.put(url, content=content, timeout=TRANSFER_TIMEOUT)
        except httpx.HTTPError:
            return HTTP_SERVER_ERROR
        return None if response.is_success else response.status_code

    def _url(self, number: int, *, renew: bool) -> str:
        with self._lock:
            if renew or number not in self._signed:
                self._sign([number] if renew else self._batch(number))
            return self._signed[number]

    def _batch(self, number: int) -> list[int]:
        first = (number - 1) // SIGN_BATCH * SIGN_BATCH + 1
        return list(range(first, min(first + SIGN_BATCH, self._count + 1)))

    def _sign(self, numbers: list[int]) -> None:
        body = {"r2UploadId": self._r2_upload_id, "partNumbers": numbers}
        signed = self._transport.send("POST", f"{self._uploads}/parts", body=body)
        for part in signed["parts"]:
            self._signed[int(part["partNumber"])] = str(part["url"])

    def _abort(self) -> None:
        # 送れなくても元のエラーを優先する。
        # 残った upload は Gateway の掃除 (24 時間後) が消す
        try:
            body = {"r2UploadId": self._r2_upload_id}
            self._transport.send("DELETE", self._uploads, body=body)
        except FdpocketError:
            return
