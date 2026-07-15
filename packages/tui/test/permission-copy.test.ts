import { expect, test } from "bun:test"
import { permissionAlwaysLines } from "../src/routes/session/permission-copy"

test("always approval copy explains project persistence and revocation", () => {
  expect(permissionAlwaysLines("bash", ["*"])).toEqual(["This will remember bash for this project until revoked."])
  expect(permissionAlwaysLines("read", ["src/**/*.ts", "src/**/*.tsx"])).toEqual([
    "This will remember the following patterns for this project until revoked.",
    "- src/**/*.ts",
    "- src/**/*.tsx",
  ])
})
