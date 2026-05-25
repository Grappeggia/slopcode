import z from "zod"
import { Account as Accounts } from "@/account"

export * from "./control.sql"

export namespace Control {
  export const Account = z.object({
    email: z.string(),
    url: z.string(),
  })
  export type Account = z.infer<typeof Account>

  export function account(): Account | undefined {
    const row = Accounts.active()
    if (!row) return
    return {
      email: row.email,
      url: row.url,
    }
  }

  export async function token(): Promise<string | undefined> {
    const row = Accounts.active()
    if (!row) return
    return Accounts.token(row.id)
  }
}
