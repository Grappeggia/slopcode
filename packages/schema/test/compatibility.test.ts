import { describe, expect, test } from "bun:test"
import { FileSystem } from "../src/filesystem"
import { Permission } from "../src/permission"
import { PermissionV1 } from "../src/permission-v1"
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
})
