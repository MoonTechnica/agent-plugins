/// <reference path="./globals.d.ts" />
// Project の SDK（sdk.md §3.0）。編集しない。zenstack/ は kit generate の生成物。
import { createClient } from "@workspace/miniapp-sdk"
import { schema, type SchemaType } from "./zenstack/schema"

export { schema }
export { apiPath } from "@workspace/miniapp-sdk"
export type { SchemaType }
export type * from "./zenstack/models"

/** この App（ビルドした App の slug）の client。Project・App・環境の境界はトークンが持つ */
export const client = createClient<SchemaType>({
  projectId: __PROJECT_ID__,
  app: __APP_SLUG__,
  gateway: __GATEWAY_URL__,
})
export type { SeedContext, SeedOperation, SeedPlan, TestIdentity } from "@workspace/miniapp-sdk"
