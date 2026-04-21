import { Buffer } from "node:buffer"
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process"
import * as fs from "node:fs/promises"
import * as path from "node:path"
import z from "zod"
import { $ } from "bun"
import { BusEvent } from "@/bus/bus-event"
import { Bus } from "@/bus"
import { FileWatcher } from "@/file/watcher"
import { Identifier } from "@/id/id"
import { Instance } from "@/project/instance"
import { SessionSummary } from "@/session/summary"
import { Global } from "@/global"
import { Log } from "@/util/log"
import { NvimBundle } from "./nvim-bundle"
import { lint } from "./lint"
import { NvimRPC } from "./nvim-rpc"
import { NvimUI } from "./nvim-ui"
import type { Diagnostic, Snapshot } from "./types"

export namespace EditorSessionNvim {
  const log = Log.create({ service: "editor.nvim" })

  type Socket = {
    readyState: number
    data?: unknown
    send(data: string | Uint8Array | ArrayBuffer): void
    close(code?: number, reason?: string): void
  }

  type Active = {
    info: z.infer<typeof Info>
    directory: string
    view_id?: string
    process: ChildProcessWithoutNullStreams
    rpc: ReturnType<typeof NvimRPC.attach>
    ui: ReturnType<typeof NvimUI.create>
    pending: Promise<void>
    before?: string
    diagnostics: Diagnostic[]
    subscribers: Set<Socket>
  }

  const state = Instance.state(
    () => new Map<string, Active>(),
    async (items) => {
      await Promise.all(Array.from(items.values()).map((item) => close(item.info.id)))
    },
  )

  const provide = async <T>(session: Active, fn: () => Promise<T> | T) => {
    return Instance.provide({
      directory: session.directory,
      viewID: session.view_id,
      fn,
    })
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

  const relative = (file: string) => path.relative(Instance.directory, file).replaceAll("\\", "/")

  const lines = (text: string) => text.replace(/\r/g, "").split("\n")

  const active = (id: string, sessionID?: string) => {
    const hit = state().get(id)
    if (!hit) return
    if (sessionID && hit.info.sessionID !== sessionID) return
    return hit
  }

  const status = async (session: Active) => {
    return session.rpc.request("nvim_exec_lua", [
      "return { dirty = vim.bo.modified, mode = vim.api.nvim_get_mode().mode, file = vim.api.nvim_buf_get_name(0) }",
      [],
    ]) as Promise<{ dirty?: boolean; mode?: string; file?: string }>
  }

  const content = async (session: Active) => {
    const buf = Number(await session.rpc.request("nvim_get_current_buf", []))
    const value = await session.rpc.request("nvim_buf_get_lines", [buf, 0, -1, true])
    if (!Array.isArray(value)) return ""
    return value.filter((item): item is string => typeof item === "string").join("\n")
  }

  const inspect = async (session: Active) => {
    session.diagnostics = lint(session.info.file, await content(session))
  }

  const data = (session: Active) => {
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
      diagnostics: session.diagnostics,
    } satisfies Snapshot
  }

  const send = (session: Active) => {
    const payload = JSON.stringify({ type: "snapshot", snapshot: data(session) })
    Array.from(session.subscribers).forEach((ws) => {
      if (ws.readyState === 0) return
      if (ws.readyState !== 1) {
        session.subscribers.delete(ws)
        return
      }
      ws.send(payload)
    })
  }

  const refresh = async (session: Active, full = false) => {
    const next = await status(session)
    session.info.dirty = next.dirty === true
    session.info.mode = mode(next.mode ?? "n")
    if (next.file) {
      const file = relative(next.file)
      if (file && !file.startsWith("..")) {
        session.info.file = file
      }
    }
    if (full) await inspect(session)
  }

  const update = async (session: Active, full = false) => {
    await refresh(session, full)
    send(session)
    await provide(session, () => Bus.publish(Event.Updated, { info: session.info }))
  }

