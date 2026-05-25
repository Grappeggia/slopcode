import { Bus } from "@/bus"
import { Installation } from "@/installation"
import { PermissionNext } from "@/permission/next"
import { Instance } from "@/project/instance"
import { Pty } from "@/pty"
import { Question } from "@/question"
import { SessionStatus } from "@/session/status"
import { Log } from "@/util/log"
import z from "zod"

export namespace DaemonRuntime {
  const log = Log.create({ service: "daemon.runtime" })

  export const PROTOCOL = 1

  export const Status = z.object({
    protocol: z.literal(PROTOCOL),
    version: z.string(),
    directory: z.string(),
    view_id: z.string().optional(),
    pid: z.number().int().positive(),
    started_at: z.number().int().positive(),
    idle_timeout_ms: z.number().int().positive(),
    clients: z.number().int().min(0),
    busy: z.boolean(),
    permissions: z.number().int().min(0),
    questions: z.number().int().min(0),
    pty: z.number().int().min(0),
    shutting_down: z.boolean(),
  })

  const state = {
    clients: 0,
    directory: "",
    view_id: undefined as string | undefined,
    idle_timeout_ms: 30 * 60 * 1000,
    started_at: 0,
    shutting: false,
    timer: undefined as ReturnType<typeof setTimeout> | undefined,
    stop: undefined as (() => Promise<void>) | undefined,
    unsubs: [] as Array<() => void>,
  }

  function clear() {
    if (!state.timer) return
    clearTimeout(state.timer)
    state.timer = undefined
  }

  async function run<T>(fn: () => Promise<T> | T) {
    return Instance.provide({
      directory: state.directory,
      viewID: state.view_id,
      fn,
    })
  }

  async function counts() {
    return run(async () => ({
      clients: state.clients,
      busy: Object.values(SessionStatus.list()).some((item) => item.type !== "idle"),
      permissions: (await PermissionNext.list()).length,
      questions: (await Question.list()).length,
      pty: Pty.list().filter((item) => item.status === "running").length,
    }))
  }

  async function settle() {
    if (!state.stop || state.shutting) return
    const next = await counts()
    if (next.clients > 0 || next.busy || next.permissions > 0 || next.questions > 0 || next.pty > 0) {
      clear()
      return
    }
    if (state.timer) return
    state.timer = setTimeout(async () => {
      state.timer = undefined
      const final = await counts()
      if (final.clients > 0 || final.busy || final.permissions > 0 || final.questions > 0 || final.pty > 0) {
        void settle()
        return
      }
      await shutdown()
    }, state.idle_timeout_ms)
  }

  function watch() {
    state.unsubs.push(
      Bus.subscribe(SessionStatus.Event.Status, () => void settle()),
      Bus.subscribe(PermissionNext.Event.Asked, () => void settle()),
      Bus.subscribe(PermissionNext.Event.Replied, () => void settle()),
      Bus.subscribe(Question.Event.Asked, () => void settle()),
      Bus.subscribe(Question.Event.Replied, () => void settle()),
      Bus.subscribe(Question.Event.Rejected, () => void settle()),
      Bus.subscribe(Pty.Event.Created, () => void settle()),
      Bus.subscribe(Pty.Event.Exited, () => void settle()),
      Bus.subscribe(Pty.Event.Deleted, () => void settle()),
    )
  }

  function cleanup() {
    clear()
    state.unsubs.splice(0).forEach((off) => off())
  }

  export function configure(input: {
    directory: string
    view_id?: string
    idle_timeout_ms: number
    stop: () => Promise<void>
  }) {
    cleanup()
    state.clients = 0
    state.directory = input.directory
    state.view_id = input.view_id
    state.idle_timeout_ms = input.idle_timeout_ms
    state.started_at = Date.now()
    state.shutting = false
    state.stop = input.stop
    watch()
    log.info("configured", {
      directory: input.directory,
      view_id: input.view_id,
      idle_timeout_ms: input.idle_timeout_ms,
    })
    void settle()
  }

  export function connect() {
    state.clients += 1
    clear()
  }

  export function disconnect() {
    state.clients = Math.max(0, state.clients - 1)
    void settle()
  }

  export async function status() {
    const next = await counts()
    return {
      protocol: PROTOCOL,
      version: Installation.VERSION,
      directory: state.directory,
      view_id: state.view_id,
      pid: process.pid,
      started_at: state.started_at,
      idle_timeout_ms: state.idle_timeout_ms,
      clients: next.clients,
      busy: next.busy,
      permissions: next.permissions,
      questions: next.questions,
      pty: next.pty,
      shutting_down: state.shutting,
    }
  }

  export async function shutdown() {
    if (!state.stop || state.shutting) return
    state.shutting = true
    cleanup()
    log.info("shutdown")
    await state.stop()
  }
}
