/// <reference types="node" />
import { join, resolve } from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import react from '@vitejs/plugin-react';
import { APP_SLUG_PATTERN, DELIVERY_BUILD_BASE, KIT_BUILD_ENV, KIT_LIVE_ENV, } from '@workspace/project-protocol';
import { liveClientScript } from "./live-client.js";
/**
 * `@workspace/miniapp-sdk/vite`（sdk.md §5.3）。Project の `apps/<slug>/vite.config.ts` はこれを呼ぶだけ:
 *
 * ```ts
 * import { createAppConfig } from '@workspace/miniapp-sdk/vite'
 * export default createAppConfig('web', import.meta.dirname)
 * ```
 *
 * 配信の場所（`/` と `/<slug>/`。project-runtime.md §3）、出力（Project の根の `dist/<slug>/`）、ビルド時の定数
 * （`__PROJECT_ID__` / `__GATEWAY_URL__` / `__APP_SLUG__`）を Platform の決まりどおりに揃える。定数の値は
 * `kit build` / `kit dev` が環境変数で渡す（Agent が書かない）。
 */
/**
 * よく変わらないライブラリを別のチャンクにする（Vite 8 = Rolldown の `output.codeSplitting.groups`）。
 * 1 チャンクに全部入ると 600 kB 前後になり Vite の 500 kB の警告が出る。分けると各チャンクが小さくなり、
 * App のコードだけを変えた版でもライブラリのチャンクはブラウザのキャッシュに当たる。優先度の高い順に並べる。
 * グループは一致したモジュールの依存も取り込む（Rolldown の既定 `includeDependenciesRecursively`）ので、
 * ZenStack が使う zod は `zenstack` に入る（2026-10-14 の計測: react 219 kB / zenstack 246 kB / tanstack 100 kB）。
 */
