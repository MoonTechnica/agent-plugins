import { APP_SLUG_PATTERN, isAppPath } from '@workspace/project-protocol';
/** Project-wide API prefix, independent of the current screen's Vite base. */
export function apiPath(app, path = '/') {
    if (!APP_SLUG_PATTERN.test(app) || !isAppPath(path))
        throw new Error('Invalid API App path');
    const base = typeof __PROJECT_API_BASE__ === 'string' ? __PROJECT_API_BASE__ : '/api/';
    return `${base}${app}${path}`;
}
