import { z } from 'zod';
import { artifactIndexSchema } from "./artifact.js";
import { pendingIntentSchema } from "./intent.js";
import { projectManifestSchema } from "./manifest.js";
/**
 * 検証レポート（sdk.md §8。取り込み / 静的 / 動的の 3 段）。検証ジョブ（`kit validate`）が成果物の `report.json` に書き、
 * backend-py が `validation-reports/projects/{project_id}/versions/{version_id}/runs/{run_id}.json` に保存する。検証器は Storage も DB も知らない。
 */
export const VALIDATION_STAGES = ['import', 'static', 'dynamic'];
export const validationStageSchema = z.enum(VALIDATION_STAGES);
export const VALIDATION_STATUSES = ['passed', 'failed', 'skipped'];
export const validationStatusSchema = z.enum(VALIDATION_STATUSES);
export const findingSchema = z.strictObject({
    code: z.string().min(1),
    message: z.string().min(1),
    path: z.string().optional(),
});
export const stageReportSchema = z.strictObject({
    stage: validationStageSchema,
    status: validationStatusSchema,
    startedAt: z.iso.datetime(),
    finishedAt: z.iso.datetime(),
    errors: z.array(findingSchema),
    warnings: z.array(findingSchema),
});
export const VALIDATION_SCREENSHOT_PURPOSES = ['listing', 'review'];
export const validationScreenshotSchema = z.strictObject({
    app: z.string().min(1),
    principal: z.enum(['member', 'admin', 'anonymous']),
    purpose: z.enum(VALIDATION_SCREENSHOT_PURPOSES),
    path: z.string().regex(/^screenshots\/[a-z0-9-]+\.png$/),
});
const schemaChangeSchema = z.strictObject({
    kind: z.string(),
    table: z.string(),
    column: z.string().optional(),
    index: z.string().optional(),
    columns: z.array(z.string()).optional(),
    destructive: z.boolean(),
    reason: z.string().optional(),
});
export const reportSchema = z.strictObject({
    validatorVersion: z.string().min(1),
    /** import が通らなかったときは `null`（ハッシュを出す前に落ちている）。 */
    artifactHash: z
        .string()
        .regex(/^[0-9a-f]{64}$/)
        .nullable(),
    /** Platform が作り直したハッシュ一覧（`project_versions.artifact_apps` の正本）。import が通らなければ `null` */
    index: artifactIndexSchema.nullable(),
    /** Platform が作り直したスキーマの版（gateway.md §2.1）。作り直せなかったときは `null` */
    schema: z
        .strictObject({
        schemaVersion: z.string().regex(/^[0-9a-f]{16}$/),
        policyVersion: z.string().regex(/^[0-9a-f]{16}$/),
        /** Missing on legacy reports; they cannot approve authorization-sensitive changes. */
        policyVersionFormat: z.number().int().min(1).max(2).optional(),
        migrationHash: z.string().regex(/^[0-9a-f]{16}$/),
        changes: z.array(schemaChangeSchema),
        /** 確定済みの migration の名前（`project_versions.migration_ids`） */
        migrationIds: z.array(z.string()),
        /** 確定済みのうち破壊的な変更か意図を持つもの（`project_versions.destructive_changes`。lifecycle.md §4） */
        destructiveChanges: z.array(z.strictObject({
            migration: z.string(),
            changes: z.array(schemaChangeSchema),
            intent: pendingIntentSchema.or(z.tuple([])),
        })),
        /** 版のスキーマ JSON が読む表 → 列（`project_versions.schema_columns`。tasks/0469） */
        schemaColumns: z.record(z.string(), z.array(z.string())),
    })
        .nullable(),
    /** 静的検証を通った `project.yaml`（正規化前）。読めなければ `null`。版の manifest はこれだけを正本にする */
    manifest: projectManifestSchema.nullable(),
    /**
     * Platform が版に書く形（`normalizeProjectManifest`。backend-py の `apply_validated_manifest` がそのまま渡す）。
     * manifest が読めなければ `null`
     */
    normalized: z
        .strictObject({
        manifest: z.record(z.string(), z.unknown()),
        apps: z.array(z.looseObject({ slug: z.string(), kind: z.string(), access: z.string(), entry: z.string() })),
    })
        .nullable(),
    /** 動的検証のスクリーンショット（`listing` は掲載用・`review` は審査 Agent 用）。path は成果物の中の相対パス */
    screenshots: z.array(validationScreenshotSchema),
    stages: z.array(stageReportSchema),
    /** 全段階が `passed` のときだけ true。公開の可否はこれ 1 つで判断できる。 */
    passed: z.boolean(),
});
