import { LayerNode } from "@slopcode-ai/core/effect/layer-node"
import { SessionV1 } from "@slopcode-ai/core/v1/session"
import { ConfigV1 } from "@slopcode-ai/core/v1/config/config"
import { Session } from "./session"
import { SessionID, MessageID, PartID } from "./schema"
import { Provider } from "@/provider/provider"
import { MessageV2 } from "./message-v2"
import { Token } from "@/util/token"
import { SessionProcessor } from "./processor"
import { Agent } from "@/agent/agent"
import { Plugin } from "@/plugin"
import { Config } from "@/config/config"
import { NotFoundError } from "@/storage/storage"

import { Cause, Effect, Layer, Context, Exit } from "effect"
import * as DateTime from "effect/DateTime"
import { InstanceState } from "@/effect/instance-state"
import { isOverflow as overflow, usable } from "./overflow"
import { serviceUse } from "@slopcode-ai/core/effect/service-use"
import { RuntimeFlags } from "@/effect/runtime-flags"
import { EventV2Bridge } from "@/event-v2-bridge"
import { SessionEvent } from "@slopcode-ai/core/session/event"
import { SessionMessage } from "@slopcode-ai/core/session/message"
import { ProviderV2 } from "@slopcode-ai/core/provider"
import { ModelV2 } from "@slopcode-ai/core/model"
import { EventV2 } from "@slopcode-ai/core/event"
import { buildPrompt } from "@slopcode-ai/core/session/compaction"

export const Event = {
  Compacted: EventV2.define({
    type: "session.compacted",
    schema: {
      sessionID: SessionID,
    },
  }),
}

export const PRUNE_MINIMUM = 20_000
export const PRUNE_PROTECT = 40_000
const TOOL_OUTPUT_MAX_CHARS = 2_000
const PRUNE_PROTECTED_TOOLS = ["skill"]
const DEFAULT_TAIL_TURNS = 2
const MIN_PRESERVE_RECENT_TOKENS = 2_000
const MAX_PRESERVE_RECENT_TOKENS = 8_000
type Turn = {
  start: number
  end: number
  id: MessageID
}

type Tail = {
  start: number
  id: MessageID
}

type CompletedCompaction = {
  userIndex: number
  assistantIndex: number
  summary: string | undefined
}

type Eligible = "model_not_found" | "context" | "usage" | "retry_exhausted" | "server"
type Failure = {
  class: Eligible | "auth" | "billing" | "content_filter" | "validation" | "cancelled" | "incomplete"
  eligible: boolean
}

function codes(error: SessionV1.APIError) {
  const normalize = (value: string) => value.toLowerCase().replaceAll("-", "_")
  const result = Object.entries(error.data.metadata ?? {}).flatMap(([key, value]) =>
    key === "code" || key === "type" || key === "name" ? [value] : [],
  )
  if (!error.data.responseBody) return result.map(normalize)
  try {
    const value = JSON.parse(error.data.responseBody)
    if (!value || typeof value !== "object") return result.map(normalize)
    const nested = "error" in value ? value.error : undefined
    const records = [value, nested].filter(
      (item): item is Record<string, unknown> => !!item && typeof item === "object",
    )
    result.push(
      ...records.flatMap((item) =>
        [item.code, item.type, item.name].filter((item): item is string => typeof item === "string"),
      ),
    )
    if (typeof nested === "string") result.push(nested)
  } catch {
    return result.map(normalize)
  }
  return result.map(normalize)
}

