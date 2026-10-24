import { z } from 'zod';
/**
 * Storage API（storage.md §4）。キー（objectKey）は Gateway が生成し、クライアントは選べない。
 */
export declare const FILE_VISIBILITIES: readonly ["private", "workspace", "public"];
export declare const fileVisibilitySchema: z.ZodEnum<{
    public: "public";
    private: "private";
    workspace: "workspace";
}>;
export type FileVisibility = z.infer<typeof fileVisibilitySchema>;
export declare const STORAGE_FILE_STATUSES: readonly ["initiated", "uploading", "validating", "active", "failed", "deleting", "deleted"];
/** `POST /v1/storage/{bucket}/uploads` */
export declare const storageBeginRequestSchema: z.ZodObject<{
    name: z.ZodString;
    contentType: z.ZodString;
    expectedSize: z.ZodInt;
    workspaceId: z.ZodOptional<z.ZodString>;
    visibility: z.ZodOptional<z.ZodEnum<{
        public: "public";
        private: "private";
        workspace: "workspace";
    }>>;
}, z.core.$strict>;
export type StorageBeginRequest = z.infer<typeof storageBeginRequestSchema>;
/** 100 MiB を超えるファイルは Multipart（storage.md §4.4） */
export declare function usesMultipart(size: number): boolean;
export declare function multipartPartCount(size: number): number;
/** part の大きさ。最後の part だけ端数（Gateway の署名と検査、SDK の分割で同じ値を使う） */
export declare function multipartPartLength(size: number, partNumber: number): number;
export declare const storageSinglePutBeginResponseSchema: z.ZodObject<{
    url: z.ZodURL;
    headers: z.ZodObject<{
        'Content-Type': z.ZodString;
        'Content-Length': z.ZodString;
    }, z.core.$strict>;
    uploadId: z.ZodUUID;
    fileId: z.ZodUUID;
    expiresAt: z.ZodISODateTime;
}, z.core.$strict>;
export declare const storageMultipartBeginResponseSchema: z.ZodObject<{
    multipart: z.ZodObject<{
        r2UploadId: z.ZodString;
        partSize: z.ZodLiteral<number>;
        partCount: z.ZodInt;
    }, z.core.$strict>;
    uploadId: z.ZodUUID;
    fileId: z.ZodUUID;
    expiresAt: z.ZodISODateTime;
}, z.core.$strict>;
export type StorageMultipartBeginResponse = z.infer<typeof storageMultipartBeginResponseSchema>;
export declare const storageBeginResponseSchema: z.ZodUnion<readonly [z.ZodObject<{
    url: z.ZodURL;
    headers: z.ZodObject<{
        'Content-Type': z.ZodString;
        'Content-Length': z.ZodString;
    }, z.core.$strict>;
    uploadId: z.ZodUUID;
    fileId: z.ZodUUID;
    expiresAt: z.ZodISODateTime;
}, z.core.$strict>, z.ZodObject<{
    multipart: z.ZodObject<{
        r2UploadId: z.ZodString;
        partSize: z.ZodLiteral<number>;
        partCount: z.ZodInt;
    }, z.core.$strict>;
    uploadId: z.ZodUUID;
    fileId: z.ZodUUID;
    expiresAt: z.ZodISODateTime;
}, z.core.$strict>]>;
export type StorageBeginResponse = z.infer<typeof storageBeginResponseSchema>;
/** `POST /v1/storage/uploads/{uploadId}/parts` */
export declare const storageSignPartsRequestSchema: z.ZodObject<{
    r2UploadId: z.ZodString;
    partNumbers: z.ZodArray<z.ZodInt>;
}, z.core.$strict>;
export type StorageSignPartsRequest = z.infer<typeof storageSignPartsRequestSchema>;
export declare const storageSignPartsResponseSchema: z.ZodObject<{
    parts: z.ZodArray<z.ZodObject<{
        partNumber: z.ZodInt;
        url: z.ZodURL;
        headers: z.ZodObject<{
            'Content-Length': z.ZodString;
        }, z.core.$strict>;
    }, z.core.$strict>>;
    expiresAt: z.ZodISODateTime;
}, z.core.$strict>;
export type StorageSignPartsResponse = z.infer<typeof storageSignPartsResponseSchema>;
/** `POST /v1/storage/uploads/{uploadId}/complete` */
export declare const storageCompleteRequestSchema: z.ZodObject<{
    checksum: z.ZodOptional<z.ZodObject<{
        sha256: z.ZodString;
    }, z.core.$strict>>;
    r2UploadId: z.ZodOptional<z.ZodString>;
}, z.core.$strict>;
export type StorageCompleteRequest = z.infer<typeof storageCompleteRequestSchema>;
/** `DELETE /v1/storage/uploads/{uploadId}`（Multipart の中断） */
export declare const storageAbortRequestSchema: z.ZodObject<{
    r2UploadId: z.ZodString;
}, z.core.$strict>;
export type StorageAbortRequest = z.infer<typeof storageAbortRequestSchema>;
export declare const storageAbortResponseSchema: z.ZodObject<{
    uploadId: z.ZodUUID;
    status: z.ZodLiteral<"failed">;
}, z.core.$strict>;
export type StorageAbortResponse = z.infer<typeof storageAbortResponseSchema>;
/** SDK に返す StorageFile（ZModel の行から objectKey・uploaderApp を除いたもの） */
export declare const storageFileSchema: z.ZodObject<{
    id: z.ZodUUID;
    bucket: z.ZodString;
    ownerId: z.ZodString;
    workspaceId: z.ZodNullable<z.ZodString>;
    visibility: z.ZodEnum<{
        public: "public";
        private: "private";
        workspace: "workspace";
    }>;
    status: z.ZodEnum<{
        failed: "failed";
        active: "active";
        uploading: "uploading";
        initiated: "initiated";
        validating: "validating";
        deleting: "deleting";
        deleted: "deleted";
    }>;
    originalName: z.ZodNullable<z.ZodString>;
    contentType: z.ZodNullable<z.ZodString>;
    sizeBytes: z.ZodNullable<z.ZodInt>;
    publicUrl: z.ZodNullable<z.ZodURL>;
    createdAt: z.ZodISODateTime;
}, z.core.$strict>;
export type StorageFile = z.infer<typeof storageFileSchema>;
export declare const storageCompleteResponseSchema: z.ZodObject<{
    fileId: z.ZodUUID;
    file: z.ZodObject<{
        id: z.ZodUUID;
        bucket: z.ZodString;
        ownerId: z.ZodString;
        workspaceId: z.ZodNullable<z.ZodString>;
        visibility: z.ZodEnum<{
            public: "public";
            private: "private";
            workspace: "workspace";
        }>;
        status: z.ZodEnum<{
            failed: "failed";
            active: "active";
            uploading: "uploading";
            initiated: "initiated";
            validating: "validating";
            deleting: "deleting";
            deleted: "deleted";
        }>;
        originalName: z.ZodNullable<z.ZodString>;
        contentType: z.ZodNullable<z.ZodString>;
        sizeBytes: z.ZodNullable<z.ZodInt>;
        publicUrl: z.ZodNullable<z.ZodURL>;
        createdAt: z.ZodISODateTime;
    }, z.core.$strict>;
}, z.core.$strict>;
export type StorageCompleteResponse = z.infer<typeof storageCompleteResponseSchema>;
/** `GET /v1/storage/files/{fileId}/download` */
export declare const storageDownloadResponseSchema: z.ZodObject<{
    url: z.ZodUnion<readonly [z.ZodURL, z.ZodString]>;
    expiresAt: z.ZodNullable<z.ZodISODateTime>;
}, z.core.$strict>;
export type StorageDownloadResponse = z.infer<typeof storageDownloadResponseSchema>;
/** `DELETE /v1/storage/files/{fileId}`（論理削除。実体は worker が消す） */
export declare const storageDeleteResponseSchema: z.ZodObject<{
    fileId: z.ZodUUID;
    status: z.ZodEnum<{
        deleting: "deleting";
        deleted: "deleted";
    }>;
}, z.core.$strict>;
export type StorageDeleteResponse = z.infer<typeof storageDeleteResponseSchema>;
