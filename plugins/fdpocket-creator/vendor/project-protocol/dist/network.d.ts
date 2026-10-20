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
export type EgressDenyReason = 'invalid_url' | 'not_https' | 'port' | 'credentials' | 'ip_literal' | 'internal_host' | 'platform_host' | 'not_declared';
export type EgressDecision = {
    allowed: true;
    host: string;
} | {
    allowed: false;
    reason: EgressDenyReason;
    host?: string;
};
export interface EgressPolicy {
    /** `network.egress` の宣言 */
    egress: readonly string[];
    /** Project Gateway の URL（`{SUPABASE_URL}/functions/v1/project-gateway`）。このパスの下だけは常に通す */
    gatewayUrl?: string;
}
export type NetworkDeclarationIssue = 'invalid_host' | 'invalid_origin' | 'ip_literal' | 'internal_host' | 'platform_host';
/** Platform の資格情報で守っている宛先（第三者のコードから直接触らせない） */
export declare const PLATFORM_HOST_SUFFIXES: readonly ["supabase.co", "supabase.in", "turso.io", "r2.cloudflarestorage.com", "r2.dev"];
/** `pattern` は宣言（`api.stripe.com` か `*.googleapis.com`）。ワイルドカードはサブドメインだけ */
export declare function matchesEgressHost(host: string, pattern: string): boolean;
/** `network.egress` の 1 件の宣言の誤り（正しければ null） */
export declare function egressDeclarationIssue(declaration: string): NetworkDeclarationIssue | null;
/** `network.browser` の 1 件の宣言（`https://host` か `https://*.host`。パス・ポート・末尾の `/` は不可） */
export declare function browserOriginIssue(declaration: string): NetworkDeclarationIssue | null;
/** outbound Worker が 1 回の `fetch` を通すか（integrations.md §3.1） */
export declare function checkEgress(input: string, policy: EgressPolicy): EgressDecision;
