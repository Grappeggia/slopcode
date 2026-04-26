import { Bus } from "@/bus"
import { BusEvent } from "@/bus/bus-event"
import { Config } from "@/config/config"
import { Identifier } from "@/id/id"
import { Instance } from "@/project/instance"
import { Database, eq } from "@/storage/db"
import { PermissionTable } from "@/session/session.sql"
import { fn } from "@/util/fn"
import { Log } from "@/util/log"
import { Wildcard } from "@/util/wildcard"
import os from "os"
import z from "zod"

export namespace PermissionNext {
  const log = Log.create({ service: "permission" })

  function expand(pattern: string): string {
    if (pattern.startsWith("~/")) return os.homedir() + pattern.slice(1)
    if (pattern === "~") return os.homedir()
    if (pattern.startsWith("$HOME/")) return os.homedir() + pattern.slice(5)
    if (pattern.startsWith("$HOME")) return os.homedir() + pattern.slice(5)
    return pattern
  }

  export const Action = z.enum(["allow", "deny", "ask"]).meta({
    ref: "PermissionAction",
  })
  export type Action = z.infer<typeof Action>

  export const Rule = z
    .object({
      permission: z.string(),
      pattern: z.string(),
      action: Action,
    })
    .meta({
      ref: "PermissionRule",
    })
  export type Rule = z.infer<typeof Rule>

  export const Ruleset = Rule.array().meta({
    ref: "PermissionRuleset",
  })
  export type Ruleset = z.infer<typeof Ruleset>

  export const Kind = z.enum(["blocking", "forecast"]).meta({
    ref: "PermissionKind",
  })
  export type Kind = z.infer<typeof Kind>

  export function fromConfig(permission: Config.Permission) {
    const ruleset: Ruleset = []
    for (const [key, value] of Object.entries(permission)) {
      if (typeof value === "string") {
        ruleset.push({
          permission: key,
          action: value,
          pattern: "*",
        })
        continue
      }
      ruleset.push(
        ...Object.entries(value).map(([pattern, action]) => ({ permission: key, pattern: expand(pattern), action })),
      )
    }
    return ruleset
  }

  export function merge(...rulesets: Ruleset[]): Ruleset {
    return rulesets.flat()
  }

  export const Request = z
    .object({
      id: Identifier.schema("permission"),
      sessionID: Identifier.schema("session"),
      permission: z.string(),
      patterns: z.string().array(),
      metadata: z.record(z.string(), z.any()),
      always: z.string().array(),
      kind: Kind.optional(),
      reason: z.string().optional(),
      tool: z
        .object({
          messageID: z.string(),
          callID: z.string(),
        })
        .optional(),
    })
    .meta({
      ref: "PermissionRequest",
    })

  export type Request = z.infer<typeof Request>

  export const Candidate = z.object({
    permission: z.string(),
    patterns: z.string().array(),
    always: z.string().array().optional(),
    metadata: z.record(z.string(), z.any()).optional(),
    reason: z.string().optional(),
  })
  export type Candidate = z.infer<typeof Candidate>

  export const Reply = z.enum(["once", "always", "reject"])
  export type Reply = z.infer<typeof Reply>

  export const Approval = z.object({
    projectID: z.string(),
    patterns: z.string().array(),
  })

  export const Event = {
    Asked: BusEvent.define("permission.asked", Request.extend({ viewID: z.string().optional() })),
    Replied: BusEvent.define(
      "permission.replied",
      z.object({
        sessionID: z.string(),
        requestID: z.string(),
        reply: Reply,
        viewID: z.string().optional(),
      }),
    ),
  }

  const state = Instance.state(() => {
    const projectID = Instance.project.id
    const row = Database.use((db) =>
      db.select().from(PermissionTable).where(eq(PermissionTable.project_id, projectID)).get(),
    )
    const stored = row?.data ?? ([] as Ruleset)

    const pending: Record<
      string,
      {
        info: Request
        resolve: () => void
        reject: (e: any) => void
      }
    > = {}
    const forecast: Record<string, Request[]> = {}
    const granted: Array<{
      sessionID: string
      permission: string
      pattern: string
    }> = []

    return {
      pending,
      forecast,
      granted,
      approved: stored,
    }
  })

