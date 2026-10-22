/**
 * Gateway・SDK・Host・validator が共有する上限（sdk.md §3.2・§3.3、gateway.md §4.1、storage.md §4.1）。
 * 同じ値を各所に書かない。
 */
/** `findMany` の `take` の既定（SDK がクランプ） */
export const DB_TAKE_DEFAULT = 50;
/** `findMany` の `take` の最大（Gateway がクランプ） */
export const DB_TAKE_MAX = 200;
/** `include` のネストの深さ */
export const DB_INCLUDE_DEPTH_MAX = 3;
/** `createMany` の行数 */
export const DB_CREATE_MANY_MAX = 500;
/** 1 リクエストの本文 */
export const REQUEST_BODY_MAX_BYTES = 1024 * 1024;
/** 1 応答の本文 */
export const RESPONSE_BODY_MAX_BYTES = 5 * 1024 * 1024;
/** 1 ファイル（storage.md §4.4。100 MiB を超えるものは Multipart） */
export const STORAGE_FILE_MAX_BYTES = 5 * 1024 * 1024 * 1024;
/** 1 回の署名 PUT。これを超えると Multipart */
export const STORAGE_SINGLE_PUT_MAX_BYTES = 100 * 1024 * 1024;
/** Multipart の part（R2 は最後以外の part が同じ大きさであることを要求する。5 GiB で 320 part） */
export const STORAGE_MULTIPART_PART_BYTES = 16 * 1024 * 1024;
/** 1 回の要求で署名する part 数 */
export const STORAGE_MULTIPART_SIGN_MAX_PARTS = 100;
/** 1 Project の論理バケット数 */
export const PROJECT_BUCKETS_MAX = 10;
/** Whole-monorepo bound, independent of App kinds or names. */
export const PROJECT_APPS_MAX = 16;
/** `Idempotency-Key` を保持する秒数 */
export const IDEMPOTENCY_TTL_SECONDS = 10 * 60;
/** Project アクセストークンの寿命（gateway.md §3.2） */
export const PROJECT_TOKEN_TTL_SECONDS = 10 * 60;
/** Host が exchange をやり直す周期 */
export const PROJECT_TOKEN_REFRESH_SECONDS = 5 * 60;
/** 署名 PUT の寿命（storage.md §4.1） */
export const STORAGE_UPLOAD_URL_TTL_SECONDS = 10 * 60;
/** 署名 GET の寿命の範囲（storage.md §4.2） */
export const STORAGE_DOWNLOAD_URL_TTL_MIN_SECONDS = 60;
export const STORAGE_DOWNLOAD_URL_TTL_MAX_SECONDS = 300;
/** `dist` の上限（project-runtime.md §8。取り込みの検証が数える。`.artifact-index.json` は数えない） */
export const ARTIFACT_APP_MAX_BYTES = 50 * 1024 * 1024;
/** Static Assets hosting limit for one browser asset; unrelated to user uploads. */
export const ARTIFACT_FILE_MAX_BYTES = 25 * 1024 * 1024;
/** 版（全 App）の `dist` の合計 */
export const ARTIFACT_MAX_BYTES = 200 * 1024 * 1024;
/** 版のファイル数 */
export const ARTIFACT_MAX_FILES = 5000;
