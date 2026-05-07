import { Hono } from "hono"
import { stream } from "hono/streaming"
import { describeRoute, validator, resolver } from "hono-openapi"
import z from "zod"
import { APICallError } from "ai"
import { Session } from "../../session"
import { MessageV2 } from "../../session/message-v2"
import { SessionPrompt } from "../../session/prompt"
import { SessionCompaction } from "../../session/compaction"
import { LLM } from "@/session/llm"
import { SessionRevert } from "../../session/revert"
import { SessionStatus } from "@/session/status"
import { SessionSummary } from "@/session/summary"
import { Todo } from "../../session/todo"
import { Agent } from "../../agent/agent"
import { Provider } from "../../provider/provider"
import { Snapshot } from "@/snapshot"
import { Log } from "../../util/log"
import { PermissionNext } from "@/permission/next"
import { errors } from "../error"
import { lazy } from "../../util/lazy"
import { Identifier } from "@/id/id"
import { SessionProxyMiddleware } from "../../control-plane/session-proxy-middleware"
import { Config } from "@/config/config"
import { SessionAutocomplete } from "@/session/autocomplete"
import { AUTOCOMPLETE_FALLBACK_MODELS_BY_PROVIDER } from "./autocomplete-fast-map"

const log = Log.create({ service: "server" })

function aborted(error: unknown) {
  return MessageV2.AbortedError.isInstance(error) || (error instanceof DOMException && error.name === "AbortError")
}

async function interrupted(sessionID: string, parentID: string, timeout = 1000) {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    const messages = await Session.messages({ sessionID })
    const match = [...messages]
      .reverse()
      .find(
        (item) =>
          item.info.role === "assistant" &&
          item.info.parentID === parentID &&
          item.info.error?.name === "MessageAbortedError",
      )
    if (match) return match
    await Bun.sleep(25)
  }
}

function bindAbort(signal: AbortSignal, sessionID: string) {
  const abort = () => {
    void SessionPrompt.cancel(sessionID, new DOMException("Aborted", "AbortError"))
  }
  if (signal.aborted) {
    abort()
    return () => {}
  }
  signal.addEventListener("abort", abort, { once: true })
  return () => signal.removeEventListener("abort", abort)
}

const AutocompleteInput = z.object({
  model: z.object({
    providerID: z.string(),
    modelID: z.string(),
  }),
  agent: z.string().optional(),
  variant: z.string().optional(),
  mode: z.enum(["normal", "shell"]).optional(),
  prefix: z.string(),
  suffix: z.string().optional(),
})

const FAST_MATCH = [
  /\bnano\b/i,
  /\bmicro\b/i,
  /\bmini\b/i,
  /\bhaiku\b/i,
  /\bflash\b/i,
  /\bsmall\b/i,
  /\blite\b/i,
  /\binstant\b/i,
  /\bturbo\b/i,
  /\bfast\b/i,
  /\bhighspeed\b/i,
]

const FAST_EXCLUDE =
  /embedding|whisper|transcrib|rerank|moderation|image-generation|text-to-speech|speech-to-text|tts|stt|asr|realtime|vision|diffusion/i

const BAD_MODEL_TTL_MS = 15 * 60 * 1000
const MODEL_ACCESS_PATTERN =
  /unknown model|invalid model|no such model|model.+(not found|does not exist|not enabled|not available|unavailable|unsupported|not allowed|access|permission|denied|forbidden)|not entitled/i
const AUTH_ERROR_PATTERN =
  /invalid[_ ]?api[_ ]?key|incorrect[_ ]?api[_ ]?key|authentication|quota|billing|credit|organization.+not found/i

type AutocompleteCandidate = {
  model: Provider.Model
  source: "override" | "map" | "small" | "heuristic" | "selected"
}

const badAutocompleteModels = new Map<string, number>()

function modelKey(model: Pick<Provider.Model, "providerID" | "id">) {
  return `${model.providerID}/${model.id}`
}

function isBadAutocompleteModel(model: Pick<Provider.Model, "providerID" | "id">) {
  const key = modelKey(model)
  const expires = badAutocompleteModels.get(key)
  if (!expires) return false
  if (expires > Date.now()) return true
  badAutocompleteModels.delete(key)
  return false
}

function markBadAutocompleteModel(model: Pick<Provider.Model, "providerID" | "id">) {
  badAutocompleteModels.set(modelKey(model), Date.now() + BAD_MODEL_TTL_MS)
}

function clearBadAutocompleteModel(model: Pick<Provider.Model, "providerID" | "id">) {
  badAutocompleteModels.delete(modelKey(model))
}

export function resetAutocompleteBadModelCache() {
  badAutocompleteModels.clear()
}

function isModelAccessError(error: unknown) {
  if (Provider.ModelNotFoundError.isInstance(error)) return true
  if (!APICallError.isInstance(error)) return false
  const call = error as APICallError
  if (call.statusCode === 404) return true
  if (call.statusCode && ![400, 401, 403].includes(call.statusCode)) return false
  const text = `${call.message}\n${call.responseBody ?? ""}`.toLowerCase()
  if (!text.trim()) return false
  if (call.statusCode === 401 && AUTH_ERROR_PATTERN.test(text)) return false
  return MODEL_ACCESS_PATTERN.test(text)
}

function isTextModel(model: Provider.Model) {
  return model.capabilities.input.text && model.capabilities.output.text
}

function modelBlob(model: Pick<Provider.Model, "id" | "name" | "family">) {
  return `${model.id} ${model.name} ${model.family ?? ""}`.toLowerCase()
}

function modelRank(model: Pick<Provider.Model, "id" | "name" | "family">) {
  const text = modelBlob(model)
  for (let index = 0; index < FAST_MATCH.length; index++) {
    if (FAST_MATCH[index]!.test(text)) return index
  }
  return FAST_MATCH.length
}

