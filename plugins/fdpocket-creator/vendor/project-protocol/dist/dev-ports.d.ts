/** Stable allocation for every declared screen, rather than fixed web/admin slots. */
export declare function allocateAppPorts(slugs: readonly string[], firstPort?: number): Record<string, number>;
