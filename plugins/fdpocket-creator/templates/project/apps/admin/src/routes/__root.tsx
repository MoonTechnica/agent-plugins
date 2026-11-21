import { createRootRoute, Outlet } from "@tanstack/react-router"
import { useColorScheme, useSafeArea } from "@workspace/miniapp-sdk/react"
import { AppShell } from "@workspace/ui/components/app-shell"

// アプリの骨格はここで 1 回だけ作る（ヘッダー・本文の幅と余白）。画面ごとに外枠を作り直さない。
export const Route = createRootRoute({ component: Root })

function Root() {
  // セーフエリアと明暗は開き方で取り方が違う（スーパーアプリ内は Host の値、ホーム画面・ブラウザは env() と端末の設定）。AppShell がまとめる
  const safeArea = useSafeArea()
  const colorScheme = useColorScheme()
  return (
    <AppShell title="{{PROJECT_TITLE}} 管理" width="wide" safeArea={safeArea} colorScheme={colorScheme}>
      <Outlet />
    </AppShell>
  )
}
