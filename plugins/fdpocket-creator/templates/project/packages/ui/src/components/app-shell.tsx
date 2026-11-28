import { cn } from 'cn'
import * as React from 'react'
import { applyColorScheme, type ColorScheme } from '../lib/color-scheme'

const WIDTHS = {
  // 利用者向け（スマホが主）。本文は読みやすい幅に。
  narrow: 'max-w-2xl',
  // 一覧・表・ダッシュボードが主の画面（業務・管理）。PC の幅を使い切る（本文が画面の半分しかない、を作らない）。
  wide: 'max-w-7xl',
  // 画面幅いっぱい（カンバン・カレンダー・横に長い表）。
  full: 'max-w-none',
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
 * アプリの骨格: 本文の幅と余白、セーフエリア、明暗、主な行き先（`nav`）、PC 幅の道具の帯（`topBar`）、下のフッター（`footer`）。
 *
 * **アプリ名のヘッダーは持たない。** スーパーアプリの中では FDPocket が上にアプリ名と閉じるボタンを出すので、
 * ここでも出すとアプリ名が二重になる。画面の一番上は各画面の `PageHeader`（その画面の名前・戻る・操作）にする
 * （iOS・Android の標準アプリと同じく、上に出すのは「今いる画面」の名前）。
 * 主な行き先が 2〜5 個なら `nav` に `AppNav` を渡す（スマホ幅は下のタブバー、広い画面は左のレール・サイドバー。
 * 本文の下の余白もタブバーの分だけ取る。`$app-responsive` §2）。6 個以上は `AppNavMore` を足す（同 §2）。
 *
 * - `topBar`: **PC 幅（`md` 以上）だけ**本文の上に固定する帯。検索・通知・アカウントなど、画面をまたいで使う道具を置く
 *   （アプリ名は置かない）。スマホ幅では出ないので、同じ道具は `PageHeader` の `actions` か画面の中から開けるようにする。
 * - `footer`: 本文の下（スクロールの最後）に出る注意書き・リンク・版の表示。画面の下に固定しない（固定すると本文を隠す）。
 *   下のタブバーに隠れないよう余白を取る。
 *
 * 各 App のルート（`__root.tsx`）で 1 回だけ使う。画面ごとに外枠を作り直さない（`$app-visual` §4）。
 * `safeArea` には `useSafeArea()`、`colorScheme` には `useColorScheme()`（どちらも `@workspace/miniapp-sdk/react`）を渡す。
 */
function AppShell({
  width = 'narrow',
  nav,
  topBar,
  footer,
  skipLabel,
  safeArea,
  colorScheme,
  children,
  className,
}: {
  /** `AppNav`（主な行き先）。行き先が 1 つなら渡さない */
  nav?: React.ReactNode
  /** PC 幅だけ本文の上に固定する道具の帯（検索・アカウントなど。アプリ名は置かない） */
  topBar?: React.ReactNode
  /** 本文の下（スクロールの最後）の注意書き・リンク・版の表示 */
  footer?: React.ReactNode
  /**
   * 「本文へ移動」のリンクの文言（全対応言語）。ナビがあるとき、キーボードの人がナビを全部たどらずに本文へ飛べる
   * （WCAG 2.4.1）。Tab の最初に現れる。`nav` を渡すなら必ず渡す
   */
  skipLabel?: string
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
      {nav && skipLabel ? (
        <a
          href="#app-main"
          onClick={(event) => {
            event.preventDefault()
            document.getElementById('app-main')?.focus()
          }}
          className="sr-only focus:not-sr-only focus:fixed focus:top-[calc(0.5rem+var(--safe-top))] focus:left-[calc(0.5rem+var(--safe-left))] focus:z-50 focus:rounded-lg focus:border focus:bg-background focus:px-4 focus:py-3 focus:text-sm focus:font-medium focus:text-foreground focus:shadow-md focus:ring-3 focus:ring-ring/50"
        >
          {skipLabel}
        </a>
      ) : null}
      <div className={cn(nav && 'md:flex')}>
        {nav}
        <div className="flex min-h-dvh min-w-0 flex-1 flex-col">
          {topBar ? (
            <div
              data-slot="app-top-bar"
              className="sticky top-0 z-10 hidden min-h-14 items-center gap-3 border-b bg-background/95 pt-[var(--safe-top)] pr-[max(1.5rem,var(--safe-right))] pl-6 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:flex"
            >
              {topBar}
            </div>
          ) : null}
          <main
            id="app-main"
            tabIndex={-1}
            className={cn(
              'outline-none',
              'mx-auto flex w-full min-w-0 flex-1 flex-col gap-6 pt-[calc(1rem+var(--safe-top))] pr-[max(1rem,var(--safe-right))] pb-[calc(1.5rem+var(--safe-bottom))] pl-[max(1rem,var(--safe-left))]',
              // 下のタブバー（56px + ホームバー）に最後の行が隠れないように。広い画面のナビは左にあるので戻す
              nav &&
                'pb-[calc(5rem+var(--safe-bottom))] md:pb-[calc(1.5rem+var(--safe-bottom))] md:pl-6',
              // 道具の帯がある PC 幅では、帯が上の余白と安全領域を持つので本文の上は普通の余白にする
              topBar && 'md:pt-6',
              WIDTHS[width],
              className
            )}
          >
            {children}
          </main>
          {footer ? (
            <footer
              data-slot="app-footer"
              className={cn(
                'mx-auto flex w-full min-w-0 flex-wrap items-center gap-x-4 gap-y-1 border-t pt-4 pr-[max(1rem,var(--safe-right))] pb-[calc(1rem+var(--safe-bottom))] pl-[max(1rem,var(--safe-left))] text-xs text-muted-foreground',
                // 下のタブバーの分（本文の pb と同じ）。広い画面のナビは左にある
                nav && 'pb-[calc(5rem+var(--safe-bottom))] md:pb-[calc(1rem+var(--safe-bottom))] md:pl-6',
                WIDTHS[width]
              )}
            >
              {footer}
            </footer>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export { AppShell }
