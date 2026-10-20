/** A path inside one App must never escape its launch prefix after URL normalization. */
export function isAppPath(path) {
    if (!path.startsWith('/') ||
        path.startsWith('//') ||
        path.includes('\\') ||
        hasControlCharacter(path))
        return false;
    try {
        return (path.split(/[?#]/, 1)[0] ?? '').split('/').every((segment) => {
            const decoded = decodeURIComponent(segment);
            return (decoded !== '.' &&
                decoded !== '..' &&
                !decoded.includes('/') &&
                !decoded.includes('\\') &&
                !hasControlCharacter(decoded));
        });
    }
    catch {
        return false;
    }
}
function hasControlCharacter(value) {
    return Array.from(value).some((char) => char.charCodeAt(0) < 0x20 || char.charCodeAt(0) === 0x7f);
}
