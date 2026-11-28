import { createFileRoute } from "@tanstack/react-router"
import { useClientQueries } from "@workspace/miniapp-sdk/react"
import { schema } from "@workspace/sdk"
import { formatRelativeDay, isRetryableError, sdkErrorMessage } from "@workspace/sdk/i18n"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card } from "@workspace/ui/components/card"
import { EmptyState } from "@workspace/ui/components/empty-state"
import { ListRow } from "@workspace/ui/components/list-row"
import { PageHeader } from "@workspace/ui/components/page-header"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { CircleAlert, ListTodo, Users } from "lucide-react"
import { useI18n } from "../i18n"

export const Route = createFileRoute("/")({
  component: Home,
})

// 見本の画面: ページングつきの一覧と、一覧に要る 5 つの状態（読み込み中・空・失敗・もっと見る・末尾）。
// 作るアプリに合わせて置き換える。置き換えても 5 つの状態は残す（`$app-ux-patterns` §2）。
// 一覧は全部を取らず 20 件ずつ取る（Gateway は 1 回 200 件まで）。並びは作成日時 + id（同じ時刻でも順が決まる）。
const PAGE_SIZE = 20
const ARGS = {
  orderBy: [{ createdAt: "desc" as const }, { id: "desc" as const }],
  take: PAGE_SIZE,
}

// status は文字列の列。知らない値は「未着手」として見せる（型で絞ってから表示の対応表を引く）
const STATUS_VARIANT = { todo: "outline", doing: "warning", done: "success" } as const
type Status = keyof typeof STATUS_VARIANT
const statusOf = (value: string): Status => (value in STATUS_VARIANT ? (value as Status) : "todo")

function Home() {
  const { locale, t } = useI18n()
  const hooks = useClientQueries(schema)
  // 見えるタスクは読み取りの権限（所属するチームのものだけ）で絞られる。where は要らない
  const pages = hooks.task.useInfiniteFindMany(ARGS, {
    getNextPageParam: (last) =>
      last.length < PAGE_SIZE ? undefined : { ...ARGS, skip: 1, cursor: { id: last.at(-1)!.id } },
  })
  // チームに入っていないこと（空の理由が違う）を見分ける
  const workspace = hooks.workspace.useFindFirst({ select: { id: true } })
  const tasks = pages.data?.pages.flat() ?? []

  return (
    <>
      <PageHeader title={t("tasks.title")} description={t("tasks.description")} />
      {pages.isPending ? (
        <Card variant="list" aria-busy="true">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="flex min-h-(--row-h) items-center gap-3 px-4 desk:px-3">
              <div className="flex flex-1 flex-col gap-1.5">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-3 w-1/4" />
              </div>
              <Skeleton className="h-5 w-14 rounded-full" />
            </div>
          ))}
        </Card>
      ) : pages.isError && tasks.length === 0 ? (
        // 失敗を「0 件」に見せない
        <EmptyState
          icon={CircleAlert}
          title={sdkErrorMessage(pages.error, locale)}
          action={
            isRetryableError(pages.error) ? (
              <Button variant="outline" onClick={() => pages.refetch()}>
                {t("list.retry")}
              </Button>
            ) : undefined
          }
        />
      ) : tasks.length === 0 ? (
        workspace.data === null ? (
          <EmptyState
            icon={Users}
            title={t("tasks.noWorkspace.title")}
            description={t("tasks.noWorkspace.description")}
          />
        ) : (
          <EmptyState
            icon={ListTodo}
            title={t("tasks.empty.title")}
            description={t("tasks.empty.description")}
          />
        )
      ) : (
        <div className="flex flex-col gap-3">
          <Card variant="list">
            {tasks.map((task) => (
              <ListRow
                key={task.id}
                title={task.title}
                description={
                  task.dueAt
                    ? t("tasks.due", { day: formatRelativeDay(String(task.dueAt), locale) })
                    : t("tasks.noDue")
                }
                meta={
                  <Badge variant={STATUS_VARIANT[statusOf(task.status)]}>
                    {t(`tasks.status.${statusOf(task.status)}`)}
                  </Badge>
                }
              />
            ))}
          </Card>
          {/* 追加で読んだ件数を読み上げる */}
          <p aria-live="polite" className="sr-only">
            {t("list.loaded", { count: tasks.length })}
          </p>
          {pages.hasNextPage ? (
            <Button
              variant="outline"
              className="self-center"
              disabled={pages.isFetchingNextPage}
              onClick={() => pages.fetchNextPage()}
            >
              {pages.isFetchingNextPage ? t("list.loadingMore") : t("list.loadMore")}
            </Button>
          ) : (
            <p className="text-center text-sm text-muted-foreground">{t("list.end")}</p>
          )}
          {pages.isFetchNextPageError ? (
            <div className="flex flex-col items-center gap-2 text-sm text-destructive">
              <p>{sdkErrorMessage(pages.error, locale)}</p>
              {isRetryableError(pages.error) ? (
                <Button variant="ghost" onClick={() => pages.fetchNextPage()}>
                  {t("list.retry")}
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      )}
    </>
  )
}
