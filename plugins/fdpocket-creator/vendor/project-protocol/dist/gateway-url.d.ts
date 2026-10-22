/** The configured apps domain, or null when empty or still a Doppler placeholder. */
export declare function configuredAppsDomain(value: string | null | undefined): string | null;
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
export declare function resolveProjectGatewayUrl(input: {
    explicitUrl?: string;
    appsDomain?: string | null;
}): string;
