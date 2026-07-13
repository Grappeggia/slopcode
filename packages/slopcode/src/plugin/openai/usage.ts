import type { Auth } from "@/auth"
import {
  Credits,
  getUsage as usage,
  normalizeUsage,
  Spend,
  Usage as UsageSchema,
  Window,
  type Fetch,
  type Options,
  type Usage as UsageResult,
} from "@slopcode-ai/core/plugin/provider/openai-usage"

export { Credits, normalizeUsage, Spend, Window }
export const Usage = UsageSchema
export type Usage = UsageResult

export async function getUsage(
  auth: Auth.Info | undefined,
  persist: (auth: Auth.Oauth) => Promise<void>,
  options: Options & { fetch?: Fetch } = {},
): Promise<Usage> {
  if (!auth) return usage(undefined, async () => {}, options)
  if (auth.type === "api") return usage({ type: "key", key: auth.key }, async () => {}, options)
  if (auth.type !== "oauth") return { status: "unavailable" }
  return usage(
    {
      type: "oauth",
      refresh: auth.refresh,
      access: auth.access,
      expires: auth.expires,
      ...(auth.accountId && { accountID: auth.accountId }),
    },
    (next) =>
      persist({
        type: "oauth",
        refresh: next.refresh,
        access: next.access,
        expires: next.expires,
        ...(next.accountID && { accountId: next.accountID }),
      }),
    options,
  )
}
