import { z } from 'zod';
import { APP_SLUG_PATTERN } from "./manifest.js";
/**
 * `public.project_origin_listing(p_host)` の応答（share-and-direct-access.md §3.1・§6）。
 * ミニアプリのオリジンの入口（`/_platform/auth/start`）と PWA の manifest が、アプリ名・アイコン・作者を出すために引く。
 * 公開中で app_access = public の Project の prod だけが値を持ち、それ以外は `null`（汎用表示・manifest なし）。
 */
export const originListingSchema = z
    .strictObject({
    title: z.string().min(1).max(200),
    /** `project-media` の key。表示は Storage の変換 URL */
    iconKey: z.string().min(1).max(1024).nullable(),
    owner: z.strictObject({
        accountName: z.string().min(1).max(64),
        displayName: z.string().max(200).nullable(),
        avatarKey: z.string().min(1).max(1024).nullable(),
    }),
    /** 公開範囲が public の App だけ */
    apps: z.array(z.strictObject({
        slug: z.string().regex(APP_SLUG_PATTERN),
        displayName: z
            .object({ ja: z.string().max(100).optional(), en: z.string().max(100).optional() })
            .nullable(),
    })),
})
    .nullable();
/** App の表示名（web は Project の名前。ほかの App は「Project の名前 · App の名前」） */
export function originAppTitle(listing, slug, language) {
    if (slug === 'web')
        return listing.title;
    const app = listing.apps.find((candidate) => candidate.slug === slug);
    const name = app?.displayName?.[language] ?? app?.displayName?.[language === 'ja' ? 'en' : 'ja'];
    return name ? `${listing.title} · ${name}` : listing.title;
}
