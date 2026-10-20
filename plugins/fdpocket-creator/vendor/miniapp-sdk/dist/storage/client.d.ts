import { type FileVisibility, type StorageDeleteResponse, type StorageDownloadResponse, type StorageFile } from '@workspace/project-protocol';
import type { Transport } from '../transport.ts';
export interface UploadProgress {
    loaded: number;
    total: number;
}
export interface UploadOptions {
    /** 表示名。省略時は `File` の名前 */
    name?: string;
    /** 省略時は Blob の type（`; charset=…` は除く） */
    contentType?: string;
    workspaceId?: string;
    visibility?: FileVisibility;
    /**
     * 送った量。`XMLHttpRequest` のある環境（ブラウザ）では逐次、無い環境では送り終えたときに 1 回。
     * fetch は送信の進捗を取れない（ストリーム送信は Content-Length を付けられず、署名と合わない）
     */
    onProgress?: (progress: UploadProgress) => void;
}
/** `get` が返すメタデータ（公開 URL は `getDownloadUrl` で取る） */
export type StorageFileMeta = Omit<StorageFile, 'publicUrl'>;
export interface Bucket {
    /** begin（署名 PUT）→ 署名 URL へ直接 PUT（Gateway を通さない）→ complete（検証・確定） */
    upload(blob: Blob, options?: UploadOptions): Promise<StorageFile>;
    /** Display URL: signed R2 or per-request authorized proxy. Renew before expiresAt; public CDN has null expiry. */
    getDownloadUrl(fileId: string): Promise<StorageDownloadResponse>;
    /** 読めない・このバケットに無いファイルは null（`db.storageFile.findUnique` と同じポリシー） */
    get(fileId: string): Promise<StorageFileMeta | null>;
    /** 論理削除（実体は非同期で消える）。冪等 */
    remove(fileId: string): Promise<StorageDeleteResponse>;
}
export interface Storage {
    /** `project.yaml` の論理バケット。一覧は `db.storageFile.findMany`（同じポリシー） */
    from(bucket: string): Bucket;
}
/**
 * `client.storage`（sdk.md §3.3・storage.md §4）。本体は App と R2 の間を直接通り、
 * proxyバケットの取得はGatewayが毎回認可して中継する。PUTにはトークンを付けない（署名URLが権限）。
 */
export declare function createStorage(transport: Transport, fetchImpl: typeof globalThis.fetch, gateway: string): Storage;
