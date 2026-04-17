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
const token = "editor-full-app-sidebar-open-token"
const width = 140
const height = 40

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
  return rows.map((row) => row.join(""))
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

function locate(screen: string[], text: string, occurrence = 0) {
  for (let row = 0; row < screen.length; row++) {
    const col = column(screen[row]!, text, occurrence)
    if (!col) continue
    return { row: row + 1, col }
  }
}

async function eventually<T>(check: () => T | Promise<T>, timeout = 12_000) {
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

async function script() {
  const file = path.join(
    pkgDir,
    `.slopcode-editor-full-app-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}.ts`,
  )
  scripts.push(file)
  await Bun.write(
    file,
    `import { tui } from ${JSON.stringify(path.resolve(pkgDir, "src/cli/cmd/tui/app.tsx"))}
import { TuiConfig } from ${JSON.stringify(path.resolve(pkgDir, "src/config/tui.ts"))}
import { Instance } from ${JSON.stringify(path.resolve(pkgDir, "src/project/instance.ts"))}

const directory = process.argv[2]
const url = process.argv[3]
const sessionID = process.argv[4]
const token = process.argv[5]
const config = await Instance.provide({ directory, fn: () => TuiConfig.get() })
await tui({
  url,
  config,
  directory,
  headers: { ${JSON.stringify(DaemonAuth.Header)}: token },
  args: { sessionID, continue: false, fork: false },
  onExit: async () => {},
})
`,
  )
  return file
}

describe("editor full app sidebar open e2e", () => {
  test("opens a real repo file from the actual app shell and keeps it visible for 4+ seconds", async () => {
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
      body: JSON.stringify({ title: "Real App Repro" }),
    })
    expect(create.status).toBe(200)
    const session = (await create.json()) as { id: string }

    const file = await script()
    let raw = ""
    const home = path.join(os.tmpdir(), `slopcode-full-app-home-${process.pid}-${Date.now()}`)
    await fs.mkdir(home, { recursive: true })
    const pty = spawn(process.execPath, [file, tmp.path, server.url.toString(), session.id, token], {
      name: process.env.TERM || "xterm-256color",
      cols: width,
      rows: height,
      cwd: pkgDir,
      env: {
        ...Object.fromEntries(
          Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined),
        ),
        TERM: process.env.TERM || "xterm-256color",
        TERM_PROGRAM: process.env.TERM_PROGRAM || "tmux",
        TERM_PROGRAM_VERSION: process.env.TERM_PROGRAM_VERSION || "",
        TMUX: process.env.TMUX || "",
        SSH_TTY: process.env.SSH_TTY || "",
        HOME: process.env.HOME || os.homedir(),
        SLOPCODE_TEST_HOME: home,
      },
    })
    const dispose = pty.onData((data) => {
      raw += data
    })

    try {
      await eventually(() => frame(raw, width, height).join("\n").includes("Real App Repro"))
      const summary = frame(raw, width, height)
      const filesButton = locate(summary, "📂")
      expect(filesButton).toBeDefined()
      click(pty, filesButton!.row, filesButton!.col)

      await eventually(() => frame(raw, width, height).join("\n").includes("File explorer"))
      await eventually(() => frame(raw, width, height).join("\n").includes("route.tsx"))

      const explorer = frame(raw, width, height)
      const line = explorer.find((item) => item.includes("route.tsx"))
      expect(line).toBeDefined()
      const row = explorer.findIndex((item) => item.includes("route.tsx")) + 1
      const icon = column(line!, "📂", 0)
      const action = column(line!, "📂", 1) ?? icon
      expect(action).toBeDefined()
      click(pty, row, action! + 1)

      const snippet = "SessionRoute"
      const start = await eventually(() => {
        const screen = frame(raw, width, height).join("\n")
        if (!screen.includes("route.tsx") || !screen.includes(snippet)) return
        return Date.now()
      }, 15_000)

      const filesMode = await eventually(() => {
        const screen = frame(raw, width, height).join("\n")
        if (!screen.includes("Open Files") || !screen.includes("💾") || !screen.includes("✕")) return
        return screen
      })
      expect(filesMode).toContain("route.tsx")
      const summaryTab = locate(filesMode.split("\n"), "Summary")
      expect(summaryTab).toBeDefined()
      click(pty, summaryTab!.row, summaryTab!.col)
      const summaryMode = await eventually(() => {
        const screen = frame(raw, width, height).join("\n")
        if (!screen.includes("Open Files") || !screen.includes("route.tsx") || !screen.includes(snippet)) return
        return screen
      })
      expect(summaryMode).toContain("💾")
      expect(summaryMode).toContain("✕")

      const samples: Array<{ elapsed: number; visible: boolean; screen: string }> = []
      while (Date.now() - start < 4_200) {
        const screen = frame(raw, width, height).join("\n")
        samples.push({
          elapsed: Date.now() - start,
          visible: screen.includes("route.tsx") && screen.includes(snippet),
          screen,
        })
        await Bun.sleep(50)
      }

      expect(samples.at(-1)?.elapsed ?? 0).toBeGreaterThanOrEqual(4_000)
      const blink = samples.find((item) => !item.visible)
      if (blink) {
        throw new Error(`editor blinked after open at ${blink.elapsed}ms\n${blink.screen}`)
      }
    } finally {
      dispose.dispose()
      pty.kill()
    }
  }, 25_000)


})
