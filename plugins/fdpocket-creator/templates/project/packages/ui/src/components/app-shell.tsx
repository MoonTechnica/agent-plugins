import { cn } from 'cn'
import * as React from 'react'
import { applyColorScheme, type ColorScheme } from '../lib/color-scheme'

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

/** 明暗が変わったら html の `.dark` を付け外す（`$app-visual` §8） */
function useColorSchemeClass(scheme: ColorScheme | undefined) {
  React.useEffect(() => {
    if (scheme) applyColorScheme(scheme)
  }, [scheme])
}

/**
 * アプリの骨格: 上に固定のヘッダー、本文は幅を決めて中央に。セーフエリアの余白もここで取る（`$app-pwa` §2）。
 * 主な行き先が 2〜5 個なら `nav` に `AppNav` を渡す（スマホ幅は下のタブバー、広い画面は左のレール・サイドバー。
 * 本文の下の余白もタブバーの分だけ取る。`$app-responsive` §2）。
 * 各 App のルート（`__root.tsx`）で 1 回だけ使う。画面ごとに外枠を作り直さない（`$app-visual` §4）。
 * `safeArea` には `useSafeArea()`、`colorScheme` には `useColorScheme()`（どちらも `@workspace/miniapp-sdk/react`）を渡す。
 */
function AppShell({
  title,
  actions,
  width = 'narrow',
  nav,
  safeArea,
  colorScheme,
  children,
  className,
}: {
  title: string
  actions?: React.ReactNode
  /** `AppNav`（主な行き先）。行き先が 1 つなら渡さない */
  nav?: React.ReactNode
  width?: keyof typeof WIDTHS
  safeArea?: SafeAreaInsets
  colorScheme?: ColorScheme
  children: React.ReactNode
  className?: string
}) {
  useHostSafeArea(safeArea)
  useColorSchemeClass(colorScheme)
  return (
    <div data-slot="app-shell" className="min-h-dvh bg-background text-foreground">
      <header className="sticky top-0 z-10 border-b bg-background/85 pt-[var(--safe-top)] backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div
          className={cn(
            'mx-auto flex h-14 w-full items-center justify-between gap-3 pr-[max(1rem,var(--safe-right))] pl-[max(1rem,var(--safe-left))]',
            // ナビがあるときは画面の幅いっぱい（見出しを左のナビの上にそろえる。PC アプリの窓の形）
            WIDTHS[width],
            nav && 'md:max-w-none'
          )}
        >
          <p className="truncate text-base font-semibold">{title}</p>
          {actions ? <div className="flex items-center gap-1">{actions}</div> : null}
        </div>
      </header>
      <div className={cn(nav && 'md:flex')}>
        {nav}
        <main
          className={cn(
            'mx-auto flex w-full min-w-0 flex-col gap-6 pt-6 pr-[max(1rem,var(--safe-right))] pb-[calc(1.5rem+var(--safe-bottom))] pl-[max(1rem,var(--safe-left))]',
            // 下のタブバー（56px + ホームバー）に最後の行が隠れないように。広い画面のナビは左にあるので戻す
            nav &&
              'pb-[calc(5rem+var(--safe-bottom))] md:pb-[calc(1.5rem+var(--safe-bottom))] md:pl-6',
            WIDTHS[width],
            className
          )}
        >
          {children}
        </main>
      </div>
    </div>
  )
}

export { AppShell }
