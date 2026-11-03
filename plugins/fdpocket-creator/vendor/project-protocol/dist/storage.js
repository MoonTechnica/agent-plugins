import { z } from 'zod';
import { contract } from "./contract.js";
import { STORAGE_FILE_MAX_BYTES, STORAGE_MULTIPART_PART_BYTES, STORAGE_MULTIPART_SIGN_MAX_PARTS, STORAGE_SINGLE_PUT_MAX_BYTES, } from "./limits.js";
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
/** 100 MiB を超えるファイルは Multipart（storage.md §4.4） */
export function usesMultipart(size) {
    return size > STORAGE_SINGLE_PUT_MAX_BYTES;
}
export function multipartPartCount(size) {
    return Math.ceil(size / STORAGE_MULTIPART_PART_BYTES);
}
/** part の大きさ。最後の part だけ端数（Gateway の署名と検査、SDK の分割で同じ値を使う） */
export function multipartPartLength(size, partNumber) {
    const count = multipartPartCount(size);
    if (!Number.isInteger(partNumber) || partNumber < 1 || partNumber > count) {
        throw new RangeError(`part ${partNumber} is outside 1..${count}`);
    }
    return partNumber < count
        ? STORAGE_MULTIPART_PART_BYTES
        : size - STORAGE_MULTIPART_PART_BYTES * (count - 1);
}
/**
 * R2 の multipart upload ID。DB には保存せず、begin で返して以後の要求で送り返させる（storage.md §4.4）。
 * 署名する URL のクエリに入るので、区切り文字を含む値は受け付けない
 */
const r2UploadIdSchema = z.string().regex(/^[A-Za-z0-9_\-.~+/=]{1,1024}$/);
const beginBase = { uploadId: z.uuid(), fileId: z.uuid(), expiresAt: isoSchema };
export const storageSinglePutBeginResponse = contract((o) => o.object({
    ...beginBase,
    /** 署名 PUT（staging キー。10 分） */
    url: z.url(),
    /** PUT に付けるヘッダー（署名に含まれる。変えると R2 が拒否する） */
    headers: o.object({ 'Content-Type': z.string(), 'Content-Length': z.string() }),
}));
export const storageMultipartBeginResponse = contract((o) => o.object({
    ...beginBase,
    /** 100 MiB 超。part の URL は `/parts` で取る。expiresAt は未完了の upload を掃除する時刻 */
    multipart: o.invariant(o.object({
        r2UploadId: r2UploadIdSchema,
        partSize: z.int().positive(),
        partCount: z.int().min(2).max(10_000),
    }), (value, ctx) => {
        // part の大きさは SDK の分割と Gateway の署名が同じ値を使う。書く側（Gateway）だけが固定する
        if (value.partSize !== STORAGE_MULTIPART_PART_BYTES)
            ctx.addIssue({ code: 'custom', path: ['partSize'], message: 'unexpected part size' });
    }),
}));
export const storageBeginResponse = contract((o) => z.union([storageSinglePutBeginResponse.in(o), storageMultipartBeginResponse.in(o)]));
/** `POST /v1/storage/uploads/{uploadId}/parts` */
export const storageSignPartsRequestSchema = z.strictObject({
    r2UploadId: r2UploadIdSchema,
    partNumbers: z
        .array(z.int().min(1).max(10_000))
        .min(1)
        .max(STORAGE_MULTIPART_SIGN_MAX_PARTS)
        .refine((numbers) => new Set(numbers).size === numbers.length, 'duplicate part number'),
});
export const storageSignPartsResponse = contract((o) => o.object({
    parts: z.array(o.object({
        partNumber: z.int().min(1).max(10_000),
        /** 署名 UploadPart（10 分。Content-Length は署名に含まれる） */
        url: z.url(),
        headers: o.object({ 'Content-Length': z.string() }),
    })),
    expiresAt: isoSchema,
}));
/** `POST /v1/storage/uploads/{uploadId}/complete` */
export const storageCompleteRequestSchema = z.strictObject({
    checksum: z.strictObject({ sha256: z.string().regex(/^[0-9a-f]{64}$/) }).optional(),
    /** Multipart のときだけ */
    r2UploadId: r2UploadIdSchema.optional(),
});
/** `DELETE /v1/storage/uploads/{uploadId}`（Multipart の中断） */
export const storageAbortRequestSchema = z.strictObject({ r2UploadId: r2UploadIdSchema });
export const storageAbortResponse = contract((o) => o.object({ uploadId: z.uuid(), status: o.enum(['failed']) }));
/** SDK に返す StorageFile（ZModel の行から objectKey・uploaderApp を除いたもの） */
export const storageFile = contract((o) => o.object({
    id: z.uuid(),
    bucket: z.string().min(1),
    ownerId: z.string().min(1),
    workspaceId: z.string().nullable(),
    visibility: o.enum(FILE_VISIBILITIES),
    status: o.enum(STORAGE_FILE_STATUSES),
    originalName: z.string().nullable(),
    contentType: z.string().nullable(),
    sizeBytes: z.int().nonnegative().nullable(),
    /** visibility = public のときの CDN の URL */
    publicUrl: z.url().nullable(),
    createdAt: isoSchema,
}));
export const storageCompleteResponse = contract((o) => o.object({ fileId: z.uuid(), file: storageFile.in(o) }));
/** `GET /v1/storage/files/{fileId}/download` */
export const storageDownloadResponse = contract((o) => o.object({
    url: z.union([z.url(), storageProxyUrlSchema]),
    /** 署名 GET の期限。public の CDN の URL は期限が無いので null */
    expiresAt: isoSchema.nullable(),
}));
/** `DELETE /v1/storage/files/{fileId}`（論理削除。実体は worker が消す） */
export const storageDeleteResponse = contract((o) => o.object({ fileId: z.uuid(), status: o.enum(['deleting', 'deleted']) }));
