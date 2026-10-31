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
    'kit_failed',
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
    'build',
    'sync',
    'unknown',
];
export const FAILURE_DETAIL_MAX_CHARS = 4000;
/** The server's own diagnosis; `detail` is a redacted excerpt, safe for the repairing agent. */
export const failureDiagnosticSchema = z.object({
    code: z.enum(FAILURE_CODES),
    phase: z.enum(FAILURE_PHASES),
    detail: z.string().max(FAILURE_DETAIL_MAX_CHARS),
});
/**
 * The stages the platform records while a preview starts (`session_sandboxes.startup_phases`).
 * Steps run in parallel, so several can run at once; the view names the earliest of them.
 */
export const SESSION_STARTUP_PHASES = [
    'requested',
    'opening_sandbox',
    'preparing_source',
    'starting_kit',
    'preparing_database',
    'placing_workers',
];
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
        /** The Kit reported code it could not build or hand over; cleared when the same step recovers. */
        kitFailure: failureDiagnosticSchema.nullish(),
        /** The stage a start is in; null (or absent) once it ends. A closed set, as in the database. */
        startupPhase: z.enum(SESSION_STARTUP_PHASES).nullish(),
        /**
         * What the screen shows. The server decides it (`platform.preview_presentation`); nothing is
         * inferred. Optional only because the Developer Kit ships its own copy of this schema and an
         * installed Kit must keep reading a view; the screen refuses a view without it.
         */
        presentation: z
            .object({
            status: z.enum(['starting', 'running', 'stopped', 'failed']),
            showUrl: z.boolean(),
            resetFrame: z.boolean(),
            reconciliation: z.enum(['capacity', 'paused', 'waiting', 'failed', 'retrying']).nullable(),
        })
            .optional(),
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
