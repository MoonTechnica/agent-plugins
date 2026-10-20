import { z } from 'zod';
import { STORAGE_FILE_MAX_BYTES } from "./limits.js";
import { storageProxyUrlSchema } from "./storage-download.js";
/**
 * Storage API（storage.md §4）。キー（objectKey）は Gateway が生成し、クライアントは選べない。
 */
export const FILE_VISIBILITIES = ['private', 'workspace', 'public'];
export const fileVisibilitySchema = z.enum(FILE_VISIBILITIES);
export const STORAGE_FILE_STATUSES = [
    'initiated',
    'uploading',
    'validating',
    'active',
    'failed',
    'deleting',
    'deleted',
];
const isoSchema = z.iso.datetime();
/** `POST /v1/storage/{bucket}/uploads` */
export const storageBeginRequestSchema = z.strictObject({
    name: z.string().min(1).max(255),
    contentType: z.string().regex(/^[a-z]+\/[a-z0-9.+-]+$/),
    expectedSize: z.int().positive().max(STORAGE_FILE_MAX_BYTES),
    workspaceId: z.string().min(1).optional(),
    visibility: fileVisibilitySchema.optional(),
});
export const storageBeginResponseSchema = z.strictObject({
    uploadId: z.uuid(),
    fileId: z.uuid(),
    /** 署名 PUT（staging キー。10 分） */
    url: z.url(),
    /** PUT に付けるヘッダー（署名に含まれる。変えると R2 が拒否する） */
    headers: z.strictObject({ 'Content-Type': z.string(), 'Content-Length': z.string() }),
    expiresAt: isoSchema,
});
/** `POST /v1/storage/uploads/{uploadId}/complete` */
export const storageCompleteRequestSchema = z.strictObject({
    checksum: z.strictObject({ sha256: z.string().regex(/^[0-9a-f]{64}$/) }).optional(),
});
/** SDK に返す StorageFile（ZModel の行から objectKey・uploaderApp を除いたもの） */
export const storageFileSchema = z.strictObject({
    id: z.uuid(),
    bucket: z.string().min(1),
    ownerId: z.string().min(1),
    workspaceId: z.string().nullable(),
    visibility: fileVisibilitySchema,
    status: z.enum(STORAGE_FILE_STATUSES),
    originalName: z.string().nullable(),
    contentType: z.string().nullable(),
    sizeBytes: z.int().nonnegative().nullable(),
    /** visibility = public のときの CDN の URL */
    publicUrl: z.url().nullable(),
    createdAt: isoSchema,
});
export const storageCompleteResponseSchema = z.strictObject({
    fileId: z.uuid(),
    file: storageFileSchema,
});
/** `GET /v1/storage/files/{fileId}/download` */
export const storageDownloadResponseSchema = z.strictObject({
    url: z.union([z.url(), storageProxyUrlSchema]),
    /** 署名 GET の期限。public の CDN の URL は期限が無いので null */
    expiresAt: isoSchema.nullable(),
});
/** `DELETE /v1/storage/files/{fileId}`（論理削除。実体は worker が消す） */
export const storageDeleteResponseSchema = z.strictObject({
    fileId: z.uuid(),
    status: z.enum(['deleting', 'deleted']),
});
