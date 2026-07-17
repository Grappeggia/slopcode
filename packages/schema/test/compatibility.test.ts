import { describe, expect, test } from "bun:test"
import { FileSystem } from "../src/filesystem"
import { Permission } from "../src/permission"
import { PermissionV1 } from "../src/permission-v1"
import { PermissionSaved } from "../src/permission-saved"
import { Schema } from "effect"

describe("schema compatibility", () => {
  test("moved class schemas remain constructible", () => {
    const input = new FileSystem.FindInput({ query: "src" })
    expect(input).toBeInstanceOf(FileSystem.FindInput)
    expect(input.query).toBe("src")
  })

  test("current and V1 permission contracts expose scoped exact grants", () => {
    expect(Schema.decodeUnknownSync(Permission.Reply)("session")).toBe("session")
    expect(Schema.decodeUnknownSync(Permission.Reply)("global")).toBe("global")
    expect(Schema.decodeUnknownSync(PermissionV1.Reply)("always")).toBe("always")
    const grant = { resources: ["echo *", "file?.txt", "[abc]"], scopes: ["session", "global"] as const }
    expect(Schema.decodeUnknownSync(Permission.Grant)(grant)).toEqual(grant)
    expect(Schema.decodeUnknownSync(PermissionV1.Grant)(grant)).toEqual(grant)
  })

  test("saved permission contracts reject malformed scope combinations", () => {
    const base = { id: "psv_test", action: "bash", resource: "git status" }
    expect(
      Schema.is(PermissionSaved.Info)({
        ...base,
        projectID: "global",
        scope: "global",
        match: "exact",
      }),
    ).toBe(true)
    expect(
      Schema.is(PermissionSaved.Info)({
        ...base,
        projectID: "project",
        scope: "global",
        match: "exact",
      }),
    ).toBe(false)
    expect(
      Schema.is(PermissionSaved.Info)({
        ...base,
        projectID: "project",
        scope: "session",
        match: "pattern",
        sessionID: "ses_test",
      }),
    ).toBe(false)
    expect(
      Schema.is(PermissionSaved.Info)({
        ...base,
        projectID: "global",
        directoryID: "directory",
        scope: "directory",
        match: "pattern",
      }),
    ).toBe(true)
    expect(
      Schema.is(PermissionSaved.Info)({
        ...base,
        projectID: "project",
        directoryID: "directory",
        scope: "directory",
        match: "pattern",
      }),
    ).toBe(false)
    expect(
      Schema.is(PermissionSaved.Info)({
        ...base,
        projectID: "global",
        directoryID: "directory",
        scope: "project",
        match: "pattern",
      }),
    ).toBe(false)
  })
})
