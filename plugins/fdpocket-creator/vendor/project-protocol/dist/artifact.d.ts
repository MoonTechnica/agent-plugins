import { z } from 'zod';
/**
 * `kit build` の出力（`dist/`）の契約（sdk.md §5.1）。
 *
 * `dist/<slug>/` が App ごとの配信物。`dist/.artifact-index.json` はハッシュ一覧で、**一覧自身は
 * `artifact_hash` の計算に含めない**（含めると自己参照になる）。`kit pack` は一覧を `dist.tar.gz` に入れない
 * （取り込みが同じ関数で作り直す）。
 *
 * ## Artifact Hash の形式（v1。ゲーム基盤の `artifact-hash/v1` と同じ）
 *
 * ```text
 * artifact-hash/v1\n
 * <sha256>  <path>\n   ← path の昇順（UTF-8 のコードポイント順）
 * ```
 *
 * を UTF-8 にして sha256 を取り、小文字 16 進で返す。全体は `dist/` からの相対パス、App ごと
 * （`project_versions.artifact_apps`。data-model.md §3）は `dist/<slug>/` からの相対パスで計算する。
 * Kit・検証器・Host が同じ関数を使う（別々に実装すると同じ Artifact に別の hash が付く）。
 */
export declare const ARTIFACT_INDEX_PATH = ".artifact-index.json";
/** `kit build` / `kit dev` が各 App の Vite に渡す環境変数（`@workspace/miniapp-sdk/vite` が定数に埋める） */
export declare const KIT_BUILD_ENV: {
    readonly projectId: "MINIAPP_PROJECT_ID";
    readonly gatewayUrl: "MINIAPP_GATEWAY_URL";
};
export declare const ARTIFACT_HASH_VERSION = "artifact-hash/v1";
export declare const ARTIFACT_INDEX_VERSION = 1;
/** `dist/` の中の相対パス（`/` 区切り。空・`.`・`..` の段、先頭の `/`、`\`、制御文字は不可） */
export declare const artifactPathSchema: z.ZodString;
export declare const artifactFileSchema: z.ZodObject<{
    path: z.ZodString;
    sha256: z.ZodString;
    size: z.ZodNumber;
}, z.core.$strict>;
export type ArtifactFile = z.infer<typeof artifactFileSchema>;
export declare const artifactAppSchema: z.ZodObject<{
    entry: z.ZodString;
    artifactHash: z.ZodString;
    bytes: z.ZodNumber;
    fileCount: z.ZodNumber;
}, z.core.$strict>;
export type ArtifactApp = z.infer<typeof artifactAppSchema>;
export declare const artifactIndexSchema: z.ZodObject<{
    version: z.ZodLiteral<1>;
    artifactHash: z.ZodString;
    apps: z.ZodRecord<z.ZodString, z.ZodObject<{
        entry: z.ZodString;
        artifactHash: z.ZodString;
        bytes: z.ZodNumber;
        fileCount: z.ZodNumber;
    }, z.core.$strict>>;
    files: z.ZodArray<z.ZodObject<{
        path: z.ZodString;
        sha256: z.ZodString;
        size: z.ZodNumber;
    }, z.core.$strict>>;
}, z.core.$strict>;
export type ArtifactIndex = z.infer<typeof artifactIndexSchema>;
/** 1 ファイルの内容の sha256（小文字 16 進） */
export declare function hashArtifactFile(bytes: Uint8Array): Promise<string>;
/**
 * ハッシュ一覧から Artifact の hash を作る（入力の順に依らない）。
 *
 * @throws {Error} 空・不正なパス・重複・sha256 の形が違うとき（握りつぶすと中身と合わない hash が公開されうる）
 */
export declare function computeArtifactHash(files: readonly {
    path: string;
    sha256: string;
}[]): Promise<string>;
/**
 * `dist/` のファイル（`dist/` からの相対パス）からハッシュ一覧を作る。`apps` は project.yaml の App
 * （入口は `dist/` からの相対パス）。どの App にも属さないファイルと、入口の無い App は受け付けない。
 */
export declare function buildArtifactIndex(dist: readonly {
    path: string;
    bytes: Uint8Array;
}[], apps: readonly {
    slug: string;
    entry: string;
}[]): Promise<ArtifactIndex>;
