import { createFileRoute } from "@tanstack/react-router"
import { EmptyState } from "@workspace/ui/components/empty-state"
import { PageHeader } from "@workspace/ui/components/page-header"
import { Settings } from "lucide-react"
import { useI18n } from "../i18n"

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
})

// 見本の画面（行き先が 2 つあるので、左のナビが出る）。作る管理画面に合わせて置き換える。
function SettingsPage() {
  const { t } = useI18n()
  return (
    <>
      <PageHeader title={t("settings.title")} description={t("settings.description")} />
      <EmptyState
        icon={Settings}
        title={t("settings.empty.title")}
        description={t("settings.empty.description")}
      />
    </>
  )
}
