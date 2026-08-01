import { afterEach, describe, expect, test } from "bun:test"
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { hasLegacyTauriEntries, hasLegacyTauriState } from "./legacy-state"

const roots: string[] = []

afterEach(async () => Promise.all(roots.splice(0).map((path) => rm(path, { recursive: true, force: true }))))

describe("legacy Tauri state", () => {
  test("recognizes only migratable files", () => {
    expect(hasLegacyTauriEntries([{ name: "default.dat", isFile: () => true }])).toBe(true)
    expect(hasLegacyTauriEntries([{ name: "settings.json", isFile: () => true }])).toBe(false)
    expect(hasLegacyTauriEntries([{ name: "default.dat", isFile: () => false }])).toBe(false)
  })

  test("checks the same app-data directory used by migration", async () => {
    const path = await mkdtemp(join(tmpdir(), "slopcode-tauri-state-"))
    roots.push(path)
    expect(await hasLegacyTauriState(path)).toBe(false)
    await mkdir(join(path, "nested"))
    await writeFile(join(path, "slopcode.global.dat"), "{}")
    expect(await hasLegacyTauriState(path)).toBe(true)
  })
})
