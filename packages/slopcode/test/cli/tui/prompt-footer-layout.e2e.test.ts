import { afterEach, describe, expect, test } from "bun:test"
import fs from "fs/promises"
import os from "os"
import path from "path"

const pkgDir = path.resolve(import.meta.dir, "../../..")
const appPath = path.resolve(pkgDir, "src/cli/cmd/tui/app.tsx")
const historyPath = path.resolve(pkgDir, "src/cli/cmd/tui/component/prompt/history-store.ts")
const scripts: string[] = []

afterEach(async () => {
  await Promise.all(scripts.splice(0).map((file) => fs.rm(file, { force: true })))
})

function frame(raw: string, width: number, height: number) {
  const rows = Array.from({ length: height }, () => Array.from({ length: width }, () => " "))
  let x = 0
  let y = 0
  let saved = { x: 0, y: 0 }
  const clear = () => rows.forEach((row) => row.fill(" "))
  const clearLine = (mode = 0) => {
    if (mode === 1) {
      for (let i = 0; i <= x && i < width; i++) rows[y]![i] = " "
      return
    }
    if (mode === 2) {
      rows[y]!.fill(" ")
      return
    }
    for (let i = x; i < width; i++) rows[y]![i] = " "
  }
  const put = (char: string) => {
    const cell = Math.max(1, Bun.stringWidth(char))
    if (y >= height) return
    if (x >= width) {
      x = 0
      y++
      if (y >= height) return
    }
    rows[y]![x] = char
    if (cell > 1 && x + 1 < width) rows[y]![x + 1] = " "
    x += cell
  }
  for (let i = 0; i < raw.length; ) {
    const char = raw[i]!
    if (char === "\u001b") {
      const next = raw[i + 1]
      if (next === "[") {
        let j = i + 2
        while (j < raw.length) {
          const code = raw.charCodeAt(j)
          if (code >= 0x40 && code <= 0x7e) break
          j++
        }
        const body = raw.slice(i + 2, j)
        const tail = raw[j]
        const mode = Number(body) || 0
        if (tail === "H" || tail === "f") {
          const [row, col] = body.split(";").map((item) => Number(item) || 1)
          y = Math.max(0, Math.min(height - 1, row - 1))
          x = Math.max(0, Math.min(width - 1, col - 1))
        }
        if (tail === "A") y = Math.max(0, y - (mode || 1))
        if (tail === "B") y = Math.min(height - 1, y + (mode || 1))
        if (tail === "C") x = Math.min(width - 1, x + (mode || 1))
        if (tail === "D") x = Math.max(0, x - (mode || 1))
        if (tail === "G") x = Math.max(0, Math.min(width - 1, mode - 1))
        if (tail === "d") y = Math.max(0, Math.min(height - 1, mode - 1))
        if (tail === "J" && (mode === 2 || mode === 3)) clear()
        if (tail === "K") clearLine(mode)
        if (tail === "s") saved = { x, y }
        if (tail === "u") {
          x = saved.x
          y = saved.y
        }
        if ((tail === "h" || tail === "l") && body === "?1049") {
          clear()
          x = 0
          y = 0
        }
        i = j + 1
        continue
      }
      if (next === "]") {
        let j = i + 2
        while (j < raw.length) {
          if (raw[j] === "\u0007") {
            j++
            break
          }
          if (raw[j] === "\u001b" && raw[j + 1] === "\\") {
            j += 2
            break
          }
          j++
        }
        i = j
        continue
      }
      i += 2
      continue
    }
    if (char === "\r") {
      x = 0
      i++
      continue
    }
    if (char === "\n") {
      y = Math.min(height - 1, y + 1)
      i++
      continue
    }
    if (char === "\b") {
      x = Math.max(0, x - 1)
      i++
      continue
    }
    const code = raw.codePointAt(i)
    if (!code) {
      i++
      continue
    }
    put(String.fromCodePoint(code))
    i += code > 0xffff ? 2 : 1
  }
  return rows.map((row) => row.join("").replace(/\s+$/g, "")).join("\n")
}

