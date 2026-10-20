/**
 * Project のリポジトリの中の決まった置き場（sdk.md §5.3。Kit・検証器・Platform が同じ値を使う）。
 */
export const PROJECT_PATHS = {
    manifest: 'infra/project.yaml',
    schema: 'packages/db-schema/schema.zmodel',
    platform: 'packages/db-schema/platform.zmodel',
    sdk: 'packages/sdk/src/zenstack',
    /** 確定済みの migration（Platform だけが書く。lifecycle.md §2.1） */
    migrations: 'packages/db-schema/migrations',
    /** このブランチの未確定の差分（`kit db diff` が作る generated.sql と、Agent が書く data.sql / intent.yaml） */
    pending: 'packages/db-schema/pending',
    /** Agent が書く試用データ（lifecycle.md §2.5。`kit dev` が DB を作ったときに流す） */
    seed: 'packages/db-schema/seed.ts',
    /** Agent が書く消去のテスト（lifecycle.md §3.3。動的検証が seed の後の DB で 1 人を消して流す） */
    eraseTest: 'packages/db-schema/erase.test.ts',
    generated: '.kit/generated',
};
