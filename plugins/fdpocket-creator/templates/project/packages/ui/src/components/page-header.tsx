import { cn } from 'cn'
import { Slot } from 'radix-ui'
import type * as React from 'react'

/**
 * 画面の一番上。**その画面の名前**が主役で、説明は 1 行、操作は右（狭い幅では下）に置く。
 * アプリ名は書かない（スーパーアプリの中では FDPocket が上に出している。`AppShell`）。
 *
 * 詳細・編集の画面は `back` に戻り先の `<Link>` を渡す。タイトルの左に 44px の戻るボタンとして置かれる
 * （本文の途中に「戻る」のボタンを置かない。ホーム画面から開くとブラウザの戻るが無い。`$app-pwa` §3）。
 *
 * ```tsx
 * <PageHeader
 *   title={contact.name}
 *   description={`${contact.company} · ${contact.role}`}
 *   back={<Link to="/contacts" aria-label={t.back}><ChevronLeft aria-hidden /></Link>}
 *   actions={<ContactMenu contact={contact} />}
 * />
 * ```
 */
function PageHeader({
  title,
  description,
  back,
  actions,
  className,
}: {
  title: string
  description?: string
  /** 戻り先の `<Link>`（中身は `ChevronLeft` のアイコンと `aria-label`）。見た目はここで付ける */
  back?: React.ReactElement
  actions?: React.ReactNode
  className?: string
}) {
  return (
    <header
      data-slot="page-header"
      className={cn('flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between', className)}
    >
      <div className="flex min-w-0 items-start gap-1">
        {back ? (
          <Slot.Root className="-ml-3 inline-flex size-11 shrink-0 desk:-ml-2 desk:size-9 desk:[&_svg]:size-5 items-center justify-center rounded-full text-foreground outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 [&_svg]:size-6">
            {back}
          </Slot.Root>
        ) : null}
        <div className={cn('flex min-w-0 flex-col gap-1', back && 'pt-1 desk:pt-0.5')}>
          <h1 className="text-[1.75rem] leading-tight font-semibold tracking-tight break-words desk:text-2xl">{title}</h1>
          {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
        </div>
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </header>
  )
}

export { PageHeader }
