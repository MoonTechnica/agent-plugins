import { z } from 'zod';
import { egressDeclarationIssue } from "./network.js";
export const NETWORK_MOCKS_MAX = 32;
/** Whole JSON document, including escaped text and header names/values. */
export const NETWORK_MOCKS_MAX_SERIALIZED_BYTES = 32 * 1024;
export const NETWORK_MOCK_BODY_MAX_BYTES = 16 * 1024;
const bytes = (value) => new TextEncoder().encode(value).byteLength;
export const networkMockSchema = z
    .object({
    host: z
        .string()
        .refine((host) => !host.startsWith('*.') && egressDeclarationIssue(host) === null, 'mock host must be an exact public destination'),
    status: z.int().min(200).max(599),
    headers: z
        .record(z.string().regex(/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/), z
        .string()
        .max(1024)
        .refine((value) => ![...value].some((character) => [0, 10, 13].includes(character.charCodeAt(0)))))
        .refine((value) => Object.keys(value).length <= 32)
        .optional(),
    body: z
        .string()
        .refine((value) => bytes(value) <= NETWORK_MOCK_BODY_MAX_BYTES)
        .optional(),
})
    .strict()
    .superRefine((value, ctx) => {
    try {
        new Response(value.body ?? null, { status: value.status, headers: value.headers });
    }
    catch {
        ctx.addIssue({ code: 'custom', message: 'invalid fixed response' });
    }
});
export const networkMocksSchema = z
    .array(networkMockSchema)
    .max(NETWORK_MOCKS_MAX)
    .refine((value) => new Set(value.map((mock) => mock.host)).size === value.length, 'mock hosts must be unique')
    .refine((value) => bytes(JSON.stringify(value)) <= NETWORK_MOCKS_MAX_SERIALIZED_BYTES, 'serialized mock responses exceed total limit');
export const outboundPolicySchema = z
    .object({
    mode: z.enum(['real', 'mock']),
    environmentId: z.uuid(),
    resourceGeneration: z.uuid().nullable(),
    mocks: networkMocksSchema,
})
    .strict()
    .refine((value) => value.resourceGeneration === null
    ? value.mode === 'real'
    : value.resourceGeneration === value.environmentId, 'invalid session outbound scope');
/** Only call after the ordinary allowlist check; this function performs no I/O. */
export function mockEgressResponse(host, mocks, method) {
    const mock = mocks.find((value) => value.host === host);
    if (!mock)
        return new Response(method === 'HEAD' ? null : JSON.stringify({ code: 'MOCKED_EGRESS' }), {
            status: 501,
            headers: { 'content-type': 'application/json' },
        });
    return new Response(method === 'HEAD' ? null : (mock.body ?? null), {
        status: mock.status,
        headers: mock.headers,
    });
}
export const sessionEgressEventSchema = z
    .object({
    environmentId: z.uuid(),
    resourceGeneration: z.uuid(),
    worker: z.string().regex(/^p-s-[a-f0-9]{12}-[a-z][a-z0-9-]{1,31}$/),
    host: z
        .string()
        .refine((host) => !host.startsWith('*.') && egressDeclarationIssue(host) === null),
    status: z.int().min(200).max(599),
})
    .strict()
    .refine((event) => event.environmentId === event.resourceGeneration &&
    event.worker.startsWith(`p-s-${event.resourceGeneration.replaceAll('-', '').slice(0, 12)}-`), 'invalid session egress scope');
