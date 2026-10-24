import { z } from 'zod';
export declare const NETWORK_MOCKS_MAX = 32;
/** Whole JSON document, including escaped text and header names/values. */
export declare const NETWORK_MOCKS_MAX_SERIALIZED_BYTES: number;
export declare const NETWORK_MOCK_BODY_MAX_BYTES: number;
export declare const networkMockSchema: z.ZodObject<{
    host: z.ZodString;
    status: z.ZodInt;
    headers: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    body: z.ZodOptional<z.ZodString>;
}, z.core.$strict>;
export declare const networkMocksSchema: z.ZodArray<z.ZodObject<{
    host: z.ZodString;
    status: z.ZodInt;
    headers: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    body: z.ZodOptional<z.ZodString>;
}, z.core.$strict>>;
export type NetworkMock = z.infer<typeof networkMockSchema>;
export declare const outboundPolicySchema: z.ZodObject<{
    mode: z.ZodEnum<{
        real: "real";
        mock: "mock";
    }>;
    environmentId: z.ZodUUID;
    resourceGeneration: z.ZodNullable<z.ZodUUID>;
    mocks: z.ZodArray<z.ZodObject<{
        host: z.ZodString;
        status: z.ZodInt;
        headers: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
        body: z.ZodOptional<z.ZodString>;
    }, z.core.$strict>>;
}, z.core.$strict>;
export type OutboundPolicy = z.infer<typeof outboundPolicySchema>;
/** Only call after the ordinary allowlist check; this function performs no I/O. */
export declare function mockEgressResponse(host: string, mocks: readonly NetworkMock[], method: string): Response;
export declare const sessionEgressEventSchema: z.ZodObject<{
    environmentId: z.ZodUUID;
    resourceGeneration: z.ZodUUID;
    worker: z.ZodString;
    host: z.ZodString;
    status: z.ZodInt;
}, z.core.$strict>;
export type SessionEgressEvent = z.infer<typeof sessionEgressEventSchema>;
