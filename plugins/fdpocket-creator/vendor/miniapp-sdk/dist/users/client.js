import { userInvitationResult, userInvitationsResponse, userInviteRequestSchema, } from '@workspace/project-protocol';
import { SdkError } from "../errors.js";
function checked(schema, value) {
    const parsed = schema.safeParse(value);
    if (!parsed.success)
        throw new SdkError('VALIDATION_FAILED', 'invalid invitation');
    return parsed.data;
}
function read(schema, value) {
    const parsed = schema.safeParse(value);
    if (!parsed.success) {
        throw new SdkError('GATEWAY_UNAVAILABLE', 'unexpected user invitation response', {
            retryable: true,
        });
    }
    return parsed.data;
}
const PATH = '/v1/project/user-invitations';
export function createUsers(transport) {
    return {
        async invite(input) {
            const body = checked(userInviteRequestSchema, input);
            return read(userInvitationResult.wire, await transport.send(PATH, { method: 'POST', body }));
        },
        invitations: {
            async list() {
                return read(userInvitationsResponse.wire, await transport.send(PATH)).invitations;
            },
        },
    };
}