  function consume(
    granted: Array<{
      sessionID: string
      permission: string
      pattern: string
    }>,
    sessionID: string,
    permission: string,
    patterns: string[],
  ) {
    const match = patterns.map((pattern) =>
      granted.findIndex(
        (item) =>
          item.sessionID === sessionID &&
          Wildcard.match(permission, item.permission) &&
          Wildcard.match(pattern, item.pattern),
      ),
    )
    if (match.some((item) => item === -1)) return false
    Array.from(new Set(match))
      .toSorted((a, b) => b - a)
      .forEach((item) => {
        granted.splice(item, 1)
      })
    return true
  }

  export const ask = fn(
    Request.partial({ id: true }).extend({
      ruleset: Ruleset,
    }),
    async (input) => {
      const s = await state()
      const { ruleset, ...request } = input
      const patterns = [] as string[]
      for (const pattern of request.patterns ?? []) {
        const rule = evaluate(request.permission, pattern, ruleset, s.approved)
        log.info("evaluated", { permission: request.permission, pattern, action: rule })
        if (rule.action === "deny")
          throw new DeniedError(ruleset.filter((r) => Wildcard.match(request.permission, r.permission)))
        if (rule.action === "ask") patterns.push(pattern)
      }
      if (patterns.length === 0) return
      if (consume(s.granted, request.sessionID, request.permission, patterns)) return
      const id = input.id ?? Identifier.ascending("permission")
      return new Promise<void>((resolve, reject) => {
        const info: Request = {
          id,
          ...request,
          patterns,
          kind: request.kind ?? "blocking",
        }
        s.pending[id] = {
          info,
          resolve,
          reject,
        }
        Bus.publish(Event.Asked, { ...info, viewID: Instance.viewID })
      })
    },
  )

  export const forecast = fn(
    z.object({
      sessionID: Identifier.schema("session"),
      ruleset: Ruleset,
      requests: Candidate.array(),
    }),
    async (input) => {
      const s = await state()
      const list = s.forecast[input.sessionID] ?? []
      const next = input.requests.flatMap((item) => {
        const patterns = item.patterns.filter(
          (pattern) => evaluate(item.permission, pattern, input.ruleset, s.approved).action === "ask",
        )
        if (patterns.length === 0) return []
        const always = (item.always ?? patterns).filter((pattern, index, array) => array.indexOf(pattern) === index)
        return [
          {
            id: Identifier.ascending("permission"),
            sessionID: input.sessionID,
            permission: item.permission,
            patterns,
            always,
            metadata: item.metadata ?? {},
            kind: "forecast" as const,
            reason: item.reason,
          } as Request,
        ]
      })
      for (const item of next) {
        const key = JSON.stringify([item.permission, item.patterns, item.always, item.reason])
        const index = list.findIndex(
          (existing) =>
            JSON.stringify([existing.permission, existing.patterns, existing.always, existing.reason]) === key,
        )
        if (index === -1) {
          list.push(item)
          continue
        }
        list[index] = {
          ...item,
          id: list[index].id,
        }
      }
      if (list.length === 0) {
        delete s.forecast[input.sessionID]
        return [] as Request[]
      }
      s.forecast[input.sessionID] = list
      return list
    },
  )

  export const review = fn(
    z.object({
      sessionID: Identifier.schema("session"),
      tool: Request.shape.tool.optional(),
    }),
    async (input) => {
      const s = await state()
      const list = s.forecast[input.sessionID] ?? []
      if (list.length === 0) return false
      delete s.forecast[input.sessionID]
      await Promise.all(
        list.map((info) =>
          new Promise<void>((resolve, reject) => {
            s.pending[info.id] = {
              info: {
                ...info,
                tool: input.tool,
              },
              resolve,
              reject,
            }
            Bus.publish(Event.Asked, { ...info, tool: input.tool, viewID: Instance.viewID })
          }).catch(() => undefined),
        ),
      )
      return true
    },
  )

