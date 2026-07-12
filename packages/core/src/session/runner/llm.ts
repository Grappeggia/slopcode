import {
  LLM,
  LLMClient,
  LLMError,
  LLMEvent,
  SystemPart,
  ToolDefinition,
  isContextOverflowFailure,
  type ProviderErrorEvent,
} from "@slopcode-ai/llm"
import { OpenAIProviderOptions } from "@slopcode-ai/llm/providers/openai"
import { Cause, DateTime, Effect, FiberSet, Layer, Option, Schema, Semaphore, Stream } from "effect"
import { AgentV2 } from "../../agent"
import { Config } from "../../config"
import { Database } from "../../database/database"
import { EventV2 } from "../../event"
import { EventTable } from "../../event/sql"
import { Location } from "../../location"
import { ModelV2 } from "../../model"
import { ModelHarness } from "../../model-harness"
import { PermissionV2 } from "../../permission"
import { ProviderV2 } from "../../provider"
import { QuestionV2 } from "../../question"
import { AppProcess } from "../../process"
import { SystemContext } from "../../system-context/index"
import { SystemContextRegistry } from "../../system-context/registry"
import { SkillGuidance } from "../../skill/guidance"
import { ReferenceGuidance } from "../../reference/guidance"
import { ShellCommand } from "../../shell"
import { ToolRegistry } from "../../tool/registry"
import { FINAL_OUTPUT } from "../../tool/registry"
import { ToolOutputStore } from "../../tool-output-store"
import { Wildcard } from "../../util/wildcard"
import { SessionContextEpoch } from "../context-epoch"
import { SessionCompaction } from "../compaction"
import { SessionEvent } from "../event"
import { SessionHistory } from "../history"
import { SessionInput } from "../input"
import { SessionFormat } from "../format"
import { SessionMessage } from "../message"
import { SessionRuntime } from "../runtime"
import { SessionSchema } from "../schema"
import { SessionStore } from "../store"
import { SessionTask } from "../task"
import { eq } from "drizzle-orm"
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
    const appProcess = yield* AppProcess.Service
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
                  .assert({ sessionID, owner: "v2", state: "draining", epoch })
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
          if (tool.name === "task" && !(yield* SessionTask.cancelled(db, sessionID, message.id, tool.id))) {
            const request = yield* SessionTask.request(db, sessionID, message.id, tool.id)
            const prepared = request ? undefined : yield* SessionTask.prepared(db, sessionID, message.id, tool.id)
            if (!request && !prepared) {
              yield* events.publish(SessionEvent.Tool.Failed, {
                sessionID,
                timestamp: yield* DateTime.now,
                assistantMessageID: message.id,
                callID: tool.id,
                error: { type: "unknown", message: "Task has no immutable prepared snapshot" },
                provider: { executed: tool.provider?.executed === true },
              })
              continue
            }
            const materialized = yield* tools.materialize(
              (request ?? prepared)!.permissions,
              (request ?? prepared)!.plan,
            )
            const call = {
              type: "tool-call" as const,
              id: tool.id,
              name: tool.name,
              input:
                tool.state.status === "pending" && typeof tool.state.input === "string"
                  ? yield* Schema.decodeUnknownEffect(Schema.fromJsonString(Schema.Unknown))(tool.state.input).pipe(
                      Effect.orDie,
                    )
                  : tool.state.input,
              ...(tool.toolType === undefined ? {} : { toolType: tool.toolType }),
            } as ToolRegistry.ExecuteInput["call"]
            if (tool.state.status === "pending")
              yield* events.publish(SessionEvent.Tool.CalledV1, {
                sessionID,
                timestamp: yield* DateTime.now,
                assistantMessageID: message.id,
                callID: tool.id,
                tool: tool.name,
                input: call.input as Record<string, unknown>,
                provider: { executed: false },
              })
            const settlement = yield* materialized.settle({
              sessionID,
              agent: (request ?? prepared)!.callerAgent,
              assistantMessageID: message.id,
              call,
              task: request,
              prepared,
            })
            if (settlement.result.type === "error") {
              yield* events.publish(SessionEvent.Tool.Failed, {
                sessionID,
                timestamp: yield* DateTime.now,
                assistantMessageID: message.id,
                callID: tool.id,
                error: {
                  type: "unknown",
                  message:
                    typeof settlement.result.value === "string"
                      ? settlement.result.value
                      : (JSON.stringify(settlement.result.value) ?? "Task execution failed"),
                },
                result: settlement.result.value,
                provider: {
                  executed: tool.provider?.executed === true,
                  ...(tool.provider?.metadata === undefined ? {} : { metadata: tool.provider.metadata }),
                },
              })
              continue
            }
            yield* events.publish(SessionEvent.Tool.Success, {
              sessionID,
              timestamp: yield* DateTime.now,
              assistantMessageID: message.id,
              callID: tool.id,
              structured: settlement.output?.structured ?? {},
              content: settlement.output?.content ?? [],
              outputPaths: settlement.outputPaths,
              result: settlement.result.value,
              provider: {
                executed: tool.provider?.executed === true,
                ...(tool.provider?.metadata === undefined ? {} : { metadata: tool.provider.metadata }),
              },
            })
            continue
          }
          yield* events.publish(
            SessionEvent.Tool.Failed,
            {
              sessionID,
              timestamp: yield* DateTime.now,
              assistantMessageID: message.id,
              callID: tool.id,
              error: { type: "unknown", message: "Tool execution interrupted" },
              provider: {
                executed: tool.provider?.executed === true,
                ...(tool.provider?.metadata === undefined ? {} : { metadata: tool.provider.metadata }),
              },
            },
            tool.name === "task" ? { id: SessionTask.interruptedToolEventID(sessionID, message.id, tool.id) } : undefined,
          )
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

    class StructuredSettled extends Error {}

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
      runtime.assert({ sessionID, owner: "v2", state: "draining", epoch }).pipe(Effect.asVoid)

    class ShellStartLost extends Error {}
    class ShellContinuationStartLost extends Error {}

    const runShell = Effect.fn("SessionRunner.runShell")(function* (
      request: SessionInput.ShellRequest,
      runtimeEpoch: number,
    ) {
      const fenced = fencedEvents(request.sessionID, runtimeEpoch)
      const settle = Effect.fnUntraced(function* (
        result: SessionInput.ShellTerminal,
        expected: "requested" | "started" = "started",
      ) {
        const published = yield* SessionInput.endShell(db, fenced, request, result, expected).pipe(Effect.exit)
        if (published._tag === "Success") return
        yield* SessionInput.endShell(
          db,
          events,
          request,
          {
            status: "interrupted",
            output: "Shell command was interrupted before completion.",
            truncated: false,
          },
          expected,
        )
      })
      if (yield* SessionInput.startedShell(db, request.id))
        return yield* settle({
          status: "unknown",
          output: "Shell command outcome is unknown because execution was interrupted by a runtime restart.",
          truncated: false,
        })

      return yield* Effect.uninterruptibleMask((restore) =>
        Effect.gen(function* () {
          const exit = yield* restore(
            assertRuntime(request.sessionID, runtimeEpoch).pipe(
              Effect.andThen(
                ShellCommand.run(
                  { command: request.command, cwd: location.directory },
                  SessionInput.startShell(db, fenced, request).pipe(
                    Effect.flatMap((started) => (started ? Effect.void : Effect.die(new ShellStartLost()))),
                  ),
                  (spawn) =>
                    db.transaction(
                      () =>
                        assertRuntime(request.sessionID, runtimeEpoch).pipe(
                          Effect.orDie,
                          Effect.andThen(SessionInput.terminalShell(db, request.id)),
                          Effect.flatMap((terminal) => (terminal ? Effect.die(new ShellStartLost()) : spawn)),
                        ),
                      { behavior: "immediate" },
                    ),
                ).pipe(
                  Effect.provideService(Config.Service, config),
                  Effect.provideService(AppProcess.Service, appProcess),
                ),
              ),
            ),
          ).pipe(Effect.exit)
          if (exit._tag === "Success")
            return yield* settle({
              status: exit.value.timedOut ? "timed_out" : "completed",
              output: exit.value.output,
              exitCode: "exitCode" in exit.value ? exit.value.exitCode : undefined,
              truncated: exit.value.truncated,
              stdoutTruncated: "stdoutTruncated" in exit.value ? exit.value.stdoutTruncated : undefined,
              stderrTruncated: "stderrTruncated" in exit.value ? exit.value.stderrTruncated : undefined,
            })
          const failure = Option.getOrUndefined(Cause.findErrorOption(exit.cause))
          if (exit.cause.reasons.some((reason) => Cause.isDieReason(reason) && reason.defect instanceof ShellStartLost))
            return
          if (!(yield* SessionInput.startedShell(db, request.id))) {
            yield* settle(
              {
                status: "interrupted",
                output: "Shell command was interrupted before completion.",
                truncated: false,
              },
              "requested",
            )
            if (Cause.hasInterrupts(exit.cause)) return yield* Effect.interrupt
            return
          }
          yield* settle({
            status: Cause.hasInterrupts(exit.cause) ? "interrupted" : "failed",
            output: Cause.hasInterrupts(exit.cause)
              ? "Shell command was interrupted before completion."
              : failure instanceof AppProcess.AppProcessError && ShellCommand.isTimeout(failure)
                ? `Command exceeded timeout of ${ShellCommand.DEFAULT_TIMEOUT_MS} ms. Retry with a larger timeout if the command is expected to take longer.`
                : "Unable to start shell command.",
            truncated: false,
          })
          if (Cause.hasInterrupts(exit.cause)) return yield* Effect.interrupt
        }),
      )
    })

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
      beforeDispatch?: Effect.Effect<void>,
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
      const latest = context.findLast((message): message is SessionMessage.User => message.type === "user")
      const boundary = context.findLastIndex(
        (message) =>
          message.type === "assistant" && message.time.completed !== undefined && message.structuredRetry === undefined,
      )
      const activity = context
        .slice(boundary + 1)
        .find((message): message is SessionMessage.User => message.type === "user")
      const root =
        activity && latest?.format?.type === "json_schema"
          ? context
              .slice(boundary + 1)
              .find(
                (message): message is SessionMessage.User =>
                  message.type === "user" && SessionFormat.equivalent(message.format, latest.format),
              )
          : undefined
      const format = root?.format?.type === "json_schema" ? root.format : undefined
      const rootIndex = root ? context.lastIndexOf(root) : -1
      const retries =
        rootIndex < 0
          ? 0
          : context.slice(rootIndex + 1).filter((message) => message.type === "assistant" && message.structuredRetry)
              .length
      const attempt = retries + 1
      if (
        format &&
        context
          .slice(rootIndex + 1)
          .some(
            (message) => message.type === "assistant" && (message.structured !== undefined || message.structuredError),
          )
      )
        return false
      const instructions = resolved.harness ? yield* ModelHarness.instructions(resolved.harness) : undefined
      const permissions = [...(agent.info?.permissions ?? []), ...((yield* store.task(session.id))?.ceiling ?? [])]
      const plan = resolved.harness
        ? {
            mode: resolved.harness.tools.mode,
            shell: resolved.harness.tools.shell,
            patch: resolved.harness.tools.patch,
            multiAgent: resolved.harness.multiAgent,
          }
        : {}
      const toolMaterialization = yield* tools.materialize(permissions, {
        ...plan,
        ...(resolved.harness
          ? {
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
          : {}),
      })
      const definitions = format
        ? [
            ...toolMaterialization.definitions,
            new ToolDefinition({
              name: FINAL_OUTPUT,
              description: "Return the final schema-valid response exactly once after all other work is complete.",
              inputSchema: SessionFormat.toolSchema(format),
              metadata: { fingerprint: SessionFormat.fingerprint(format) },
            }),
          ]
        : toolMaterialization.definitions
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
        system: [
          instructions,
          agent.info?.system,
          system.baseline,
          format
            ? "The user requires structured output. Complete any necessary tool work first, then call final_output exactly once. Do not provide the final answer as ordinary text."
            : undefined,
        ]
          .filter((part): part is string => part !== undefined && part.length > 0)
          .map(SystemPart.make),
        messages: toLLMMessages(context, model),
        tools: definitions,
        toolChoice: format ? "required" : undefined,
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
        structured: format !== undefined,
        rootUserID: activity?.id,
      })
      const withPublication = Semaphore.makeUnsafe(1).withPermit
      const publish = (event: LLMEvent, outputPaths: ReadonlyArray<string> = []) =>
        assertRuntime(sessionID, runtimeEpoch).pipe(
          Effect.andThen(withPublication(publisher.publish(event, outputPaths))),
        )
      let overflowFailure: ProviderErrorEvent | undefined
      let structuredSettled = false
      let structuredValid = false
      const structuredEvent = Effect.fnUntraced(function* (id: EventV2.ID) {
        return yield* db.select().from(EventTable).where(eq(EventTable.id, id)).get().pipe(Effect.orDie)
      })
      const dispatchCommit = (fingerprint: string) =>
        Effect.gen(function* () {
          const terminal = yield* structuredEvent(SessionFormat.terminalID(session.id, root!.id))
          if (terminal) return yield* Effect.die("Structured dispatch commit lost")
          const previous =
            attempt === 1
              ? undefined
              : yield* structuredEvent(SessionFormat.retryID(session.id, root!.id, attempt - 1))
          if (
            attempt > 1 &&
            (!previous || previous.type !== `${SessionEvent.Structured.Retry.type}.1` ||
              !Object.hasOwn(previous.data, "rootUserID") || previous.data.rootUserID !== root!.id)
          )
            return yield* Effect.die("Structured dispatch has no matching retry")
          if (fingerprint !== SessionFormat.fingerprint(format!))
            return yield* Effect.die("Structured dispatch contract changed")
        })
      const attemptCommit = (fingerprint: string) =>
        Effect.gen(function* () {
          const [dispatch, terminal] = yield* Effect.all([
            structuredEvent(SessionFormat.dispatchID(session.id, root!.id, attempt)),
            structuredEvent(SessionFormat.terminalID(session.id, root!.id)),
          ])
          if (
            !dispatch ||
            terminal ||
            dispatch.type !== `${SessionEvent.Structured.Dispatched.type}.1` ||
            !Object.hasOwn(dispatch.data, "fingerprint") ||
            dispatch.data.fingerprint !== fingerprint
          )
            return yield* Effect.die("Structured attempt commit lost")
        })
      const terminalCommit = (candidate: EventV2.ID, fingerprint: string) =>
        Effect.gen(function* () {
          const [dispatch, recorded, terminal] = yield* Effect.all([
            structuredEvent(SessionFormat.dispatchID(session.id, root!.id, attempt)),
            structuredEvent(candidate),
            structuredEvent(SessionFormat.terminalID(session.id, root!.id)),
          ])
          if (
            !dispatch ||
            dispatch.type !== `${SessionEvent.Structured.Dispatched.type}.1` ||
            !recorded ||
            terminal ||
            recorded.type !== `${SessionEvent.Structured.Candidate.type}.1` ||
            !Object.hasOwn(recorded.data, "fingerprint") ||
            recorded.data.fingerprint !== fingerprint
          )
            return yield* Effect.die("Structured terminal commit lost")
        })
      const settleStructured = Effect.fnUntraced(function* (
        assistantMessageID: SessionMessage.ID,
        reason: typeof SessionEvent.Structured.FailureReason.Type,
      ) {
        if (!format || !root) return
        const remaining = Math.max(0, format.retry_count - attempt + 1)
        const message =
          reason === "missing-final"
            ? "Call final_output exactly once with a value matching the requested schema."
            : "Call final_output again with a valid value matching the requested schema."
        if (remaining > 0) {
          yield* events.publish(
            SessionEvent.Structured.Retry,
            {
              sessionID: session.id,
              timestamp: yield* DateTime.now,
              rootUserID: root.id,
              assistantMessageID,
              attempt,
              remaining,
              reason,
              message,
            },
            {
              id: SessionFormat.retryID(session.id, root.id, attempt),
              commit: () => attemptCommit(SessionFormat.fingerprint(format)),
            },
          )
          structuredSettled = true
          return
        }
        yield* events.publish(
          SessionEvent.Structured.Failed,
          {
            sessionID: session.id,
            timestamp: yield* DateTime.now,
            rootUserID: root.id,
            assistantMessageID,
            reason,
            attempts: attempt,
            retryCount: format.retry_count,
            exhausted: true,
            message: "Structured output attempts were exhausted without a valid final value.",
          },
          {
            id: SessionFormat.terminalID(session.id, root.id),
            ...(reason === "missing-final"
              ? { commit: () => attemptCommit(SessionFormat.fingerprint(format)) }
              : {
                  commit: () =>
                    terminalCommit(
                      SessionFormat.candidateID(session.id, root.id, attempt),
                      SessionFormat.fingerprint(format),
                    ),
                }),
          },
        )
        structuredSettled = true
      })
      if (format && root) {
        const terminal = yield* db
          .select({ id: EventTable.id })
          .from(EventTable)
          .where(eq(EventTable.id, SessionFormat.terminalID(session.id, root.id)))
          .get()
          .pipe(Effect.orDie)
        if (terminal) return false
        const candidateID = SessionFormat.candidateID(session.id, root.id, attempt)
        const recorded = yield* db.select().from(EventTable).where(eq(EventTable.id, candidateID)).get().pipe(Effect.orDie)
        if (recorded?.type === `${SessionEvent.Structured.Candidate.type}.1`) {
          const candidate = yield* Schema.decodeUnknownEffect(SessionEvent.Structured.Candidate.data)(recorded.data).pipe(
            Effect.orDie,
          )
          const value =
            !candidate.invalid && candidate.fingerprint === SessionFormat.fingerprint(format)
              ? yield* SessionFormat.safeValue(candidate.value).pipe(Effect.option)
              : Option.none()
          if (Option.isSome(value) && SessionFormat.validate(format, value.value)) {
            yield* events.publish(
              SessionEvent.Structured.Result,
              {
                sessionID: session.id,
                timestamp: yield* DateTime.now,
                rootUserID: root.id,
                assistantMessageID: candidate.assistantMessageID,
                value: value.value,
                attempts: attempt,
                retryCount: format.retry_count,
              },
              {
                id: SessionFormat.terminalID(session.id, root.id),
                commit: () => terminalCommit(candidateID, candidate.fingerprint),
              },
            )
            return false
          }
          yield* settleStructured(
            candidate.assistantMessageID,
            candidate.fingerprint === SessionFormat.fingerprint(format)
              ? candidate.invalid
                ? (candidate.invalidReason ?? "value-limit")
                : "schema"
              : "stale",
          )
          return attempt <= format.retry_count
        }
        const dispatched = yield* structuredEvent(SessionFormat.dispatchID(session.id, root.id, attempt))
        if (dispatched?.type === `${SessionEvent.Structured.Dispatched.type}.1`) {
          const data = yield* Schema.decodeUnknownEffect(SessionEvent.Structured.Dispatched.data)(dispatched.data).pipe(
            Effect.orDie,
          )
          const assistantMessageID = SessionFormat.recoveryMessageID(session.id, root.id, attempt)
          const stepID = SessionFormat.recoveryStepID(session.id, root.id, attempt)
          if (!(yield* structuredEvent(stepID)))
            yield* events.publish(
              SessionEvent.Step.Started,
              {
                sessionID: session.id,
                assistantMessageID,
                rootUserID: root.id,
                timestamp: yield* DateTime.now,
                agent: agent.id,
                model: {
                  id: ModelV2.ID.make(model.id),
                  providerID: ProviderV2.ID.make(model.provider),
                  ...(session.model?.variant === undefined ? {} : { variant: session.model.variant }),
                },
              },
              { id: stepID },
            )
          yield* settleStructured(
            assistantMessageID,
            data.fingerprint === SessionFormat.fingerprint(format) ? "interrupted" : "stale",
          )
          return attempt <= format.retry_count
        }
      }
      if (!(yield* SessionContextEpoch.current(db, session.id, agent.id, system.revision)))
        return yield* Effect.die(rebuildPreparedTurn())
      if (format && root)
        yield* events.publish(
          SessionEvent.Structured.Dispatched,
          {
            sessionID: session.id,
            rootUserID: root.id,
            timestamp: yield* DateTime.now,
            attempt,
            fingerprint: SessionFormat.fingerprint(format),
          },
          {
            id: SessionFormat.dispatchID(session.id, root.id, attempt),
            commit: () => dispatchCommit(SessionFormat.fingerprint(format)),
          },
        )
      if (beforeDispatch) yield* beforeDispatch
      const providerStream = llm.stream(request).pipe(
        Stream.runForEach((event) =>
          Effect.gen(function* () {
            if (overflowFailure || publisher.hasProviderError()) return
            if (format && root && event.type === "tool-call" && event.name === FINAL_OUTPUT) {
              const assistantMessageID = yield* publisher.startAssistant()
              const candidate = yield* SessionFormat.toolValue(event.input).pipe(Effect.exit)
              yield* events.publish(
                SessionEvent.Structured.Candidate,
                {
                  sessionID: session.id,
                  timestamp: yield* DateTime.now,
                  rootUserID: root.id,
                  assistantMessageID,
                  attempt,
                  fingerprint: SessionFormat.fingerprint(format),
                  ...(candidate._tag === "Success" ? { value: candidate.value } : {}),
                  invalid: candidate._tag === "Failure",
                  ...(candidate._tag === "Failure"
                    ? { invalidReason: Option.getOrThrow(Cause.findErrorOption(candidate.cause)).reason }
                    : {}),
                },
                {
                  id: SessionFormat.candidateID(session.id, root.id, attempt),
                  commit: () => attemptCommit(SessionFormat.fingerprint(format)),
                },
              )
              if (candidate._tag === "Success" && SessionFormat.validate(format, candidate.value)) {
                yield* FiberSet.clear(toolFibers)
                yield* withPublication(publisher.failUnsettledTools("Tool execution interrupted"))
                yield* events.publish(
                  SessionEvent.Structured.Result,
                  {
                    sessionID: session.id,
                    timestamp: yield* DateTime.now,
                    rootUserID: root.id,
                    assistantMessageID,
                    value: candidate.value,
                    attempts: attempt,
                    retryCount: format.retry_count,
                  },
                  {
                    id: SessionFormat.terminalID(session.id, root.id),
                    commit: () =>
                      terminalCommit(
                        SessionFormat.candidateID(session.id, root.id, attempt),
                        SessionFormat.fingerprint(format),
                      ),
                  },
                )
                structuredValid = true
              } else {
                const reason =
                  candidate._tag === "Failure"
                    ? Option.getOrThrow(Cause.findErrorOption(candidate.cause)).reason
                    : "schema"
                yield* settleStructured(assistantMessageID, reason)
              }
              structuredSettled = true
              return yield* Effect.die(new StructuredSettled())
            }
            if (LLMEvent.is.providerError(event)) {
              if (isContextOverflowFailure(event) && !publisher.hasAssistantStarted()) {
                overflowFailure = event
                return
              }
            }
            if (event.type === "tool-call" && !event.providerExecuted && event.name === "task") {
              const assistantMessageID = yield* publisher.startAssistant()
              const input = event.input as {
                readonly description?: unknown
                readonly subagent_type?: unknown
              }
              const selectedID = AgentV2.ID.make(
                typeof input.subagent_type === "string" ? input.subagent_type : "invalid",
              )
              const catalog = yield* agents.all()
              const available = catalog
                .filter((item) => !item.hidden && (item.mode === "subagent" || item.mode === "all"))
                .filter(
                  (item) => PermissionV2.evaluate("task", item.id, toolMaterialization.permissions).effect !== "deny",
                )
                .map((item) => item.id)
              const selected = catalog.find((item) => item.id === selectedID)
              const modelRef =
                selected?.model ??
                ModelV2.Ref.make({
                  id: ModelV2.ID.make(model.id),
                  providerID: ProviderV2.ID.make(model.provider),
                  variant: ModelV2.VariantID.make(session.model?.variant ?? "default"),
                })
              const ceiling = [
                ...toolMaterialization.permissions.filter(
                  (rule) =>
                    rule.effect === "deny" ||
                    (rule.effect === "ask" && Wildcard.match("external_directory", rule.action)),
                ),
                ...(selected?.permissions.some((rule) => rule.action === "task")
                  ? []
                  : [{ action: "task", resource: "*", effect: "deny" as const }]),
                ...(selected?.permissions.some((rule) => rule.action === "todowrite")
                  ? []
                  : [{ action: "todowrite", resource: "*", effect: "deny" as const }]),
              ]
              yield* events.publish(
                SessionEvent.Task.Prepared,
                {
                  sessionID: session.id,
                  timestamp: yield* DateTime.now,
                  assistantMessageID,
                  callID: event.id,
                  input: event.input,
                  callerAgent: agent.id,
                  permissions: toolMaterialization.permissions,
                  plan: { ...plan, multiAgent: plan.multiAgent ?? "v2" },
                  agent: selectedID,
                  available,
                  model: modelRef,
                  projectID: session.projectID,
                  location: session.location,
                  title: `${typeof input.description === "string" ? input.description : "Task"} (@${selectedID} subagent)`,
                  ceiling,
                },
                { id: SessionTask.preparedEventID(session.id, assistantMessageID, event.id) },
              )
            }
            yield* publish(event)
            if (event.type !== "tool-call" || event.providerExecuted) return
            needsContinuation = true
            const assistantMessageID = yield* publisher.assistantMessageID(event.id)
            const prepared =
              event.name === "task"
                ? yield* SessionTask.prepared(db, session.id, assistantMessageID, event.id)
                : undefined
            yield* assertRuntime(sessionID, runtimeEpoch)
            yield* Effect.uninterruptibleMask((restore) =>
              restore(
                toolMaterialization.settle({
                  sessionID: session.id,
                  agent: agent.id,
                  assistantMessageID,
                  call: event,
                  prepared,
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
          const finalStop =
            stream._tag === "Failure" &&
            stream.cause.reasons.some(
              (reason) => Cause.isDieReason(reason) && reason.defect instanceof StructuredSettled,
            )
          if (finalStop) return !structuredValid && format !== undefined && attempt <= format.retry_count
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
          if (stream._tag === "Success" && format && !structuredSettled)
            yield* settleStructured(yield* publisher.startAssistant(), "missing-final")
          if (stream._tag === "Failure") return yield* Effect.failCause(stream.cause)
          if (settled._tag === "Failure") return yield* Effect.failCause(settled.cause)
          return !publisher.hasProviderError() && (needsContinuation || (format !== undefined && attempt <= format.retry_count))
        }),
      )
    }, Effect.scoped)
    type RunTurn = (
      sessionID: SessionSchema.ID,
      promotion: SessionInput.Delivery | undefined,
      runtimeEpoch: number,
      beforeDispatch?: Effect.Effect<void>,
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

    const runTurn: RunTurn = (sessionID, promotion, runtimeEpoch, beforeDispatch) =>
      runTurnAttempt(sessionID, promotion, runtimeEpoch, true, beforeDispatch).pipe(
        Effect.catchDefect(
          Effect.fnUntraced(function* (defect) {
            if (!(defect instanceof TurnTransitionError)) return yield* Effect.die(defect)
            yield* Effect.yieldNow
            if (defect.transition._tag === "ContinueAfterOverflowCompaction")
              return yield* runAfterOverflowCompaction(sessionID, undefined, runtimeEpoch)
            return yield* runTurn(sessionID, defect.transition.promotion, runtimeEpoch, beforeDispatch)
          }),
        ),
      )

    const continueShell = Effect.fn("SessionRunner.continueShell")(function* (
      request: SessionInput.ShellRequest,
      runtimeEpoch: number,
    ) {
      let promotion: SessionInput.Delivery | undefined
      let continuation = true
      for (let step = 0; step < MAX_STEPS && continuation; step++) {
        continuation = yield* runTurn(
          request.sessionID,
          promotion,
          runtimeEpoch,
          step === 0
            ? SessionInput.startShellContinuation(db, fencedEvents(request.sessionID, runtimeEpoch), request).pipe(
                Effect.flatMap((started) => (started ? Effect.void : Effect.die(new ShellContinuationStartLost()))),
              )
            : undefined,
        )
        promotion = "steer"
        yield* assertRuntime(request.sessionID, runtimeEpoch)
        if (!continuation) continuation = yield* SessionInput.hasPending(db, request.sessionID, "steer")
      }
      if (continuation) return yield* new StepLimitExceededError({ sessionID: request.sessionID, limit: MAX_STEPS })
      yield* SessionInput.continueShell(db, fencedEvents(request.sessionID, runtimeEpoch), request)
    })

    const drainShells = Effect.fn("SessionRunner.drainShells")(function* (
      sessionID: SessionSchema.ID,
      runtimeEpoch: number,
    ) {
      let request = yield* SessionInput.pendingShell(db, sessionID)
      while (request) {
        if (request.phase === "execute") yield* runShell(request, runtimeEpoch)
        if (request.phase === "continue") yield* continueShell(request, runtimeEpoch)
        if (request.phase === "settle-continuation")
          yield* SessionInput.settleUnknownShellContinuation(db, fencedEvents(request.sessionID, runtimeEpoch), request)
        request = yield* SessionInput.pendingShell(db, sessionID)
      }
    })

    const run = Effect.fn("SessionRunner.run")(function* (input: {
      readonly sessionID: SessionSchema.ID
      readonly force?: boolean
    }) {
      const shell = yield* SessionInput.pendingShell(db, input.sessionID)
      const owned = yield* runtime.assert({ sessionID: input.sessionID, owner: "v2" }).pipe(Effect.exit)
      if (owned._tag === "Failure") {
        if (shell?.phase === "execute")
          yield* SessionInput.endShell(
            db,
            events,
            shell,
            { status: "failed", output: "Unable to start shell command.", truncated: false },
            "requested",
          )
        return yield* Effect.failCause(owned.cause)
      }
      const owner = owned.value
      const manual = yield* SessionInput.pendingCompaction(db, input.sessionID)
      const hasSteer = yield* SessionInput.hasPending(db, input.sessionID, "steer")
      const hasQueue = hasSteer ? false : yield* SessionInput.hasPending(db, input.sessionID, "queue")
      const task = input.force === true ? false : yield* SessionTask.hasPending(store, input.sessionID)
      if (input.force !== true && !shell && !manual && !hasSteer && !hasQueue && !task) return
      const assigned = yield* runtime
        .assign({
          sessionID: input.sessionID,
          state: "draining",
          expectedOwner: "v2",
          expectedEpoch: owner.epoch,
        })
        .pipe(Effect.exit)
      if (assigned._tag === "Failure") {
        if (shell?.phase === "execute") {
          yield* SessionInput.endShell(
            db,
            events,
            shell,
            { status: "failed", output: "Unable to start shell command.", truncated: false },
            "requested",
          )
        }
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
        if (shell) {
          yield* drainShells(input.sessionID, active.epoch)
          if (yield* SessionInput.hasPendingCompaction(db, input.sessionID))
            yield* drainManualCompactions(input.sessionID, active.epoch)
          return
        }
        if (manual) {
          yield* drainManualCompactions(input.sessionID, active.epoch)
          return
        }
        let promotion: SessionInput.Delivery | undefined = hasSteer ? "steer" : hasQueue ? "queue" : undefined
        let openActivity = input.force === true || hasSteer || hasQueue || task
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
            if (!needsContinuation && (yield* SessionInput.hasPendingShell(db, input.sessionID))) {
              yield* drainShells(input.sessionID, active.epoch)
              if (yield* SessionInput.hasPendingCompaction(db, input.sessionID))
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
