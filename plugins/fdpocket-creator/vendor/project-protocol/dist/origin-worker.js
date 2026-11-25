import { z } from 'zod';
import { parseOriginLabel } from "./origin.js";
import { originListingSchema } from "./origin-listing.js";
import { originResolveResultSchema } from "./resolve.js";
/**
 * main / prod の画面配信 Worker（app-asset-workers.md）。ホストのラベル 1 つにつき Worker 1 つで、
 * 配備のたびに同じ名前を上書きする。名前はラベルから決まるので、配信は DB を引かずに Worker を選べる。
 *
 * - App のホスト `{Project}--{App}[--main]` → `o-{originId}--{App}[--main]`（版のファイル + meta）
 * - 入口のホスト `{Project}[--main]` → `o-{originId}[--main]`（meta だけ）
 *
 * セッション（`--s-…`）は Sandbox のライブプレビューなので Worker を持たない（null）。
 * 組み立てはここだけ。Python（`static_assets_gateway.origin_worker_name`）・SQL は同じ規則をテストで照合する。
 */
export function originWorkerName(label) {
    const parsed = parseOriginLabel(label);
    if (parsed === null || parsed.environment.kind === 'session')
        return null;
    const app = parsed.app === null ? '' : `--${parsed.app}`;
    const environment = parsed.environment.kind === 'main' ? '--main' : '';
    return `o-${parsed.originId}${app}${environment}`;
}
/** Worker の中の meta（配信の判断に要る情報。DB の resolve と listing の写し） */
export const ORIGIN_WORKER_META_PATH = '/_platform/meta.json';
const VERSION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
/** 版のファイルの Worker 内のパス。版を前に付けるので、上書き後に古い版のパスは 404 になる */
export function originWorkerAssetPath(versionId, path) {
    if (!VERSION_ID.test(versionId))
        throw new Error('invalid version id');
    if (path.startsWith('/') || path.split('/').some((part) => part === '..' || part === ''))
        throw new Error('invalid asset path');
    return `/v/${versionId}/${path}`;
}
export const originWorkerMetaSchema = z.strictObject({
    /** 正しいラベル（飾りの slug が変わったら、古いラベルのホストは 404 にする） */
    label: z.string().refine((label) => originWorkerName(label) !== null, 'invalid origin label'),
    /**
     * `platform.project_origin_resolve` と同じ形。not_found（公開をやめた・削除を頼まれた）でも
     * Worker は消さずに meta だけ書き換える（公開し直したとき、同じ版のファイルがそのまま使える）。
     */
    resolved: originResolveResultSchema,
    /** 公開中の prod だけ値を持つ（`platform.project_origin_listing` と同じ） */
    listing: originListingSchema,
});
