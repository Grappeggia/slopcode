import { BusEvent } from "@/bus/bus-event"
import { Bus } from "@/bus"
import { type IPty } from "bun-pty"
import z from "zod"
import { spawn as child } from "node:child_process"
import { Identifier } from "../id/id"
import { Log } from "../util/log"
import { Instance } from "../project/instance"
import { lazy } from "@slopcode-ai/util/lazy"
import { Shell } from "@/shell/shell"
import { Plugin } from "@/plugin"
import { Env } from "@/env"
import { Config } from "@/config/config"

export namespace Pty {
  const log = Log.create({ service: "pty" })

  const BUFFER_LIMIT = 1024 * 1024 * 2
  const BUFFER_CHUNK = 64 * 1024
  const encoder = new TextEncoder()

  type Socket = {
    readyState: number
    data?: unknown
    send: (data: string | Uint8Array | ArrayBuffer) => void
    close: (code?: number, reason?: string) => void
  }

  // WebSocket control frame: 0x00 + UTF-8 JSON.
  const meta = (cursor: number) => {
    const json = JSON.stringify({ cursor })
    const bytes = encoder.encode(json)
    const out = new Uint8Array(bytes.length + 1)
    out[0] = 0
    out.set(bytes, 1)
    return out
  }

  function emitter<T>() {
    const listeners = new Set<(data: T) => void>()
    return {
      event(listener: (data: T) => void) {
        listeners.add(listener)
        return {
          dispose() {
            listeners.delete(listener)
          },
        }
      },
      fire(data: T) {
        for (const listener of listeners) listener(data)
      },
    }
  }

  function piped(command: string, args: string[], options: import("bun-pty").IPtyForkOptions): IPty {
    const proc = child(command, args, {
      cwd: options.cwd,
      env: options.env,
      stdio: "pipe",
    })
    const data = emitter<string>()
    const exit = emitter<{ exitCode: number; signal?: number | string }>()
    const size = {
      cols: options.cols ?? 80,
      rows: options.rows ?? 24,
    }

    proc.stdout?.on("data", (chunk) => data.fire(String(chunk)))
    proc.stderr?.on("data", (chunk) => data.fire(String(chunk)))
    proc.on("exit", (code, signal) => exit.fire({ exitCode: code ?? 0, signal: signal ?? undefined }))

    return {
      get pid() {
        return proc.pid ?? 0
      },
      get cols() {
        return size.cols
      },
      get rows() {
        return size.rows
      },
      get process() {
        return command
      },
      onData: data.event,
      onExit: exit.event,
      write(input: string) {
        proc.stdin?.write(input)
      },
      resize(cols: number, rows: number) {
        size.cols = cols
        size.rows = rows
      },
      kill(signal?: string) {
        proc.kill(signal as NodeJS.Signals | undefined)
      },
    }
  }
  const pty = lazy(async () => {
    if (process.platform === "android") return piped
    const { spawn } = await import("bun-pty").catch((error) => {
      if (process.env.TERMUX_VERSION) return { spawn: piped }
      throw error
    })
    return spawn
  })

  export const Info = z
    .object({
      id: Identifier.schema("pty"),
      title: z.string(),
      command: z.string(),
      args: z.array(z.string()),
      cwd: z.string(),
      status: z.enum(["running", "exited"]),
      pid: z.number(),
      sessionID: Identifier.schema("session").optional(),
    })
    .meta({ ref: "Pty" })

  export type Info = z.infer<typeof Info>

  export const AccessInput = z.object({
    sessionID: Identifier.schema("session").optional(),
  })

  export type AccessInput = z.infer<typeof AccessInput>

  export const ScopedInput = z.object({
    sessionID: Identifier.schema("session"),
  })

  export type ScopedInput = z.infer<typeof ScopedInput>

  export const CreateInput = z.object({
    command: z.string().optional(),
    args: z.array(z.string()).optional(),
    cwd: z.string().optional(),
    title: z.string().optional(),
    env: z.record(z.string(), z.string()).optional(),
    sessionID: Identifier.schema("session"),
  })

  export type CreateInput = z.infer<typeof CreateInput>

  export const UpdateInput = z.object({
    title: z.string().optional(),
    size: z
      .object({
        rows: z.number(),
        cols: z.number(),
      })
      .optional(),
  })

