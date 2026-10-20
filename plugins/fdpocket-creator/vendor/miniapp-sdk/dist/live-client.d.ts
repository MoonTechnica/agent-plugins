/**
 * ライブプレビューで App の HTML に差し込む知らせ（preview.md §2.2。tasks/0457）。`kit dev --live` のときだけ
 * `createAppConfig` の Vite プラグインが `<script type="module">` として入れる（本番の dist には入らない）。
 *
 * - 操作（`LIVE_ACTIVITY_KINDS`）があったら、種類だけを親（kit dev の Host ページ）へ送る。同じ種類は 1 秒に 1 回まで。
 *   座標・キー・入力内容は送らない
 * - HMR の WebSocket が切れた / つながったら伝える（Studio がタブの表示中なら再開を依頼する）
 *
 * 文字列にして HTML へ入れるので、この関数は**外の値を参照しない**（import した定数も使わない）。
 * 形は `@workspace/project-protocol` の `parseLiveMessage` と同じ（テストで突き合わせる）。
 */
interface LiveWindow {
    addEventListener(type: string, listener: () => void, options?: unknown): void;
    parent: {
        postMessage(message: unknown, targetOrigin: string): void;
    };
    Date: {
        now(): number;
    };
}
interface LiveHot {
    on(event: string, handler: () => void): void;
}
export declare function installLiveClient(win: LiveWindow, hot: LiveHot | undefined): void;
/** HTML に差し込む本文（Vite が inline の module を変換するので `import.meta.hot` が使える） */
export declare function liveClientScript(): string;
export {};
