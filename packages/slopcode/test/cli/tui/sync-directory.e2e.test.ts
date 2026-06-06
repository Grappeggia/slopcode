import { afterEach, describe, expect, test } from "bun:test"
import fs from "fs/promises"
import os from "os"
import path from "path"

const pkg = path.resolve(import.meta.dir, "../../..")
const args = path.resolve(pkg, "src/cli/cmd/tui/context/args.tsx")
const exit = path.resolve(pkg, "src/cli/cmd/tui/context/exit.tsx")
const kv = path.resolve(pkg, "src/cli/cmd/tui/context/kv.tsx")
const route = path.resolve(pkg, "src/cli/cmd/tui/context/route.tsx")
const sdk = path.resolve(pkg, "src/cli/cmd/tui/context/sdk.tsx")
const sync = path.resolve(pkg, "src/cli/cmd/tui/context/sync.tsx")
const scripts: string[] = []

afterEach(async () => {
  await Promise.all(scripts.splice(0).map((file) => fs.rm(file, { force: true })))
})

async function script() {
  const file = path.join(
    pkg,
    `.tmp-sync-directory-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}.tsx`,
  )
  scripts.push(file)
  await Bun.write(
    file,
    `import { render } from "@opentui/solid"
import { createEffect, createSignal } from "solid-js"
import { ArgsProvider } from ${JSON.stringify(args)}
import { ExitProvider } from ${JSON.stringify(exit)}
import { KVProvider } from ${JSON.stringify(kv)}
import { RouteProvider } from ${JSON.stringify(route)}
import { SDKProvider } from ${JSON.stringify(sdk)}
import { SyncProvider, useSync } from ${JSON.stringify(sync)}

const directory = process.cwd()
const session = {
  id: "ses_directory",
  slug: "ses_directory",
  projectID: "proj",
  directory,
  title: "Directory Session",
  version: "0.2.0",
  time: { created: 1, updated: 1 },
}
const provider = {
  id: "mock",
  name: "Mock",
  env: [],
  models: {},
}
const json = (value) => new Response(JSON.stringify(value), { headers: { "content-type": "application/json" } })
const fail = setTimeout(() => process.exit(2), 5000)

const fetch = Object.assign(
  async (input, init) => {
    const request = input instanceof Request ? input : new Request(input, init)
    const url = new URL(request.url)
    if (url.pathname === "/config/providers") return json({ providers: [provider], default: {} })
    if (url.pathname === "/provider") return json({ all: [provider], default: {}, connected: ["mock"] })
    if (url.pathname === "/agent") return json([])
    if (url.pathname === "/config") return json({})
    if (url.pathname === "/path") return json({ state: directory, config: directory, worktree: directory, directory })
    if (url.pathname === "/session") return json([session])
    if (url.pathname === "/permission") return json([])
    if (url.pathname === "/question") return json([])
    if (url.pathname === "/session/status") return json({})
    if (url.pathname === "/experimental/workspace/status") return json([])
    if (url.pathname === "/command") return json([])
    if (url.pathname === "/lsp") return json([])
    if (url.pathname === "/mcp") return json({})
    if (url.pathname === "/experimental/resource") return json({})
    if (url.pathname === "/formatter") return json([])
    if (url.pathname === "/provider/auth") return json({})
    if (url.pathname === "/vcs") return json({ branch: "dev" })
    if (url.pathname === "/permission/per_edit/reply") {
      const body = await request.json()
      if (url.searchParams.get("sessionID") !== "ses_directory") {
        console.error("missing sessionID", url.search)
        process.exit(3)
      }
      if (url.searchParams.get("directory") !== directory) {
        console.error("missing directory", url.search)
        process.exit(4)
      }
      if (body.reply !== "once") {
        console.error("missing reply", JSON.stringify(body))
        process.exit(5)
      }
      clearTimeout(fail)
      setTimeout(() => process.exit(0), 25)
      return json(true)
    }
    return new Response("not found: " + url.pathname, { status: 404 })
  },
  { preconnect() {} },
)

let emit = (_event) => {}
const events = {
  on(handler) {
    emit = handler
    return () => {}
  },
}

function Probe() {
  const sync = useSync()
  const [sent, setSent] = createSignal(false)
  createEffect(() => {
    if (sync.status !== "complete" || sent()) return
    setSent(true)
    emit({
      type: "permission.asked",
      properties: {
        id: "per_edit",
        sessionID: "ses_directory",
        permission: "edit",
        patterns: ["src/app.ts"],
        metadata: {},
        always: [],
      },
    })
  })
  return <box />
}

render(
  () => (
    <ArgsProvider>
      <ExitProvider onExit={async () => process.exit(1)}>
        <KVProvider>
          <RouteProvider>
            <SDKProvider url="http://slopcode.internal" fetch={fetch} events={events}>
              <SyncProvider>
                <Probe />
              </SyncProvider>
            </SDKProvider>
          </RouteProvider>
        </KVProvider>
      </ExitProvider>
    </ArgsProvider>
  ),
  {
    targetFps: 60,
    gatherStats: false,
    exitOnCtrlC: false,
    useKittyKeyboard: {},
  },
)
`,
  )
  return file
}

async function run() {
  const file = await script()
  const home = path.join(
    os.tmpdir(),
    `slopcode-sync-directory-home-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  )
  await fs.mkdir(home, { recursive: true })
  const child = Bun.spawn([process.execPath, "--cwd", pkg, file], {
    cwd: pkg,
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
  return { code, raw, err }
}

describe("TUI sync directory routing", () => {
  test("sends the session directory when auto-accepting edit permissions", async () => {
    const result = await run()

    expect(result.code).toBe(0)
    expect(result.err).not.toContain("missing directory")
  }, 15_000)
})