  export type UpdateInput = z.infer<typeof UpdateInput>

  export const Event = {
    Created: BusEvent.define("pty.created", z.object({ info: Info })),
    Updated: BusEvent.define("pty.updated", z.object({ info: Info })),
    Exited: BusEvent.define(
      "pty.exited",
      z.object({ id: Identifier.schema("pty"), exitCode: z.number(), sessionID: Identifier.schema("session") }),
    ),
    Deleted: BusEvent.define(
      "pty.deleted",
      z.object({ id: Identifier.schema("pty"), sessionID: Identifier.schema("session") }),
    ),
  }

  interface ActiveSession {
    info: Info
    process: IPty
    buffer: string
    bufferCursor: number
    cursor: number
    subscribers: Map<unknown, Socket>
    idle_timeout_ms: number
    idle?: ReturnType<typeof setTimeout>
  }

  function allowed(info: Info, sessionID?: string) {
    if (sessionID === undefined) return true
    return info.sessionID === sessionID
  }

  function clear(session: ActiveSession) {
    if (!session.idle) return
    clearTimeout(session.idle)
    session.idle = undefined
  }

  function schedule(id: string, session: ActiveSession) {
    clear(session)
    if (session.subscribers.size > 0) return
    if (session.info.status !== "running") return
    session.idle = setTimeout(() => {
      if (state().get(id) !== session) return
      if (session.subscribers.size > 0) return
      log.info("removing idle session", { id, timeout: session.idle_timeout_ms })
      void remove(id)
    }, session.idle_timeout_ms)
  }

  function touch(id: string, session: ActiveSession) {
    if (session.subscribers.size > 0) {
      clear(session)
      return
    }
    schedule(id, session)
  }

  function close(session: ActiveSession) {
    for (const [key, ws] of session.subscribers.entries()) {
      try {
        if (ws.data === key) ws.close()
      } catch {
        // ignore
      }
    }
    session.subscribers.clear()
  }

  const state = Instance.state(
    () => new Map<string, ActiveSession>(),
    async (sessions) => {
      for (const session of sessions.values()) {
        clear(session)
        try {
          session.process.kill()
        } catch {}
        close(session)
      }
      sessions.clear()
    },
  )

  export function list(input?: AccessInput) {
    return Array.from(state().values())
      .map((session) => session.info)
      .filter((info) => allowed(info, input?.sessionID))
  }

  export function get(id: string, input?: AccessInput) {
    const info = state().get(id)?.info
    if (!info) return
    if (!allowed(info, input?.sessionID)) return
    return info
  }

  export async function create(input: CreateInput) {
    const id = Identifier.create("pty", false)
    const cfg = await Config.get()
    const command = input.command || Shell.preferred(cfg.shell?.program)
    const args = input.args || []
    if (Shell.posix(command)) {
      args.push("-l")
    }

    const cwd = input.cwd || Instance.directory
    if (input.sessionID && input.env) {
      Env.merge(input.env, { sessionID: input.sessionID })
    }
    const shellEnv = await Plugin.trigger("shell.env", { cwd, sessionID: input.sessionID }, { env: {} })
    const idle_timeout_ms = cfg.pty?.idle_timeout_ms ?? 10 * 60 * 1000
    const env = {
      ...Env.all({ sessionID: input.sessionID }),
      ...input.env,
      ...shellEnv.env,
      TERM: "xterm-256color",
      SLOPCODE_TERMINAL: "1",
    } as Record<string, string>

    if (process.platform === "win32") {
      env.LC_ALL = "C.UTF-8"
      env.LC_CTYPE = "C.UTF-8"
      env.LANG = "C.UTF-8"
    }
    log.info("creating session", { id, cmd: command, args, cwd })

    const spawn = await pty()
    const ptyProcess = spawn(command, args, {
      name: "xterm-256color",
      cwd,
      env,
    })

    const info = {
      id,
      title: input.title || `Terminal ${id.slice(-4)}`,
      command,
      args,
      cwd,
      status: "running",
      pid: ptyProcess.pid,
      sessionID: input.sessionID,
    } as const
    const session: ActiveSession = {
      info,
      process: ptyProcess,
      buffer: "",
      bufferCursor: 0,
      cursor: 0,
      subscribers: new Map(),
      idle_timeout_ms,
    }
    state().set(id, session)
    schedule(id, session)
    ptyProcess.onData((chunk) => {
      touch(id, session)
      session.cursor += chunk.length

      for (const [key, ws] of session.subscribers.entries()) {
        if (ws.readyState !== 1) {
          session.subscribers.delete(key)
          continue
        }

        if (ws.data !== key) {
          session.subscribers.delete(key)
          continue
        }

        try {
          ws.send(chunk)
        } catch {
          session.subscribers.delete(key)
        }
      }

      session.buffer += chunk
      if (session.buffer.length <= BUFFER_LIMIT) return
      const excess = session.buffer.length - BUFFER_LIMIT
      session.buffer = session.buffer.slice(excess)
      session.bufferCursor += excess
    })
    ptyProcess.onExit(({ exitCode }) => {
      if (state().get(id) !== session) return
      log.info("session exited", { id, exitCode })
      clear(session)
      session.info.status = "exited"
      close(session)
      Bus.publish(Event.Exited, { id, exitCode, sessionID: session.info.sessionID! })
      state().delete(id)
    })
    Bus.publish(Event.Created, { info })
    return info
  }

