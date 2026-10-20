/**
 * ミニアプリの外向き通信の宣言と判定（integrations.md §3.1・§3.3）。
 *
 * - `apps.<slug>.network.egress`: api / jobs が `fetch` できるホスト（`api.stripe.com` / `*.googleapis.com`）。
 *   outbound Worker（`infra/workers/outbound`）がこの判定で全 `fetch` を通す / 止める。
 * - `apps.<slug>.network.browser`: ブラウザから直接呼べる https のオリジン（CSP に足す）。
 *
 * 宣言に書いてあっても止めるもの: http・既定以外のポート・URL の資格情報・IP 直指定・内部向けの名前・
 * Platform 自身のホスト（Supabase / Turso / R2）。Gateway だけは宣言が無くても常に通す（サーバー SDK の宛先）。
 * 葉のモジュール（依存なし）なので Worker からも import できる（`@workspace/project-protocol/network`）。
 */
/** 小文字の DNS 名（2 ラベル以上、TLD は英字）。先頭に `*.` を 1 つだけ付けられる */
const HOST_LABEL = '[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?';
const HOST_PATTERN = new RegExp(`^(?:\\*\\.)?(?:${HOST_LABEL}\\.)+[a-z]{2,63}$`);
/** ワイルドカードの後ろは 2 ラベル以上（`*.com` のような TLD 全体は不可） */
const WILDCARD_PATTERN = new RegExp(`^\\*\\.${HOST_LABEL}\\.(?:${HOST_LABEL}\\.)*[a-z]{2,63}$`);
const INTERNAL_SUFFIXES = [
    '.localhost',
    '.local',
    '.internal',
    '.lan',
    '.home.arpa',
    '.intranet',
];
/** Platform の資格情報で守っている宛先（第三者のコードから直接触らせない） */
export const PLATFORM_HOST_SUFFIXES = [
    'supabase.co',
    'supabase.in',
    'turso.io',
    'r2.cloudflarestorage.com',
    'r2.dev',
];
function normalizeHost(host) {
    return host.toLowerCase().replace(/\.$/, '');
}
function isIpLiteral(host) {
    // WHATWG URL は 10 進・16 進・省略形の IPv4 を a.b.c.d に直し、IPv6 は [] で包む
    return host.startsWith('[') || /^\d{1,3}(?:\.\d{1,3}){3}$/.test(host);
}
function hasSuffix(host, suffix) {
    return host === suffix || host.endsWith(`.${suffix}`);
}
function isInternal(host) {
    return (host === 'localhost' ||
        !host.includes('.') ||
        INTERNAL_SUFFIXES.some((suffix) => host.endsWith(suffix)));
}
function isPlatformHost(host) {
    return PLATFORM_HOST_SUFFIXES.some((suffix) => hasSuffix(host, suffix));
}
/** `pattern` は宣言（`api.stripe.com` か `*.googleapis.com`）。ワイルドカードはサブドメインだけ */
export function matchesEgressHost(host, pattern) {
    const target = normalizeHost(host);
    if (pattern.startsWith('*.'))
        return target.endsWith(pattern.slice(1)) && target !== pattern.slice(2);
    return target === pattern;
}
function hostIssue(host) {
    if (isIpLiteral(host))
        return 'ip_literal';
    const bare = host.startsWith('*.') ? host.slice(2) : host;
    if (isInternal(bare))
        return 'internal_host';
    if (isPlatformHost(bare))
        return 'platform_host';
    return null;
}
/** `network.egress` の 1 件の宣言の誤り（正しければ null） */
export function egressDeclarationIssue(declaration) {
    if (isIpLiteral(declaration))
        return 'ip_literal';
    if (!HOST_PATTERN.test(declaration))
        return 'invalid_host';
    if (declaration.startsWith('*.') && !WILDCARD_PATTERN.test(declaration))
        return 'invalid_host';
    return hostIssue(declaration);
}
/** `network.browser` の 1 件の宣言（`https://host` か `https://*.host`。パス・ポート・末尾の `/` は不可） */
export function browserOriginIssue(declaration) {
    if (!declaration.startsWith('https://'))
        return 'invalid_origin';
    const host = declaration.slice('https://'.length);
    if (isIpLiteral(host))
        return 'ip_literal';
    if (!HOST_PATTERN.test(host))
        return 'invalid_origin';
    if (host.startsWith('*.') && !WILDCARD_PATTERN.test(host))
        return 'invalid_origin';
    return hostIssue(host);
}
function isGateway(url, gatewayUrl) {
    if (!gatewayUrl)
        return false;
    const gateway = new URL(gatewayUrl);
    const base = gateway.pathname.endsWith('/') ? gateway.pathname : `${gateway.pathname}/`;
    return (url.origin === gateway.origin &&
        (url.pathname === gateway.pathname || url.pathname.startsWith(base)));
}
/** outbound Worker が 1 回の `fetch` を通すか（integrations.md §3.1） */
export function checkEgress(input, policy) {
    let url;
    try {
        url = new URL(input);
    }
    catch {
        // 呼び出し元（Worker）は拒否の応答を返す。URL の形の誤りは拒否の理由として扱う
        return { allowed: false, reason: 'invalid_url' };
    }
    const host = normalizeHost(url.hostname);
    if (isGateway(url, policy.gatewayUrl))
        return { allowed: true, host };
    if (url.protocol !== 'https:')
        return { allowed: false, reason: 'not_https', host };
    if (url.username !== '' || url.password !== '')
        return { allowed: false, reason: 'credentials', host };
    if (url.port !== '')
        return { allowed: false, reason: 'port', host };
    if (isIpLiteral(host))
        return { allowed: false, reason: 'ip_literal', host };
    if (isInternal(host))
        return { allowed: false, reason: 'internal_host', host };
    if (isPlatformHost(host))
        return { allowed: false, reason: 'platform_host', host };
    if (!policy.egress.some((pattern) => matchesEgressHost(host, pattern))) {
        return { allowed: false, reason: 'not_declared', host };
    }
    return { allowed: true, host };
}