const VENDOR_CHUNKS = [
    { name: 'react', test: /[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/, priority: 40 },
    { name: 'tanstack', test: /[\\/]node_modules[\\/]@tanstack[\\/]/, priority: 30 },
    {
        name: 'zenstack',
        test: /[\\/]node_modules[\\/](@zenstackhq[\\/]|kysely[\\/]|decimal\.js[\\/])/,
        priority: 30,
    },
    { name: 'vendor', test: /[\\/]node_modules[\\/]/, priority: 10 },
];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function createAppConfig(slug, appRoot, env = process.env) {
    if (!APP_SLUG_PATTERN.test(slug)) {
        throw new Error(`app slug ${JSON.stringify(slug)} does not match ${APP_SLUG_PATTERN}`);
    }
    const projectId = required(env, KIT_BUILD_ENV.projectId);
    const gatewayUrl = required(env, KIT_BUILD_ENV.gatewayUrl);
    if (!UUID.test(projectId))
        throw new Error(`${KIT_BUILD_ENV.projectId} must be a uuid`);
    if (!/^https?:\/\//.test(gatewayUrl)) {
        throw new Error(`${KIT_BUILD_ENV.gatewayUrl} must be an http(s) URL`);
    }
    const projectRoot = resolve(appRoot, '../..');
    const src = join(appRoot, 'src');
    const appPorts = JSON.parse(env.KIT_DEV_APP_PORTS ?? '{}');
    const primaryApp = env.KIT_DEV_PRIMARY_APP;
    const port = appPorts[slug];
    const live = liveOf(env);
    const root = live?.base ?? '/';
    const base = slug === 'web' ? root : `${root}${slug}/`;
    return {
        root: appRoot,
        base,
        plugins: [
            {
                name: 'miniapp-delivery-base',
                config(_config, { command }) {
                    if (command !== 'build')
                        return;
                    return {
                        define: {
                            'import.meta.env.BASE_URL': JSON.stringify(`${DELIVERY_BUILD_BASE}${slug === 'web' ? '' : `${slug}/`}`),
                        },
                    };
                },
                transformIndexHtml: {
                    order: 'post',
                    handler(_html, context) {
                        if (context.server)
                            return;
                        return [
                            {
                                tag: 'meta',
                                attrs: {
                                    name: 'platform-delivery',
                                    content: '1',
                                    'data-base': DELIVERY_BUILD_BASE,
                                },
                                injectTo: 'head',
                            },
                        ];
                    },
                },
            },
            // Subresources stay relative to their immutable version URLs; router base is separate.
            { name: 'release-assets', apply: 'build', config: () => ({ base: './' }) },
            // ルートの生成は React のプラグインより前（TanStack Router の公式の順番）
            tanstackRouter({
                target: 'react',
                autoCodeSplitting: true,
                routesDirectory: join(src, 'routes'),
                generatedRouteTree: join(src, 'routeTree.gen.ts'),
            }),
            react(),
            tailwindcss(),
            ...(live ? [livePreviewPlugin(slug === primaryApp ? root : base)] : []),
        ],
        resolve: { alias: { '@': src } },
        define: {
            __PROJECT_ID__: JSON.stringify(projectId),
            __GATEWAY_URL__: JSON.stringify(gatewayUrl),
            __APP_SLUG__: JSON.stringify(slug),
            __PROJECT_API_BASE__: JSON.stringify(`${root}api/`),
        },
        build: {
            outDir: join(projectRoot, 'dist', slug),
            emptyOutDir: true,
            rolldownOptions: { output: { codeSplitting: { groups: VENDOR_CHUNKS } } },
        },
        server: live
            ? {
                ...(port === undefined ? {} : { port, strictPort: true }),
                // ライブプレビュー（preview.md §2.1）: Sandbox の公開ポートで待ち受ける。token の照合は
                // livePreviewPlugin（base の外は 404）。HMR は公開ポートのホスト（https）へ wss でつなぐ
                host: '0.0.0.0',
                allowedHosts: [live.hmrHost],
                ws: { protocol: 'wss', clientPort: 443, host: live.hmrHost, path: '__hmr' },
                // 中継先には Host ヘッダーを書き換えて渡す（ほかの App の Vite の allowedHosts に当たらないように）
                ...(slug === primaryApp
                    ? {
                        proxy: {
                            ...otherAppProxies(root, appPorts, slug, true),
                            ...(env.KIT_DEV_API_URL
                                ? {
                                    [`${root}api/`]: {
                                        target: env.KIT_DEV_API_URL,
                                        changeOrigin: true,
                                        rewrite: (path) => `/${path.slice(root.length)}`,
                                    },
                                }
                                : {}),
                        },
                    }
                    : {}),
            }
            : {
                ...(port === undefined ? {} : { port, strictPort: true }),
                // IPv4 に固定する（`localhost` だと ::1 だけで待ち受けることがあり、中継や Host が 127.0.0.1 を先に試して詰まる）
                host: '127.0.0.1',
                // kit dev: 本番と同じく 1 つのオリジン（web が `/`、ほかは `/<slug>/`）に載せるため、web の Vite が
                // ほかの App のパスをその App の Vite へ中継する
                ...(slug === primaryApp
                    ? {
                        proxy: {
                            ...otherAppProxies(root, appPorts, slug, false),
                            ...(env.KIT_DEV_API_URL
                                ? { '/api/': { target: env.KIT_DEV_API_URL, changeOrigin: true } }
                                : {}),
                        },
                    }
                    : {}),
                // HMR の WebSocket の upgrade は web の Vite が `vite-hmr` として自分で受けてしまい中継に届かないので、
                // ほかの App の HMR は自分の Vite のポートへ直接つなぐ（ページは web の Vite 経由のまま）
                ...(slug !== primaryApp && port !== undefined ? { ws: { clientPort: port } } : {}),
            },
    };
}
function otherAppProxies(root, appPorts, currentSlug, changeOrigin) {
    return Object.fromEntries(Object.entries(appPorts)
        .filter(([slug]) => slug !== currentSlug)
        .map(([slug, port]) => [
        `${root}${slug}/`,
        { target: `http://127.0.0.1:${port}`, ...(changeOrigin ? { changeOrigin, ws: true } : {}) },
    ]));
}
const LIVE_BASE_PATTERN = /^\/lp\/[A-Za-z0-9_-]{32,128}\/$/;
const HOSTNAME_PATTERN = /^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/;
/** `kit dev --live` が渡す設定。片方だけ・形が違うときは断る（token を照合しない設定を作らない） */
function liveOf(env) {
    const base = env[KIT_LIVE_ENV.base];
    const hmrHost = env[KIT_LIVE_ENV.hmrHost];
    if (base === undefined && hmrHost === undefined)
        return null;
    if (!base || !LIVE_BASE_PATTERN.test(base)) {
        throw new Error(`${KIT_LIVE_ENV.base} must be /lp/{token}/`);
    }
    if (!hmrHost || !HOSTNAME_PATTERN.test(hmrHost)) {
        throw new Error(`${KIT_LIVE_ENV.hmrHost} must be a host name`);
    }
    return { base, hmrHost };
}
/**
 * ライブプレビューの前段（preview.md §2.1・§2.2）: base（`/lp/{token}/…`）の外は 404（`/@fs/` なども通さない）、
 * HTML には Studio へ操作と HMR の切断を伝えるスクリプトを差し込む（`live-client.ts`）
 */
function livePreviewPlugin(base) {
    return {
        name: 'miniapp-live-preview',
        apply: 'serve',
        configureServer(server) {
            server.middlewares.use((req, res, next) => {
                if (req.url?.startsWith(base))
                    return next();
                res.statusCode = 404;
                res.end();
            });
        },
        transformIndexHtml() {
            return [
                {
                    tag: 'script',
                    attrs: { type: 'module' },
                    children: liveClientScript(),
                    injectTo: 'head',
                },
            ];
        },
    };
}
function required(env, name) {
    const value = env[name];
    if (value === undefined || value === '') {
        throw new Error(`${name} is not set; build and run the apps with kit build / kit dev`);
    }
    return value;
}
