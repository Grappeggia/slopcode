import { expect, test } from "bun:test"
import { permissionActions, permissionGrantLines } from "../src/routes/session/permission-copy"

test("scoped approval copy explains exact session and global persistence", () => {
  expect(permissionGrantLines("session", "bash", ["echo *"])).toEqual([
    "This exact bash resource will be allowed for this session until revoked.",
    "- echo *",
  ])
  expect(permissionGrantLines("global", "read", ["src/[abc]?.ts", "README*"])).toEqual([
    "These exact read resources will be allowed globally across projects until revoked.",
    "- src/[abc]?.ts",
    "- README*",
  ])
})

test("requests without server grant candidates do not offer persistent scopes", () => {
  expect(permissionActions([])).toEqual({ once: "Allow once", reject: "Reject" })
  expect(permissionActions(["git status"])).toEqual({
    once: "Allow once",
    session: "Allow for session",
    global: "Remember globally",
    reject: "Reject",
  })
  expect(permissionGrantLines("global", "bash", [])).toEqual([])
})