function modelDate(date: string) {
  const value = Date.parse(date.trim())
  if (!Number.isFinite(value)) return 0
  return value
}

async function tryModel(providerID: string, modelID: string) {
  try {
    return await Provider.getModel(providerID, modelID)
  } catch {
    return
  }
}

async function overrideModel(providerID: string, value: string) {
  const trimmed = value.trim()
  if (!trimmed) return
  if (!trimmed.includes("/")) return tryModel(providerID, trimmed)
  const parsed = Provider.parseModel(trimmed)
  if (parsed.providerID !== providerID) return
  return tryModel(providerID, parsed.modelID)
}

async function heuristicModel(providerID: string) {
  const provider = await Provider.getProvider(providerID)
  if (!provider) return
  const all = (Object.values(provider.models) as Provider.Model[]).filter(isTextModel)
  if (all.length === 0) return
  const filtered = all.filter((item) => !FAST_EXCLUDE.test(modelBlob(item)))
  const pool = filtered.length > 0 ? filtered : all
  const fast = pool.filter((item) => modelRank(item) < FAST_MATCH.length)
  const picks = fast.length > 0 ? fast : pool
  picks.sort((a, b) => {
    const byDate = modelDate(b.release_date) - modelDate(a.release_date)
    if (byDate !== 0) return byDate
    const bySpeed = modelRank(a) - modelRank(b)
    if (bySpeed !== 0) return bySpeed
    const byReasoning = Number(a.capabilities.reasoning) - Number(b.capabilities.reasoning)
    if (byReasoning !== 0) return byReasoning
    const byOutput = a.limit.output - b.limit.output
    if (byOutput !== 0) return byOutput
    return a.id.localeCompare(b.id)
  })
  return picks[0]
}

function pushCandidate(
  list: AutocompleteCandidate[],
  seen: Set<string>,
  source: AutocompleteCandidate["source"],
  model: Provider.Model | undefined,
) {
  if (!model) return
  if (!isTextModel(model)) return
  const key = modelKey(model)
  if (seen.has(key)) return
  if (["map", "small", "heuristic"].includes(source) && isBadAutocompleteModel(model)) return
  seen.add(key)
  list.push({ model, source })
}

export async function resolveAutocompleteModelCandidates(input: {
  selected: { providerID: string; modelID: string }
  overrides: Record<string, string | null | undefined>
}) {
  const selected = await Provider.getModel(input.selected.providerID, input.selected.modelID)
  const providerID = selected.providerID
  const list: AutocompleteCandidate[] = []
  const seen = new Set<string>()

  const override = input.overrides[providerID]
  if (override === null) {
    pushCandidate(list, seen, "selected", selected)
    return list
  }

  if (typeof override === "string") {
    pushCandidate(list, seen, "override", await overrideModel(providerID, override))
  }

  const mapped =
    AUTOCOMPLETE_FALLBACK_MODELS_BY_PROVIDER[providerID as keyof typeof AUTOCOMPLETE_FALLBACK_MODELS_BY_PROVIDER]
  if (mapped) {
    const models = await Promise.all(mapped.map((item) => tryModel(providerID, item)))
    models.forEach((model) => pushCandidate(list, seen, "map", model))
  }

  pushCandidate(list, seen, "small", await Provider.getSmallModel(providerID))
  pushCandidate(list, seen, "heuristic", await heuristicModel(providerID))
  pushCandidate(list, seen, "selected", selected)

  return list
}

export async function resolveAutocompleteModel(input: {
  selected: { providerID: string; modelID: string }
  overrides: Record<string, string | null | undefined>
}) {
  const [first] = await resolveAutocompleteModelCandidates(input)
  if (first) return first.model
  return Provider.getModel(input.selected.providerID, input.selected.modelID)
}

function stripPrefix(input: string, prefix: string) {
  if (!prefix) return input
  if (input.toLocaleLowerCase().startsWith(prefix.toLocaleLowerCase())) {
    return input.slice(prefix.length)
  }
  return input
}

