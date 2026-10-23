"""タスクの handler が受ける文脈 (python-backend.md §6)."""

from dataclasses import dataclass, field
from pathlib import Path

from fdpocket.client import Ai, Client, Db, Jobs, Python
from fdpocket.runner_api import RunnerApi
from fdpocket.storage import Storage


@dataclass
class RunContext:
    """`def caption(ctx: RunContext, input: dict) -> dict` の `ctx`.

    - `db` / `storage`: この実行を依頼した利用者として読み書きする
      (cron から始まった実行は Project の持ち主。その人の権限と、python の App の
      `capabilities` の両方が要る)
    - `client`: python の App のサービスとして通知を送る
    - `ai` / `python`: この実行の払う人として Platform の AI・別のタスクを呼ぶ
    - `jobs`: 続きを jobs の App に渡す (そのジョブもこの実行の払う人が払う)
    - `cache_dir`: `/cache` (project.yaml の `cache: true`)。
      作り直せるキャッシュだけを置く
    """

    run_id: str
    client: Client
    _runner: RunnerApi = field(repr=False)
    cache_dir: Path | None = None

    @property
    def db(self) -> Db:
        return self.client.for_run(self.run_id).db

    @property
    def storage(self) -> Storage:
        return self.client.for_run(self.run_id).storage

    @property
    def ai(self) -> Ai:
        return self.client.for_run(self.run_id).ai

    @property
    def python(self) -> Python:
        return self.client.for_run(self.run_id).python

    @property
    def jobs(self) -> Jobs:
        return self.client.for_run(self.run_id).jobs

    def progress(self, fraction: float | None, message: str | None = None) -> None:
        """進み具合 (0〜1) を知らせる. 依頼した側の `get()` に最新の 1 件が出る."""
        self._runner.progress(fraction, message)
