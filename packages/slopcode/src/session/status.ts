import { BusEvent } from "@/bus/bus-event"
import { Bus } from "@/bus"
import { Instance } from "@/project/instance"
import z from "zod"

export namespace SessionStatus {
  export const BusyPhase = z.enum(["starting", "running", "compacting"])
  export const Busy = z.object({
    type: z.literal("busy"),
    phase: BusyPhase,
    since: z.number(),
    updated: z.number(),
  })
  export const Retry = z.object({
    type: z.literal("retry"),
    attempt: z.number(),
    message: z.string(),
    next: z.number(),
    since: z.number(),
    updated: z.number(),
  })
  export const Info = z
    .union([
      z.object({
        type: z.literal("idle"),
      }),
      Retry,
      Busy,
    ])
    .meta({
      ref: "SessionStatus",
    })
  export type Info = z.infer<typeof Info>

  export const Event = {
    Status: BusEvent.define(
      "session.status",
      z.object({
        sessionID: z.string(),
        status: Info,
        viewID: z.string().optional(),
      }),
    ),
    // deprecated
    Idle: BusEvent.define(
      "session.idle",
      z.object({
        sessionID: z.string(),
        viewID: z.string().optional(),
      }),
    ),
  }

  const state = Instance.sharedState(() => {
    const data: Record<string, Info> = {}
    return data
  })

  export function get(sessionID: string) {
    return (
      state()[sessionID] ?? {
        type: "idle",
      }
    )
  }

  export function list() {
    return state()
  }

  export function busy(sessionID: string, phase: z.infer<typeof BusyPhase>) {
    const current = get(sessionID)
    const since = current.type === "busy" ? current.since : Date.now()
    set(sessionID, {
      type: "busy",
      phase,
      since,
      updated: Date.now(),
    })
  }

  export function retry(sessionID: string, input: { attempt: number; message: string; next: number }) {
    const current = get(sessionID)
    const since = current.type === "retry" ? current.since : Date.now()
    set(sessionID, {
      type: "retry",
      ...input,
      since,
      updated: Date.now(),
    })
  }

  export function set(sessionID: string, status: Info) {
    Bus.publish(Event.Status, {
      sessionID,
      status,
      viewID: Instance.viewID,
    })
    if (status.type === "idle") {
      // deprecated
      Bus.publish(Event.Idle, {
        sessionID,
        viewID: Instance.viewID,
      })
      delete state()[sessionID]
      return
    }
    state()[sessionID] = status
  }
}
