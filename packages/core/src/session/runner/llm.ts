import {
  LLM,
  LLMClient,
  LLMError,
  LLMEvent,
  SystemPart,
  isContextOverflowFailure,
  type ProviderErrorEvent,
} from "@slopcode-ai/llm"
import { OpenAIProviderOptions } from "@slopcode-ai/llm/providers/openai"
import { Cause, DateTime, Effect, FiberSet, Layer, Option, Schema, Semaphore, Stream } from "effect"
import { AgentV2 } from "../../agent"
import { Config } from "../../config"
import { Database } from "../../database/database"
import { EventV2 } from "../../event"
import { Location } from "../../location"
import { ModelV2 } from "../../model"
import { ModelHarness } from "../../model-harness"
import { ProviderV2 } from "../../provider"
import { QuestionV2 } from "../../question"
import { SystemContext } from "../../system-context/index"
import { SystemContextRegistry } from "../../system-context/registry"
import { SkillGuidance } from "../../skill/guidance"
import { ReferenceGuidance } from "../../reference/guidance"
import { ToolRegistry } from "../../tool/registry"
import { ToolOutputStore } from "../../tool-output-store"
import { SessionContextEpoch } from "../context-epoch"
import { SessionCompaction } from "../compaction"
import { SessionEvent } from "../event"
import { SessionHistory } from "../history"
import { SessionInput } from "../input"
import { SessionRuntime } from "../runtime"
import { SessionSchema } from "../schema"
import { SessionStore } from "../store"
import { type RunError, Service, StepLimitExceededError } from "./index"
import { SessionRunnerModel } from "./model"
import { createLLMEventPublisher } from "./publish-llm-event"
import { toLLMMessages } from "./to-llm-message"

/**
 * Runs one durable coding-agent Session until it settles.
 *
 * Keep this as orchestration over smaller collaborators rather than rebuilding the legacy
 * `SessionPrompt` monolith. Implement the unchecked items in small reviewed slices:
 *
 * - Session ownership and controls
 *   - [x] Coordinate one local active drain per Session; explicit resumes join and prompt wakeups coalesce.
 *   - [ ] Replace local ownership with durable multi-node ownership when clustered.
 *   - [ ] Mark busy, retrying, idle, interrupted, or terminal-failure status durably.
 *   - [ ] Honor interruption and reject stale work after runtime attachment replacement.
 *   - [x] Bound model steps.
 *   - [ ] Bound provider retries and repeated identical tool calls.
 *
 * - Runtime context assembly
 *   - Track V1 runtime-context parity canonically in `specs/v2/session.md`.
 *
 * - One provider turn
 *   - [x] Translate every projected V2 Session message variant into canonical
 *     `@slopcode-ai/llm` messages.
 *   - [ ] Resolve policy-filtered built-in, MCP, plugin, and structured-output tool definitions.
 *   - [x] Stream exactly one `llm.stream(request)` provider turn.
 *   - [x] Persist assistant text and usage events incrementally as they arrive.
 *   - [ ] Persist snapshots, patches, and retry notices incrementally as they arrive.
 *   - [x] Persist reasoning, provider errors, and tool-call events incrementally as they arrive.
 *
 * - Tool settlement and continuation
 *   - [x] Durably record each tool call before side effects begin.
 *   - [x] Authorize and execute recorded local calls through a core-owned registry hook.
 *   - [x] Persist typed success, failure, and provider-executed tool outcomes.
 *   - [x] Start each recorded local call eagerly and await all settlements before continuation.
 *   - [ ] Add scoped runtime context, progress updates, attachment normalization,
 *     plugins, and cancellation settlement.
 *   - [x] Reload projected history and start the next explicit provider turn after local tool results.
 *   - [x] Continue for durable user steering accepted during an active provider turn.
 *   - [ ] Continue for compaction or another continuation condition when required.
 *
 * - Post-run maintenance
 *   - [ ] Settle final status and expose durable output events to replayable consumers.
 *   - [ ] Coalesce streamed deltas and add covering projected-history indexes.
 *   - [ ] Update title, summaries, compaction state, and cleanup in bounded background work.
 *
 * Use `llm.stream(request)` for each provider turn. Keep tool execution and continuation here.
 * Durable activity recovery remains a separate future slice with an explicit retry policy.
 *
 * The current slice loads V2 history, translates it, resolves a model through a core service, and persists one
 * provider turn. Registry definitions are advertised, local tool calls are settled durably, and a
 * bounded explicit loop starts the next provider turn after local settlement.
 */