  const queue = async (session: Active, fn: () => Promise<void>) => {
    session.pending = session.pending.then(fn, fn)
    return session.pending.catch((error) => {
      log.error("editor operation failed", { error, file: session.info.file })
    })
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
    await session.rpc.request("nvim_command", [
      "set termguicolors mouse=a number signcolumn=no laststatus=0 wrap shortmess+=I",
    ])
    await session.rpc.request("nvim_command", ["syntax enable"])
    await session.rpc.request("nvim_command", ["filetype plugin indent on"])
    if (session.before === undefined) return
    await session.rpc.request("nvim_command", ["leftabove vnew"])
    const buf = Number(await session.rpc.request("nvim_eval", ['bufnr("%")']))
    await session.rpc.request("nvim_buf_set_lines", [buf, 0, -1, true, lines(session.before)])
    await session.rpc.request("nvim_command", [
      "setlocal buftype=nofile bufhidden=wipe noswapfile nowrap readonly nomodifiable",
    ])
    await session.rpc.request("nvim_command", ["diffthis"])
    await session.rpc.request("nvim_command", ["wincmd p"])
    await session.rpc.request("nvim_command", ["diffthis"])
    session.info.diff = true
  }

  const roots = async () => {
    const dirs = [Global.Path.cache, Global.Path.config, Global.Path.data, Global.Path.state].map((item) =>
      path.join(item, "editor"),
    )
    await Promise.all(dirs.map((item) => fs.mkdir(item, { recursive: true }).catch(() => undefined)))
    return {
      cache: path.join(Global.Path.cache, "editor"),
      config: path.join(Global.Path.config, "editor"),
      data: path.join(Global.Path.data, "editor"),
      state: path.join(Global.Path.state, "editor"),
    }
  }

  const spawnEditor = async (file: string) => {
    const bundle = await NvimBundle.ready()
    if (!bundle) return
    const dirs = await roots()
    return spawn(bundle.bin, ["--clean", "--embed", file], {
      cwd: Instance.directory,
      env: {
        ...process.env,
        NVIM_APPNAME: "slopcode-editor",
        VIMRUNTIME: bundle.runtime,
        XDG_CACHE_HOME: dirs.cache,
        XDG_CONFIG_HOME: dirs.config,
        XDG_DATA_HOME: dirs.data,
        XDG_STATE_HOME: dirs.state,
      },
      stdio: ["pipe", "pipe", "pipe"],
    })
  }

  const exit = async (id: string, session: Active) => {
    await provide(session, async () => {
      if (state().get(id) !== session) return
      session.info.status = "exited"
      send(session)
      state().delete(id)
      session.rpc.close()
      await Bus.publish(Event.Exited, { id, sessionID: session.info.sessionID })
    })
  }

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

  export const SnapshotData = z.object({
    width: z.number(),
    height: z.number(),
    rows: z.array(
      z.array(
        z.object({
          text: z.string(),
          fg: z.string().optional(),
          bg: z.string().optional(),
          bold: z.boolean().optional(),
          italic: z.boolean().optional(),
          underline: z.boolean().optional(),
          strikethrough: z.boolean().optional(),
        }),
      ),
    ),
    mode: z.string(),
    dirty: z.boolean(),
    diff: z.boolean(),
    file: z.string(),
    status: z.string(),
    diagnostics: z.array(
      z.object({
        line: z.number(),
        column: z.number(),
        severity: z.enum(["error", "warning"]),
        message: z.string(),
      }),
    ),
  })

  export const ScopedInput = z.object({
    sessionID: Identifier.schema("session"),
  })

  export const Event = {
    Updated: BusEvent.define("editor.updated", z.object({ info: Info })),
    Exited: BusEvent.define("editor.exited", z.object({ id: z.string(), sessionID: Identifier.schema("session") })),
  }

  export async function supported() {
    const hit = await NvimBundle.ready()
    if (hit) return true
    const error = await NvimBundle.problem()
    if (error) {
      log.warn("bundled neovim unavailable", { error })
    }
    return false
  }

