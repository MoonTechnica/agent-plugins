import { z } from 'zod';
export const ORIGIN_HOST_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*-[0-9a-f]{10}(?:--(?:main|s-[0-9a-f]{12}))?$/;
/** Only canonical, HTTPS hosting origins; never accept credentials, paths or suffix tricks. */
export const providerOriginSchema = z
    .string()
    .regex(/^https:\/\/[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.workers\.dev$(?![\s\S])/);
export function resolveAppOrigin(input) {
    if (!ORIGIN_HOST_PATTERN.test(input.originHost))
        throw new Error('invalid app origin label');
    if (input.appsDomain) {
        if (!/^[a-z0-9.-]+(?::\d{1,5})?$/.test(input.appsDomain))
            throw new Error('invalid app domain');
        const scheme = input.scheme ?? (/^localhost(:\d+)?$/.test(input.appsDomain) ? 'http' : 'https');
        return `${scheme}://${input.originHost}.${input.appsDomain}`;
    }
    return providerOriginSchema.parse(input.providerOrigin);
}
