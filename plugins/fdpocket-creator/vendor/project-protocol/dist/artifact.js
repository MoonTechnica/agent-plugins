import { z } from 'zod';
import { APP_SLUG_PATTERN } from "./manifest.js";
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
export const ARTIFACT_INDEX_PATH = '.artifact-index.json';
/** `kit build` / `kit dev` が各 App の Vite に渡す環境変数（`@workspace/miniapp-sdk/vite` が定数に埋める） */
export const KIT_BUILD_ENV = {
    projectId: 'MINIAPP_PROJECT_ID',
    gatewayUrl: 'MINIAPP_GATEWAY_URL',
};
export const ARTIFACT_HASH_VERSION = 'artifact-hash/v1';
export const ARTIFACT_INDEX_VERSION = 1;
const SHA256_HEX = /^[0-9a-f]{64}$/;
/** `dist/` の中の相対パス（`/` 区切り。空・`.`・`..` の段、先頭の `/`、`\`、制御文字は不可） */
export const artifactPathSchema = z
    .string()
    .min(1)
    .max(1024)
    .refine((path) => !path.startsWith('/') &&
    !path.includes('\\') &&
    // biome-ignore lint/suspicious/noControlCharactersInRegex: 制御文字を拒むための正規表現
    !/[\u0000-\u001f\u007f]/.test(path) &&
    path.split('/').every((segment) => segment !== '' && segment !== '.' && segment !== '..'), { message: 'not a relative path inside dist/' });
const sha256Schema = z.string().regex(SHA256_HEX);
export const artifactFileSchema = z.strictObject({
    path: artifactPathSchema,
    sha256: sha256Schema,
    size: z.number().int().nonnegative(),
});
export const artifactAppSchema = z.strictObject({
    /** 入口（`dist/` からの相対パス。例 `web/index.html`） */
    entry: artifactPathSchema,
    artifactHash: sha256Schema,
    bytes: z.number().int().nonnegative(),
    fileCount: z.number().int().positive(),
});
export const artifactIndexSchema = z.strictObject({
    version: z.literal(ARTIFACT_INDEX_VERSION),
    artifactHash: sha256Schema,
    apps: z.record(z.string().regex(APP_SLUG_PATTERN), artifactAppSchema),
    files: z.array(artifactFileSchema),
});
const byPath = (a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0;
async function sha256Hex(bytes) {
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
/** 1 ファイルの内容の sha256（小文字 16 進） */
export function hashArtifactFile(bytes) {
    return sha256Hex(bytes);
}
/**
 * ハッシュ一覧から Artifact の hash を作る（入力の順に依らない）。
 *
 * @throws {Error} 空・不正なパス・重複・sha256 の形が違うとき（握りつぶすと中身と合わない hash が公開されうる）
 */
export async function computeArtifactHash(files) {
    if (files.length === 0)
        throw new Error('artifact: an artifact must contain at least one file');
    const seen = new Set();
    for (const file of files) {
        if (!artifactPathSchema.safeParse(file.path).success) {
            throw new Error(`artifact: invalid path "${file.path}"`);
        }
        if (!SHA256_HEX.test(file.sha256))
            throw new Error(`artifact: "${file.path}" has a malformed sha256`);
        if (seen.has(file.path))
            throw new Error(`artifact: duplicate path "${file.path}"`);
        seen.add(file.path);
    }
    const lines = [...files].sort(byPath).map((file) => `${file.sha256}  ${file.path}\n`);
    return sha256Hex(new TextEncoder().encode(`${ARTIFACT_HASH_VERSION}\n${lines.join('')}`));
}
/**
 * `dist/` のファイル（`dist/` からの相対パス）からハッシュ一覧を作る。`apps` は project.yaml の App
 * （入口は `dist/` からの相対パス）。どの App にも属さないファイルと、入口の無い App は受け付けない。
 */
export async function buildArtifactIndex(dist, apps) {
    const files = await Promise.all(dist
        .filter((file) => file.path !== ARTIFACT_INDEX_PATH)
        .map(async (file) => ({
        path: file.path,
        sha256: await hashArtifactFile(file.bytes),
        size: file.bytes.byteLength,
    })));
    files.sort(byPath);
    const stray = files.find((file) => !apps.some((app) => file.path.startsWith(`${app.slug}/`)));
    if (stray)
        throw new Error(`artifact: ${stray.path} is not inside any app's directory`);
    const appEntries = await Promise.all([...apps]
        .sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0))
        .map(async (app) => {
        const prefix = `${app.slug}/`;
        const own = files.filter((file) => file.path.startsWith(prefix));
        if (!own.some((file) => file.path === app.entry)) {
            throw new Error(`artifact: the entry ${app.entry} of "${app.slug}" is not in dist/`);
        }
        return [
            app.slug,
            {
                entry: app.entry,
                artifactHash: await computeArtifactHash(own.map((file) => ({ path: file.path.slice(prefix.length), sha256: file.sha256 }))),
                bytes: own.reduce((sum, file) => sum + file.size, 0),
                fileCount: own.length,
            },
        ];
    }));
    return artifactIndexSchema.parse({
        version: ARTIFACT_INDEX_VERSION,
        artifactHash: await computeArtifactHash(files),
        apps: Object.fromEntries(appEntries),
        files,
    });
}
