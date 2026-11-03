"""契約番号 (docs/designs/app-platform/contract-compatibility.md §3).

`project-protocol/src/version.ts` と同じ値. 成果物に焼き込まれ,
Gateway への全リクエストに付ける. frontend/policy のテストが TS 側との一致を確かめる.
"""

CONTRACT_VERSION = 3
CONTRACT_HEADER = "x-fdpocket-contract"
