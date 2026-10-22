const LOCAL_APPS_DOMAIN = /^(?:(?:[a-z0-9-]+\.)*localhost|127\.0\.0\.1)(?::\d+)?$/i;
/** Doppler keeps not-yet-decided keys as this value; it means "not configured". */
const UNSET_PLACEHOLDER = '__PLACEHOLDER__';
/** The configured apps domain, or null when empty or still a Doppler placeholder. */
export function configuredAppsDomain(value) {
    const trimmed = value?.trim();
    return trimmed && trimmed !== UNSET_PLACEHOLDER ? trimmed : null;
}
/**
 * Shared URL rule for Host clients and Platform runtime components.
 *
 * - explicit URL: always wins.
 * - `{subdomain}.workers.dev` apps domain: the account's `platform-gateway` Worker.
 * - custom apps domain (e.g. `fdpocket.dev`): the Gateway is not on that domain,
 *   so the explicit URL is required. Missing it is a configuration error, never a
 *   silent fallback to the local Worker.
 * - unset / local apps domain: the local Worker (`gateway-local`).
 */
export function resolveProjectGatewayUrl(input) {
    if (input.explicitUrl) {
        if (new URL(input.explicitUrl).pathname.startsWith('/functions/v1/project-gateway')) {
            throw new Error('Project Gateway must use the Cloudflare Worker endpoint');
        }
        return input.explicitUrl.replace(/\/+$/, '');
    }
    const appsDomain = configuredAppsDomain(input.appsDomain);
    if (appsDomain?.endsWith('.workers.dev')) {
        return `https://platform-gateway.${appsDomain}`;
    }
    if (appsDomain && !LOCAL_APPS_DOMAIN.test(appsDomain)) {
        throw new Error(`An explicit Project Gateway URL is required for the custom apps domain ${appsDomain}`);
    }
    return 'http://127.0.0.1:8787';
}
