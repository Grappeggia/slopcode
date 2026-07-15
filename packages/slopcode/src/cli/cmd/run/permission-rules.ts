import type { PermissionV1 } from "@slopcode-ai/core/v1/permission"

export function runPermissionRules(interactive: boolean): PermissionV1.Ruleset {
  if (interactive) return []
  return ["question", "plan_enter", "plan_exit", "plan_permissions"].map((permission) => ({
    permission,
    action: "deny" as const,
    pattern: "*",
  }))
}

export function runSessionPermission(
  permission: PermissionV1.Ruleset | undefined,
  interactive: boolean,
): PermissionV1.Rule[] {
  if (interactive) return []
  return runPermissionRules(false).filter(
    (rule) =>
      !(permission ?? []).some(
        (item) => item.permission === rule.permission && item.pattern === rule.pattern && item.action === rule.action,
      ),
  )
}
