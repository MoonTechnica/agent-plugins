/**
 * Apple の `apple-app-site-association`（Universal Links）を組み立てる。FDPocket 本体（apex。限定パス）と
 * ミニアプリのオリジン（origin Worker。全パス・`/_platform/*` を除く）が同じ規則で出す
 * （share-and-direct-access.md §5）。
 *
 * @see https://developer.apple.com/documentation/xcode/supporting-associated-domains
 */
export type AppleLinkComponent = {
    '/': string;
    exclude?: true;
    comment?: string;
};
/** `<TeamID>.<bundle id>`。Team ID は英数字 10 文字 */
export declare function isIosApplicationIdentifier(appId: string, bundleIdentifier: string): boolean;
/** Legacy `paths` form (apex keeps its established contract). */
export declare function appleAssociationForPaths(appId: string, paths: readonly string[]): {
    applinks: {
        apps: string[];
        details: {
            appID: string;
            paths: string[];
        }[];
    };
};
/** iOS 13+ `components` form; order matters, so exclusions come before the catch-all. */
export declare function appleAssociationForComponents(appId: string, components: readonly AppleLinkComponent[]): {
    applinks: {
        details: {
            appIDs: string[];
            components: AppleLinkComponent[];
        }[];
    };
};
/** A mini-app origin opens every app route in FDPocket, never Platform-owned endpoints. */
export declare const MINIAPP_ORIGIN_LINK_COMPONENTS: readonly AppleLinkComponent[];
