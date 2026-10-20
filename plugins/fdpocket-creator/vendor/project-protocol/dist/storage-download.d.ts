import { z } from 'zod';
/** A file-only signature; never accepted as a Project or service bearer token. */
export declare const storageDownloadClaimsSchema: z.ZodObject<{
    iss: z.ZodLiteral<"project-gateway">;
    typ: z.ZodLiteral<"storage-download">;
    project: z.ZodObject<{
        iss: z.ZodLiteral<"project-gateway">;
        sub: z.ZodString;
        gid: z.ZodString;
        aud: z.ZodUUID;
        app: z.ZodString;
        env: z.ZodEnum<{
            main: "main";
            branch: "branch";
            preview: "preview";
            prod: "prod";
        }>;
        br: z.ZodOptional<z.ZodUUID>;
        pv: z.ZodOptional<z.ZodUUID>;
        anon: z.ZodBoolean;
        jti: z.ZodUUID;
        iat: z.ZodInt;
        exp: z.ZodInt;
    }, z.core.$strict>;
    fileId: z.ZodUUID;
    versionId: z.ZodUUID;
    iat: z.ZodInt;
    exp: z.ZodInt;
}, z.core.$strict>;
export type StorageDownloadClaims = z.infer<typeof storageDownloadClaimsSchema>;
/** Relative to the configured Gateway base, including its deployment mount path. */
export declare const storageProxyUrlSchema: z.ZodString;
