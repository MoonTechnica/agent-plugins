/**
 * App の静的配信の規則（project-runtime.md §3）。Project オリジン（本番）と `kit validate` の動的検証が同じ関数で
 * パスを解き、同じヘッダーを付ける。
 *
 * - web は `/`、ほかの App は `/<slug>/`（同じオリジン）。`/<slug>` は `/<slug>/` へ
 * - 見つからないとき、拡張子の無いパス（SPA のルート）だけ App の入口（`index.html`）に戻す
 */
const CONTENT_TYPES = {
    html: 'text/html; charset=utf-8',
    js: 'text/javascript; charset=utf-8',
    mjs: 'text/javascript; charset=utf-8',
    css: 'text/css; charset=utf-8',
    json: 'application/json; charset=utf-8',
    webmanifest: 'application/manifest+json; charset=utf-8',
    map: 'application/json; charset=utf-8',
    txt: 'text/plain; charset=utf-8',
    wasm: 'application/wasm',
    svg: 'image/svg+xml',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
    gif: 'image/gif',
    avif: 'image/avif',
    ico: 'image/x-icon',
    mp3: 'audio/mpeg',
    ogg: 'audio/ogg',
    wav: 'audio/wav',
    mp4: 'video/mp4',
    webm: 'video/webm',
    woff: 'font/woff',
    woff2: 'font/woff2',
    ttf: 'font/ttf',
    otf: 'font/otf',
};
function extensionOf(path) {
    const name = path.slice(path.lastIndexOf('/') + 1);
    const dot = name.lastIndexOf('.');
    return dot <= 0 ? null : name.slice(dot + 1).toLowerCase();
}
export function contentTypeOf(path) {
    return CONTENT_TYPES[extensionOf(path) ?? ''] ?? 'application/octet-stream';
}
export function appCacheControl(file, fallback) {
    if (fallback || extensionOf(file) === 'html')
        return 'no-cache';
    // Vite の出力（`assets/<name>-<hash>.<ext>`）は中身が変われば名前が変わる
    if (file.startsWith('assets/'))
        return 'public, max-age=31536000, immutable';
    return 'public, max-age=300';
}
/**
 * App の中の入口。版に記録されるのは正規化した manifest の `dist/<slug>/index.html`、ビルドの報告は
 * `<slug>/index.html`。どちらも App のディレクトリからの相対パスにする。
 */
function entryInApp(app) {
    return app.entry.replace(/^dist\//, '').slice(app.slug.length + 1);
}
/** `pathname` はデコード済み（`decodeURIComponent`）のパス */
export function routeAppRequest(pathname, apps) {
    if (pathname.split('/').some((segment) => segment === '..'))
        return { kind: 'not_found' };
    const [first = '', ...rest] = pathname.replace(/^\/+/, '').split('/');
    const other = apps.find((app) => app.slug === first && app.slug !== 'web');
    if (other && rest.length === 0 && !pathname.endsWith('/')) {
        return { kind: 'redirect', location: `/${other.slug}/` };
    }
    const target = other ?? apps.find((app) => app.slug === 'web');
    if (target === undefined)
        return { kind: 'not_found' };
    const relative = other ? rest.join('/') : pathname.replace(/^\/+/, '');
    const file = relative === '' ? 'index.html' : relative;
    return {
        kind: 'file',
        slug: target.slug,
        file,
        entry: extensionOf(file) === null ? entryInApp(target) : null,
    };
}
