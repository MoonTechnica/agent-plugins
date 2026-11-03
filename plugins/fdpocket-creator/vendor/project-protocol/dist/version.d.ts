/**
 * 契約番号（contract-compatibility.md §3）。
 *
 * ミニアプリの成果物は 1 つの SDK を焼き込むので、成果物が持つ版の数字も 1 つ。`project.yaml` の
 * `sdkVersion`、bridge の `hello.contract`、Gateway への `x-fdpocket-contract`、Project トークンの
 * `cv`、Realtime の frame がすべて同じ数字を運ぶ。再配備される側（Host・Gateway）は窓
 * （`SUPPORTED_CONTRACTS`）を持ち、窓の外は断る。
 *
 * 同じ番号の中では追加しかしない（`contracts/v<N>/` の凍結と `contract-evolution` の検査）。
 * 削除・型の変更・必須化は番号を上げる。
 */
export declare const CONTRACT_VERSION: 3;
/** 古い順。窓から外すときは `contracts/v<N>/` とその fixture を同じ変更で消す */
export declare const SUPPORTED_CONTRACTS: readonly [3];
export type ContractVersion = (typeof SUPPORTED_CONTRACTS)[number];
/** SDK → Gateway のすべてのリクエストに付ける（Stripe-Version と同じ役割） */
export declare const CONTRACT_HEADER = "x-fdpocket-contract";
export declare function isSupportedContract(value: unknown): value is ContractVersion;
