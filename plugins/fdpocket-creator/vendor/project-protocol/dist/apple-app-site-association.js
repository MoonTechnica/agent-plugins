/**
 * Apple の `apple-app-site-association`（Universal Links）を組み立てる。FDPocket 本体（apex。限定パス）と
 * ミニアプリのオリジン（origin Worker。全パス・`/_platform/*` を除く）が同じ規則で出す
 * （share-and-direct-access.md §5）。
 *
 * @see https://developer.apple.com/documentation/xcode/supporting-associated-domains
 */
/** `<TeamID>.<bundle id>`。Team ID は英数字 10 文字 */
export function isIosApplicationIdentifier(appId, bundleIdentifier) {
    return new RegExp(`^[A-Z0-9]{10}\\.${bundleIdentifier.replaceAll('.', '\\.')}$`).test(appId);
}
/** Legacy `paths` form (apex keeps its established contract). */
export function appleAssociationForPaths(appId, paths) {
    return { applinks: { apps: [], details: [{ appID: appId, paths: [...paths] }] } };
}
/** iOS 13+ `components` form; order matters, so exclusions come before the catch-all. */
export function appleAssociationForComponents(appId, components) {
    return { applinks: { details: [{ appIDs: [appId], components: [...components] }] } };
}
/** A mini-app origin opens every app route in FDPocket, never Platform-owned endpoints. */
export const MINIAPP_ORIGIN_LINK_COMPONENTS = [
    { '/': '/_platform/*', exclude: true, comment: 'Platform login, delivery and manifest' },
    { '/': '/api/*', exclude: true, comment: 'App API, not a page' },
    { '/': '/*' },
];
