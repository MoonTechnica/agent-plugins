/**
 * App の静的配信の規則（app-origins.md §4.2）。App のオリジン（本番）と `kit validate` の動的検証が同じ関数で
 * パスを解き、同じヘッダーを付ける。
 *
 * - App はホストで決まり、そのオリジンの `/` から配る（ほかの App の slug はパスの接頭辞にならない）
 * - 見つからないとき、拡張子の無いパス（SPA のルート）だけ App の入口（`index.html`）に戻す
 */
export type AppRoute = {
    kind: 'not_found';
} | {
    kind: 'file';
    /** App の中の相対パス（`dist/<slug>/` から） */
    file: string;
    /** `file` が無いときに返す入口（拡張子のあるパスは戻さないので null） */
    entry: string | null;
};
export declare function contentTypeOf(path: string): string;
export declare function appCacheControl(file: string, fallback: boolean): string;
/** `pathname` はデコード済み（`decodeURIComponent`）のパス */
export declare function appFileOf(pathname: string, app: {
    slug: string;
    entry: string;
}): AppRoute;
