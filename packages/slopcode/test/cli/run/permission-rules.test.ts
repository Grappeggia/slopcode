import { expect, test } from "bun:test"
import { runPermissionRules, runPromptTools } from "@/cli/cmd/run/permission-rules"

test("headless runs deny forecast tools and suppress them for resumed sessions", () => {
  expect(runPermissionRules(false)).toContainEqual({
    permission: "plan_permissions",
    action: "deny",
    pattern: "*",
  })
  expect(runPromptTools(false)).toEqual({ plan_permissions: false })
})

test("interactive and mini runs keep plan permission review available", () => {
  expect(runPermissionRules(true)).toEqual([])
  expect(runPromptTools(true)).toBeUndefined()
})
