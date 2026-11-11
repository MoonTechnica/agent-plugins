/**
 * 全文検索（`@@platform.search`。search.md）の SQL。
 *
 * モデルに `@@platform.search([title, body])` を書くと、Platform が migration に FTS5 の仮想表とトリガーを足す
 * （Agent は SQL を書かない）。仮想表は `_platform_fts_<表>` と名付ける。`_platform_` で始まる表は、Platform の
 * 内部表として、差分・検査・本番の値の保全の対象から外れる既存の約束に乗る（`schema-changes.ts` の `introspect`）。
 *
 * - 内容は元の表を参照する（`content=`）。索引だけを持ち、本文を二重に保存しない
 * - トークナイザは trigram。3 文字未満の語は FTS5 では引けないので、検索側（Gateway）が LIKE で補う
 * - prisma は仮想表と内部表を知らないので、差分に DROP を出す。prisma の shadow DB には、この SQL を渡さない（`withoutPlatformIndexes`）
 * - prisma が元の表を作り直す（`DROP TABLE` → `RENAME`）と、トリガーが消え、rowid も振り直される。
 *   その migration では作り直す（`planSearchSql`）
 *
 * ベクトル検索（`@@platform.vector`）も同じ作りで、`_platform_vec_<表>`（libSQL の `F32_BLOB` + `libsql_vector_idx`）の副表と
 * トリガーを足す。アプリの列は JSON の配列の文字列（`'[0.1, 0.2, …]'`）で、トリガーが `vector()` で副表へ写す
 */
export declare const SEARCH_ATTRIBUTE = "@@platform.search";
export declare const SEARCH_TABLE_PREFIX = "_platform_fts_";
export interface SearchDeclaration {
    model: string;
    /** 元の表の名前（`@@map` を解決したもの） */
    table: string;
    /** 検索の対象の列（`@map` を解決したもの） */
    columns: string[];
}
export declare const searchTableOf: (table: string) => string;
/** `.kit/generated/schema.json`（ZenStack の SchemaDef）から、検索の宣言を読む */
export declare function searchDeclarations(schemaInput: unknown): SearchDeclaration[];
/** 仮想表・同期のトリガー・既存の行の取り込み。作り直しても同じ結果になる（先に DROP する） */
export declare function renderSearchSql(declaration: SearchDeclaration): string;
/** 確定済みの migration が最後に適用した検索（印の最後）。表の名前 → 列（外した表は null） */
export declare function appliedSearch(migrations: readonly {
    sql: string;
}[]): Map<string, string[] | null>;
/**
 * migration に足す SQL（無ければ空）。今の宣言と、確定済みの migration が最後に適用したものを比べる。
 * `draftSql` は同じ migration に入る prisma の差分と data.sql。元の表を作り直す（`DROP TABLE "<表>"`）なら
 * トリガーが消え rowid が振り直されるので、宣言が同じでも作り直す
 */
export declare function planSearchSql(input: {
    schema: unknown;
    migrations: readonly {
        sql: string;
    }[];
    draftSql: string;
}): string;
/**
 * migration の SQL から、Platform の索引（検索・ベクトル）のブロックを取り除く。prisma の shadow DB に渡す SQL に使う。
 * prisma はこれらの表を知らず（差分に DROP を出す）、shadow DB の libSQL は古くてベクトルの索引も作れないので、
 * prisma には見せない。適用する側（Turso・`kit dev`・検証の DB）にはそのまま渡す
 */
export declare function withoutPlatformIndexes(sql: string): string;
export declare const VECTOR_ATTRIBUTE = "@@platform.vector";
export declare const VECTOR_TABLE_PREFIX = "_platform_vec_";
/** 次元数の上限（search.md §3.4。libSQL の上限は 65,536 だが、初期は 1,536 まで） */
export declare const VECTOR_DIMS_MAX = 1536;
/**
 * 近似索引（DiskANN）の調整。Turso 公式の `libsql_vector_idx` の設定（docs.turso.tech/features/ai-and-embeddings）。
 * 精度・速度・容量のつり合いで、指定が無ければ Turso の既定（FLOAT32・max_neighbors = 3√次元数・search_l = 200 など）。
 */
export interface VectorOptions {
    /** 各ノードが持つ近傍数。小さいほど容量は減るが精度は下がる */
    maxNeighbors?: number;
    /** 近傍の保存に使う型。圧縮するほど容量は減るが精度は下がる */
    compress?: (typeof VECTOR_COMPRESS)[number];
    /** 検索時に訪れる近傍数の上限。小さいほど速いが精度は下がる */
    searchL?: number;
    /** 挿入時に訪れる近傍数の上限 */
    insertL?: number;
    /** グラフの密度。小さいほど疎で速いが精度は下がる */
    alpha?: number;
}
/** `compress_neighbors` に渡せる型（公式の一覧） */
export declare const VECTOR_COMPRESS: readonly ["float1bit", "float8", "float16", "floatb16", "float32"];
/** 調整の値の範囲（公式は下限だけ。上限は暴走を防ぐ Platform の保護値） */
export declare const VECTOR_OPTION_LIMITS: {
    readonly maxNeighbors: {
        readonly min: 1;
        readonly max: 512;
    };
    readonly searchL: {
        readonly min: 1;
        readonly max: 2000;
    };
    readonly insertL: {
        readonly min: 1;
        readonly max: 1000;
    };
    readonly alpha: {
        readonly min: 1;
        readonly max: 4;
    };
};
export interface VectorDeclaration {
    model: string;
    table: string;
    /** ベクトルを JSON の配列の文字列（`'[0.1, 0.2]'`）で持つ列 */
    column: string;
    dims: number;
    /** 埋め込みを作ったモデル名を持つ列（任意。モデルが違うベクトルは比べられないので、記録して再生成の対象を見つける） */
    modelColumn?: string;
    options?: VectorOptions;
}
export declare const vectorTableOf: (table: string) => string;
export declare const vectorIndexOf: (table: string) => string;
export declare function vectorDeclarations(schemaInput: unknown): VectorDeclaration[];
/** 副表・索引・同期のトリガー・既存の行の取り込み（作り直しても同じ結果になる） */
export declare function renderVectorSql(declaration: VectorDeclaration): string;
/** `planSearchSql` のベクトル版（宣言と、確定済みの migration が最後に適用したものを比べる） */
export declare function planVectorSql(input: {
    schema: unknown;
    migrations: readonly {
        sql: string;
    }[];
    draftSql: string;
}): string;