function failure(input: {
  error: SessionV1.Assistant["error"]
  cause: unknown
  model: Provider.Model
  result: SessionProcessor.Result
}): Failure | undefined {
  if (Provider.ModelNotFoundError.isInstance(input.cause)) return { class: "model_not_found", eligible: true }
  if (input.cause instanceof Error && input.cause.name === "AbortError") return { class: "cancelled", eligible: false }
  if (SessionV1.AbortedError.isInstance(input.error)) return { class: "cancelled", eligible: false }
  if (SessionV1.AuthError.isInstance(input.error)) return { class: "auth", eligible: false }
  if (SessionV1.ContentFilterError.isInstance(input.error)) return { class: "content_filter", eligible: false }
  if (SessionV1.StructuredOutputError.isInstance(input.error)) return { class: "validation", eligible: false }
  if (SessionV1.ContextOverflowError.isInstance(input.error) || input.result === "compact")
    return { class: "context", eligible: true }
  if (SessionV1.APIError.isInstance(input.error)) {
    const values = codes(input.error)
    const has = (match: (value: string) => boolean) => values.some(match)
    const status = input.error.data.statusCode
    if (status === 401 || status === 402 || status === 403) return { class: "auth", eligible: false }
    if (
      has(
        (value) =>
          value.includes("unauthorized") ||
          value.includes("authentication") ||
          value.includes("authorization") ||
          value.includes("forbidden") ||
          value === "permission_denied",
      )
    ) {
      return { class: "auth", eligible: false }
    }
    if (
      has(
        (value) =>
          value.includes("billing") ||
          value.includes("quota") ||
          value === "usage_not_included" ||
          value === "freeusagelimiterror" ||
          value === "gousagelimiterror",
      )
    ) {
      return { class: "billing", eligible: false }
    }
    if (has((value) => value.includes("content_filter") || value.includes("safety"))) {
      return { class: "content_filter", eligible: false }
    }
    if (has((value) => value.includes("cancel") || value.includes("abort"))) {
      return { class: "cancelled", eligible: false }
    }
    if (has((value) => value.includes("invalid") || value.includes("validation") || value === "bad_request")) {
      return { class: "validation", eligible: false }
    }
    if (values.includes("model_not_found")) return { class: "model_not_found", eligible: true }
    if (
      values.some((value) =>
        ["model_usage_limit", "model_rate_limit_exceeded", "model_unavailable_usage_limit"].includes(value),
      )
    ) {
      return { class: "usage", eligible: true }
    }
    if (status !== undefined && status >= 500 && status <= 599) return { class: "server", eligible: true }
    if (input.error.data.isRetryable) return { class: "retry_exhausted", eligible: true }
  }
  return undefined
}

function used(message: SessionV1.Assistant) {
  return Object.values(message.tokens).some((value) =>
    typeof value === "number" ? Number.isFinite(value) && value > 0 : Object.values(value).some((token) => token > 0),
  )
}

function validate(input: {
  message: SessionV1.WithParts
  cause: unknown
  model: Provider.Model
  result: SessionProcessor.Result
}) {
  if (input.message.info.role !== "assistant") return { class: "incomplete", eligible: false } satisfies Failure
  const failed = failure({
    error: input.message.info.error,
    cause: input.cause,
    model: input.model,
    result: input.result,
  })
  if (failed) return failed
  if (input.result !== "continue") return { class: "incomplete", eligible: false } satisfies Failure
  if (!Number.isFinite(input.model.limit.context) || input.model.limit.context <= 0 || !used(input.message.info)) {
    return { class: "usage", eligible: true } satisfies Failure
  }
  if (!input.message.info.finish || input.message.info.finish === "content-filter") {
    return {
      class: input.message.info.finish === "content-filter" ? "content_filter" : "incomplete",
      eligible: false,
    } satisfies Failure
  }
  if (!summaryText(input.message)) return { class: "incomplete", eligible: false } satisfies Failure
  return undefined
}

function summaryText(message: SessionV1.WithParts) {
  const text = message.parts
    .filter((part): part is SessionV1.TextPart => part.type === "text")
    .map((part) => part.text.trim())
    .filter(Boolean)
    .join("\n\n")
    .trim()
  return text || undefined
}

function completedCompactions(messages: SessionV1.WithParts[]) {
  const users = new Map<MessageID, number>()
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i]
    if (msg.info.role !== "user") continue
    if (!msg.parts.some((part) => part.type === "compaction")) continue
    users.set(msg.info.id, i)
  }

  return messages.flatMap((msg, assistantIndex): CompletedCompaction[] => {
    if (msg.info.role !== "assistant") return []
    if (!msg.info.summary || !msg.info.finish || msg.info.error) return []
    const userIndex = users.get(msg.info.parentID)
    if (userIndex === undefined) return []
    return [{ userIndex, assistantIndex, summary: summaryText(msg) }]
  })
}