async function script() {
  const file = path.join(
    os.tmpdir(),
    `slopcode-prompt-footer-layout-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}.ts`,
  )
  scripts.push(file)
  await Bun.write(
    file,
    `import fs from "fs/promises"
import path from "path"
import { tmpdir } from "node:os"
import { tui } from ${JSON.stringify(appPath)}
import { promptHistoryPath } from ${JSON.stringify(historyPath)}

const root = path.join(tmpdir(), "slopcode-prompt-footer-layout", String(process.pid), String(Date.now()))
const cwd = path.join(root, "cwd")
await fs.mkdir(cwd, { recursive: true })

const history = promptHistoryPath({ dir: cwd, sessionID: "ses_busy" })
await fs.mkdir(path.dirname(history), { recursive: true })
await Bun.write(history, JSON.stringify({ input: "prior prompt", parts: [], mode: "normal" }) + "\\n")

const now = Date.now()
const provider = {
  id: "mock",
  name: "Mock",
  env: [],
  models: {
    test: {
      id: "test",
      name: "Test",
      capabilities: { reasoning: false },
      limit: { context: 100000, output: 10000 },
      variants: {
        fast: {},
      },
    },
  },
}
const session = {
  id: "ses_busy",
  slug: "ses_busy",
  projectID: "proj_1",
  directory: cwd,
  title: "Busy Footer",
  version: "0.1.37",
  time: { created: 1, updated: 1 },
}
const status = {
  ses_busy: {
    type: "busy",
    phase: "running",
    since: now - 18 * 60 * 1000,
    updated: now,
  },
}
const json = (value) => new Response(JSON.stringify(value), { headers: { "content-type": "application/json" } })
const fetch = async (input) => {
  const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url)
  if (url.pathname === "/config/providers") return json({ providers: [provider], default: { mock: "test" } })
  if (url.pathname === "/provider") return json({ all: [provider], default: { mock: "test" }, connected: ["mock"] })
  if (url.pathname === "/agent") return json([{ name: "build", mode: "primary", hidden: false }])
  if (url.pathname === "/config") return json({ keybinds: { session_interrupt: "escape" } })
  if (url.pathname === "/session") return json([session])
  if (url.pathname === "/command") return json([])
  if (url.pathname === "/lsp") return json([])
  if (url.pathname === "/mcp") return json({})
  if (url.pathname === "/experimental/resource") return json({})
  if (url.pathname === "/formatter") return json([])
  if (url.pathname === "/session/status") return json(status)
  if (url.pathname === "/provider/auth") return json({})
  if (url.pathname === "/vcs") return json({ branch: "dev" })
  if (url.pathname === "/path") return json({ state: cwd, config: cwd, worktree: cwd, directory: cwd })
  if (url.pathname === "/session/ses_busy") return json(session)
  if (url.pathname === "/session/ses_busy/message") return json([])
  if (url.pathname === "/session/ses_busy/todo") return json([])
  if (url.pathname === "/session/ses_busy/diff") return json([])
  return new Response("not found", { status: 404 })
}

process.env.SLOPCODE_ROUTE = JSON.stringify({
  type: "session",
  sessionID: "ses_busy",
  source: "switch",
})

const events = {
  on() {
    const timer = setTimeout(() => process.exit(0), 1200)
    return () => clearTimeout(timer)
  },
}

await tui({
  url: "http://slopcode.internal",
  fetch,
  events,
  config: {},
  args: {},
  directory: cwd,
  onExit: async () => {},
})
`,
  )
  return file
}

async function run() {
  const file = await script()
  const home = path.join(
    os.tmpdir(),
    `slopcode-prompt-footer-layout-home-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  )
  await fs.mkdir(home, { recursive: true })
  const child = Bun.spawn([process.execPath, "--cwd", pkgDir, file], {
    cwd: pkgDir,
    env: {
      ...Object.fromEntries(
        Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined),
      ),
      COLUMNS: "84",
      LINES: "24",
      TERM: "xterm-256color",
      SLOPCODE_TEST_HOME: home,
    },
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe",
  })
  const exited = child.exited
  const stdout = child.stdout ? new Response(child.stdout).text() : Promise.resolve("")
  const stderr = child.stderr ? new Response(child.stderr).text() : Promise.resolve("")
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      child.kill()
      reject(new Error("probe timed out"))
    }, 10_000)
  })
  const code = await Promise.race([exited, timeout])
  if (timer) clearTimeout(timer)
  const raw = await stdout
  const err = await stderr
  await fs.rm(home, { recursive: true, force: true })
  if (code !== 0) {
    throw new Error(`probe failed: ${err || raw}`)
  }
  return {
    code,
    raw,
    screen: frame(raw, 84, 24),
  }
}

describe("tui prompt footer layout", () => {
  test("keeps the interrupt shortcut inline with other hints", async () => {
    const result = await run()

    expect(result.code).toBe(0)
    expect(result.screen).toMatch(/stop\s+agent\s+hist\s+cmd/)
    expect(result.screen).not.toMatch(/stopagent/)
    expect(result.raw).not.toMatch(/escstop/)
    expect(result.screen).not.toMatch(/\bs\s*\n\s*t\s*\n\s*o\s*\n\s*p\b/)
  }, 15_000)
})
