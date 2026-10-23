/**
 * python の App の実行を Modal に頼む（python-backend.md §4.0）。Platform は submit が受けられたかだけを見て、
 * 状態は Modal の中の監督役（`fdp-control`）が DB に報告する。cron・見回りは持たない。
 * 入口は Modal の Web endpoint（`requires_proxy_auth`。Proxy Auth Token を Modal-Key / Modal-Secret で送る）
 */
export interface PythonControl {
    url: string;
    tokenId: string;
    tokenSecret: string;
}
export interface PythonWork {
    kind: 'run' | 'server';
    id: string;
}
/** `MODAL_CONTROL_URL` と Proxy Auth Token。どれか欠ける・Doppler の仮置きのままなら無し（python の経路だけ止まる） */
export declare function readPythonControl(read: (name: string) => string | undefined): PythonControl | undefined;
/** 入口が受けたら true。断られた・届かなかったら false（呼ぶ側がその実行を失敗にする） */
export declare function submitPythonWork(control: PythonControl, work: PythonWork, send?: typeof fetch): Promise<boolean>;
