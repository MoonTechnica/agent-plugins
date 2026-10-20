// 変えない（配信の場所・出力・ビルド時の定数は Platform が決める。検証で突き合わせる）
import { createAppConfig } from "@workspace/miniapp-sdk/vite"

export default createAppConfig("web", import.meta.dirname)
