import { createFileRoute } from "@tanstack/react-router"
import { useSession } from "@workspace/miniapp-sdk/react"
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"

export const Route = createFileRoute("/")({
  component: Home,
})

function Home() {
  const session = useSession()
  return (
    <Card className="mx-auto max-w-md">
      <CardHeader>
        <CardTitle>{{PROJECT_TITLE}} 管理</CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        {session?.displayName ?? null}
      </CardContent>
    </Card>
  )
}
