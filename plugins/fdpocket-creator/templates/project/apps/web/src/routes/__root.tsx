import { createRootRoute, Link, type LinkProps, Outlet } from "@tanstack/react-router"
import { useColorScheme, useSafeArea } from "@workspace/miniapp-sdk/react"
import { AppNav, AppNavItem } from "@workspace/ui/components/app-nav"
import { AppShell } from "@workspace/ui/components/app-shell"
import { House, type LucideIcon } from "lucide-react"

// アプリの骨格はここで 1 回だけ作る（ヘッダー・本文の幅と余白・主な行き先）。画面ごとに外枠を作り直さない。
export const Route = createRootRoute({ component: Root })

// 主な行き先（2〜5 個）。画面（routes/ のファイル）を足したら、ここに 1 行足す（`$app-responsive` §2）。
// 2 つ以上になると、スマホ幅は下のタブバー、タブレットは左のレール、PC は左のサイドバーになる。
// 行き先が 1 つのアプリ（1 画面で完結する道具など）はナビを出さない。並び・ラベル・アイコンはアプリに合わせて決める。
// 見た目は AppNav / AppNavItem の className で変えてよい（packages/ui の部品も自分のもの）。
// 別の形（上のタブ・メニューなど）が合うアプリは AppNav を使わなくてよい。
const NAV_ITEMS: { to: NonNullable<LinkProps["to"]>; label: string; icon: LucideIcon }[] = [
  { to: "/", label: "ホーム", icon: House },
]

const HOME_ONLY = { exact: true }

function Root() {
  // セーフエリアと明暗は開き方で取り方が違う（スーパーアプリ内は Host の値、ホーム画面・ブラウザは env() と端末の設定）。AppShell がまとめる
  const safeArea = useSafeArea()
  const colorScheme = useColorScheme()
  const nav =
    NAV_ITEMS.length >= 2 ? (
      <AppNav aria-label="メイン">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <AppNavItem key={label} asChild>
            {/* ホーム（/）は完全一致のときだけ選択中にする */}
            <Link to={to} activeOptions={to === "/" ? HOME_ONLY : undefined}>
              <Icon aria-hidden />
              {label}
            </Link>
          </AppNavItem>
        ))}
      </AppNav>
    ) : undefined
  return (
    <AppShell title="{{PROJECT_TITLE}}" safeArea={safeArea} colorScheme={colorScheme} nav={nav}>
      <Outlet />
    </AppShell>
  )
}
