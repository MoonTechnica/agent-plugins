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
export declare const storageBeginResponseSchema: z.ZodObject<{
    uploadId: z.ZodUUID;
    fileId: z.ZodUUID;
    url: z.ZodURL;
    headers: z.ZodObject<{
        'Content-Type': z.ZodString;
        'Content-Length': z.ZodString;
    }, z.core.$strict>;
    expiresAt: z.ZodISODateTime;
}, z.core.$strict>;
export type StorageBeginResponse = z.infer<typeof storageBeginResponseSchema>;
/** `POST /v1/storage/uploads/{uploadId}/complete` */
export declare const storageCompleteRequestSchema: z.ZodObject<{
    checksum: z.ZodOptional<z.ZodObject<{
        sha256: z.ZodString;
    }, z.core.$strict>>;
}, z.core.$strict>;
export type StorageCompleteRequest = z.infer<typeof storageCompleteRequestSchema>;
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
        initiated: "initiated";
        uploading: "uploading";
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
            initiated: "initiated";
            uploading: "uploading";
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
