import { afterEach, describe, expect, test } from "bun:test"
import fs from "fs/promises"
import os from "os"
import path from "path"

const pkgDir = path.resolve(import.meta.dir, "../../..")
const argsPath = path.resolve(pkgDir, "src/cli/cmd/tui/context/args.tsx")
const exitPath = path.resolve(pkgDir, "src/cli/cmd/tui/context/exit.tsx")
const kvPath = path.resolve(pkgDir, "src/cli/cmd/tui/context/kv.tsx")
const routePath = path.resolve(pkgDir, "src/cli/cmd/tui/context/route.tsx")
const tuiConfigPath = path.resolve(pkgDir, "src/cli/cmd/tui/context/tui-config.tsx")
const sdkPath = path.resolve(pkgDir, "src/cli/cmd/tui/context/sdk.tsx")
const syncPath = path.resolve(pkgDir, "src/cli/cmd/tui/context/sync.tsx")
const sessionTabsPath = path.resolve(pkgDir, "src/cli/cmd/tui/context/session-tabs.tsx")
const tabStatePath = path.resolve(pkgDir, "src/cli/cmd/tui/context/tab-state.tsx")
const editorConnectionPath = path.resolve(pkgDir, "src/cli/cmd/tui/context/editor-connection.tsx")
const editorContextPath = path.resolve(pkgDir, "src/cli/cmd/tui/context/editor.ts")
const themePath = path.resolve(pkgDir, "src/cli/cmd/tui/context/theme.tsx")
const localPath = path.resolve(pkgDir, "src/cli/cmd/tui/context/local.tsx")
const keybindPath = path.resolve(pkgDir, "src/cli/cmd/tui/context/keybind.tsx")
const dialogPath = path.resolve(pkgDir, "src/cli/cmd/tui/ui/dialog.tsx")
const toastPath = path.resolve(pkgDir, "src/cli/cmd/tui/ui/toast.tsx")
const commandPath = path.resolve(pkgDir, "src/cli/cmd/tui/component/dialog-command.tsx")
const promptPath = path.resolve(pkgDir, "src/cli/cmd/tui/component/prompt/index.tsx")
const stashPath = path.resolve(pkgDir, "src/cli/cmd/tui/component/prompt/stash.tsx")
const frecencyPath = path.resolve(pkgDir, "src/cli/cmd/tui/component/prompt/frecency.tsx")
const historyPath = path.resolve(pkgDir, "src/cli/cmd/tui/component/prompt/history.ts")
const promptRefPath = path.resolve(pkgDir, "src/cli/cmd/tui/context/prompt.tsx")
const completion =
  "WRAPROW1 WRAPROW2 WRAPROW3 WRAPROW4 WRAPROW5 WRAPROW6 WRAPROW7 WRAPROW8 WRAPROW9 WRAPROW10 WRAPROW11 WRAPROW12"
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
    pkgDir,
    `.tmp-prompt-ghost-overflow-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}.tsx`,
  )
  scripts.push(file)
  await Bun.write(
    file,
    `import { render, useTerminalDimensions } from "@opentui/solid"
import { onMount } from "solid-js"
import { ArgsProvider } from ${JSON.stringify(argsPath)}
import { ExitProvider } from ${JSON.stringify(exitPath)}
import { KVProvider } from ${JSON.stringify(kvPath)}
import { ToastProvider } from ${JSON.stringify(toastPath)}
import { RouteProvider } from ${JSON.stringify(routePath)}
import { TuiConfigProvider } from ${JSON.stringify(tuiConfigPath)}
import { SDKProvider } from ${JSON.stringify(sdkPath)}
import { SyncProvider } from ${JSON.stringify(syncPath)}
import { SessionTabsProvider } from ${JSON.stringify(sessionTabsPath)}
import { TabStateProvider, useTabState } from ${JSON.stringify(tabStatePath)}
import { EditorConnectionProvider } from ${JSON.stringify(editorConnectionPath)}
import { EditorContextProvider } from ${JSON.stringify(editorContextPath)}
import { ThemeProvider, useTheme } from ${JSON.stringify(themePath)}
import { LocalProvider } from ${JSON.stringify(localPath)}
import { KeybindProvider } from ${JSON.stringify(keybindPath)}
import { DialogProvider } from ${JSON.stringify(dialogPath)}
import { CommandProvider } from ${JSON.stringify(commandPath)}
import { PromptStashProvider } from ${JSON.stringify(stashPath)}
import { FrecencyProvider } from ${JSON.stringify(frecencyPath)}
import { PromptHistoryProvider } from ${JSON.stringify(historyPath)}
import { PromptRefProvider } from ${JSON.stringify(promptRefPath)}
import { Prompt } from ${JSON.stringify(promptPath)}

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
  id: "ses_ghost",
  slug: "ses_ghost",
  projectID: "proj_1",
  directory: process.cwd(),
  title: "Ghost Overflow",
  version: "0.1.37",
  time: { created: 1, updated: 1 },
}
const now = Date.now()
const status = {
  ses_ghost: {
    type: "busy",
    phase: "running",
    since: now - 18 * 60 * 1000,
    updated: now,
  },
}
const json = (value) => new Response(JSON.stringify(value), { headers: { "content-type": "application/json" } })
const fetch = Object.assign(
  async (input) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url)
    if (url.pathname === "/config/providers") return json({ providers: [provider], default: { mock: "test" } })
    if (url.pathname === "/provider") return json({ all: [provider], default: { mock: "test" }, connected: ["mock"] })
    if (url.pathname === "/agent") return json([{ name: "build", mode: "primary", hidden: false }])
    if (url.pathname === "/config") {
      return json({
        autocomplete: {
          enabled: true,
          debounce_ms: 20,
          min_prefix_chars: 1,
        },
        keybinds: { session_interrupt: "escape" },
      })
    }
    if (url.pathname === "/session") return json([session])
    if (url.pathname === "/command") return json([])
    if (url.pathname === "/lsp") return json([])
    if (url.pathname === "/mcp") return json({})
    if (url.pathname === "/experimental/resource") return json({})
    if (url.pathname === "/formatter") return json([])
    if (url.pathname === "/session/status") return json(status)
    if (url.pathname === "/provider/auth") return json({})
    if (url.pathname === "/vcs") return json({ branch: "dev" })
    if (url.pathname === "/path") {
      const cwd = process.cwd()
      return json({ state: cwd, config: cwd, worktree: cwd, directory: cwd })
    }
    if (url.pathname === "/session/ses_ghost") return json(session)
    if (url.pathname === "/session/ses_ghost/message") return json([])
    if (url.pathname === "/session/ses_ghost/todo") return json([])
    if (url.pathname === "/session/ses_ghost/diff") return json([])
    if (url.pathname === "/session/ses_ghost/autocomplete") {
      return json({ completion: ${JSON.stringify(completion)}, model: "mock/test" })
    }
    return new Response("not found", { status: 404 })
  },
  {
    preconnect() {},
  },
)

process.env.SLOPCODE_ROUTE = JSON.stringify({
  type: "session",
  sessionID: "ses_ghost",
  source: "switch",
})

const events = {
  on() {
    const timer = setTimeout(() => process.exit(0), 1600)
    return () => clearTimeout(timer)
  },
}

function App() {
  const { theme } = useTheme()
  const dims = useTerminalDimensions()
  const tab = useTabState()
  onMount(() => {
    tab.setPrompt("ses_ghost", {
      input: "ghost seed ",
      parts: [],
      mode: "normal",
    })
  })
  return (
    <box width={dims().width} height={dims().height} backgroundColor={theme.background}>
      <Prompt sessionID="ses_ghost" />
    </box>
  )
}

render(
  () => (
    <ArgsProvider>
      <ExitProvider onExit={async () => process.exit(0)}>
        <KVProvider>
          <ToastProvider>
            <RouteProvider>
              <TuiConfigProvider config={{}}>
                <SDKProvider url="http://slopcode.internal" fetch={fetch} events={events}>
                  <SyncProvider>
                    <SessionTabsProvider>
                      <TabStateProvider>
                        <EditorConnectionProvider>
                          <EditorContextProvider>
                            <ThemeProvider mode="dark">
                              <LocalProvider>
                                <KeybindProvider>
                                  <PromptStashProvider>
                                    <DialogProvider>
                                      <CommandProvider>
                                        <FrecencyProvider>
                                          <PromptHistoryProvider>
                                            <PromptRefProvider>
                                              <App />
                                            </PromptRefProvider>
                                          </PromptHistoryProvider>
                                        </FrecencyProvider>
                                      </CommandProvider>
                                    </DialogProvider>
                                  </PromptStashProvider>
                                </KeybindProvider>
                              </LocalProvider>
                            </ThemeProvider>
                          </EditorContextProvider>
                        </EditorConnectionProvider>
                      </TabStateProvider>
                    </SessionTabsProvider>
                  </SyncProvider>
                </SDKProvider>
              </TuiConfigProvider>
            </RouteProvider>
          </ToastProvider>
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
    `slopcode-prompt-ghost-overflow-home-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  )
  await fs.mkdir(home, { recursive: true })
  const child = Bun.spawn([process.execPath, "--cwd", pkgDir, file], {
    cwd: pkgDir,
    env: {
      ...Object.fromEntries(
        Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined),
      ),
      COLUMNS: "72",
      LINES: "16",
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
    screen: frame(raw, 72, 16),
  }
}

describe("tui prompt ghost overflow", () => {
  test("wraps long inline completions onto later prompt rows without hiding footer hints", async () => {
    const result = await run()
    const rows = result.screen.split("\n").filter((row) => row.includes("WRAPROW"))

    expect(result.code).toBe(0)
    expect(rows.length).toBeGreaterThan(1)
    expect(result.screen).toInclude("WRAPROW11")
    expect(result.screen).toInclude("ghost seed")
    expect(result.screen).toInclude("Build  Test Mock")
    expect(result.screen).toInclude("stop")
    expect(result.screen).toInclude("cmd")
  }, 15_000)
})
