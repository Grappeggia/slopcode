import { afterEach, describe, expect, test } from "bun:test"
import fs from "fs/promises"
import os from "os"
import path from "path"
import { setTimeout as sleep } from "node:timers/promises"
import stripAnsi from "strip-ansi"

const pkgDir = path.resolve(import.meta.dir, "../../..")
const appPath = path.resolve(pkgDir, "src/cli/cmd/tui/app.tsx")
const eventPath = path.resolve(pkgDir, "src/cli/cmd/tui/event.ts")
const scripts: string[] = []

afterEach(async () => {
  await Promise.all(scripts.splice(0).map((file) => fs.rm(file, { force: true })))
})

async function script(chunks: number) {
  const file = path.join(
    os.tmpdir(),
    `slopcode-session-strip-flicker-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}.ts`,
  )
  scripts.push(file)
  await Bun.write(
    file,
    `import { tmpdir } from "node:os"
import { tui } from ${JSON.stringify(appPath)}
import { TuiEvent } from ${JSON.stringify(eventPath)}

const mode = process.argv[2] ?? "visible"
const cwd = tmpdir()
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
    },
  },
}

const session = (id, title) => ({
  id,
  slug: id,
  projectID: "proj_1",
  directory: cwd,
  title,
  version: "0.1.37",
  time: { created: 1, updated: 1 },
})

const sessions = {
  ses_a: session("ses_a", "AlphaStrip"),
  ses_b: session("ses_b", "BetaStream"),
}

const user = (sessionID, id, text) => ({
  info: {
    id,
    sessionID,
    role: "user",
    agent: "build",
    modelID: "test",
    providerID: "mock",
    mode: "chat",
    path: { cwd, root: cwd },
    time: { created: 1, completed: 1 },
  },
  parts: [{ id: id + "_part", sessionID, messageID: id, type: "text", text }],
})

const assistant = {
  info: {
    id: "msg_asst",
    sessionID: "ses_b",
    role: "assistant",
    agent: "build",
    modelID: "test",
    providerID: "mock",
    mode: "chat",
    cost: 0,
    tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
    path: { cwd, root: cwd },
    time: { created: 2 },
  },
  parts: [{ id: "part_asst", sessionID: "ses_b", messageID: "msg_asst", type: "text", text: "" }],
}

const json = (value) => new Response(JSON.stringify(value), { headers: { "content-type": "application/json" } })

const fetch = async (input) => {
  const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url)
  if (url.pathname === "/config/providers") return json({ providers: [provider], default: { mock: "test" } })
  if (url.pathname === "/provider") return json({ all: [provider], default: { mock: "test" }, connected: ["mock"] })
  if (url.pathname === "/agent") return json([{ name: "build", mode: "primary", hidden: false }])
  if (url.pathname === "/config") return json({})
  if (url.pathname === "/session") return json(Object.values(sessions))
  if (url.pathname === "/command") return json([])
  if (url.pathname === "/lsp") return json([])
  if (url.pathname === "/mcp") return json({})
  if (url.pathname === "/experimental/resource") return json({})
  if (url.pathname === "/formatter") return json([])
  if (url.pathname === "/session/status") return json({})
  if (url.pathname === "/provider/auth") return json({})
  if (url.pathname === "/vcs") return json({ branch: "dev" })
  if (url.pathname === "/path") return json({ state: cwd, config: cwd, worktree: cwd, directory: cwd })
  if (url.pathname === "/session/ses_a") return json(sessions.ses_a)
  if (url.pathname === "/session/ses_b") return json(sessions.ses_b)
  if (url.pathname === "/session/ses_a/message") return json([user("ses_a", "msg_a", "hello alpha")])
  if (url.pathname === "/session/ses_b/message") return json([user("ses_b", "msg_b", "hello beta"), assistant])
  if (url.pathname === "/session/ses_a/todo" || url.pathname === "/session/ses_b/todo") return json([])
  if (url.pathname === "/session/ses_a/diff" || url.pathname === "/session/ses_b/diff") return json([])
  return new Response("not found", { status: 404 })
}

process.env.SLOPCODE_ROUTE = JSON.stringify(
  mode === "visible"
    ? { type: "session", sessionID: "ses_a", source: "switch" }
    : { type: "session", sessionID: "ses_b", source: "switch" },
)

const events = {
  on(handler) {
    const timers = []
    if (mode === "visible") {
      timers.push(setTimeout(() => handler({ type: TuiEvent.SessionSelect.type, properties: { sessionID: "ses_b" } }), 250))
    }
    for (let i = 0; i < ${chunks}; i++) {
      const delta = String.fromCharCode(97 + (i % 26))
      timers.push(
        setTimeout(
          () =>
            handler({
              type: "message.part.delta",
              properties: {
                sessionID: "ses_b",
                messageID: "msg_asst",
                partID: "part_asst",
                field: "text",
                delta,
              },
            }),
          500 + i * 35,
        ),
      )
    }
    timers.push(setTimeout(() => process.exit(0), 500 + ${chunks} * 35 + 350))
    return () => timers.forEach(clearTimeout)
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

async function run(mode: "hidden" | "visible", chunks = 18) {
  const file = await script(chunks)
  const child = Bun.spawn([process.execPath, "--cwd", pkgDir, file, mode], {
    cwd: pkgDir,
    env: Object.fromEntries(
      Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined),
    ),
    stdout: "pipe",
    stderr: "pipe",
  })
  const exited = child.exited
  const stdout = child.stdout ? new Response(child.stdout).text() : Promise.resolve("")
  const stderr = child.stderr ? new Response(child.stderr).text() : Promise.resolve("")
  const timeout = sleep(15_000).then(async () => {
    child.kill()
    throw new Error(`probe timed out for ${mode}`)
  })
  const code = await Promise.race([exited, timeout])
  const raw = await stdout
  const err = await stderr
  if (code !== 0) {
    throw new Error(`probe failed for ${mode}: ${err || raw}`)
  }
  return {
    code,
    raw,
    text: stripAnsi(raw),
  }
}

describe("tui session strip flicker reproduction", () => {
  test("streaming with a visible strip repaints materially more terminal output", async () => {
    const hidden = await run("hidden")
    const visible = await run("visible")

    expect(hidden.code).toBe(0)
    expect(visible.code).toBe(0)
    expect(visible.raw.length).toBeGreaterThan(Math.floor(hidden.raw.length * 1.12))
  }, 20_000)

  test("the extra churn is repaint traffic, not repeated TUI remounts", async () => {
    const hidden = await run("hidden")
    const visible = await run("visible")

    expect((hidden.text.match(/AlphaStrip/g) ?? []).length).toBe(0)
    expect((visible.text.match(/AlphaStrip/g) ?? []).length).toBeGreaterThanOrEqual(2)
    expect((hidden.raw.match(/\x1b\[\?1049h/g) ?? []).length).toBe(1)
    expect((visible.raw.match(/\x1b\[\?1049h/g) ?? []).length).toBe(1)
  }, 20_000)
})
