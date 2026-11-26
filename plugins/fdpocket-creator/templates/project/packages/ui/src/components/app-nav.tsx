import { cn } from 'cn'
import { Slot } from 'radix-ui'
import type * as React from 'react'

/**
 * アプリの主な行き先（2〜5 個）。1 つの `<nav>` が幅で形を変える（`$app-responsive` §2。Material の
 * ナビゲーションバー → レール、Apple のタブバー → サイドバーと同じ切り替え）:
 * - スマホ幅（`md` 未満）: 画面の下に固定したタブバー（アイコン + 短いラベル）。ホームバーの余白も取る
 * - `md`〜`lg`: 左のレール（アイコンの下にラベル）
 * - `lg` 以上: 左のサイドバー（アイコンとラベルを横に）
 *
 * `AppShell` の `nav` に渡す。行き先が 1 つなら作らない（`$app-ux-patterns` §1）。
 * 項目は `AppNavItem asChild` に TanStack Router の `<Link>` を入れる（今いる行き先に Link が `aria-current="page"` を付ける）。
 * 選択中はブランド色と太字で示す（灰色の濃さの差だけでは暗い画面で見分けられない）。
 * 詳細の画面（`/contacts/$id`）でも元のタブが選択中に見えるよう、行き先はそれぞれのパス（`/contacts`）に置く。
 */
function AppNav({ className, ...props }: React.ComponentProps<'nav'>) {
  return (
    <nav
      data-slot="app-nav"
      className={cn(
        // 入力中はスマホ幅のタブバーを隠す（キーボードの上に乗って入力欄を狭めないように。`$app-responsive` §2）
        'max-md:group-has-[textarea:focus,[contenteditable]:focus,input:not([type=checkbox]):not([type=radio]):not([type=range]):focus]/shell:hidden',
        'fixed inset-x-0 bottom-0 z-10 flex border-t bg-background/95 pr-[var(--safe-right)] pb-[var(--safe-bottom)] pl-[var(--safe-left)] backdrop-blur supports-[backdrop-filter]:bg-background/80',
        'md:sticky md:top-0 md:h-dvh md:w-20 md:shrink-0 md:flex-col md:gap-1 md:overflow-y-auto md:border-t-0 md:border-r md:bg-background md:pt-[calc(0.75rem+var(--safe-top))] md:pr-2 md:pb-[max(0.75rem,var(--safe-bottom))] md:pl-[max(0.5rem,var(--safe-left))] md:backdrop-blur-none',
        'lg:w-60 lg:pr-3 lg:pl-[max(0.75rem,var(--safe-left))]',
        className
      )}
      {...props}
    />
  )
}

/**
 * 行き先 1 つ。中にアイコン（lucide、`aria-hidden`）とラベルの文字を入れる（アイコンだけにしない）。
 * hover の色はマウスのある端末だけに付く（Tailwind 4 の `hover:` は `@media (hover: hover)` の中）。
 */
function AppNavItem({
  asChild = false,
  active,
  className,
  ...props
}: React.ComponentProps<'a'> & { asChild?: boolean; active?: boolean }) {
  const Comp = asChild ? Slot.Root : 'a'
  return (
    <Comp
      data-slot="app-nav-item"
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex min-h-14 min-w-0 flex-1 flex-col items-center justify-center gap-1 px-1 text-xs font-medium text-muted-foreground transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 aria-[current=page]:font-semibold aria-[current=page]:text-primary [&_svg]:size-5 [&_svg]:shrink-0',
        'md:flex-none md:rounded-xl md:py-2 md:text-center md:hover:bg-muted md:aria-[current=page]:bg-muted',
        'lg:min-h-11 lg:flex-row lg:justify-start lg:gap-3 lg:px-3 lg:text-left lg:text-sm',
        className
      )}
      {...props}
    />
  )
}

export { AppNav, AppNavItem }
