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
 * アプリの骨格: 本文の幅と余白、セーフエリア、明暗、主な行き先（`nav`）。
 *
 * **アプリ名のヘッダーは持たない。** スーパーアプリの中では FDPocket が上にアプリ名と閉じるボタンを出すので、
 * ここでも出すとアプリ名が二重になる。画面の一番上は各画面の `PageHeader`（その画面の名前・戻る・操作）にする
 * （iOS・Android の標準アプリと同じく、上に出すのは「今いる画面」の名前）。
 * 主な行き先が 2〜5 個なら `nav` に `AppNav` を渡す（スマホ幅は下のタブバー、広い画面は左のレール・サイドバー。
 * 本文の下の余白もタブバーの分だけ取る。`$app-responsive` §2）。
 * 各 App のルート（`__root.tsx`）で 1 回だけ使う。画面ごとに外枠を作り直さない（`$app-visual` §4）。
 * `safeArea` には `useSafeArea()`、`colorScheme` には `useColorScheme()`（どちらも `@workspace/miniapp-sdk/react`）を渡す。
 */
function AppShell({
  width = 'narrow',
  nav,
  safeArea,
  colorScheme,
  children,
  className,
}: {
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
    <div data-slot="app-shell" className="group/shell min-h-dvh bg-background text-foreground">
      <div className={cn(nav && 'md:flex')}>
        {nav}
        <main
          className={cn(
            'mx-auto flex w-full min-w-0 flex-col gap-6 pt-[calc(1rem+var(--safe-top))] pr-[max(1rem,var(--safe-right))] pb-[calc(1.5rem+var(--safe-bottom))] pl-[max(1rem,var(--safe-left))]',
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
