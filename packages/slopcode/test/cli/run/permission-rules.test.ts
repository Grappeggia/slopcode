import { expect, test } from "bun:test"
import { runPermissionRules, runPromptTools, runSessionPermission } from "@/cli/cmd/run/permission-rules"

test("headless runs deny forecast tools and suppress them for resumed sessions", () => {
  expect(runPermissionRules(false)).toContainEqual({
    permission: "plan_permissions",
    action: "deny",
    pattern: "*",
  })
  expect(runPromptTools(false)).toEqual({ plan_permissions: false })
  expect(
    runSessionPermission([{ permission: "plan_permissions", pattern: "*", action: "allow" }], false).at(-1),
  ).toEqual({
    permission: "plan_permissions",
    action: "deny",
    pattern: "*",
  })
})

test("interactive and mini runs keep plan permission review available", () => {
  expect(runPermissionRules(true)).toEqual([])
  expect(runPromptTools(true)).toBeUndefined()
})
