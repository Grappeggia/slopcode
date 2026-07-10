import { Actor } from "@slopcode-ai/console-core/actor.js"
import { Database, eq } from "@slopcode-ai/console-core/drizzle/index.js"
import { BillingTable } from "@slopcode-ai/console-core/schema/billing.sql.js"

export function reloadBilling<T>(reload: (workspaceID: string) => T) {
  Actor.assertAdmin()
  return reload(Actor.workspace())
}

export function setBillingReload(input: {
  reload: boolean
  reloadAmount: number | null
  reloadTrigger: number | null
}) {
  Actor.assertAdmin()
  return Database.use((tx) =>
    tx
      .update(BillingTable)
      .set({
        reload: input.reload,
        ...(input.reloadAmount !== null ? { reloadAmount: input.reloadAmount } : {}),
        ...(input.reloadTrigger !== null ? { reloadTrigger: input.reloadTrigger } : {}),
        ...(input.reload
          ? {
              reloadError: null,
              timeReloadError: null,
            }
          : {}),
      })
      .where(eq(BillingTable.workspaceID, Actor.workspace())),
  )
}
