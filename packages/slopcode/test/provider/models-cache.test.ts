import { afterEach, describe, expect, test } from "bun:test"
import fs from "fs/promises"
import os from "os"
import path from "path"

const pkg = path.resolve(import.meta.dir, "../..")
const scripts: string[] = []

afterEach(async () => {
  await Promise.all(scripts.splice(0).map((file) => fs.rm(file, { force: true })))
})

async function script() {
  const file = path.join(
    pkg,
    `.tmp-models-cache-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}.ts`,
  )
  scripts.push(file)
  await Bun.write(
    file,
    `import fs from "fs/promises"
import path from "path"
import { Global } from "./src/global"

const file = path.join(Global.Path.cache, "models.json")
await fs.writeFile(file, "{")
const { ModelsDev } = await import("./src/provider/models")
await ModelsDev.get()
if (await Bun.file(file).exists()) {
  console.error("corrupted cache was not removed")
  process.exit(2)
}
process.exit(0)
`,
  )
  return file
}

async function run() {
  const file = await script()
  const root = path.join(os.tmpdir(), `slopcode-models-cache-${process.pid}-${Date.now()}`)
  const env = Object.fromEntries(
    Object.entries(process.env).filter(
      (entry): entry is [string, string] => entry[1] !== undefined && entry[0] !== "SLOPCODE_MODELS_PATH",
    ),
  )
  const child = Bun.spawn([process.execPath, "--cwd", pkg, file], {
    cwd: pkg,
    env: {
      ...env,
      XDG_CACHE_HOME: path.join(root, "cache"),
      XDG_CONFIG_HOME: path.join(root, "config"),
      XDG_DATA_HOME: path.join(root, "data"),
      XDG_STATE_HOME: path.join(root, "state"),
      SLOPCODE_DISABLE_MODELS_FETCH: "1",
      SLOPCODE_TEST_HOME: path.join(root, "home"),
    },
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe",
  })
  const [code, stdout, stderr] = await Promise.all([
    child.exited,
    child.stdout ? new Response(child.stdout).text() : Promise.resolve(""),
    child.stderr ? new Response(child.stderr).text() : Promise.resolve(""),
  ])
  await fs.rm(root, { recursive: true, force: true })
  return { code, stdout, stderr }
}

describe("models.dev cache", () => {
  test("removes a corrupted default cache file", async () => {
    const result = await run()

    expect(result.code).toBe(0)
    expect(result.stderr).not.toContain("corrupted cache")
  })
})
