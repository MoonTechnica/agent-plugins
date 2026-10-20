import { workspaceAnswerRequestSchema, workspaceCreateRequestSchema, workspaceInvitationCreatedSchema, workspaceInvitationsResponseSchema, workspaceInviteRequestSchema, workspaceMembershipSchema, workspaceSchema, } from '@workspace/project-protocol';
import { SdkError } from "../errors.js";
/** 送る前に形を確かめる（送ってから 422 になるより早く、何が違うかを返す） */
function checked(schema, value, what) {
    const parsed = schema.safeParse(value);
    if (!parsed.success)
        throw new SdkError('VALIDATION_FAILED', `invalid ${what}`);
    return parsed.data;
}
function read(schema, value) {
    const parsed = schema.safeParse(value);
    if (!parsed.success) {
        throw new SdkError('GATEWAY_UNAVAILABLE', 'unexpected workspace response', { retryable: true });
    }
    return parsed.data;
}
const path = (workspaceId, action) => `/v1/workspaces/${encodeURIComponent(workspaceId)}/${action}`;
export function createWorkspaces(transport) {
    return {
        async create(input) {
            const body = checked(workspaceCreateRequestSchema, input, 'workspace');
            return read(workspaceSchema, await transport.send('/v1/workspaces', { method: 'POST', body }));
        },
        async invite(workspaceId, input) {
            const body = checked(workspaceInviteRequestSchema, input, 'invitation');
            return read(workspaceInvitationCreatedSchema, await transport.send(path(workspaceId, 'invitations'), { method: 'POST', body }));
        },
        async invitations() {
            return read(workspaceInvitationsResponseSchema, await transport.send('/v1/workspaces/invitations')).invitations;
        },
        async accept(workspaceId, invitationId) {
            const body = checked(workspaceAnswerRequestSchema, { invitationId }, 'invitation');
            return read(workspaceMembershipSchema, await transport.send(path(workspaceId, 'accept'), { method: 'POST', body }));
        },
        async decline(workspaceId, invitationId) {
            const body = checked(workspaceAnswerRequestSchema, { invitationId }, 'invitation');
            await transport.send(path(workspaceId, 'decline'), { method: 'POST', body });
        },
    };
}
