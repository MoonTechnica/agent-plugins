import { QueryClientProvider } from '@tanstack/react-query';
import { QuerySettingsProvider } from '@zenstackhq/tanstack-query/react';
import { createContext, createElement, useContext, useMemo, useSyncExternalStore, } from 'react';
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
const ProjectContext = createContext(null);
export function ProjectProvider(props) {
    const { client, queryClient, children } = props;
    const settings = useMemo(() => ({ endpoint: `${client.gateway}/v1/db`, fetch: client.fetch }), [client]);
    return createElement(ProjectContext.Provider, { value: client }, createElement(QueryClientProvider, { client: queryClient }, createElement(QuerySettingsProvider, { value: settings }, children)));
}
/** Provider の client（`auth` / `storage` / `ui`） */
export function useProjectClient() {
    const client = useContext(ProjectContext);
    if (!client)
        throw new Error('useProjectClient must be used inside <ProjectProvider>');
    return client;
}
/** 現在の Session（無ければ null）。受け取り・更新・失効で描画し直す */
export function useSession() {
    const { auth } = useProjectClient();
    return useSyncExternalStore((onChange) => auth.onChange(onChange), () => auth.session());
}
/** Host の表示言語。接続・失効で更新し、単独起動時はブラウザ言語に従う。 */
export function useLocale() {
    const { auth, ui } = useProjectClient();
    return useSyncExternalStore((onChange) => auth.onChange(onChange), () => ui.locale());
}
/** Host のセーフエリア（埋め込まれていなければ 0） */
export function useSafeArea() {
    const { ui } = useProjectClient();
    return useSyncExternalStore((onChange) => ui.onSafeAreaChange(onChange), () => ui.safeArea());
}
