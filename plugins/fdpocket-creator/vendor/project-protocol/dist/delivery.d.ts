import { z } from 'zod';
/** Reserved build-time prefix replaced by the authenticated origin, never by the app. */
export declare const DELIVERY_BUILD_BASE = "/_platform/delivery/__SESSION__/";
export declare const DELIVERY_PATH = "/_platform/delivery/";
export declare const deliveryTokenSchema: z.ZodString;
export declare const deliveryResponseSchema: z.ZodObject<{
    token: z.ZodString;
    expiresAt: z.ZodISODateTime;
}, z.core.$strict>;
export declare function deliveryBase(token: string): string;
