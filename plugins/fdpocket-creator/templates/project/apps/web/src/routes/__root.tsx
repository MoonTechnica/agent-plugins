import { createRootRoute, Outlet } from "@tanstack/react-router"
import { AppShell } from "@workspace/ui/components/app-shell"

// アプリの骨格はここで 1 回だけ作る（ヘッダー・本文の幅と余白）。画面ごとに外枠を作り直さない。
export const Route = createRootRoute({
  component: () => (
    <AppShell title="{{PROJECT_TITLE}}">
      <Outlet />
    </AppShell>
  ),
})
