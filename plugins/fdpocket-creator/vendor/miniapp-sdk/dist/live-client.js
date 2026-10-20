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
export function installLiveClient(win, hot) {
    const kinds = ['pointerdown', 'keydown', 'wheel', 'touchstart'];
    const last = {};
    // 親は kit dev の Host ページ（別オリジン）。送るのは種類だけなので相手を限らない
    const post = (message) => win.parent.postMessage(message, '*');
    for (const kind of kinds) {
        win.addEventListener(kind, () => {
            const now = win.Date.now();
            if (last[kind] !== undefined && now - last[kind] < 1000)
                return;
            last[kind] = now;
            post({ type: 'kit-live', event: 'activity', kind });
        }, { capture: true, passive: true });
    }
    hot?.on('vite:ws:disconnect', () => post({ type: 'kit-live', event: 'disconnected' }));
    hot?.on('vite:ws:connect', () => post({ type: 'kit-live', event: 'connected' }));
}
/** HTML に差し込む本文（Vite が inline の module を変換するので `import.meta.hot` が使える） */
export function liveClientScript() {
    return `(${installLiveClient.toString()})(window, import.meta.hot)`;
}
