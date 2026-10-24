import { z } from 'zod';
import { liveJobRunsSchema, liveSessionInspectionSchema } from "./live-bridge.js";
export const sessionEnvironmentViewSchema = z.object({
    environmentId: z.string(),
    status: z.string(),
    testIdentities: z
        .array(z.object({
        slot: z.string().regex(/^[a-z][a-z0-9_-]{0,31}$/),
        displayName: z.string().min(1).max(100),
    }))
        .max(35)
        .optional()
        .default([]),
    events: z
        .array(z.object({
        id: z.uuid(),
        kind: z.string().max(128),
        payload: z.unknown(),
        created_at: z.string().max(64),
    }))
        .max(20)
        .optional()
        .default([]),
    jobs: liveSessionInspectionSchema.shape.jobs.optional().default([]),
    jobRuns: liveJobRunsSchema.optional().default([]),
    built: z.object({
        originHost: z.string().nullable(),
        versionId: z.string().nullable(),
        canOpen: z.boolean(),
        deployment: z
            .object({
            id: z.string(),
            status: z.enum([
                'pending',
                'staged',
                'migrating',
                'publishing_assets',
                'deploying_workers',
                'registering',
                'awaiting_review',
                'active',
                'failed',
                'superseded',
            ]),
            errorCode: z.string().nullable(),
            versionId: z.string(),
        })
            .nullable(),
    }),
    live: z.object({
        kind: z.enum(['sandbox', 'connect']).nullable(),
        status: z.enum(['starting', 'running', 'stopped', 'failed']).nullable(),
        url: z.string().url().nullable(),
    }),
});
const cursor = z.string().min(1).max(2048).nullable();
export const sessionEventsPageSchema = z
    .object({ items: liveSessionInspectionSchema.shape.events, nextCursor: cursor })
    .strict();
export const sessionRunsPageSchema = z
    .object({ items: liveJobRunsSchema, nextCursor: cursor })
    .strict();
/** Current private-session catalog for the trusted standalone connected Host. */
export const connectedSessionInspectionSchema = liveSessionInspectionSchema
    .extend({
    identities: sessionEnvironmentViewSchema.shape.testIdentities.removeDefault().unwrap(),
})
    .strict();
