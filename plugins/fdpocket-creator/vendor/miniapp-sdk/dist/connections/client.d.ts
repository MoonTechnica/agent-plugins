import { type ConnectionService } from '@workspace/project-protocol';
import type { Transport } from '../transport.ts';
import type { UiBridge } from '../ui/client.ts';
export interface Connections {
    /** Ask through the trusted Host after a user tap. Cancelling returns null. No OAuth tokens leave the Host. */
    request(provider: ConnectionService): Promise<{
        grantId: string;
    } | null>;
    /** Execute a managed read action on the account explicitly granted to this App and environment. */
    read(grantId: string, input: Record<string, unknown>): Promise<unknown>;
}
export declare function createConnections(transport: Transport, bridge: UiBridge): Connections;
/** Server Apps may read only while acting as the original, verified user launch. */
export declare function createConnectionReader(transport: Transport): Pick<Connections, 'read'>;
