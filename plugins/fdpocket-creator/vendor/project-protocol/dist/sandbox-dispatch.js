import { z } from 'zod';
import { LIVE_TOKEN_PATTERN } from "./live-preview.js";
/** Service-only registry metadata. Never return this capability to browser clients. */
export const sandboxDispatchSchema = z
    .object({
    url: z.url(),
    token: z.string().regex(LIVE_TOKEN_PATTERN),
})
    .refine((value) => {
    const url = new URL(value.url);
    return (url.protocol === 'https:' &&
        !url.username &&
        !url.password &&
        !url.search &&
        !url.hash &&
        url.pathname === `/lp/${value.token}/kit-dev/dispatch`);
}, 'invalid sandbox dispatch endpoint');
export function sandboxDispatchUrl(target, path, search = '') {
    const url = new URL(target.url);
    url.pathname += path.startsWith('/') ? path : `/${path}`;
    url.search = search;
    return url;
}
