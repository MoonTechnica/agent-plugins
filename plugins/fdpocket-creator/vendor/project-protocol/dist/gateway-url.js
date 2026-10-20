/** Shared URL rule for Host clients and Platform runtime components. */
export function resolveProjectGatewayUrl(input) {
    if (input.explicitUrl) {
        if (new URL(input.explicitUrl).pathname.startsWith('/functions/v1/project-gateway')) {
            throw new Error('Project Gateway must use the Cloudflare Worker endpoint');
        }
        return input.explicitUrl.replace(/\/+$/, '');
    }
    if (input.appsDomain?.endsWith('.workers.dev')) {
        return `https://platform-gateway.${input.appsDomain}`;
    }
    return 'http://127.0.0.1:8787';
}
