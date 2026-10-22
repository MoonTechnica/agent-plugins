import { z } from 'zod';
/**
 * `public.project_origin_listing(p_host)` の応答（share-and-direct-access.md §3.1・§6）。
 * ミニアプリのオリジンの入口（`/_platform/auth/start`）と PWA の manifest が、アプリ名・アイコン・作者を出すために引く。
 * 公開中で app_access = public の Project の prod だけが値を持ち、それ以外は `null`（汎用表示・manifest なし）。
 */
export declare const originListingSchema: z.ZodNullable<z.ZodObject<{
    title: z.ZodString;
    iconKey: z.ZodNullable<z.ZodString>;
    owner: z.ZodObject<{
        accountName: z.ZodString;
        displayName: z.ZodNullable<z.ZodString>;
        avatarKey: z.ZodNullable<z.ZodString>;
    }, z.core.$strict>;
    apps: z.ZodArray<z.ZodObject<{
        slug: z.ZodString;
        displayName: z.ZodNullable<z.ZodObject<{
            ja: z.ZodOptional<z.ZodString>;
            en: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
    }, z.core.$strict>>;
}, z.core.$strict>>;
export type OriginListing = NonNullable<z.infer<typeof originListingSchema>>;
/** App の表示名（web は Project の名前。ほかの App は「Project の名前 · App の名前」） */
export declare function originAppTitle(listing: OriginListing, slug: string, language: 'ja' | 'en'): string;
