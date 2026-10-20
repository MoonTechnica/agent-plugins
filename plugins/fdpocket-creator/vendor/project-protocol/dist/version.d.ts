/**
 * Host（project-host）・SDK（miniapp-sdk）・Gateway が共有する protocol の版（sdk.md §9）。
 * `hello` の `protocolVersion` が対応範囲外なら Host は接続を拒否する。
 * API 契約の版（`sdkVersion: 3`）とは別の層。
 */
export declare const PROTOCOL_VERSION: 1;
export type ProtocolVersion = typeof PROTOCOL_VERSION;
/** Host の bridge と Project オリジンの配信ルールの版 */
export declare const RUNTIME_VERSION: 1;