export const SessionRoutes = lazy(() =>
  new Hono()
    .use(SessionProxyMiddleware)
    .get(
      "/",
      describeRoute({
        summary: "List sessions",
        description: "Get a list of all SlopCode sessions, sorted by most recently updated.",
        operationId: "session.list",
        responses: {
          200: {
            description: "List of sessions",
            content: {
              "application/json": {
                schema: resolver(Session.Info.array()),
              },
            },
          },
        },
      }),
      validator(
        "query",
        z.object({
          directory: z.string().optional().meta({ description: "Filter sessions by directory" }),
          scope: z.enum(["project"]).optional().meta({ description: "List sessions across the current project" }),
          path: z.string().optional().meta({ description: "Filter sessions by project-relative path" }),
          roots: z.coerce.boolean().optional().meta({ description: "Only return root sessions (no parentID)" }),
          start: z.coerce
            .number()
            .optional()
            .meta({ description: "Filter sessions updated on or after this timestamp (milliseconds since epoch)" }),
          cursor: z.coerce
            .number()
            .optional()
            .meta({ description: "Return sessions updated before this timestamp (milliseconds since epoch)" }),
          search: z.string().optional().meta({ description: "Filter sessions by title (case-insensitive)" }),
          limit: z.coerce.number().optional().meta({ description: "Maximum number of sessions to return" }),
        }),
      ),
      async (c) => {
        const query = c.req.valid("query")
        const workspaceID = c.req.header("x-slopcode-workspace") ?? undefined
        const limit = query.limit
        const sessions: Session.Info[] = []
        for await (const session of Session.list({
          workspaceID,
          directory: query.directory,
          scope: query.scope,
          path: query.path,
          roots: query.roots,
          start: query.start,
          cursor: query.cursor,
          search: query.search,
          limit: limit ? limit + 1 : undefined,
        })) {
          sessions.push(session)
        }
        if (!limit) return c.json(sessions)
        const hasMore = sessions.length > limit
        const list = hasMore ? sessions.slice(0, limit) : sessions
        if (hasMore && list.length > 0) {
          c.header("x-next-cursor", String(list[list.length - 1].time.updated))
        }
        return c.json(list)
      },
    )
    .get(
      "/status",
      describeRoute({
        summary: "Get session status",
        description: "Retrieve the current status of all sessions, including active, idle, and completed states.",
        operationId: "session.status",
        responses: {
          200: {
            description: "Get session status",
            content: {
              "application/json": {
                schema: resolver(z.record(z.string(), SessionStatus.Info)),
              },
            },
          },
          ...errors(400),
        },
      }),
      async (c) => {
        const result = SessionStatus.list()
        return c.json(result)
      },
    )
    .get(
      "/:sessionID",
      describeRoute({
        summary: "Get session",
        description: "Retrieve detailed information about a specific SlopCode session.",
        tags: ["Session"],
        operationId: "session.get",
        responses: {
          200: {
            description: "Get session",
            content: {
              "application/json": {
                schema: resolver(Session.Info),
              },
            },
          },
          ...errors(400, 404),
        },
      }),
      validator(
        "param",
        z.object({
          sessionID: Session.get.schema,
        }),
      ),
      async (c) => {
        const sessionID = c.req.valid("param").sessionID
        log.info("SEARCH", { url: c.req.url })
        const session = await Session.get(sessionID)
        SessionAutocomplete.begin(sessionID)
        return c.json(session)
      },
    )
    .get(
      "/:sessionID/children",
      describeRoute({
        summary: "Get session children",
        tags: ["Session"],
        description: "Retrieve all child sessions that were forked from the specified parent session.",
        operationId: "session.children",
        responses: {
          200: {
            description: "List of children",
            content: {
              "application/json": {
                schema: resolver(Session.Info.array()),
              },
            },
          },
          ...errors(400, 404),
        },
      }),
      validator(
        "param",
        z.object({
          sessionID: Session.children.schema,
        }),
      ),
      async (c) => {
        const sessionID = c.req.valid("param").sessionID
        const session = await Session.children(sessionID)
        return c.json(session)
      },
    )
    .get(
      "/:sessionID/todo",
      describeRoute({
        summary: "Get session todos",
        description: "Retrieve the todo list associated with a specific session, showing tasks and action items.",
        operationId: "session.todo",
        responses: {
          200: {
            description: "Todo list",
            content: {
              "application/json": {
                schema: resolver(Todo.Info.array()),
              },
            },
          },
          ...errors(400, 404),
        },
      }),
      validator(
        "param",
        z.object({
          sessionID: z.string().meta({ description: "Session ID" }),
        }),
      ),
      async (c) => {
        const sessionID = c.req.valid("param").sessionID
        const todos = await Todo.get(sessionID)
        return c.json(todos)
      },
    )
    .post(
      "/",
      describeRoute({
        summary: "Create session",
        description: "Create a new SlopCode session for interacting with AI assistants and managing conversations.",
        operationId: "session.create",
        responses: {
          ...errors(400),
          200: {
            description: "Successfully created session",
            content: {
              "application/json": {
                schema: resolver(Session.Info),
              },
            },
          },
        },
      }),
      validator("json", Session.create.schema.optional()),
      async (c) => {
        const body = c.req.valid("json") ?? {}
        const workspaceID = c.req.header("x-slopcode-workspace") ?? undefined
        const session = await Session.create({
          ...body,
          workspaceID,
        })
        SessionAutocomplete.begin(session.id)
        return c.json(session)
      },
    )
    .delete(
      "/:sessionID",
      describeRoute({
        summary: "Delete session",
        description: "Delete a session and permanently remove all associated data, including messages and history.",
        operationId: "session.delete",
        responses: {
          200: {
            description: "Successfully deleted session",
            content: {
              "application/json": {
                schema: resolver(z.boolean()),
              },
            },
          },
          ...errors(400, 404),
        },
      }),
      validator(
        "param",
        z.object({
          sessionID: Session.remove.schema,
        }),
      ),
      async (c) => {
        const sessionID = c.req.valid("param").sessionID
        await Session.remove(sessionID)
        return c.json(true)
      },
    )
    .patch(
      "/:sessionID",
      describeRoute({
        summary: "Update session",
        description: "Update properties of an existing session, such as title or other metadata.",
        operationId: "session.update",
        responses: {
          200: {
            description: "Successfully updated session",
            content: {
              "application/json": {
                schema: resolver(Session.Info),
              },
            },
          },
          ...errors(400, 404),
        },
      }),
      validator(
        "param",
        z.object({
          sessionID: z.string(),
        }),
      ),
      validator(
        "query",
        z.object({
          directory: z.string().optional(),
        }),
      ),
      validator(
        "json",
        z.object({
          title: z.string().optional(),
          time: z
            .object({
              archived: z.number().nullable().optional(),
            })
            .optional(),
        }),
      ),
      async (c) => {
        const sessionID = c.req.valid("param").sessionID
        const updates = c.req.valid("json")

        let session = await Session.get(sessionID)
        if (updates.title !== undefined) {
          session = await Session.setTitle({ sessionID, title: updates.title })
        }
        if (updates.time !== undefined && "archived" in updates.time) {
          session = await Session.setArchived({ sessionID, time: updates.time.archived ?? undefined })
        }

        return c.json(session)
      },
    )
    .post(
      "/:sessionID/init",
      describeRoute({
        summary: "Initialize session",
        description:
          "Analyze the current application and create an AGENTS.md file with project-specific agent configurations.",
        operationId: "session.init",
        responses: {
          200: {
            description: "200",
            content: {
              "application/json": {
                schema: resolver(z.boolean()),
              },
            },
          },
          ...errors(400, 404),
        },
      }),
      validator(
        "param",
        z.object({
          sessionID: z.string().meta({ description: "Session ID" }),
        }),
      ),
      validator("json", Session.initialize.schema.omit({ sessionID: true })),
      async (c) => {
        const sessionID = c.req.valid("param").sessionID
        const body = c.req.valid("json")
        await Session.initialize({ ...body, sessionID })
        return c.json(true)
      },
    )
    .post(
      "/:sessionID/fork",
      describeRoute({
        summary: "Fork session",
        description: "Create a new session by forking an existing session at a specific message point.",
        operationId: "session.fork",
        responses: {
          200: {
            description: "200",
            content: {
              "application/json": {
                schema: resolver(Session.Info),
              },
            },
          },
        },
      }),
      validator(
        "param",
        z.object({
          sessionID: Session.fork.schema.shape.sessionID,
        }),
      ),
      validator("json", Session.fork.schema.omit({ sessionID: true })),
      async (c) => {
        const sessionID = c.req.valid("param").sessionID
        const body = c.req.valid("json")
        const result = await Session.fork({ ...body, sessionID })
        return c.json(result)
      },
    )
    .post(
      "/:sessionID/abort",
      describeRoute({
        summary: "Abort session",
        description: "Abort an active session and stop any ongoing AI processing or command execution.",
        operationId: "session.abort",
        responses: {
          200: {
            description: "Aborted session",
            content: {
              "application/json": {
                schema: resolver(z.boolean()),
              },
            },
          },
          ...errors(400, 404),
        },
      }),
      validator(
        "param",
        z.object({
          sessionID: z.string(),
        }),
      ),
      async (c) => {
        await SessionPrompt.cancel(c.req.valid("param").sessionID)
        return c.json(true)
      },
    )
    .post(
      "/:sessionID/pause",
      describeRoute({
        summary: "Pause session",
        description: "Pause the active prompt while preserving the remaining serial queue.",
        operationId: "session.pause",
        responses: {
          200: {
            description: "Paused session",
            content: {
              "application/json": {
                schema: resolver(z.boolean()),
              },
            },
          },
          ...errors(400, 404),
        },
      }),
      validator(
        "param",
        z.object({
          sessionID: z.string(),
        }),
      ),
      async (c) => {
        return c.json(await SessionPrompt.pause(c.req.valid("param").sessionID))
      },
    )
    .post(
      "/:sessionID/resume",
      describeRoute({
        summary: "Resume session",
        description: "Resume a previously paused prompt and continue the remaining serial queue.",
        operationId: "session.resume",
        responses: {
          200: {
            description: "Resumed session",
            content: {
              "application/json": {
                schema: resolver(z.boolean()),
              },
            },
          },
          ...errors(400, 404),
        },
      }),
      validator(
        "param",
        z.object({
          sessionID: z.string(),
        }),
      ),
      async (c) => {
        return c.json(await SessionPrompt.resume(c.req.valid("param").sessionID))
      },
    )
    .post(
      "/:sessionID/share",
      describeRoute({
        summary: "Share session",
        description: "Create a shareable link for a session, allowing others to view the conversation.",
        operationId: "session.share",
        responses: {
          200: {
            description: "Successfully shared session",
            content: {
              "application/json": {
                schema: resolver(Session.Info),
              },
            },
          },
          ...errors(400, 404),
        },
      }),
      validator(
        "param",
        z.object({
          sessionID: z.string(),
        }),
      ),
      async (c) => {
        const sessionID = c.req.valid("param").sessionID
        await Session.share(sessionID)
        const session = await Session.get(sessionID)
        return c.json(session)
      },
    )
    .get(
      "/:sessionID/diff",
      describeRoute({
        summary: "Get message diff",
        description: "Get the file changes (diff) that resulted from a specific user message in the session.",
        operationId: "session.diff",
        responses: {
          200: {
            description: "Successfully retrieved diff",
            content: {
              "application/json": {
                schema: resolver(Snapshot.FileDiff.array()),
              },
            },
          },
        },
      }),
      validator(
        "param",
        z.object({
          sessionID: SessionSummary.diff.schema.shape.sessionID,
        }),
      ),
      validator(
        "query",
        z.object({
          messageID: SessionSummary.diff.schema.shape.messageID,
        }),
      ),
      async (c) => {
        const query = c.req.valid("query")
        const params = c.req.valid("param")
        const result = await SessionSummary.diff({
          sessionID: params.sessionID,
          messageID: query.messageID,
        })
        return c.json(result)
      },
    )
    .get(
      "/:sessionID/diff/index",
      describeRoute({
        summary: "Get session diff index",
        description: "Get the file list and metadata for a session diff without loading full file contents.",
        operationId: "session.diffIndex",
        responses: {
          200: {
            description: "Successfully retrieved diff index",
            content: {
              "application/json": {
                schema: resolver(Snapshot.FileDiffEntry.array()),
              },
            },
          },
          ...errors(400),
        },
      }),
      validator(
        "param",
        z.object({
          sessionID: SessionSummary.diffIndex.schema,
        }),
      ),
      async (c) => {
        const sessionID = c.req.valid("param").sessionID
        const result = await SessionSummary.diffIndex(sessionID)
        return c.json(result)
      },
    )
    .post(
      "/:sessionID/diff/chunk",
      describeRoute({
        summary: "Get session diff chunk",
        description: "Get full diff contents for a subset of files in a session diff.",
        operationId: "session.diffChunk",
        responses: {
          200: {
            description: "Successfully retrieved diff chunk",
            content: {
              "application/json": {
                schema: resolver(Snapshot.FileDiffEntry.array()),
              },
            },
          },
          ...errors(400),
        },
      }),
      validator(
        "param",
        z.object({
          sessionID: SessionSummary.diffChunk.schema.shape.sessionID,
        }),
      ),
      validator(
        "json",
        z.object({
          files: SessionSummary.diffChunk.schema.shape.files,
        }),
      ),
      async (c) => {
        const sessionID = c.req.valid("param").sessionID
        const body = c.req.valid("json")
        const result = await SessionSummary.diffChunk({
          sessionID,
          files: body.files,
        })
        return c.json(result)
      },
    )
    .delete(
      "/:sessionID/share",
      describeRoute({
        summary: "Unshare session",
        description: "Remove the shareable link for a session, making it private again.",
        operationId: "session.unshare",
        responses: {
          200: {
            description: "Successfully unshared session",
            content: {
              "application/json": {
                schema: resolver(Session.Info),
              },
            },
          },
          ...errors(400, 404),
        },
      }),
      validator(
        "param",
        z.object({
          sessionID: Session.unshare.schema,
        }),
      ),
      async (c) => {
        const sessionID = c.req.valid("param").sessionID
        await Session.unshare(sessionID)
        const session = await Session.get(sessionID)
        return c.json(session)
      },
    )
    .post(
      "/:sessionID/summarize",
      describeRoute({
        summary: "Summarize session",
        description: "Generate a concise summary of the session using AI compaction to preserve key information.",
        operationId: "session.summarize",
        responses: {
          200: {
            description: "Summarized session",
            content: {
              "application/json": {
                schema: resolver(z.boolean()),
              },
            },
          },
          ...errors(400, 404),
        },
      }),
      validator(
        "param",
        z.object({
          sessionID: z.string().meta({ description: "Session ID" }),
        }),
      ),
      validator(
        "json",
        z.object({
          providerID: z.string(),
          modelID: z.string(),
          auto: z.boolean().optional().default(false),
        }),
      ),
      async (c) => {
        const sessionID = c.req.valid("param").sessionID
        const body = c.req.valid("json")
        const session = await Session.get(sessionID)
        await SessionRevert.cleanup(session)
        const msgs = await Session.messages({ sessionID })
        let currentAgent = await Agent.defaultAgent()
        for (let i = msgs.length - 1; i >= 0; i--) {
          const info = msgs[i].info
          if (info.role === "user") {
            currentAgent = info.agent || (await Agent.defaultAgent())
            break
          }
        }
        await SessionCompaction.create({
          sessionID,
          agent: currentAgent,
          model: {
            providerID: body.providerID,
            modelID: body.modelID,
          },
          auto: body.auto,
        })
        await SessionPrompt.loop({ sessionID })
        return c.json(true)
      },
    )
    .get(
      "/:sessionID/message",
      describeRoute({
        summary: "Get session messages",
        description: "Retrieve all messages in a session, including user prompts and AI responses.",
        operationId: "session.messages",
        responses: {
          200: {
            description: "List of messages",
            content: {
              "application/json": {
                schema: resolver(MessageV2.WithParts.array()),
              },
            },
          },
          ...errors(400, 404),
        },
      }),
      validator(
        "param",
        z.object({
          sessionID: z.string().meta({ description: "Session ID" }),
        }),
      ),
      validator(
        "query",
        z.object({
          limit: z.coerce.number().optional(),
          cursor: z.coerce.number().optional(),
        }),
      ),
      async (c) => {
        const query = c.req.valid("query")
        const limit = query.limit
        const messages = await Session.messages({
          sessionID: c.req.valid("param").sessionID,
          limit: limit ? limit + 1 : undefined,
          cursor: query.cursor,
        })
        if (!limit) return c.json(messages)
        const hasMore = messages.length > limit
        const list = hasMore ? messages.slice(1) : messages
        if (hasMore && list.length > 0) {
          c.header("x-next-cursor", String(list[0].info.time.created))
        }
        return c.json(list)
      },
    )
    .get(
      "/:sessionID/message/index",
      describeRoute({
        summary: "Get session message index",
        description: "Retrieve message metadata for a session without loading full message parts.",
        operationId: "session.messageIndex",
        responses: {
          200: {
            description: "List of message metadata",
            content: {
              "application/json": {
                schema: resolver(MessageV2.Info.array()),
              },
            },
          },
          ...errors(400, 404),
        },
      }),
      validator(
        "param",
        z.object({
          sessionID: z.string().meta({ description: "Session ID" }),
        }),
      ),
      validator(
        "query",
        z.object({
          limit: z.coerce.number().optional(),
          cursor: z.coerce.number().optional(),
        }),
      ),
      async (c) => {
        const query = c.req.valid("query")
        const limit = query.limit
        const messages = await MessageV2.index({
          sessionID: c.req.valid("param").sessionID,
          limit: limit ? limit + 1 : undefined,
          cursor: query.cursor,
        })
        if (!limit) return c.json(messages)
        const hasMore = messages.length > limit
        const list = hasMore ? messages.slice(1) : messages
        if (hasMore && list.length > 0) {
          c.header("x-next-cursor", String(list[0].time.created))
        }
        return c.json(list)
      },
    )
    .post(
      "/:sessionID/message/chunk",
      describeRoute({
        summary: "Get session message chunk",
        description: "Retrieve message parts for a subset of messages in a session.",
        operationId: "session.messageChunk",
        responses: {
          200: {
            description: "List of message parts grouped by message",
            content: {
              "application/json": {
                schema: resolver(MessageV2.PartChunk.array()),
              },
            },
          },
          ...errors(400, 404),
        },
      }),
      validator(
        "param",
        z.object({
          sessionID: z.string().meta({ description: "Session ID" }),
        }),
      ),
      validator(
        "json",
        z.object({
          messageIDs: MessageV2.chunk.schema.shape.messageIDs,
        }),
      ),
      async (c) => {
        const params = c.req.valid("param")
        const body = c.req.valid("json")
        const result = await MessageV2.chunk({
          sessionID: params.sessionID,
          messageIDs: body.messageIDs,
        })
        return c.json(result)
      },
    )
    .get(
      "/:sessionID/message/:messageID",
      describeRoute({
        summary: "Get message",
        description: "Retrieve a specific message from a session by its message ID.",
        operationId: "session.message",
        responses: {
          200: {
            description: "Message",
            content: {
              "application/json": {
                schema: resolver(
                  z.object({
                    info: MessageV2.Info,
                    parts: MessageV2.Part.array(),
                  }),
                ),
              },
            },
          },
          ...errors(400, 404),
        },
      }),
      validator(
        "param",
        z.object({
          sessionID: z.string().meta({ description: "Session ID" }),
          messageID: z.string().meta({ description: "Message ID" }),
        }),
      ),
      async (c) => {
        const params = c.req.valid("param")
        const message = await MessageV2.get({
          sessionID: params.sessionID,
          messageID: params.messageID,
        })
        return c.json(message)
      },
    )
    .put(
      "/:sessionID/message/:messageID",
      describeRoute({
        summary: "Update message",
        description: "Create or update a message in a session.",
        operationId: "message.update",
        responses: {
          200: {
            description: "Successfully updated message",
            content: {
              "application/json": {
                schema: resolver(MessageV2.Info),
              },
            },
          },
          ...errors(400, 404),
        },
      }),
      validator(
        "param",
        z.object({
          sessionID: z.string().meta({ description: "Session ID" }),
          messageID: z.string().meta({ description: "Message ID" }),
        }),
      ),
      validator("json", MessageV2.Info),
      async (c) => {
        const params = c.req.valid("param")
        const body = c.req.valid("json")
        if (body.id !== params.messageID || body.sessionID !== params.sessionID) {
          throw new Error(
            `Message mismatch: body.id='${body.id}' vs messageID='${params.messageID}', body.sessionID='${body.sessionID}' vs sessionID='${params.sessionID}'`,
          )
        }
        const message = await Session.updateMessage(body)
        return c.json(message)
      },
    )
    .delete(
      "/:sessionID/message/:messageID",
      describeRoute({
        summary: "Delete message",
        description:
          "Permanently delete a specific message (and all of its parts) from a session. This does not revert any file changes that may have been made while processing the message.",
        operationId: "session.deleteMessage",
        responses: {
          200: {
            description: "Successfully deleted message",
            content: {
              "application/json": {
                schema: resolver(z.boolean()),
              },
            },
          },
          ...errors(400, 404),
        },
      }),
      validator(
        "param",
        z.object({
          sessionID: z.string().meta({ description: "Session ID" }),
          messageID: z.string().meta({ description: "Message ID" }),
        }),
      ),
      async (c) => {
        const params = c.req.valid("param")
        SessionPrompt.assertNotBusy(params.sessionID)
        await Session.removeMessage({
          sessionID: params.sessionID,
          messageID: params.messageID,
        })
        return c.json(true)
      },
    )
    .delete(
      "/:sessionID/message/:messageID/part/:partID",
      describeRoute({
        description: "Delete a part from a message",
        operationId: "part.delete",
        responses: {
          200: {
            description: "Successfully deleted part",
            content: {
              "application/json": {
                schema: resolver(z.boolean()),
              },
            },
          },
          ...errors(400, 404),
        },
      }),
      validator(
        "param",
        z.object({
          sessionID: z.string().meta({ description: "Session ID" }),
          messageID: z.string().meta({ description: "Message ID" }),
          partID: z.string().meta({ description: "Part ID" }),
        }),
      ),
      async (c) => {
        const params = c.req.valid("param")
        await Session.removePart({
          sessionID: params.sessionID,
          messageID: params.messageID,
          partID: params.partID,
        })
        return c.json(true)
      },
    )
    .patch(
      "/:sessionID/message/:messageID/part/:partID",
      describeRoute({
        description: "Update a part in a message",
        operationId: "part.update",
        responses: {
          200: {
            description: "Successfully updated part",
            content: {
              "application/json": {
                schema: resolver(MessageV2.Part),
              },
            },
          },
          ...errors(400, 404),
        },
      }),
      validator(
        "param",
        z.object({
          sessionID: z.string().meta({ description: "Session ID" }),
          messageID: z.string().meta({ description: "Message ID" }),
          partID: z.string().meta({ description: "Part ID" }),
        }),
      ),
      validator("json", MessageV2.Part),
      async (c) => {
        const params = c.req.valid("param")
        const body = c.req.valid("json")
        if (body.id !== params.partID || body.messageID !== params.messageID || body.sessionID !== params.sessionID) {
          throw new Error(
            `Part mismatch: body.id='${body.id}' vs partID='${params.partID}', body.messageID='${body.messageID}' vs messageID='${params.messageID}', body.sessionID='${body.sessionID}' vs sessionID='${params.sessionID}'`,
          )
        }
        const part = await Session.updatePart(body)
        return c.json(part)
      },
    )
    .post(
      "/:sessionID/autocomplete",
      describeRoute({
        summary: "Get prompt autocomplete",
        description: "Generate a low-latency model-powered completion for the current prompt input.",
        operationId: "session.autocomplete",
        responses: {
          200: {
            description: "Autocomplete response",
            content: {
              "application/json": {
                schema: resolver(
                  z.object({
                    completion: z.string(),
                    model: z.string(),
                  }),
                ),
              },
            },
          },
          ...errors(400, 404),
        },
      }),
      validator(
        "param",
        z.object({
          sessionID: z.string().meta({ description: "Session ID" }),
        }),
      ),
      validator("json", AutocompleteInput),
      async (c) => {
        const sessionID = c.req.valid("param").sessionID
        await Session.get(sessionID)

        const body = c.req.valid("json")
        const [cfg, messages, related] = await Promise.all([
          Config.get(),
          Session.messages({ sessionID }),
          SessionAutocomplete.warm(sessionID).catch(() => ""),
        ])
        const autocomplete = cfg.autocomplete ?? {}
        if (autocomplete.enabled === false) {
          return c.json({ completion: "", model: `${body.model.providerID}/${body.model.modelID}` })
        }

        const minPrefix = autocomplete.min_prefix_chars ?? 12
        if (!SessionAutocomplete.request(body.prefix, minPrefix)) {
          return c.json({ completion: "", model: `${body.model.providerID}/${body.model.modelID}` })
        }

        const candidates = await resolveAutocompleteModelCandidates({
          selected: body.model,
          overrides: autocomplete.provider_model_overrides ?? {},
        })

        const timeout = autocomplete.timeout_ms ?? 4000
        const maxOutputTokens = autocomplete.max_output_tokens ?? 48
        const maxChars = autocomplete.max_completion_chars ?? 96
        const context = SessionAutocomplete.context({ messages, related })

        const abort = AbortSignal.any([c.req.raw.signal, AbortSignal.timeout(timeout)])
        const user: MessageV2.User = {
          id: Identifier.ascending("message"),
          role: "user",
          sessionID,
          time: { created: Date.now() },
          agent: body.agent ?? "build",
          model: body.model,
          variant: body.variant,
        }

        const mode = body.mode === "shell" ? "shell command" : "prompt"
        const suffix = body.suffix ? `\n<SUFFIX>\n${body.suffix}\n</SUFFIX>` : ""
        const prompt = [
          `Continue the user's partial ${mode}.`,
          "Return ONLY the continuation text.",
          "If confidence is low or multiple continuations are plausible, return an empty string.",
          "Prefer precise continuation of the current token, phrase, or command.",
          "Do not repeat existing prefix text.",
          "Include a leading space when the continuation starts a new token.",
          "Do not add a leading space when continuing the current token.",
          "Do not add markdown fences, quotes, or explanations.",
          `Keep it short (max ${maxChars} chars).`,
          "",
          "<PREFIX>",
          body.prefix,
          "</PREFIX>",
          suffix,
        ]
          .filter(Boolean)
          .join("\n")

        const agent = await Agent.get(body.agent ?? (await Agent.defaultAgent()))
        for (let index = 0; index < candidates.length; index++) {
          const candidate = candidates[index]!
          const model = candidate.model
          let completion = ""
          try {
            const stream = await LLM.stream({
              user,
              sessionID,
              model,
              agent,
              system: ["You are a fast inline autocomplete engine.", context.prompt, context.system].filter(
                (item): item is string => !!item,
              ),
              abort,
              messages: [
                {
                  role: "user",
                  content: prompt,
                },
              ],
              tools: {},
              toolChoice: "none",
              small: true,
              maxOutputTokens,
            })

            for await (const chunk of stream.textStream) {
              completion += chunk
              if (completion.length >= maxChars) break
            }
          } catch (error) {
            const access = isModelAccessError(error)
            if (access && candidate.source !== "selected") {
              markBadAutocompleteModel(model)
            }
            if (access && index < candidates.length - 1) {
              const nextModel = candidates[index + 1]!.model
              log.warn("autocomplete fallback", {
                from: `${model.providerID}/${model.id}`,
                to: `${nextModel.providerID}/${nextModel.id}`,
                reason: "model_access",
              })
              continue
            }
            return c.json({ completion: "", model: `${model.providerID}/${model.id}` })
          }

          clearBadAutocompleteModel(model)
          const normalized = completion
            .replace(/\r\n?/g, "\n")
            .replace(/\n{2,}/g, "\n")
            .replace(/\s+$/g, "")
            .slice(0, maxChars)

          const single = normalized.split("\n")[0] ?? ""
          const next = SessionAutocomplete.spacing(body.prefix, stripPrefix(single, body.prefix).replace(/\s+$/g, ""))
          if (!next) {
            return c.json({ completion: "", model: `${model.providerID}/${model.id}` })
          }
          return c.json({ completion: next, model: `${model.providerID}/${model.id}` })
        }

        return c.json({ completion: "", model: `${body.model.providerID}/${body.model.modelID}` })
      },
    )
    .post(
      "/:sessionID/message",
      describeRoute({
        summary: "Send message",
        description: "Create and send a new message to a session, streaming the AI response.",
        operationId: "session.prompt",
        responses: {
          200: {
            description: "Created message",
            content: {
              "application/json": {
                schema: resolver(
                  z.object({
                    info: MessageV2.Assistant,
                    parts: MessageV2.Part.array(),
                  }),
                ),
              },
            },
          },
          ...errors(400, 404),
        },
      }),
      validator(
        "param",
        z.object({
          sessionID: z.string().meta({ description: "Session ID" }),
        }),
      ),
      validator("json", SessionPrompt.PromptInput.omit({ sessionID: true })),
      async (c) => {
        c.status(200)
        c.header("Content-Type", "application/json")
        return stream(c, async (stream) => {
          const sessionID = c.req.valid("param").sessionID
          const body = c.req.valid("json")
          const messageID = body.messageID ?? Identifier.ascending("message")
          const clear = bindAbort(c.req.raw.signal, sessionID)
          stream.onAbort(clear)
          try {
            const msg = await SessionPrompt.prompt({ ...body, sessionID, messageID })
            stream.write(JSON.stringify(msg))
          } catch (error) {
            if (!aborted(error)) throw error
            const msg = await interrupted(sessionID, messageID)
            if (!msg) throw error
            stream.write(JSON.stringify(msg))
          } finally {
            clear()
          }
        })
      },
    )
    .post(
      "/:sessionID/prompt_async",
      describeRoute({
        summary: "Send async message",
        description:
          "Create and send a new message to a session asynchronously, starting the session if needed and returning immediately.",
        operationId: "session.prompt_async",
        responses: {
          204: {
            description: "Prompt accepted",
          },
          ...errors(400, 404),
        },
      }),
      validator(
        "param",
        z.object({
          sessionID: z.string().meta({ description: "Session ID" }),
        }),
      ),
      validator("json", SessionPrompt.PromptInput.omit({ sessionID: true })),
      async (c) => {
        c.status(204)
        c.header("Content-Type", "application/json")
        return stream(c, async () => {
          const sessionID = c.req.valid("param").sessionID
          const body = c.req.valid("json")
          void SessionPrompt.prompt({ ...body, sessionID }).catch((error) => {
            log.error("async prompt failed", { sessionID, error })
          })
        })
      },
    )
    .post(
      "/:sessionID/command",
      describeRoute({
        summary: "Send command",
        description: "Send a new command to a session for execution by the AI assistant.",
        operationId: "session.command",
        responses: {
          200: {
            description: "Created message",
            content: {
              "application/json": {
                schema: resolver(
                  z.object({
                    info: MessageV2.Assistant,
                    parts: MessageV2.Part.array(),
                  }),
                ),
              },
            },
          },
          ...errors(400, 404),
        },
      }),
      validator(
        "param",
        z.object({
          sessionID: z.string().meta({ description: "Session ID" }),
        }),
      ),
      validator("json", SessionPrompt.CommandInput.omit({ sessionID: true })),
      async (c) => {
        const sessionID = c.req.valid("param").sessionID
        const body = c.req.valid("json")
        const messageID = body.messageID ?? Identifier.ascending("message")
        const clear = bindAbort(c.req.raw.signal, sessionID)
        try {
          const msg = await SessionPrompt.command({ ...body, sessionID, messageID })
          return c.json(msg)
        } catch (error) {
          if (!aborted(error)) throw error
          const msg = await interrupted(sessionID, messageID)
          if (!msg) throw error
          return c.json(msg)
        } finally {
          clear()
        }
      },
    )
    .post(
      "/:sessionID/shell",
      describeRoute({
        summary: "Run shell command",
        description: "Execute a shell command within the session context and return the AI's response.",
        operationId: "session.shell",
        responses: {
          200: {
            description: "Created message",
            content: {
              "application/json": {
                schema: resolver(MessageV2.Assistant),
              },
            },
          },
          ...errors(400, 404),
        },
      }),
      validator(
        "param",
        z.object({
          sessionID: z.string().meta({ description: "Session ID" }),
        }),
      ),
      validator("json", SessionPrompt.ShellInput.omit({ sessionID: true })),
      async (c) => {
        const sessionID = c.req.valid("param").sessionID
        const body = c.req.valid("json")
        const clear = bindAbort(c.req.raw.signal, sessionID)
        try {
          const msg = await SessionPrompt.shell({ ...body, sessionID })
          return c.json(msg)
        } finally {
          clear()
        }
      },
    )
    .post(
      "/:sessionID/revert",
      describeRoute({
        summary: "Revert message",
        description: "Revert a specific message in a session, undoing its effects and restoring the previous state.",
        operationId: "session.revert",
        responses: {
          200: {
            description: "Updated session",
            content: {
              "application/json": {
                schema: resolver(Session.Info),
              },
            },
          },
          ...errors(400, 404),
        },
      }),
      validator(
        "param",
        z.object({
          sessionID: z.string(),
        }),
      ),
      validator("json", SessionRevert.RevertInput.omit({ sessionID: true })),
      async (c) => {
        const sessionID = c.req.valid("param").sessionID
        log.info("revert", c.req.valid("json"))
        const session = await SessionRevert.revert({
          sessionID,
          ...c.req.valid("json"),
        })
        return c.json(session)
      },
    )
    .post(
      "/:sessionID/unrevert",
      describeRoute({
        summary: "Restore reverted messages",
        description: "Restore all previously reverted messages in a session.",
        operationId: "session.unrevert",
        responses: {
          200: {
            description: "Updated session",
            content: {
              "application/json": {
                schema: resolver(Session.Info),
              },
            },
          },
          ...errors(400, 404),
        },
      }),
      validator(
        "param",
        z.object({
          sessionID: z.string(),
        }),
      ),
      async (c) => {
        const sessionID = c.req.valid("param").sessionID
        const session = await SessionRevert.unrevert({ sessionID })
        return c.json(session)
      },
    )
    .post(
      "/:sessionID/permissions/:permissionID",
      describeRoute({
        summary: "Respond to permission",
        deprecated: true,
        description: "Approve or deny a permission request from the AI assistant.",
        operationId: "permission.respond",
        responses: {
          200: {
            description: "Permission processed successfully",
            content: {
              "application/json": {
                schema: resolver(z.boolean()),
              },
            },
          },
          ...errors(400, 404),
        },
      }),
      validator(
        "param",
        z.object({
          sessionID: z.string(),
          permissionID: z.string(),
        }),
      ),
      validator("json", z.object({ response: PermissionNext.Reply })),
      async (c) => {
        const params = c.req.valid("param")
        await PermissionNext.reply({
          requestID: params.permissionID,
          reply: c.req.valid("json").response,
          sessionID: params.sessionID,
        })
        return c.json(true)
      },
    ),
)
