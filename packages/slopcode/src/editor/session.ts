import { BusEvent } from "@/bus/bus-event"
import { Bus } from "@/bus"
import { Identifier } from "@/id/id"
import { FileWatcher } from "@/file/watcher"
import { Instance } from "@/project/instance"
import { Log } from "@/util/log"
import { lazy } from "@/util/lazy"
import { SessionSummary } from "@/session/summary"
import { Filesystem } from "@/util/filesystem"
import { NvimRPC } from "./nvim-rpc"
import { NvimUI } from "./nvim-ui"
import { type IPty } from "bun-pty"
import { $ } from "bun"
import * as path from "node:path"
import * as os from "node:os"
import * as fs from "node:fs/promises"
import z from "zod"
import { which } from "@/util/which"

export namespace EditorSession {
  const log = Log.create({ service: "editor" })

  type Socket = {
    readyState: number
    data?: unknown
    send(data: string | Uint8Array | ArrayBuffer): void
    close(code?: number, reason?: string): void
  }

  const pty = lazy(async () => {
    const { spawn } = await import("bun-pty")
    return spawn
  })

  const socketPath = (id: string) => {
    if (process.platform === "win32") return `\\\\.\\pipe\\slopcode-${id}`
    return path.join(os.tmpdir(), `${id}.sock`)
  }

  const wait = async (file: string) => {
    const start = Date.now()
    while (Date.now() - start < 5_000) {
      if (await Filesystem.exists(file)) return true
      await Bun.sleep(25)
    }
    return false
  }

  const mode = (value: string) => {
    if (!value) return "NORMAL"
    if (value.startsWith("i")) return "INSERT"
    if (value.startsWith("v") || value.startsWith("V") || value === "\u0016") return "VISUAL"
    if (value.startsWith("R")) return "REPLACE"
    if (value.startsWith("c")) return "COMMAND"
    if (value.startsWith("t")) return "TERMINAL"
    return "NORMAL"
  }

  const status = async (rpc: Awaited<ReturnType<typeof NvimRPC.connect>>) => {
    return rpc.request("nvim_exec_lua", [
      'return { dirty = vim.bo.modified, mode = vim.api.nvim_get_mode().mode, file = vim.api.nvim_buf_get_name(0) }',
      [],
    ]) as Promise<{ dirty?: boolean; mode?: string; file?: string }>
  }

  const lines = (input: string) => input.replace(/\r/g, "").split("\n")

  const meta = (session: Active) => {
    const snap = session.ui.snapshot()
    return {
      width: snap.width,
      height: snap.height,
      rows: snap.rows,
      mode: session.info.mode,
      dirty: session.info.dirty,
      diff: session.info.diff,
      file: session.info.file,
      status: session.info.status,
    }
  }

  const send = (session: Active) => {
    const payload = JSON.stringify({ type: "snapshot", snapshot: meta(session) })
    Array.from(session.subscribers.entries()).forEach(([key, ws]) => {
      if (ws.readyState !== 1 || ws.data !== key) {
        session.subscribers.delete(key)
        return
      }
      ws.send(payload)
    })
  }

  const refresh = async (session: Active) => {
    const next = await status(session.rpc)
    session.info.dirty = next.dirty === true
    session.info.mode = mode(next.mode ?? "n")
  }

  const baseline = async (sessionID: string, file: string) => {
    const diff = await SessionSummary.diffChunk({ sessionID, files: [file] }).then((items) => items[0])
    if (diff && "before" in diff) return diff.before ?? ""
    const result = await $`git show HEAD:${file}`.cwd(Instance.directory).quiet().nothrow()
    if (result.exitCode !== 0) return undefined
    return result.text()
  }

