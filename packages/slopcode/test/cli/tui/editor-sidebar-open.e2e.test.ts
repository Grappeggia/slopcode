import { afterEach, describe, expect, test } from "bun:test"
import * as fs from "node:fs/promises"
import * as os from "node:os"
import * as path from "node:path"
import { spawn } from "bun-pty"
import { tmpdir } from "../../fixture/fixture"
import { Server } from "../../../src/server/server"
import { DaemonAuth } from "../../../src/daemon/auth"

const pkgDir = path.resolve(import.meta.dir, "../../..")
const fixturePath = path.resolve(pkgDir, "src/cli/cmd/tui/context/route.tsx")
const scripts: string[] = []
const active: Array<{ stop(force?: boolean): Promise<void> | void }> = []
const token = "editor-sidebar-open-token"
const width = 120
const height = 30

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
  return rows.map((row) => row.join("")).join("\n")
}

function column(line: string, text: string, occurrence = 0) {
  let index = -1
  let offset = 0
  for (let i = 0; i <= occurrence; i++) {
    index = line.indexOf(text, offset)
    if (index === -1) return
    offset = index + text.length
  }
  return Bun.stringWidth(line.slice(0, index)) + 1
}

function locate(screen: string, text: string, occurrence = 0) {
  const lines = screen.split("\n")
  for (let row = 0; row < lines.length; row++) {
    const col = column(lines[row]!, text, occurrence)
    if (!col) continue
    return { row: row + 1, col }
  }
}

async function eventually<T>(check: () => T | Promise<T>, timeout = 8_000) {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    const value = await check()
    if (value) return value
    await Bun.sleep(50)
  }
  throw new Error("condition not met")
}

function click(pty: ReturnType<typeof spawn>, row: number, col: number) {
  pty.write(`\u001b[<0;${col};${row}M`)
  pty.write(`\u001b[<3;${col};${row}m`)
}

async function script(input: { serverUrl: string; directory: string }) {
  const file = path.join(
    pkgDir,
    `.slopcode-editor-sidebar-open-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}.tsx`,
  )
  scripts.push(file)
  await Bun.write(
    file,
    `import { render, useTerminalDimensions } from "@opentui/solid"
import { ArgsProvider } from "@tui/context/args"
import { ExitProvider } from "@tui/context/exit"
import { KVProvider } from "@tui/context/kv"
import { ToastProvider } from "@tui/ui/toast"
import { RouteProvider } from "@tui/context/route"
import { TuiConfigProvider } from "@tui/context/tui-config"
import { SDKProvider } from "@tui/context/sdk"
import { SyncProvider } from "@tui/context/sync"
import { SessionTabsProvider } from "@tui/context/session-tabs"
import { TabStateProvider } from "@tui/context/tab-state"
import { EditorConnectionProvider } from "@tui/context/editor-connection"
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

function App() {
  const { theme } = useTheme()
  const dims = useTerminalDimensions()
  return (
    <box width={dims().width} height={dims().height} backgroundColor={theme.background}>
      <Session />
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
                        <EditorConnectionProvider>
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

describe("editor sidebar open e2e", () => {
  test("opens a real code file from the sidebar and stays visually mounted for 4+ seconds", async () => {
    await using tmp = await tmpdir({
      git: true,
      init: async (dir: string) => {
        const file = path.join(dir, "route.tsx")
        await Bun.write(file, await Bun.file(fixturePath).text())
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
      body: JSON.stringify({ title: "Sidebar Open" }),
    })
    expect(create.status).toBe(200)
    const session = (await create.json()) as { id: string }

    const file = await script({
      serverUrl: server.url.toString(),
      directory: tmp.path,
    })

    const home = path.join(os.tmpdir(), `slopcode-editor-sidebar-open-home-${process.pid}-${Date.now()}`)
    await fs.mkdir(home, { recursive: true })

    let raw = ""
    const pty = spawn(process.execPath, ["--cwd", pkgDir, file], {
      name: "xterm-256color",
      cols: width,
      rows: height,
      cwd: pkgDir,
      env: {
        ...Object.fromEntries(
          Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined),
        ),
        TERM: "xterm-256color",
        SLOPCODE_TEST_HOME: home,
        SLOPCODE_ROUTE: JSON.stringify({
          type: "session",
          sessionID: session.id,
          source: "switch",
        }),
      },
    })
    const dispose = pty.onData((data) => {
      raw += data
    })

    try {
      await eventually(() => {
        const screen = frame(raw, width, height)
        return screen.includes("Sidebar Open") && screen.includes("📂")
      }).catch(() => {
        throw new Error(`initial session screen did not render\n${frame(raw, width, height)}`)
      })

      const summary = frame(raw, width, height)
      const filesButton = locate(summary, "📂")
      expect(filesButton).toBeDefined()
      click(pty, filesButton!.row, filesButton!.col)

      await eventually(() => frame(raw, width, height).includes("route.tsx")).catch(() => {
        throw new Error(`fixture file did not appear in file explorer\n${frame(raw, width, height)}`)
      })

      const explorer = frame(raw, width, height)
      const line = explorer.split("\n").find((item) => item.includes("route.tsx"))
      expect(line).toBeDefined()
      const row = explorer.split("\n").findIndex((item) => item.includes("route.tsx")) + 1
      const icon = column(line!, "📂", 0)
      const action = column(line!, "📂", 1) ?? icon
      expect(action).toBeDefined()
      click(pty, row, action! + 1)

      const snippet = "SessionRouteSource"
      const start = await eventually(async () => {
        const screen = frame(raw, width, height)
        if (!screen.includes("route.tsx") || !screen.includes(snippet)) return
        return Date.now()
      }).catch(() => {
        throw new Error(`editor content never stabilized after sidebar open\n${frame(raw, width, height)}`)
      })

      const samples: Array<{ elapsed: number; visible: boolean; screen: string }> = []
      while (Date.now() - start < 4_200) {
        const screen = frame(raw, width, height)
        samples.push({
          elapsed: Date.now() - start,
          visible: screen.includes("route.tsx") && screen.includes(snippet),
          screen,
        })
        await Bun.sleep(100)
      }

      expect(samples.length).toBeGreaterThanOrEqual(35)
      const blink = samples.find((item) => !item.visible)
      if (blink) {
        throw new Error(`editor blinked after open at ${blink.elapsed}ms\n${blink.screen}`)
      }
    } finally {
      dispose.dispose()
      pty.kill()
    }
  }, 20_000)
})
