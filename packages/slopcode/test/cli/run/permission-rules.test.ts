import { expect, test } from "bun:test"
import { runPermissionRules, runSessionPermission } from "@/cli/cmd/run/permission-rules"

test("headless runs deny forecast tools and suppress them for resumed sessions", () => {
  expect(runPermissionRules(false)).toContainEqual({
    permission: "plan_permissions",
    action: "deny",
    pattern: "*",
  })
  const ordinary = { permission: "bash", pattern: "git status", action: "ask" as const }
  const rules = runPermissionRules(false)
  const first = [ordinary, ...runSessionPermission([ordinary], false)]
  expect(first).toEqual([ordinary, ...rules])
  expect(runSessionPermission(first, false)).toEqual([])
})

test("interactive and mini runs keep plan permission review available", () => {
  expect(runPermissionRules(true)).toEqual([])
  expect(runSessionPermission(undefined, true)).toEqual([])
})
