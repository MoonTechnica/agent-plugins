export interface AppCspInput {
    browserOrigins?: readonly string[];
    gatewayUrl: string;
    /** 署名 URL の宛先のオリジン（`https://<account>.r2.cloudflarestorage.com` など） */
    storageOrigins: readonly string[];
    /** App を埋め込めるスーパーアプリのオリジン */
    hostOrigins: readonly string[];
}
export declare function appContentSecurityPolicy(input: AppCspInput): string;
