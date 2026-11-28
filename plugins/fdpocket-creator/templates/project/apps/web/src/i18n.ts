// この App の画面の文言。言語を足すときは @workspace/sdk/i18n の SUPPORTED_LOCALES と、ここの辞書に同じキーで足す。
// 画面に日本語・英語を直接書かない。文言はここに置き、useI18n() の t で読む。
import { useLocale } from "@workspace/miniapp-sdk/react"
import { format, type Locale, resolveLocale } from "@workspace/sdk/i18n"
import { useEffect } from "react"

const ja = {
  "nav.label": "メイン",
  "nav.home": "ホーム",
  "shell.skip": "本文へ移動",
  "tasks.title": "タスク",
  "tasks.description": "チームのやることを期限の近い順に確かめます。",
  "tasks.status.todo": "未着手",
  "tasks.status.doing": "進行中",
  "tasks.status.done": "完了",
  "tasks.noDue": "期限なし",
  "tasks.due": "期限 {day}",
  "tasks.empty.title": "タスクはまだありません",
  "tasks.empty.description": "やることを追加すると、ここに並びます。",
  "tasks.noWorkspace.title": "チームに参加していません",
  "tasks.noWorkspace.description": "チームに招待されると、タスクが見られるようになります。",
  "list.loadMore": "もっと見る",
  "list.loadingMore": "読み込んでいます…",
  "list.end": "すべて表示しました",
  "list.retry": "もう一度読み込む",
  "list.loaded": "{count} 件を表示しています",
} as const

type Key = keyof typeof ja

const MESSAGES: Record<Locale, Record<Key, string>> = {
  ja,
  en: {
    "nav.label": "Main",
    "nav.home": "Home",
    "shell.skip": "Skip to content",
    "tasks.title": "Tasks",
    "tasks.description": "Your team's to-dos, soonest due first.",
    "tasks.status.todo": "To do",
    "tasks.status.doing": "In progress",
    "tasks.status.done": "Done",
    "tasks.noDue": "No due date",
    "tasks.due": "Due {day}",
    "tasks.empty.title": "No tasks yet",
    "tasks.empty.description": "Tasks you add will show up here.",
    "tasks.noWorkspace.title": "You're not in a team yet",
    "tasks.noWorkspace.description": "Once you're invited to a team, its tasks show up here.",
    "list.loadMore": "Load more",
    "list.loadingMore": "Loading…",
    "list.end": "That's everything",
    "list.retry": "Try again",
    "list.loaded": "Showing {count} items",
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
