import { z } from 'zod';
/**
 * Why a preview did not start. Closed sets shared with `core.failure_diagnostic` (Python) and
 * `record_session_state` (SQL); `backend-py/apps/api/tests/test_failure_contract.py` fails when
 * the three drift apart.
 */
export declare const FAILURE_CODES: readonly ["kit_not_ready", "dependencies_failed", "source_checkout_failed", "sandbox_open_failed", "database_failed", "workers_failed", "provider_timeout", "migration_sql_failed", "migration_history_conflict", "seed_failed", "kit_failed", "unknown"];
export declare const FAILURE_PHASES: readonly ["sandbox_open", "checkout", "scaffold", "dependencies", "vite_ready", "database", "workers", "migrate", "seed", "build", "sync", "unknown"];
export declare const FAILURE_DETAIL_MAX_CHARS = 4000;
/** The server's own diagnosis; `detail` is a redacted excerpt, safe for the repairing agent. */
export declare const failureDiagnosticSchema: z.ZodObject<{
    code: z.ZodEnum<{
        unknown: "unknown";
        kit_not_ready: "kit_not_ready";
        dependencies_failed: "dependencies_failed";
        source_checkout_failed: "source_checkout_failed";
        sandbox_open_failed: "sandbox_open_failed";
        database_failed: "database_failed";
        workers_failed: "workers_failed";
        provider_timeout: "provider_timeout";
        migration_sql_failed: "migration_sql_failed";
        migration_history_conflict: "migration_history_conflict";
        seed_failed: "seed_failed";
        kit_failed: "kit_failed";
    }>;
    phase: z.ZodEnum<{
        unknown: "unknown";
        build: "build";
        sandbox_open: "sandbox_open";
        checkout: "checkout";
        scaffold: "scaffold";
        dependencies: "dependencies";
        vite_ready: "vite_ready";
        database: "database";
        workers: "workers";
        migrate: "migrate";
        seed: "seed";
        sync: "sync";
    }>;
    detail: z.ZodString;
}, z.core.$strip>;
export type FailureDiagnostic = z.infer<typeof failureDiagnosticSchema>;
/** The stages the platform records while a preview starts (`session_sandboxes.startup_phase`). */
export declare const SESSION_STARTUP_PHASES: readonly ["opening_sandbox", "preparing_source", "starting_kit", "preparing_database", "placing_workers"];
export type SessionStartupPhase = (typeof SESSION_STARTUP_PHASES)[number];
export declare const sessionEnvironmentViewSchema: z.ZodObject<{
    environmentId: z.ZodString;
    status: z.ZodString;
    reconciliation: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        desiredRevision: z.ZodNumber;
        observedRevision: z.ZodNumber;
        desiredMode: z.ZodNullable<z.ZodEnum<{
            working: "working";
            built: "built";
            cooled: "cooled";
            absent: "absent";
        }>>;
        desiredReason: z.ZodNullable<z.ZodEnum<{
            user: "user";
            capacity: "capacity";
            idle: "idle";
            retention: "retention";
        }>>;
        status: z.ZodNullable<z.ZodEnum<{
            queued: "queued";
            running: "running";
            failed: "failed";
            retrying: "retrying";
            complete: "complete";
            blocked: "blocked";
            superseded: "superseded";
        }>>;
        errorCode: z.ZodNullable<z.ZodString>;
        phase: z.ZodNullable<z.ZodString>;
    }, z.core.$strip>>>;
    testIdentities: z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodObject<{
        slot: z.ZodString;
        displayName: z.ZodString;
    }, z.core.$strip>>>>;
    events: z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodObject<{
        id: z.ZodUUID;
        kind: z.ZodString;
        payload: z.ZodUnknown;
        created_at: z.ZodString;
    }, z.core.$strip>>>>;
    jobs: z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodObject<{
        app: z.ZodString;
        handler: z.ZodString;
        cron: z.ZodString;
    }, z.core.$strict>>>>;
    jobRuns: z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodObject<{
        id: z.ZodUUID;
        app: z.ZodString;
        handler: z.ZodString;
        status: z.ZodString;
        attempts: z.ZodInt;
        lastError: z.ZodNullable<z.ZodString>;
        createdAt: z.ZodString;
    }, z.core.$strict>>>>;
    built: z.ZodObject<{
        originHost: z.ZodNullable<z.ZodString>;
        versionId: z.ZodNullable<z.ZodString>;
        canOpen: z.ZodBoolean;
        deployment: z.ZodNullable<z.ZodObject<{
            id: z.ZodString;
            status: z.ZodEnum<{
                failed: "failed";
                pending: "pending";
                active: "active";
                superseded: "superseded";
                staged: "staged";
                migrating: "migrating";
                publishing_assets: "publishing_assets";
                deploying_workers: "deploying_workers";
                registering: "registering";
                awaiting_review: "awaiting_review";
            }>;
            errorCode: z.ZodNullable<z.ZodString>;
            versionId: z.ZodString;
        }, z.core.$strip>>;
    }, z.core.$strip>;
    live: z.ZodObject<{
        kind: z.ZodNullable<z.ZodEnum<{
            sandbox: "sandbox";
            connect: "connect";
        }>>;
        status: z.ZodNullable<z.ZodEnum<{
            starting: "starting";
            running: "running";
            failed: "failed";
            stopped: "stopped";
        }>>;
        url: z.ZodNullable<z.ZodString>;
        failure: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            code: z.ZodEnum<{
                unknown: "unknown";
                kit_not_ready: "kit_not_ready";
                dependencies_failed: "dependencies_failed";
                source_checkout_failed: "source_checkout_failed";
                sandbox_open_failed: "sandbox_open_failed";
                database_failed: "database_failed";
                workers_failed: "workers_failed";
                provider_timeout: "provider_timeout";
                migration_sql_failed: "migration_sql_failed";
                migration_history_conflict: "migration_history_conflict";
                seed_failed: "seed_failed";
                kit_failed: "kit_failed";
            }>;
            phase: z.ZodEnum<{
                unknown: "unknown";
                build: "build";
                sandbox_open: "sandbox_open";
                checkout: "checkout";
                scaffold: "scaffold";
                dependencies: "dependencies";
                vite_ready: "vite_ready";
                database: "database";
                workers: "workers";
                migrate: "migrate";
                seed: "seed";
                sync: "sync";
            }>;
            detail: z.ZodString;
        }, z.core.$strip>>>;
        seedFailure: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            code: z.ZodEnum<{
                unknown: "unknown";
                kit_not_ready: "kit_not_ready";
                dependencies_failed: "dependencies_failed";
                source_checkout_failed: "source_checkout_failed";
                sandbox_open_failed: "sandbox_open_failed";
                database_failed: "database_failed";
                workers_failed: "workers_failed";
                provider_timeout: "provider_timeout";
                migration_sql_failed: "migration_sql_failed";
                migration_history_conflict: "migration_history_conflict";
                seed_failed: "seed_failed";
                kit_failed: "kit_failed";
            }>;
            phase: z.ZodEnum<{
                unknown: "unknown";
                build: "build";
                sandbox_open: "sandbox_open";
                checkout: "checkout";
                scaffold: "scaffold";
                dependencies: "dependencies";
                vite_ready: "vite_ready";
                database: "database";
                workers: "workers";
                migrate: "migrate";
                seed: "seed";
                sync: "sync";
            }>;
            detail: z.ZodString;
        }, z.core.$strip>>>;
        kitFailure: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            code: z.ZodEnum<{
                unknown: "unknown";
                kit_not_ready: "kit_not_ready";
                dependencies_failed: "dependencies_failed";
                source_checkout_failed: "source_checkout_failed";
                sandbox_open_failed: "sandbox_open_failed";
                database_failed: "database_failed";
                workers_failed: "workers_failed";
                provider_timeout: "provider_timeout";
                migration_sql_failed: "migration_sql_failed";
                migration_history_conflict: "migration_history_conflict";
                seed_failed: "seed_failed";
                kit_failed: "kit_failed";
            }>;
            phase: z.ZodEnum<{
                unknown: "unknown";
                build: "build";
                sandbox_open: "sandbox_open";
                checkout: "checkout";
                scaffold: "scaffold";
                dependencies: "dependencies";
                vite_ready: "vite_ready";
                database: "database";
                workers: "workers";
                migrate: "migrate";
                seed: "seed";
                sync: "sync";
            }>;
            detail: z.ZodString;
        }, z.core.$strip>>>;
        startupPhase: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
            opening_sandbox: "opening_sandbox";
            preparing_source: "preparing_source";
            starting_kit: "starting_kit";
            preparing_database: "preparing_database";
            placing_workers: "placing_workers";
        }>>>;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const sessionEventsPageSchema: z.ZodObject<{
    items: z.ZodArray<z.ZodObject<{
        id: z.ZodUUID;
        kind: z.ZodString;
        payload: z.ZodUnknown;
        createdAt: z.ZodString;
    }, z.core.$strict>>;
    nextCursor: z.ZodNullable<z.ZodString>;
}, z.core.$strict>;
export declare const sessionRunsPageSchema: z.ZodObject<{
    items: z.ZodArray<z.ZodObject<{
        id: z.ZodUUID;
        app: z.ZodString;
        handler: z.ZodString;
        status: z.ZodString;
        attempts: z.ZodInt;
        lastError: z.ZodNullable<z.ZodString>;
        createdAt: z.ZodString;
    }, z.core.$strict>>;
    nextCursor: z.ZodNullable<z.ZodString>;
}, z.core.$strict>;
export type SessionEnvironmentView = z.infer<typeof sessionEnvironmentViewSchema>;
/** Current private-session catalog for the trusted standalone connected Host. */
export declare const connectedSessionInspectionSchema: z.ZodObject<{
    jobRuns: z.ZodOptional<z.ZodArray<z.ZodObject<{
        id: z.ZodUUID;
        app: z.ZodString;
        handler: z.ZodString;
        status: z.ZodString;
        attempts: z.ZodInt;
        lastError: z.ZodNullable<z.ZodString>;
        createdAt: z.ZodString;
    }, z.core.$strict>>>;
    events: z.ZodArray<z.ZodObject<{
        id: z.ZodUUID;
        kind: z.ZodString;
        payload: z.ZodUnknown;
        createdAt: z.ZodString;
    }, z.core.$strict>>;
    jobs: z.ZodArray<z.ZodObject<{
        app: z.ZodString;
        handler: z.ZodString;
        cron: z.ZodString;
    }, z.core.$strict>>;
    identities: z.ZodArray<z.ZodObject<{
        slot: z.ZodString;
        displayName: z.ZodString;
    }, z.core.$strip>>;
}, z.core.$strict>;
