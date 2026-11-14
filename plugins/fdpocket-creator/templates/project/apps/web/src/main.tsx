import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { QueryClient } from "@tanstack/react-query"
import { createRouter, RouterProvider } from "@tanstack/react-router"
import { ProjectProvider } from "@workspace/miniapp-sdk/react"
import { client } from "@workspace/sdk"

import "@workspace/ui/globals.css"
import { routeTree } from "./routeTree.gen"

const queryClient = new QueryClient()
const router = createRouter({ routeTree, basepath: import.meta.env.BASE_URL })

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router
  }
}

// 埋め込まれているときは Host からトークンを受け取り、リンクを直接開いたときは入口へ進む（sdk.md §3.1）。
// fromHost() だけだと、直接開いた公開アプリはセッションも Gateway の URL も無いまま DB が失敗する
void client.auth.signInWithSuperApp().catch((error: unknown) => {
  console.error("could not start the session", error)
})

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ProjectProvider client={client} queryClient={queryClient}>
      <RouterProvider router={router} />
    </ProjectProvider>
  </StrictMode>
)