  export const reply = fn(
    z.object({
      requestID: Identifier.schema("permission"),
      reply: Reply,
      message: z.string().optional(),
      sessionID: Identifier.schema("session").optional(),
    }),
    async (input) => {
      const s = await state()
      const existing = s.pending[input.requestID]
      if (!existing) return false
      if (input.sessionID && existing.info.sessionID !== input.sessionID) return false
      delete s.pending[input.requestID]
      Bus.publish(Event.Replied, {
        sessionID: existing.info.sessionID,
        requestID: existing.info.id,
        reply: input.reply,
        viewID: Instance.viewID,
      })
      if (input.reply === "reject") {
        if (existing.info.kind === "forecast") {
          existing.reject(input.message ? new CorrectedError(input.message) : new RejectedError())
          return true
        }
        existing.reject(input.message ? new CorrectedError(input.message) : new RejectedError())
        // Reject all other pending permissions for this session
        const sessionID = existing.info.sessionID
        for (const [id, pending] of Object.entries(s.pending)) {
          if (pending.info.sessionID === sessionID) {
            delete s.pending[id]
            Bus.publish(Event.Replied, {
              sessionID: pending.info.sessionID,
              requestID: pending.info.id,
              reply: "reject",
              viewID: Instance.viewID,
            })
            pending.reject(new RejectedError())
          }
        }
        return true
      }
      if (input.reply === "once") {
        if (existing.info.kind === "forecast") {
          existing.info.patterns.forEach((pattern) => {
            s.granted.push({
              sessionID: existing.info.sessionID,
              permission: existing.info.permission,
              pattern,
            })
          })
        }
        existing.resolve()
        return true
      }
      if (input.reply === "always") {
        for (const pattern of existing.info.always.length > 0 ? existing.info.always : existing.info.patterns) {
          s.approved.push({
            permission: existing.info.permission,
            pattern,
            action: "allow",
          })
        }

        existing.resolve()

        const sessionID = existing.info.sessionID
        for (const [id, pending] of Object.entries(s.pending)) {
          if (pending.info.sessionID !== sessionID) continue
          const ok = pending.info.patterns.every(
            (pattern) => evaluate(pending.info.permission, pattern, s.approved).action === "allow",
          )
          if (!ok) continue
          delete s.pending[id]
          Bus.publish(Event.Replied, {
            sessionID: pending.info.sessionID,
            requestID: pending.info.id,
            reply: "always",
            viewID: Instance.viewID,
          })
          pending.resolve()
        }

        // TODO: we don't save the permission ruleset to disk yet until there's
        // UI to manage it
        // db().insert(PermissionTable).values({ projectID: Instance.project.id, data: s.approved })
        //   .onConflictDoUpdate({ target: PermissionTable.projectID, set: { data: s.approved } }).run()
        return true
      }
      return true
    },
  )

  export function evaluate(permission: string, pattern: string, ...rulesets: Ruleset[]): Rule {
    const merged = merge(...rulesets)
    log.info("evaluate", { permission, pattern, ruleset: merged })
    const match = merged.findLast(
      (rule) => Wildcard.match(permission, rule.permission) && Wildcard.match(pattern, rule.pattern),
    )
    return match ?? { action: "ask", permission, pattern: "*" }
  }

  const EDIT_TOOLS = ["edit", "write", "patch", "multiedit"]

  export function disabled(tools: string[], ruleset: Ruleset): Set<string> {
    const result = new Set<string>()
    for (const tool of tools) {
      const permission = EDIT_TOOLS.includes(tool) ? "edit" : tool

      const rule = ruleset.findLast((r) => Wildcard.match(permission, r.permission))
      if (!rule) continue
      if (rule.pattern === "*" && rule.action === "deny") result.add(tool)
    }
    return result
  }

  /** User rejected without message - halts execution */
  export class RejectedError extends Error {
    constructor() {
      super(`The user rejected permission to use this specific tool call.`)
    }
  }

  /** User rejected with message - continues with guidance */
  export class CorrectedError extends Error {
    constructor(message: string) {
      super(`The user rejected permission to use this specific tool call with the following feedback: ${message}`)
    }
  }

  /** Auto-rejected by config rule - halts execution */
  export class DeniedError extends Error {
    constructor(public readonly ruleset: Ruleset) {
      super(
        `The user has specified a rule which prevents you from using this specific tool call. Here are some of the relevant rules ${JSON.stringify(ruleset)}`,
      )
    }
  }

  export async function list(input?: { sessionID?: string }) {
    const s = await state()
    const list = Object.values(s.pending).map((x) => x.info)
    if (!input?.sessionID) return list
    return list.filter((item) => item.sessionID === input.sessionID)
  }
}
