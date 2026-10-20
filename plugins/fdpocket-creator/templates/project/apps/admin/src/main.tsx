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

// スーパーアプリに埋め込まれているときは Host からトークンを受け取る（sdk.md §3.1）
void client.auth.fromHost().catch((error: unknown) => {
  console.error("could not receive the session from the host", error)
})

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ProjectProvider client={client} queryClient={queryClient}>
      <RouterProvider router={router} />
    </ProjectProvider>
  </StrictMode>
)
