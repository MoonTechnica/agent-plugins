import { type BridgeOpName, type SafeAreaInsets } from '@workspace/project-protocol';
export interface Ui {
    /** 埋め込み（Host と bridge がつながっている）か直接アクセスか */
    host(): 'superapp' | 'standalone';
    /** Host のロケール。単独起動・接続前はブラウザの言語タグ、取得不能なら en。 */
    locale(): string;
    /** スーパーアプリの共有シート（App 内の相対パスだけ） */
    openShare(input: {
        path: string;
        text?: string;
    }): Promise<void>;
    /** ミニアプリを閉じる */
    close(): Promise<void>;
    /** 同じ Project の別 App へ（Host が起動を仲介する） */
    navigate(input: {
        app: string;
        path: string;
    }): Promise<void>;
    /** 埋め込まれていないときは 0（現行の SDK と同じ） */
    safeArea(): SafeAreaInsets;
    /** 値が変わったときだけ呼ぶ。戻り値で購読をやめる */
    onSafeAreaChange(listener: (insets: SafeAreaInsets) => void): () => void;
}
/** auth の bridge（MessagePort）と ui をつなぐ口。client.ts だけが使う */
export interface UiBridge {
    readonly ui: Ui;
    /** Host への op（`ui` 以外の名前空間が使う。`client.safety.report` など）。reply の `result` を返す */
    request(op: BridgeOpName, payload?: unknown): Promise<unknown>;
    attach(port: MessagePort, safeArea: SafeAreaInsets, locale: string): void;
    setSafeArea(insets: SafeAreaInsets): void;
    /** port に届いたメッセージのうち reply を受ける。reply だったら true */
    receive(data: unknown): boolean;
    /** bridge が切れた。返事待ちは HOST_UNAVAILABLE で終える */
    detach(): void;
}
/**
 * `client.ui`（sdk.md §3.4）。操作は bridge の `op` → `reply`（requestId で対応づける）。
 * standalone では no-op にせず `HOST_UNAVAILABLE`（App が分岐できるように）。
 * 利用者の操作（共有シート・権限の確認）を待つことがあるので、返事に期限は付けない。
 */
export declare function createUiBridge(): UiBridge;
