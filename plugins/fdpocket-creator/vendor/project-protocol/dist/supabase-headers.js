/**
 * Platform の Supabase（PostgREST・Storage）を Secret Key で呼ぶときのヘッダー。
 * - 新しい Secret Key（`sb_secret_…`）は `apikey` だけ（API Gateway が service_role に読み替える）
 * - 旧来の service_role の鍵（JWT。ローカルの Edge Runtime はこれだけを渡す）は `Authorization` にも載せる
 */
export function supabaseServiceHeaders(secretKey) {
    const isJwt = secretKey.split('.').length === 3;
    return isJwt ? { apikey: secretKey, authorization: `Bearer ${secretKey}` } : { apikey: secretKey };
}
