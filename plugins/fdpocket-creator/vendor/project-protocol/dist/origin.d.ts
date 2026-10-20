import { z } from 'zod';
export declare const ORIGIN_HOST_PATTERN: RegExp;
/** Only canonical, HTTPS hosting origins; never accept credentials, paths or suffix tricks. */
export declare const providerOriginSchema: z.ZodString;
export declare function resolveAppOrigin(input: {
    originHost: string;
    appsDomain: string | null;
    providerOrigin?: string | null;
    scheme?: 'https' | 'http';
}): string;
