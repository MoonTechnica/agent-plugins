/**
 * Gateway・SDK・Host・validator が共有する上限（sdk.md §3.2・§3.3、gateway.md §4.1、storage.md §4.1）。
 * 同じ値を各所に書かない。
 */
/** `findMany` の `take` の既定（SDK がクランプ） */
export declare const DB_TAKE_DEFAULT = 50;
/** `findMany` の `take` の最大（Gateway がクランプ） */
export declare const DB_TAKE_MAX = 200;
/** `include` のネストの深さ */
export declare const DB_INCLUDE_DEPTH_MAX = 3;
/** `createMany` の行数 */
export declare const DB_CREATE_MANY_MAX = 500;
/** 1 リクエストの本文 */
export declare const REQUEST_BODY_MAX_BYTES: number;
/** 1 応答の本文 */
export declare const RESPONSE_BODY_MAX_BYTES: number;
/** 1 ファイル（Multipart は P3） */
export declare const STORAGE_FILE_MAX_BYTES: number;
/** 1 Project の論理バケット数 */
export declare const PROJECT_BUCKETS_MAX = 10;
/** Whole-monorepo bound, independent of App kinds or names. */
export declare const PROJECT_APPS_MAX = 16;
/** `Idempotency-Key` を保持する秒数 */
export declare const IDEMPOTENCY_TTL_SECONDS: number;
/** Project アクセストークンの寿命（gateway.md §3.2） */
export declare const PROJECT_TOKEN_TTL_SECONDS: number;
/** Host が exchange をやり直す周期 */
export declare const PROJECT_TOKEN_REFRESH_SECONDS: number;
/** 署名 PUT の寿命（storage.md §4.1） */
export declare const STORAGE_UPLOAD_URL_TTL_SECONDS: number;
/** 署名 GET の寿命の範囲（storage.md §4.2） */
export declare const STORAGE_DOWNLOAD_URL_TTL_MIN_SECONDS = 60;
export declare const STORAGE_DOWNLOAD_URL_TTL_MAX_SECONDS = 300;
/** `dist` の上限（project-runtime.md §8。取り込みの検証が数える。`.artifact-index.json` は数えない） */
export declare const ARTIFACT_APP_MAX_BYTES: number;
/** Static Assets hosting limit for one browser asset; unrelated to user uploads. */
export declare const ARTIFACT_FILE_MAX_BYTES: number;
/** 版（全 App）の `dist` の合計 */
export declare const ARTIFACT_MAX_BYTES: number;
/** 版のファイル数 */
export declare const ARTIFACT_MAX_FILES = 5000;