function preserveRecentBudget(input: { cfg: ConfigV1.Info; model: Provider.Model }) {
  return (
    input.cfg.compaction?.preserve_recent_tokens ??
    Math.min(MAX_PRESERVE_RECENT_TOKENS, Math.max(MIN_PRESERVE_RECENT_TOKENS, Math.floor(usable(input) * 0.25)))
  )
}

function turns(messages: SessionV1.WithParts[]) {
  const result: Turn[] = []
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i]
    if (msg.info.role !== "user") continue
    if (msg.parts.some((part) => part.type === "compaction")) continue
    result.push({
      start: i,
      end: messages.length,
      id: msg.info.id,
    })
  }
  for (let i = 0; i < result.length - 1; i++) {
    result[i].end = result[i + 1].start
  }
  return result
}

function splitTurn(input: {
  messages: SessionV1.WithParts[]
  turn: Turn
  model: Provider.Model
  budget: number
  estimate: (input: { messages: SessionV1.WithParts[]; model: Provider.Model }) => Effect.Effect<number>
}) {
  return Effect.gen(function* () {
    if (input.budget <= 0) return undefined
    if (input.turn.end - input.turn.start <= 1) return undefined
    for (let start = input.turn.start + 1; start < input.turn.end; start++) {
      const size = yield* input.estimate({
        messages: input.messages.slice(start, input.turn.end),
        model: input.model,
      })
      if (size > input.budget) continue
      return {
        start,
        id: input.messages[start]!.info.id,
      } satisfies Tail
    }
    return undefined
  })
}

export interface Interface {
  readonly isOverflow: (input: {
    tokens: SessionV1.Assistant["tokens"]
    model: Provider.Model
  }) => Effect.Effect<boolean>
  readonly prune: (input: { sessionID: SessionID }) => Effect.Effect<void>
  readonly process: (input: {
    parentID: MessageID
    messages: SessionV1.WithParts[]
    sessionID: SessionID
    auto: boolean
    overflow?: boolean
  }) => Effect.Effect<"continue" | "stop">
  readonly create: (input: {
    sessionID: SessionID
    agent: string
    model: { providerID: ProviderV2.ID; modelID: ModelV2.ID }
    auto: boolean
    overflow?: boolean
  }) => Effect.Effect<void>
}

export class Service extends Context.Service<Service, Interface>()("@slopcode/SessionCompaction") {}

