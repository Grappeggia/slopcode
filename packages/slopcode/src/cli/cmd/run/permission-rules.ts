import type { PermissionV1 } from "@slopcode-ai/core/v1/permission"

export function runPermissionRules(interactive: boolean): PermissionV1.Ruleset {
  if (interactive) return []
  return ["question", "plan_enter", "plan_exit", "plan_permissions"].map((permission) => ({
    permission,
    action: "deny" as const,
    pattern: "*",
  }))
}

export function runPromptTools(interactive: boolean) {
  if (!interactive) return { plan_permissions: false }
  return undefined
}