  const attach = async (session: Active, cols: number, rows: number) => {
    await session.rpc.request("nvim_ui_attach", [cols, rows, { rgb: true, ext_linegrid: true }])
    await session.rpc.request("nvim_command", ["set termguicolors mouse=a number signcolumn=no laststatus=0 wrap"])
    await session.rpc.request("nvim_command", ["syntax enable"])
    await session.rpc.request("nvim_command", ["filetype plugin indent on"])
    if (session.before === undefined) return
    await session.rpc.request("nvim_command", ["leftabove vnew"])
    const buf = Number(await session.rpc.request("nvim_eval", ['bufnr("%")']))
    await session.rpc.request("nvim_buf_set_lines", [buf, 0, -1, true, lines(session.before)])
    await session.rpc.request("nvim_command", ["setlocal buftype=nofile bufhidden=wipe noswapfile nowrap readonly nomodifiable"])
    await session.rpc.request("nvim_command", ["diffthis"])
    await session.rpc.request("nvim_command", ["wincmd p"])
    await session.rpc.request("nvim_command", ["diffthis"])
    session.info.diff = true
  }

  const removeSocket = (file: string) => fs.rm(file, { force: true }).catch(() => {})

  export const Info = z
    .object({
      id: z.string(),
      sessionID: Identifier.schema("session"),
      file: z.string(),
      cwd: z.string(),
      status: z.enum(["running", "exited"]),
      dirty: z.boolean(),
      diff: z.boolean(),
      mode: z.string(),
      pid: z.number(),
    })
    .meta({ ref: "EditorSession" })

  export const OpenInput = z.object({
    sessionID: Identifier.schema("session"),
    file: z.string(),
    size: z.object({ rows: z.number().int().positive(), cols: z.number().int().positive() }),
  })

  export const ScopedInput = z.object({
    sessionID: Identifier.schema("session"),
  })

  export const Event = {
    Updated: BusEvent.define("editor.updated", z.object({ info: Info })),
    Exited: BusEvent.define("editor.exited", z.object({ id: z.string(), sessionID: Identifier.schema("session") })),
  }

  type Active = {
    info: z.infer<typeof Info>
    process: IPty
    rpc: Awaited<ReturnType<typeof NvimRPC.connect>>
    ui: ReturnType<typeof NvimUI.create>
    socket: string
    before?: string
    subscribers: Map<unknown, Socket>
  }

  const state = Instance.state(() => new Map<string, Active>(), async (items) => {
    await Promise.all(Array.from(items.values()).map((item) => close(item.info.id)))
  })

  const getActive = (id: string, sessionID?: string) => {
    const session = state().get(id)
    if (!session) return
    if (sessionID && session.info.sessionID !== sessionID) return
    return session
  }

  const update = async (session: Active) => {
    await refresh(session)
    send(session)
    Bus.publish(Event.Updated, { info: session.info })
  }

  export async function open(input: z.infer<typeof OpenInput>) {
    const hit = Array.from(state().values()).find((item) => item.info.sessionID === input.sessionID)
    if (hit) await close(hit.info.id)
    const bin = which("nvim")
    if (!bin) throw new Error("Neovim is required to use the embedded editor")
    const full = path.join(Instance.directory, input.file)
    if (!Instance.containsPath(full)) throw new Error("Access denied: path escapes project directory")
    const id = `${Identifier.create("pty", false)}_editor`
    const sock = socketPath(id)
    await removeSocket(sock)
    const spawn = await pty()
    const proc = spawn(bin, ["--headless", "--listen", sock, full], {
      cwd: Instance.directory,
      env: {
        ...process.env,
        TERM: "xterm-256color",
      },
      name: "xterm-256color",
    })
    const ready = await wait(sock)
    if (!ready) {
      proc.kill()
      throw new Error("Timed out waiting for Neovim to start")
    }
    const rpc = await NvimRPC.connect(sock)
    const ui = NvimUI.create()
    const info: z.infer<typeof Info> = {
      id,
      sessionID: input.sessionID,
      file: input.file,
      cwd: Instance.directory,
      status: "running",
      dirty: false,
      diff: false,
      mode: "NORMAL",
      pid: proc.pid,
    }
    const session = {
      info,
      process: proc,
      rpc,
      ui,
      socket: sock,
      before: await baseline(input.sessionID, input.file),
      subscribers: new Map<unknown, Socket>(),
    } satisfies Active
    state().set(id, session)
    const off = rpc.on("redraw", async (params) => {
      const next = Array.isArray(params[0]) && Array.isArray((params[0] as unknown[])[0]) ? (params[0] as unknown[]) : params
      if (!ui.redraw(next)) return
      await update(session)
    })
    proc.onExit(() => {
      off()
      if (state().get(id) !== session) return
      session.info.status = "exited"
      send(session)
      Bus.publish(Event.Exited, { id, sessionID: session.info.sessionID })
      state().delete(id)
      rpc.close()
      void removeSocket(sock)
    })
    await attach(session, input.size.cols, input.size.rows)
    await update(session)
    return info
  }

