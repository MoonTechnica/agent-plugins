import { z } from 'zod';
import { STORAGE_DOWNLOAD_URL_TTL_MAX_SECONDS } from "./limits.js";
import { PROJECT_TOKEN_ISSUER, projectTokenClaimsSchema } from "./token.js";
/** A file-only signature; never accepted as a Project or service bearer token. */
export const storageDownloadClaimsSchema = z
    .strictObject({
    iss: z.literal(PROJECT_TOKEN_ISSUER),
    typ: z.literal('storage-download'),
    project: projectTokenClaimsSchema,
    fileId: z.uuid(),
    versionId: z.uuid(),
    iat: z.int().nonnegative(),
    exp: z.int().positive(),
})
    .refine((c) => c.exp > c.iat &&
    c.exp - c.iat <= STORAGE_DOWNLOAD_URL_TTL_MAX_SECONDS &&
    c.exp <= c.project.exp &&
    c.iat >= c.project.iat, { message: 'invalid file ticket lifetime' });
/** Relative to the configured Gateway base, including its deployment mount path. */
export const storageProxyUrlSchema = z
    .string()
    .regex(/^\/v1\/storage\/files\/[0-9a-f-]{36}\/content\?ticket=[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
