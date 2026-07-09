import { LayerNode } from "@slopcode-ai/core/effect/layer-node"
import { Database } from "@slopcode-ai/core/database/database"
import { Memory as CoreMemory } from "@slopcode-ai/core/memory"
import { MemoryTable } from "@slopcode-ai/core/memory/sql"
import { ProjectTable } from "@slopcode-ai/core/project/sql"
import { AbsolutePath } from "@slopcode-ai/core/schema"
import { Hash } from "@slopcode-ai/core/util/hash"
import { SessionV1 } from "@slopcode-ai/core/v1/session"
import { Agent } from "@/agent/agent"
import { Config } from "@/config/config"
import { InstanceState } from "@/effect/instance-state"
import { LLM } from "@/session/llm"
import { Provider } from "@/provider/provider"
import type { Info as SessionInfo } from "@/session/session"
import { Context, Effect, Layer } from "effect"
import * as Stream from "effect/Stream"
import { and, desc, eq, inArray, isNull } from "drizzle-orm"
import { LLMEvent } from "@slopcode-ai/llm"
import PROMPT_MEMORY from "@/agent/prompt/memory.txt"

export const Info = CoreMemory.Info
export const CreateInput = CoreMemory.CreateInput
export const UpdateInput = CoreMemory.UpdateInput
export const ListQuery = CoreMemory.ListQuery
export const Scope = CoreMemory.Scope
export const ID = CoreMemory.ID
export type Info = CoreMemory.Info
export type CreateInput = CoreMemory.CreateInput
export type UpdateInput = CoreMemory.UpdateInput
export type Scope = CoreMemory.Scope
export type ID = CoreMemory.ID

type Settings = {
  status: "enabled" | "disabled"
}

type PutInput = {
  content: string
  scope?: Scope
  enabled?: boolean
  projectID?: SessionInfo["projectID"]
  sourceSessionID?: SessionInfo["id"]
  sourceMessageID?: SessionV1.MessageID
}

export interface Interface {
  readonly enabled: (session: SessionInfo) => Effect.Effect<boolean>
  readonly list: (input?: CoreMemory.ListQuery) => Effect.Effect<CoreMemory.Info[]>
  readonly select: (input: { session: SessionInfo; limit?: number }) => Effect.Effect<CoreMemory.Info[]>
  readonly create: (input: CoreMemory.CreateInput) => Effect.Effect<CoreMemory.Info | undefined>
  readonly update: (id: CoreMemory.ID, input: CoreMemory.UpdateInput) => Effect.Effect<CoreMemory.Info | undefined>
  readonly remove: (id: CoreMemory.ID) => Effect.Effect<void>
  readonly extract: (input: { session: SessionInfo; messages: SessionV1.WithParts[] }) => Effect.Effect<void>
}

export class Service extends Context.Service<Service, Interface>()("@slopcode/Memory") {}

export function settings(input: unknown): Settings | undefined {
  if (!input || typeof input !== "object") return
  const item = input as Record<string, unknown>
  if (item.status === "enabled" || item.status === "disabled") return { status: item.status }
}

export function isEnabled(cfg: { memory?: { enabled?: boolean } }, session: SessionInfo) {
  const current = settings(session.metadata?.memory)
  if (current?.status === "enabled") return true
  if (current?.status === "disabled") return false
  return cfg.memory?.enabled === true
}

