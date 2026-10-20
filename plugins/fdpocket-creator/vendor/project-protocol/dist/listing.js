/**
 * 掲載情報のカテゴリ（Project の `listing/listing.json` の `category`）。App Store / Google Play の一般的な分類に
 * 合わせた一覧（2026-10-14 ユーザー「オーソドックスなものを一通り」。ゲームと子ども向けも入れる）。
 * 子ども向け（kids）を選んだ版は、ストアの子ども向けの義務（保護者の確認・第三者の広告や解析の制限など）を
 * 審査で確かめる（compliance.md）。
 *
 * 並びは画面の並び。Platform の `project_categories` の seed（`drizzle/config/post-migration/51_listing.sql`）と
 * 一致させる（listing.test.ts が確かめる）。**id は消さない**（版が参照する）。表示名は i18n の `Listing.category.<id>`。
 */
export const PROJECT_CATEGORIES = [
    'business',
    'productivity',
    'education',
    'kids',
    'community',
    'tools',
    'lifestyle',
    'finance',
    'health',
    'medical',
    'entertainment',
    'games',
    'news',
    'books',
    'reference',
    'music',
    'photo_video',
    'graphics_design',
    'food_drink',
    'shopping',
    'travel',
    'navigation',
    'sports',
    'weather',
    'developer_tools',
    'other',
];
export function isProjectCategory(value) {
    return typeof value === 'string' && PROJECT_CATEGORIES.includes(value);
}
