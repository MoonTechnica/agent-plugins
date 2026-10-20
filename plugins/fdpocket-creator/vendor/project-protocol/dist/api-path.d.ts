/** Public API namespace always identifies the target App explicitly. */
export declare function parseApiPath(pathname: string): {
    app: string;
    path: string;
} | null;
