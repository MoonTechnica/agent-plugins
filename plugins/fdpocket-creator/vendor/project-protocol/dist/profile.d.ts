import { z } from 'zod';
/** スーパーアプリの本人の公開プロフィール。ミニアプリの User とは独立している。 */
export declare const platformProfile: import("./contract.ts").Contract<z.ZodObject<{
    displayName: z.ZodNullable<z.ZodString>;
    avatarUrl: z.ZodNullable<z.ZodURL>;
}, z.core.$strip>>;
export type PlatformProfile = z.output<typeof platformProfile.exact>;
/** 匿名・プロフィールの無いアカウントには null。メール等の非公開情報は返さない。 */
export declare const platformProfileResponse: import("./contract.ts").Contract<z.ZodNullable<z.ZodObject<{
    displayName: z.ZodNullable<z.ZodString>;
    avatarUrl: z.ZodNullable<z.ZodURL>;
}, z.core.$strip>>>;
