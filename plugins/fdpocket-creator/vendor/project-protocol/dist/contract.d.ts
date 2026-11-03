import { z } from 'zod';
/**
 * 契約スキーマの 2 つの形（contract-compatibility.md §2）。
 *
 * ミニアプリの成果物には SDK が焼き込まれ、Platform を再配備しても変わらない。その凍結された側と
 * 再配備される側の間を通るものは、1 つの定義から次の 2 つの形で読む（Postel の法則）。
 *
 * | 形 | 使う側 | 未知のキー | 知らない enum の値 | `invariant` |
 * |---|---|---|---|---|
 * | `wire` | **読む側**（凍結された SDK・Worker・ネイティブ、そして Gateway / Host が相手の送信を読むとき） | 捨てる | 受ける | 検査しない |
 * | `exact` | **書く側の自己検査**・自分が署名したものを読み返すとき・凍結テスト | 拒否 | 拒否 | 検査する |
 *
 * 型は 1 つの定義から決まる。`exact` は閉じた型（書く側のコードが使う）、`wire` は `Open<>` で
 * 文字列の literal を開いた型（読む側は知らない値を `default` で扱う）。
 */
/** 読む側が受けうる、定義時には知らなかった文字列 */
export type OpenString = string & {};
/** 読む側の型。文字列の literal（enum・判別子）を開く。`string` そのもの・数値・真偽値はそのまま */
export type Open<T> = T extends string ? string extends T ? T : T | OpenString : T extends readonly (infer U)[] ? Open<U>[] : T extends object ? {
    [K in keyof T]: K extends 'type' ? T[K] : Open<T[K]>;
} : T;
export type Mode = 'wire' | 'exact';
/** 契約の定義に渡す道具。`z.*` と組み合わせて使う */
export interface Shape {
    readonly mode: Mode;
    /** object。wire は未知のキーを捨て、exact は拒否する */
    object<T extends z.core.$ZodLooseShape>(shape: T): z.ZodObject<z.core.util.Writeable<T>>;
    /** 文字列の enum。wire は文字列なら何でも受ける（型は閉じたまま。読む側は `Open<>` を通して見る） */
    enum<const V extends readonly [string, ...string[]]>(values: V): z.ZodEnum<z.core.util.ToEnum<V[number]>>;
    /** 書く側だけの不変条件（寿命の上限など）。読む側はこの検査をしない（制限の緩和を壊れにしない） */
    invariant<S extends z.ZodType>(schema: S, check: (value: z.output<S>, ctx: z.RefinementCtx) => void): S;
}
export interface Contract<S extends z.ZodType> {
    /** 読む側の形 */
    readonly wire: z.ZodType<Open<z.output<S>>, Open<z.input<S>>>;
    /** 書く側の形 */
    readonly exact: S;
    /** 別の契約の中で使う（その契約と同じ形を返す） */
    in(shape: Shape): S;
}
/** 契約を 1 回定義して、読む形と書く形の両方を得る */
export declare function contract<S extends z.ZodType>(build: (o: Shape) => S): Contract<S>;
