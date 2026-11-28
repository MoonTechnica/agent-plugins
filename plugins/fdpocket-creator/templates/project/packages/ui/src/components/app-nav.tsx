import { cn } from 'cn'
import { EllipsisIcon } from 'lucide-react'
import { Slot } from 'radix-ui'
import type * as React from 'react'
import { Separator } from './separator'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from './sheet'

/**
 * アプリの主な行き先（2〜5 個）。1 つの `<nav>` が幅で形を変える（`$app-responsive` §2。Material の
 * ナビゲーションバー → レール、Apple のタブバー → サイドバーと同じ切り替え）:
 * - スマホ幅（`md` 未満）: 画面の下に固定したタブバー（アイコン + 短いラベル）。ホームバーの余白も取る
 * - `md`〜`lg`: 左のレール（アイコンの下にラベル）
 * - `lg` 以上: 左のサイドバー（アイコンとラベルを横に）
 *
 * `AppShell` の `nav` に渡す。行き先が 1 つなら作らない（`$app-ux-patterns` §1）。
 *
 * **行き先が 6 個以上のとき**（管理画面・業務システム）: スマホ幅の下のタブは 5 枠まで。主な 4 つを `AppNavItem`、
 * 残りを `AppNavItem secondary`（スマホ幅では隠れ、レール・サイドバーには出る）にし、同じ行き先を `AppNavMore`
 * の中に `AppNavMoreItem` で並べる（スマホ幅の「その他」。押すと下からシートが開く）。
 * サイドバー（`lg` 以上）には `AppNavSection` で節の見出し、`AppNavHeader` でアプリの名前、`AppNavFooter` でアカウントなどを置ける。
 * この 3 つはスマホ幅では出ない（アプリ名は FDPocket が上に出す。アカウントは画面の中から開く）。
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

const ITEM_CLASS = cn(
  'flex min-h-14 min-w-0 flex-1 flex-col items-center justify-center gap-1 px-1 text-xs font-medium text-muted-foreground transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 aria-[current=page]:font-semibold aria-[current=page]:text-primary [&_svg]:size-5 [&_svg]:shrink-0',
  'md:flex-none md:rounded-xl md:py-2 md:text-center md:hover:bg-muted md:aria-[current=page]:bg-muted',
  'lg:min-h-11 lg:flex-row lg:justify-start lg:gap-3 lg:px-3 lg:text-left lg:text-sm',
  // マウスの PC は行を詰める（業務アプリのサイドバーの密度。指の端末は 44px 以上のまま）
  'desk:lg:min-h-9 desk:lg:rounded-lg desk:lg:gap-2.5 desk:lg:[&_svg]:size-4'
)

/**
 * 行き先 1 つ。中にアイコン（lucide、`aria-hidden`）とラベルの文字を入れる（アイコンだけにしない）。
 * hover の色はマウスのある端末だけに付く（Tailwind 4 の `hover:` は `@media (hover: hover)` の中）。
 */
function AppNavItem({
  asChild = false,
  active,
  secondary = false,
  className,
  ...props
}: React.ComponentProps<'a'> & {
  asChild?: boolean
  active?: boolean
  /** スマホ幅の下のタブには出さない行き先（`AppNavMore` に同じものを入れる）。レール・サイドバーには出る */
  secondary?: boolean
}) {
  const Comp = asChild ? Slot.Root : 'a'
  return (
    <Comp
      data-slot="app-nav-item"
      aria-current={active ? 'page' : undefined}
      className={cn(ITEM_CLASS, secondary && 'max-md:hidden', className)}
      {...props}
    />
  )
}

/** サイドバー（`lg` 以上）の節の見出し。レール（`md`）では細い区切り線になる。スマホ幅では出ない */
function AppNavSection({ className, children, ...props }: React.ComponentProps<'div'>) {
  return (
    <div data-slot="app-nav-section" className={cn('hidden md:block', className)} {...props}>
      <Separator className="mx-2 my-1 w-auto lg:hidden" />
      <p className="hidden px-3 pt-4 pb-1 text-xs font-medium text-muted-foreground lg:block">
        {children}
      </p>
    </div>
  )
}

/**
 * ナビの先頭（アプリの名前・ロゴ）。`md` 以上だけ出る。レール（`md`）にはアイコンだけが入る幅なので、
 * 文字は `<span className="hidden lg:inline">` に入れる。スマホ幅では出さない（アプリ名は FDPocket が上に出す）。
 */
function AppNavHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="app-nav-header"
      className={cn(
        'hidden md:flex md:min-h-12 md:items-center md:justify-center md:gap-2 md:px-1 md:pb-2 lg:justify-start lg:px-3',
        className
      )}
      {...props}
    />
  )
}

/** ナビの下端（今のアカウント・設定への入口など）。`md` 以上だけ出て、いちばん下に寄る */
function AppNavFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="app-nav-footer"
      className={cn(
        'hidden md:mt-auto md:flex md:flex-col md:gap-1 md:border-t md:pt-2 [&_svg]:size-5',
        className
      )}
      {...props}
    />
  )
}

/**
 * スマホ幅の下のタブの最後の 1 枠「その他」。`secondary` の行き先を、押すと下から開くシートに並べる。
 * レール・サイドバーでは出ない（そこには全部の行き先が並ぶ）。
 * `active` は、今いる画面が「その他」の中にあるとき（タブを選択中の色にする）。
 */
function AppNavMore({
  label,
  active,
  icon,
  className,
  children,
}: {
  label: string
  active?: boolean
  icon?: React.ReactNode
  className?: string
  children: React.ReactNode
}) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <button
          type="button"
          data-slot="app-nav-more"
          aria-current={active ? 'page' : undefined}
          className={cn(ITEM_CLASS, 'md:hidden', className)}
        >
          {icon ?? <EllipsisIcon aria-hidden />}
          {label}
        </button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{label}</SheetTitle>
          <SheetDescription className="sr-only">{label}</SheetDescription>
        </SheetHeader>
        <div className="flex flex-col">{children}</div>
      </SheetContent>
    </Sheet>
  )
}

/** `AppNavMore` のシートの中の行き先 1 つ（アイコン + ラベルの横並びの行。44px 以上。押すとシートが閉じる） */
function AppNavMoreItem({
  asChild = false,
  className,
  ...props
}: React.ComponentProps<'a'> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : 'a'
  return (
    // 行き先を選んだらシートを閉じる（リンクの移動だけではシートが開いたままになる）
    <SheetClose asChild>
      <Comp
        data-slot="app-nav-more-item"
        className={cn(
          'flex min-h-12 items-center gap-3 rounded-xl px-3 text-base text-foreground outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 aria-[current=page]:font-semibold aria-[current=page]:text-primary [&_svg]:size-5 [&_svg]:shrink-0',
          className
        )}
        {...props}
      />
    </SheetClose>
  )
}

export {
  AppNav,
  AppNavFooter,
  AppNavHeader,
  AppNavItem,
  AppNavMore,
  AppNavMoreItem,
  AppNavSection,
}
