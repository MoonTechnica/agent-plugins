import { z } from 'zod';
/** Service-only registry metadata. Never return this capability to browser clients. */
export declare const sandboxDispatchSchema: z.ZodObject<{
    url: z.ZodURL;
    token: z.ZodString;
}, z.core.$strip>;
export declare function sandboxDispatchUrl(target: z.infer<typeof sandboxDispatchSchema>, path: string, search?: string): URL;
