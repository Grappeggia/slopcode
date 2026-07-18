import { expect, test } from "bun:test"
import { permissionActions, permissionProjectLines } from "../src/routes/session/permission-copy"

test("durable approval copy explains restart lifetime and exact patterns", () => {
  expect(permissionProjectLines(["echo *"], "project")).toEqual([
    "This approval survives restarts and remains active for this project until revoked.",
    "The following exact patterns will always be allowed:",
    "- echo *",
  ])
  expect(permissionProjectLines(["src/[abc]?.ts", "README*"], "folder")).toEqual([
    "This approval survives restarts and remains active for this folder until revoked.",
    "The following exact patterns will always be allowed:",
    "- src/[abc]?.ts",
    "- README*",
  ])
})

test("requests without server grant candidates do not offer persistent scopes", () => {
  expect(permissionActions([])).toEqual({ once: "Allow once", reject: "Reject" })
  expect(permissionActions(["git status"], "folder")).toEqual({
    once: "Allow once",
    always: "Allow for this session",
    project: "Always allow these patterns for this folder",
    reject: "Reject",
  })
  expect(permissionProjectLines([], "project")).toEqual([])
})

test("unknown project metadata preserves session approval without offering a durable scope", () => {
  expect(permissionActions(["git status"], undefined)).toEqual({
    once: "Allow once",
    always: "Allow for this session",
    reject: "Reject",
  })
})
