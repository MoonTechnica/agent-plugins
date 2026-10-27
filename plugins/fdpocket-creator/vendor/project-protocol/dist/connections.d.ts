import { z } from 'zod';
/** Platform-managed read integrations. Provider credentials and URLs are never SDK inputs. */
export declare const CONNECTION_SERVICES: readonly [{
    readonly id: "google-drive";
    readonly provider: "google";
    readonly nangoProvider: "google-drive";
    readonly label: {
        readonly ja: "Google ドライブ・ドキュメント";
        readonly en: "Google Drive and documents";
    };
}, {
    readonly id: "google-mail";
    readonly provider: "google";
    readonly nangoProvider: "google-mail";
    readonly label: {
        readonly ja: "Gmail";
        readonly en: "Gmail";
    };
}, {
    readonly id: "google-calendar";
    readonly provider: "google";
    readonly nangoProvider: "google-calendar";
    readonly label: {
        readonly ja: "Google カレンダー";
        readonly en: "Google Calendar";
    };
}, {
    readonly id: "google-contacts";
    readonly provider: "google";
    readonly nangoProvider: "google-contacts";
    readonly label: {
        readonly ja: "Google コンタクト";
        readonly en: "Google Contacts";
    };
}, {
    readonly id: "microsoft-files";
    readonly provider: "microsoft";
    readonly nangoProvider: "microsoft-excel";
    readonly label: {
        readonly ja: "OneDrive";
        readonly en: "OneDrive";
    };
}, {
    readonly id: "microsoft-mail";
    readonly provider: "microsoft";
    readonly nangoProvider: "outlook";
    readonly label: {
        readonly ja: "Outlook メール";
        readonly en: "Outlook Mail";
    };
}, {
    readonly id: "microsoft-calendar";
    readonly provider: "microsoft";
    readonly nangoProvider: "outlook";
    readonly label: {
        readonly ja: "Outlook カレンダー";
        readonly en: "Outlook Calendar";
    };
}, {
    readonly id: "microsoft-contacts";
    readonly provider: "microsoft";
    readonly nangoProvider: "outlook";
    readonly label: {
        readonly ja: "Outlook 連絡先";
        readonly en: "Outlook Contacts";
    };
}, ...{
    id: "slack" | "notion" | "dropbox" | "box" | "salesforce" | "hubspot";
    provider: "slack" | "notion" | "dropbox" | "box" | "salesforce" | "hubspot";
    nangoProvider: "slack" | "notion" | "dropbox" | "box" | "salesforce" | "hubspot";
    label: {
        ja: "Slack" | "Notion" | "Dropbox" | "Box" | "Salesforce" | "HubSpot";
        en: "Slack" | "Notion" | "Dropbox" | "Box" | "Salesforce" | "HubSpot";
    };
}[]];
export declare const CONNECTION_SERVICE_IDS: ("google-drive" | "google-mail" | "google-calendar" | "google-contacts" | "microsoft-files" | "microsoft-mail" | "microsoft-calendar" | "microsoft-contacts" | "slack" | "notion" | "dropbox" | "box" | "salesforce" | "hubspot")[];
export declare const connectionServiceSchema: z.ZodEnum<{
    "google-drive": "google-drive";
    "google-mail": "google-mail";
    "google-calendar": "google-calendar";
    "google-contacts": "google-contacts";
    "microsoft-files": "microsoft-files";
    "microsoft-mail": "microsoft-mail";
    "microsoft-calendar": "microsoft-calendar";
    "microsoft-contacts": "microsoft-contacts";
    slack: "slack";
    notion: "notion";
    dropbox: "dropbox";
    box: "box";
    salesforce: "salesforce";
    hubspot: "hubspot";
}>;
export type ConnectionService = z.infer<typeof connectionServiceSchema>;
export declare const CONNECTION_READ_TOOL: "fdpocket-read";
export declare const connectionToolsSchema: z.ZodArray<z.ZodLiteral<"fdpocket-read">>;
export declare const connectionCapabilitiesSchema: z.ZodRecord<z.ZodEnum<{
    "google-drive": "google-drive";
    "google-mail": "google-mail";
    "google-calendar": "google-calendar";
    "google-contacts": "google-contacts";
    "microsoft-files": "microsoft-files";
    "microsoft-mail": "microsoft-mail";
    "microsoft-calendar": "microsoft-calendar";
    "microsoft-contacts": "microsoft-contacts";
    slack: "slack";
    notion: "notion";
    dropbox: "dropbox";
    box: "box";
    salesforce: "salesforce";
    hubspot: "hubspot";
}> & z.core.$partial, z.ZodArray<z.ZodLiteral<"fdpocket-read">>>;
export type ConnectionCapabilities = z.infer<typeof connectionCapabilitiesSchema>;
export declare const connectionRequestSchema: z.ZodObject<{
    provider: z.ZodEnum<{
        "google-drive": "google-drive";
        "google-mail": "google-mail";
        "google-calendar": "google-calendar";
        "google-contacts": "google-contacts";
        "microsoft-files": "microsoft-files";
        "microsoft-mail": "microsoft-mail";
        "microsoft-calendar": "microsoft-calendar";
        "microsoft-contacts": "microsoft-contacts";
        slack: "slack";
        notion: "notion";
        dropbox: "dropbox";
        box: "box";
        salesforce: "salesforce";
        hubspot: "hubspot";
    }>;
}, z.core.$strict>;
export declare const connectionRequestResultSchema: z.ZodObject<{
    requestId: z.ZodUUID;
    tools: z.ZodArray<z.ZodLiteral<"fdpocket-read">>;
    expiresAt: z.ZodISODateTime;
}, z.core.$strip>;
export declare const connectionPermissionRequestResultSchema: z.ZodUnion<readonly [z.ZodObject<{
    requestId: z.ZodUUID;
    tools: z.ZodArray<z.ZodLiteral<"fdpocket-read">>;
    expiresAt: z.ZodISODateTime;
}, z.core.$strip>, z.ZodObject<{
    grantId: z.ZodUUID;
    status: z.ZodLiteral<"approved">;
}, z.core.$strip>]>;
export declare const connectionGrantResultSchema: z.ZodObject<{
    grantId: z.ZodUUID;
}, z.core.$strict>;
export declare const connectionCallSchema: z.ZodObject<{
    grantId: z.ZodUUID;
    tool: z.ZodLiteral<"fdpocket-read">;
    input: z.ZodRecord<z.ZodString, z.ZodUnknown>;
}, z.core.$strict>;
export declare const connectionCallResultSchema: z.ZodObject<{
    result: z.ZodUnknown;
}, z.core.$strict>;
export declare const connectionScopeSchema: z.ZodObject<{
    userId: z.ZodUUID;
    projectId: z.ZodUUID;
    environmentId: z.ZodUUID;
    appSlug: z.ZodString;
    jti: z.ZodUUID;
}, z.core.$strict>;
export type ConnectionScope = z.infer<typeof connectionScopeSchema>;
export declare const connectionAuthorizationSchema: z.ZodObject<{
    grantId: z.ZodUUID;
    provider: z.ZodEnum<{
        "google-drive": "google-drive";
        "google-mail": "google-mail";
        "google-calendar": "google-calendar";
        "google-contacts": "google-contacts";
        "microsoft-files": "microsoft-files";
        "microsoft-mail": "microsoft-mail";
        "microsoft-calendar": "microsoft-calendar";
        "microsoft-contacts": "microsoft-contacts";
        slack: "slack";
        notion: "notion";
        dropbox: "dropbox";
        box: "box";
        salesforce: "salesforce";
        hubspot: "hubspot";
    }>;
    integrationId: z.ZodString;
    connectionId: z.ZodString;
    generation: z.ZodInt;
    contractHash: z.ZodString;
    tools: z.ZodArray<z.ZodLiteral<"fdpocket-read">>;
}, z.core.$strip>;
