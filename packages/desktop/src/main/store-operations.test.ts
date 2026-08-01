import { afterEach, describe, expect, test } from "bun:test"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { deleteStoreFileIfEmpty } from "./store-cleanup"
import { createStoreOperationQueue } from "./store-operations"

const roots: string[] = []

afterEach(async () => Promise.all(roots.splice(0).map((path) => rm(path, { recursive: true, force: true }))))

describe("store operation queue", () => {
  test("keeps a write queued behind empty-file cleanup", async () => {
    const path = await mkdtemp(join(tmpdir(), "slopcode-store-operations-"))
    roots.push(path)
    const name = "slopcode.workspace.race.dat"
    await writeFile(join(path, name), "{}")

    let release!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const queue = createStoreOperationQueue()
    const cleanup = queue(name, async () => {
      await gate
      await deleteStoreFileIfEmpty(path, name)
    })
    const set = queue(name, () => writeFile(join(path, name), '{"value":"kept"}'))

    release()
    await Promise.all([cleanup, set])
    expect(await readFile(join(path, name), "utf8")).toBe('{"value":"kept"}')
  })
})
