import { CONNECTION_READ_TOOL, connectionCallResultSchema, connectionCallSchema, connectionGrantResultSchema, } from '@workspace/project-protocol';
import { SdkError } from "../errors.js";
export function createConnections(transport, bridge) {
    return {
        ...createConnectionReader(transport),
        async request(provider) {
            const result = await bridge.request('connections.requestPermission', { provider });
            if (result === null)
                return null;
            const parsed = connectionGrantResultSchema.safeParse(result);
            if (!parsed.success)
                throw new SdkError('HOST_UNAVAILABLE', 'invalid connection permission result');
            return parsed.data;
        },
    };
}
/** Server Apps may read only while acting as the original, verified user launch. */
export function createConnectionReader(transport) {
    return {
        async read(grantId, input) {
            const body = connectionCallSchema.safeParse({ grantId, tool: CONNECTION_READ_TOOL, input });
            if (!body.success)
                throw new SdkError('VALIDATION_FAILED', 'invalid connection request');
            const result = connectionCallResultSchema.safeParse(await transport.send('/v1/connections/call', { method: 'POST', body: body.data }));
            if (!result.success)
                throw new SdkError('GATEWAY_UNAVAILABLE', 'invalid connection response');
            return result.data.result;
        },
    };
}