  export async function update(id: string, input: UpdateInput, access?: AccessInput) {
    const session = state().get(id)
    if (!session) return
    if (!allowed(session.info, access?.sessionID)) return
    if (input.title) {
      session.info.title = input.title
    }
    if (input.size) {
      session.process.resize(input.size.cols, input.size.rows)
    }
    touch(id, session)
    Bus.publish(Event.Updated, { info: session.info })
    return session.info
  }

  export async function remove(id: string, access?: AccessInput) {
    const session = state().get(id)
    if (!session) return
    if (!allowed(session.info, access?.sessionID)) return
    log.info("removing session", { id })
    clear(session)
    try {
      session.process.kill()
    } catch {}
    close(session)
    state().delete(id)
    Bus.publish(Event.Deleted, { id, sessionID: session.info.sessionID! })
  }

  export function resize(id: string, cols: number, rows: number) {
    const session = state().get(id)
    if (session && session.info.status === "running") {
      session.process.resize(cols, rows)
      touch(id, session)
    }
  }

  export function write(id: string, data: string) {
    const session = state().get(id)
    if (session && session.info.status === "running") {
      session.process.write(data)
      touch(id, session)
    }
  }

  export function connect(id: string, ws: Socket, cursor?: number, access?: AccessInput) {
    const session = state().get(id)
    if (!session || !allowed(session.info, access?.sessionID)) {
      ws.close()
      return
    }
    log.info("client connected to session", { id })

    // Use ws.data as the unique key for this connection lifecycle.
    // If ws.data is undefined, fallback to ws object.
    const connectionKey = ws.data && typeof ws.data === "object" ? ws.data : ws

    // Optionally cleanup if the key somehow exists
    session.subscribers.delete(connectionKey)
    session.subscribers.set(connectionKey, ws)
    clear(session)

    const cleanup = () => {
      session.subscribers.delete(connectionKey)
    }

    const start = session.bufferCursor
    const end = session.cursor

    const from =
      cursor === -1 ? end : typeof cursor === "number" && Number.isSafeInteger(cursor) ? Math.max(0, cursor) : 0

    const data = (() => {
      if (!session.buffer) return ""
      if (from >= end) return ""
      const offset = Math.max(0, from - start)
      if (offset >= session.buffer.length) return ""
      return session.buffer.slice(offset)
    })()

    if (data) {
      try {
        for (let i = 0; i < data.length; i += BUFFER_CHUNK) {
          ws.send(data.slice(i, i + BUFFER_CHUNK))
        }
      } catch {
        cleanup()
        ws.close()
        return
      }
    }

    try {
      ws.send(meta(end))
    } catch {
      cleanup()
      ws.close()
      return
    }
    return {
      onMessage: (message: string | ArrayBuffer) => {
        session.process.write(String(message))
        touch(id, session)
      },
      onClose: () => {
        log.info("client disconnected from session", { id })
        cleanup()
        touch(id, session)
      },
    }
  }
}
