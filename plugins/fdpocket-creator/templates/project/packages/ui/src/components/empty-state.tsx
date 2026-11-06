import { cn } from 'cn'
import type { LucideIcon } from 'lucide-react'
import type * as React from 'react'

/**
 * 何も無いときの表示。「何も無い」ことと、**次にすること**（`action`）をセットで出す。
 * 空の一覧に文字だけを置かない（`$app-visual` §5）。
 */
function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div
      data-slot="empty-state"
      className={cn('flex flex-col items-center gap-3 px-4 py-12 text-center', className)}
    >
      {Icon ? (
        <div className="flex size-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
          <Icon aria-hidden className="size-6" />
        </div>
      ) : null}
      <div className="flex flex-col gap-1">
        <p className="text-base font-medium">{title}</p>
        {description ? (
          <p className="max-w-xs text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  )
}

export { EmptyState }
