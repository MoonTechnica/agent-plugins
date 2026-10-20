import { z } from 'zod';
/** Reserved build-time prefix replaced by the authenticated origin, never by the app. */
export const DELIVERY_BUILD_BASE = '/_platform/delivery/__SESSION__/';
export const DELIVERY_PATH = '/_platform/delivery/';
export const deliveryTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
export const deliveryResponseSchema = z.strictObject({
    token: deliveryTokenSchema,
    expiresAt: z.iso.datetime(),
});
export function deliveryBase(token) {
    return `${DELIVERY_PATH}${deliveryTokenSchema.parse(token)}/`;
}
