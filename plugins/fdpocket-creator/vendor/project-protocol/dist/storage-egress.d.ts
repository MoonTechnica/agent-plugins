export interface StorageUploadEgressPolicy {
    worker: string;
    storage: unknown;
    r2Origin: string;
    bucketPrefix: string;
    /** Trusted local publication metadata; immutable names contain a UUID, not the app slug. */
    appSlug?: string;
}
/** A bearer-capability PUT, restricted further to this Worker's own namespace: a single PUT to its
 * staging key, or a multipart UploadPart to its final object key (storage.md §4.4; R2 rejects the
 * part URL once the upload is completed or aborted).
 * The account origin is Platform configuration; the namespace is signed trusted DB metadata.
 * R2 verifies SigV4 itself, including method/key/type/size/expiry. No shared R2 secret enters this Worker.
 */
export declare function isPresignedStoragePut(request: Pick<Request, 'url' | 'method' | 'headers'>, policy: StorageUploadEgressPolicy, now?: number): boolean;
