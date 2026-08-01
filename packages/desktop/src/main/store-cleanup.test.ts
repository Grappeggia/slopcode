import { afterEach, describe, expect, test } from "bun:test"
import { mkdtemp, readdir, rm, utimes, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { cleanupStoreFiles, deleteStoreFileIfEmpty } from "./store-cleanup"

const roots: string[] = []

async function root() {
  const value = await mkdtemp(join(tmpdir(), "slopcode-store-cleanup-"))
  roots.push(value)
  return value
}

async function writeStore(path: string, name: string, value: string, modified: Date) {
  await writeFile(join(path, name), value)
  await utimes(join(path, name), modified, modified)
}

afterEach(async () => Promise.all(roots.splice(0).map((path) => rm(path, { recursive: true, force: true }))))

describe("store cleanup", () => {
  test("removes empty scoped stores while preserving global state", async () => {
    const path = await root()
    const now = new Date("2026-07-01T00:00:00.000Z")
    await writeStore(path, "slopcode.draft.empty.dat", "{}", now)
    await writeStore(path, "slopcode.workspace.empty.dat", "{\n}", now)
    await writeStore(path, "slopcode.global.dat", "{}", now)

    expect((await cleanupStoreFiles(path, now.getTime())).deleted.sort()).toEqual([
      "slopcode.draft.empty.dat",
      "slopcode.workspace.empty.dat",
    ])
    expect(await readdir(path)).toEqual(["slopcode.global.dat"])
  })

  test("removes stale drafts and caps recent draft stores", async () => {
    const path = await root()
    const now = new Date("2026-07-01T00:00:00.000Z")
    await writeStore(path, "slopcode.draft.old.dat", '{"draft":"old"}', new Date("2026-05-01T00:00:00.000Z"))
    await Promise.all(
      Array.from({ length: 101 }, (_, index) =>
        writeStore(path, `slopcode.draft.${index}.dat`, '{"draft":"recent"}', new Date(now.getTime() - index * 1000)),
      ),
    )

    const result = await cleanupStoreFiles(path, now.getTime())
    expect(result.deleted.sort()).toEqual(["slopcode.draft.100.dat", "slopcode.draft.old.dat"])
    expect((await readdir(path)).length).toBe(100)
  })

  test("deletes an empty scoped store on demand", async () => {
    const path = await root()
    await writeStore(path, "slopcode.workspace.empty.dat", "{}", new Date())
    expect(await deleteStoreFileIfEmpty(path, "slopcode.workspace.empty.dat")).toBe(true)
    expect(await deleteStoreFileIfEmpty(path, "slopcode.global.dat")).toBe(false)
  })
})
