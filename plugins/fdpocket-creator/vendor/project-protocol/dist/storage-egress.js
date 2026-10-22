import { STORAGE_MULTIPART_PART_BYTES, STORAGE_SINGLE_PUT_MAX_BYTES, STORAGE_UPLOAD_URL_TTL_SECONDS, } from "./limits.js";
import { isWorkerStorageScope, userWorkerApp } from "./platform-dispatch.js";
const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
/** `{bucket}/(apps/{app}/)?{fileId}` under `staging/{namespace}/buckets/` */
const STAGING_KEY = new RegExp(`^[a-z][a-z0-9-]{1,31}/(?:apps/[a-z][a-z0-9-]*/)?${UUID}$`);
/** `{bucket}/(apps/{app}/)?objects/{fileId}` under `{namespace}/buckets/` */
const PART_KEY = new RegExp(`^[a-z][a-z0-9-]{1,31}/(?:apps/[a-z][a-z0-9-]*/)?objects/${UUID}$`);
/** A bearer-capability PUT, restricted further to this Worker's own namespace: a single PUT to its
 * staging key, or a multipart UploadPart to its final object key (storage.md §4.4; R2 rejects the
 * part URL once the upload is completed or aborted).
 * The account origin is Platform configuration; the namespace is signed trusted DB metadata.
 * R2 verifies SigV4 itself, including method/key/type/size/expiry. No shared R2 secret enters this Worker.
 */
export function isPresignedStoragePut(request, policy, now = Date.now()) {
    if (request.method !== 'PUT' || !isWorkerStorageScope(policy.worker, policy.storage))
        return false;
    if (!/^https:\/\/[0-9a-f]{32}\.r2\.cloudflarestorage\.com$/.test(policy.r2Origin) ||
        !/^[a-z0-9][a-z0-9-]{1,62}$/.test(policy.bucketPrefix))
        return false;
    let url;
    try {
        url = new URL(request.url);
    }
    catch {
        return false;
    }
    if (url.origin !== policy.r2Origin ||
        url.username ||
        url.password ||
        url.port ||
        url.hash ||
        url.pathname.includes('%'))
        return false;
    const part = url.searchParams.has('partNumber') || url.searchParams.has('uploadId');
    const prefix = `/${policy.bucketPrefix}-private-${policy.storage.tier}/${part ? '' : 'staging/'}${policy.storage.namespace}/buckets/`;
    const rest = url.pathname.slice(prefix.length);
    if (!url.pathname.startsWith(prefix) || !(part ? PART_KEY : STAGING_KEY).test(rest))
        return false;
    const app = rest.match(/\/apps\/([^/]+)\//)?.[1];
    if (app && userWorkerApp(policy.worker) !== app)
        return false;
    // No ambiguous duplicate security parameters, even if an intermediary uses first/last-value parsing.
    const names = [...url.searchParams.keys()];
    if (new Set(names).size !== names.length)
        return false;
    const extra = names.filter((name) => !name.startsWith('X-Amz-'));
    if (extra.sort().join(',') !== (part ? 'partNumber,uploadId' : ''))
        return false;
    const get = (name) => url.searchParams.get(name) ?? '';
    if (part &&
        (!/^[1-9]\d{0,4}$/.test(get('partNumber')) ||
            Number(get('partNumber')) > 10_000 ||
            !/^[A-Za-z0-9_\-.~+/=]{1,1024}$/.test(get('uploadId'))))
        return false;
    if (get('X-Amz-Algorithm') !== 'AWS4-HMAC-SHA256' ||
        !/^[0-9a-f]{64}$/.test(get('X-Amz-Signature')))
        return false;
    if (!/^[^/]+\/\d{8}\/auto\/s3\/aws4_request$/.test(get('X-Amz-Credential')) ||
        get('X-Amz-SignedHeaders') !==
            (part ? 'content-length;host' : 'content-length;content-type;host'))
        return false;
    const stamp = get('X-Amz-Date');
    if (!/^\d{8}T\d{6}Z$/.test(stamp))
        return false;
    const signedAt = Date.parse(`${stamp.slice(0, 4)}-${stamp.slice(4, 6)}-${stamp.slice(6, 8)}T${stamp.slice(9, 11)}:${stamp.slice(11, 13)}:${stamp.slice(13, 15)}Z`);
    const ttl = Number(get('X-Amz-Expires'));
    if (!Number.isFinite(signedAt) ||
        !Number.isInteger(ttl) ||
        ttl < 1 ||
        ttl > STORAGE_UPLOAD_URL_TTL_SECONDS ||
        now < signedAt - 60_000 ||
        now > signedAt + ttl * 1000)
        return false;
    const length = request.headers.get('content-length') ?? '';
    if (!/^\d+$/.test(length) ||
        Number(length) < 1 ||
        Number(length) > (part ? STORAGE_MULTIPART_PART_BYTES : STORAGE_SINGLE_PUT_MAX_BYTES) ||
        (!part && !request.headers.get('content-type')) ||
        request.headers.has('authorization'))
        return false;
    return true;
}
