export interface StorageUploadEgressPolicy {
    worker: string;
    storage: unknown;
    r2Origin: string;
    bucketPrefix: string;
}
/** A bearer-capability PUT, restricted further to this Worker's own staging namespace.
 * The account origin is Platform configuration; the namespace is signed trusted DB metadata.
 * R2 verifies SigV4 itself, including method/key/type/size/expiry. No shared R2 secret enters this Worker.
 */
export declare function isPresignedStoragePut(request: Pick<Request, 'url' | 'method' | 'headers'>, policy: StorageUploadEgressPolicy, now?: number): boolean;
