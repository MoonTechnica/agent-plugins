/** `MODAL_CONTROL_URL` と Proxy Auth Token。どれか欠ける・Doppler の仮置きのままなら無し（python の経路だけ止まる） */
export function readPythonControl(read) {
    const url = read('MODAL_CONTROL_URL');
    const tokenId = read('MODAL_PROXY_TOKEN_ID');
    const tokenSecret = read('MODAL_PROXY_TOKEN_SECRET');
    if (!url || !tokenId || !tokenSecret)
        return undefined;
    if ([url, tokenId, tokenSecret].some((value) => value.includes('PLACEHOLDER')))
        return undefined;
    return { url, tokenId, tokenSecret };
}
/** 入口が受けたら true。断られた・届かなかったら false（呼ぶ側がその実行を失敗にする） */
export async function submitPythonWork(control, work, send = fetch) {
    try {
        const response = await send(control.url, {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                'modal-key': control.tokenId,
                'modal-secret': control.tokenSecret,
            },
            body: JSON.stringify({ kind: work.kind, id: work.id }),
        });
        await response.body?.cancel();
        if (!response.ok)
            console.error('python submit was refused', { status: response.status, ...work });
        return response.ok;
    }
    catch (error) {
        console.error('python submit failed', { error, ...work });
        return false;
    }
}
