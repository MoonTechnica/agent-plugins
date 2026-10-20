import { createRootRoute, Outlet } from "@tanstack/react-router"

export const Route = createRootRoute({
  component: () => (
    <main className="min-h-svh bg-background p-6 text-foreground">
      <Outlet />
    </main>
  ),
})
