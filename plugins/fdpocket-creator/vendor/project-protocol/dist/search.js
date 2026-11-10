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
export const SEARCH_ATTRIBUTE = '@@platform.search';
/** Platform の内部表の接頭辞（`schema-changes.ts` の `introspect` が外す名前空間） */
const PLATFORM_PREFIX = '_platform_';
export const SEARCH_TABLE_PREFIX = `${PLATFORM_PREFIX}fts_`;
const MARKER = '-- platform:search';
/** Platform の索引のブロックの終わり（`withoutPlatformIndexes` が印から終わりまでを取り除く） */
const END_MARKER = '-- /platform';
const quote = (name) => `"${name.replaceAll('"', '""')}"`;
const text = (value) => `'${value.replaceAll("'", "''")}'`;
const mapped = (attributes, name) => {
    const value = attributes?.find((a) => a.name === name)?.args?.[0]?.value;
    return value?.kind === 'literal' && typeof value.value === 'string' ? value.value : null;
};
export const searchTableOf = (table) => `${SEARCH_TABLE_PREFIX}${table}`;
/** `.kit/generated/schema.json`（ZenStack の SchemaDef）から、検索の宣言を読む */
export function searchDeclarations(schemaInput) {
    const models = schemaInput.models ?? {};
    const declarations = [];
    for (const [name, model] of Object.entries(models)) {
        const attribute = model.attributes?.find((a) => a.name === SEARCH_ATTRIBUTE);
        if (!attribute)
            continue;
        const items = attribute.args?.[0]?.value?.items ?? [];
        const columns = items.flatMap((item) => {
            const fieldName = item.field;
            if (typeof fieldName !== 'string')
                return [];
            const field = model.fields[fieldName];
            return [mapped(field?.attributes, '@map') ?? field?.name ?? fieldName];
        });
        declarations.push({
            model: name,
            table: mapped(model.attributes, '@@map') ?? model.name ?? name,
            columns,
        });
    }
    return declarations.sort((a, b) => a.table.localeCompare(b.table));
}
const triggersOf = (table) => ['ai', 'ad', 'au'].map((suffix) => `${searchTableOf(table)}_${suffix}`);
const dropSql = (table) => [
    ...triggersOf(table).map((trigger) => `DROP TRIGGER IF EXISTS ${quote(trigger)};`),
    `DROP TABLE IF EXISTS ${quote(searchTableOf(table))};`,
].join('\n');
/** 仮想表・同期のトリガー・既存の行の取り込み。作り直しても同じ結果になる（先に DROP する） */
export function renderSearchSql(declaration) {
    const { table, columns } = declaration;
    const fts = quote(searchTableOf(table));
    const list = columns.map(quote).join(', ');
    const insertNew = `INSERT INTO ${fts}(rowid, ${list}) VALUES (new."rowid", ${columns.map((c) => `new.${quote(c)}`).join(', ')});`;
    const deleteOld = `INSERT INTO ${fts}(${fts}, rowid, ${list}) VALUES ('delete', old."rowid", ${columns.map((c) => `old.${quote(c)}`).join(', ')});`;
    const [ai, ad, au] = triggersOf(table).map(quote);
    return [
        `${MARKER} ${quote(table)} columns=${columns.join(',')}`,
        dropSql(table),
        `CREATE VIRTUAL TABLE ${fts} USING fts5(${list}, content=${text(table)}, content_rowid='rowid', tokenize='trigram');`,
        `CREATE TRIGGER ${ai} AFTER INSERT ON ${quote(table)} BEGIN ${insertNew} END;`,
        `CREATE TRIGGER ${ad} AFTER DELETE ON ${quote(table)} BEGIN ${deleteOld} END;`,
        `CREATE TRIGGER ${au} AFTER UPDATE ON ${quote(table)} BEGIN ${deleteOld} ${insertNew} END;`,
        `INSERT INTO ${fts}(${fts}) VALUES ('rebuild');`,
        END_MARKER,
    ].join('\n');
}
const markerLine = (kind) => new RegExp(`^-- platform:${kind} "((?:[^"]|"")+)" (?:(removed)|(\\S.*))$`, 'gm');
/** 印の最後の状態。表の名前 → 印の中身（外した表は null） */
function appliedMarkers(migrations, kind) {
    const applied = new Map();
    for (const migration of migrations) {
        for (const match of migration.sql.matchAll(markerLine(kind))) {
            const table = match[1].replaceAll('""', '"');
            applied.set(table, match[2] === 'removed' ? null : (match[3] ?? ''));
        }
    }
    return applied;
}
/** 確定済みの migration が最後に適用した検索（印の最後）。表の名前 → 列（外した表は null） */
export function appliedSearch(migrations) {
    return new Map([...appliedMarkers(migrations, 'search')].map(([table, rest]) => [
        table,
        rest === null ? null : rest.replace(/^columns=/, '').split(','),
    ]));
}
const sameColumns = (a, b) => a !== null && a !== undefined && a.length === b.length && a.every((column, i) => column === b[i]);
/**
 * migration に足す SQL（無ければ空）。今の宣言と、確定済みの migration が最後に適用したものを比べる。
 * `draftSql` は同じ migration に入る prisma の差分と data.sql。元の表を作り直す（`DROP TABLE "<表>"`）なら
 * トリガーが消え rowid が振り直されるので、宣言が同じでも作り直す
 */
