import { describe, expect, test } from "bun:test"
import { Env } from "../../src/env"
import { Instance } from "../../src/project/instance"
import { tmpdir } from "../fixture/fixture"

describe("env session overlays", () => {
  test("keeps session overlays separate from global scope", async () => {
    await using dir = await tmpdir({ git: true })

    await Instance.provide({
      directory: dir.path,
      init: async () => {
        Env.set("GLOBAL_ONLY", "global")
        Env.set("SESSION_ONLY", "alpha", { sessionID: "ses_alpha" })
        Env.set("SESSION_ONLY", "beta", { sessionID: "ses_beta" })
      },
      fn: async () => {
        expect(Env.get("GLOBAL_ONLY")).toBe("global")
        expect(Env.get("SESSION_ONLY")).toBeUndefined()
        expect(Env.get("SESSION_ONLY", { sessionID: "ses_alpha" })).toBe("alpha")
        expect(Env.get("SESSION_ONLY", { sessionID: "ses_beta" })).toBe("beta")
        expect(Env.all({ sessionID: "ses_alpha" })).toMatchObject({
          GLOBAL_ONLY: "global",
          SESSION_ONLY: "alpha",
        })
      },
    })
  })

  test("clears session overlays without touching global values", async () => {
    await using dir = await tmpdir({ git: true })

    await Instance.provide({
      directory: dir.path,
      init: async () => {
        Env.set("GLOBAL_ONLY", "global")
        Env.set("SESSION_ONLY", "value", { sessionID: "ses_alpha" })
        Env.clear("ses_alpha")
      },
      fn: async () => {
        expect(Env.get("GLOBAL_ONLY")).toBe("global")
        expect(Env.get("SESSION_ONLY", { sessionID: "ses_alpha" })).toBeUndefined()
      },
    })
  })
})
