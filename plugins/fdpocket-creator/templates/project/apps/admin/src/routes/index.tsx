import { createFileRoute } from "@tanstack/react-router"
import { useSession } from "@workspace/miniapp-sdk/react"
import { EmptyState } from "@workspace/ui/components/empty-state"
import { PageHeader } from "@workspace/ui/components/page-header"
import { Inbox } from "lucide-react"
import { useI18n } from "../i18n"

export const Route = createFileRoute("/")({
  component: Home,
})

// 見本の画面。作る管理画面に合わせて置き換える（一覧・表・状態の出し分けは `$app-admin` と apps/web の見本を手本にする）。
function Home() {
  const { t } = useI18n()
  const session = useSession()
  return (
    <>
      <PageHeader title={t("overview.title")} description={session?.displayName ?? undefined} />
      <EmptyState
        icon={Inbox}
        title={t("overview.empty.title")}
        description={t("overview.empty.description")}
      />
    </>
  )
}