export function planSearchSql(input) {
    const applied = appliedSearch(input.migrations);
    const declarations = searchDeclarations(input.schema);
    const declared = new Set(declarations.map((d) => d.table));
    const parts = [];
    for (const declaration of declarations) {
        const redefined = input.draftSql.includes(`DROP TABLE ${quote(declaration.table)}`);
        if (redefined || !sameColumns(applied.get(declaration.table), declaration.columns))
            parts.push(renderSearchSql(declaration));
    }
    for (const [table, columns] of applied) {
        if (columns === null || declared.has(table))
            continue;
        parts.push(`${MARKER} ${quote(table)} removed\n${dropSql(table)}\n${END_MARKER}`);
    }
    return parts.join('\n');
}
const INDEX_BLOCK = new RegExp(`^-- platform:(?:search|vector) [^\\n]*\\n[\\s\\S]*?^${END_MARKER}$\\n?`, 'gm');
/**
 * migration の SQL から、Platform の索引（検索・ベクトル）のブロックを取り除く。prisma の shadow DB に渡す SQL に使う。
 * prisma はこれらの表を知らず（差分に DROP を出す）、shadow DB の libSQL は古くてベクトルの索引も作れないので、
 * prisma には見せない。適用する側（Turso・`kit dev`・検証の DB）にはそのまま渡す
 */
export function withoutPlatformIndexes(sql) {
    return sql.replace(INDEX_BLOCK, '');
}
// ---- ベクトル検索（@@platform.vector） ----
export const VECTOR_ATTRIBUTE = '@@platform.vector';
export const VECTOR_TABLE_PREFIX = `${PLATFORM_PREFIX}vec_`;
/** 次元数の上限（search.md §3.4。libSQL の上限は 65,536 だが、初期は 1,536 まで） */
export const VECTOR_DIMS_MAX = 1536;
const VECTOR_MARKER = '-- platform:vector';
export const vectorTableOf = (table) => `${VECTOR_TABLE_PREFIX}${table}`;
export const vectorIndexOf = (table) => `${vectorTableOf(table)}_idx`;
export function vectorDeclarations(schemaInput) {
    const models = schemaInput.models ?? {};
    const declarations = [];
    for (const [name, model] of Object.entries(models)) {
        const attribute = model.attributes?.find((a) => a.name === VECTOR_ATTRIBUTE);
        if (!attribute)
            continue;
        const arg = (key, position) => (attribute.args?.find((a) => a.name === key) ?? attribute.args?.[position])?.value;
        const fieldName = arg('field', 0)?.field;
        const dims = arg('dims', 1)?.value;
        if (typeof fieldName !== 'string' || typeof dims !== 'number')
            continue;
        const field = model.fields[fieldName];
        declarations.push({
            model: name,
            table: mapped(model.attributes, '@@map') ?? model.name ?? name,
            column: mapped(field?.attributes, '@map') ?? field?.name ?? fieldName,
            dims,
        });
    }
    return declarations.sort((a, b) => a.table.localeCompare(b.table));
}
const vectorTriggersOf = (table) => ['ai', 'ad', 'au'].map((suffix) => `${vectorTableOf(table)}_${suffix}`);
const dropVectorSql = (table) => [
    ...vectorTriggersOf(table).map((trigger) => `DROP TRIGGER IF EXISTS ${quote(trigger)};`),
    `DROP TABLE IF EXISTS ${quote(vectorTableOf(table))};`,
].join('\n');
/** 副表・索引・同期のトリガー・既存の行の取り込み（作り直しても同じ結果になる） */
export function renderVectorSql(declaration) {
    const { table, column, dims } = declaration;
    const vec = quote(vectorTableOf(table));
    const [ai, ad, au] = vectorTriggersOf(table).map(quote);
    const source = `${quote(table)}`;
    const insertNew = `INSERT INTO ${vec}(rowid, "emb") SELECT new."rowid", vector(new.${quote(column)}) WHERE new.${quote(column)} IS NOT NULL;`;
    const deleteOld = `DELETE FROM ${vec} WHERE rowid = old."rowid";`;
    return [
        `${VECTOR_MARKER} ${quote(table)} column=${column} dims=${dims}`,
        dropVectorSql(table),
        `CREATE TABLE ${vec} ("emb" F32_BLOB(${dims}));`,
        `CREATE INDEX ${quote(vectorIndexOf(table))} ON ${vec}(libsql_vector_idx("emb"));`,
        `CREATE TRIGGER ${ai} AFTER INSERT ON ${source} BEGIN ${insertNew} END;`,
        `CREATE TRIGGER ${ad} AFTER DELETE ON ${source} BEGIN ${deleteOld} END;`,
        `CREATE TRIGGER ${au} AFTER UPDATE ON ${source} BEGIN ${deleteOld} ${insertNew} END;`,
        `INSERT INTO ${vec}(rowid, "emb") SELECT "rowid", vector(${quote(column)}) FROM ${source} WHERE ${quote(column)} IS NOT NULL;`,
        END_MARKER,
    ].join('\n');
}
/** `planSearchSql` のベクトル版（宣言と、確定済みの migration が最後に適用したものを比べる） */
export function planVectorSql(input) {
    const applied = appliedMarkers(input.migrations, 'vector');
    const declarations = vectorDeclarations(input.schema);
    const declared = new Set(declarations.map((d) => d.table));
    const parts = [];
    for (const declaration of declarations) {
        const redefined = input.draftSql.includes(`DROP TABLE ${quote(declaration.table)}`);
        const now = `column=${declaration.column} dims=${declaration.dims}`;
        if (redefined || applied.get(declaration.table) !== now)
            parts.push(renderVectorSql(declaration));
    }
    for (const [table, rest] of applied) {
        if (rest === null || declared.has(table))
            continue;
        parts.push(`${VECTOR_MARKER} ${quote(table)} removed\n${dropVectorSql(table)}\n${END_MARKER}`);
    }
    return parts.join('\n');
}
