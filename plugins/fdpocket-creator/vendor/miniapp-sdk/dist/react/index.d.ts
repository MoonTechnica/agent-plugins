import { type QueryClient } from '@tanstack/react-query';
import type { SafeAreaInsets, Session } from '@workspace/project-protocol';
import { type ReactElement, type ReactNode } from 'react';
import type { ProjectClient } from '../client.ts';
/**
 * `@workspace/miniapp-sdk/react`（sdk.md §3.6）。データのフックは ZenStack 公式
 * （`@zenstackhq/tanstack-query/react`）をそのまま使い、自前のラッパは書かない。
 * Provider が endpoint（`{gateway}/v1/db`）と SDK の fetch（トークン付き・失敗は SdkError）を渡す。
 *
 * ```ts
 * const hooks = useClientQueries(schema)
 * const docs = hooks.document.useFindMany({ where: { workspaceId } })
 * const pages = hooks.document.useInfiniteFindMany({ take: 20 }, { getNextPageParam })
 * ```
 * queryKey は ZenStack の形（`getQueryKey`）。書き込みのフックは関係するモデルのクエリを自動で読み直す。
 * `$transaction` のフックは型に出るが Gateway が受けない（sdk.md §3.2）。
 */
export { getQueryKey, useClientQueries, useModelQueries, } from '@zenstackhq/tanstack-query/react';
/**
 * Provider が持つ client の部分（Schema に依らないもの）。`db` は ZenStack のフックか、
 * App が作った client をそのまま使う（Schema の型どうしを比べさせない）
 */
export type ProjectClientCore = Omit<ProjectClient, 'db' | 'idempotent'>;
export declare function ProjectProvider(props: {
    client: ProjectClientCore;
    queryClient: QueryClient;
    children?: ReactNode;
}): ReactElement;
/** Provider の client（`auth` / `storage` / `ui`） */
export declare function useProjectClient(): ProjectClientCore;
/** 現在の Session（無ければ null）。受け取り・更新・失効で描画し直す */
export declare function useSession(): Session | null;
/** Host の表示言語。接続・失効で更新し、単独起動時はブラウザ言語に従う。 */
export declare function useLocale(): string;
/** Host のセーフエリア（埋め込まれていなければ 0） */
export declare function useSafeArea(): SafeAreaInsets;
