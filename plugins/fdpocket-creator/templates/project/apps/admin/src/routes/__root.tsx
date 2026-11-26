import { createRootRoute, Outlet } from "@tanstack/react-router"
import { useColorScheme, useSafeArea } from "@workspace/miniapp-sdk/react"
import { AppShell } from "@workspace/ui/components/app-shell"

// アプリの骨格はここで 1 回だけ作る（本文の幅と余白）。画面ごとに外枠を作り直さない。
// アプリ名のヘッダーは置かない（スーパーアプリの中では FDPocket が上に出す）。各画面の先頭は PageHeader（その画面の名前）。
export const Route = createRootRoute({ component: Root })

function Root() {
  // セーフエリアと明暗は開き方で取り方が違う（スーパーアプリ内は Host の値、ホーム画面・ブラウザは env() と端末の設定）。AppShell がまとめる
  const safeArea = useSafeArea()
  const colorScheme = useColorScheme()
  return (
    <AppShell width="wide" safeArea={safeArea} colorScheme={colorScheme}>
      <Outlet />
    </AppShell>
  )
}
