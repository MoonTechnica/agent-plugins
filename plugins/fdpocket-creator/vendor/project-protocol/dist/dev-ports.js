/** Stable allocation for every declared screen, rather than fixed web/admin slots. */
export function allocateAppPorts(slugs, firstPort = 5173) {
    const sorted = [...new Set(slugs)].sort((a, b) => a === 'web' ? -1 : b === 'web' ? 1 : a.localeCompare(b));
    return Object.fromEntries(sorted.map((slug, index) => [slug, firstPort + index]));
}
