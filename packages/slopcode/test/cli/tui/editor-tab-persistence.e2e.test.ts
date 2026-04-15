import { afterEach, describe, expect, test } from "bun:test"
import * as fs from "node:fs/promises"
import * as os from "node:os"
import * as path from "node:path"
import { tmpdir } from "../../fixture/fixture"
import { Server } from "../../../src/server/server"
import { DaemonAuth } from "../../../src/daemon/auth"

const pkgDir = path.resolve(import.meta.dir, "../../..")
const fixturePath = path.resolve(pkgDir, "src/cli/cmd/tui/context/route.tsx")
const scripts: string[] = []
const active: Array<{ stop(force?: boolean): Promise<void> | void }> = []
const token = "editor-tab-persistence-token"

afterEach(async () => {
  await Promise.all(scripts.splice(0).map((file) => fs.rm(file, { force: true })))
  await Promise.all(active.splice(0).map((server) => server.stop(true)))
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

async function script(input: { serverUrl: string; directory: string; sessionID: string; file: string }) {
  const file = path.join(
    pkgDir,
    `.slopcode-editor-tab-persistence-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}.tsx`,
  )
  scripts.push(file)
  await Bun.write(
    file,
    `import { render, useTerminalDimensions } from "@opentui/solid"
import { createSignal, onMount } from "solid-js"
import { ArgsProvider } from "@tui/context/args"
import { ExitProvider } from "@tui/context/exit"
import { KVProvider } from "@tui/context/kv"
import { ToastProvider } from "@tui/ui/toast"
import { RouteProvider, useRoute } from "@tui/context/route"
import { TuiConfigProvider } from "@tui/context/tui-config"
import { SDKProvider, useSDK } from "@tui/context/sdk"
import { SyncProvider, useSync } from "@tui/context/sync"
import { SessionTabsProvider } from "@tui/context/session-tabs"
import { TabStateProvider, useTabState } from "@tui/context/tab-state"
import { ThemeProvider, useTheme } from "@tui/context/theme"
import { LocalProvider } from "@tui/context/local"
import { KeybindProvider } from "@tui/context/keybind"
import { PromptStashProvider } from ${JSON.stringify(path.resolve(pkgDir, "src/cli/cmd/tui/component/prompt/stash.tsx"))}
import { DialogProvider } from "@tui/ui/dialog"
import { CommandProvider } from "@tui/component/dialog-command"
import { FrecencyProvider } from ${JSON.stringify(path.resolve(pkgDir, "src/cli/cmd/tui/component/prompt/frecency.tsx"))}
import { PromptHistoryProvider } from ${JSON.stringify(path.resolve(pkgDir, "src/cli/cmd/tui/component/prompt/history.ts"))}
import { PromptRefProvider } from ${JSON.stringify(path.resolve(pkgDir, "src/cli/cmd/tui/context/prompt.tsx"))}
import { Session } from ${JSON.stringify(path.resolve(pkgDir, "src/cli/cmd/tui/routes/session/index.tsx"))}

function Driver() {
  const route = useRoute()
  const sdk = useSDK()
  const sync = useSync()
  const tabState = useTabState()

  onMount(() => {
    void (async () => {
      route.navigate({ type: "session", sessionID: ${JSON.stringify(input.sessionID)}, source: "switch" })
      while (!sync.session.get(${JSON.stringify(input.sessionID)})) {
        await Bun.sleep(50)
      }
      const url = new URL("/editor", sdk.url)
      if (sdk.directory) url.searchParams.set("directory", sdk.directory)
      url.searchParams.set("sessionID", ${JSON.stringify(input.sessionID)})
      const headers = new Headers(sdk.headers)
      headers.set("content-type", "application/json")
      const response = await (sdk.fetch ?? fetch)(url, {
        method: "POST",
        headers,
        body: JSON.stringify({
          sessionID: ${JSON.stringify(input.sessionID)},
          file: ${JSON.stringify(input.file)},
          size: { rows: 12, cols: 80 },
        }),
      })
      if (!response.ok) {
        console.error(await response.text())
        process.exit(1)
      }
      const info = await response.json()
      tabState.setEditor(${JSON.stringify(input.sessionID)}, {
        file: ${JSON.stringify(input.file)},
        editorID: info.id,
        dirty: info.dirty,
        diff: info.diff,
        mode: info.mode,
        status: info.status,
      })
      const dump = (phase) => {
        process.stderr.write("__EDITOR_STATE__" + JSON.stringify({ phase, editor: tabState.editor(${JSON.stringify(input.sessionID)}) }) + "\\n")
      }
      await Bun.sleep(900)
      dump("opened")
      tabState.activateEditor(${JSON.stringify(input.sessionID)}, undefined)
      await Bun.sleep(300)
      dump("chat")
      tabState.activateEditor(${JSON.stringify(input.sessionID)}, ${JSON.stringify(input.file)})
      await Bun.sleep(700)
      dump("back")
      process.exit(0)
    })()
  })

  return <></>
}

function App() {
  const { theme } = useTheme()
  const dims = useTerminalDimensions()
  return (
    <box width={dims().width} height={dims().height} backgroundColor={theme.background}>
      <Session />
      <Driver />
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
                <SDKProvider
                  url=${JSON.stringify(input.serverUrl)}
                  directory=${JSON.stringify(input.directory)}
                  headers={{ ${JSON.stringify(DaemonAuth.Header)}: ${JSON.stringify(token)} }}
                >
                  <SyncProvider>
                    <SessionTabsProvider>
                      <TabStateProvider>
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

describe("editor tab persistence e2e", () => {
  test("keeps a real repo file mounted across chat/editor tab switching", async () => {
    await using tmp = await tmpdir({
      git: true,
      init: async (dir: string) => {
        const file = path.join(dir, "src", "route.tsx")
        await fs.mkdir(path.dirname(file), { recursive: true })
        await Bun.write(file, await Bun.file(fixturePath).text())
        return file
      },
    })

    const server = Server.listen({ hostname: "127.0.0.1", port: 0, daemonToken: token })
    active.push(server)

    const create = await fetch(new URL("/session", server.url), {
      method: "POST",
      headers: {
        [DaemonAuth.Header]: token,
        "x-slopcode-directory": tmp.path,
        "content-type": "application/json",
      },
      body: JSON.stringify({ title: "Editor Persistence" }),
    })
    expect(create.status).toBe(200)
    const session = (await create.json()) as { id: string }

    const file = await script({
      serverUrl: server.url.toString(),
      directory: tmp.path,
      sessionID: session.id,
      file: "src/route.tsx",
    })

    const home = path.join(
      os.tmpdir(),
      `slopcode-editor-tab-home-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    )
    await fs.mkdir(home, { recursive: true })
    const child = Bun.spawn([process.execPath, "--cwd", pkgDir, file], {
      cwd: pkgDir,
      env: {
        ...Object.fromEntries(
          Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined),
        ),
        COLUMNS: "100",
        LINES: "28",
        TERM: "xterm-256color",
        SLOPCODE_TEST_HOME: home,
        SLOPCODE_ROUTE: JSON.stringify({
          type: "session",
          sessionID: session.id,
          source: "switch",
        }),
      },
      stdin: "ignore",
      stdout: "pipe",
      stderr: "pipe",
    })
    const [code, raw, stderr] = await Promise.all([
      child.exited,
      child.stdout ? new Response(child.stdout).text() : Promise.resolve(""),
      child.stderr ? new Response(child.stderr).text() : Promise.resolve(""),
    ])

    if (code !== 0) {
      throw new Error(stderr || `child exited with ${code}`)
    }

    const states = stderr
      .split("\n")
      .filter((line) => line.startsWith("__EDITOR_STATE__"))
      .map(
        (line) =>
          JSON.parse(line.slice("__EDITOR_STATE__".length)) as {
            phase: string
            editor: { active?: string; tabs: Array<{ file: string }> }
          },
      )
    const noise = stderr
      .split("\n")
      .filter((line) => line && !line.startsWith("__EDITOR_STATE__"))
      .join("\n")

    expect(noise).toBe("")
    expect(states.map((item) => item.phase)).toEqual(["opened", "chat", "back"])
    expect(states[0]?.editor.tabs.map((item) => item.file)).toEqual(["src/route.tsx"])
    expect(states[0]?.editor.active).toBe("src/route.tsx")
    expect(states[1]?.editor.tabs.map((item) => item.file)).toEqual(["src/route.tsx"])
    expect(states[1]?.editor.active).toBeUndefined()
    expect(states[2]?.editor.tabs.map((item) => item.file)).toEqual(["src/route.tsx"])
    expect(states[2]?.editor.active).toBe("src/route.tsx")
    expect(frame(raw, 100, 28).length).toBeGreaterThan(0)
  }, 15_000)
})
