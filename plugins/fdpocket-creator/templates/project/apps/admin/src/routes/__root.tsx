import { createRootRoute, Outlet } from "@tanstack/react-router"
import { useSafeArea } from "@workspace/miniapp-sdk/react"
import { AppShell } from "@workspace/ui/components/app-shell"

// アプリの骨格はここで 1 回だけ作る（ヘッダー・本文の幅と余白）。画面ごとに外枠を作り直さない。
export const Route = createRootRoute({ component: Root })

function Root() {
  // セーフエリアは開き方で取り方が違う（スーパーアプリ内は Host の値、ホーム画面は env()）。AppShell がまとめる
  const safeArea = useSafeArea()
  return (
    <AppShell title="{{PROJECT_TITLE}} 管理" width="wide" safeArea={safeArea}>
      <Outlet />
    </AppShell>
  )
}
