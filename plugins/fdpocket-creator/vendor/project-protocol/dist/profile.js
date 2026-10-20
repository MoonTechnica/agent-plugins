import { z } from 'zod';
/** スーパーアプリの本人の公開プロフィール。ミニアプリの User とは独立している。 */
export const platformProfileSchema = z.strictObject({
    displayName: z.string().nullable(),
    /** 128px に変換済みの画像 URL。未設定なら null（kit dev は仮画像の data URL）。 */
    avatarUrl: z.url().nullable(),
});
/** 匿名・プロフィールの無いアカウントには null。メール等の非公開情報は返さない。 */
export const platformProfileResponseSchema = platformProfileSchema.nullable();
