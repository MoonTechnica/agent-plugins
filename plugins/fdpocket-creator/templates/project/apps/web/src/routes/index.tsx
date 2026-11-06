import { createFileRoute } from "@tanstack/react-router"
import { useSession } from "@workspace/miniapp-sdk/react"
import { EmptyState } from "@workspace/ui/components/empty-state"
import { PageHeader } from "@workspace/ui/components/page-header"
import { Inbox } from "lucide-react"

export const Route = createFileRoute("/")({
  component: Home,
})

// 見本の画面。見出し（PageHeader）と、空の状態（EmptyState: 何も無いこと＋次にすること）の型を示す。
// 作るアプリに合わせて置き換える。
function Home() {
  const session = useSession()
  return (
    <>
      <PageHeader title="{{PROJECT_TITLE}}" description={session?.displayName ?? undefined} />
      <EmptyState icon={Inbox} title="まだ何もありません" description="最初の項目を追加しましょう。" />
    </>
  )
}
