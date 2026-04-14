import { afterEach, describe, expect, test } from "bun:test"
import fs from "fs/promises"
import os from "os"
import path from "path"
import { setTimeout as sleep } from "node:timers/promises"
import stripAnsi from "strip-ansi"

const pkgDir = path.resolve(import.meta.dir, "../../..")
const appPath = path.resolve(pkgDir, "src/cli/cmd/tui/app.tsx")
const scripts: string[] = []
const token = "Final output heading"
const body = [
  "# Final output heading",
  "This paragraph is intentionally long so it wraps across the terminal width while the assistant is still streaming the answer into the active session.",
  "",
  "- First wrapped bullet keeps the heading pinned on screen.",
  "- Second wrapped bullet adds more lines before the code fence closes.",
  "",
  "```ts",
  'const text = "streamed-final-output"',
  "console.log(text.repeat(2))",
  "```",
  "",
  "Closing line keeps the block tall enough to stay visible.",
].join("\n")
const deltas = chunk(body, 8)
let pair:
  | Promise<{
      hidden: Awaited<ReturnType<typeof run>>
      visible: Awaited<ReturnType<typeof run>>
    }>
  | undefined

afterEach(async () => {
  await Promise.all(scripts.splice(0).map((file) => fs.rm(file, { force: true })))
})

function chunk(text: string, size: number) {
  const result: string[] = []
  let line = ""
  for (const char of text) {
    if (char === "\n") {
      while (line) {
        result.push(line.slice(0, size))
        line = line.slice(size)
      }
      result.push("\n")
      continue
    }
    line += char
    if (line.length < size) continue
    result.push(line)
    line = ""
  }
  while (line) {
    result.push(line.slice(0, size))
    line = line.slice(size)
  }
  return result
}

function count(text: string, value: string) {
  return text.split(value).length - 1
}

async function script() {
  const file = path.join(
    os.tmpdir(),
    `slopcode-final-output-flicker-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}.ts`,
  )
  scripts.push(file)
  await Bun.write(
    file,
    `import { tmpdir } from "node:os"
import { tui } from ${JSON.stringify(appPath)}

const mode = process.argv[2] ?? "hidden"
const cwd = tmpdir()
const deltas = ${JSON.stringify(deltas)}
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
  ses_stream: session("ses_stream", "Stream Session"),
  ses_idle: session("ses_idle", "Idle Session"),
}

const user = {
  id: "msg_user",
  sessionID: "ses_stream",
  role: "user",
  agent: "build",
  modelID: "test",
  providerID: "mock",
  mode: "chat",
  path: { cwd, root: cwd },
  time: { created: 1, completed: 1 },
}

const assistant = (finish, completed) => ({
  id: "msg_asst",
  sessionID: "ses_stream",
  role: "assistant",
  agent: "build",
  modelID: "test",
  providerID: "mock",
  mode: "chat",
  parentID: "msg_user",
  path: { cwd, root: cwd },
  cost: 0,
  tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
  time: completed ? { created: 2, completed } : { created: 2 },
  ...(finish ? { finish } : {}),
})

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
  if (url.pathname === "/session/ses_stream") return json(sessions.ses_stream)
  if (url.pathname === "/session/ses_idle") return json(sessions.ses_idle)
  if (url.pathname === "/session/ses_stream/message") return json([])
  if (url.pathname === "/session/ses_idle/message") return json([])
  if (url.pathname === "/session/ses_stream/todo" || url.pathname === "/session/ses_idle/todo") return json([])
  if (url.pathname === "/session/ses_stream/diff" || url.pathname === "/session/ses_idle/diff") return json([])
  return new Response("not found", { status: 404 })
}

process.env.SLOPCODE_ROUTE = JSON.stringify({
  type: "session",
  sessionID: mode === "visible" ? "ses_stream" : "ses_idle",
  source: "switch",
})

const events = {
  on(handler) {
    const timers = []
    timers.push(setTimeout(() => handler({ type: "message.updated", properties: { info: user } }), 80))
    timers.push(
      setTimeout(
        () =>
          handler({
            type: "message.part.updated",
            properties: {
              part: {
                id: "part_user",
                sessionID: "ses_stream",
                messageID: "msg_user",
                type: "text",
                text: "Please print the final answer in the active session.",
              },
            },
          }),
        90,
      ),
    )
    timers.push(setTimeout(() => handler({ type: "message.updated", properties: { info: assistant() } }), 100))
    timers.push(
      setTimeout(
        () =>
          handler({
            type: "message.part.updated",
            properties: {
              part: {
                id: "part_asst",
                sessionID: "ses_stream",
                messageID: "msg_asst",
                type: "text",
                text: "",
              },
            },
          }),
        110,
      ),
    )
    deltas.forEach((delta, index) => {
      timers.push(
        setTimeout(
          () =>
            handler({
              type: "message.part.delta",
              properties: {
                sessionID: "ses_stream",
                messageID: "msg_asst",
                partID: "part_asst",
                field: "text",
                delta,
              },
            }),
          180 + index * 12,
        ),
      )
    })
    timers.push(
      setTimeout(
        () => handler({ type: "message.updated", properties: { info: assistant("stop", 3) } }),
        210 + deltas.length * 12,
      ),
    )
    timers.push(setTimeout(() => process.exit(0), 330 + deltas.length * 12))
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

async function run(mode: "hidden" | "visible") {
  const file = await script()
  const child = Bun.spawn([process.execPath, "--cwd", pkgDir, file, mode], {
    cwd: pkgDir,
    env: {
      ...Object.fromEntries(
        Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined),
      ),
      COLUMNS: "72",
      LINES: "24",
      TERM: "xterm-256color",
    },
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe",
  })
  const exited = child.exited
  const stdout = child.stdout ? new Response(child.stdout).text() : Promise.resolve("")
  const stderr = child.stderr ? new Response(child.stderr).text() : Promise.resolve("")
  const timeout = sleep(10_000).then(async () => {
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

function sample() {
  pair ??= (async () => {
    const [hidden, visible] = await Promise.all([run("hidden"), run("visible")])
    return { hidden, visible }
  })()
  return pair
}

describe("tui final output flicker reproduction", () => {
  test("seals early final-output lines instead of replaying them through the stream", async () => {
    const { hidden, visible } = await sample()

    expect(hidden.code).toBe(0)
    expect(visible.code).toBe(0)
    expect(count(hidden.text, token)).toBe(0)
    expect(count(visible.text, token)).toBeGreaterThanOrEqual(1)
    expect(count(visible.text, token)).toBeLessThanOrEqual(2)
    expect(count(visible.text, "This paragraph is intentionally")).toBeLessThanOrEqual(4)
  }, 15_000)

  test("keeps repaint churn bounded without remounting the TUI", async () => {
    const { hidden, visible } = await sample()

    expect(visible.raw.length).toBeLessThan(Math.floor(hidden.raw.length * 4.5))
    expect((hidden.raw.match(/\x1b\[\?1049h/g) ?? []).length).toBe(1)
    expect((visible.raw.match(/\x1b\[\?1049h/g) ?? []).length).toBe(1)
  }, 15_000)
})
