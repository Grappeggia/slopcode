import { describe, expect, test } from "bun:test"
import { runtimeHint, runtimeOwner } from "../../src/util/session-runtime"

describe("util.session-runtime", () => {
  test("formats runtime owners", () => {
    expect(runtimeOwner("v1")).toBe("V1 legacy")
    expect(runtimeOwner("v2")).toBe("V2 native")
  })

  test("provides actionable transition hints", () => {
    expect(runtimeHint("ready")).toBeUndefined()
    expect(runtimeHint("paused")).toContain("sending a prompt resumes durable pending work")
    expect(runtimeHint("migrating")).toContain("wait for V2 ownership")
    expect(runtimeHint("draining")).toContain("retry native control")
  })
})
