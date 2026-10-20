import { STORAGE_FILE_MAX_BYTES, sdkErrorCodeForStatus, storageBeginResponseSchema, storageCompleteResponseSchema, storageDeleteResponseSchema, storageDownloadResponseSchema, } from '@workspace/project-protocol';
import { createDbClient } from "../db/client.js";
import { SdkError } from "../errors.js";
/** complete を送る回数の上限（応答が届かなかったときの送り直し。Gateway の complete は冪等） */
const COMPLETE_ATTEMPTS = 3;
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
                    // Content-Length はブラウザが Blob から付ける（禁止ヘッダー）。値は begin で署名済み
                    await put(begun.url, blob, begun.headers['Content-Type'], options.onProgress);
                    for (let attempt = 1;; attempt++) {
                        try {
                            const completed = parse(storageCompleteResponseSchema, await transport.send(`/v1/storage/uploads/${encodeURIComponent(begun.uploadId)}/complete`, { method: 'POST', body: {} }));
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
    /** 署名 URL へ PUT。進捗が要り XMLHttpRequest があればそれで（fetch は送信の進捗を取れない） */
    async function put(url, blob, contentType, onProgress) {
        const Xhr = globalThis.XMLHttpRequest;
        if (onProgress && Xhr) {
            const status = await new Promise((resolve, reject) => {
                const xhr = new Xhr();
                xhr.open('PUT', url);
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
                headers: { 'content-type': contentType },
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
