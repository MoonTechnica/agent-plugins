---
name: fdpocket-ios-design-guidelines
description: "Apple Human Interface Guidelines（iPhone）の規則（同梱）。ミニアプリのスマホ幅の画面の型（下のナビ・見出しと戻る・一覧・詳細・シート・主な操作の置き場所・押せる大きさ）を決める・直す・採点するときに $fdpocket-app-visual / $fdpocket-app-ux-patterns / $fdpocket-app-design-review から使う。例のコード（SwiftUI / UIKit）は写さず規則だけ使う。"
license: MIT
metadata:
  author: platform-design-skills
  version: "1.0.0"
---

## FDPocket のミニアプリで使うとき（この節が優先）

この Skill は第三者の公開物（MIT。出所は `UPSTREAM.txt`）を同梱している（手を加えたのは description とこの節だけ）。中身は Apple Human Interface Guidelines（iPhone） を規則に直したもので、例は SwiftUI / UIKit で書かれている。
ミニアプリは **Vite + React + Tailwind + shadcn の Web 画面**で、スーパーアプリ（FDPocket）の中で **iPhone の人も Android の人も同じ画面**を開く。
だから **例のコードは写さず、規則（なぜそうするか）だけを使う**。**このプラットフォームの約束が優先する**（`spec.md` と `instructions.md` > `$fdpocket-app-visual`・`$fdpocket-app-ux-patterns`・`$fdpocket-app-responsive` > この Skill）。

**使いどころ**: スマホ幅の画面の型を決めるとき・直すとき（ナビ・見出しと戻る・一覧・詳細・シート・主な操作の置き場所・押せる大きさ）。`$fdpocket-app-design-review` で「なぜダメか」を言うときの根拠にもなる。
`$fdpocket-ios-design-guidelines`（Apple HIG）と `$fdpocket-android-design-guidelines`（Material Design 3）の**両方に共通すること**を既定にする。食い違うところは下の表の「ミニアプリでは」に従う。

| 規則の言葉 | ミニアプリでは |
|---|---|
| Tab bar / Navigation bar（下のナビ。3〜5 個） | `AppNav`（`__root.tsx` の `NAV_ITEMS`）。行き先が 1 つなら置かない。ラベルは必ず付け、選択中はブランド色と太字（部品が持つ） |
| Navigation bar の戻る（左上）・画面の名前（Large title / Top app bar） | `PageHeader` の `back`（左上の 44px のアイコン）と `title`。**本文の途中に「← 戻る」の行を置かない**。アプリ名は FDPocket が上に出すので、見出しはその画面の名前 |
| 右上の操作（iOS）・FAB（Android） | 画面の主な操作は 1 つ。`PageHeader` の `actions`（編集・追加）か、本文の最後の主ボタン。浮かぶボタン（FAB）は使わない（下のナビと重なる） |
| Inset grouped list / List items | 角丸の 1 まとまり（`Card` の中に区切り線のある行）。行は 44px 以上、左にラベル・右に値か `ChevronRight`。項目の種類ごとにまとまりを分ける（連絡先・メモ・設定） |
| Sheet / Bottom sheet | ひな形の `Sheet`（スマホ幅は下から、`md` 以上は中央）。範囲の決まった短い作業だけ。中央の `Dialog` は短い確認にだけ使う |
| Alert / Dialog | `AlertDialog` は取り消せない操作の確認だけ。お知らせは `toast` かその場の文字 |
| Dynamic Type / text styles | 文字は Tailwind の `text-*`（rem）。px で固定しない。本文 16px、補足 14px、12px 未満は使わない |
| Semantic colors / Material You（dynamic color） | トークン（`bg-background`・`text-muted-foreground`・`bg-primary`）と `globals.css` の `--brand-hue` だけ。壁紙の色に合わせる仕組みは無い |
| SF Symbols / Material Symbols | `lucide-react` |
| Safe area / edge-to-edge | `AppShell` が `--safe-*` で持つ。自分で `env(safe-area-inset-*)` を足さない |
| 画面端からの戻るスワイプ・予測型の戻る | 奪わない。画面端から始まる横スワイプを作らない。戻る操作はブラウザ・Host の戻ると同じ行き先にする（`$fdpocket-app-ux-patterns` §1） |
| 44pt / 48dp の押せる大きさ | スマホ幅で 44px 以上（`kit.mjs shot` が数える） |

**使わない節**（ミニアプリには無い・Platform が持つ）: ウィジェット・App Shortcuts・Spotlight・Live Activities・Sign in with Apple / ATT・権限の求め方（Host が持つ）・通知のチャンネル（`$fdpocket-app-notifications`）・壁紙の色の取得・ネイティブの触覚（SDK に無いものは使わない）・SF Pro の指定（端末の標準の書体 `--font-sans` を使う）。

**本文（規則と例）は `references/guidelines.md`**。下の目次で該当する章を開いて読む（全部を読まなくてよい）。

# iOS Design Skill

Apple Human Interface Guidelines for iPhone apps — layout, navigation, typography, accessibility, and system integration rules with SwiftUI/UIKit examples.

**Reference:** https://developer.apple.com/design/human-interface-guidelines

## Rule Categories

| # | Category | Impact | Rules |
|---|----------|--------|-------|
| 1 | Layout & Safe Areas | CRITICAL | Touch targets, safe areas, thumb zone, screen sizes |
| 2 | Navigation | CRITICAL | Tab bars, large titles, back swipe, state preservation |
| 3 | Typography & Dynamic Type | HIGH | Text styles, Dynamic Type, UIFontMetrics, SF Pro |
| 4 | Color & Dark Mode | HIGH | Semantic colors, contrast, P3 gamut, accent color |
| 5 | Accessibility | CRITICAL | VoiceOver, Bold Text, Reduce Motion, Switch Control |
| 6 | Gestures & Input | HIGH | Standard gestures, system gesture protection, input methods |
| 7 | Components | HIGH | Buttons, alerts, sheets, lists, tab bars, search, menus, SF Symbols |
| 8 | Patterns | MEDIUM | Onboarding, loading, launch, modality, feedback |
| 9 | Privacy & Permissions | HIGH | Contextual requests, Sign in with Apple, ATT |
| 10 | System Integration | MEDIUM | Widgets, App Shortcuts, Spotlight, Live Activities |

## Never Do

- Never use hamburger menus — use a tab bar
- Never override swipe-from-left-edge back navigation
- Never hardcode text sizes — support Dynamic Type
- Never use only color to convey information
- Never request all permissions at launch
- Never place primary actions at the top of the screen (outside thumb zone)
- Never clip content under the status bar, home indicator, or Dynamic Island
- Never use blocking spinner overlays for loading states
- Never show splash screen logos — match the first screen of the app
- Never hide the tab bar during navigation within a tab
