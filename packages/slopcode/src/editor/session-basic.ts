import { BusEvent } from "@/bus/bus-event"
import { Bus } from "@/bus"
import { Identifier } from "@/id/id"
import { FileWatcher } from "@/file/watcher"
import { Instance } from "@/project/instance"
import { Log } from "@/util/log"
import * as fs from "node:fs/promises"
import * as path from "node:path"
import z from "zod"
import { gutter, render } from "./highlight"
import { lint } from "./lint"
import type { Diagnostic, Snapshot } from "./types"

export namespace EditorSession {
  const log = Log.create({ service: "editor" })

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
    lines: string[]
    row: number
    col: number
    top: number
    left: number
    width: number
    height: number
    diagnostics: Diagnostic[]
    pending: Promise<void>
    rev: number
    subscribers: Set<Socket>
  }

  const state = Instance.state(
    () => new Map<string, Active>(),
    async (items) => {
      await Promise.all(Array.from(items.values()).map((item) => close(item.info.id)))
    },
  )

  const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))

  const split = (text: string) => text.replace(/\r\n?/g, "\n").split("\n")

  const content = (session: Active) => session.lines.join("\n")

  const body = (session: Active) => Math.max(1, session.width - gutter(session.lines.length))

  const active = (id: string, sessionID?: string) => {
    const hit = state().get(id)
    if (!hit) return
    if (sessionID && hit.info.sessionID !== sessionID) return
    return hit
  }

  const viewport = (session: Active) => {
    const maxTop = Math.max(0, session.lines.length - session.height)
    session.top = clamp(session.top, 0, maxTop)
    const width = body(session)
    if (session.row < session.top) session.top = session.row
    if (session.row >= session.top + session.height) session.top = session.row - session.height + 1
    if (session.col < session.left) session.left = session.col
    if (session.col >= session.left + width) session.left = session.col - width + 1
    session.top = clamp(session.top, 0, maxTop)
    session.left = Math.max(0, session.left)
  }

  const cursor = (session: Active, row: number, col: number) => {
    session.row = clamp(row, 0, Math.max(0, session.lines.length - 1))
    session.col = clamp(col, 0, (session.lines[session.row] ?? "").length)
    viewport(session)
  }

  const mutate = (session: Active, next: string[], row: number, col: number) => {
    session.lines = next.length > 0 ? next : [""]
    session.info.dirty = true
    cursor(session, row, col)
  }

  const insert = (session: Active, value: string) => {
    const line = session.lines[session.row] ?? ""
    const part = value.replace(/\r\n?/g, "\n").split("\n")
    if (part.length === 1) {
      const next = [...session.lines]
      next[session.row] = line.slice(0, session.col) + value + line.slice(session.col)
      return mutate(session, next, session.row, session.col + value.length)
    }
    const head = line.slice(0, session.col) + part[0]!
    const tail = part.at(-1)! + line.slice(session.col)
    const next = [...session.lines]
    next.splice(session.row, 1, head, ...part.slice(1, -1), tail)
    mutate(session, next, session.row + part.length - 1, part.at(-1)!.length)
  }

  const backspace = (session: Active) => {
    if (session.col > 0) {
      const line = session.lines[session.row] ?? ""
      const next = [...session.lines]
      next[session.row] = line.slice(0, session.col - 1) + line.slice(session.col)
      return mutate(session, next, session.row, session.col - 1)
    }
    if (session.row === 0) return
    const prev = session.lines[session.row - 1] ?? ""
    const line = session.lines[session.row] ?? ""
    const next = [...session.lines]
    next.splice(session.row - 1, 2, prev + line)
    mutate(session, next, session.row - 1, prev.length)
  }

  const del = (session: Active) => {
    const line = session.lines[session.row] ?? ""
    if (session.col < line.length) {
      const next = [...session.lines]
      next[session.row] = line.slice(0, session.col) + line.slice(session.col + 1)
      return mutate(session, next, session.row, session.col)
    }
    if (session.row >= session.lines.length - 1) return
    const next = [...session.lines]
    next.splice(session.row, 2, line + (session.lines[session.row + 1] ?? ""))
    mutate(session, next, session.row, session.col)
  }

  const page = (session: Active, delta: number) => {
    cursor(session, session.row + delta * Math.max(1, session.height - 1), session.col)
  }

  const scroll = (session: Active, delta: number) => {
    session.top = Math.max(0, session.top + delta)
    viewport(session)
  }

  const inspect = (session: Active) => {
    session.diagnostics = lint(session.info.file, content(session))
  }

  const snapshotData = async (session: Active) => {
    const rows = await render({
      file: session.info.file,
      lines: session.lines,
      row: session.row,
      col: session.col,
      top: session.top,
      left: session.left,
      width: session.width,
      height: session.height,
      diagnostics: session.diagnostics,
    })
    return {
      width: session.width,
      height: session.height,
      rows,
      mode: session.info.mode,
      dirty: session.info.dirty,
      diff: session.info.diff,
      file: session.info.file,
      status: session.info.status,
      diagnostics: session.diagnostics,
    } satisfies Snapshot
  }

  const send = async (session: Active) => {
    const rev = ++session.rev
    const payload = JSON.stringify({ type: "snapshot", snapshot: await snapshotData(session) })
    if (rev !== session.rev) return
    Array.from(session.subscribers).forEach((ws) => {
      if (ws.readyState === 0) return
      if (ws.readyState !== 1) {
        session.subscribers.delete(ws)
        return
      }
      ws.send(payload)
    })
  }

  const provide = async <T>(session: Active, fn: () => Promise<T> | T) => {
    return Instance.provide({
      directory: session.directory,
      viewID: session.view_id,
      fn,
    })
  }

  const update = async (session: Active, full = false) => {
    if (full) inspect(session)
    await send(session)
    await provide(session, () => Bus.publish(Event.Updated, { info: session.info }))
  }

  const exists = async (file: string) =>
    fs
      .access(file)
      .then(() => true)
      .catch(() => false)

  const read = async (file: string) => {
    const full = path.join(Instance.directory, file)
    if (!Instance.containsPath(full)) throw new Error("Access denied: path escapes project directory")
    if (!(await exists(full))) return ""
    const buf = Buffer.from(await Bun.file(full).arrayBuffer())
    if (buf.includes(0)) throw new Error("Binary files are not supported in the embedded editor")
    return buf.toString("utf8").replace(/\r\n?/g, "\n")
  }

  const queue = async (session: Active, fn: () => Promise<void>) => {
    session.pending = session.pending.then(fn, fn)
    return session.pending.catch((error) => {
      log.error("editor operation failed", { error, file: session.info.file })
    })
  }

  const write = async (session: Active, message: string) => {
    const data = JSON.parse(message) as Record<string, unknown>
    if (data.type === "resize") {
      session.height = Math.max(1, Number(data.rows) || session.height)
      session.width = Math.max(8, Number(data.cols) || session.width)
      viewport(session)
      return update(session)
    }
    if (data.type === "focus") return update(session)
    if (data.type === "paste" && typeof data.text === "string") {
      insert(session, data.text)
      return update(session, true)
    }
    if (data.type === "mouse") {
      const action = typeof data.action === "string" ? data.action : "press"
      if (action === "up") {
        scroll(session, -3)
        return update(session)
      }
      if (action === "down") {
        scroll(session, 3)
        return update(session)
      }
      const row = session.top + Math.max(0, Number(data.row) || 0)
      const col = session.left + Math.max(0, (Number(data.col) || 0) - gutter(session.lines.length))
      cursor(session, row, col)
      return update(session)
    }
    if (data.type === "input" && typeof data.keys === "string") {
      const key = data.keys
      if (key === "<Left>") cursor(session, session.row, session.col - 1)
      else if (key === "<Right>") cursor(session, session.row, session.col + 1)
      else if (key === "<Up>") cursor(session, session.row - 1, session.col)
      else if (key === "<Down>") cursor(session, session.row + 1, session.col)
      else if (key === "<Home>") cursor(session, session.row, 0)
      else if (key === "<End>") cursor(session, session.row, (session.lines[session.row] ?? "").length)
      else if (key === "<PageUp>") page(session, -1)
      else if (key === "<PageDown>") page(session, 1)
      else if (key === "<BS>") backspace(session)
      else if (key === "<Del>") del(session)
      else if (key === "<CR>") insert(session, "\n")
      else if (key === "<Tab>") insert(session, "  ")
      else if (key === "<LT>") insert(session, "<")
      else if (!key.startsWith("<")) insert(session, key)
      return update(session, !key.startsWith("<") || ["<BS>", "<Del>", "<CR>", "<Tab>"].includes(key))
    }
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

  export async function open(input: z.infer<typeof OpenInput>) {
    const info: z.infer<typeof Info> = {
      id: `${Identifier.create("pty", false)}_editor`,
      sessionID: input.sessionID,
      file: input.file,
      cwd: Instance.directory,
      status: "running",
      dirty: false,
      diff: false,
      mode: "EDIT",
      pid: 0,
    }
    const session: Active = {
      info,
      directory: Instance.directory,
      view_id: Instance.viewID,
      lines: split(await read(input.file)),
      row: 0,
      col: 0,
      top: 0,
      left: 0,
      width: input.size.cols,
      height: input.size.rows,
      diagnostics: [],
      pending: Promise.resolve(),
      rev: 0,
      subscribers: new Set(),
    }
    inspect(session)
    viewport(session)
    state().set(info.id, session)
    await update(session)
    return info
  }

  export function get(id: string, input?: z.infer<typeof ScopedInput>) {
    return active(id, input?.sessionID)?.info
  }

  export async function snapshot(id: string, input?: z.infer<typeof ScopedInput>) {
    const session = active(id, input?.sessionID)
    if (!session) return
    return snapshotData(session)
  }

  export async function resize(id: string, size: { rows: number; cols: number }, input?: z.infer<typeof ScopedInput>) {
    const session = active(id, input?.sessionID)
    if (!session) return
    session.height = Math.max(1, size.rows)
    session.width = Math.max(8, size.cols)
    viewport(session)
    await update(session)
    return session.info
  }

  export async function save(id: string, input?: z.infer<typeof ScopedInput>) {
    const session = active(id, input?.sessionID)
    if (!session) return
    const full = path.join(Instance.directory, session.info.file)
    if (!Instance.containsPath(full)) throw new Error("Access denied: path escapes project directory")
    await Bun.write(full, content(session))
    session.info.dirty = false
    inspect(session)
    await update(session)
    await provide(session, () => Bus.publish(FileWatcher.Event.Updated, { file: full, event: "change" }))
    return session.info
  }

  export async function dismiss(id: string, input?: z.infer<typeof ScopedInput>) {
    const session = active(id, input?.sessionID)
    if (!session) return
    session.info.diff = false
    await update(session)
    return session.info
  }

  export async function close(id: string, input?: z.infer<typeof ScopedInput>) {
    const session = active(id, input?.sessionID)
    if (!session) return false
    session.info.status = "exited"
    await send(session)
    state().delete(id)
    await provide(session, () => Bus.publish(Event.Exited, { id, sessionID: session.info.sessionID }))
    return true
  }

  export function connect(id: string, ws: Socket, input?: z.infer<typeof ScopedInput>) {
    const session = active(id, input?.sessionID)
    if (!session) {
      ws.close()
      return
    }
    session.subscribers.add(ws)
    setTimeout(() => {
      void send(session)
    }, 0)
    return {
      onMessage(message: string | ArrayBuffer) {
        const next = typeof message === "string" ? message : Buffer.from(message).toString("utf8")
        void queue(session, () => write(session, next))
      },
      onClose() {
        session.subscribers.delete(ws)
      },
    }
  }
}
