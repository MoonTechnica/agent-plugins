import { type PlatformProfile } from '@workspace/project-protocol';
import type { Transport } from '../transport.ts';
export interface Profile {
    /**
     * スーパーアプリの最新の本人の表示名・アバター。匿名・未設定のプロフィールは null。
     * Project の User は変更しない。独自プロフィールへコピーする場合は client.db.user.update を使う。
     */
    get(): Promise<PlatformProfile | null>;
}
export declare function createProfile(transport: Transport): Profile;
