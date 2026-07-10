import { describe, expect, test } from "bun:test"
import { Actor } from "@slopcode-ai/console-core/actor.js"
import { asBillingAdmin } from "../src/routes/workspace/[id]/billing/authorize"

describe("billing authorization", () => {
  test("rejects a member manual reload before charging", () => {
    let called = false

    expect(() =>
      Actor.provide(
        "user",
        {
          userID: "user_member",
          workspaceID: "workspace_member",
          accountID: "account_member",
          role: "member",
        },
        () =>
          asBillingAdmin(() => {
            called = true
          }),
      ),
    ).toThrow("Action not allowed")
    expect(called).toBe(false)
  })

  test("rejects an unauthenticated reload settings mutation", () => {
    let called = false

    expect(() =>
      Actor.provide("public", {}, () =>
        asBillingAdmin(() => {
          called = true
        }),
      ),
    ).toThrow("Expected actor type user")
    expect(called).toBe(false)
  })

  test("uses the actor workspace instead of an arbitrary form workspace", () => {
    const submitted = "workspace_other"
    const workspaceID = Actor.provide(
      "user",
      {
        userID: "user_admin",
        workspaceID: "workspace_actor",
        accountID: "account_admin",
        role: "admin",
      },
      () => asBillingAdmin((workspaceID) => workspaceID),
    )

    expect(workspaceID).toBe("workspace_actor")
    expect(workspaceID).not.toBe(submitted)
  })
})
