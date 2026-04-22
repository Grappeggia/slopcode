import { spawn } from "bun-pty"
import * as fs from "node:fs/promises"
import * as os from "node:os"
import * as path from "node:path"
import { Server } from "../../../src/server/server"
import { DaemonAuth } from "../../../src/daemon/auth"

export const pkg_dir = path.resolve(import.meta.dir, "../../..")
export const fixture_path = path.resolve(pkg_dir, "src/cli/cmd/tui/context/route.tsx")

export function frame(raw: string, width: number, height: number) {
  const rows = Array.from({ length: height }, () => Array.from({ length: width }, () => " "))
  let x = 0
  let y = 0
  let saved = { x: 0, y: 0 }
  const clear = () => rows.forEach((row) => row.fill(" "))
  const clear_line = (mode = 0) => {
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
        if (tail === "K") clear_line(mode)
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

export function text(raw: string, width: number, height: number) {
  return frame(raw, width, height).join("\n")
}

export function column(line: string, value: string, occurrence = 0) {
  let index = -1
  let offset = 0
  for (let i = 0; i <= occurrence; i++) {
    index = line.indexOf(value, offset)
    if (index === -1) return
    offset = index + value.length
  }
  return Bun.stringWidth(line.slice(0, index)) + 1
}

export function locate(screen: string[] | string, value: string, occurrence = 0) {
  const lines = Array.isArray(screen) ? screen : screen.split("\n")
  for (let row = 0; row < lines.length; row++) {
    const col = column(lines[row]!, value, occurrence)
    if (!col) continue
    return { row: row + 1, col }
  }
}

export async function eventually<T>(check: () => T | Promise<T>, timeout = 12_000) {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    const value = await check()
    if (value) return value
    await Bun.sleep(50)
  }
  throw new Error("condition not met")
}

export function click(pty: ReturnType<typeof spawn>, row: number, col: number) {
  pty.write(`\u001b[<0;${col};${row}M`)
  pty.write(`\u001b[<3;${col};${row}m`)
}

export function wheel(pty: ReturnType<typeof spawn>, row: number, col: number, dir: "up" | "down") {
  pty.write(`\u001b[<${dir === "up" ? 64 : 65};${col};${row}M`)
}

export function ctrl(pty: ReturnType<typeof spawn>, key: string) {
  pty.write(String.fromCharCode(key.toUpperCase().charCodeAt(0) & 0x1f))
}

export function press(pty: ReturnType<typeof spawn>, key: "home" | "end" | "pagedown" | "pageup" | "left" | "right") {
  const map = {
    home: "\u001b[H",
    end: "\u001b[F",
    pagedown: "\u001b[6~",
    pageup: "\u001b[5~",
    left: "\u001b[D",
    right: "\u001b[C",
  }
  pty.write(map[key])
}

export async function write_app_script(name: string, token: string) {
  const file = path.join(pkg_dir, `.${name}-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}.ts`)
  await Bun.write(
    file,
    `import { tui } from ${JSON.stringify(path.resolve(pkg_dir, "src/cli/cmd/tui/app.tsx"))}
import { TuiConfig } from ${JSON.stringify(path.resolve(pkg_dir, "src/config/tui.ts"))}
import { Instance } from ${JSON.stringify(path.resolve(pkg_dir, "src/project/instance.ts"))}

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

export async function start(input: {
  title: string
  directory: string
  token: string
  width: number
  height: number
  script_name: string
  env?: Record<string, string>
  prepare?(session_id: string): Promise<void>
}) {
  const server = Server.listen({ hostname: "127.0.0.1", port: 0, daemonToken: input.token })
  const create = await fetch(new URL("/session", server.url), {
    method: "POST",
    headers: {
      [DaemonAuth.Header]: input.token,
      "x-slopcode-directory": input.directory,
      "content-type": "application/json",
    },
    body: JSON.stringify({ title: input.title }),
  })
  if (!create.ok) throw new Error(await create.text())
  const session = (await create.json()) as { id: string }
  await input.prepare?.(session.id)
  const file = await write_app_script(input.script_name, input.token)
  let raw = ""
  const home = path.join(os.tmpdir(), `${input.script_name}-home-${process.pid}-${Date.now()}`)
  await fs.mkdir(home, { recursive: true })
  const pty = spawn(process.execPath, [file, input.directory, server.url.toString(), session.id, input.token], {
    name: process.env.TERM || "xterm-256color",
    cols: input.width,
    rows: input.height,
    cwd: pkg_dir,
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
      ...input.env,
    },
  })
  const data = pty.onData((chunk) => {
    raw += chunk
  })
  return {
    file,
    home,
    pty,
    server,
    session_id: session.id,
    raw: () => raw,
    screen: () => frame(raw, input.width, input.height),
    text: () => text(raw, input.width, input.height),
    async stop() {
      data.dispose()
      pty.kill()
      await server.stop(true)
      await fs.rm(file, { force: true })
    },
  }
}
