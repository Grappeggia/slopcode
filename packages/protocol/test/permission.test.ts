import { describe, expect, test } from "bun:test"
import { Effect, Schema } from "effect"
import { Project } from "@opencode-ai/schema/project"
import { PermissionSavedQuery } from "../src/groups/permission"

describe("PermissionSavedQuery", () => {
  test("preserves explicit upstream selectors without exposing directory owners", async () => {
    expect(await Effect.runPromise(Schema.decodeUnknownEffect(PermissionSavedQuery)({}))).toEqual({})
    expect(
      await Effect.runPromise(
        Schema.decodeUnknownEffect(PermissionSavedQuery)({ scope: "project", projectID: Project.ID.make("project") }),
      ),
    ).toEqual({ scope: "project", projectID: Project.ID.make("project") })
    expect(await Effect.runPromise(Schema.decodeUnknownEffect(PermissionSavedQuery)({ scope: "global" }))).toEqual({
      scope: "global",
    })
    expect(Schema.is(PermissionSavedQuery)({ scope: "directory" })).toBe(false)
  })
})
