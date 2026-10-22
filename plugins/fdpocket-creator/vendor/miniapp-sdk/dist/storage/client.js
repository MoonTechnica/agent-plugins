import { multipartPartLength, STORAGE_FILE_MAX_BYTES, STORAGE_MULTIPART_PART_BYTES, STORAGE_MULTIPART_SIGN_MAX_PARTS, sdkErrorCodeForStatus, storageBeginResponseSchema, storageCompleteResponseSchema, storageDeleteResponseSchema, storageDownloadResponseSchema, storageSignPartsResponseSchema, } from '@workspace/project-protocol';
import { createDbClient } from "../db/client.js";
import { SdkError } from "../errors.js";
/** complete を送る回数の上限（応答が届かなかったときの送り直し。Gateway の complete は冪等） */
const COMPLETE_ATTEMPTS = 3;
/** Multipart の同時に送る part 数と、1 part を送る回数の上限（storage.md §4.4） */
const PART_CONCURRENCY = 4;
const PART_ATTEMPTS = 3;
/** 署名の期限のこれだけ前に取り直す */
const SIGN_MARGIN_MS = 30_000;
const META_SELECT = {
    id: true,
    bucket: true,
    ownerId: true,
    workspaceId: true,
    visibility: true,
    status: true,
    originalName: true,
    contentType: true,
    sizeBytes: true,
    createdAt: true,
};
/**
 * `client.storage`（sdk.md §3.3・storage.md §4）。本体は App と R2 の間を直接通り、
 * proxyバケットの取得はGatewayが毎回認可して中継する。PUTにはトークンを付けない（署名URLが権限）。
 */
