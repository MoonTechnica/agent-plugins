import { createFileRoute } from "@tanstack/react-router"
import { useSession } from "@workspace/miniapp-sdk/react"
import { EmptyState } from "@workspace/ui/components/empty-state"
import { PageHeader } from "@workspace/ui/components/page-header"
import { Inbox } from "lucide-react"

export const Route = createFileRoute("/")({
  component: Home,
})

// 見本の画面。作る管理画面に合わせて置き換える。
function Home() {
  const session = useSession()
  return (
    <>
      <PageHeader title="{{PROJECT_TITLE}} 管理" description={session?.displayName ?? undefined} />
      <EmptyState icon={Inbox} title="まだ何もありません" description="管理する項目がここに並びます。" />
    </>
  )
}
