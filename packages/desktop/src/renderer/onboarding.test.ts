import { describe, expect, test } from "bun:test"
import { shouldCreateDefaultProject } from "./onboarding-policy"

const fresh = { pending: true, existingInstall: false, local: true, tabCount: 0, serverCount: 1, builtInServerCount: 1 }

describe("desktop first-launch onboarding", () => {
  test("creates the default project only for a fresh local install", () => {
    expect(shouldCreateDefaultProject(fresh)).toBe(true)
    expect(shouldCreateDefaultProject({ ...fresh, existingInstall: true })).toBe(false)
    expect(shouldCreateDefaultProject({ ...fresh, local: false })).toBe(false)
    expect(shouldCreateDefaultProject({ ...fresh, tabCount: 1 })).toBe(false)
    expect(shouldCreateDefaultProject({ ...fresh, serverCount: 2 })).toBe(false)
  })
})