// QUESTION: Did this exist previously, or did we add this limit? Does it make sense?
const MAX_STEPS = 25

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const events = yield* EventV2.Service
    const llm = yield* LLMClient.Service
    const agents = yield* AgentV2.Service
    const tools = yield* ToolRegistry.Service
    const models = yield* SessionRunnerModel.Service
    const store = yield* SessionStore.Service
    const runtime = yield* SessionRuntime.Service
    const location = yield* Location.Service
    const systemContext = yield* SystemContextRegistry.Service
    const skillGuidance = yield* SkillGuidance.Service
    const referenceGuidance = yield* ReferenceGuidance.Service
    const config = yield* Config.Service
    const db = (yield* Database.Service).db
    const documents = yield* config.entries()
    const fencedEvents = (sessionID: SessionSchema.ID, epoch: number): EventV2.Interface => ({
      ...events,
      publish: (definition, data, options) =>
        definition.sync === undefined
          ? events.publish(definition, data, options)
          : events.publish(definition, data, {
              ...options,
              commit: (seq) =>
                runtime
                  .assert({ sessionID, owner: "v2", epoch })
                  .pipe(Effect.andThen(options?.commit?.(seq) ?? Effect.void), Effect.orDie),
            }),
    })
    const getSession = Effect.fn("SessionRunner.getSession")(function* (sessionID: SessionSchema.ID) {
      const session = yield* store.get(sessionID)
      if (!session) return yield* Effect.die(`Session not found: ${sessionID}`)
      return session
    })

    const getContext = Effect.fn("SessionRunner.getContext")(function* (sessionID: SessionSchema.ID) {
      return yield* store.context(sessionID)
    })
    const failInterruptedTools = Effect.fn("SessionRunner.failInterruptedTools")(function* (
      events: EventV2.Interface,
      sessionID: SessionSchema.ID,
    ) {
      for (const message of yield* getContext(sessionID)) {
        if (message.type !== "assistant") continue
        for (const tool of message.content) {
          if (tool.type !== "tool" || (tool.state.status !== "pending" && tool.state.status !== "running")) continue
          yield* events.publish(SessionEvent.Tool.Failed, {
            sessionID,
            timestamp: yield* DateTime.now,
            assistantMessageID: message.id,
            callID: tool.id,
            error: { type: "unknown", message: "Tool execution interrupted" },
            provider: {
              executed: tool.provider?.executed === true,
              ...(tool.provider?.metadata === undefined ? {} : { metadata: tool.provider.metadata }),
            },
          })
        }
      }
    })

    const awaitToolFibers = (fibers: FiberSet.FiberSet<void, ToolOutputStore.Error | SessionRuntime.Error>) =>
      Effect.raceFirst(FiberSet.join(fibers), FiberSet.awaitEmpty(fibers))

    // Match V1: dismissing a question halts the loop instead of becoming model-facing tool output.
    const isQuestionRejected = (cause: Cause.Cause<unknown>) =>
      cause.reasons.some((reason) => Cause.isDieReason(reason) && reason.defect instanceof QuestionV2.RejectedError)

    type TurnTransition =
      // Request preparation observed a concurrent Session change and must restart from durable state.
      | { readonly _tag: "RebuildPreparedTurn"; readonly promotion?: SessionInput.Delivery }
      // Overflow compaction completed; rebuild once through the path without overflow recovery.
      | { readonly _tag: "ContinueAfterOverflowCompaction" }

    class TurnTransitionError extends Error {
      constructor(readonly transition: TurnTransition) {
        super()
      }
    }

    const rebuildPreparedTurn = (promotion?: SessionInput.Delivery) =>
      new TurnTransitionError({ _tag: "RebuildPreparedTurn", promotion })
    const continueAfterOverflowCompaction = new TurnTransitionError({
      _tag: "ContinueAfterOverflowCompaction",
    })

    const retryAgentMismatch = (promotion: SessionInput.Delivery | undefined) =>
      Effect.catchDefect((defect) =>
        defect instanceof SessionContextEpoch.AgentMismatch
          ? Effect.die(rebuildPreparedTurn(promotion))
          : Effect.die(defect),
      )

    const sameModel = Schema.toEquivalence(Schema.UndefinedOr(ModelV2.Ref))
    const loadSystemContext = (agent: AgentV2.Selection) =>
      Effect.all([systemContext.load(), skillGuidance.load(agent), referenceGuidance.load()], {
        concurrency: "unbounded",
      }).pipe(Effect.map(SystemContext.combine))

    const assertRuntime = (sessionID: SessionSchema.ID, epoch: number) =>
      runtime.assert({ sessionID, owner: "v2", epoch }).pipe(Effect.asVoid)

    const runManualCompaction = Effect.fn("SessionRunner.runManualCompaction")(function* (
      request: SessionInput.CompactionRequest,
      runtimeEpoch: number,
    ) {
      const fenced = fencedEvents(request.sessionID, runtimeEpoch)
      const attempt = Effect.gen(function* () {
        yield* assertRuntime(request.sessionID, runtimeEpoch)
        const session = yield* getSession(request.sessionID)
        if (session.location.directory !== location.directory || session.location.workspaceID !== location.workspaceID)
          return yield* Effect.interrupt
        const agent = yield* agents.select(session.agent)
        const guard = () => assertRuntime(request.sessionID, runtimeEpoch).pipe(Effect.orDie)
        const system =
          (yield* SessionContextEpoch.initialize(
            db,
            loadSystemContext(agent),
            session.id,
            session.location,
            agent.id,
            guard,
          )) ??
          (yield* SessionContextEpoch.prepare(
            db,
            fenced,
            loadSystemContext(agent),
            session.id,
            session.location,
            agent.id,
            guard,
          ))
        const resolved = yield* models.resolve(session)
        const result = yield* SessionCompaction.make({ events: fenced, llm, config: documents }).compactManual({
          sessionID: session.id,
          entries: yield* SessionHistory.entriesForRunner(db, session.id, system.baselineSeq),
          model: resolved.model,
          request: LLM.request({ model: resolved.model, messages: [], tools: [] }),
          messageID: request.id,
          instruction: request.instruction,
          terminalID: SessionInput.compactionTerminalEventID(request.id),
        })
        if (result.type === "skipped") return yield* SessionInput.skipCompaction(db, fenced, request)
        if (result.type === "failed") return yield* SessionInput.failCompaction(db, fenced, request, result)
      })

      return yield* Effect.uninterruptibleMask((restore) =>
        Effect.gen(function* () {
          const exit = yield* restore(attempt).pipe(Effect.exit)
          if (exit._tag === "Success") return
          if ((yield* SessionInput.terminalCompaction(db, request.id)) === undefined) {
            const current = yield* runtime
              .assert({ sessionID: request.sessionID, owner: "v2", epoch: runtimeEpoch })
              .pipe(Effect.exit)
            const interrupted = Cause.hasInterrupts(exit.cause)
            yield* SessionInput.failCompaction(db, events, request, {
              reason: interrupted ? "interrupted" : current._tag === "Failure" ? "runtime" : "execution",
              message: interrupted
                ? "Compaction was interrupted"
                : current._tag === "Failure"
                  ? "Session runtime changed during compaction"
                  : "Compaction execution failed",
            })
          }
          return yield* Effect.failCause(exit.cause)
        }),
      )
    })

    const drainManualCompactions = Effect.fn("SessionRunner.drainManualCompactions")(function* (
      sessionID: SessionSchema.ID,
      runtimeEpoch: number,
    ) {
      let request = yield* SessionInput.pendingCompaction(db, sessionID)
      while (request) {
        yield* runManualCompaction(request, runtimeEpoch)
        request = yield* SessionInput.pendingCompaction(db, sessionID)
      }
    })

    const runTurnAttempt = Effect.fn("SessionRunner.runTurn")(function* (
      sessionID: SessionSchema.ID,
      promotion: SessionInput.Delivery | undefined,
      runtimeEpoch: number,
      recoverOverflow = false,
    ) {
      const events = fencedEvents(sessionID, runtimeEpoch)
      const compaction = SessionCompaction.make({ events, llm, config: documents })
      const guard = () => assertRuntime(sessionID, runtimeEpoch).pipe(Effect.orDie)
      yield* assertRuntime(sessionID, runtimeEpoch)
      const session = yield* getSession(sessionID)
      if (session.location.directory !== location.directory || session.location.workspaceID !== location.workspaceID)
        return yield* Effect.interrupt
      yield* assertRuntime(sessionID, runtimeEpoch)
      const agent = yield* agents.select(session.agent)
      const initialized = yield* SessionContextEpoch.initialize(
        db,
        loadSystemContext(agent),
        session.id,
        session.location,
        agent.id,
        guard,
      ).pipe(retryAgentMismatch(promotion))
      const toolFibers = yield* FiberSet.make<void, ToolOutputStore.Error | SessionRuntime.Error>()
      let needsContinuation = false
      if (promotion) {
        const cutoff = yield* SessionInput.latestSeq(db, session.id)
        if (promotion === "steer") yield* SessionInput.promoteSteers(db, events, session.id, cutoff)
        if (promotion === "queue") {
          yield* SessionInput.promoteNextQueued(db, events, session.id)
          yield* SessionInput.promoteSteers(db, events, session.id, cutoff)
        }
      }
      const system =
        initialized ??
        (yield* SessionContextEpoch.prepare(
          db,
          events,
          loadSystemContext(agent),
          session.id,
          session.location,
          agent.id,
          guard,
        ).pipe(retryAgentMismatch(undefined)))
      const current = yield* getSession(sessionID)
      if ((yield* agents.select(current.agent)).id !== agent.id || !sameModel(current.model, session.model))
        return yield* Effect.die(rebuildPreparedTurn())
      const resolved = yield* models.resolve(session)
      const model = resolved.model
      const entries = yield* SessionHistory.entriesForRunner(db, session.id, system.baselineSeq)
      const context = entries.map((entry) => entry.message)
      const instructions = resolved.harness ? yield* ModelHarness.instructions(resolved.harness) : undefined
      const toolMaterialization = yield* tools.materialize(
        agent.info?.permissions,
        resolved.harness
          ? {
              mode: resolved.harness.tools.mode,
              shell: resolved.harness.tools.shell,
              patch: resolved.harness.tools.patch,
              progress: (input, progress) =>
                Effect.gen(function* () {
                  yield* events.publish(SessionEvent.Tool.Progress, {
                    sessionID: input.sessionID,
                    timestamp: yield* DateTime.now,
                    assistantMessageID: input.assistantMessageID,
                    callID: input.call.id,
                    structured: progress,
                    content: [],
                  })
                }),
            }
          : undefined,
      )
      const promptCacheKey = /^ses_[0-9a-f]{64}$/.test(session.id) ? session.id.slice(4) : session.id
      const request = LLM.request({
        model,
        providerOptions: OpenAIProviderOptions.make(
          resolved.harness
            ? {
                promptCacheKey,
                responsesMode: "lite",
                textVerbosity: "low",
                reasoningEffort: resolved.reasoning,
                reasoningSummary: "none",
              }
            : { promptCacheKey },
        ),
        system: [instructions, agent.info?.system, system.baseline]
          .filter((part): part is string => part !== undefined && part.length > 0)
          .map(SystemPart.make),
        messages: toLLMMessages(context, model),
        tools: toolMaterialization.definitions,
      })
      if (yield* compaction.compactIfNeeded({ sessionID: session.id, entries, model, request }))
        return yield* Effect.die(rebuildPreparedTurn())
      const publisher = createLLMEventPublisher(events, {
        sessionID: session.id,
        agent: agent.id,
        model: {
          id: ModelV2.ID.make(model.id),
          providerID: ProviderV2.ID.make(model.provider),
          ...(session.model?.variant === undefined ? {} : { variant: session.model.variant }),
        },
      })
      const withPublication = Semaphore.makeUnsafe(1).withPermit
      const publish = (event: LLMEvent, outputPaths: ReadonlyArray<string> = []) =>
        assertRuntime(sessionID, runtimeEpoch).pipe(
          Effect.andThen(withPublication(publisher.publish(event, outputPaths))),
        )
      let overflowFailure: ProviderErrorEvent | undefined
      if (!(yield* SessionContextEpoch.current(db, session.id, agent.id, system.revision)))
        return yield* Effect.die(rebuildPreparedTurn())
      const providerStream = llm.stream(request).pipe(
        Stream.runForEach((event) =>
          Effect.gen(function* () {
            if (overflowFailure || publisher.hasProviderError()) return
            if (LLMEvent.is.providerError(event)) {
              if (isContextOverflowFailure(event) && !publisher.hasAssistantStarted()) {
                overflowFailure = event
                return
              }
            }
            yield* publish(event)
            if (event.type !== "tool-call" || event.providerExecuted) return
            needsContinuation = true
            const assistantMessageID = yield* publisher.assistantMessageID(event.id)
            yield* assertRuntime(sessionID, runtimeEpoch)
            yield* Effect.uninterruptibleMask((restore) =>
              restore(
                toolMaterialization.settle({
                  sessionID: session.id,
                  agent: agent.id,
                  assistantMessageID,
                  call: event,
                }),
              ).pipe(
                Effect.flatMap((settlement) =>
                  publish(
                    LLMEvent.toolResult({
                      id: event.id,
                      name: event.name,
                      result: settlement.result,
                      output: settlement.output,
                      toolType: event.toolType,
                    }),
                    settlement.outputPaths ?? [],
                  ),
                ),
              ),
            ).pipe(FiberSet.run(toolFibers))
          }),
        ),
        Effect.ensuring(withPublication(publisher.flush())),
      )

      return yield* Effect.uninterruptibleMask((restore) =>
        Effect.gen(function* () {
          const stream = yield* restore(providerStream).pipe(Effect.exit)
          const failure =
            stream._tag === "Failure" ? Option.getOrUndefined(Cause.findErrorOption(stream.cause)) : undefined
          if (
            recoverOverflow &&
            !publisher.hasAssistantStarted() &&
            isContextOverflowFailure(overflowFailure ?? failure) &&
            (yield* restore(compaction.compactAfterOverflow({ sessionID: session.id, entries, model, request })))
          )
            return yield* Effect.die(continueAfterOverflowCompaction)
          if (overflowFailure) yield* publish(overflowFailure)
          const llmFailure = failure instanceof LLMError ? failure : undefined
          if (llmFailure && !publisher.hasProviderError()) {
            yield* withPublication(publisher.failUnsettledTools("Provider did not return a tool result", true))
            yield* withPublication(
              events.publish(SessionEvent.Step.Failed, {
                sessionID: session.id,
                timestamp: yield* DateTime.now,
                assistantMessageID: yield* publisher.startAssistant(),
                error: { type: "unknown", message: llmFailure.reason.message },
              }),
            )
          }
          if (stream._tag === "Failure" && Cause.hasInterrupts(stream.cause)) yield* FiberSet.clear(toolFibers)
          const settled = yield* restore(awaitToolFibers(toolFibers)).pipe(Effect.exit)
          if (settled._tag === "Failure" && isQuestionRejected(settled.cause)) {
            yield* FiberSet.clear(toolFibers)
            yield* withPublication(publisher.failUnsettledTools("Tool execution interrupted"))
            return yield* Effect.interrupt
          }
          if (
            (stream._tag === "Failure" && Cause.hasInterrupts(stream.cause)) ||
            (settled._tag === "Failure" && Cause.hasInterrupts(settled.cause))
          ) {
            yield* FiberSet.clear(toolFibers)
            yield* withPublication(publisher.failUnsettledTools("Tool execution interrupted"))
          }
          if (settled._tag === "Failure" && !Cause.hasInterrupts(settled.cause)) {
            const failure = Cause.squash(settled.cause)
            const message = failure instanceof Error ? failure.message : String(failure)
            yield* withPublication(publisher.failUnsettledTools(`Tool execution failed: ${message}`))
          }
          if (publisher.hasProviderError())
            yield* withPublication(publisher.failUnsettledTools("Tool execution interrupted"))
          if (stream._tag === "Success" && !publisher.hasProviderError())
            yield* withPublication(publisher.failUnsettledTools("Provider did not return a tool result", true))
          if (stream._tag === "Failure") return yield* Effect.failCause(stream.cause)
          if (settled._tag === "Failure") return yield* Effect.failCause(settled.cause)
          return !publisher.hasProviderError() && needsContinuation
        }),
      )
    }, Effect.scoped)
    type RunTurn = (
      sessionID: SessionSchema.ID,
      promotion: SessionInput.Delivery | undefined,
      runtimeEpoch: number,
    ) => Effect.Effect<boolean, RunError>

    const runAfterOverflowCompaction: RunTurn = (sessionID, promotion, runtimeEpoch) =>
      runTurnAttempt(sessionID, promotion, runtimeEpoch).pipe(
        Effect.catchDefect(
          Effect.fnUntraced(function* (defect) {
            if (!(defect instanceof TurnTransitionError)) return yield* Effect.die(defect)
            if (defect.transition._tag === "ContinueAfterOverflowCompaction")
              return yield* Effect.die("Post-compaction provider attempt cannot recover another overflow")
            yield* Effect.yieldNow
            return yield* runAfterOverflowCompaction(sessionID, defect.transition.promotion, runtimeEpoch)
          }),
        ),
      )

    const runTurn: RunTurn = (sessionID, promotion, runtimeEpoch) =>
      runTurnAttempt(sessionID, promotion, runtimeEpoch, true).pipe(
        Effect.catchDefect(
          Effect.fnUntraced(function* (defect) {
            if (!(defect instanceof TurnTransitionError)) return yield* Effect.die(defect)
            yield* Effect.yieldNow
            if (defect.transition._tag === "ContinueAfterOverflowCompaction")
              return yield* runAfterOverflowCompaction(sessionID, undefined, runtimeEpoch)
            return yield* runTurn(sessionID, defect.transition.promotion, runtimeEpoch)
          }),
        ),
      )

    const run = Effect.fn("SessionRunner.run")(function* (input: {
      readonly sessionID: SessionSchema.ID
      readonly force?: boolean
    }) {
      const owner = yield* runtime.assert({ sessionID: input.sessionID, owner: "v2" })
      const manual = yield* SessionInput.pendingCompaction(db, input.sessionID)
      const hasSteer = yield* SessionInput.hasPending(db, input.sessionID, "steer")
      const hasQueue = hasSteer ? false : yield* SessionInput.hasPending(db, input.sessionID, "queue")
      if (input.force !== true && !manual && !hasSteer && !hasQueue) return
      const assigned = yield* runtime
        .assign({
          sessionID: input.sessionID,
          state: "draining",
          expectedOwner: "v2",
          expectedEpoch: owner.epoch,
        })
        .pipe(Effect.exit)
      if (assigned._tag === "Failure") {
        if (manual)
          yield* SessionInput.failCompaction(db, events, manual, {
            reason: "runtime",
            message: "Session runtime changed before compaction started",
          })
        return yield* Effect.failCause(assigned.cause)
      }
      const active = assigned.value
      yield* Effect.gen(function* () {
        yield* failInterruptedTools(fencedEvents(input.sessionID, active.epoch), input.sessionID)
        if (manual) {
          yield* drainManualCompactions(input.sessionID, active.epoch)
          return
        }
        let promotion: SessionInput.Delivery | undefined = hasSteer ? "steer" : hasQueue ? "queue" : undefined
        let openActivity = input.force === true || hasSteer || hasQueue
        while (openActivity) {
          yield* assertRuntime(input.sessionID, active.epoch)
          let needsContinuation = true
          for (let step = 0; step < MAX_STEPS; step++) {
            needsContinuation = yield* runTurn(input.sessionID, promotion, active.epoch)
            promotion = "steer"
            yield* assertRuntime(input.sessionID, active.epoch)
            if (!needsContinuation && (yield* SessionInput.hasPendingCompaction(db, input.sessionID))) {
              yield* drainManualCompactions(input.sessionID, active.epoch)
              return
            }
            if (!needsContinuation) needsContinuation = yield* SessionInput.hasPending(db, input.sessionID, "steer")
            if (!needsContinuation) break
          }
          if (needsContinuation)
            return yield* new StepLimitExceededError({ sessionID: input.sessionID, limit: MAX_STEPS })
          openActivity = yield* SessionInput.hasPending(db, input.sessionID, "queue")
          promotion = openActivity ? "queue" : undefined
        }
      }).pipe(
        Effect.ensuring(
          runtime
            .assign({
              sessionID: input.sessionID,
              state: "ready",
              expectedOwner: "v2",
              expectedEpoch: active.epoch,
            })
            .pipe(Effect.catch(() => Effect.void)),
        ),
      )
    })

    return Service.of({
      run,
    })
  }),
)

export const defaultLayer = layer
