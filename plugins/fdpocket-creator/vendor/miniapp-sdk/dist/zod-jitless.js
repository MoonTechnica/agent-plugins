/**
 * zod v4 は schema を JIT するとき `new Function` を試し、CSP で止められると黙って遅い道に戻る。ただし止められた
 * 試しも `securitypolicyviolation` として報告されるので、ミニアプリ（CSP で eval を許さない。動的検証は違反で落とす）
 * では試すこと自体をやめる。設定は zod のどのコピーも `globalThis.__zod_globalConfig` を共有する（zod 4.4）。
 */
const zodConfig = globalThis;
zodConfig.__zod_globalConfig ??= {};
zodConfig.__zod_globalConfig.jitless = true;
export {};
