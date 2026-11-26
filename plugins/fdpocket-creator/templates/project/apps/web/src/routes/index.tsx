import { createFileRoute } from "@tanstack/react-router"
import { useSession } from "@workspace/miniapp-sdk/react"
import { EmptyState } from "@workspace/ui/components/empty-state"
import { PageHeader } from "@workspace/ui/components/page-header"
import { Inbox } from "lucide-react"

export const Route = createFileRoute("/")({
  component: Home,
})

// 見本の画面。見出し（PageHeader）と、空の状態（EmptyState: 何も無いこと＋次にすること）の型を示す。
// 見出しは「この画面に何があるか」（「今日のタスク」「連絡先」）。アプリ名は FDPocket が上に出すので繰り返さない。
// 作るアプリに合わせて置き換える。
function Home() {
  const session = useSession()
  return (
    <>
      <PageHeader title="ホーム" description={session?.displayName ?? undefined} />
      <EmptyState icon={Inbox} title="まだ何もありません" description="最初の項目を追加しましょう。" />
    </>
  )
}
