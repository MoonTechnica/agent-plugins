export type ColorScheme = 'light' | 'dark'

/**
 * 画面の明暗を html に付ける: `.dark`（`globals.css` の暗いトークンと `dark:` の切り替え）と
 * `color-scheme`（スクロールバー・入力欄・日付選択などブラウザが描く部品の明暗）。
 * Sheet・Dialog は body の直下に出るので、AppShell の要素ではなく html に置く。
 */
export function applyColorScheme(scheme: ColorScheme) {
  const root = document.documentElement
  root.classList.toggle('dark', scheme === 'dark')
  root.style.colorScheme = scheme
}
