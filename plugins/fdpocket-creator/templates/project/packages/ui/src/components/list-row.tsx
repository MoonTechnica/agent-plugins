import { cn } from 'cn'
import { Slot } from 'radix-ui'
import type * as React from 'react'

/**
 * 一覧の 1 行。`<Card variant="list">` の中に並べる（行の間の線は Card が引く）。
 * 左から「先頭（アバター・アイコン）」「主な文字（`title`）と補足（`description`）」「右の情報（`meta`。状態・日付・金額）」「操作（`actions`）」。
 *
 * 行全体で詳細を開くときは `asChild` で `<Link>` を渡す（行の中に別のボタンを置くなら、そのボタンは `actions` に置く）。
 * 高さは指の画面 56px・マウスの PC 44px（`--row-h`）。
 *
 * ```tsx
 * <Card variant="list">
 *   {deals.map((deal) => (
 *     <ListRow key={deal.id} asChild leading={<Avatar>…</Avatar>} title={deal.name}
 *       description={deal.company} meta={<Badge variant="success">受注</Badge>}>
 *       <Link to="/deals/$id" params={ { id: deal.id } } />
 *     </ListRow>
 *   ))}
 * </Card>
 * ```
 */
function ListRow({
  title,
  description,
  leading,
  meta,
  actions,
  asChild = false,
  children,
  className,
}: {
  title: React.ReactNode
  description?: React.ReactNode
  leading?: React.ReactNode
  meta?: React.ReactNode
  actions?: React.ReactNode
  /** 行全体をリンクにする（子に `<Link>` を 1 つ渡す。中身はこの部品が描く） */
  asChild?: boolean
  children?: React.ReactElement
  className?: string
}) {
  const body = (
    <>
      {leading ? <div className="flex shrink-0 items-center">{leading}</div> : null}
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-medium">{title}</span>
        {description ? (
          <span className="truncate text-sm text-muted-foreground desk:text-xs">{description}</span>
        ) : null}
      </div>
      {meta ? (
        <div className="flex shrink-0 items-center gap-2 text-sm text-muted-foreground tabular-nums">
          {meta}
        </div>
      ) : null}
    </>
  )
  const rowClass =
    'flex min-h-(--row-h) min-w-0 flex-1 items-center gap-3 px-4 py-2 text-left outline-none desk:px-3 desk:gap-2.5'
  return (
    <div
      data-slot="list-row"
      className={cn('group/row flex items-center transition-colors hover:bg-muted/50', className)}
    >
      {asChild && children ? (
        // Slottable の子（Link）に class と中身（body）を渡す
        <Slot.Root className={cn(rowClass, 'focus-visible:bg-muted')}>
          <Slot.Slottable>{children}</Slot.Slottable>
          {body}
        </Slot.Root>
      ) : (
        <div className={rowClass}>{body}</div>
      )}
      {actions ? <div className="flex shrink-0 items-center gap-1 pr-2">{actions}</div> : null}
    </div>
  )
}

export { ListRow }
