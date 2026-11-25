import { z } from 'zod';
/**
 * main / prod の画面配信 Worker（app-asset-workers.md）。ホストのラベル 1 つにつき Worker 1 つで、
 * 配備のたびに同じ名前を上書きする。名前はラベルから決まるので、配信は DB を引かずに Worker を選べる。
 *
 * - App のホスト `{Project}--{App}[--main]` → `o-{originId}--{App}[--main]`（版のファイル + meta）
 * - 入口のホスト `{Project}[--main]` → `o-{originId}[--main]`（meta だけ）
 *
 * セッション（`--s-…`）は Sandbox のライブプレビューなので Worker を持たない（null）。
 * 組み立てはここだけ。Python（`static_assets_gateway.origin_worker_name`）・SQL は同じ規則をテストで照合する。
 */
export declare function originWorkerName(label: string): string | null;
/** Worker の中の meta（配信の判断に要る情報。DB の resolve と listing の写し） */
export declare const ORIGIN_WORKER_META_PATH = "/_platform/meta.json";
/** 版のファイルの Worker 内のパス。版を前に付けるので、上書き後に古い版のパスは 404 になる */
export declare function originWorkerAssetPath(versionId: string, path: string): string;
export declare const originWorkerMetaSchema: z.ZodObject<{
    label: z.ZodString;
    resolved: z.ZodDiscriminatedUnion<[z.ZodObject<{
        status: z.ZodLiteral<"active">;
        projectId: z.ZodUUID;
        environment: z.ZodEnum<{
            main: "main";
            session: "session";
            prod: "prod";
        }>;
        environmentId: z.ZodUUID;
        versionId: z.ZodUUID;
        noindex: z.ZodBoolean;
        app: z.ZodNullable<z.ZodString>;
        apps: z.ZodArray<z.ZodObject<{
            slug: z.ZodString;
            kind: z.ZodLiteral<"web">;
            entry: z.ZodString;
            deliveryPublic: z.ZodDefault<z.ZodBoolean>;
            dedicatedOnly: z.ZodOptional<z.ZodBoolean>;
            browserOrigins: z.ZodOptional<z.ZodArray<z.ZodString>>;
        }, z.core.$strict>>;
    }, z.core.$strict>, z.ZodObject<{
        status: z.ZodEnum<{
            not_found: "not_found";
            disabled: "disabled";
        }>;
    }, z.core.$strict>], "status">;
    listing: z.ZodNullable<z.ZodObject<{
        title: z.ZodString;
        iconKey: z.ZodNullable<z.ZodString>;
        owner: z.ZodObject<{
            accountName: z.ZodString;
            displayName: z.ZodNullable<z.ZodString>;
            avatarKey: z.ZodNullable<z.ZodString>;
        }, z.core.$strict>;
        apps: z.ZodArray<z.ZodObject<{
            slug: z.ZodString;
            displayName: z.ZodNullable<z.ZodObject<{
                ja: z.ZodOptional<z.ZodString>;
                en: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
        }, z.core.$strict>>;
    }, z.core.$strict>>;
}, z.core.$strict>;
export type OriginWorkerMeta = z.infer<typeof originWorkerMetaSchema>;