export function createStorage(transport, fetchImpl, gateway) {
    const db = createDbClient(transport);
    return {
        from(bucket) {
            const files = `/v1/storage/files`;
            return {
                async upload(blob, options = {}) {
                    const name = options.name ?? (blob instanceof File ? blob.name : '');
                    if (!name)
                        throw new SdkError('VALIDATION_FAILED', 'file name is required');
                    if (blob.size <= 0)
                        throw new SdkError('VALIDATION_FAILED', 'file is empty');
                    if (blob.size > STORAGE_FILE_MAX_BYTES) {
                        throw new SdkError('PAYLOAD_TOO_LARGE', 'file is larger than the upload limit');
                    }
                    const contentType = mediaType(options.contentType ?? blob.type);
                    const begun = parse(storageBeginResponseSchema, await transport.send(`/v1/storage/${encodeURIComponent(bucket)}/uploads`, {
                        method: 'POST',
                        body: {
                            name,
                            contentType,
                            expectedSize: blob.size,
                            ...(options.workspaceId === undefined ? {} : { workspaceId: options.workspaceId }),
                            ...(options.visibility === undefined ? {} : { visibility: options.visibility }),
                        },
                    }));
                    if ('multipart' in begun) {
                        await putParts(begun, blob, options.onProgress);
                    }
                    else {
                        // Content-Length はブラウザが Blob から付ける（禁止ヘッダー）。値は begin で署名済み
                        await put(begun.url, blob, begun.headers['Content-Type'], options.onProgress);
                    }
                    const completeBody = 'multipart' in begun ? { r2UploadId: begun.multipart.r2UploadId } : {};
                    for (let attempt = 1;; attempt++) {
                        try {
                            const completed = parse(storageCompleteResponseSchema, await transport.send(`/v1/storage/uploads/${encodeURIComponent(begun.uploadId)}/complete`, { method: 'POST', body: completeBody }));
                            return completed.file;
                        }
                        catch (error) {
                            const resend = error instanceof SdkError &&
                                error.code === 'GATEWAY_UNAVAILABLE' &&
                                attempt < COMPLETE_ATTEMPTS;
                            if (!resend)
                                throw error;
                        }
                    }
                },
                async getDownloadUrl(fileId) {
                    const response = parse(storageDownloadResponseSchema, await transport.send(`${files}/${encodeURIComponent(fileId)}/download`));
                    return {
                        ...response,
                        url: response.url.startsWith('/')
                            ? `${gateway.replace(/\/+$/, '')}${response.url}`
                            : response.url,
                    };
                },
                async get(fileId) {
                    const row = await db.storageFile.findUnique({
                        where: { id: fileId },
                        select: META_SELECT,
                    });
                    if (!row || row.bucket !== bucket)
                        return null;
                    const createdAt = row.createdAt;
                    return {
                        ...row,
                        createdAt: createdAt instanceof Date ? createdAt.toISOString() : String(createdAt),
                    };
                },
                async remove(fileId) {
                    return parse(storageDeleteResponseSchema, await transport.send(`${files}/${encodeURIComponent(fileId)}`, { method: 'DELETE' }));
                },
            };
        },
    };
    /**
     * 100 MiB 超（storage.md §4.4）。16 MiB の part を同時 4 本で送る。届かない・5xx は同じ URL で、
     * 署名の拒否（403。期限切れ）は署名を取り直して、part ごとに最大 3 回。回復できなければ abort を送って投げる
     */
    async function putParts(begun, blob, onProgress) {
        const { r2UploadId, partCount } = begun.multipart;
        const uploads = `/v1/storage/uploads/${encodeURIComponent(begun.uploadId)}`;
        const signed = new Map();
        const signing = new Map();
        const loaded = new Map();
        const report = () => {
            let sum = 0;
            for (const value of loaded.values())
                sum += value;
            onProgress?.({ loaded: sum, total: blob.size });
        };
        /** part を含む 100 件の束をまとめて署名する（同じ束を同時に取りに行かない） */
        async function sign(partNumber, fresh) {
            const current = signed.get(partNumber);
            if (!fresh && current && current.expiresAt - SIGN_MARGIN_MS > Date.now())
                return current.url;
            const first = fresh
                ? partNumber
                : Math.floor((partNumber - 1) / STORAGE_MULTIPART_SIGN_MAX_PARTS) *
                    STORAGE_MULTIPART_SIGN_MAX_PARTS +
                    1;
            const key = fresh ? -partNumber : first;
            let pending = signing.get(key);
            if (!pending) {
                const numbers = fresh
                    ? [partNumber]
                    : Array.from({ length: Math.min(STORAGE_MULTIPART_SIGN_MAX_PARTS, partCount - first + 1) }, (_, i) => first + i);
                pending = (async () => {
                    const response = parse(storageSignPartsResponseSchema, await transport.send(`${uploads}/parts`, {
                        method: 'POST',
                        body: { r2UploadId, partNumbers: numbers },
                    }));
                    const expiresAt = Date.parse(response.expiresAt);
                    for (const part of response.parts)
                        signed.set(part.partNumber, { url: part.url, expiresAt });
                })().finally(() => signing.delete(key));
                signing.set(key, pending);
            }
            await pending;
            const url = signed.get(partNumber)?.url;
            if (!url)
                throw new SdkError('GATEWAY_UNAVAILABLE', 'part was not signed', { retryable: true });
            return url;
        }
        async function send(partNumber) {
            const start = (partNumber - 1) * STORAGE_MULTIPART_PART_BYTES;
            const chunk = blob.slice(start, start + multipartPartLength(blob.size, partNumber));
            let fresh = false;
            for (let attempt = 1;; attempt++) {
                const url = await sign(partNumber, fresh);
                try {
                    await put(url, chunk, null, (progress) => {
                        loaded.set(partNumber, progress.loaded);
                        report();
                    });
                    loaded.set(partNumber, chunk.size);
                    report();
                    return;
                }
                catch (error) {
                    const status = error instanceof SdkError ? error.status : undefined;
                    const retryable = status === 403 || (error instanceof SdkError && error.retryable);
                    if (!retryable || attempt >= PART_ATTEMPTS)
                        throw error;
                    loaded.set(partNumber, 0);
                    fresh = status === 403;
                }
            }
        }
        let next = 1;
        try {
            await Promise.all(Array.from({ length: Math.min(PART_CONCURRENCY, partCount) }, async () => {
                for (let partNumber = next++; partNumber <= partCount; partNumber = next++) {
                    await send(partNumber);
                }
            }));
        }
        catch (error) {
            // 送れなくても元のエラーを優先する。残った upload は Gateway の掃除（24 時間後）が Abort する
            await transport
                .send(uploads, { method: 'DELETE', body: { r2UploadId } })
                .catch((abortError) => {
                console.error('Storage multipart abort failed', abortError);
            });
            throw error;
        }
    }
    /** 署名 URL へ PUT。進捗が要り XMLHttpRequest があればそれで（fetch は送信の進捗を取れない） */
    async function put(url, blob, contentType, onProgress) {
        const Xhr = globalThis.XMLHttpRequest;
        if (onProgress && Xhr) {
            const status = await new Promise((resolve, reject) => {
                const xhr = new Xhr();
                xhr.open('PUT', url);
                // part（Multipart）は Content-Type を署名に含めない
                if (contentType)
                    xhr.setRequestHeader('content-type', contentType);
                xhr.upload.onprogress = (event) => {
                    if (event.lengthComputable)
                        onProgress({ loaded: event.loaded, total: event.total });
                };
                xhr.onload = () => resolve(xhr.status);
                xhr.onerror = () => reject(unreachable(new TypeError('upload failed')));
                xhr.onabort = () => reject(unreachable(new TypeError('upload aborted')));
                xhr.send(blob);
            });
            assertStored(status);
            return;
        }
        let response;
        try {
            response = await fetchImpl(url, {
                method: 'PUT',
                ...(contentType ? { headers: { 'content-type': contentType } } : {}),
                body: blob,
            });
        }
        catch (cause) {
            throw unreachable(cause);
        }
        // 本文（R2 のエラー XML）は読み捨てる。接続を解放するため
        await response.arrayBuffer();
        assertStored(response.status);
        onProgress?.({ loaded: blob.size, total: blob.size });
    }
}
function assertStored(status) {
    if (status >= 200 && status < 300)
        return;
    const code = sdkErrorCodeForStatus(status);
    throw new SdkError(code, `storage rejected the upload (${status})`, {
        status,
        retryable: code === 'GATEWAY_UNAVAILABLE',
    });
}
function unreachable(cause) {
    return new SdkError('GATEWAY_UNAVAILABLE', 'storage is unreachable', { retryable: true, cause });
}
/** `text/plain;charset=utf-8` → `text/plain`（Gateway の形と allowlist に合わせる） */
function mediaType(value) {
    return value.split(';')[0]?.trim().toLowerCase() || 'application/octet-stream';
}
/** 応答の形を protocol の zod で確かめる（形が違えば届かなかったのと同じ扱い） */
function parse(schema, value) {
    const parsed = schema.safeParse(value);
    if (!parsed.success) {
        throw new SdkError('GATEWAY_UNAVAILABLE', 'unexpected storage response', { retryable: true });
    }
    return parsed.data;
}
