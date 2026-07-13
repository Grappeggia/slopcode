import { afterAll } from "bun:test"
import fs from "fs/promises"
import os from "os"
import path from "path"

const root = await fs.mkdtemp(path.join(os.tmpdir(), "slopcode-core-test-"))
const dirs = {
  data: path.join(root, "data"),
  cache: path.join(root, "cache"),
  config: path.join(root, "config"),
  state: path.join(root, "state"),
  home: path.join(root, "home"),
}

process.env.XDG_DATA_HOME = dirs.data
process.env.XDG_CACHE_HOME = dirs.cache
process.env.XDG_CONFIG_HOME = dirs.config
process.env.XDG_STATE_HOME = dirs.state
process.env.SLOPCODE_TEST_HOME = dirs.home
process.env.SLOPCODE_DB = ":memory:"

await Promise.all(Object.values(dirs).map((dir) => fs.mkdir(dir, { recursive: true })))

afterAll(() => fs.rm(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }))