  export function get(id: string, input?: z.infer<typeof ScopedInput>) {
    return getActive(id, input?.sessionID)?.info
  }

  export async function resize(id: string, size: { rows: number; cols: number }, input?: z.infer<typeof ScopedInput>) {
    const session = getActive(id, input?.sessionID)
    if (!session) return
    await session.rpc.request("nvim_ui_try_resize", [size.cols, size.rows])
    await update(session)
    return session.info
  }

  export async function save(id: string, input?: z.infer<typeof ScopedInput>) {
    const session = getActive(id, input?.sessionID)
    if (!session) return
    await session.rpc.request("nvim_command", ["write"])
    await update(session)
    await Bus.publish(FileWatcher.Event.Updated, { file: path.join(Instance.directory, session.info.file), event: "change" })
    return session.info
  }

  export async function dismiss(id: string, input?: z.infer<typeof ScopedInput>) {
    const session = getActive(id, input?.sessionID)
    if (!session) return
    await session.rpc.request("nvim_command", ["diffoff!"])
    await session.rpc.request("nvim_command", ["only"])
    session.info.diff = false
    await update(session)
    return session.info
  }

  export async function close(id: string, input?: z.infer<typeof ScopedInput>) {
    const session = getActive(id, input?.sessionID)
    if (!session) return false
    state().delete(id)
    session.rpc.close()
    session.process.kill()
    await removeSocket(session.socket)
    return true
  }

  const write = async (session: Active, message: string) => {
    const data = JSON.parse(message) as Record<string, unknown>
    if (data.type === "resize") {
      const rows = Number(data.rows)
      const cols = Number(data.cols)
      if (rows > 0 && cols > 0) {
        await session.rpc.request("nvim_ui_try_resize", [cols, rows])
      }
      return update(session)
    }
    if (data.type === "focus") {
      await session.rpc.request("nvim_ui_set_focus", [data.gained === true])
      return update(session)
    }
    if (data.type === "paste" && typeof data.text === "string") {
      await session.rpc.request("nvim_paste", [data.text, false, -1])
      return update(session)
    }
    if (data.type === "mouse") {
      await session.rpc.request("nvim_input_mouse", [
        typeof data.button === "string" ? data.button : "left",
        typeof data.action === "string" ? data.action : "press",
        typeof data.modifier === "string" ? data.modifier : "",
        0,
        Number(data.row) || 0,
        Number(data.col) || 0,
      ])
      return update(session)
    }
    if (data.type === "input" && typeof data.keys === "string") {
      await session.rpc.request("nvim_input", [data.keys])
      return update(session)
    }
  }

  export function connect(id: string, ws: Socket, input?: z.infer<typeof ScopedInput>) {
    const session = getActive(id, input?.sessionID)
    if (!session) {
      ws.close()
      return
    }
    const key = ws.data && typeof ws.data === "object" ? ws.data : ws
    session.subscribers.set(key, ws)
    ws.send(JSON.stringify({ type: "snapshot", snapshot: meta(session) }))
    return {
      onMessage(message: string | ArrayBuffer) {
        const text = typeof message === "string" ? message : Buffer.from(message).toString("utf8")
        void write(session, text)
      },
      onClose() {
        session.subscribers.delete(key)
      },
    }
  }
}
