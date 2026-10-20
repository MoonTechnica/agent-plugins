import { APP_SLUG_PATTERN } from "./manifest.js";
/** Public API namespace always identifies the target App explicitly. */
export function parseApiPath(pathname) {
    const [, prefix, app, ...parts] = pathname.split('/');
    if (prefix !== 'api' || !app || !APP_SLUG_PATTERN.test(app))
        return null;
    try {
        if (parts.some((part) => {
            const decoded = decodeURIComponent(part);
            return (decoded === '..' ||
                decoded.includes('/') ||
                decoded.includes('\\') ||
                decoded.includes('\0'));
        }))
            return null;
    }
    catch {
        return null;
    }
    return { app, path: `/${parts.join('/')}` };
}
