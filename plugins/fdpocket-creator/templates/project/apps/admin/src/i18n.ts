// この App（管理画面）の文言。言語を足すときは @workspace/sdk/i18n の SUPPORTED_LOCALES と、ここの辞書に同じキーで足す。
// 画面に日本語・英語を直接書かない。文言はここに置き、useI18n() の t で読む。
import { useLocale } from "@workspace/miniapp-sdk/react"
import { format, type Locale, resolveLocale } from "@workspace/sdk/i18n"
import { useEffect } from "react"

const ja = {
  "nav.label": "メイン",
  "nav.more": "その他",
  "nav.overview": "概要",
  "nav.section.manage": "管理",
  "nav.settings": "設定",
  "nav.guest": "ゲスト",
  "shell.skip": "本文へ移動",
  "overview.title": "概要",
  "overview.empty.title": "まだ何もありません",
  "overview.empty.description": "管理する項目がここに並びます。",
  "settings.title": "設定",
  "settings.description": "この管理画面の設定をここで変えます。",
  "settings.empty.title": "設定する項目はまだありません",
  "settings.empty.description": "必要になったら、ここに足します。",
} as const

export type Key = keyof typeof ja

const MESSAGES: Record<Locale, Record<Key, string>> = {
  ja,
  en: {
    "nav.label": "Main",
    "nav.more": "More",
    "nav.overview": "Overview",
    "nav.section.manage": "Manage",
    "nav.settings": "Settings",
    "nav.guest": "Guest",
    "shell.skip": "Skip to content",
    "overview.title": "Overview",
    "overview.empty.title": "Nothing here yet",
    "overview.empty.description": "Items you manage will show up here.",
    "settings.title": "Settings",
    "settings.description": "Change how this admin works.",
    "settings.empty.title": "No settings yet",
    "settings.empty.description": "Add them here when you need them.",
  },
}

export function getMessages(locale: Locale) {
  const messages = MESSAGES[locale]
  return (key: Key, values?: Record<string, string | number>) => format(messages[key], values)
}

/** 画面で使う。Host の言語に合わせ、<html lang> も揃える（読み上げ・字形のため） */
export function useI18n() {
  const locale = resolveLocale(useLocale())
  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])
  return { locale, t: getMessages(locale) }
}
