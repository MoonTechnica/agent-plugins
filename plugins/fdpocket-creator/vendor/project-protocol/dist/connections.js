import { z } from 'zod';
/** Platform-managed read integrations. Provider credentials and URLs are never SDK inputs. */
export const CONNECTION_SERVICES = [
    {
        id: 'google-drive',
        provider: 'google',
        label: { ja: 'Google ドライブ・ドキュメント', en: 'Google Drive and documents' },
    },
    { id: 'google-mail', provider: 'google', label: { ja: 'Gmail', en: 'Gmail' } },
    {
        id: 'google-calendar',
        provider: 'google',
        label: { ja: 'Google カレンダー', en: 'Google Calendar' },
    },
    {
        id: 'google-contacts',
        provider: 'google',
        label: { ja: 'Google コンタクト', en: 'Google Contacts' },
    },
    {
        id: 'microsoft-files',
        provider: 'microsoft',
        label: { ja: 'OneDrive', en: 'OneDrive' },
    },
    {
        id: 'microsoft-mail',
        provider: 'microsoft',
        label: { ja: 'Outlook メール', en: 'Outlook Mail' },
    },
    {
        id: 'microsoft-calendar',
        provider: 'microsoft',
        label: { ja: 'Outlook カレンダー', en: 'Outlook Calendar' },
    },
    {
        id: 'microsoft-contacts',
        provider: 'microsoft',
        label: { ja: 'Outlook 連絡先', en: 'Outlook Contacts' },
    },
];
export const CONNECTION_SERVICE_IDS = CONNECTION_SERVICES.map((service) => service.id);
export const connectionServiceSchema = z.enum(CONNECTION_SERVICE_IDS);
export const CONNECTION_READ_TOOL = 'fdpocket-read';
export const connectionToolsSchema = z.array(z.literal(CONNECTION_READ_TOOL)).length(1);
export const connectionCapabilitiesSchema = z.partialRecord(connectionServiceSchema, connectionToolsSchema);
export const connectionRequestSchema = z.strictObject({ provider: connectionServiceSchema });
export const connectionRequestResultSchema = z.object({
    requestId: z.uuid(),
    tools: connectionToolsSchema,
    expiresAt: z.iso.datetime(),
});
export const connectionPermissionRequestResultSchema = z.union([
    connectionRequestResultSchema,
    z.object({ grantId: z.uuid(), status: z.literal('approved') }),
]);
export const connectionGrantResultSchema = z.strictObject({ grantId: z.uuid() });
export const connectionCallSchema = z.strictObject({
    grantId: z.uuid(),
    tool: z.literal(CONNECTION_READ_TOOL),
    input: z.record(z.string(), z.unknown()),
});
export const connectionCallResultSchema = z.strictObject({ result: z.unknown() });
export const connectionScopeSchema = z.strictObject({
    userId: z.uuid(),
    projectId: z.uuid(),
    environmentId: z.uuid(),
    appSlug: z.string().regex(/^[a-z][a-z0-9-]{1,31}$/),
    jti: z.uuid(),
});
export const connectionAuthorizationSchema = z.object({
    grantId: z.uuid(),
    provider: connectionServiceSchema,
    integrationId: z.string().min(1).max(128),
    connectionId: z.string().min(1).max(256),
    generation: z.int().positive(),
    contractHash: z.string().min(1),
    tools: connectionToolsSchema,
});
