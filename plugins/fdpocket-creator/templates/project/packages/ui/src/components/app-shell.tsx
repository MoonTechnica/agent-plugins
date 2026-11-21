import { cn } from 'cn'
import * as React from 'react'

const WIDTHS = {
  // 利用者向け（スマホが主）。本文は読みやすい幅に。
  narrow: 'max-w-2xl',
  // 管理画面（表・一覧が主）。広い画面で表が窮屈にならない幅に。
  wide: 'max-w-5xl',
} as const

type SafeAreaInsets = { top: number; right: number; bottom: number; left: number }

/**
 * Host が渡すセーフエリアを `--host-safe-*` に入れる（`globals.css` の `--safe-*` が env() と合わせる）。
 * Sheet・Dialog は body の直下に出るので、AppShell の要素ではなく html に置く。
 */
function useHostSafeArea(insets: SafeAreaInsets | undefined) {
  React.useEffect(() => {
    if (!insets) return
    const style = document.documentElement.style
    for (const side of ['top', 'right', 'bottom', 'left'] as const) {
      style.setProperty(`--host-safe-${side}`, `${insets[side]}px`)
    }
  }, [insets])
}

/**
 * アプリの骨格: 上に固定のヘッダー、本文は幅を決めて中央に。セーフエリアの余白もここで取る（`$app-pwa` §2）。
 * 各 App のルート（`__root.tsx`）で 1 回だけ使う。画面ごとに外枠を作り直さない（`$app-visual` §4）。
 * `safeArea` には `useSafeArea()`（`@workspace/miniapp-sdk/react`）を渡す。
 */
function AppShell({
  title,
  actions,
  width = 'narrow',
  safeArea,
  children,
  className,
}: {
  title: string
  actions?: React.ReactNode
  width?: keyof typeof WIDTHS
  safeArea?: SafeAreaInsets
  children: React.ReactNode
  className?: string
}) {
  useHostSafeArea(safeArea)
  return (
    <div data-slot="app-shell" className="min-h-dvh bg-background text-foreground">
      <header className="sticky top-0 z-10 border-b bg-background/85 pt-[var(--safe-top)] backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div
          className={cn(
            'mx-auto flex h-14 w-full items-center justify-between gap-3 pr-[max(1rem,var(--safe-right))] pl-[max(1rem,var(--safe-left))]',
            WIDTHS[width]
          )}
        >
          <p className="truncate text-base font-semibold">{title}</p>
          {actions ? <div className="flex items-center gap-1">{actions}</div> : null}
        </div>
      </header>
      <main
        className={cn(
          'mx-auto flex w-full flex-col gap-6 pt-6 pr-[max(1rem,var(--safe-right))] pb-[calc(1.5rem+var(--safe-bottom))] pl-[max(1rem,var(--safe-left))]',
          WIDTHS[width],
          className
        )}
      >
        {children}
      </main>
    </div>
  )
}

export { AppShell }
