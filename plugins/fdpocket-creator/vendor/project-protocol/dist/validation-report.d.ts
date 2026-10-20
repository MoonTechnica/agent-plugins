import { z } from 'zod';
/**
 * 検証レポート（sdk.md §8。取り込み / 静的 / 動的の 3 段）。検証ジョブ（`kit validate`）が成果物の `report.json` に書き、
 * backend-py が `validation-reports/projects/{project_id}/versions/{version_id}/runs/{run_id}.json` に保存する。検証器は Storage も DB も知らない。
 */
export declare const VALIDATION_STAGES: readonly ["import", "static", "dynamic"];
export declare const validationStageSchema: z.ZodEnum<{
    import: "import";
    static: "static";
    dynamic: "dynamic";
}>;
export type ValidationStage = z.infer<typeof validationStageSchema>;
export declare const VALIDATION_STATUSES: readonly ["passed", "failed", "skipped"];
export declare const validationStatusSchema: z.ZodEnum<{
    failed: "failed";
    passed: "passed";
    skipped: "skipped";
}>;
export type ValidationStatus = z.infer<typeof validationStatusSchema>;
export declare const findingSchema: z.ZodObject<{
    code: z.ZodString;
    message: z.ZodString;
    path: z.ZodOptional<z.ZodString>;
}, z.core.$strict>;
export type Finding = z.infer<typeof findingSchema>;
export declare const stageReportSchema: z.ZodObject<{
    stage: z.ZodEnum<{
        import: "import";
        static: "static";
        dynamic: "dynamic";
    }>;
    status: z.ZodEnum<{
        failed: "failed";
        passed: "passed";
        skipped: "skipped";
    }>;
    startedAt: z.ZodISODateTime;
    finishedAt: z.ZodISODateTime;
    errors: z.ZodArray<z.ZodObject<{
        code: z.ZodString;
        message: z.ZodString;
        path: z.ZodOptional<z.ZodString>;
    }, z.core.$strict>>;
    warnings: z.ZodArray<z.ZodObject<{
        code: z.ZodString;
        message: z.ZodString;
        path: z.ZodOptional<z.ZodString>;
    }, z.core.$strict>>;
}, z.core.$strict>;
export type StageReport = z.infer<typeof stageReportSchema>;
export declare const VALIDATION_SCREENSHOT_PURPOSES: readonly ["listing", "review"];
export declare const validationScreenshotSchema: z.ZodObject<{
    app: z.ZodString;
    principal: z.ZodEnum<{
        anonymous: "anonymous";
        member: "member";
        admin: "admin";
    }>;
    purpose: z.ZodEnum<{
        listing: "listing";
        review: "review";
    }>;
    path: z.ZodString;
}, z.core.$strict>;
export type ValidationScreenshot = z.infer<typeof validationScreenshotSchema>;
export declare const reportSchema: z.ZodObject<{
    validatorVersion: z.ZodString;
    artifactHash: z.ZodNullable<z.ZodString>;
    index: z.ZodNullable<z.ZodObject<{
        version: z.ZodLiteral<1>;
        artifactHash: z.ZodString;
        apps: z.ZodRecord<z.ZodString, z.ZodObject<{
            entry: z.ZodString;
            artifactHash: z.ZodString;
            bytes: z.ZodNumber;
            fileCount: z.ZodNumber;
        }, z.core.$strict>>;
        files: z.ZodArray<z.ZodObject<{
            path: z.ZodString;
            sha256: z.ZodString;
            size: z.ZodNumber;
        }, z.core.$strict>>;
    }, z.core.$strict>>;
    schema: z.ZodNullable<z.ZodObject<{
        schemaVersion: z.ZodString;
        policyVersion: z.ZodString;
        policyVersionFormat: z.ZodOptional<z.ZodNumber>;
        migrationHash: z.ZodString;
        changes: z.ZodArray<z.ZodObject<{
            kind: z.ZodString;
            table: z.ZodString;
            column: z.ZodOptional<z.ZodString>;
            index: z.ZodOptional<z.ZodString>;
            columns: z.ZodOptional<z.ZodArray<z.ZodString>>;
            destructive: z.ZodBoolean;
            reason: z.ZodOptional<z.ZodString>;
        }, z.core.$strict>>;
        migrationIds: z.ZodArray<z.ZodString>;
        destructiveChanges: z.ZodArray<z.ZodObject<{
            migration: z.ZodString;
            changes: z.ZodArray<z.ZodObject<{
                kind: z.ZodString;
                table: z.ZodString;
                column: z.ZodOptional<z.ZodString>;
                index: z.ZodOptional<z.ZodString>;
                columns: z.ZodOptional<z.ZodArray<z.ZodString>>;
                destructive: z.ZodBoolean;
                reason: z.ZodOptional<z.ZodString>;
            }, z.core.$strict>>;
            intent: z.ZodUnion<[z.ZodArray<z.ZodUnion<readonly [z.ZodObject<{
                rename: z.ZodObject<{
                    table: z.ZodString;
                    from: z.ZodString;
                    to: z.ZodString;
                }, z.core.$strict>;
            }, z.core.$strict>, z.ZodObject<{
                drop: z.ZodObject<{
                    table: z.ZodString;
                    column: z.ZodOptional<z.ZodString>;
                }, z.core.$strict>;
            }, z.core.$strict>, z.ZodObject<{
                retype: z.ZodObject<{
                    table: z.ZodString;
                    column: z.ZodString;
                    to: z.ZodString;
                }, z.core.$strict>;
            }, z.core.$strict>, z.ZodObject<{
                contract: z.ZodObject<{
                    table: z.ZodString;
                    column: z.ZodOptional<z.ZodString>;
                }, z.core.$strict>;
            }, z.core.$strict>]>>, z.ZodTuple<[], null>]>;
        }, z.core.$strict>>;
        schemaColumns: z.ZodRecord<z.ZodString, z.ZodArray<z.ZodString>>;
    }, z.core.$strict>>;
    manifest: z.ZodNullable<z.ZodObject<{
        version: z.ZodLiteral<1>;
        sdkVersion: z.ZodLiteral<3>;
        apps: z.ZodRecord<z.ZodString, z.ZodObject<{
            kind: z.ZodEnum<{
                web: "web";
                api: "api";
                jobs: "jobs";
            }>;
            access: z.ZodOptional<z.ZodEnum<{
                public: "public";
                restricted: "restricted";
            }>>;
            displayName: z.ZodOptional<z.ZodObject<{
                ja: z.ZodString;
                en: z.ZodString;
            }, z.core.$strict>>;
            requiredPermission: z.ZodOptional<z.ZodString>;
            capabilities: z.ZodOptional<z.ZodObject<{
                models: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodArray<z.ZodEnum<{
                    read: "read";
                    create: "create";
                    update: "update";
                    delete: "delete";
                }>>>>;
                buckets: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodArray<z.ZodEnum<{
                    read: "read";
                    delete: "delete";
                    write: "write";
                }>>>>;
                realtime: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodArray<z.ZodEnum<{
                    broadcastReceive: "broadcastReceive";
                    broadcastSend: "broadcastSend";
                    presenceRead: "presenceRead";
                    presenceTrack: "presenceTrack";
                }>>>>;
            }, z.core.$strict>>;
            anonymous: z.ZodOptional<z.ZodObject<{
                allowed: z.ZodBoolean;
                write: z.ZodBoolean;
            }, z.core.$strict>>;
            network: z.ZodOptional<z.ZodObject<{
                egress: z.ZodOptional<z.ZodArray<z.ZodString>>;
                browser: z.ZodOptional<z.ZodArray<z.ZodString>>;
            }, z.core.$strict>>;
            secrets: z.ZodOptional<z.ZodArray<z.ZodObject<{
                name: z.ZodString;
                description: z.ZodOptional<z.ZodObject<{
                    ja: z.ZodString;
                    en: z.ZodString;
                }, z.core.$strict>>;
                required: z.ZodOptional<z.ZodBoolean>;
            }, z.core.$strict>>>;
            servicePermissions: z.ZodOptional<z.ZodArray<z.ZodEnum<{
                "notifications.send": "notifications.send";
                "jobs.schedule": "jobs.schedule";
                "jobs.consume": "jobs.consume";
            }>>>;
            schedules: z.ZodOptional<z.ZodArray<z.ZodObject<{
                cron: z.ZodString;
                handler: z.ZodString;
            }, z.core.$strict>>>;
            routes: z.ZodOptional<z.ZodArray<z.ZodLiteral<"/api/*">>>;
        }, z.core.$strict>>;
        buckets: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodObject<{
            public: z.ZodBoolean;
            maxBytes: z.ZodNumber;
            contentTypes: z.ZodArray<z.ZodString>;
            delivery: z.ZodOptional<z.ZodEnum<{
                signed: "signed";
                proxy: "proxy";
            }>>;
            appScoped: z.ZodOptional<z.ZodBoolean>;
        }, z.core.$strict>>>;
        roles: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodArray<z.ZodString>>>;
        defaultRoles: z.ZodOptional<z.ZodArray<z.ZodString>>;
        ownerBootstrap: z.ZodOptional<z.ZodArray<z.ZodString>>;
        notifications: z.ZodOptional<z.ZodObject<{
            templates: z.ZodRecord<z.ZodString, z.ZodObject<{
                app: z.ZodOptional<z.ZodString>;
                category: z.ZodOptional<z.ZodString>;
                title: z.ZodObject<{
                    ja: z.ZodString;
                    en: z.ZodString;
                }, z.core.$strict>;
                body: z.ZodObject<{
                    ja: z.ZodString;
                    en: z.ZodString;
                }, z.core.$strict>;
                params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodObject<{
                    maxLength: z.ZodNumber;
                }, z.core.$strict>>>;
                path: z.ZodOptional<z.ZodString>;
            }, z.core.$strict>>;
            triggers: z.ZodOptional<z.ZodArray<z.ZodObject<{
                on: z.ZodObject<{
                    model: z.ZodString;
                    op: z.ZodEnum<{
                        create: "create";
                        update: "update";
                        delete: "delete";
                    }>;
                    when: z.ZodOptional<z.ZodObject<{
                        changed: z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>;
                    }, z.core.$strict>>;
                }, z.core.$strict>;
                template: z.ZodString;
                to: z.ZodObject<{
                    field: z.ZodString;
                }, z.core.$strict>;
                params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                except: z.ZodOptional<z.ZodLiteral<"actor">>;
            }, z.core.$strict>>>;
        }, z.core.$strict>>;
        realtime: z.ZodOptional<z.ZodObject<{
            models: z.ZodDefault<z.ZodArray<z.ZodString>>;
            channels: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodObject<{
                scope: z.ZodDefault<z.ZodLiteral<"app">>;
                model: z.ZodString;
                key: z.ZodString;
                events: z.ZodOptional<z.ZodArray<z.ZodString>>;
                actions: z.ZodObject<{
                    broadcastReceive: z.ZodString;
                    broadcastSend: z.ZodString;
                    presenceRead: z.ZodString;
                    presenceTrack: z.ZodString;
                }, z.core.$strict>;
            }, z.core.$strict>>>;
        }, z.core.$strict>>;
    }, z.core.$strict>>;
    normalized: z.ZodNullable<z.ZodObject<{
        manifest: z.ZodRecord<z.ZodString, z.ZodUnknown>;
        apps: z.ZodArray<z.ZodObject<{
            slug: z.ZodString;
            kind: z.ZodString;
            access: z.ZodString;
            entry: z.ZodString;
        }, z.core.$loose>>;
    }, z.core.$strict>>;
    screenshots: z.ZodArray<z.ZodObject<{
        app: z.ZodString;
        principal: z.ZodEnum<{
            anonymous: "anonymous";
            member: "member";
            admin: "admin";
        }>;
        purpose: z.ZodEnum<{
            listing: "listing";
            review: "review";
        }>;
        path: z.ZodString;
    }, z.core.$strict>>;
    stages: z.ZodArray<z.ZodObject<{
        stage: z.ZodEnum<{
            import: "import";
            static: "static";
            dynamic: "dynamic";
        }>;
        status: z.ZodEnum<{
            failed: "failed";
            passed: "passed";
            skipped: "skipped";
        }>;
        startedAt: z.ZodISODateTime;
        finishedAt: z.ZodISODateTime;
        errors: z.ZodArray<z.ZodObject<{
            code: z.ZodString;
            message: z.ZodString;
            path: z.ZodOptional<z.ZodString>;
        }, z.core.$strict>>;
        warnings: z.ZodArray<z.ZodObject<{
            code: z.ZodString;
            message: z.ZodString;
            path: z.ZodOptional<z.ZodString>;
        }, z.core.$strict>>;
    }, z.core.$strict>>;
    passed: z.ZodBoolean;
}, z.core.$strict>;
export type ValidationReport = z.infer<typeof reportSchema>;