  export async function open(input: z.infer<typeof OpenInput>) {
    const full = path.join(Instance.directory, input.file)
    if (!Instance.containsPath(full)) throw new Error("Access denied: path escapes project directory")
    const process = await spawnEditor(full)
    if (!process) return
    const id = `${Identifier.create("pty", false)}_editor`
    const rpc = NvimRPC.attach(process.stdout, process.stdin)
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
      pid: process.pid ?? 0,
    }
    const session = {
      info,
      directory: Instance.directory,
      view_id: Instance.viewID,
      process,
      rpc,
      ui,
      pending: Promise.resolve(),
      before: await baseline(input.sessionID, input.file),
      diagnostics: [],
      subscribers: new Set<Socket>(),
    } satisfies Active
    state().set(id, session)
    const off = rpc.on("redraw", (params) => {
      const next =
        Array.isArray(params[0]) && Array.isArray((params[0] as unknown[])[0]) ? (params[0] as unknown[]) : params
      if (!ui.redraw(next)) return
      void queue(session, () => update(session, true))
    })
    process.stderr.on("data", (chunk) => {
      const text = Buffer.from(chunk).toString("utf8").trim()
      if (!text) return
      log.debug("stderr", { text })
    })
    process.on("exit", () => {
      off()
      void exit(id, session)
    })
    await attach(session, input.size.cols, input.size.rows)
    await update(session, true)
    return info
  }

  export function get(id: string, input?: z.infer<typeof ScopedInput>) {
    return active(id, input?.sessionID)?.info
  }

  export async function snapshot(id: string, input?: z.infer<typeof ScopedInput>) {
    const session = active(id, input?.sessionID)
    if (!session) return
    return data(session)
  }

  export async function resize(id: string, size: { rows: number; cols: number }, input?: z.infer<typeof ScopedInput>) {
    const session = active(id, input?.sessionID)
    if (!session) return
    await session.rpc.request("nvim_ui_try_resize", [size.cols, size.rows])
    await update(session, true)
    return session.info
  }

  export async function save(id: string, input?: z.infer<typeof ScopedInput>) {
    const session = active(id, input?.sessionID)
    if (!session) return
    await session.rpc.request("nvim_command", ["write"])
    await update(session, true)
    await provide(session, () =>
      Bus.publish(FileWatcher.Event.Updated, {
        file: path.join(Instance.directory, session.info.file),
        event: "change",
      }),
    )
    return session.info
  }

  export async function dismiss(id: string, input?: z.infer<typeof ScopedInput>) {
    const session = active(id, input?.sessionID)
    if (!session) return
    await session.rpc.request("nvim_command", ["diffoff!"])
    await session.rpc.request("nvim_command", ["only"])
    session.info.diff = false
    await update(session, true)
    return session.info
  }

  export async function close(id: string, input?: z.infer<typeof ScopedInput>) {
    const session = active(id, input?.sessionID)
    if (!session) return false
    state().delete(id)
    session.rpc.close()
    session.process.kill()
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
      return update(session, true)
    }
    if (data.type === "focus") {
      await session.rpc.request("nvim_ui_set_focus", [data.gained === true])
      return update(session, false)
    }
    if (data.type === "paste" && typeof data.text === "string") {
      await session.rpc.request("nvim_paste", [data.text, false, -1])
      return update(session, true)
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
      return update(session, false)
    }
    if (data.type === "input" && typeof data.keys === "string") {
      await session.rpc.request("nvim_input", [data.keys])
      return update(session, true)
    }
  }

  export function connect(id: string, ws: Socket, input?: z.infer<typeof ScopedInput>) {
    const session = active(id, input?.sessionID)
    if (!session) return
    session.subscribers.add(ws)
    ws.send(JSON.stringify({ type: "snapshot", snapshot: data(session) }))
    return {
      onMessage(message: string | ArrayBuffer) {
        const text = typeof message === "string" ? message : Buffer.from(message).toString("utf8")
        void queue(session, () => write(session, text))
      },
      onClose() {
        session.subscribers.delete(ws)
      },
    }
  }
}
