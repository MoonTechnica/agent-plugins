import { createFileRoute } from "@tanstack/react-router"
import { EmptyState } from "@workspace/ui/components/empty-state"
import { PageHeader } from "@workspace/ui/components/page-header"
import { Settings } from "lucide-react"

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
})

// 見本の画面（行き先が 2 つあるので、左のナビが出る）。作る管理画面に合わせて置き換える。
function SettingsPage() {
  return (
    <>
      <PageHeader title="設定" description="この管理画面の設定をここで変えます。" />
      <EmptyState icon={Settings} title="設定する項目はまだありません" description="必要になったら、ここに足します。" />
    </>
  )
}
