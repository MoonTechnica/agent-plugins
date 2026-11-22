"""`get_work_order` から、`close_work` の verdict の下書きを規則どおりに作る.

    python3 <SKILL_DIR>/scripts/verdict_draft.py <work_order.json> [--json]

## 何のためにあるか

判定のうち**規則で決まる部分**を手でやると、古い pass を根拠にする・warn の fail で
`ok` を落とす・根拠に数字を書き写し損ねる、が起きる (SKILL.md §2・§5)。ここは
その部分だけを組み、目で見る基準は「要判断」で残す。

- 根拠に使うのは**いまの本文・いまの書き出し**の結果だけ
  (L0 / L1 は `subject_seq == head_seq`、L2 / L3 は `subject_id == render_id`)
- 合否は `block` の基準だけで決まる。`warn` の `fail` は書き残すが `ok` は落とさない
- `intent` / `uses_reference` / 層が `reviewer` の基準は `needs_judgment`
  (コンタクトシートと出自を自分で見て埋める)

## 入れるもの

`get_work_order(run_id)` の戻り値 (JSON)。**自分で回した `hyperframes check` を
`record_check` してから** `get_work_order` を引き直すと、L1 がいまの結果になる。

## 出すもの

`verdict` (`ok` と `criteria[]`)・`needs_judgment`・使わなかった古い結果の数。
`ready=false` なら `close` (`outcome: failed` と理由) だけ。`ok` が `null` は
「block に要判断が残っている」。

標準ライブラリだけ。終了コード: 0 = 下書きで決まった / 1 = 要判断か不合格 /
2 = 読めなかった.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

#: 自分の目が要る基準 (SKILL.md §2)
JUDGED_KINDS = frozenset({"intent", "uses_reference"})
#: 本文に対する層 / 書き出しに対する層
DOCUMENT_LAYERS = frozenset({"L0_lint", "L1_check"})
RENDER_LAYERS = frozenset({"L2_media", "L3_vlm"})
#: 根拠の頭に付ける層の名前 (SKILL.md §4「L2: duration 178.2s」)
LAYER_TAGS = {"L0_lint": "L0", "L1_check": "L1", "L2_media": "L2", "L3_vlm": "L3"}


def _fresh(v: dict[str, Any], head_seq: object, render_id: object) -> bool:
    layer = v.get("layer")
    if layer in DOCUMENT_LAYERS:
        return v.get("subject_seq") == head_seq
    if layer in RENDER_LAYERS:
        return v.get("subject_kind") == "render" and v.get("subject_id") == render_id
    return False


def _latest_by_layer(fresh: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    ordered = sorted(fresh, key=lambda v: str(v.get("created_at") or ""))
    return {str(v["layer"]): v for v in ordered}


def _result(
    criterion: dict[str, Any], layers: dict[str, dict[str, Any]]
) -> dict[str, str]:
    cid = str(criterion["id"])
    if criterion.get("kind") in JUDGED_KINDS or criterion.get("layer") == "reviewer":
        return {"criterion_id": cid, "status": "needs_judgment", "evidence": ""}
    layer = str(criterion.get("layer"))
    found = next(
        (
            r
            for r in (layers.get(layer) or {}).get("criteria_results") or []
            if r.get("criterion_id") == cid
        ),
        None,
    )
    if found is None:
        return {
            "criterion_id": cid,
            "status": "missing",
            "evidence": f"いまの対象に {LAYER_TAGS.get(layer, layer)} の結果が無い",
        }
    tag = LAYER_TAGS.get(layer, layer)
    return {
        "criterion_id": cid,
        "status": str(found.get("status")),
        "evidence": f"{tag}: {found.get('evidence') or found.get('status')}",
    }


def _ok(criteria: list[dict[str, Any]], results: list[dict[str, str]]) -> bool | None:
    blocks = [
        r["status"] for c, r in zip(criteria, results) if c.get("severity") == "block"
    ]
    if any(status not in {"pass", "needs_judgment"} for status in blocks):
        return False
    return None if "needs_judgment" in blocks else True


def draft(order: dict[str, Any]) -> dict[str, Any]:
    if not order.get("ready", True):
        reason = "; ".join(order.get("blocked_by") or []) or "not ready"
        return {"close": {"outcome": "failed", "failure_reason": reason}}
    deliverable = order.get("deliverable") or {}
    head, render = deliverable.get("head_seq"), deliverable.get("render_id")
    verifications = deliverable.get("verifications") or []
    fresh = [v for v in verifications if _fresh(v, head, render)]
    criteria = deliverable.get("criteria") or []
    results = [_result(c, _latest_by_layer(fresh)) for c in criteria]
    return {
        "verdict": {"ok": _ok(criteria, results), "criteria": results},
        "needs_judgment": [
            r["criterion_id"] for r in results if r["status"] == "needs_judgment"
        ],
        "stale": len(verifications) - len(fresh),
    }


def _summary(out: dict[str, Any]) -> str:
    if "close" in out:
        return f"close_work(outcome=failed): {out['close']['failure_reason']}"
    rows = [
        f"{c['criterion_id']}: {c['status']} {c['evidence']}".rstrip()
        for c in out["verdict"]["criteria"]
    ]
    return "\n".join(
        [f"ok = {out['verdict']['ok']} (古い結果 {out['stale']} 件を除外)", *rows]
    )


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=(__doc__ or "").splitlines()[0])
    parser.add_argument("order", help="get_work_order の JSON (- で標準入力)")
    parser.add_argument("--json", action="store_true", help="JSON で出す")
    args = parser.parse_args(argv)
    try:
        raw = (
            sys.stdin.read()
            if args.order == "-"
            else Path(args.order).read_text("utf-8")
        )
        order = json.loads(raw)
    except (OSError, ValueError) as exc:
        print(f"読めなかった: {exc}", file=sys.stderr)
        return 2
    out = draft(order)
    print(json.dumps(out, ensure_ascii=False) if args.json else _summary(out))
    return 0 if out.get("verdict", {}).get("ok") is True else 1


if __name__ == "__main__":
    sys.exit(main())
