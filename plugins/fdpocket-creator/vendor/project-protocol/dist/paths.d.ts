/**
 * Project のリポジトリの中の決まった置き場（sdk.md §5.3。Kit・検証器・Platform が同じ値を使う）。
 */
export declare const PROJECT_PATHS: {
    readonly manifest: "infra/project.yaml";
    readonly schema: "packages/db-schema/schema.zmodel";
    readonly platform: "packages/db-schema/platform.zmodel";
    readonly sdk: "packages/sdk/src/zenstack";
    /** 確定済みの migration（Platform だけが書く。lifecycle.md §2.1） */
    readonly migrations: "packages/db-schema/migrations";
    /** `kit db migrate` に渡す下書き（Agent が書く data.sql / intent.yaml / migration-policy.json。migrate が使って消す） */
    readonly pending: "packages/db-schema/pending";
    /** Agent が書く試用データ（lifecycle.md §2.5。`kit dev` が DB を作ったときに流す） */
    readonly seed: "packages/db-schema/seed.ts";
    /** Agent が書くマスタデータ（master-data.md。`kit db migrate` が migration の SQL にして全環境へ届く） */
    readonly masters: "packages/db-schema/masters.ts";
    /** Agent が書く消去のテスト（lifecycle.md §3.3。動的検証が seed の後の DB で 1 人を消して流す） */
    readonly eraseTest: "packages/db-schema/erase.test.ts";
    readonly generated: ".kit/generated";
    /** `kit build` が mcp の App のツールの目録を書く（miniapp-mcp.md §14.3。`kit check` が読む。commit しない） */
    readonly mcpTools: ".kit/generated/mcp-tools.json";
};