export const use = serviceUse(Service)

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const config = yield* Config.Service
    const session = yield* Session.Service
    const agents = yield* Agent.Service
    const plugin = yield* Plugin.Service
    const processors = yield* SessionProcessor.Service
    const provider = yield* Provider.Service
    const events = yield* EventV2Bridge.Service
    const flags = yield* RuntimeFlags.Service

    const isOverflow = Effect.fn("SessionCompaction.isOverflow")(function* (input: {
      tokens: SessionV1.Assistant["tokens"]
      model: Provider.Model
    }) {
      return overflow({
        cfg: yield* config.get(),
        tokens: input.tokens,
        model: input.model,
        outputTokenMax: flags.outputTokenMax,
      })
    })

    const estimate = Effect.fn("SessionCompaction.estimate")(function* (input: {
      messages: SessionV1.WithParts[]
      model: Provider.Model
    }) {
      const msgs = yield* MessageV2.toModelMessagesEffect(input.messages, input.model)
      return Token.estimate(JSON.stringify(msgs))
    })

    const select = Effect.fn("SessionCompaction.select")(function* (input: {
      messages: SessionV1.WithParts[]
      cfg: ConfigV1.Info
      model: Provider.Model
    }) {
      const limit = input.cfg.compaction?.tail_turns ?? DEFAULT_TAIL_TURNS
      if (limit <= 0) return { head: input.messages, tail_start_id: undefined }
      const budget = preserveRecentBudget({ cfg: input.cfg, model: input.model })
      const all = turns(input.messages)
      if (!all.length) return { head: input.messages, tail_start_id: undefined }
      const recent = all.slice(-limit)
      const sizes = yield* Effect.forEach(
        recent,
        (turn) =>
          estimate({
            messages: input.messages.slice(turn.start, turn.end),
            model: input.model,
          }),
        { concurrency: 1 },
      )

      let total = 0
      let keep: Tail | undefined
      for (let i = recent.length - 1; i >= 0; i--) {
        const turn = recent[i]!
        const size = sizes[i]
        if (total + size <= budget) {
          total += size
          keep = { start: turn.start, id: turn.id }
          continue
        }
        const remaining = budget - total
        const split = yield* splitTurn({
          messages: input.messages,
          turn,
          model: input.model,
          budget: remaining,
          estimate,
        })
        if (split) keep = split
        else if (!keep) {
          yield* Effect.logInfo("tail fallback", { budget, size, total })
        }
        break
      }

      if (!keep || keep.start === 0) return { head: input.messages, tail_start_id: undefined }
      return {
        head: input.messages.slice(0, keep.start),
        tail_start_id: keep.id,
      }
    })

    // goes backwards through parts until there are PRUNE_PROTECT tokens worth of tool
    // calls, then erases output of older tool calls to free context space
    const prune = Effect.fn("SessionCompaction.prune")(function* (input: { sessionID: SessionID }) {
      const cfg = yield* config.get()
      if (!cfg.compaction?.prune) return
      yield* Effect.logInfo("pruning")

      const msgs = yield* session
        .messages({ sessionID: input.sessionID })
        .pipe(Effect.catchIf(NotFoundError.isInstance, () => Effect.succeed(undefined)))
      if (!msgs) return

      let total = 0
      let pruned = 0
      const toPrune: SessionV1.ToolPart[] = []
      let turns = 0

      loop: for (let msgIndex = msgs.length - 1; msgIndex >= 0; msgIndex--) {
        const msg = msgs[msgIndex]
        if (msg.info.role === "user") turns++
        if (turns < 2) continue
        if (msg.info.role === "assistant" && msg.info.summary) break loop
        for (let partIndex = msg.parts.length - 1; partIndex >= 0; partIndex--) {
          const part = msg.parts[partIndex]
          if (part.type !== "tool") continue
          if (part.state.status !== "completed") continue
          if (PRUNE_PROTECTED_TOOLS.includes(part.tool)) continue
          if (part.state.time.compacted) break loop
          const estimate = Token.estimate(part.state.output)
          total += estimate
          if (total <= PRUNE_PROTECT) continue
          pruned += estimate
          toPrune.push(part)
        }
      }

      yield* Effect.logInfo("found", { pruned, total })
      if (pruned > PRUNE_MINIMUM) {
        for (const part of toPrune) {
          if (part.state.status === "completed") {
            part.state.time.compacted = Date.now()
            yield* session.updatePart(part)
          }
        }
        yield* Effect.logInfo("pruned", { count: toPrune.length })
      }
    })

    const processCompaction = Effect.fn("SessionCompaction.process")(function* (input: {
      parentID: MessageID
      messages: SessionV1.WithParts[]
      sessionID: SessionID
      auto: boolean
      overflow?: boolean
    }) {
      const parent = input.messages.findLast((m) => m.info.id === input.parentID)
      if (!parent || parent.info.role !== "user") {
        throw new Error(`Compaction parent must be a user message: ${input.parentID}`)
      }
      const userMessage = parent.info
      const compactionPart = parent.parts.find((part): part is SessionV1.CompactionPart => part.type === "compaction")

      let messages = input.messages
      let replay:
        | {
            info: SessionV1.User
            parts: SessionV1.Part[]
          }
        | undefined
      if (input.overflow) {
        const idx = input.messages.findIndex((m) => m.info.id === input.parentID)
        for (let i = idx - 1; i >= 0; i--) {
          const msg = input.messages[i]
          if (msg.info.role === "user" && !msg.parts.some((p) => p.type === "compaction")) {
            replay = { info: msg.info, parts: msg.parts }
            messages = input.messages.slice(0, i)
            break
          }
        }
        const hasContent =
          replay && messages.some((m) => m.info.role === "user" && !m.parts.some((p) => p.type === "compaction"))
        if (!hasContent) {
          replay = undefined
          messages = input.messages
        }
      }

      const agent = yield* agents.get("compaction")
      const original = agent.model ?? userMessage.model
      const currentRef = Effect.fnUntraced(function* () {
        const info = yield* session.get(input.sessionID).pipe(Effect.orDie)
        const latest = yield* session
          .findMessage(
            input.sessionID,
            (item) => item.info.role === "user" && !item.parts.some((part) => part.type === "compaction"),
          )
          .pipe(Effect.orDie)
        if (latest._tag === "Some" && latest.value.info.role === "user" && latest.value.info.id > input.parentID) {
          return latest.value.info.model
        }
        if (info.model) return { providerID: info.model.providerID, modelID: info.model.id }
        if (latest._tag === "Some" && latest.value.info.role === "user") return latest.value.info.model
        return userMessage.model
      })
      const current = yield* currentRef()
      const historical =
        input.auto &&
        !agent.model &&
        (original.providerID !== current.providerID || original.modelID !== current.modelID)
      const originalExit = yield* provider.getModel(original.providerID, original.modelID).pipe(Effect.exit)
      const missing = Exit.isFailure(originalExit)
      if (missing && !historical) return yield* Effect.die(Cause.squash(originalExit.cause))
      const recoveryRef = missing ? yield* currentRef() : current
      const recovery =
        missing && historical
          ? yield* provider.getModel(recoveryRef.providerID, recoveryRef.modelID).pipe(Effect.orDie)
          : undefined
      const first = Exit.isSuccess(originalExit) ? originalExit.value : recovery!
      const cfg = yield* config.get()
      const history = compactionPart && messages.at(-1)?.info.id === input.parentID ? messages.slice(0, -1) : messages
      const prior = completedCompactions(history)
      const hidden = new Set(prior.flatMap((item) => [item.userIndex, item.assistantIndex]))
      const previousSummary = prior.at(-1)?.summary
      const selected = yield* select({
        messages: history.filter((_, index) => !hidden.has(index)),
        cfg,
        model: first,
      })
      // Allow plugins to inject context or replace compaction prompt.
      const compacting = yield* plugin.trigger(
        "experimental.session.compacting",
        { sessionID: input.sessionID },
        { context: [], prompt: undefined },
      )
      const nextPrompt = compacting.prompt ?? buildPrompt({ previousSummary, context: compacting.context })
      const msgs = structuredClone(selected.head)
      yield* plugin.trigger("experimental.chat.messages.transform", {}, { messages: msgs })
      const tailIndex = selected.tail_start_id
        ? history.findIndex((message) => message.info.id === selected.tail_start_id)
        : -1
      const recent =
        tailIndex < 0
          ? ""
          : JSON.stringify(
              yield* MessageV2.toModelMessagesEffect(history.slice(tailIndex), first, {
                stripMedia: true,
                toolOutputMaxChars: TOOL_OUTPUT_MAX_CHARS,
              }),
            )
      const ctx = yield* InstanceState.context
      const attempt = Effect.fn("SessionCompaction.attempt")(function* (model: Provider.Model, bounded: boolean) {
        const msg: SessionV1.Assistant = {
          id: MessageID.ascending(),
          role: "assistant",
          parentID: input.parentID,
          sessionID: input.sessionID,
          mode: "compaction",
          agent: "compaction",
          variant: userMessage.model.variant,
          summary: true,
          path: { cwd: ctx.directory, root: ctx.worktree },
          cost: 0,
          tokens: { output: 0, input: 0, reasoning: 0, cache: { read: 0, write: 0 } },
          modelID: model.id,
          providerID: model.providerID,
          time: { created: Date.now() },
        }
        return yield* Effect.uninterruptibleMask((restore) =>
          Effect.gen(function* () {
            yield* session.updateMessage(msg)
            const output = yield* restore(
              Effect.gen(function* () {
                const processor = yield* processors.create({
                  assistantMessage: msg,
                  sessionID: input.sessionID,
                  model,
                  retry: bounded ? false : undefined,
                })
                const result = yield* processor.process({
                  user: userMessage,
                  agent,
                  sessionID: input.sessionID,
                  tools: {},
                  system: [],
                  messages: [
                    ...(yield* MessageV2.toModelMessagesEffect(msgs, model, {
                      stripMedia: true,
                      toolOutputMaxChars: TOOL_OUTPUT_MAX_CHARS,
                    })),
                    { role: "user", content: [{ type: "text", text: nextPrompt }] },
                  ],
                  model,
                })
                return { msg, processor, result, model }
              }),
            ).pipe(Effect.onInterrupt(() => session.removeMessage({ sessionID: input.sessionID, messageID: msg.id })))
            if (!bounded) return { ...output, failure: undefined }
            const saved = (yield* session.messages({ sessionID: input.sessionID }).pipe(Effect.orDie)).find(
              (item) => item.info.id === msg.id,
            )
            const error = validate({
              message: { info: output.processor.message, parts: saved?.parts ?? [] },
              cause: output.processor.failure,
              model,
              result: output.result,
            })
            if (error) yield* session.removeMessage({ sessionID: input.sessionID, messageID: msg.id })
            return { ...output, failure: error }
          }),
        )
      })

      let originalAttempt = missing ? undefined : yield* attempt(first, historical)
      const originalFailure =
        originalAttempt?.failure ?? (missing ? { class: "model_not_found", eligible: true } : undefined)

      if (originalFailure && historical) {
        const latest = yield* currentRef()
        const same = latest.providerID === original.providerID && latest.modelID === original.modelID
        yield* Effect.logWarning("historical compaction recovery", {
          original: `${original.providerID}/${original.modelID}`,
          current: `${latest.providerID}/${latest.modelID}`,
          failure: originalFailure.class,
          attempt: 1,
        })
        if (same || !originalFailure.eligible) return "stop"
        const model = yield* provider.getModel(latest.providerID, latest.modelID).pipe(Effect.orDie)
        const fallback = yield* attempt(model, true)
        if (fallback.failure) {
          yield* Effect.logWarning("historical compaction recovery", {
            original: `${original.providerID}/${original.modelID}`,
            current: `${model.providerID}/${model.id}`,
            failure: fallback.failure.class,
            attempt: 2,
          })
          return "stop"
        }
        originalAttempt = fallback
      }

      if (!originalAttempt) return "stop"
      const { msg, processor, result, model } = originalAttempt

      if (result === "compact") {
        processor.message.error = new SessionV1.ContextOverflowError({
          message: replay
            ? "Conversation history too large to compact - exceeds model context limit"
            : "Session too large to compact - context exceeds model limit even after stripping media",
        }).toObject()
        processor.message.finish = "error"
        yield* session.updateMessage(processor.message)
        return "stop"
      }

      if (compactionPart && selected.tail_start_id && compactionPart.tail_start_id !== selected.tail_start_id) {
        yield* session.updatePart({
          ...compactionPart,
          tail_start_id: selected.tail_start_id,
        })
      }

      if (result === "continue" && input.auto) {
        if (replay) {
          const original = replay.info
          const replayMsg = yield* session.updateMessage({
            id: MessageID.ascending(),
            role: "user",
            sessionID: input.sessionID,
            time: { created: Date.now() },
            agent: original.agent,
            model: original.model,
            format: original.format,
            tools: original.tools,
            system: original.system,
          })
          for (const part of replay.parts) {
            if (part.type === "compaction") continue
            const replayPart =
              part.type === "file" && MessageV2.isMedia(part.mime)
                ? { type: "text" as const, text: `[Attached ${part.mime}: ${part.filename ?? "file"}]` }
                : part
            yield* session.updatePart({
              ...replayPart,
              id: PartID.ascending(),
              messageID: replayMsg.id,
              sessionID: input.sessionID,
            })
          }
        }

        if (!replay) {
          const info = yield* provider.getProvider(model.providerID)
          if (
            (yield* plugin.trigger(
              "experimental.compaction.autocontinue",
              {
                sessionID: input.sessionID,
                agent: userMessage.agent,
                model,
                provider: {
                  source: info.source,
                  info,
                  options: info.options,
                },
                message: userMessage,
                overflow: input.overflow === true,
              },
              { enabled: true },
            )).enabled
          ) {
            const followup =
              historical && (model.providerID !== original.providerID || model.id !== original.modelID)
                ? { providerID: model.providerID, modelID: model.id }
                : userMessage.model
            const continueMsg = yield* session.updateMessage({
              id: MessageID.ascending(),
              role: "user",
              sessionID: input.sessionID,
              time: { created: Date.now() },
              agent: userMessage.agent,
              model: followup,
            })
            const text =
              (input.overflow
                ? "The previous request exceeded the provider's size limit due to large media attachments. The conversation was compacted and media files were removed from context. If the user was asking about attached images or files, explain that the attachments were too large to process and suggest they try again with smaller or fewer files.\n\n"
                : "") +
              "Continue if you have next steps, or stop and ask for clarification if you are unsure how to proceed."
            yield* session.updatePart({
              id: PartID.ascending(),
              messageID: continueMsg.id,
              sessionID: input.sessionID,
              type: "text",
              // Internal marker for auto-compaction followups so provider plugins
              // can distinguish them from manual post-compaction user prompts.
              // This is not a stable plugin contract and may change or disappear.
              metadata: { compaction_continue: true },
              synthetic: true,
              text,
              time: {
                start: Date.now(),
                end: Date.now(),
              },
            })
          }
        }
      }

      if (processor.message.error) return "stop"
      if (result === "continue") {
        const summary = summaryText(
          (yield* session.messages({ sessionID: input.sessionID }).pipe(Effect.orDie)).find(
            (item) => item.info.id === msg.id,
          ) ?? {
            info: msg,
            parts: [],
          },
        )
        if (flags.experimentalEventSystem) {
          if (summary)
            yield* events.publish(SessionEvent.Compaction.Ended, {
              sessionID: input.sessionID,
              messageID: SessionMessage.ID.make(input.parentID),
              timestamp: DateTime.makeUnsafe(Date.now()),
              reason: input.auto ? "auto" : "manual",
              text: summary ?? "",
              recent,
            })
        }
        yield* events.publish(Event.Compacted, { sessionID: input.sessionID })
      }
      return result
    })

    const create = Effect.fn("SessionCompaction.create")(function* (input: {
      sessionID: SessionID
      agent: string
      model: { providerID: ProviderV2.ID; modelID: ModelV2.ID }
      auto: boolean
      overflow?: boolean
    }) {
      const msg = yield* session.updateMessage({
        id: MessageID.ascending(),
        role: "user",
        model: input.model,
        sessionID: input.sessionID,
        agent: input.agent,
        time: { created: Date.now() },
      })
      yield* session.updatePart({
        id: PartID.ascending(),
        messageID: msg.id,
        sessionID: msg.sessionID,
        type: "compaction",
        auto: input.auto,
        overflow: input.overflow,
      })
      if (flags.experimentalEventSystem) {
        yield* events.publish(SessionEvent.Compaction.Started, {
          sessionID: input.sessionID,
          messageID: SessionMessage.ID.make(msg.id),
          timestamp: DateTime.makeUnsafe(Date.now()),
          reason: input.auto ? "auto" : "manual",
        })
      }
    })

    return Service.of({
      isOverflow,
      prune,
      process: processCompaction,
      create,
    })
  }),
)

export const defaultLayer = Layer.suspend(() =>
  layer.pipe(
    Layer.provide(Provider.defaultLayer),
    Layer.provide(Session.defaultLayer),
    Layer.provide(SessionProcessor.defaultLayer),
    Layer.provide(Agent.defaultLayer),
    Layer.provide(Plugin.defaultLayer),
    Layer.provide(Config.defaultLayer),
    Layer.provide(RuntimeFlags.defaultLayer),
    Layer.provide(EventV2Bridge.defaultLayer),
  ),
)

export const node = LayerNode.make(layer, [
  Config.node,
  Session.node,
  Agent.node,
  Plugin.node,
  SessionProcessor.node,
  Provider.node,
  EventV2Bridge.node,
  RuntimeFlags.node,
])

export * as SessionCompaction from "./compaction"