export function redact(input: string) {
  return input
    .replace(
      /((["']?)\b(?:_*(?:[a-z0-9]+[_-])*(?:api[_-]?key|auth[_-]?token|token|secret|password|passwd|pwd|private[_-]?key|access[_-]?key(?:[_-]?id)?)|[a-z0-9]*(?:secretAccessKey|accessKey(?:Id)?|sessionToken|accessToken|refreshToken|idToken|apiKey|authToken|privateKey|clientSecret|clientToken))\2\s*[:=]\s*)(?:"([^"]*)"|'([^']*)'|[^\s"',;}\]]+)/gi,
      (_match: string, prefix: string, _quote: string, double: string | undefined, single: string | undefined) =>
        prefix + (double !== undefined ? '"[redacted]"' : single !== undefined ? "'[redacted]'" : "[redacted]"),
    )
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]{12,}/gi, "Bearer [redacted]")
    .replace(/\b(?:sk|pk|rk|ghp|gho|ghu|ghs|glpat|xox[baprs])[-_][A-Za-z0-9_-]{16,}\b/g, "[redacted]")
    .replace(/\bgithub_pat_[A-Za-z0-9_]{20,}\b/g, "[redacted]")
    .replace(/\bnpm_[A-Za-z0-9]{20,}\b/g, "[redacted]")
    .replace(/\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g, "[redacted]")
}

function normalize(input: string) {
  return input.trim().replace(/\s+/g, " ")
}

function content(input: string) {
  const clean = normalize(redact(input))
  if (clean.length < 12 || clean.length > 500) return
  if (!/[A-Za-z]/.test(clean)) return
  if (/^(ok|yes|no|thanks|thank you)[.!]?$/i.test(clean)) return
  if (/^\[redacted\][.!]?$/i.test(clean)) return
  return clean
}

function hash(input: string) {
  return Hash.sha256(normalize(input).toLowerCase())
}

function fromRow(row: typeof MemoryTable.$inferSelect): CoreMemory.Info {
  return {
    id: row.id,
    scope: row.scope,
    projectID: row.project_id ?? undefined,
    content: row.content,
    enabled: row.enabled,
    sourceSessionID: row.source_session_id ?? undefined,
    sourceMessageID: row.source_message_id ?? undefined,
    time: {
      created: row.time_created,
      updated: row.time_updated,
      accessed: row.time_accessed ?? undefined,
    },
  }
}

function visibleText(message: SessionV1.WithParts) {
  return message.parts
    .flatMap((part) => {
      if (part.type !== "text") return []
      if (part.synthetic || part.ignored) return []
      const text = part.text.trim()
      return text ? [text] : []
    })
    .join("\n")
}

function assistantText(message: SessionV1.WithParts) {
  return message.parts
    .flatMap((part) => (part.type === "text" && part.text.trim() ? [part.text.trim()] : []))
    .join("\n")
}

function latest(messages: SessionV1.WithParts[]) {
  const assistant = messages.findLast((message) => {
    if (message.info.role !== "assistant") return false
    if (message.info.summary || message.info.error) return false
    return !!message.info.finish && !["tool-calls", "unknown"].includes(message.info.finish)
  })
  if (!assistant || assistant.info.role !== "assistant") return
  const parentID = assistant.info.parentID
  const user = messages.findLast((message) => message.info.role === "user" && message.info.id === parentID)
  if (!user || user.info.role !== "user") return
  const prompt = visibleText(user)
  const answer = assistantText(assistant)
  if (!prompt || !answer) return
  return { user: user.info, prompt, answer, messageID: assistant.info.parentID }
}

function prompt(input: { prompt: string; answer: string }) {
  return [
    "Extract only durable memories from this completed turn.",
    "",
    "<user>",
    input.prompt.slice(-4_000),
    "</user>",
    "",
    "<assistant>",
    input.answer.slice(-4_000),
    "</assistant>",
  ].join("\n")
}

