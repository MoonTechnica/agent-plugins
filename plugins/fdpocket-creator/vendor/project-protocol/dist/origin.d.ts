/**
 * ミニアプリのオリジンのラベル（app-origins.md §3）。`{Project}[--{App}][--{環境}]` の 1 つの DNS ラベル。
 * 入口（App 無し）は Project × 環境に 1 つ、画面の App は App × 環境に 1 つ。
 * 組み立ても解析もここだけで行い、SQL（`platform.app_origin_host`）・Python は同じ規則をテストで照合する。
 */
export type OriginEnvironment = {
    kind: 'prod';
} | {
    kind: 'main';
} | {
    kind: 'session';
    generation: string;
};
export interface OriginLabel {
    originId: string;
    app: string | null;
    environment: OriginEnvironment;
}
/** DNS ラベルの上限（RFC 1035） */
export declare const ORIGIN_LABEL_MAX = 63;
/**
 * 正しいラベルはこの関数の結果だけ。長いときは飾りの `originSlug` を左から切り、末尾の `-` を外す
 * （入りきらなければ省く）。`originId` が識別子なので一意性は変わらない。
 */
export declare function originLabel(input: {
    originSlug: string;
    originId: string;
    app: string | null;
    environment: OriginEnvironment;
}): string;
/** 形だけを解析する。Project の実在と、短縮した飾りが正しいことは呼ぶ側が `originLabel` と照合する */
export declare function parseOriginLabel(label: string): OriginLabel | null;
/**
 * 入口のラベルから同じ環境の App のラベルを作る。入口の飾りは短縮されていない（最長 47 文字）ので、
 * そこから `originLabel` と同じ規則で作り直せる。
 */
export declare function appLabelFromEntrance(entrance: string, app: string): string | null;
/** 2 つのラベルが同じ Project の同じ環境か（App は問わない）。飾りの違いは見ない */
export declare function sameOriginEnvironment(a: string, b: string): boolean;
export declare function isOriginLabel(label: string): boolean;
/** `{label}.{appsDomain}`. The apps domain is required: there are no provisional origins. */
export declare function resolveAppOrigin(input: {
    originHost: string;
    appsDomain: string;
    scheme?: 'https' | 'http';
}): string;
