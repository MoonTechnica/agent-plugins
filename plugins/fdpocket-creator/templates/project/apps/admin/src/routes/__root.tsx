import {
  createRootRoute,
  Link,
  type LinkProps,
  Outlet,
  useMatchRoute,
} from "@tanstack/react-router"
import { useColorScheme, useSafeArea, useSession } from "@workspace/miniapp-sdk/react"
import {
  AppNav,
  AppNavFooter,
  AppNavItem,
  AppNavMore,
  AppNavMoreItem,
  AppNavSection,
} from "@workspace/ui/components/app-nav"
import { AppShell } from "@workspace/ui/components/app-shell"
import { LayoutDashboard, type LucideIcon, Settings, UserRound } from "lucide-react"
import { Fragment } from "react"

// 管理画面の骨格はここで 1 回だけ作る（本文の幅・余白・左のナビ）。画面ごとに外枠を作り直さない。
// アプリ名のヘッダーは置かない（スーパーアプリの中では FDPocket が上に出す）。各画面の先頭は PageHeader（その画面の名前）。
export const Route = createRootRoute({ component: Root })

type NavItem = { to: NonNullable<LinkProps["to"]>; label: string; icon: LucideIcon }

// 行き先の一覧。**画面（routes/ のファイル）を足したら、必ずここに 1 行足す**（足さないと、その画面へ行く道が無い）。
// - 並びは「よく使う順」。`heading` を付けると、広い画面のサイドバーに節の見出しが出る（スマホ幅には出ない）。
// - 2 個以上でナビが出る。スマホ幅の下のタブは 5 枠までなので、6 個以上のときは先頭の 4 つだけが下のタブに残り、
//   残りは自動で「その他」（押すと下からシートが開く）に入る。PC・タブレットの左のナビには全部が並ぶ（`$app-responsive` §2）。
// - 管理画面でも 10 個を超えたら、行き先を増やす前に画面をまとめられないか考える（`$app-ux-patterns` §1）。
const NAV_GROUPS: { heading?: string; items: NavItem[] }[] = [
  { items: [{ to: "/", label: "概要", icon: LayoutDashboard }] },
  { heading: "管理", items: [{ to: "/settings", label: "設定", icon: Settings }] },
]

const ALL_ITEMS = NAV_GROUPS.flatMap((group) => group.items)
const TAB_COUNT = ALL_ITEMS.length > 5 ? 4 : ALL_ITEMS.length
const MORE_ITEMS = ALL_ITEMS.slice(TAB_COUNT)

function Root() {
  // セーフエリアと明暗は開き方で取り方が違う（スーパーアプリ内は Host の値、ホーム画面・ブラウザは env() と端末の設定）。AppShell がまとめる
  const safeArea = useSafeArea()
  const colorScheme = useColorScheme()
  const session = useSession()
  const matchRoute = useMatchRoute()
  const moreActive = MORE_ITEMS.some((item) => matchRoute({ to: item.to, fuzzy: item.to !== "/" }))

  const nav =
    ALL_ITEMS.length >= 2 ? (
      <AppNav aria-label="メイン">
        {NAV_GROUPS.map((group) => (
          <Fragment key={group.heading ?? "main"}>
            {group.heading ? <AppNavSection>{group.heading}</AppNavSection> : null}
            {group.items.map(({ to, label, icon: Icon }) => (
              <AppNavItem key={to} asChild secondary={MORE_ITEMS.some((item) => item.to === to)}>
                {/* 概要（/）は完全一致のときだけ選択中にする */}
                <Link to={to} activeOptions={to === "/" ? { exact: true } : undefined}>
                  <Icon aria-hidden />
                  {label}
                </Link>
              </AppNavItem>
            ))}
          </Fragment>
        ))}
        {MORE_ITEMS.length > 0 ? (
          <AppNavMore label="その他" active={moreActive}>
            {MORE_ITEMS.map(({ to, label, icon: Icon }) => (
              <AppNavMoreItem key={to} asChild>
                <Link to={to}>
                  <Icon aria-hidden />
                  {label}
                </Link>
              </AppNavMoreItem>
            ))}
          </AppNavMore>
        ) : null}
        {/* 左のナビの下端（広い画面だけ）。今のアカウント。アプリの名前は置かない（FDPocket が出す） */}
        <AppNavFooter>
          <div className="flex min-h-11 items-center justify-center gap-3 px-3 text-sm text-muted-foreground lg:justify-start">
            <UserRound aria-hidden className="shrink-0" />
            <span className="hidden min-w-0 truncate lg:inline">
              {session?.displayName ?? "ゲスト"}
            </span>
          </div>
        </AppNavFooter>
      </AppNav>
    ) : undefined

  // topBar（PC 幅だけの道具の帯: 検索・通知・アカウント）と footer（本文の下の注意書き・版）は、必要なら AppShell に渡す。`$app-visual` §4
  return (
    <AppShell
      width="wide"
      safeArea={safeArea}
      colorScheme={colorScheme}
      nav={nav}
      skipLabel="本文へ移動"
    >
      <Outlet />
    </AppShell>
  )
}
