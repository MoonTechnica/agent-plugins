import { cn } from 'cn'
import type * as React from 'react'

const WIDTHS = {
  // 利用者向け（スマホが主）。本文は読みやすい幅に。
  narrow: 'max-w-2xl',
  // 管理画面（表・一覧が主）。広い画面で表が窮屈にならない幅に。
  wide: 'max-w-5xl',
} as const

/**
 * アプリの骨格: 上に固定のヘッダー、本文は幅を決めて中央に。
 * 各 App のルート（`__root.tsx`）で 1 回だけ使う。画面ごとに外枠を作り直さない（`$app-visual` §4）。
 */
function AppShell({
  title,
  actions,
  width = 'narrow',
  children,
  className,
}: {
  title: string
  actions?: React.ReactNode
  width?: keyof typeof WIDTHS
  children: React.ReactNode
  className?: string
}) {
  return (
    <div data-slot="app-shell" className="min-h-dvh bg-background text-foreground">
      <header className="sticky top-0 z-10 border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div
          className={cn('mx-auto flex h-14 w-full items-center justify-between gap-3 px-4', WIDTHS[width])}
        >
          <p className="truncate text-base font-semibold">{title}</p>
          {actions ? <div className="flex items-center gap-1">{actions}</div> : null}
        </div>
      </header>
      <main className={cn('mx-auto flex w-full flex-col gap-6 px-4 py-6', WIDTHS[width], className)}>
        {children}
      </main>
    </div>
  )
}

export { AppShell }
