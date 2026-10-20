import { z } from 'zod';
/** スーパーアプリの本人の公開プロフィール。ミニアプリの User とは独立している。 */
export declare const platformProfileSchema: z.ZodObject<{
    displayName: z.ZodNullable<z.ZodString>;
    avatarUrl: z.ZodNullable<z.ZodURL>;
}, z.core.$strict>;
export type PlatformProfile = z.infer<typeof platformProfileSchema>;
/** 匿名・プロフィールの無いアカウントには null。メール等の非公開情報は返さない。 */
export declare const platformProfileResponseSchema: z.ZodNullable<z.ZodObject<{
    displayName: z.ZodNullable<z.ZodString>;
    avatarUrl: z.ZodNullable<z.ZodURL>;
}, z.core.$strict>>;