function candidates(input: string) {
  const clean = input.replace(/```(?:json)?/gi, "").replace(/```/g, "")
  const start = clean.indexOf("{")
  const end = clean.lastIndexOf("}")
  if (start === -1 || end === -1 || end <= start) return []
  try {
    const parsed = JSON.parse(clean.slice(start, end + 1)) as Record<string, unknown>
    const list = Array.isArray(parsed.memories) ? parsed.memories : []
    return list.flatMap((item) => {
      if (!item || typeof item !== "object") return []
      const candidate = item as Record<string, unknown>
      if (typeof candidate.content !== "string") return []
      return [
        {
          content: candidate.content,
          scope: candidate.scope === "global" ? ("global" as const) : ("project" as const),
        },
      ]
    })
  } catch {
    return []
  }
}

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const { db } = yield* Database.Service
    const config = yield* Config.Service
    const agents = yield* Agent.Service
    const provider = yield* Provider.Service
    const llm = yield* LLM.Service

    const put = Effect.fn("Memory.put")(function* (input: PutInput) {
      const value = content(input.content)
      if (!value) return
      const scope = input.scope ?? "project"
      const projectID = scope === "project" ? input.projectID : undefined
      const fingerprint = hash(value)
      const existing = yield* db
        .select()
        .from(MemoryTable)
        .where(
          and(
            eq(MemoryTable.scope, scope),
            projectID ? eq(MemoryTable.project_id, projectID) : isNull(MemoryTable.project_id),
            eq(MemoryTable.hash, fingerprint),
          ),
        )
        .get()
        .pipe(Effect.orDie)

      if (existing) {
        yield* db
          .update(MemoryTable)
          .set({
            content: value,
            enabled: input.enabled ?? existing.enabled,
            source_session_id: input.sourceSessionID ?? existing.source_session_id,
            source_message_id: input.sourceMessageID ?? existing.source_message_id,
          })
          .where(eq(MemoryTable.id, existing.id))
          .run()
          .pipe(Effect.orDie)
        const updated = yield* db.select().from(MemoryTable).where(eq(MemoryTable.id, existing.id)).get().pipe(Effect.orDie)
        if (updated) return fromRow(updated)
        return fromRow(existing)
      }

      const id = CoreMemory.ID.create()
      yield* db
        .insert(MemoryTable)
        .values({
          id,
          scope,
          project_id: projectID,
          content: value,
          hash: fingerprint,
          enabled: input.enabled ?? true,
          source_session_id: input.sourceSessionID,
          source_message_id: input.sourceMessageID,
        })
        .run()
        .pipe(Effect.orDie)
      const row = yield* db.select().from(MemoryTable).where(eq(MemoryTable.id, id)).get().pipe(Effect.orDie)
      if (row) return fromRow(row)
    })

    const listForProject = Effect.fn("Memory.listForProject")(function* (input: {
      projectID: SessionInfo["projectID"]
      includeDisabled?: boolean
      limit?: number
    }) {
      const visible = input.includeDisabled ? undefined : eq(MemoryTable.enabled, true)
      const projectQuery = db
        .select()
        .from(MemoryTable)
        .where(and(eq(MemoryTable.scope, "project"), eq(MemoryTable.project_id, input.projectID), visible))
        .orderBy(desc(MemoryTable.time_updated))
      const projectRows = yield* (input.limit === undefined
        ? projectQuery.all()
        : projectQuery.limit(input.limit).all()
      ).pipe(Effect.orDie)
      const globalQuery = db
        .select()
        .from(MemoryTable)
        .where(and(eq(MemoryTable.scope, "global"), isNull(MemoryTable.project_id), visible))
        .orderBy(desc(MemoryTable.time_updated))
      const globalRows = yield* (input.limit === undefined ? globalQuery.all() : globalQuery.limit(input.limit).all()).pipe(
        Effect.orDie,
      )
      return [...projectRows, ...globalRows].slice(0, input.limit).map(fromRow)
    })

    const enabled = Effect.fn("Memory.enabled")(function* (session: SessionInfo) {
      return isEnabled(yield* config.get(), session)
    })

    const list = Effect.fn("Memory.list")(function* (input?: CoreMemory.ListQuery) {
      const ctx = yield* InstanceState.context
      return yield* listForProject({ projectID: ctx.project.id, includeDisabled: input?.includeDisabled })
    })

    const select = Effect.fn("Memory.select")(function* (input: { session: SessionInfo; limit?: number }) {
      if (!(yield* enabled(input.session))) return []
      const cfg = yield* config.get()
      const selected = yield* listForProject({
        projectID: input.session.projectID,
        limit: input.limit ?? cfg.memory?.limit ?? 8,
      })
      if (selected.length > 0) {
        yield* db
          .update(MemoryTable)
          .set({ time_accessed: Date.now() })
          .where(
            inArray(
              MemoryTable.id,
              selected.map((item) => item.id),
            ),
          )
          .run()
          .pipe(Effect.orDie)
      }
      return selected
    })

    const create = Effect.fn("Memory.create")(function* (input: CoreMemory.CreateInput) {
      const ctx = yield* InstanceState.context
      if ((input.scope ?? "project") === "project") {
        yield* db
          .insert(ProjectTable)
          .values({
            id: ctx.project.id,
            worktree: AbsolutePath.make(ctx.project.worktree),
            vcs: ctx.project.vcs,
            sandboxes: ctx.project.sandboxes.map((sandbox) => AbsolutePath.make(sandbox)),
          })
          .onConflictDoNothing()
          .run()
          .pipe(Effect.orDie)
      }
      return yield* put({ ...input, projectID: ctx.project.id })
    })

    const update = Effect.fn("Memory.update")(function* (id: CoreMemory.ID, input: CoreMemory.UpdateInput) {
      const row = yield* db.select().from(MemoryTable).where(eq(MemoryTable.id, id)).get().pipe(Effect.orDie)
      if (!row) return
      const value = input.content === undefined ? row.content : content(input.content)
      if (!value) return
      yield* db
        .update(MemoryTable)
        .set({
          content: value,
          hash: hash(value),
          enabled: input.enabled ?? row.enabled,
        })
        .where(eq(MemoryTable.id, id))
        .run()
        .pipe(Effect.orDie)
      const updated = yield* db.select().from(MemoryTable).where(eq(MemoryTable.id, id)).get().pipe(Effect.orDie)
      if (updated) return fromRow(updated)
    })

    const remove = Effect.fn("Memory.remove")(function* (id: CoreMemory.ID) {
      yield* db.delete(MemoryTable).where(eq(MemoryTable.id, id)).run().pipe(Effect.orDie)
    })

    const extract = Effect.fn("Memory.extract")(
      function* (input: { session: SessionInfo; messages: SessionV1.WithParts[] }) {
        if (!(yield* enabled(input.session))) return
        const turn = latest(input.messages)
        if (!turn) return
        const agent = yield* agents.get("memory")
        if (!agent) return
        const model = agent.model
          ? yield* provider.getModel(agent.model.providerID, agent.model.modelID)
          : ((yield* provider.getSmallModel(turn.user.model.providerID)) ??
            (yield* provider.getModel(turn.user.model.providerID, turn.user.model.modelID)))
        const text = yield* llm
          .stream({
            user: turn.user,
            agent,
            sessionID: input.session.id,
            parentSessionID: input.session.parentID,
            system: [agent.prompt ?? PROMPT_MEMORY],
            messages: [{ role: "user", content: prompt(turn) }],
            tools: {},
            toolChoice: "none",
            small: true,
            model,
            retries: 1,
          })
          .pipe(
            Stream.filter(LLMEvent.is.textDelta),
            Stream.map((event) => event.text),
            Stream.mkString,
          )
        yield* Effect.forEach(
          candidates(text).slice(0, 5),
          (item) =>
            put({
              ...item,
              projectID: input.session.projectID,
              sourceSessionID: input.session.id,
              sourceMessageID: turn.messageID,
            }),
          { concurrency: 1, discard: true },
        )
      },
      Effect.catchCause((cause) => Effect.logDebug("memory extraction skipped", { cause })),
    )

    return Service.of({ enabled, list, select, create, update, remove, extract })
  }),
)

export const defaultLayer = Layer.suspend(() =>
  layer.pipe(
    Layer.provide(Database.defaultLayer),
    Layer.provide(Config.defaultLayer),
    Layer.provide(Agent.defaultLayer),
    Layer.provide(Provider.defaultLayer),
    Layer.provide(LLM.defaultLayer),
  ),
)

export const node = LayerNode.make(layer, [Database.node, Config.node, Agent.node, Provider.node, LLM.node])

export * as Memory from "./memory"
