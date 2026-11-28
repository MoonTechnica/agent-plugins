// 言語まわりの土台（React を使わない部分）。対応言語・言語の決め方・日付と数の書式・SDK のエラーの文言をここ 1 か所に置く。
// 画面の文言の辞書は各 App の src/i18n.ts（App ごとに文言が違うため）。言語を足すときは SUPPORTED_LOCALES と各辞書に足す。
// next-intl は使わない（SPA で Host が言語を決めるため）。
import { SdkError } from "@workspace/miniapp-sdk"

export const SUPPORTED_LOCALES = ["ja", "en"] as const
export type Locale = (typeof SUPPORTED_LOCALES)[number]
export const DEFAULT_LOCALE: Locale = "ja"

/** Host・ブラウザの言語タグ（"ja-JP" / "en-US" / "pt-BR" …）を対応言語に寄せる。完全一致 → 言語部分 → 既定の順 */
export function resolveLocale(tag: string | null | undefined): Locale {
  if (!tag) return DEFAULT_LOCALE
  const lower = tag.toLowerCase()
  const exact = SUPPORTED_LOCALES.find((l) => l === lower)
  if (exact) return exact
  const base = lower.split("-")[0]
  return SUPPORTED_LOCALES.find((l) => l === base) ?? DEFAULT_LOCALE
}

/** 文言の中の {name} を置き換える */
export function format(template: string, values?: Record<string, string | number>): string {
  if (!values) return template
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  )
}

/** 日付（UTC の ISO 文字列）を利用者の時間帯で表示する */
export function formatDate(
  iso: string,
  locale: Locale,
  options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" },
): string {
  return new Intl.DateTimeFormat(locale, options).format(new Date(iso))
}

export function formatNumber(value: number, locale: Locale, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(locale, options).format(value)
}

const DAY = 24 * 60 * 60 * 1000

/** 今日からの日数（「今日」「明日」「3 日前」）。期限・予定の表示に使う */
export function formatRelativeDay(iso: string, locale: Locale, now: Date = new Date()): string {
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const days = Math.round((startOf(new Date(iso)) - startOf(now)) / DAY)
  return new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(days, "day")
}

/** SDK のエラーを利用者に見せる文言にする（SdkError は文言を持たないので code で出し分ける） */
const ERROR_MESSAGES: Record<Locale, Record<string, string>> = {
  ja: {
    FORBIDDEN: "この操作をする権限がありません。",
    NOT_FOUND: "見つかりませんでした。消されたか、見られなくなった可能性があります。",
    VALIDATION_FAILED: "入力内容を確かめてください。",
    CONFLICT: "ほかの人が先に変更しました。最新の内容を読み込んでからやり直してください。",
    RATE_LIMITED: "少し時間をおいてからやり直してください。",
    QUOTA_EXCEEDED: "今日使える回数の上限に達しました。時間をおいてからやり直してください。",
    PAYLOAD_TOO_LARGE: "データが大きすぎます。小さくしてからやり直してください。",
    POST_WRITE_READ_DENIED: "保存しました。表示するには画面を読み込み直してください。",
    GATEWAY_UNAVAILABLE: "つながりませんでした。通信を確かめてやり直してください。",
    HOST_UNAVAILABLE: "FDPocket の中で開いてください。",
    UNAUTHENTICATED: "もう一度ログインしてください。",
    SESSION_EXPIRED: "ログインの期限が切れました。もう一度開いてください。",
    CONSENT_REQUIRED: "利用の同意が必要です。",
    unknown: "うまくいきませんでした。もう一度お試しください。",
  },
  en: {
    FORBIDDEN: "You don't have permission to do this.",
    NOT_FOUND: "Not found. It may have been deleted or is no longer visible to you.",
    VALIDATION_FAILED: "Please check what you entered.",
    CONFLICT: "Someone else changed this first. Reload and try again.",
    RATE_LIMITED: "Please wait a moment and try again.",
    QUOTA_EXCEEDED: "You've reached today's limit. Please try again later.",
    PAYLOAD_TOO_LARGE: "This is too large. Make it smaller and try again.",
    POST_WRITE_READ_DENIED: "Saved. Reload the page to see it.",
    GATEWAY_UNAVAILABLE: "Couldn't connect. Check your connection and try again.",
    HOST_UNAVAILABLE: "Please open this in FDPocket.",
    UNAUTHENTICATED: "Please sign in again.",
    SESSION_EXPIRED: "Your session has expired. Please reopen the app.",
    CONSENT_REQUIRED: "Your consent is required to continue.",
    unknown: "Something went wrong. Please try again.",
  },
}

export function sdkErrorMessage(error: unknown, locale: Locale): string {
  const messages = ERROR_MESSAGES[locale]
  if (error instanceof SdkError) return messages[error.code] ?? messages.unknown!
  return messages.unknown!
}

/** やり直しで直る見込みがあるか（再試行ボタンを出すかの判断） */
export function isRetryableError(error: unknown): boolean {
  return error instanceof SdkError ? error.retryable : true
}
