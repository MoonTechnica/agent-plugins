import { z } from 'zod';
import { liveJobRunsSchema, liveSessionInspectionSchema } from "./live-bridge.js";
/**
 * Why a preview did not start. Closed sets shared with `core.failure_diagnostic` (Python) and
 * `record_session_state` (SQL); `backend-py/apps/api/tests/test_failure_contract.py` fails when
 * the three drift apart.
 */
export const FAILURE_CODES = [
    'kit_not_ready',
    'dependencies_failed',
    'source_checkout_failed',
    'sandbox_open_failed',
    'database_failed',
    'workers_failed',
    'provider_timeout',
    'migration_sql_failed',
    'migration_history_conflict',
    'seed_failed',
    'unknown',
];
export const FAILURE_PHASES = [
    'sandbox_open',
    'checkout',
    'scaffold',
    'dependencies',
    'vite_ready',
    'database',
    'workers',
    'migrate',
    'seed',
    'unknown',
];
export const FAILURE_DETAIL_MAX_CHARS = 4000;
/** The server's own diagnosis; `detail` is a redacted excerpt, safe for the repairing agent. */
export const failureDiagnosticSchema = z.object({
    code: z.enum(FAILURE_CODES),
    phase: z.enum(FAILURE_PHASES),
    detail: z.string().max(FAILURE_DETAIL_MAX_CHARS),
});
export const sessionEnvironmentViewSchema = z.object({
    environmentId: z.string(),
    status: z.string(),
    reconciliation: z
        .object({
        desiredRevision: z.number().int().nonnegative(),
        observedRevision: z.number().int().nonnegative(),
        desiredMode: z.enum(['working', 'built', 'cooled', 'absent']).nullable(),
        desiredReason: z.enum(['capacity', 'idle', 'retention', 'user']).nullable(),
        status: z
            .enum(['queued', 'running', 'retrying', 'complete', 'blocked', 'failed', 'superseded'])
            .nullable(),
        errorCode: z.string().nullable(),
        phase: z.string().nullable(),
    })
        .nullable()
        .optional(),
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
        failure: failureDiagnosticSchema.nullish(),
        /** The app's own seed crashed, so the preview runs without sample data (the preview still works). */
        seedFailure: failureDiagnosticSchema.nullish(),
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
