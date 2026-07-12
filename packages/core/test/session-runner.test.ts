import { describe, expect } from "bun:test"
import {
  LLMClient,
  LLMError,
  LLMEvent,
  Model,
  TransportReason,
  InvalidRequestReason,
  type LLMClientShape,
  type LLMRequest,
} from "@slopcode-ai/llm"
import * as OpenAIChat from "@slopcode-ai/llm/protocols/openai-chat"
import * as OpenAIResponses from "@slopcode-ai/llm/protocols/openai-responses"
import { Database } from "@slopcode-ai/core/database/database"
import { EventV2 } from "@slopcode-ai/core/event"
import { PermissionV2 } from "@slopcode-ai/core/permission"
import { EventTable } from "@slopcode-ai/core/event/sql"
import { Project } from "@slopcode-ai/core/project"
import { ProjectTable } from "@slopcode-ai/core/project/sql"
import { QuestionV2 } from "@slopcode-ai/core/question"
import { AbsolutePath } from "@slopcode-ai/core/schema"
import { SessionV2 } from "@slopcode-ai/core/session"
import { ContextSnapshotDecodeError } from "@slopcode-ai/core/session/error"
import { SessionEvent } from "@slopcode-ai/core/session/event"
import { SessionInput } from "@slopcode-ai/core/session/input"
import { SessionRuntime } from "@slopcode-ai/core/session/runtime"
import { SessionMessage } from "@slopcode-ai/core/session/message"
import { SessionFormat } from "@slopcode-ai/core/session/format"
import { SessionCompaction } from "@slopcode-ai/core/session/compaction"
import { FileAttachment, Prompt } from "@slopcode-ai/core/session/prompt"
import { SessionProjector } from "@slopcode-ai/core/session/projector"
import { SessionExecution } from "@slopcode-ai/core/session/execution"
import * as SessionExecutionLocal from "@slopcode-ai/core/session/execution/local"
import { SessionContextEpoch } from "@slopcode-ai/core/session/context-epoch"
import { SessionControl } from "@slopcode-ai/core/session/control"
import { SessionRunCoordinator } from "@slopcode-ai/core/session/run-coordinator"
import { SessionRunner } from "@slopcode-ai/core/session/runner"
import * as SessionRunnerLLM from "@slopcode-ai/core/session/runner/llm"
import { SessionRunnerModel } from "@slopcode-ai/core/session/runner/model"
import { createLLMEventPublisher } from "@slopcode-ai/core/session/runner/publish-llm-event"
import { ToolRegistry } from "@slopcode-ai/core/tool/registry"
import { ToolOutputStore } from "@slopcode-ai/core/tool-output-store"
import { ApplicationTools } from "@slopcode-ai/core/tool/application-tools"
import { AgentV2 } from "@slopcode-ai/core/agent"
import { Config } from "@slopcode-ai/core/config"
import { ConfigCompaction } from "@slopcode-ai/core/config/compaction"
import { Tool } from "@slopcode-ai/core/tool/tool"
import { TaskTool } from "@slopcode-ai/core/tool/task"
import {
  SessionContextEpochTable,
  SessionInputTable,
  SessionMessageTable,
  SessionTable,
} from "@slopcode-ai/core/session/sql"
import { SessionStore } from "@slopcode-ai/core/session/store"
import { SessionTask } from "@slopcode-ai/core/session/task"
import { SystemContext } from "@slopcode-ai/core/system-context"
import { SystemContextRegistry } from "@slopcode-ai/core/system-context/registry"
import { SkillGuidance } from "@slopcode-ai/core/skill/guidance"
import { ReferenceGuidance } from "@slopcode-ai/core/reference/guidance"
import { ModelV2 } from "@slopcode-ai/core/model"
import { ModelHarness } from "@slopcode-ai/core/model-harness"
import { Location } from "@slopcode-ai/core/location"
import { LocationServiceMap } from "@slopcode-ai/core/location-layer"
import { PluginBoot } from "@slopcode-ai/core/plugin/boot"
import { AppProcess } from "@slopcode-ai/core/process"
import { ProviderV2 } from "@slopcode-ai/core/provider"
import { SkillV2 } from "@slopcode-ai/core/skill"
import { Cause, DateTime, Deferred, Effect, Exit, Fiber, Layer, Schema, Stream } from "effect"
import { ChildProcess } from "effect/unstable/process"
import { asc, eq, sql } from "drizzle-orm"
import { testEffect } from "./lib/effect"

const database = Database.layerFromPath(":memory:")
const events = EventV2.layer.pipe(Layer.provide(database))
const questions = QuestionV2.layer.pipe(Layer.provide(events))
const projector = SessionProjector.layer.pipe(Layer.provide(events), Layer.provide(database))
const store = SessionStore.layer.pipe(Layer.provide(database))
const runtime = SessionRuntime.layer.pipe(Layer.provide(database))
const requests: LLMRequest[] = []
let response: LLMEvent[] = []
let responses: LLMEvent[][] | undefined
let responseStream: Stream.Stream<LLMEvent, LLMError> | undefined
let streamGate: Deferred.Deferred<void> | undefined
let streamStarted: Deferred.Deferred<void> | undefined
let streamFailure: LLMError | undefined
let toolExecutionGate: Deferred.Deferred<void> | undefined
let toolExecutionsStarted: Deferred.Deferred<void> | undefined
let toolExecutionsReady = 5
let activeToolExecutions = 0
let maxActiveToolExecutions = 0
const shellRuns: Array<{
  command: string
  cwd?: string
  shell?: string | boolean
  stdin?: ChildProcess.CommandInput
  detached?: boolean
  options?: AppProcess.RunOptions
}> = []
let shellResult: AppProcess.RunResult = {
  command: "mock",
  exitCode: 0,
  stdout: Buffer.from("shell output"),
  stderr: Buffer.alloc(0),
  stdoutTruncated: false,
  stderrTruncated: false,
}
let shellFailure: AppProcess.AppProcessError | undefined
let shellGate: Deferred.Deferred<void> | undefined
let shellStarted: Deferred.Deferred<void> | undefined
let configuredShell: string | undefined
const processLayer = Layer.succeed(
  AppProcess.Service,
  AppProcess.Service.of({
    run: (command: ChildProcess.Command, options?: AppProcess.RunOptions) => {
      const spawn = Effect.gen(function* () {
        if (command._tag !== "StandardCommand") return yield* Effect.die("expected standard shell command")
        shellRuns.push({
          command: command.command,
          cwd: command.options.cwd,
          shell: command.options.shell,
          stdin: command.options.stdin,
          detached: command.options.detached,
          options,
        })
      })
      const execute = Effect.gen(function* () {
        yield* options?.launch ? options.launch(spawn) : spawn
        if (shellStarted) yield* Deferred.succeed(shellStarted, undefined)
        if (shellGate) yield* Deferred.await(shellGate)
        if (shellFailure) return yield* shellFailure
        return shellResult
      })
      return execute
    },
  } as unknown as AppProcess.Interface),
)
const client = Layer.succeed(
  LLMClient.Service,
  LLMClient.Service.of({
    prepare: () => Effect.die("unused"),
    stream: ((request: LLMRequest) => {
      requests.push(request)
      if (responseStream) {
        const stream = responseStream
        responseStream = undefined
        return stream
      }
      const events = streamFailure
        ? Stream.fail(streamFailure)
        : Stream.fromIterable(responses === undefined ? response : (responses.shift() ?? []))
      if (!streamGate) return events
      return Stream.unwrap(
        (streamStarted ? Deferred.succeed(streamStarted, undefined) : Effect.void).pipe(
          Effect.andThen(Deferred.await(streamGate)),
          Effect.as(events),
        ),
      )
    }) as unknown as LLMClientShape["stream"],
    generate: () => Effect.die("unused"),
  }),
)
const model = Model.make({ id: "fake-model", provider: "fake", route: OpenAIChat.route })
const replacementModel = Model.make({ id: "replacement", provider: "fake", route: OpenAIChat.route })
const compactModel = Model.make({
  id: "compact",
  provider: "fake",
  route: OpenAIChat.route.with({ limits: { context: 4_000, output: 50 } }),
})
const recoveryModel = Model.make({
  id: "recovery",
  provider: "fake",
  route: OpenAIChat.route.with({ limits: { context: 20_000, output: 1_000 } }),
})
const authorizations: Tool.Context[] = []
const executions: string[] = []
const permission = Layer.succeed(
  PermissionV2.Service,
  PermissionV2.Service.of({
    assert: (input) => (input.rules ? Effect.void : Effect.die("unused")),
    ask: () => Effect.die("unused"),
    reply: () => Effect.die("unused"),
    get: () => Effect.die("unused"),
    forSession: () => Effect.die("unused"),
    list: () => Effect.die("unused"),
  }),
)
const applications = ApplicationTools.layer
const registry = ToolRegistry.layer.pipe(
  Layer.provide(permission),
  Layer.provide(applications),
  Layer.provide(ToolOutputStore.defaultLayer),
)
const agents = AgentV2.layer
const skills = Layer.mock(SkillV2.Service, { list: () => Effect.succeed([]) })
const boot = Layer.mock(PluginBoot.Service, { wait: () => Effect.void })
const locations = Layer.mock(LocationServiceMap, { get: () => Layer.mergeAll(agents, skills, boot) })
const echo = Layer.effectDiscard(
  ToolRegistry.Service.use((registry) =>
    registry.register({
      echo: Tool.make({
        description: "Echo text",
        input: Schema.Struct({ text: Schema.String }),
        output: Schema.Struct({ text: Schema.String }),
        toModelOutput: ({ output }) => [{ type: "text", text: output.text }],
        execute: ({ text }, context) =>
          Effect.gen(function* () {
            authorizations.push(context)
            executions.push(text)
            activeToolExecutions++
            maxActiveToolExecutions = Math.max(maxActiveToolExecutions, activeToolExecutions)
            if (activeToolExecutions === toolExecutionsReady && toolExecutionsStarted) {
              yield* Deferred.succeed(toolExecutionsStarted, undefined)
            }
            if (toolExecutionGate) yield* Deferred.await(toolExecutionGate)
            return { text }
          }).pipe(Effect.ensuring(Effect.sync(() => activeToolExecutions--))),
      }),
      defect: Tool.make({
        description: "Fail unexpectedly",
        input: Schema.Struct({}),
        output: Schema.Struct({}),
        execute: () => Effect.die("unexpected tool defect"),
      }),
    }),
  ),
).pipe(Layer.provide(registry))
let modelResolveHook = Effect.void
let currentModel = model
let currentCatalog: ModelV2.Info | undefined
const models = SessionRunnerModel.layerWith((session) =>
  modelResolveHook.pipe(
    Effect.andThen(
      currentCatalog
        ? SessionRunnerModel.resolve(session, currentCatalog)
        : Effect.succeed({
            model: session.model?.id === "replacement" ? replacementModel : currentModel,
            catalog: ModelV2.Info.empty(ProviderV2.ID.make(currentModel.provider), ModelV2.ID.make(currentModel.id)),
            harness: undefined,
            reasoning: undefined,
          }),
    ),
  ),
)
const systemContextKey = SystemContext.Key.make("test/context")
let systemBaseline = "Initial context"
let systemRemoved = false
let systemUnavailable = false
let systemLoadHook = Effect.void
const skillBaselines = new Map<AgentV2.ID, string>()
const systemContext = Layer.effectDiscard(
  SystemContextRegistry.Service.pipe(
    Effect.flatMap((registry) =>
      registry.register({
        key: systemContextKey,
        load: Effect.sync(() =>
          SystemContext.combine(
            systemRemoved
              ? []
              : [
                  SystemContext.make({
                    key: systemContextKey,
                    codec: Schema.toCodecJson(Schema.String),
                    load: systemLoadHook.pipe(
                      Effect.andThen(
                        Effect.sync(() => (systemUnavailable ? SystemContext.unavailable : systemBaseline)),
                      ),
                    ),
                    baseline: String,
                    update: (_previous, current) => current,
                    removed: () => "System context source removed: test/context",
                  }),
                ],
          ),
        ),
      }),
    ),
  ),
).pipe(Layer.provideMerge(SystemContextRegistry.layer))
const location = Location.layer({ directory: AbsolutePath.make("/project") }).pipe(Layer.provide(Project.defaultLayer))
const skillGuidance = Layer.mock(SkillGuidance.Service, {
  load: (agent) =>
    Effect.succeed(
      skillBaselines.has(agent.id)
        ? SystemContext.make({
            key: SystemContext.Key.make("test/skill-guidance"),
            codec: Schema.toCodecJson(Schema.String),
            load: Effect.succeed(skillBaselines.get(agent.id)!),
            baseline: String,
            update: (_previous, current) => current,
            removed: () => "Skill guidance removed",
          })
        : SystemContext.empty,
    ),
})
const referenceGuidance = Layer.mock(ReferenceGuidance.Service, { load: () => Effect.succeed(SystemContext.empty) })
const config = Layer.succeed(
  Config.Service,
  Config.Service.of({
    entries: () =>
      Effect.succeed([
        new Config.Document({
          type: "document",
          info: new Config.Info({
            shell: configuredShell,
            compaction: new ConfigCompaction.Info({
              buffer: 3_000,
              keep: new ConfigCompaction.Keep({ tokens: 1_000 }),
            }),
          }),
        }),
      ]),
  }),
)
const runner = SessionRunnerLLM.layer.pipe(
  Layer.provide(database),
  Layer.provide(store),
  Layer.provide(runtime),
  Layer.provide(events),
  Layer.provide(client),
  Layer.provide(registry),
  Layer.provide(models),
  Layer.provide(systemContext),
  Layer.provide(location),
  Layer.provide(agents),
  Layer.provide(skillGuidance),
  Layer.provide(referenceGuidance),
  Layer.provide(config),
  Layer.provide(processLayer),
)
const coordinator = SessionRunCoordinator.layer.pipe(Layer.provide(runner))
const execution = Layer.effect(
  SessionExecution.Service,
  SessionRunCoordinator.Service.pipe(
    Effect.map((coordinator) =>
      SessionExecution.Service.of({
        resume: coordinator.run,
        wake: coordinator.wake,
        wait: coordinator.awaitIdle,
        interrupt: coordinator.interrupt,
      }),
    ),
  ),
).pipe(Layer.provide(coordinator))
const sessions = SessionV2.layer.pipe(
  Layer.provide(events),
  Layer.provide(database),
  Layer.provide(store),
  Layer.provide(Project.defaultLayer),
  Layer.provide(execution),
  Layer.provide(locations),
)
const controls = SessionControl.layer.pipe(Layer.provide(sessions), Layer.provide(runtime))
const it = testEffect(
  Layer.mergeAll(
    database,
    events,
    questions,
    projector,
    store,
    client,
    permission,
    applications,
    agents,
    skills,
    boot,
    locations,
    registry,
    echo,
    models,
    systemContext,
    location,
    skillGuidance,
    config,
    processLayer,
    runner,
    runtime,
    coordinator,
    execution,
    sessions,
    controls,
  ),
)
const sessionID = SessionV2.ID.make("ses_runner_test")
const otherSessionID = SessionV2.ID.make("ses_runner_other")

const insertSession = (id: SessionV2.ID) =>
  Effect.gen(function* () {
    const { db } = yield* Database.Service
    yield* db
      .insert(SessionTable)
      .values({
        id,
        project_id: Project.ID.global,
        slug: id,
        directory: "/project",
        title: "test",
        version: "test",
        runtime: "v2",
      })
      .onConflictDoNothing()
      .run()
      .pipe(Effect.orDie)
  })

const setup = Effect.gen(function* () {
  const { db } = yield* Database.Service
  requests.length = 0
  requests.length = 0
  response = []
  systemBaseline = "Initial context"
  systemRemoved = false
  systemUnavailable = false
  systemLoadHook = Effect.void
  modelResolveHook = Effect.void
  currentModel = model
  currentCatalog = undefined
  skillBaselines.clear()
  responses = undefined
  streamFailure = undefined
  responseStream = undefined
  streamGate = undefined
  streamStarted = undefined
  toolExecutionGate = undefined
  toolExecutionsStarted = undefined
  toolExecutionsReady = 5
  activeToolExecutions = 0
  maxActiveToolExecutions = 0
  shellRuns.length = 0
  shellResult = {
    command: "mock",
    exitCode: 0,
    stdout: Buffer.from("shell output"),
    stderr: Buffer.alloc(0),
    stdoutTruncated: false,
    stderrTruncated: false,
  }
  shellFailure = undefined
  shellGate = undefined
  shellStarted = undefined
  configuredShell = undefined
  yield* db
    .insert(ProjectTable)
    .values({ id: Project.ID.global, worktree: AbsolutePath.make("/project"), sandboxes: [] })
    .onConflictDoNothing()
    .run()
    .pipe(Effect.orDie)
  yield* insertSession(sessionID)
})

const providerUnavailable = () =>
  new LLMError({
    module: "test",
    method: "stream",
    reason: new TransportReason({ message: "Provider unavailable" }),
  })

const setupOverflowRecovery = Effect.gen(function* () {
  yield* setup
  const session = yield* SessionV2.Service
  response = fragmentFixture("text", "text-earlier", ["Earlier answer"]).completeEvents
  yield* session.prompt({
    sessionID,
    prompt: new Prompt({ text: "Earlier question ".repeat(700) }),
    resume: false,
  })
  yield* session.resume(sessionID)
  currentModel = recoveryModel
  requests.length = 0
  return session
})

const setupManualCompaction = Effect.gen(function* () {
  yield* setup
  currentModel = recoveryModel
  const session = yield* SessionV2.Service
  response = fragmentFixture("text", "text-before-manual", ["Earlier answer"]).completeEvents
  yield* session.prompt({
    sessionID,
    prompt: new Prompt({ text: "Short history to preserve" }),
    resume: false,
  })
  yield* session.resume(sessionID)
  requests.length = 0
  return session
})

const userTexts = (request: LLMRequest) =>
  request.messages.flatMap((message) =>
    message.role === "user"
      ? message.content.flatMap((content) => (content.type === "text" ? [content.text] : []))
      : [],
  )

const replaySessionProjection = (id: SessionV2.ID) =>
  Effect.gen(function* () {
    const { db } = yield* Database.Service
    const events = yield* EventV2.Service
    const recorded = yield* db
      .select()
      .from(EventTable)
      .where(eq(EventTable.aggregate_id, id))
      .orderBy(asc(EventTable.seq))
      .all()
      .pipe(Effect.orDie)

    yield* events.remove(id)
    yield* db.delete(SessionInputTable).where(eq(SessionInputTable.session_id, id)).run().pipe(Effect.orDie)
    yield* db.delete(SessionMessageTable).where(eq(SessionMessageTable.session_id, id)).run().pipe(Effect.orDie)
    yield* events.replayAll(
      recorded.map((event) => ({
        id: event.id,
        aggregateID: event.aggregate_id,
        seq: event.seq,
        type: event.type,
        data: event.data,
      })),
    )
  })

type FragmentKind = "text" | "reasoning" | "tool input"

type FragmentFixture = {
  readonly delta: EventV2.Definition
  readonly completeEvents: LLMEvent[]
  readonly partialEvents: LLMEvent[]
  readonly expectedAssistant: unknown
  readonly expectedContent: unknown
}

const fragmentKinds: readonly FragmentKind[] = ["text", "reasoning", "tool input"]

const fragmentID = (kind: FragmentKind, suffix: string) => `${kind === "tool input" ? "call" : kind}-${suffix}`

const fragmentFixture = (kind: FragmentKind, id: string, chunks: readonly string[]): FragmentFixture => {
  const text = chunks.join("")
  switch (kind) {
    case "text": {
      const partialEvents = [
        LLMEvent.stepStart({ index: 0 }),
        LLMEvent.textStart({ id }),
        ...chunks.map((text) => LLMEvent.textDelta({ id, text })),
      ]
      const expectedContent = { type: "text", id, text }
      return {
        delta: SessionEvent.Text.Delta,
        partialEvents,
        completeEvents: [
          ...partialEvents,
          LLMEvent.textEnd({ id }),
          LLMEvent.stepFinish({ index: 0, reason: "stop" }),
          LLMEvent.finish({ reason: "stop" }),
        ],
        expectedAssistant: { type: "assistant", finish: "stop", content: [expectedContent] },
        expectedContent,
      }
    }
    case "reasoning": {
      const partialEvents = [
        LLMEvent.stepStart({ index: 0 }),
        LLMEvent.reasoningStart({ id }),
        ...chunks.map((text) => LLMEvent.reasoningDelta({ id, text })),
      ]
      const expectedContent = { type: "reasoning", id, text }
      return {
        delta: SessionEvent.Reasoning.Delta,
        partialEvents,
        completeEvents: [
          ...partialEvents,
          LLMEvent.reasoningEnd({ id }),
          LLMEvent.stepFinish({ index: 0, reason: "stop" }),
          LLMEvent.finish({ reason: "stop" }),
        ],
        expectedAssistant: { type: "assistant", finish: "stop", content: [expectedContent] },
        expectedContent,
      }
    }
    case "tool input": {
      const partialEvents = [
        LLMEvent.stepStart({ index: 0 }),
        LLMEvent.toolInputStart({ id, name: "echo" }),
        ...chunks.map((text) => LLMEvent.toolInputDelta({ id, name: "echo", text })),
      ]
      const expectedContent = { type: "tool", id, state: { status: "pending", input: text } }
      return {
        delta: SessionEvent.Tool.Input.Delta,
        partialEvents,
        completeEvents: [...partialEvents, LLMEvent.toolInputEnd({ id, name: "echo" })],
        expectedAssistant: { type: "assistant", content: [expectedContent] },
        expectedContent,
      }
    }
  }
}

const verifyEphemeralDeltas = (kind: FragmentKind) =>
  Effect.gen(function* () {
    yield* setup
    const session = yield* SessionV2.Service
    const prompt = `Stream ${kind}`
    const chunks = Array.from({ length: 32 }, (_, index) => `${index},`)
    const fixture = fragmentFixture(kind, fragmentID(kind, "many"), chunks)
    const expectedContext = [{ type: "user", text: prompt }, fixture.expectedAssistant]
    yield* session.prompt({ sessionID, prompt: new Prompt({ text: prompt }), resume: false })
    const events = yield* EventV2.Service
    const live = yield* events.subscribe(fixture.delta).pipe(Stream.take(32), Stream.runCollect, Effect.forkScoped)
    yield* Effect.yieldNow
    response = fixture.completeEvents

    yield* session.resume(sessionID)

    const { db } = yield* Database.Service
    const deltas = yield* db
      .select({ type: EventTable.type })
      .from(EventTable)
      .where(eq(EventTable.type, EventV2.versionedType(fixture.delta.type, 1)))
      .all()
      .pipe(Effect.orDie)
    expect(Array.from(yield* Fiber.join(live))).toHaveLength(32)
    expect(deltas).toHaveLength(0)
    expect(yield* session.context(sessionID)).toMatchObject(expectedContext)

    yield* replaySessionProjection(sessionID)

    expect(yield* session.context(sessionID)).toMatchObject(expectedContext)
  })

const verifyPartialFlushOnFailure = (kind: FragmentKind) =>
  Effect.gen(function* () {
    yield* setup
    const session = yield* SessionV2.Service
    const prompt = `Fail after ${kind}`
    const fixture = fragmentFixture(kind, fragmentID(kind, "partial"), ["Partial"])
    const failure = providerUnavailable()
    yield* session.prompt({ sessionID, prompt: new Prompt({ text: prompt }), resume: false })
    responseStream = Stream.concat(Stream.fromIterable(fixture.partialEvents), Stream.fail(failure))

    expect(yield* session.resume(sessionID).pipe(Effect.flip)).toBe(failure)
    expect(yield* session.context(sessionID)).toMatchObject([
      { type: "user", text: prompt },
      {
        type: "assistant",
        finish: "error",
        error: { type: "unknown", message: "Provider unavailable" },
        content: [fixture.expectedContent],
      },
    ])
  })

const verifyPartialFlushOnInterruption = (kind: FragmentKind) =>
  Effect.gen(function* () {
    yield* setup
    const session = yield* SessionV2.Service
    const prompt = `Interrupt after ${kind}`
    const fixture = fragmentFixture(kind, fragmentID(kind, "interrupted"), ["Partial"])
    const streamed = yield* Deferred.make<void>()
    yield* session.prompt({ sessionID, prompt: new Prompt({ text: prompt }), resume: false })
    responseStream = Stream.concat(
      Stream.fromIterable(fixture.partialEvents),
      Stream.fromEffect(Deferred.succeed(streamed, undefined)).pipe(Stream.flatMap(() => Stream.never)),
    )

    const runner = yield* SessionRunner.Service
    const fiber = yield* runner.run({ sessionID, force: true }).pipe(Effect.forkChild)
    yield* Deferred.await(streamed)
    yield* Fiber.interrupt(fiber)
    expect(yield* session.context(sessionID)).toMatchObject([
      { type: "user", text: prompt },
      {
        type: "assistant",
        content: [
          kind === "tool input"
            ? { type: "tool", id: fragmentID(kind, "interrupted"), state: { status: "error" } }
            : fixture.expectedContent,
        ],
      },
    ])
  })

const catalogModel = (
  id: string,
  api = id,
  packageName = "@ai-sdk/openai",
  efforts: ReadonlyArray<string> = ["low", "medium", "high", "xhigh", "max", "ultra"],
) =>
  new ModelV2.Info({
    id: ModelV2.ID.make(id),
    providerID: ProviderV2.ID.openai,
    name: id,
    api: {
      id: ModelV2.ID.make(api),
      type: "aisdk",
      package: packageName,
      url: packageName === "@ai-sdk/openai-compatible" ? "https://compatible.example/v1" : "https://api.openai.com/v1",
      settings: {},
    },
    capabilities: { tools: true, input: ["text", "image"], output: ["text"] },
    request: {
      headers: {},
      body: {},
      generation: {},
      options: {
        store: false,
        reasoningSummary: "auto",
        include: ["reasoning.encrypted_content"],
      },
    },
    variants: efforts.map((effort) => ({
      id: ModelV2.VariantID.make(effort),
      headers: {},
      body: {},
      generation: {},
      options: { reasoningEffort: effort },
    })),
    time: { released: DateTime.makeUnsafe(0) },
    cost: [],
    status: "active",
    enabled: true,
    limit: { context: 1_050_000, input: 922_000, output: 128_000 },
  })
describe("SessionRunnerLLM", () => {
  const protocols = ["openai-responses", "openai-chat", "anthropic", "gemini", "bedrock"] as const
  const finalSequence = (id: string, input: string, value?: unknown): LLMEvent[] => [
    LLMEvent.toolInputStart({ id, name: "final_output" }),
    LLMEvent.toolInputDelta({ id, name: "final_output", text: input.slice(0, Math.ceil(input.length / 2)) }),
    LLMEvent.toolInputDelta({ id, name: "final_output", text: input.slice(Math.ceil(input.length / 2)) }),
    LLMEvent.toolInputEnd({ id, name: "final_output" }),
    ...(value === undefined
      ? [LLMEvent.toolInputError({ id, name: "final_output", reason: "invalid-json" })]
      : [LLMEvent.toolCall({ id, name: "final_output", input: value })]),
  ]

  for (const protocol of protocols) {
    it.effect(`suppresses the complete ${protocol} final_output lifecycle`, () =>
      Effect.gen(function* () {
        yield* setup
        const session = yield* SessionV2.Service
        const db = (yield* Database.Service).db
        responses = [finalSequence(`${protocol}-valid`, '{"value":{"answer":42}}', { value: { answer: 42 } })]
        yield* session.prompt({
          sessionID,
          prompt: new Prompt({
            text: `${protocol} valid final`,
            format: {
              type: "json_schema",
              schema: { type: "object", properties: { answer: { type: "number" } }, required: ["answer"] },
              retry_count: 0,
            },
          }),
          resume: false,
        })

        yield* session.resume(sessionID)

        const messages = yield* session.messages({ sessionID, order: "asc" })
        const assistant = messages.findLast((message) => message.type === "assistant")
        const rows = yield* db
          .select({ type: EventTable.type, data: EventTable.data })
          .from(EventTable)
          .where(eq(EventTable.aggregate_id, sessionID))
          .orderBy(asc(EventTable.seq))
          .pipe(Effect.orDie)
        expect(assistant).toMatchObject({ structured: { answer: 42 }, content: [] })
        expect(SessionCompaction.serializeMessage(assistant!)).toBe('[Assistant structured]: {"answer":42}')
        expect(rows.filter((row) => row.type.includes(".tool."))).toEqual([])
        expect(JSON.stringify({ messages, rows })).not.toContain("final_output")
        expect(JSON.stringify({ messages, rows })).not.toContain('{"value":{"answer":42}}')
      }),
    )

    it.effect(`suppresses the malformed ${protocol} final_output lifecycle`, () =>
      Effect.gen(function* () {
        yield* setup
        const session = yield* SessionV2.Service
        const db = (yield* Database.Service).db
        responses = [finalSequence(`${protocol}-bad`, "{private-malformed-payload")]
        yield* session.prompt({
          sessionID,
          prompt: new Prompt({
            text: `${protocol} malformed final`,
            format: { type: "json_schema", schema: { type: "number" }, retry_count: 0 },
          }),
          resume: false,
        })

        yield* session.resume(sessionID)

        const messages = yield* session.messages({ sessionID, order: "asc" })
        const assistant = messages.findLast((message) => message.type === "assistant")
        const rows = yield* db
          .select({ type: EventTable.type, data: EventTable.data })
          .from(EventTable)
          .where(eq(EventTable.aggregate_id, sessionID))
          .orderBy(asc(EventTable.seq))
          .pipe(Effect.orDie)
        expect(assistant).toMatchObject({ structuredError: { reason: "invalid-json" }, content: [] })
        expect(SessionCompaction.serializeMessage(assistant!)).toContain("[Assistant structured error]")
        expect(rows.filter((row) => row.type.includes(".tool."))).toEqual([])
        expect(JSON.stringify({ messages, rows })).not.toContain("final_output")
        expect(JSON.stringify({ messages, rows })).not.toContain("private-malformed-payload")
      }),
    )
  }

  it.effect("terminates a structured turn through the reserved direct final tool", () =>
    Effect.gen(function* () {
      yield* setup
      const session = yield* SessionV2.Service
      responses = [
        [
          LLMEvent.textStart({ id: "ignored" }),
          LLMEvent.textDelta({ id: "ignored", text: "must not project" }),
          LLMEvent.textEnd({ id: "ignored" }),
          LLMEvent.toolCall({ id: "final-1", name: "final_output", input: { value: { answer: 42 } } }),
          LLMEvent.textStart({ id: "late" }),
          LLMEvent.textDelta({ id: "late", text: "late text" }),
        ],
      ]
      yield* session.prompt({
        sessionID,
        prompt: new Prompt({
          text: "Return the answer",
          format: {
            type: "json_schema",
            schema: { type: "object", properties: { answer: { type: "number" } }, required: ["answer"] },
            retry_count: 2,
          },
        }),
        resume: false,
      })

      yield* session.resume(sessionID)

      expect(requests).toHaveLength(1)
      expect(requests[0]?.toolChoice).toMatchObject({ type: "required" })
      expect(requests[0]?.responseFormat).toBeUndefined()
      expect(requests[0]?.tools.map((tool) => tool.name)).toEqual(["echo", "defect", "final_output"])
      const messages = yield* session.messages({ sessionID, order: "asc" })
      const assistant = messages.findLast((message) => message.type === "assistant")
      expect(assistant).toMatchObject({ structured: { answer: 42 }, finish: "stop", content: [] })
      expect(JSON.stringify(messages)).not.toContain("must not project")
      expect(JSON.stringify(messages)).not.toContain("late text")

      requests.length = 0
      responses = [fragmentFixture("text", "text-after-structured", ["Plain follow-up"]).completeEvents]
      yield* session.prompt({ sessionID, prompt: new Prompt({ text: "Reply normally" }), resume: false })
      yield* session.resume(sessionID)

      expect(requests).toHaveLength(1)
      expect(requests[0]?.tools.map((tool) => tool.name)).not.toContain("final_output")
      expect(requests[0]?.toolChoice).toBeUndefined()
    }),
  )

  for (const [name, schema, value] of [
    ["scalar", { type: "number" }, 42],
    ["array", { type: "array", items: { type: "number" } }, [1, 2]],
    ["object", { type: "object", properties: { answer: { type: "number" } }, required: ["answer"] }, { answer: 42 }],
  ] as const) {
    it.effect(`wraps and unwraps ${name} structured finals through a portable function schema`, () =>
      Effect.gen(function* () {
        yield* setup
        const session = yield* SessionV2.Service
        responses = [[LLMEvent.toolCall({ id: `final-${name}`, name: "final_output", input: { value } })]]
        yield* session.prompt({
          sessionID,
          prompt: new Prompt({ text: `Return ${name}`, format: { type: "json_schema", schema, retry_count: 0 } }),
          resume: false,
        })

        yield* session.resume(sessionID)

        expect(requests[0]?.tools.find((tool) => tool.name === "final_output")?.inputSchema).toEqual({
          type: "object",
          properties: { value: schema },
          required: ["value"],
          additionalProperties: false,
        })
        expect((yield* session.messages({ sessionID })).find((message) => message.type === "assistant")).toMatchObject({
          structured: value,
        })
      }),
    )
  }

  it.effect("uses exactly the configured additional structured attempts", () =>
    Effect.gen(function* () {
      yield* setup
      const session = yield* SessionV2.Service
      responses = [
        [LLMEvent.toolCall({ id: "final-bad", name: "final_output", input: { value: { answer: "wrong" } } })],
        [LLMEvent.toolCall({ id: "final-good", name: "final_output", input: { value: { answer: 7 } } })],
      ]
      yield* session.prompt({
        sessionID,
        prompt: new Prompt({
          text: "Return a number",
          format: {
            type: "json_schema",
            schema: { type: "object", properties: { answer: { type: "number" } }, required: ["answer"] },
            retry_count: 1,
          },
        }),
        resume: false,
      })

      yield* session.resume(sessionID)

      expect(requests).toHaveLength(2)
      expect(requests[1]?.messages.flatMap((message) => message.content).some((part) => part.type === "tool-call")).toBe(
        true,
      )
      const assistants = (yield* session.messages({ sessionID, order: "asc" })).filter(
        (message) => message.type === "assistant",
      )
      expect(assistants[0]).toMatchObject({ structuredRetry: { attempt: 1, remaining: 1, reason: "schema" } })
      expect(assistants[1]).toMatchObject({ structured: { answer: 7 } })
    }),
  )

  it.effect("persists exhaustion without an extra provider attempt", () =>
    Effect.gen(function* () {
      yield* setup
      const session = yield* SessionV2.Service
      responses = [[]]
      yield* session.prompt({
        sessionID,
        prompt: new Prompt({
          text: "Return a number",
          format: { type: "json_schema", schema: { type: "number" }, retry_count: 0 },
        }),
        resume: false,
      })

      yield* session.resume(sessionID)

      expect(requests).toHaveLength(1)
      expect((yield* session.messages({ sessionID })).find((message) => message.type === "assistant")).toMatchObject({
        structuredError: { reason: "missing-final", attempts: 1, retryCount: 0, exhausted: true },
      })
    }),
  )

  for (const [name, retryCount, total] of [
    ["default", 2, 3],
    ["maximum", 5, 6],
  ] as const) {
    it.effect(`consumes exactly ${name} structured attempt budget`, () =>
      Effect.gen(function* () {
        yield* setup
        const session = yield* SessionV2.Service
        responses = Array.from({ length: total }, () => [])
        yield* session.prompt({
          sessionID,
          prompt: new Prompt({
            text: `Exhaust ${name}`,
            format: { type: "json_schema", schema: { type: "number" }, retry_count: retryCount },
          }),
          resume: false,
        })

        yield* session.resume(sessionID)

        expect(requests).toHaveLength(total)
        expect(
          (yield* session.messages({ sessionID, order: "asc" })).findLast((message) => message.type === "assistant"),
        ).toMatchObject({ structuredError: { attempts: total, retryCount, exhausted: true } })
      }),
    )
  }

  it.effect("distinguishes invalid JSON final arguments from schema mismatch", () =>
    Effect.gen(function* () {
      yield* setup
      const session = yield* SessionV2.Service
      responses = [[LLMEvent.toolCall({ id: "invalid-json", name: "final_output", input: "{" })]]
      yield* session.prompt({
        sessionID,
        prompt: new Prompt({
          text: "Return JSON",
          format: { type: "json_schema", schema: { type: "number" }, retry_count: 0 },
        }),
        resume: false,
      })

      yield* session.resume(sessionID)

      expect((yield* session.messages({ sessionID })).find((message) => message.type === "assistant")).toMatchObject({
        structuredError: { reason: "invalid-json", attempts: 1 },
      })
    }),
  )

  it.effect("retries a malformed protocol final event without aborting the runner stream", () =>
    Effect.gen(function* () {
      yield* setup
      const session = yield* SessionV2.Service
      responses = [
        [LLMEvent.toolInputError({ id: "invalid-json", name: "final_output", reason: "invalid-json" })],
        [LLMEvent.toolCall({ id: "valid-json", name: "final_output", input: { value: 9 } })],
      ]
      yield* session.prompt({
        sessionID,
        prompt: new Prompt({
          text: "Return JSON",
          format: { type: "json_schema", schema: { type: "number" }, retry_count: 1 },
        }),
        resume: false,
      })

      yield* session.resume(sessionID)

      expect(requests).toHaveLength(2)
      expect((yield* session.messages({ sessionID, order: "asc" })).filter((message) => message.type === "assistant")).toMatchObject([
        { structuredRetry: { reason: "invalid-json", attempt: 1, remaining: 1 } },
        { structured: 9 },
      ])
    }),
  )

  it.effect("settles malformed protocol input for ordinary tools without exposing raw input", () =>
    Effect.gen(function* () {
      yield* setup
      const session = yield* SessionV2.Service
      responses = [[LLMEvent.toolInputError({ id: "ordinary-bad", name: "echo", reason: "invalid-json" })]]
      yield* session.prompt({ sessionID, prompt: new Prompt({ text: "Malformed ordinary tool" }), resume: false })

      yield* session.resume(sessionID)

      const assistant = (yield* session.messages({ sessionID })).find((message) => message.type === "assistant")
      expect(assistant).toMatchObject({
        content: [
          {
            type: "tool",
            name: "echo",
            state: { status: "error", error: { message: "Provider returned malformed tool input" } },
          },
        ],
      })
      expect(JSON.stringify(assistant)).not.toContain("must-not-leak")
    }),
  )

  it.effect("recovers interruption during structured retry publication", () =>
    Effect.gen(function* () {
      yield* setup
      const session = yield* SessionV2.Service
      const events = yield* EventV2.Service
      let armed = true
      yield* events.beforeCommit((event) => {
        if (!armed || !Schema.is(SessionEvent.Structured.Retry)(event)) return Effect.void
        armed = false
        return Effect.interrupt
      })
      responses = [
        [LLMEvent.toolCall({ id: "retry-interrupt-bad", name: "final_output", input: { value: "bad" } })],
        [LLMEvent.toolCall({ id: "retry-interrupt-good", name: "final_output", input: { value: 7 } })],
      ]
      yield* session.prompt({
        sessionID,
        prompt: new Prompt({
          text: "Recover retry publication",
          format: { type: "json_schema", schema: { type: "number" }, retry_count: 1 },
        }),
        resume: false,
      })

      expect(Exit.isFailure(yield* session.resume(sessionID).pipe(Effect.exit))).toBe(true)
      yield* session.resume(sessionID)

      expect(requests).toHaveLength(2)
      expect((yield* session.messages({ sessionID, order: "asc" })).findLast((message) => message.type === "assistant")).toMatchObject({
        structured: 7,
      })
    }),
  )

  it.effect("recovers interruption during structured redispatch publication", () =>
    Effect.gen(function* () {
      yield* setup
      const session = yield* SessionV2.Service
      const events = yield* EventV2.Service
      let armed = true
      yield* events.beforeCommit((event) => {
        if (
          !armed ||
          !Schema.is(SessionEvent.Structured.Dispatched)(event) ||
          event.data.attempt !== 2
        )
          return Effect.void
        armed = false
        return Effect.interrupt
      })
      responses = [
        [LLMEvent.toolCall({ id: "redispatch-bad", name: "final_output", input: { value: "bad" } })],
        [LLMEvent.toolCall({ id: "redispatch-good", name: "final_output", input: { value: 8 } })],
      ]
      yield* session.prompt({
        sessionID,
        prompt: new Prompt({
          text: "Recover redispatch",
          format: { type: "json_schema", schema: { type: "number" }, retry_count: 1 },
        }),
        resume: false,
      })

      expect(Exit.isFailure(yield* session.resume(sessionID).pipe(Effect.exit))).toBe(true)
      yield* session.resume(sessionID)

      expect(requests).toHaveLength(2)
      expect((yield* session.messages({ sessionID, order: "asc" })).findLast((message) => message.type === "assistant")).toMatchObject({
        structured: 8,
      })
    }),
  )

  const lifecycle = [
    {
      name: "dispatch",
      event: SessionEvent.Structured.Dispatched,
      retryCount: 0,
      output: [LLMEvent.toolCall({ id: "final-dispatch", name: "final_output", input: { value: 1 } })],
    },
    {
      name: "candidate",
      event: SessionEvent.Structured.Candidate,
      retryCount: 0,
      output: [LLMEvent.toolCall({ id: "final-candidate", name: "final_output", input: { value: 1 } })],
    },
    {
      name: "retry",
      event: SessionEvent.Structured.Retry,
      retryCount: 1,
      output: [LLMEvent.toolCall({ id: "final-retry", name: "final_output", input: { value: "bad" } })],
    },
    {
      name: "result",
      event: SessionEvent.Structured.Result,
      retryCount: 0,
      output: [LLMEvent.toolCall({ id: "final-result", name: "final_output", input: { value: 1 } })],
    },
    {
      name: "failure",
      event: SessionEvent.Structured.Failed,
      retryCount: 0,
      output: [LLMEvent.toolCall({ id: "final-failure", name: "final_output", input: { value: "bad" } })],
    },
  ] as const
  const losses = [
    { name: "owner", set: { runtime: "v1" as const } },
    { name: "state", set: { runtime_state: "paused" as const } },
    { name: "epoch", set: { runtime_epoch: sql`${SessionTable.runtime_epoch} + 1` } },
  ] as const

  for (const boundary of lifecycle)
    for (const loss of losses)
      it.effect(`fences structured ${boundary.name} publication on exact ${loss.name} loss`, () =>
        Effect.gen(function* () {
          yield* setup
          const session = yield* SessionV2.Service
          const events = yield* EventV2.Service
          const { db } = yield* Database.Service
          let armed = true
          yield* events.beforeCommit((event) => {
            if (!armed || !Schema.is(boundary.event)(event)) return Effect.void
            armed = false
            return db.update(SessionTable).set(loss.set).where(eq(SessionTable.id, sessionID)).run().pipe(Effect.orDie)
          })
          responses = [boundary.output]
          yield* session.prompt({
            sessionID,
            prompt: new Prompt({
              text: `Fence ${boundary.name}`,
              format: { type: "json_schema", schema: { type: "number" }, retry_count: boundary.retryCount },
            }),
            resume: false,
          })

          const exit = yield* session.resume(sessionID).pipe(Effect.exit)

          expect(Exit.isFailure(exit)).toBe(true)
          expect(
            yield* db
              .select()
              .from(EventTable)
              .where(eq(EventTable.type, EventV2.versionedType(boundary.event.type, 1)))
              .all()
              .pipe(Effect.orDie),
          ).toEqual([])
        }),
      )

  it.effect("commits only the first of duplicate final calls", () =>
    Effect.gen(function* () {
      yield* setup
      const session = yield* SessionV2.Service
      responses = [[
        LLMEvent.toolCall({ id: "final-first", name: "final_output", input: { value: 1 } }),
        LLMEvent.toolCall({ id: "final-second", name: "final_output", input: { value: 2 } }),
      ]]
      yield* session.prompt({
        sessionID,
        prompt: new Prompt({
          text: "Return once",
          format: { type: "json_schema", schema: { type: "number" }, retry_count: 0 },
        }),
        resume: false,
      })

      yield* session.resume(sessionID)

      expect(requests).toHaveLength(1)
      expect((yield* session.messages({ sessionID })).filter((message) => message.type === "assistant")).toMatchObject([
        { structured: 1 },
      ])
    }),
  )

  it.effect("recovers a durable final candidate before another provider request", () =>
    Effect.gen(function* () {
      yield* setup
      const { db } = yield* Database.Service
      const events = yield* EventV2.Service
      const session = yield* SessionV2.Service
      const format = yield* SessionFormat.admit({
        type: "json_schema",
        schema: { type: "object", properties: { answer: { type: "number" } }, required: ["answer"] },
        retry_count: 2,
      })
      if (format.type !== "json_schema") throw new Error("expected structured format")
      const admitted = yield* session.prompt({
        sessionID,
        prompt: new Prompt({ text: "Recover candidate", format }),
        resume: false,
      })
      yield* SessionInput.promoteSteers(db, events, sessionID, Number.MAX_SAFE_INTEGER)
      const assistantMessageID = SessionMessage.ID.make("msg_structured_candidate")
      yield* events.publish(
        SessionEvent.Structured.Dispatched,
        {
          sessionID,
          rootUserID: admitted.id,
          timestamp: yield* DateTime.now,
          attempt: 1,
          fingerprint: SessionFormat.fingerprint(format),
        },
        { id: SessionFormat.dispatchID(sessionID, admitted.id, 1) },
      )
      yield* events.publish(SessionEvent.Step.Started, {
        sessionID,
        assistantMessageID,
        timestamp: yield* DateTime.now,
        agent: "build",
        model: { providerID: ProviderV2.ID.make("fake"), id: ModelV2.ID.make("fake-model") },
      })
      yield* events.publish(
        SessionEvent.Structured.Candidate,
        {
          sessionID,
          rootUserID: admitted.id,
          assistantMessageID,
          timestamp: yield* DateTime.now,
          attempt: 1,
          fingerprint: SessionFormat.fingerprint(format),
          value: { answer: 9 },
          invalid: false,
        },
        { id: SessionFormat.candidateID(sessionID, admitted.id, 1) },
      )

      yield* session.resume(sessionID)

      expect(requests).toEqual([])
      expect(yield* session.message({ sessionID, messageID: assistantMessageID })).toMatchObject({
        structured: { answer: 9 },
      })
    }),
  )

  it.effect("consumes a durable dispatched attempt before recovery redispatch", () =>
    Effect.gen(function* () {
      yield* setup
      const events = yield* EventV2.Service
      const session = yield* SessionV2.Service
      const format = yield* SessionFormat.admit({
        type: "json_schema",
        schema: { type: "number" },
        retry_count: 1,
      })
      if (format.type !== "json_schema") throw new Error("expected structured format")
      const admitted = yield* session.prompt({
        sessionID,
        prompt: new Prompt({ text: "Recover dispatch", format }),
        resume: false,
      })
      const { db } = yield* Database.Service
      yield* SessionInput.promoteSteers(db, events, sessionID, Number.MAX_SAFE_INTEGER)
      yield* events.publish(
        SessionEvent.Structured.Dispatched,
        {
          sessionID,
          rootUserID: admitted.id,
          timestamp: yield* DateTime.now,
          attempt: 1,
          fingerprint: SessionFormat.fingerprint(format),
        },
        { id: SessionFormat.dispatchID(sessionID, admitted.id, 1) },
      )
      responses = [[LLMEvent.toolCall({ id: "final-recovered", name: "final_output", input: { value: 7 } })]]

      yield* session.resume(sessionID)

      expect(requests).toHaveLength(1)
      const assistants = (yield* session.messages({ sessionID, order: "asc" })).filter(
        (message) => message.type === "assistant",
      )
      expect(assistants).toMatchObject([
        { structuredRetry: { attempt: 1, remaining: 1, reason: "interrupted" } },
        { structured: 7 },
      ])
    }),
  )

  it.effect("advertises and executes a globally attached application tool", () =>
    Effect.gen(function* () {
      yield* setup
      const applicationTools = yield* ApplicationTools.Service
      const session = yield* SessionV2.Service
      const contexts: Tool.Context[] = []
      yield* applicationTools.register({
        application_context: Tool.make({
          description: "Read application context",
          input: Schema.Struct({ query: Schema.String }),
          output: Schema.Struct({ answer: Schema.String }),
          execute: ({ query }, context) =>
            Effect.sync(() => {
              contexts.push(context)
              return { answer: query.toUpperCase() }
            }),
        }),
      })
      yield* session.prompt({ sessionID, prompt: new Prompt({ text: "Use application context" }), resume: false })
      responses = [
        [
          LLMEvent.stepStart({ index: 0 }),
          LLMEvent.toolCall({ id: "call-application", name: "application_context", input: { query: "hello" } }),
          LLMEvent.stepFinish({ index: 0, reason: "tool-calls" }),
          LLMEvent.finish({ reason: "tool-calls" }),
        ],
        [],
      ]

      yield* session.resume(sessionID)

      expect(requests[0]?.tools.map((tool) => tool.name)).toContain("application_context")
      expect(contexts).toEqual([
        {
          sessionID,
          agent: AgentV2.ID.make("build"),
          assistantMessageID: expect.stringMatching(/^msg_/),
          toolCallID: "call-application",
        },
      ])
      expect(yield* session.context(sessionID)).toMatchObject([
        { type: "user", text: "Use application context" },
        {
          type: "assistant",
          content: [
            {
              type: "tool",
              id: "call-application",
              state: { status: "completed", structured: { answer: "HELLO" } },
            },
          ],
        },
      ])
    }),
  )

  it.effect("starts a real runner turn after default prompt recording", () =>
    Effect.gen(function* () {
      yield* setup
      const session = yield* SessionV2.Service
      requests.length = 0
      responses = undefined
      streamGate = undefined
      streamStarted = undefined
      response = []

      const message = yield* session.prompt({ sessionID, prompt: new Prompt({ text: "Run automatically" }) })

      expect(requests).toHaveLength(1)
      expect(yield* session.messages({ sessionID })).toMatchObject([
        { id: message.id, type: "user", text: "Run automatically" },
      ])
    }),
  )

  it.effect("rejects V1-owned sessions before a runner turn starts", () =>
    Effect.gen(function* () {
      yield* setup
      const { db } = yield* Database.Service
      const runner = yield* SessionRunner.Service
      requests.length = 0
      yield* db
        .update(SessionTable)
        .set({ runtime: "v1" })
        .where(eq(SessionTable.id, sessionID))
        .run()
        .pipe(Effect.orDie)

      expect(yield* runner.run({ sessionID, force: true }).pipe(Effect.flip)).toMatchObject({
        _tag: "SessionRuntime.Mismatch",
        expectedOwner: "v2",
        actualOwner: "v1",
      })
      expect(requests).toEqual([])
    }),
  )

  it.effect("records draining activity while provider work is blocked and returns to ready", () =>
    Effect.gen(function* () {
      yield* setup
      const session = yield* SessionV2.Service
      const runtime = yield* SessionRuntime.Service
      const gate = yield* Deferred.make<void>()
      streamGate = gate
      streamStarted = yield* Deferred.make<void>()
      yield* session.prompt({ sessionID, prompt: new Prompt({ text: "Observe activity" }), resume: false })

      const fiber = yield* session.resume(sessionID).pipe(Effect.forkChild)
      yield* Deferred.await(streamStarted)

      expect(yield* runtime.get(sessionID)).toMatchObject({ owner: "v2", state: "draining", epoch: 1 })
      yield* Deferred.succeed(streamGate, undefined)
      yield* Fiber.join(fiber)
      expect(yield* runtime.get(sessionID)).toMatchObject({ owner: "v2", state: "ready", epoch: 2 })
    }),
  )

  it.effect("does not bump the runtime epoch when a non-forced drain has no work", () =>
    Effect.gen(function* () {
      yield* setup
      const runner = yield* SessionRunner.Service
      const runtime = yield* SessionRuntime.Service
      requests.length = 0

      yield* runner.run({ sessionID })

      expect(yield* runtime.get(sessionID)).toMatchObject({ owner: "v2", state: "ready", epoch: 0 })
      expect(requests).toEqual([])
    }),
  )

  it.effect("leaves a recovered paused runtime untouched when its advisory wake finds no work", () =>
    Effect.gen(function* () {
      yield* setup
      const runner = yield* SessionRunner.Service
      const runtime = yield* SessionRuntime.Service
      requests.length = 0
      yield* runtime.assign({ sessionID, state: "draining", expectedOwner: "v2", expectedEpoch: 0 })
      yield* runtime.recover()

      yield* runner.run({ sessionID })

      expect(yield* runtime.get(sessionID)).toMatchObject({ owner: "v2", state: "paused", epoch: 2 })
      expect(requests).toEqual([])
    }),
  )

  it.effect("wakes a recovered paused V2 runtime", () =>
    Effect.gen(function* () {
      yield* setup
      const session = yield* SessionV2.Service
      const runtime = yield* SessionRuntime.Service
      requests.length = 0
      yield* runtime.assign({ sessionID, state: "draining", expectedOwner: "v2", expectedEpoch: 0 })
      yield* runtime.recover()

      yield* session.prompt({ sessionID, prompt: new Prompt({ text: "Resume after restart" }) })
      yield* (yield* SessionRunCoordinator.Service).awaitIdle(sessionID)

      expect(requests).toHaveLength(1)
      expect(yield* runtime.get(sessionID)).toMatchObject({ owner: "v2", state: "ready", epoch: 4 })
    }),
  )

  it.effect("stops on a stale runtime epoch before publishing provider output", () =>
    Effect.gen(function* () {
      yield* setup
      const session = yield* SessionV2.Service
      const runtime = yield* SessionRuntime.Service
      modelResolveHook = runtime
        .assign({ sessionID, owner: "v1", state: "migrating", expectedOwner: "v2", expectedEpoch: 1 })
        .pipe(Effect.asVoid)
      response = fragmentFixture("text", "text-stale", ["Should not persist"]).completeEvents

      yield* session.prompt({ sessionID, prompt: new Prompt({ text: "Fence this run" }), resume: false })
      const failure = yield* session.resume(sessionID).pipe(Effect.flip)

      expect(failure).toMatchObject({
        _tag: "SessionRuntime.Mismatch",
        expectedOwner: "v2",
        actualOwner: "v1",
        expectedEpoch: 1,
        actualEpoch: 2,
      })
      expect((yield* session.context(sessionID)).filter((message) => message.type === "assistant")).toEqual([])
      expect(yield* runtime.get(sessionID)).toMatchObject({ owner: "v1", state: "migrating", epoch: 2 })
    }),
  )

  it.effect("rolls back provider output when the runtime epoch changes at event commit", () =>
    Effect.gen(function* () {
      yield* setup
      const session = yield* SessionV2.Service
      const runtime = yield* SessionRuntime.Service
      const events = yield* EventV2.Service
      const { db } = yield* Database.Service
      let armed = true
      yield* events.beforeCommit((event) => {
        if (!armed || !Schema.is(SessionEvent.Step.Started)(event)) return Effect.void
        armed = false
        return runtime
          .assign({ sessionID, state: "ready", expectedOwner: "v2", expectedEpoch: 1 })
          .pipe(Effect.orDie, Effect.asVoid)
      })
      response = fragmentFixture("text", "text-commit-fence", ["Should roll back"]).completeEvents
      yield* session.prompt({ sessionID, prompt: new Prompt({ text: "Fence the commit" }), resume: false })

      const failure = yield* session.resume(sessionID).pipe(Effect.catchDefect(Effect.succeed))

      expect(failure).toMatchObject({
        _tag: "SessionRuntime.Mismatch",
        expectedOwner: "v2",
        expectedEpoch: 1,
        actualEpoch: 2,
      })
      expect(
        yield* db
          .select()
          .from(EventTable)
          .where(eq(EventTable.type, EventV2.versionedType(SessionEvent.Step.Started.type, 1)))
          .all()
          .pipe(Effect.orDie),
      ).toEqual([])
      expect((yield* session.context(sessionID)).filter((message) => message.type === "assistant")).toEqual([])
    }),
  )

  it.effect("streams one request with registry definitions from chronological V2 user history", () =>
    Effect.gen(function* () {
      yield* setup
      const session = yield* SessionV2.Service
      yield* session.prompt({ sessionID, prompt: new Prompt({ text: "First" }), resume: false })
      yield* session.prompt({ sessionID, prompt: new Prompt({ text: "Second" }), resume: false })

      requests.length = 0
      responses = undefined
      streamGate = undefined
      streamStarted = undefined
      response = []
      yield* session.resume(sessionID)

      expect(requests).toHaveLength(1)
      expect(requests[0]?.model).toBe(model)
      expect(requests[0]?.tools.map((tool) => tool.name)).toEqual(["echo", "defect"])
      expect(requests[0]?.messages.map((message) => ({ role: message.role, content: message.content }))).toEqual([
        { role: "user", content: [{ type: "text", text: "First" }] },
        { role: "user", content: [{ type: "text", text: "Second" }] },
      ])
      expect(yield* session.messages({ sessionID })).toHaveLength(2)
    }),
  )

  it.effect("retries the first provider turn after system context becomes available", () =>
    Effect.gen(function* () {
      yield* setup
      const session = yield* SessionV2.Service
      const { db } = yield* Database.Service
      const messageID = SessionMessage.ID.create()
      systemUnavailable = true
      yield* session.prompt({ id: messageID, sessionID, prompt: new Prompt({ text: "First" }), resume: false })
      requests.length = 0

      const exit = yield* session.resume(sessionID).pipe(Effect.exit)

      expect(Exit.isFailure(exit)).toBe(true)
      if (Exit.isFailure(exit)) expect(Cause.squash(exit.cause)).toBeInstanceOf(SystemContext.InitializationBlocked)
      expect(requests).toHaveLength(0)
      expect(yield* SessionInput.hasPending(db, sessionID, "steer")).toBe(true)
      expect(
        yield* db
          .select()
          .from(SessionContextEpochTable)
          .where(eq(SessionContextEpochTable.session_id, sessionID))
          .get(),
      ).toBeUndefined()

      systemUnavailable = false
      yield* session.prompt({ id: messageID, sessionID, prompt: new Prompt({ text: "First" }) })
      yield* (yield* SessionRunCoordinator.Service).awaitIdle(sessionID)

      expect(requests).toHaveLength(1)
      expect(requests[0]?.messages.map((message) => message.role)).toEqual(["user"])
    }),
  )

  it.effect("interrupts a source Location runner after a Session moves", () =>
    Effect.gen(function* () {
      yield* setup
      const session = yield* SessionV2.Service
      const events = yield* EventV2.Service
      const { db } = yield* Database.Service
      yield* session.prompt({ sessionID, prompt: new Prompt({ text: "First" }), resume: false })
      requests.length = 0
      response = []
      yield* session.resume(sessionID)

      yield* events.publish(SessionEvent.Moved, {
        sessionID,
        timestamp: DateTime.makeUnsafe(1),
        location: { directory: AbsolutePath.make("/moved") },
      })
      expect(
        yield* db
          .select()
          .from(SessionContextEpochTable)
          .where(eq(SessionContextEpochTable.session_id, sessionID))
          .get(),
      ).toBeUndefined()

      yield* session.prompt({ sessionID, prompt: new Prompt({ text: "Second" }), resume: false })
      const exit = yield* session.resume(sessionID).pipe(Effect.exit)

      expect(Exit.isFailure(exit) && Cause.hasInterruptsOnly(exit.cause)).toBe(true)
      expect(requests).toHaveLength(1)
      expect(yield* SessionInput.hasPending(db, sessionID, "steer")).toBe(true)
    }),
  )

  it.effect("fails gracefully when a stored context snapshot cannot be decoded", () =>
    Effect.gen(function* () {
      yield* setup
      const session = yield* SessionV2.Service
      const { db } = yield* Database.Service
      yield* session.prompt({ sessionID, prompt: new Prompt({ text: "First" }), resume: false })
      response = []
      yield* session.resume(sessionID)
      yield* db
        .update(SessionContextEpochTable)
        .set({ snapshot: { invalid: { value: "bad" } } })
        .where(eq(SessionContextEpochTable.session_id, sessionID))
        .run()
        .pipe(Effect.orDie)
      yield* session.prompt({ sessionID, prompt: new Prompt({ text: "Second" }), resume: false })
      requests.length = 0

      const exit = yield* session.resume(sessionID).pipe(Effect.exit)

      expect(Exit.isFailure(exit)).toBe(true)
      if (Exit.isFailure(exit)) expect(Cause.squash(exit.cause)).toBeInstanceOf(ContextSnapshotDecodeError)
      expect(requests).toHaveLength(0)
    }),
  )

  it.effect("does not create a source Location epoch after a concurrent Session move", () =>
    Effect.gen(function* () {
      yield* setup
      const session = yield* SessionV2.Service
      const events = yield* EventV2.Service
      const { db } = yield* Database.Service
      let moved = false
      systemLoadHook = Effect.suspend(() => {
        if (moved) return Effect.void
        moved = true
        return events
          .publish(SessionEvent.Moved, {
            sessionID,
            timestamp: DateTime.makeUnsafe(1),
            location: { directory: AbsolutePath.make("/moved") },
          })
          .pipe(Effect.asVoid)
      })
      yield* session.prompt({ sessionID, prompt: new Prompt({ text: "First" }), resume: false })

      expect(Exit.isFailure(yield* session.resume(sessionID).pipe(Effect.exit))).toBe(true)
      expect(yield* SessionInput.hasPending(db, sessionID, "steer")).toBe(true)
      expect(
        yield* db
          .select()
          .from(SessionContextEpochTable)
          .where(eq(SessionContextEpochTable.session_id, sessionID))
          .get(),
      ).toBeUndefined()
      expect((yield* session.get(sessionID)).location.directory).toBe(AbsolutePath.make("/moved"))
    }),
  )

  it.effect("rolls back direct context initialization when its runtime guard becomes stale", () =>
    Effect.gen(function* () {
      yield* setup
      const session = yield* SessionV2.Service
      const runtime = yield* SessionRuntime.Service
      const { db } = yield* Database.Service
      const context = Effect.succeed(
        SystemContext.make({
          key: systemContextKey,
          codec: Schema.toCodecJson(Schema.String),
          load: Effect.succeed("Initial context"),
          baseline: String,
          update: (_previous, current) => current,
        }),
      )
      const guard = () =>
        runtime
          .assign({ sessionID, state: "ready", expectedOwner: "v2", expectedEpoch: 0 })
          .pipe(Effect.andThen(runtime.assert({ sessionID, owner: "v2", epoch: 0 })), Effect.asVoid, Effect.orDie)

      expect(
        yield* SessionContextEpoch.initialize(
          db,
          context,
          sessionID,
          (yield* session.get(sessionID)).location,
          AgentV2.defaultID,
          guard,
        ).pipe(Effect.catchDefect(Effect.succeed)),
      ).toMatchObject({ _tag: "SessionRuntime.Mismatch", expectedEpoch: 0, actualEpoch: 1 })
      expect(
        yield* db
          .select()
          .from(SessionContextEpochTable)
          .where(eq(SessionContextEpochTable.session_id, sessionID))
          .get()
          .pipe(Effect.orDie),
      ).toBeUndefined()
      expect(yield* runtime.get(sessionID)).toMatchObject({ state: "ready", epoch: 0 })
    }),
  )

  it.effect("rolls back direct context replacement when its runtime guard becomes stale", () =>
    Effect.gen(function* () {
      yield* setup
      const session = yield* SessionV2.Service
      const runtime = yield* SessionRuntime.Service
      const events = yield* EventV2.Service
      const { db } = yield* Database.Service
      const context = (text: string) =>
        Effect.succeed(
          SystemContext.make({
            key: systemContextKey,
            codec: Schema.toCodecJson(Schema.String),
            load: Effect.succeed(text),
            baseline: String,
            update: (_previous, current) => current,
          }),
        )
      const location = (yield* session.get(sessionID)).location
      yield* SessionContextEpoch.initialize(db, context("Initial context"), sessionID, location, AgentV2.defaultID)
      yield* db
        .update(SessionTable)
        .set({ agent: "reviewer" })
        .where(eq(SessionTable.id, sessionID))
        .run()
        .pipe(Effect.orDie)
      const guard = () =>
        runtime
          .assign({ sessionID, state: "ready", expectedOwner: "v2", expectedEpoch: 0 })
          .pipe(Effect.andThen(runtime.assert({ sessionID, owner: "v2", epoch: 0 })), Effect.asVoid, Effect.orDie)

      expect(
        yield* SessionContextEpoch.prepare(
          db,
          events,
          context("Reviewer context"),
          sessionID,
          location,
          AgentV2.ID.make("reviewer"),
          guard,
        ).pipe(Effect.catchDefect(Effect.succeed)),
      ).toMatchObject({ _tag: "SessionRuntime.Mismatch", expectedEpoch: 0, actualEpoch: 1 })
      expect(
        yield* db
          .select({ agent: SessionContextEpochTable.agent, baseline: SessionContextEpochTable.baseline })
          .from(SessionContextEpochTable)
          .where(eq(SessionContextEpochTable.session_id, sessionID))
          .get()
          .pipe(Effect.orDie),
      ).toEqual({ agent: AgentV2.defaultID, baseline: "Initial context" })
      expect(yield* runtime.get(sessionID)).toMatchObject({ state: "ready", epoch: 0 })
    }),
  )

  it.effect("reuses one durable baseline after the context producer changes", () =>
    Effect.gen(function* () {
      yield* setup
      const session = yield* SessionV2.Service
      yield* session.prompt({ sessionID, prompt: new Prompt({ text: "First" }), resume: false })

      requests.length = 0
      response = []
      yield* session.resume(sessionID)
      const { db } = yield* Database.Service
      const before = yield* db
        .select({ revision: SessionContextEpochTable.revision, snapshot: SessionContextEpochTable.snapshot })
        .from(SessionContextEpochTable)
        .where(eq(SessionContextEpochTable.session_id, sessionID))
        .get()
        .pipe(Effect.orDie)
      systemBaseline = "Changed context"
      yield* session.prompt({ sessionID, prompt: new Prompt({ text: "Second" }), resume: false })
      yield* session.resume(sessionID)

      expect(requests.map((request) => request.system.map((part) => part.text))).toEqual([
        ["Initial context"],
        ["Initial context"],
      ])
      expect(requests[1]?.messages.map((message) => message.role)).toEqual(["user", "user", "system"])
      expect(requests[1]?.messages.at(-1)?.content).toEqual([{ type: "text", text: "Changed context" }])
      expect(yield* session.messages({ sessionID })).toHaveLength(3)
      const after = yield* db
        .select({ revision: SessionContextEpochTable.revision, snapshot: SessionContextEpochTable.snapshot })
        .from(SessionContextEpochTable)
        .where(eq(SessionContextEpochTable.session_id, sessionID))
        .get()
        .pipe(Effect.orDie)
      expect(after?.revision).toBe((before?.revision ?? -1) + 1)
      expect(after?.snapshot).not.toEqual(before?.snapshot)
      expect(
        yield* db
          .select({ id: EventTable.id })
          .from(EventTable)
          .where(eq(EventTable.type, "session.next.context.updated.1"))
          .all()
          .pipe(Effect.orDie),
      ).toHaveLength(1)
      yield* replaySessionProjection(sessionID)
      expect(yield* session.messages({ sessionID })).toHaveLength(3)
    }),
  )

  it.effect("rolls back ContextUpdated and its advance hook when the runtime fence becomes stale", () =>
    Effect.gen(function* () {
      yield* setup
      const session = yield* SessionV2.Service
      const runtime = yield* SessionRuntime.Service
      const events = yield* EventV2.Service
      const { db } = yield* Database.Service
      yield* session.prompt({ sessionID, prompt: new Prompt({ text: "First" }), resume: false })
      response = []
      yield* session.resume(sessionID)
      const before = yield* db
        .select({ revision: SessionContextEpochTable.revision, snapshot: SessionContextEpochTable.snapshot })
        .from(SessionContextEpochTable)
        .where(eq(SessionContextEpochTable.session_id, sessionID))
        .get()
        .pipe(Effect.orDie)
      systemBaseline = "Changed context"
      let armed = true
      yield* events.beforeCommit((event) => {
        if (!armed || !Schema.is(SessionEvent.ContextUpdated)(event)) return Effect.void
        armed = false
        return runtime
          .assign({ sessionID, state: "ready", expectedOwner: "v2", expectedEpoch: 3 })
          .pipe(Effect.orDie, Effect.asVoid)
      })
      yield* session.prompt({ sessionID, prompt: new Prompt({ text: "Second" }), resume: false })

      expect(yield* session.resume(sessionID).pipe(Effect.catchDefect(Effect.succeed))).toMatchObject({
        _tag: "SessionRuntime.Mismatch",
        expectedEpoch: 3,
        actualEpoch: 4,
      })
      expect(
        yield* db
          .select({ revision: SessionContextEpochTable.revision, snapshot: SessionContextEpochTable.snapshot })
          .from(SessionContextEpochTable)
          .where(eq(SessionContextEpochTable.session_id, sessionID))
          .get()
          .pipe(Effect.orDie),
      ).toEqual(before)
      expect(
        yield* db
          .select()
          .from(EventTable)
          .where(eq(EventTable.type, EventV2.versionedType(SessionEvent.ContextUpdated.type, 1)))
          .all()
          .pipe(Effect.orDie),
      ).toEqual([])
    }),
  )

  it.effect("includes the effective default agent system before durable context", () =>
    Effect.gen(function* () {
      yield* setup
      const agent = yield* AgentV2.Service
      yield* agent.transform((editor) =>
        editor.update(AgentV2.ID.make("build"), (agent) => {
          agent.system = "Build agent instructions"
          agent.mode = "primary"
        }),
      )
      const session = yield* SessionV2.Service
      yield* session.prompt({ sessionID, prompt: new Prompt({ text: "First" }), resume: false })

      requests.length = 0
      response = fragmentFixture("text", "text-build", ["Done"]).completeEvents
      yield* session.resume(sessionID)

      expect(requests.at(-1)?.system.map((part) => part.text)).toEqual(["Build agent instructions", "Initial context"])
    }),
  )

  it.effect("uses the configured default agent system for omitted-agent sessions", () =>
    Effect.gen(function* () {
      yield* setup
      const agent = yield* AgentV2.Service
      yield* agent.transform((editor) => {
        editor.update(AgentV2.ID.make("build"), (agent) => {
          agent.system = "Build agent instructions"
          agent.mode = "primary"
        })
        editor.update(AgentV2.ID.make("reviewer"), (agent) => {
          agent.system = "Reviewer instructions"
          agent.mode = "primary"
        })
        editor.default(AgentV2.ID.make("reviewer"))
      })
      const session = yield* SessionV2.Service
      yield* session.prompt({ sessionID, prompt: new Prompt({ text: "First" }), resume: false })

      requests.length = 0
      response = fragmentFixture("text", "text-reviewer", ["Done"]).completeEvents
      yield* session.resume(sessionID)

      expect(requests.at(-1)?.system.map((part) => part.text)).toEqual(["Reviewer instructions", "Initial context"])
      expect((yield* session.messages({ sessionID }))[0]).toMatchObject({ type: "assistant", agent: "reviewer" })
    }),
  )

  it.effect("uses an explicitly selected non-build agent system", () =>
    Effect.gen(function* () {
      yield* setup
      const { db } = yield* Database.Service
      const agent = yield* AgentV2.Service
      yield* agent.transform((editor) =>
        editor.update(AgentV2.ID.make("reviewer"), (agent) => {
          agent.system = "Reviewer instructions"
          agent.mode = "primary"
        }),
      )
      yield* db
        .update(SessionTable)
        .set({ agent: "reviewer" })
        .where(eq(SessionTable.id, sessionID))
        .run()
        .pipe(Effect.orDie)
      const session = yield* SessionV2.Service
      yield* session.prompt({ sessionID, prompt: new Prompt({ text: "First" }), resume: false })

      requests.length = 0
      response = fragmentFixture("text", "text-selected", ["Done"]).completeEvents
      yield* session.resume(sessionID)

      expect(requests.at(-1)?.system.map((part) => part.text)).toEqual(["Reviewer instructions", "Initial context"])
      expect((yield* session.messages({ sessionID }))[0]).toMatchObject({ type: "assistant", agent: "reviewer" })
    }),
  )

  it.effect("composes selected-agent skill guidance and replaces it after an agent switch", () =>
    Effect.gen(function* () {
      yield* setup
      const session = yield* SessionV2.Service
      yield* (yield* AgentV2.Service).transform((editor) =>
        [AgentV2.defaultID, AgentV2.ID.make("reviewer")].forEach((id) =>
          editor.update(id, (agent) => {
            agent.mode = "primary"
          }),
        ),
      )
      skillBaselines.set(AgentV2.ID.make("build"), "Build skills")
      yield* session.prompt({ sessionID, prompt: new Prompt({ text: "First" }), resume: false })

      requests.length = 0
      response = []
      yield* session.resume(sessionID)
      skillBaselines.set(AgentV2.ID.make("reviewer"), "Reviewer skills")
      yield* session.switchAgent({ sessionID, agent: "reviewer" })
      yield* session.prompt({ sessionID, prompt: new Prompt({ text: "Second" }), resume: false })
      yield* session.resume(sessionID)

      expect(requests.map((request) => request.system.map((part) => part.text))).toEqual([
        ["Initial context\n\nBuild skills"],
        ["Initial context\n\nReviewer skills"],
      ])
    }),
  )

  it.effect("retries first-epoch preparation when the selected agent changes during observation", () =>
    Effect.gen(function* () {
      yield* setup
      const session = yield* SessionV2.Service
      yield* (yield* AgentV2.Service).transform((editor) =>
        editor.update(AgentV2.ID.make("reviewer"), (agent) => {
          agent.mode = "primary"
        }),
      )
      skillBaselines.set(AgentV2.ID.make("build"), "Build skills")
      skillBaselines.set(AgentV2.ID.make("reviewer"), "Reviewer skills")
      let switched = false
      systemLoadHook = Effect.suspend(() => {
        if (switched) return Effect.void
        switched = true
        return session.switchAgent({ sessionID, agent: "reviewer" })
      })
      yield* session.prompt({ sessionID, prompt: new Prompt({ text: "First" }), resume: false })

      requests.length = 0
      response = []
      yield* session.resume(sessionID)

      expect(requests.map((request) => request.system.map((part) => part.text))).toEqual([
        ["Initial context\n\nReviewer skills"],
      ])
    }),
  )

  it.effect("opens a queued activity once when the selected agent changes during observation", () =>
    Effect.gen(function* () {
      yield* setup
      const session = yield* SessionV2.Service
      const events = yield* EventV2.Service
      skillBaselines.set(AgentV2.ID.make("build"), "Build skills")
      skillBaselines.set(AgentV2.ID.make("reviewer"), "Reviewer skills")
      let switched = false
      systemLoadHook = Effect.suspend(() => {
        if (switched) return Effect.void
        switched = true
        return events
          .publish(SessionEvent.AgentSwitched, {
            sessionID,
            messageID: SessionMessage.ID.create(),
            timestamp: DateTime.makeUnsafe(1),
            agent: "reviewer",
          })
          .pipe(Effect.asVoid)
      })
      yield* session.prompt({
        sessionID,
        prompt: new Prompt({ text: "Queued" }),
        delivery: "queue",
        resume: false,
      })

      requests.length = 0
      response = []
      yield* session.resume(sessionID)

      expect(requests).toHaveLength(1)
      expect((yield* session.context(sessionID)).filter((message) => message.type === "user")).toHaveLength(1)
    }),
  )

  it.effect("retries an agent switch before the final provider-dispatch boundary", () =>
    Effect.gen(function* () {
      yield* setup
      const session = yield* SessionV2.Service
      yield* (yield* AgentV2.Service).transform((editor) =>
        editor.update(AgentV2.ID.make("reviewer"), (agent) => {
          agent.mode = "primary"
        }),
      )
      const { db } = yield* Database.Service
      skillBaselines.set(AgentV2.ID.make("build"), "Build skills")
      skillBaselines.set(AgentV2.ID.make("reviewer"), "Reviewer skills")
      let switched = false
      modelResolveHook = Effect.suspend(() => {
        if (switched) return Effect.void
        switched = true
        return session.switchAgent({ sessionID, agent: "reviewer" })
      })
      yield* session.prompt({ sessionID, prompt: new Prompt({ text: "First" }), resume: false })

      requests.length = 0
      response = []
      yield* session.resume(sessionID)
      expect(requests.map((request) => request.system.map((part) => part.text))).toEqual([
        ["Initial context\n\nReviewer skills"],
      ])
      expect(
        yield* db
          .select({ replacementSeq: SessionContextEpochTable.replacement_seq })
          .from(SessionContextEpochTable)
          .where(eq(SessionContextEpochTable.session_id, sessionID))
          .get()
          .pipe(Effect.orDie),
      ).toEqual({ replacementSeq: null })
    }),
  )

  it.effect("retries a model switch before the final provider-dispatch boundary", () =>
    Effect.gen(function* () {
      yield* setup
      const session = yield* SessionV2.Service
      const events = yield* EventV2.Service
      let switched = false
      modelResolveHook = Effect.suspend(() => {
        if (switched) return Effect.void
        switched = true
        return events
          .publish(SessionEvent.ModelSwitched, {
            sessionID,
            messageID: SessionMessage.ID.create(),
            timestamp: DateTime.makeUnsafe(1),
            model: { id: ModelV2.ID.make("replacement"), providerID: ProviderV2.ID.make("fake") },
          })
          .pipe(Effect.asVoid)
      })
      yield* session.prompt({ sessionID, prompt: new Prompt({ text: "First" }), resume: false })

      requests.length = 0
      response = []
      yield* session.resume(sessionID)
      expect(requests.map((request) => request.model)).toEqual([replacementModel])
      expect(requests.map((request) => request.system.map((part) => part.text))).toEqual([["Initial context"]])
    }),
  )

  it.effect("fences an unchanged epoch read across an agent ABA replacement request", () =>
    Effect.gen(function* () {
      yield* setup
      const session = yield* SessionV2.Service
      const events = yield* EventV2.Service
      const { db } = yield* Database.Service
      yield* session.prompt({ sessionID, prompt: new Prompt({ text: "First" }), resume: false })
      response = []
      yield* session.resume(sessionID)
      let switched = false
      systemLoadHook = Effect.suspend(() => {
        if (switched) return Effect.void
        switched = true
        return events
          .publish(SessionEvent.AgentSwitched, {
            sessionID,
            messageID: SessionMessage.ID.create(),
            timestamp: DateTime.makeUnsafe(1),
            agent: AgentV2.ID.make("reviewer"),
          })
          .pipe(
            Effect.andThen(
              events.publish(SessionEvent.AgentSwitched, {
                sessionID,
                messageID: SessionMessage.ID.create(),
                timestamp: DateTime.makeUnsafe(2),
                agent: AgentV2.defaultID,
              }),
            ),
            Effect.asVoid,
          )
      })
      yield* session.prompt({ sessionID, prompt: new Prompt({ text: "Second" }), resume: false })

      requests.length = 0
      yield* session.resume(sessionID)

      expect(requests).toHaveLength(1)
      expect(
        yield* db
          .select({ replacementSeq: SessionContextEpochTable.replacement_seq })
          .from(SessionContextEpochTable)
          .where(eq(SessionContextEpochTable.session_id, sessionID))
          .get()
          .pipe(Effect.orDie),
      ).toEqual({ replacementSeq: null })
    }),
  )

  it.effect("rejects stale agent guidance when committing an existing-epoch replacement", () =>
    Effect.gen(function* () {
      yield* setup
      const session = yield* SessionV2.Service
      const events = yield* EventV2.Service
      const { db } = yield* Database.Service
      yield* session.prompt({ sessionID, prompt: new Prompt({ text: "First" }), resume: false })
      response = []
      yield* session.resume(sessionID)
      yield* events.publish(SessionEvent.AgentSwitched, {
        sessionID,
        messageID: SessionMessage.ID.create(),
        timestamp: DateTime.makeUnsafe(1),
        agent: AgentV2.ID.make("reviewer"),
      })
      const context = (text: string) =>
        Effect.succeed(
          SystemContext.make({
            key: systemContextKey,
            codec: Schema.toCodecJson(Schema.String),
            load: Effect.succeed(text),
            baseline: String,
            update: (_previous, current) => current,
          }),
        )
      const location = (yield* session.get(sessionID)).location

      expect(
        yield* SessionContextEpoch.prepare(
          db,
          events,
          context("Stale build context"),
          sessionID,
          location,
          AgentV2.defaultID,
        ).pipe(Effect.catchDefect(Effect.succeed)),
      ).toBeInstanceOf(SessionContextEpoch.AgentMismatch)

      expect(
        yield* SessionContextEpoch.prepare(
          db,
          events,
          context("Reviewer context"),
          sessionID,
          location,
          AgentV2.ID.make("reviewer"),
        ),
      ).toMatchObject({ baseline: "Reviewer context" })
    }),
  )

  it.effect("blocks a cross-agent provider turn while replacement context is unavailable", () =>
    Effect.gen(function* () {
      yield* setup
      const session = yield* SessionV2.Service
      const events = yield* EventV2.Service
      skillBaselines.set(AgentV2.defaultID, "Build skills")
      skillBaselines.set(AgentV2.ID.make("reviewer"), "Reviewer skills")
      yield* session.prompt({ sessionID, prompt: new Prompt({ text: "First" }), resume: false })
      response = []
      yield* session.resume(sessionID)
      yield* events.publish(SessionEvent.AgentSwitched, {
        sessionID,
        messageID: SessionMessage.ID.create(),
        timestamp: DateTime.makeUnsafe(1),
        agent: AgentV2.ID.make("reviewer"),
      })
      systemUnavailable = true
      yield* session.prompt({ sessionID, prompt: new Prompt({ text: "Second" }), resume: false })

      requests.length = 0
      const blocked = yield* session.resume(sessionID).pipe(Effect.exit)
      expect(Exit.isFailure(blocked)).toBe(true)
      if (Exit.isFailure(blocked))
        expect(Cause.squash(blocked.cause)).toBeInstanceOf(SessionContextEpoch.AgentReplacementBlocked)
      expect(requests).toHaveLength(0)

      systemUnavailable = false
      yield* session.resume(sessionID)
      expect(requests.map((request) => request.system.map((part) => part.text))).toEqual([
        ["Initial context\n\nReviewer skills"],
      ])
    }),
  )

  it.effect("admits removed context as a chronological System message", () =>
    Effect.gen(function* () {
      yield* setup
      const session = yield* SessionV2.Service
      yield* session.prompt({ sessionID, prompt: new Prompt({ text: "First" }), resume: false })

      requests.length = 0
      response = []
      yield* session.resume(sessionID)
      systemRemoved = true
      yield* session.prompt({ sessionID, prompt: new Prompt({ text: "Second" }), resume: false })
      yield* session.resume(sessionID)

      expect(requests[1]?.messages.map((message) => message.role)).toEqual(["user", "user", "system"])
      expect(requests[1]?.messages.at(-1)?.content).toEqual([
        { type: "text", text: "System context source removed: test/context" },
      ])
      expect(yield* session.messages({ sessionID })).toHaveLength(3)
    }),
  )

  it.effect("replaces the baseline lazily after a model switch and drops prior System updates", () =>
    Effect.gen(function* () {
      yield* setup
      const session = yield* SessionV2.Service
      const events = yield* EventV2.Service
      yield* session.prompt({ sessionID, prompt: new Prompt({ text: "First" }), resume: false })

      requests.length = 0
      response = []
      yield* session.resume(sessionID)
      systemBaseline = "Changed context"
      yield* session.prompt({ sessionID, prompt: new Prompt({ text: "Second" }), resume: false })
      yield* session.resume(sessionID)
      yield* events.publish(SessionEvent.ModelSwitched, {
        sessionID,
        messageID: SessionMessage.ID.create(),
        timestamp: DateTime.makeUnsafe(1),
        model: { id: ModelV2.ID.make("replacement"), providerID: ProviderV2.ID.make("fake") },
      })
      systemBaseline = "Replacement context"
      yield* session.prompt({ sessionID, prompt: new Prompt({ text: "Third" }), resume: false })
      yield* session.resume(sessionID)

      expect(requests.map((request) => request.system.map((part) => part.text))).toEqual([
        ["Initial context"],
        ["Initial context"],
        ["Replacement context"],
      ])
      expect(requests[1]?.messages.map((message) => message.role)).toEqual(["user", "user", "system"])
      expect(requests[2]?.messages.map((message) => message.role)).toEqual(["user", "user", "user"])
      expect((yield* session.context(sessionID)).map((message) => message.type)).toEqual([
        "user",
        "user",
        "model-switched",
        "user",
      ])
      yield* replaySessionProjection(sessionID)
      expect(yield* session.messages({ sessionID })).toHaveLength(5)
      yield* session.prompt({ sessionID, prompt: new Prompt({ text: "Fourth" }), resume: false })
      yield* session.resume(sessionID)
    }),
  )

  it.effect("defers replacement while admitted context is temporarily unavailable", () =>
    Effect.gen(function* () {
      yield* setup
      const session = yield* SessionV2.Service
      const events = yield* EventV2.Service
      yield* session.prompt({ sessionID, prompt: new Prompt({ text: "First" }), resume: false })

      requests.length = 0
      response = []
      yield* session.resume(sessionID)
      yield* events.publish(SessionEvent.ModelSwitched, {
        sessionID,
        messageID: SessionMessage.ID.create(),
        timestamp: DateTime.makeUnsafe(1),
        model: { id: ModelV2.ID.make("replacement"), providerID: ProviderV2.ID.make("fake") },
      })
      systemUnavailable = true
      yield* session.prompt({ sessionID, prompt: new Prompt({ text: "Second" }), resume: false })
      yield* session.resume(sessionID)
      systemUnavailable = false
      systemBaseline = "Replacement context"
      yield* session.prompt({ sessionID, prompt: new Prompt({ text: "Third" }), resume: false })
      yield* session.resume(sessionID)

      expect(requests.map((request) => request.system.map((part) => part.text))).toEqual([
        ["Initial context"],
        ["Initial context"],
        ["Replacement context"],
      ])
    }),
  )

  it.effect("advances a pending replacement to the latest invalidation boundary", () =>
    Effect.gen(function* () {
      yield* setup
      const session = yield* SessionV2.Service
      const events = yield* EventV2.Service
      const { db } = yield* Database.Service
      yield* session.prompt({ sessionID, prompt: new Prompt({ text: "First" }), resume: false })
      response = []
      yield* session.resume(sessionID)

      yield* events.publish(SessionEvent.ModelSwitched, {
        sessionID,
        messageID: SessionMessage.ID.create(),
        timestamp: DateTime.makeUnsafe(1),
        model: { id: ModelV2.ID.make("replacement-1"), providerID: ProviderV2.ID.make("fake") },
      })
      yield* events.publish(SessionEvent.ModelSwitched, {
        sessionID,
        messageID: SessionMessage.ID.create(),
        timestamp: DateTime.makeUnsafe(2),
        model: { id: ModelV2.ID.make("replacement-2"), providerID: ProviderV2.ID.make("fake") },
      })
      const latest = yield* SessionInput.latestSeq(db, sessionID)

      expect(
        yield* db
          .select({ replacementSeq: SessionContextEpochTable.replacement_seq })
          .from(SessionContextEpochTable)
          .where(eq(SessionContextEpochTable.session_id, sessionID))
          .get()
          .pipe(Effect.orDie),
      ).toEqual({ replacementSeq: latest })
    }),
  )

  it.effect("retries epoch preparation until observation-time invalidations settle", () =>
    Effect.gen(function* () {
      yield* setup
      const session = yield* SessionV2.Service
      const events = yield* EventV2.Service
      yield* session.prompt({ sessionID, prompt: new Prompt({ text: "First" }), resume: false })
      response = []
      yield* session.resume(sessionID)

      requests.length = 0
      systemBaseline = "Changed context"
      let invalidations = 0
      systemLoadHook = Effect.suspend(() => {
        if (invalidations === 4) return Effect.void
        invalidations++
        return events
          .publish(SessionEvent.ModelSwitched, {
            sessionID,
            messageID: SessionMessage.ID.create(),
            timestamp: DateTime.makeUnsafe(invalidations),
            model: { id: ModelV2.ID.make(`replacement-${invalidations}`), providerID: ProviderV2.ID.make("fake") },
          })
          .pipe(Effect.asVoid)
      })
      yield* session.prompt({ sessionID, prompt: new Prompt({ text: "Second" }), resume: false })

      yield* session.resume(sessionID)

      expect(invalidations).toBe(4)
      expect(requests).toHaveLength(1)
      expect(requests[0]?.system.map((part) => part.text)).toEqual(["Changed context"])
    }),
  )

  it.effect("replays retained context projections while replacement is pending", () =>
    Effect.gen(function* () {
      yield* setup
      const session = yield* SessionV2.Service
      const events = yield* EventV2.Service
      yield* session.prompt({ sessionID, prompt: new Prompt({ text: "First" }), resume: false })

      requests.length = 0
      response = []
      yield* session.resume(sessionID)
      systemBaseline = "Changed context"
      yield* session.prompt({ sessionID, prompt: new Prompt({ text: "Second" }), resume: false })
      yield* session.resume(sessionID)
      yield* events.publish(SessionEvent.ModelSwitched, {
        sessionID,
        messageID: SessionMessage.ID.create(),
        timestamp: DateTime.makeUnsafe(1),
        model: { id: ModelV2.ID.make("replacement"), providerID: ProviderV2.ID.make("fake") },
      })

      yield* replaySessionProjection(sessionID)
      systemBaseline = "Replacement context"
      yield* session.prompt({ sessionID, prompt: new Prompt({ text: "Third" }), resume: false })
      yield* session.resume(sessionID)
      expect(requests.at(-1)?.system.map((part) => part.text)).toEqual(["Replacement context"])
    }),
  )

  it.effect("replaces the baseline lazily after completed compaction without reopening replacement on replay", () =>
    Effect.gen(function* () {
      yield* setup
      const session = yield* SessionV2.Service
      const events = yield* EventV2.Service
      yield* session.prompt({ sessionID, prompt: new Prompt({ text: "First" }), resume: false })

      requests.length = 0
      response = []
      yield* session.resume(sessionID)
      const compactionID = SessionMessage.ID.create()
      yield* events.publish(SessionEvent.Compaction.Started, {
        sessionID,
        messageID: compactionID,
        timestamp: DateTime.makeUnsafe(1),
        reason: "manual",
      })
      yield* events.publish(SessionEvent.Compaction.Ended, {
        sessionID,
        messageID: compactionID,
        timestamp: DateTime.makeUnsafe(2),
        reason: "manual",
        text: "summary",
        recent: "",
      })
      systemBaseline = "Replacement context"
      yield* session.prompt({ sessionID, prompt: new Prompt({ text: "Second" }), resume: false })
      yield* session.resume(sessionID)

      expect(requests.map((request) => request.system.map((part) => part.text))).toEqual([
        ["Initial context"],
        ["Replacement context"],
      ])
      yield* replaySessionProjection(sessionID)
      yield* session.prompt({ sessionID, prompt: new Prompt({ text: "Third" }), resume: false })
      yield* session.resume(sessionID)
    }),
  )

  it.effect("automatically compacts into a completed summary and retained recent turn", () =>
    Effect.gen(function* () {
      yield* setup
      const session = yield* SessionV2.Service
      response = fragmentFixture("text", "text-first", ["Earlier answer"]).completeEvents
      yield* session.prompt({
        sessionID,
        prompt: new Prompt({ text: "Earlier question ".repeat(180) }),
        resume: false,
      })
      yield* session.resume(sessionID)

      currentModel = compactModel
      requests.length = 0
      responses = [
        fragmentFixture("text", "text-summary", ["## Goal\n- Preserve the task"]).completeEvents,
        fragmentFixture("text", "text-final", ["Continued"]).completeEvents,
      ]
      yield* session.prompt({
        sessionID,
        prompt: new Prompt({ text: "Recent exact request ".repeat(180) }),
        resume: false,
      })
      yield* session.resume(sessionID)

      expect(requests).toHaveLength(2)
      expect(userTexts(requests[0])[0]).toContain("## Goal")
      expect(userTexts(requests[1])).toHaveLength(1)
      expect(userTexts(requests[1])[0]).toContain("<summary>\n## Goal\n- Preserve the task\n</summary>")
      expect(userTexts(requests[1])[0]).toContain(`[User]: ${"Recent exact request ".repeat(180)}`)

      const context = yield* (yield* SessionStore.Service).context(sessionID)
      expect(context.map((message) => message.type)).toEqual(["compaction", "assistant"])
      expect(context[0]).toMatchObject({
        type: "compaction",
        summary: "## Goal\n- Preserve the task",
      })

      requests.length = 0
      responses = [
        fragmentFixture("text", "text-summary-2", ["## Goal\n- Preserve the updated task"]).completeEvents,
        fragmentFixture("text", "text-final-2", ["Continued again"]).completeEvents,
      ]
      yield* session.prompt({
        sessionID,
        prompt: new Prompt({ text: "Newest exact request ".repeat(180) }),
        resume: false,
      })
      yield* session.resume(sessionID)

      expect(requests).toHaveLength(2)
      expect(userTexts(requests[0])[0]).toContain(
        "<previous-summary>\n## Goal\n- Preserve the task\n</previous-summary>",
      )
      expect(userTexts(requests[0])[0]).toContain("Recent exact request")
      expect((yield* (yield* SessionStore.Service).context(sessionID))[0]).toMatchObject({
        type: "compaction",
        summary: "## Goal\n- Preserve the updated task",
      })
    }),
  )

  it.effect("runs a foreground shell with configured shell, Location cwd, and bounded combined output", () =>
    Effect.gen(function* () {
      yield* setup
      const session = yield* SessionV2.Service
      configuredShell = "/bin/bash"
      shellResult = {
        ...shellResult,
        exitCode: 7,
        stdout: Buffer.from("stdout text"),
        stderr: Buffer.from("stderr text"),
        stdoutTruncated: true,
      }
      const id = SessionMessage.ID.make("msg_shell_result")

      yield* session.shell({ id, sessionID, command: "printf result", resume: false })

      expect(shellRuns).toMatchObject([
        {
          command: "printf result",
          cwd: "/project",
          shell: "/bin/bash",
          stdin: "ignore",
          detached: process.platform !== "win32",
          options: { maxOutputBytes: 1024 * 1024, maxErrorBytes: 1024 * 1024 },
        },
      ])
      expect(yield* session.message({ sessionID, messageID: id })).toMatchObject({
        id,
        type: "shell",
        command: "printf result",
        output: "stdout text\n\nstderr:\nstderr text\n\n[stdout capture truncated at the in-memory safety limit]",
        status: "completed",
        exitCode: 7,
        truncated: true,
        stdoutTruncated: true,
        time: { completed: expect.anything() },
      })
      expect(requests).toEqual([])

      yield* replaySessionProjection(sessionID)
      expect(yield* session.message({ sessionID, messageID: id })).toMatchObject({
        type: "shell",
        status: "completed",
        exitCode: 7,
        truncated: true,
        stdoutTruncated: true,
      })
    }),
  )

  it.effect("settles shell timeout and spawn failure as deterministic terminal observations", () =>
    Effect.gen(function* () {
      yield* setup
      const session = yield* SessionV2.Service
      shellFailure = new AppProcess.AppProcessError({ command: "sleep", cause: new Error("Timed out") })
      const timeoutID = SessionMessage.ID.make("msg_shell_timeout")
      yield* session.shell({ id: timeoutID, sessionID, command: "sleep 200", resume: false })
      expect(yield* session.message({ sessionID, messageID: timeoutID })).toMatchObject({
        status: "timed_out",
        output:
          "Command exceeded timeout of 120000 ms. Retry with a larger timeout if the command is expected to take longer.",
        truncated: false,
      })

      shellFailure = new AppProcess.AppProcessError({ command: "missing", cause: new Error("ENOENT") })
      const failedID = SessionMessage.ID.make("msg_shell_spawn_failure")
      yield* session.shell({ id: failedID, sessionID, command: "missing", resume: false })
      expect(yield* session.message({ sessionID, messageID: failedID })).toMatchObject({
        status: "failed",
        output: "Unable to start shell command.",
      })
    }),
  )

  it.effect("makes exact shell retries idempotent and conflicting command or resume typed", () =>
    Effect.gen(function* () {
      yield* setup
      const session = yield* SessionV2.Service
      const id = SessionMessage.ID.make("msg_shell_retry")
      const input = { id, sessionID, command: "pwd", resume: false }
      yield* session.shell(input)
      yield* session.shell(input)
      const command = yield* session.shell({ ...input, command: "whoami" }).pipe(Effect.flip)
      const resume = yield* session.shell({ ...input, resume: true }).pipe(Effect.flip)

      expect(shellRuns).toHaveLength(1)
      expect(command).toMatchObject({
        _tag: "Session.ShellConflictError",
        sessionID,
        messageID: id,
      })
      expect(resume).toMatchObject({
        _tag: "Session.ShellConflictError",
        sessionID,
        messageID: id,
      })
    }),
  )

  it.effect("serializes concurrent foreground shell commands through one lane", () =>
    Effect.gen(function* () {
      yield* setup
      const session = yield* SessionV2.Service
      shellGate = yield* Deferred.make<void>()
      shellStarted = yield* Deferred.make<void>()
      const first = yield* session
        .shell({ id: SessionMessage.ID.make("msg_shell_concurrent_one"), sessionID, command: "first", resume: false })
        .pipe(Effect.forkChild)
      yield* Deferred.await(shellStarted)
      const second = yield* session
        .shell({ id: SessionMessage.ID.make("msg_shell_concurrent_two"), sessionID, command: "second", resume: false })
        .pipe(Effect.forkChild)
      yield* Effect.yieldNow
      expect(shellRuns.map((run) => run.command)).toEqual(["first"])

      yield* Deferred.succeed(shellGate, undefined)
      yield* Effect.all([Fiber.join(first), Fiber.join(second)])

      expect(shellRuns.map((run) => run.command)).toEqual(["first", "second"])
    }),
  )

  it.effect("continues from the durable shell message only when resume is true", () =>
    Effect.gen(function* () {
      yield* setup
      const session = yield* SessionV2.Service
      response = fragmentFixture("text", "text-after-shell", ["continued"]).completeEvents

      yield* session.shell({
        id: SessionMessage.ID.make("msg_shell_resume"),
        sessionID,
        command: "pwd",
        resume: true,
      })
      yield* session.wait(sessionID)

      expect(requests).toHaveLength(1)
      expect(userTexts(requests[0]!)).toContain("Shell command: pwd\n\nshell output")
      expect(yield* session.context(sessionID)).toMatchObject([
        { type: "shell", command: "pwd", status: "completed" },
        { type: "assistant", content: [{ type: "text", text: "continued" }] },
      ])
    }),
  )

  it.effect("cleans up interruption and settles the shell without rerunning it", () =>
    Effect.gen(function* () {
      yield* setup
      const session = yield* SessionV2.Service
      shellGate = yield* Deferred.make<void>()
      shellStarted = yield* Deferred.make<void>()
      const id = SessionMessage.ID.make("msg_shell_interrupted")
      const shell = yield* session.shell({ id, sessionID, command: "sleep 30", resume: false }).pipe(Effect.forkChild)
      yield* Deferred.await(shellStarted)

      yield* session.interrupt(sessionID)
      yield* Fiber.join(shell)
      yield* session.shell({ id, sessionID, command: "sleep 30", resume: false })

      expect(shellRuns).toHaveLength(1)
      expect(yield* session.message({ sessionID, messageID: id })).toMatchObject({
        status: "interrupted",
        output: "Shell command was interrupted before completion.",
      })
    }),
  )

  it.effect("settles a persisted started shell as restart-unknown without spawning again", () =>
    Effect.gen(function* () {
      yield* setup
      const session = yield* SessionV2.Service
      const events = yield* EventV2.Service
      const { db } = yield* Database.Service
      const id = SessionMessage.ID.make("msg_shell_restart_unknown")
      const request = yield* SessionInput.admitShell(db, events, {
        id,
        sessionID,
        command: "touch marker",
        resume: false,
      })
      yield* events.publish(
        SessionEvent.Shell.Started,
        {
          sessionID,
          messageID: id,
          timestamp: yield* DateTime.now,
          callID: id,
          command: request.command,
        },
        { id: SessionInput.shellStartedEventID(id) },
      )

      yield* session.resume(sessionID)

      expect(shellRuns).toEqual([])
      expect(yield* session.message({ sessionID, messageID: id })).toMatchObject({
        status: "unknown",
        output: "Shell command outcome is unknown because execution was interrupted by a runtime restart.",
      })
    }),
  )

  it.effect("recovers a durable provider continuation after shell completion", () =>
    Effect.gen(function* () {
      yield* setup
      const session = yield* SessionV2.Service
      const events = yield* EventV2.Service
      const { db } = yield* Database.Service
      const id = SessionMessage.ID.make("msg_shell_resume_recovery")
      const request = yield* SessionInput.admitShell(db, events, {
        id,
        sessionID,
        command: "pwd",
        resume: true,
      })
      yield* SessionInput.startShell(db, events, request)
      yield* SessionInput.endShell(db, events, request, {
        status: "completed",
        output: "/project",
        exitCode: 0,
        truncated: false,
      })
      response = fragmentFixture("text", "text-shell-recovered", ["recovered continuation"]).completeEvents

      yield* session.resume(sessionID)

      expect(shellRuns).toEqual([])
      expect(requests).toHaveLength(1)
      expect(userTexts(requests[0]!)).toContain("Shell command: pwd\n\n/project")
      expect(yield* SessionInput.startedShellContinuation(db, id)).toBeTrue()
      expect(yield* SessionInput.shellContinued(db, id)).toBeTrue()
    }),
  )

  it.effect("settles epoch loss after process start without publishing stale output", () =>
    Effect.gen(function* () {
      yield* setup
      const session = yield* SessionV2.Service
      const runtime = yield* SessionRuntime.Service
      shellGate = yield* Deferred.make<void>()
      shellStarted = yield* Deferred.make<void>()
      const id = SessionMessage.ID.make("msg_shell_epoch_loss")
      const shell = yield* session.shell({ id, sessionID, command: "pwd", resume: false }).pipe(Effect.forkChild)
      yield* Deferred.await(shellStarted)
      yield* runtime.assign({ sessionID, state: "paused", expectedOwner: "v2", expectedEpoch: 1 })
      yield* Deferred.succeed(shellGate, undefined)

      yield* Fiber.join(shell)

      expect(shellRuns).toHaveLength(1)
      expect(yield* session.message({ sessionID, messageID: id })).toMatchObject({
        status: "interrupted",
        output: "Shell command was interrupted before completion.",
      })
    }),
  )

  it.effect("never publishes Started or spawns after epoch loss wins before spawn", () =>
    Effect.gen(function* () {
      yield* setup
      const session = yield* SessionV2.Service
      const runtime = yield* SessionRuntime.Service
      const events = yield* EventV2.Service
      const { db } = yield* Database.Service
      const id = SessionMessage.ID.make("msg_shell_epoch_before_spawn")
      let armed = true
      yield* events.beforeCommit((event) => {
        if (!armed || !Schema.is(SessionEvent.Shell.Started)(event)) return Effect.void
        armed = false
        return runtime
          .assign({ sessionID, state: "paused", expectedOwner: "v2", expectedEpoch: 1 })
          .pipe(Effect.orDie, Effect.asVoid)
      })

      yield* session.shell({ id, sessionID, command: "touch marker", resume: false })

      expect(shellRuns).toEqual([])
      expect(yield* SessionInput.startedShell(db, id)).toBeFalse()
      expect(yield* SessionInput.terminalShell(db, id)).toMatchObject({ status: "interrupted" })
    }),
  )

  it.effect("serializes ownership recovery and terminal before the stale process launch", () =>
    Effect.gen(function* () {
      yield* setup
      const session = yield* SessionV2.Service
      const runtime = yield* SessionRuntime.Service
      const events = yield* EventV2.Service
      const { db } = yield* Database.Service
      const id = SessionMessage.ID.make("msg_shell_recovery_before_launch")
      const committed = yield* Deferred.make<void>()
      const release = yield* Deferred.make<void>()
      yield* events.listen((event) =>
        Schema.is(SessionEvent.Shell.Started)(event) && event.data.messageID === id
          ? Deferred.succeed(committed, undefined).pipe(Effect.andThen(Deferred.await(release)))
          : Effect.void,
      )
      const shell = yield* session
        .shell({ id, sessionID, command: "touch marker", resume: false })
        .pipe(Effect.forkChild)
      yield* Deferred.await(committed)
      const request = yield* SessionInput.findShell(db, id)
      expect(request).toBeDefined()

      yield* runtime.recover()
      yield* SessionInput.endShell(
        db,
        events,
        request!,
        {
          status: "unknown",
          output: "Shell command outcome is unknown because execution was interrupted by a runtime restart.",
          truncated: false,
        },
        "started",
      )
      expect(yield* SessionInput.terminalShell(db, id)).toMatchObject({ status: "unknown" })
      yield* Deferred.succeed(release, undefined)
      yield* Fiber.join(shell)

      expect(shellRuns).toEqual([])
    }),
  )

  it.effect("settles an interrupt committed after Requested but before its wake", () =>
    Effect.gen(function* () {
      yield* setup
      const session = yield* SessionV2.Service
      const events = yield* EventV2.Service
      const { db } = yield* Database.Service
      const id = SessionMessage.ID.make("msg_shell_interrupt_before_wake")
      const committed = yield* Deferred.make<void>()
      const release = yield* Deferred.make<void>()
      yield* events.listen((event) =>
        Schema.is(SessionEvent.Shell.Requested)(event) && event.data.messageID === id
          ? Deferred.succeed(committed, undefined).pipe(Effect.andThen(Deferred.await(release)))
          : Effect.void,
      )
      const shell = yield* session.shell({ id, sessionID, command: "pwd", resume: false }).pipe(Effect.forkChild)
      yield* Deferred.await(committed)

      yield* session.interrupt(sessionID)

      expect(yield* SessionInput.terminalShell(db, id)).toMatchObject({
        status: "interrupted",
        output: "Shell command was interrupted before completion.",
      })
      yield* Deferred.succeed(release, undefined)
      yield* Fiber.join(shell)
      yield* session.shell({ id, sessionID, command: "pwd", resume: false })
      expect(shellRuns).toEqual([])
    }),
  )

  it.effect("continues from a projected pre-start shell terminal", () =>
    Effect.gen(function* () {
      yield* setup
      const session = yield* SessionV2.Service
      const events = yield* EventV2.Service
      const { db } = yield* Database.Service
      const id = SessionMessage.ID.make("msg_shell_prestart_context")
      const request = yield* SessionInput.admitShell(db, events, {
        id,
        sessionID,
        command: "pwd",
        resume: true,
      })
      yield* SessionInput.endShell(
        db,
        events,
        request,
        { status: "interrupted", output: "Shell did not start because ownership changed.", truncated: false },
        "requested",
      )
      response = fragmentFixture("text", "text-after-prestart-shell", ["continued after failure"]).completeEvents

      yield* session.resume(sessionID)

      expect(requests).toHaveLength(1)
      expect(userTexts(requests[0]!)).toContain("Shell command: pwd\n\nShell did not start because ownership changed.")
      expect(yield* session.message({ sessionID, messageID: id })).toMatchObject({
        type: "shell",
        command: "pwd",
        status: "interrupted",
        output: "Shell did not start because ownership changed.",
      })
    }),
  )

  for (const dispatched of [false, true])
    it.effect(
      `does not redispatch a continuation after its durable start marker${dispatched ? " and provider output" : ""}`,
      () =>
        Effect.gen(function* () {
          yield* setup
          const session = yield* SessionV2.Service
          const events = yield* EventV2.Service
          const { db } = yield* Database.Service
          const id = SessionMessage.ID.make(`msg_shell_continuation_started_${dispatched}`)
          const request = yield* SessionInput.admitShell(db, events, {
            id,
            sessionID,
            command: "pwd",
            resume: true,
          })
          yield* SessionInput.startShell(db, events, request)
          yield* SessionInput.endShell(db, events, request, {
            status: "completed",
            output: "/project",
            exitCode: 0,
            truncated: false,
          })
          yield* SessionInput.startShellContinuation(db, events, request)
          if (dispatched) {
            const assistantMessageID = SessionMessage.ID.make("msg_shell_dispatched_assistant")
            yield* events.publish(SessionEvent.Step.Started, {
              sessionID,
              timestamp: yield* DateTime.now,
              assistantMessageID,
              agent: "build",
              model: { id: ModelV2.ID.make(model.id), providerID: ProviderV2.ID.make(model.provider) },
            })
            yield* events.publish(SessionEvent.Step.Ended, {
              sessionID,
              timestamp: yield* DateTime.now,
              assistantMessageID,
              finish: "stop",
              cost: 0,
              tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
            })
          }

          yield* session.resume(sessionID)

          expect(requests).toEqual([])
          expect(yield* SessionInput.unknownShellContinuation(db, id)).toBeTrue()
          expect(yield* SessionInput.shellContinued(db, id)).toBeFalse()
        }),
    )

  it.effect("returns at its shell terminal while a coalesced prompt runs later", () =>
    Effect.gen(function* () {
      yield* setup
      const session = yield* SessionV2.Service
      shellGate = yield* Deferred.make<void>()
      shellStarted = yield* Deferred.make<void>()
      streamGate = yield* Deferred.make<void>()
      streamStarted = yield* Deferred.make<void>()
      response = fragmentFixture("text", "text-after-ordered-shell", ["later prompt"]).completeEvents
      const shell = yield* session
        .shell({ id: SessionMessage.ID.make("msg_shell_ordered"), sessionID, command: "pwd", resume: false })
        .pipe(Effect.forkChild)
      yield* Deferred.await(shellStarted)
      yield* session.prompt({ sessionID, prompt: new Prompt({ text: "Prompt after shell" }) })
      yield* Deferred.succeed(shellGate, undefined)

      yield* Fiber.join(shell)
      yield* Deferred.await(streamStarted)
      expect(userTexts(requests[0]!)).toEqual(["Shell command: pwd\n\nshell output", "Prompt after shell"])
      yield* Deferred.succeed(streamGate, undefined)
      yield* session.wait(sessionID)
    }),
  )

  it.effect("rejects missing and V1-owned shell controls before admission", () =>
    Effect.gen(function* () {
      yield* setup
      const { db } = yield* Database.Service
      const control = yield* SessionControl.Service
      const missing = SessionV2.ID.make("ses_missing_shell_control")
      const missingError = yield* control.shell({ sessionID: missing, command: "pwd" }).pipe(Effect.flip)
      yield* db
        .update(SessionTable)
        .set({ runtime: "v1" })
        .where(eq(SessionTable.id, sessionID))
        .run()
        .pipe(Effect.orDie)
      const v1 = yield* control.shell({ sessionID, command: "pwd" }).pipe(Effect.flip)

      expect(missingError).toMatchObject({ _tag: "SessionRuntime.NotFound", sessionID: missing })
      expect(v1).toMatchObject({ _tag: "SessionRuntime.Mismatch", actualOwner: "v1" })
      expect(shellRuns).toEqual([])
      expect(yield* SessionInput.pendingShell(db, sessionID)).toBeUndefined()
      expect(
        yield* db
          .select()
          .from(EventTable)
          .where(eq(EventTable.type, "session.next.shell.requested.1"))
          .all()
          .pipe(Effect.orDie),
      ).toEqual([])
    }),
  )

  it.effect("manually compacts short history without starting an assistant continuation", () =>
    Effect.gen(function* () {
      const session = yield* setupManualCompaction
      response = fragmentFixture("text", "text-manual-summary", [
        "## Goal\n- Preserve the short history",
      ]).completeEvents
      const id = SessionMessage.ID.make("msg_manual_short")

      yield* session.compact({
        id,
        sessionID,
        prompt: new Prompt({ text: "Emphasize unresolved test failures" }),
      })

      expect(requests).toHaveLength(1)
      expect(userTexts(requests[0]!)[0]).toContain("Short history to preserve")
      expect(userTexts(requests[0]!)[0]).toContain("Additional summary instruction")
      expect(userTexts(requests[0]!)[0]).toContain("Emphasize unresolved test failures")
      expect(yield* session.context(sessionID)).toMatchObject([
        { id, type: "compaction", reason: "manual", summary: "## Goal\n- Preserve the short history", recent: "" },
      ])
    }),
  )

  it.effect("treats manual compaction of empty history as a durable successful no-op", () =>
    Effect.gen(function* () {
      yield* setup
      const session = yield* SessionV2.Service

      yield* session.compact({ id: SessionMessage.ID.make("msg_manual_empty"), sessionID })

      expect(requests).toEqual([])
      expect(yield* session.context(sessionID)).toEqual([])
    }),
  )

  it.effect("makes exact manual retries idempotent and conflicting instructions typed", () =>
    Effect.gen(function* () {
      const session = yield* setupManualCompaction
      const id = SessionMessage.ID.make("msg_manual_retry")
      const input = { id, sessionID, prompt: new Prompt({ text: "Keep decisions" }) }
      response = fragmentFixture("text", "text-manual-retry", ["## Goal\n- Keep decisions"]).completeEvents
      yield* session.compact(input)
      requests.length = 0

      yield* session.compact(input)
      const conflict = yield* session
        .compact({ id, sessionID, prompt: new Prompt({ text: "Drop decisions" }) })
        .pipe(Effect.flip)

      expect(requests).toEqual([])
      expect(conflict).toMatchObject({
        _tag: "Session.CompactionConflictError",
        sessionID,
        messageID: id,
      })
    }),
  )

  it.effect("rejects non-text manual compaction instructions before admission", () =>
    Effect.gen(function* () {
      yield* setup
      const session = yield* SessionV2.Service
      const failure = yield* session
        .compact({
          sessionID,
          prompt: new Prompt({
            text: "Summarize",
            files: [new FileAttachment({ uri: "file:///tmp/input.txt", mime: "text/plain" })],
          }),
        })
        .pipe(Effect.flip)

      expect(failure).toMatchObject({
        _tag: "Session.CompactionPromptUnsupportedError",
        message: "Manual compaction instructions support text only",
      })
      expect(requests).toEqual([])
    }),
  )

  for (const fixture of [
    { name: "provider failures", response: "provider" as const, reason: "provider" },
    { name: "empty summaries", response: "empty" as const, reason: "empty" },
  ])
    it.effect(`settles ${fixture.name} as a durable typed manual failure`, () =>
      Effect.gen(function* () {
        const session = yield* setupManualCompaction
        if (fixture.response === "provider") streamFailure = providerUnavailable()
        if (fixture.response === "empty") response = []
        const id = SessionMessage.ID.make(`msg_manual_${fixture.response}`)

        const failure = yield* session.compact({ id, sessionID }).pipe(Effect.flip)
        requests.length = 0
        const retried = yield* session.compact({ id, sessionID }).pipe(Effect.flip)

        expect(failure).toMatchObject({
          _tag: "Session.CompactionFailedError",
          sessionID,
          messageID: id,
          reason: fixture.reason,
        })
        expect(retried).toEqual(failure)
        expect(requests).toEqual([])
        expect((yield* session.context(sessionID)).some((message) => message.type === "compaction")).toBe(false)
      }),
    )

  it.effect("durably fails a manual request interrupted during provider execution", () =>
    Effect.gen(function* () {
      const session = yield* setupManualCompaction
      streamGate = yield* Deferred.make<void>()
      streamStarted = yield* Deferred.make<void>()
      const compact = yield* session
        .compact({ id: SessionMessage.ID.make("msg_manual_interrupted"), sessionID })
        .pipe(Effect.forkChild)
      yield* Deferred.await(streamStarted)

      yield* session.interrupt(sessionID)
      const failure = yield* Fiber.join(compact).pipe(Effect.flip)

      expect(failure).toMatchObject({
        _tag: "Session.CompactionFailedError",
        reason: "interrupted",
        message: "Compaction was interrupted",
      })
      expect((yield* session.context(sessionID)).some((message) => message.type === "compaction")).toBe(false)
    }),
  )

  it.effect("durably fails when the runtime epoch changes before checkpoint publication", () =>
    Effect.gen(function* () {
      const session = yield* setupManualCompaction
      const runtime = yield* SessionRuntime.Service
      streamGate = yield* Deferred.make<void>()
      streamStarted = yield* Deferred.make<void>()
      response = fragmentFixture("text", "text-stale-summary", ["stale summary"]).completeEvents
      const compact = yield* session
        .compact({ id: SessionMessage.ID.make("msg_manual_epoch"), sessionID })
        .pipe(Effect.forkChild)
      yield* Deferred.await(streamStarted)
      const active = yield* runtime.assert({ sessionID, owner: "v2" })
      yield* runtime.assign({
        sessionID,
        state: "paused",
        expectedOwner: "v2",
        expectedEpoch: active.epoch,
      })
      yield* Deferred.succeed(streamGate, undefined)

      const failure = yield* Fiber.join(compact).pipe(Effect.flip)

      expect(failure).toMatchObject({ _tag: "Session.CompactionFailedError", reason: "runtime" })
      expect((yield* session.context(sessionID)).some((message) => message.type === "compaction")).toBe(false)
    }),
  )

  it.effect("updates a previous manual summary with later history", () =>
    Effect.gen(function* () {
      const session = yield* setupManualCompaction
      response = fragmentFixture("text", "text-first-summary", ["## Goal\n- First summary"]).completeEvents
      yield* session.compact({ id: SessionMessage.ID.make("msg_manual_first"), sessionID })
      response = fragmentFixture("text", "text-after-summary", ["Later answer"]).completeEvents
      yield* session.prompt({
        sessionID,
        prompt: new Prompt({ text: "Later history" }),
        resume: false,
      })
      yield* session.resume(sessionID)
      requests.length = 0
      response = fragmentFixture("text", "text-second-summary", ["## Goal\n- Updated summary"]).completeEvents

      yield* session.compact({ id: SessionMessage.ID.make("msg_manual_second"), sessionID })

      expect(requests).toHaveLength(1)
      expect(userTexts(requests[0]!)[0]).toContain("<previous-summary>\n## Goal\n- First summary")
      expect(userTexts(requests[0]!)[0]).toContain("[User]: Later history")
      expect(yield* session.context(sessionID)).toMatchObject([
        { type: "compaction", reason: "manual", summary: "## Goal\n- Updated summary", recent: "" },
      ])
    }),
  )

  it.effect("settles an invalid manual context budget without calling the provider", () =>
    Effect.gen(function* () {
      const session = yield* setupManualCompaction
      currentModel = model
      const id = SessionMessage.ID.make("msg_manual_context")

      const failure = yield* session.compact({ id, sessionID }).pipe(Effect.flip)

      expect(failure).toMatchObject({
        _tag: "Session.CompactionFailedError",
        messageID: id,
        reason: "context",
      })
      expect(requests).toEqual([])
    }),
  )

  it.effect("returns after manual settlement while a separately queued prompt runs later", () =>
    Effect.gen(function* () {
      const session = yield* setupManualCompaction
      yield* session.prompt({
        sessionID,
        prompt: new Prompt({ text: "Queued after the checkpoint" }),
        delivery: "queue",
        resume: false,
      })
      responseStream = Stream.fromIterable(
        fragmentFixture("text", "text-ordered-summary", ["## Goal\n- Ordered summary"]).completeEvents,
      )
      response = fragmentFixture("text", "text-queued-answer", ["Queued answer"]).completeEvents
      streamGate = yield* Deferred.make<void>()
      streamStarted = yield* Deferred.make<void>()

      yield* session.compact({ id: SessionMessage.ID.make("msg_manual_ordered"), sessionID })
      yield* Deferred.await(streamStarted)

      expect(requests).toHaveLength(2)
      expect(userTexts(requests[0]!)[0]).toContain("Short history to preserve")
      expect(userTexts(requests[1]!)).toContain("Queued after the checkpoint")
      yield* Deferred.succeed(streamGate, undefined)
      yield* session.wait(sessionID)
    }),
  )

  it.effect("runs manual compaction before prompts coalesced into an active normal drain", () =>
    Effect.gen(function* () {
      const session = yield* setupManualCompaction
      const { db } = yield* Database.Service
      const gate = yield* Deferred.make<void>()
      streamGate = gate
      streamStarted = yield* Deferred.make<void>()
      response = fragmentFixture("text", "text-active-before-manual", ["Active answer"]).completeEvents
      yield* session.prompt({
        sessionID,
        prompt: new Prompt({ text: "Active turn before compaction" }),
        resume: false,
      })
      const active = yield* session.resume(sessionID).pipe(Effect.forkChild)
      yield* Deferred.await(streamStarted)
      streamGate = undefined
      streamStarted = undefined
      responses = [
        fragmentFixture("text", "text-coalesced-summary", ["## Goal\n- Coalesced summary"]).completeEvents,
        fragmentFixture("text", "text-coalesced-queued", ["Queued answer"]).completeEvents,
      ]
      yield* session.prompt({
        sessionID,
        prompt: new Prompt({ text: "Queued after active turn" }),
        delivery: "queue",
        resume: false,
      })
      const compact = yield* session
        .compact({ id: SessionMessage.ID.make("msg_manual_coalesced"), sessionID })
        .pipe(Effect.forkChild)
      while (!(yield* SessionInput.pendingCompaction(db, sessionID))) yield* Effect.yieldNow

      yield* Deferred.succeed(gate, undefined)
      yield* Fiber.join(compact)
      yield* Fiber.join(active)
      yield* session.wait(sessionID)

      expect(requests).toHaveLength(3)
      expect(requests[1]!.tools).toEqual([])
      expect(userTexts(requests[1]!)[0]).toContain("Create a new anchored summary")
      expect(userTexts(requests[2]!)).toContain("Queued after active turn")
    }),
  )

  it.effect("settles every manual request admitted while one compaction is active", () =>
    Effect.gen(function* () {
      const session = yield* setupManualCompaction
      const { db } = yield* Database.Service
      streamGate = yield* Deferred.make<void>()
      streamStarted = yield* Deferred.make<void>()
      response = fragmentFixture("text", "text-first-coalesced-summary", ["## Goal\n- First summary"]).completeEvents
      const ids = ["one", "two", "three"].map((suffix) => SessionMessage.ID.make(`msg_manual_${suffix}`))
      const first = yield* session.compact({ id: ids[0], sessionID }).pipe(Effect.forkChild)
      yield* Deferred.await(streamStarted)
      const rest = yield* Effect.forEach(ids.slice(1), (id) =>
        session.compact({ id, sessionID }).pipe(Effect.forkChild),
      )
      while (
        (yield* db
          .select()
          .from(EventTable)
          .where(eq(EventTable.type, "session.next.compaction.requested.1"))
          .all()
          .pipe(Effect.orDie)).length < 3
      )
        yield* Effect.yieldNow

      yield* Deferred.succeed(streamGate, undefined)
      yield* Fiber.join(first)
      yield* Effect.forEach(rest, Fiber.join)

      expect(requests).toHaveLength(1)
      expect(yield* Effect.forEach(ids, (id) => SessionInput.terminalCompaction(db, id))).toEqual([
        { type: "ended" },
        { type: "skipped" },
        { type: "skipped" },
      ])
    }),
  )

  it.effect("forces one compaction and retries after provider context overflow", () =>
    Effect.gen(function* () {
      const session = yield* setupOverflowRecovery
      responses = [
        [
          LLMEvent.stepStart({ index: 0 }),
          LLMEvent.providerError({ message: "prompt too long", classification: "context-overflow" }),
        ],
        fragmentFixture("text", "text-summary", ["## Goal\n- Recover overflow"]).completeEvents,
        fragmentFixture("text", "text-final", ["Recovered"]).completeEvents,
      ]
      yield* session.prompt({ sessionID, prompt: new Prompt({ text: "Continue" }), resume: false })
      yield* session.resume(sessionID)

      expect(requests).toHaveLength(3)
      expect(userTexts(requests[1])[0]).toContain("## Goal")
      expect(userTexts(requests[2])[0]).toContain("<summary>\n## Goal\n- Recover overflow\n</summary>")
      expect(yield* session.context(sessionID)).toMatchObject([
        { type: "compaction", summary: "## Goal\n- Recover overflow" },
        { type: "assistant", finish: "stop" },
      ])
      yield* replaySessionProjection(sessionID)
      expect(yield* session.context(sessionID)).toMatchObject([
        { type: "compaction" },
        { type: "assistant", finish: "stop" },
      ])
    }),
  )

  it.effect("persists a second context overflow after one recovery", () =>
    Effect.gen(function* () {
      const session = yield* setupOverflowRecovery
      const overflow = () => [
        LLMEvent.stepStart({ index: 0 }),
        LLMEvent.providerError({ message: "prompt too long", classification: "context-overflow" }),
      ]
      responses = [
        overflow(),
        fragmentFixture("text", "text-summary", ["## Goal\n- Recover once"]).completeEvents,
        overflow(),
      ]
      yield* session.prompt({ sessionID, prompt: new Prompt({ text: "Continue" }), resume: false })
      yield* session.resume(sessionID)

      expect(requests).toHaveLength(3)
      expect(yield* session.context(sessionID)).toMatchObject([
        { type: "compaction" },
        { type: "assistant", finish: "error", error: { message: "prompt too long" } },
      ])
    }),
  )

  it.effect("recovers once from a raw context overflow failure", () =>
    Effect.gen(function* () {
      const session = yield* setupOverflowRecovery
      responseStream = Stream.fail(
        new LLMError({
          module: "test",
          method: "stream",
          reason: new InvalidRequestReason({
            message: "prompt too long",
            classification: "context-overflow",
          }),
        }),
      )
      responses = [
        fragmentFixture("text", "text-summary", ["## Goal\n- Recover raw overflow"]).completeEvents,
        fragmentFixture("text", "text-final", ["Recovered"]).completeEvents,
      ]
      yield* session.prompt({ sessionID, prompt: new Prompt({ text: "Continue" }), resume: false })
      yield* session.resume(sessionID)

      expect(requests).toHaveLength(3)
      expect(yield* session.context(sessionID)).toMatchObject([
        { type: "compaction", summary: "## Goal\n- Recover raw overflow" },
        { type: "assistant", finish: "stop" },
      ])
    }),
  )

  it.effect("publishes the original overflow when recovery summarization fails", () =>
    Effect.gen(function* () {
      const session = yield* setupOverflowRecovery
      responses = [
        [LLMEvent.providerError({ message: "prompt too long", classification: "context-overflow" })],
        [LLMEvent.providerError({ message: "summary unavailable" })],
      ]
      yield* session.prompt({ sessionID, prompt: new Prompt({ text: "Continue" }), resume: false })
      yield* session.resume(sessionID)

      expect(requests).toHaveLength(2)
      const context = yield* session.context(sessionID)
      expect(context.some((message) => message.type === "compaction")).toBe(false)
      expect(context.slice(-2)).toMatchObject([
        { type: "user", text: "Continue" },
        { type: "assistant", finish: "error", error: { message: "prompt too long" } },
      ])
    }),
  )

  it.effect("interrupts overflow recovery while the summary provider is running", () =>
    Effect.gen(function* () {
      const session = yield* setupOverflowRecovery
      responses = [
        [LLMEvent.providerError({ message: "prompt too long", classification: "context-overflow" })],
        fragmentFixture("text", "text-summary", ["## Goal\n- Interrupted"]).completeEvents,
      ]
      const firstGate = yield* Deferred.make<void>()
      const summaryGate = yield* Deferred.make<void>()
      streamGate = firstGate
      yield* session.prompt({ sessionID, prompt: new Prompt({ text: "Continue" }), resume: false })
      const run = yield* session.resume(sessionID).pipe(Effect.forkChild)
      while (requests.length < 1) yield* Effect.yieldNow
      streamGate = summaryGate
      yield* Deferred.succeed(firstGate, undefined)
      while (requests.length < 2) yield* Effect.yieldNow

      yield* session.interrupt(sessionID)
      expect(yield* Fiber.await(run)).toMatchObject({ _tag: "Failure" })
      streamGate = undefined
      expect(requests).toHaveLength(2)
      expect((yield* session.context(sessionID)).some((message) => message.type === "compaction")).toBe(false)
    }),
  )

  it.effect("preserves effective System updates while compaction replacement is blocked", () =>
    Effect.gen(function* () {
      yield* setup
      const session = yield* SessionV2.Service
      const events = yield* EventV2.Service
      yield* session.prompt({ sessionID, prompt: new Prompt({ text: "First" }), resume: false })

      requests.length = 0
      response = []
      yield* session.resume(sessionID)
      systemBaseline = "Changed context"
      yield* session.prompt({ sessionID, prompt: new Prompt({ text: "Second" }), resume: false })
      yield* session.resume(sessionID)
      const compactionID = SessionMessage.ID.create()
      yield* events.publish(SessionEvent.Compaction.Started, {
        sessionID,
        messageID: compactionID,
        timestamp: DateTime.makeUnsafe(1),
        reason: "manual",
      })
      yield* events.publish(SessionEvent.Compaction.Ended, {
        sessionID,
        messageID: compactionID,
        timestamp: DateTime.makeUnsafe(2),
        reason: "manual",
        text: "summary",
        recent: "",
      })
      systemUnavailable = true
      yield* session.prompt({ sessionID, prompt: new Prompt({ text: "Third" }), resume: false })
      yield* session.resume(sessionID)

      expect(requests.at(-1)?.system.map((part) => part.text)).toEqual(["Initial context"])
      expect(
        requests
          .at(-1)
          ?.messages.some(
            (message) =>
              message.role === "system" &&
              message.content[0]?.type === "text" &&
              message.content[0].text === "Changed context",
          ),
      ).toBe(true)
    }),
  )

  it.effect("projects reasoning and tool events without executing or continuing tools", () =>
    Effect.gen(function* () {
      yield* setup
      const session = yield* SessionV2.Service
      yield* session.prompt({ sessionID, prompt: new Prompt({ text: "Use tools" }), resume: false })

      requests.length = 0
      responses = undefined
      streamGate = undefined
      streamStarted = undefined
      response = [
        LLMEvent.stepStart({ index: 0 }),
        LLMEvent.reasoningStart({ id: "reasoning-1" }),
        LLMEvent.reasoningDelta({ id: "reasoning-1", text: "Think" }),
        LLMEvent.reasoningEnd({ id: "reasoning-1" }),
        LLMEvent.toolInputStart({ id: "call-error", name: "write" }),
        LLMEvent.toolInputDelta({ id: "call-error", name: "write", text: '{"path":"README.md"}' }),
        LLMEvent.toolInputEnd({ id: "call-error", name: "write" }),
        LLMEvent.toolCall({ id: "call-error", name: "write", input: { path: "README.md" }, providerExecuted: true }),
        LLMEvent.toolError({ id: "call-error", name: "write", message: "Denied" }),
        LLMEvent.toolResult({ id: "call-error", name: "write", result: { type: "error", value: "Denied" } }),
        LLMEvent.toolCall({
          id: "call-provider",
          name: "web_search",
          input: { query: "hello" },
          providerExecuted: true,
          providerMetadata: { fake: { source: "provider" } },
        }),
        LLMEvent.toolResult({
          id: "call-provider",
          name: "web_search",
          result: {
            type: "content",
            value: [
              { type: "text", text: "Hello" },
              { type: "file", uri: "data:image/png;base64,aGVsbG8=", mime: "image/png", name: "hello.png" },
            ],
          },
          providerExecuted: true,
          providerMetadata: { fake: { source: "provider" } },
        }),
        LLMEvent.stepFinish({
          index: 0,
          reason: "tool-calls",
          usage: {
            inputTokens: 10,
            nonCachedInputTokens: 8,
            outputTokens: 4,
            reasoningTokens: 1,
            cacheReadInputTokens: 2,
          },
        }),
        LLMEvent.finish({ reason: "tool-calls" }),
      ]

      yield* session.resume(sessionID)

      expect(requests).toHaveLength(1)
      expect(requests[0]?.tools.map((tool) => tool.name)).toEqual(["echo", "defect"])
      expect(yield* session.context(sessionID)).toMatchObject([
        { type: "user", text: "Use tools" },
        {
          type: "assistant",
          finish: "tool-calls",
          tokens: { input: 8, output: 3, reasoning: 1, cache: { read: 2, write: 0 } },
          content: [
            { type: "reasoning", id: "reasoning-1", text: "Think" },
            {
              type: "tool",
              id: "call-error",
              name: "write",
              state: {
                status: "error",
                input: { path: "README.md" },
                error: { type: "unknown", message: "Denied" },
              },
            },
            {
              type: "tool",
              id: "call-provider",
              name: "web_search",
              provider: { executed: true, metadata: { fake: { source: "provider" } } },
              state: {
                status: "completed",
                input: { query: "hello" },
                structured: {},
                content: [
                  { type: "text", text: "Hello" },
                  { type: "file", mime: "image/png", uri: "data:image/png;base64,aGVsbG8=", name: "hello.png" },
                ],
              },
            },
          ],
        },
      ])
    }),
  )

  it.effect("continues with reloaded history after durably settling one local tool call", () =>
    Effect.gen(function* () {
      yield* setup
      const session = yield* SessionV2.Service
      yield* session.prompt({ sessionID, prompt: new Prompt({ text: "Echo this" }), resume: false })

      requests.length = 0
      authorizations.length = 0
      executions.length = 0
      streamGate = undefined
      streamStarted = undefined
      responses = [
        [
          LLMEvent.stepStart({ index: 0 }),
          LLMEvent.toolCall({ id: "call-echo", name: "echo", input: { text: "hello" } }),
          LLMEvent.stepFinish({ index: 0, reason: "tool-calls" }),
          LLMEvent.finish({ reason: "tool-calls" }),
        ],
        [
          LLMEvent.stepStart({ index: 0 }),
          LLMEvent.textStart({ id: "text-final" }),
          LLMEvent.textDelta({ id: "text-final", text: "Done" }),
          LLMEvent.textEnd({ id: "text-final" }),
          LLMEvent.stepFinish({ index: 0, reason: "stop" }),
          LLMEvent.finish({ reason: "stop" }),
        ],
      ]

      yield* session.resume(sessionID)

      expect(requests).toHaveLength(2)
      expect(requests[1]?.messages.map((message) => message.role)).toEqual(["user", "assistant", "tool"])
      expect(authorizations).toMatchObject([{ sessionID, toolCallID: "call-echo" }])
      expect(executions).toEqual(["hello"])
      expect(yield* session.context(sessionID)).toMatchObject([
        { type: "user", text: "Echo this" },
        {
          type: "assistant",
          finish: "tool-calls",
          content: [
            {
              type: "tool",
              id: "call-echo",
              name: "echo",
              state: {
                status: "completed",
                input: { text: "hello" },
                structured: { text: "hello" },
                content: [{ type: "text", text: "hello" }],
              },
            },
          ],
        },
        { type: "assistant", finish: "stop", content: [{ type: "text", id: "text-final", text: "Done" }] },
      ])
    }),
  )

  it.effect("reloads a model switch before a tool-driven continuation turn", () =>
    Effect.gen(function* () {
      yield* setup
      const session = yield* SessionV2.Service
      const events = yield* EventV2.Service
      yield* session.prompt({ sessionID, prompt: new Prompt({ text: "Echo this" }), resume: false })

      requests.length = 0
      responses = [
        [
          LLMEvent.stepStart({ index: 0 }),
          LLMEvent.toolCall({ id: "call-echo", name: "echo", input: { text: "hello" } }),
          LLMEvent.stepFinish({ index: 0, reason: "tool-calls" }),
          LLMEvent.finish({ reason: "tool-calls" }),
        ],
        [
          LLMEvent.stepStart({ index: 0 }),
          LLMEvent.stepFinish({ index: 0, reason: "stop" }),
          LLMEvent.finish({ reason: "stop" }),
        ],
      ]
      toolExecutionGate = yield* Deferred.make<void>()
      toolExecutionsStarted = yield* Deferred.make<void>()
      toolExecutionsReady = 1
      const run = yield* Effect.forkChild(session.resume(sessionID))
      yield* Deferred.await(toolExecutionsStarted)
      yield* events.publish(SessionEvent.ModelSwitched, {
        sessionID,
        messageID: SessionMessage.ID.create(),
        timestamp: DateTime.makeUnsafe(1),
        model: { id: ModelV2.ID.make("replacement"), providerID: ProviderV2.ID.make("fake") },
      })
      systemBaseline = "Replacement context"
      yield* Deferred.succeed(toolExecutionGate, undefined)
      yield* Fiber.join(run)

      expect(requests.map((request) => request.model)).toEqual([model, replacementModel])
      expect(requests.map((request) => request.system.map((part) => part.text))).toEqual([
        ["Initial context"],
        ["Replacement context"],
      ])
    }),
  )

  it.effect("restores durable reasoning provider metadata in a second-turn request", () =>
    Effect.gen(function* () {
      yield* setup
      const session = yield* SessionV2.Service
      yield* session.prompt({ sessionID, prompt: new Prompt({ text: "Think first" }), resume: false })

      requests.length = 0
      response = [
        LLMEvent.stepStart({ index: 0 }),
        LLMEvent.reasoningStart({ id: "reasoning-anthropic" }),
        LLMEvent.reasoningDelta({ id: "reasoning-anthropic", text: "Signed thought" }),
        LLMEvent.reasoningEnd({ id: "reasoning-anthropic", providerMetadata: { anthropic: { signature: "sig_1" } } }),
        LLMEvent.reasoningStart({
          id: "reasoning-openai",
          providerMetadata: { openai: { itemId: "rs_1", reasoningEncryptedContent: null } },
        }),
        LLMEvent.reasoningDelta({ id: "reasoning-openai", text: "Encrypted thought" }),
        LLMEvent.reasoningEnd({
          id: "reasoning-openai",
          providerMetadata: { openai: { itemId: "rs_1", reasoningEncryptedContent: "encrypted-state" } },
        }),
        LLMEvent.stepFinish({ index: 0, reason: "stop" }),
        LLMEvent.finish({ reason: "stop" }),
      ]
      yield* session.resume(sessionID)
      yield* replaySessionProjection(sessionID)

      expect(yield* session.context(sessionID)).toMatchObject([
        { type: "user", text: "Think first" },
        {
          type: "assistant",
          content: [
            { type: "reasoning", text: "Signed thought", providerMetadata: { anthropic: { signature: "sig_1" } } },
            {
              type: "reasoning",
              text: "Encrypted thought",
              providerMetadata: { openai: { itemId: "rs_1", reasoningEncryptedContent: "encrypted-state" } },
            },
          ],
        },
      ])

      yield* session.prompt({ sessionID, prompt: new Prompt({ text: "Continue" }), resume: false })
      response = []
      yield* session.resume(sessionID)

      expect(requests[1]?.messages[1]?.content).toEqual([
        { type: "reasoning", text: "Signed thought", providerMetadata: { anthropic: { signature: "sig_1" } } },
        {
          type: "reasoning",
          text: "Encrypted thought",
          providerMetadata: { openai: { itemId: "rs_1", reasoningEncryptedContent: "encrypted-state" } },
        },
      ])
    }),
  )

  it.effect("replays durable provider-executed tool results inline in a second-turn request", () =>
    Effect.gen(function* () {
      yield* setup
      const session = yield* SessionV2.Service
      yield* session.prompt({ sessionID, prompt: new Prompt({ text: "Search first" }), resume: false })

      requests.length = 0
      response = [
        LLMEvent.stepStart({ index: 0 }),
        LLMEvent.toolCall({
          id: "hosted-search",
          name: "web_search",
          input: { query: "Effect" },
          providerExecuted: true,
          providerMetadata: { openai: { itemId: "hosted-search" } },
        }),
        LLMEvent.toolResult({
          id: "hosted-search",
          name: "web_search",
          result: { type: "json", value: [{ title: "Effect" }] },
          providerExecuted: true,
          providerMetadata: { anthropic: { blockType: "web_search_tool_result" } },
        }),
        LLMEvent.stepFinish({ index: 0, reason: "stop" }),
        LLMEvent.finish({ reason: "stop" }),
      ]
      yield* session.resume(sessionID)
      yield* replaySessionProjection(sessionID)

      yield* session.prompt({ sessionID, prompt: new Prompt({ text: "Continue" }), resume: false })
      response = []
      yield* session.resume(sessionID)

      expect(requests[1]?.messages.map((message) => message.role)).toEqual(["user", "assistant", "user"])
      expect(requests[1]?.messages[1]?.content).toMatchObject([
        {
          type: "tool-call",
          id: "hosted-search",
          name: "web_search",
          input: { query: "Effect" },
          providerExecuted: true,
          providerMetadata: { openai: { itemId: "hosted-search" } },
        },
        {
          type: "tool-result",
          id: "hosted-search",
          name: "web_search",
          result: { type: "json", value: [{ title: "Effect" }] },
          providerExecuted: true,
          providerMetadata: { anthropic: { blockType: "web_search_tool_result" } },
        },
      ])
    }),
  )

  it.effect("persists the immutable task preparation before projecting a live task call", () =>
    Effect.gen(function* () {
      yield* setup
      const session = yield* SessionV2.Service
      const db = (yield* Database.Service).db
      const agents = yield* AgentV2.Service
      yield* agents.transform((editor) => {
        editor.update(AgentV2.ID.make("build"), (agent) => {
          agent.permissions = [{ action: "task", resource: "general", effect: "allow" }]
        })
        editor.update(AgentV2.ID.make("general"), (agent) => {
          agent.mode = "subagent"
        })
      })
      yield* (yield* ToolRegistry.Service).register({
        task: Tool.make({
          description: "Prepared task",
          input: Schema.Struct({
            description: Schema.String,
            prompt: Schema.String,
            subagent_type: Schema.String,
          }),
          output: Schema.Struct({ result: Schema.String }),
          execute: ({ prompt }) => Effect.succeed({ result: prompt }),
        }),
      })
      const input = { description: "Prepared", prompt: "live", subagent_type: "general" }
      responses = [
        [
          LLMEvent.stepStart({ index: 0 }),
          LLMEvent.toolCall({ id: "call-live-prepared", name: "task", input }),
          LLMEvent.stepFinish({ index: 0, reason: "tool-calls" }),
          LLMEvent.finish({ reason: "tool-calls" }),
        ],
        [
          LLMEvent.stepStart({ index: 0 }),
          LLMEvent.stepFinish({ index: 0, reason: "stop" }),
          LLMEvent.finish({ reason: "stop" }),
        ],
      ]
      yield* session.prompt({ sessionID, prompt: new Prompt({ text: "Prepare a task" }), resume: false })
      yield* session.resume(sessionID)

      const context = yield* session.context(sessionID)
      const messageID = context
        .filter((message): message is SessionMessage.Assistant => message.type === "assistant")
        .find((message) => message.content.some((part) => part.type === "tool" && part.id === "call-live-prepared"))!.id
      const prepared = (yield* SessionTask.prepared(db, sessionID, messageID, "call-live-prepared"))!
      expect(prepared).toMatchObject({
        input,
        callerAgent: "build",
        agent: "general",
        permissions: [{ action: "task", resource: "general", effect: "allow" }],
        plan: { multiAgent: "v2" },
      })
      const rows = yield* db
        .select({ id: EventTable.id, seq: EventTable.seq, data: EventTable.data })
        .from(EventTable)
        .where(eq(EventTable.aggregate_id, sessionID))
        .all()
        .pipe(Effect.orDie)
      const preparedSeq = rows.find(
        (row) => row.id === SessionTask.preparedEventID(sessionID, messageID, "call-live-prepared"),
      )!.seq
      const projectedSeq = rows.find((row) => row.data.callID === "call-live-prepared" && row.data.name === "task")!.seq
      expect(preparedSeq).toBeLessThan(projectedSeq)
    }),
  )

  it.effect("replays durable custom tool calls and results with raw source", () =>
    Effect.gen(function* () {
      yield* setup
      requests.length = 0
      const events = yield* EventV2.Service
      const session = yield* SessionV2.Service
      const publisher = createLLMEventPublisher(events, {
        sessionID,
        agent: "build",
        model: { id: ModelV2.ID.make(model.id), providerID: ProviderV2.ID.make(model.provider) },
      })
      yield* publisher.publish(
        LLMEvent.toolCall({ id: "call-exec", name: "exec", toolType: "custom", input: "return 42" }),
      )
      yield* publisher.publish(
        LLMEvent.toolResult({
          id: "call-exec",
          name: "exec",
          toolType: "custom",
          result: { type: "json", value: { ok: true, value: 42 } },
          output: { structured: { ok: true, value: 42 }, content: [] },
        }),
      )
      yield* replaySessionProjection(sessionID)

      yield* session.prompt({ sessionID, prompt: new Prompt({ text: "Continue" }), resume: false })
      response = []
      yield* session.resume(sessionID)

      expect(requests[0]?.messages.map((message) => message.role)).toEqual(["assistant", "tool", "user"])
      expect(requests[0]?.messages[0]?.content).toMatchObject([
        {
          type: "tool-call",
          toolType: "custom",
          id: "call-exec",
          name: "exec",
          input: "return 42",
        },
      ])
      expect(requests[0]?.messages[1]?.content).toMatchObject([
        {
          type: "tool-result",
          toolType: "custom",
          id: "call-exec",
          name: "exec",
          result: { type: "json", value: { ok: true, value: 42 } },
        },
      ])
    }),
  )

  it.effect("starts recorded local tools eagerly and awaits settlement before continuing", () =>
    Effect.gen(function* () {
      yield* setup
      const session = yield* SessionV2.Service
      yield* session.prompt({ sessionID, prompt: new Prompt({ text: "Echo five times" }), resume: false })

      requests.length = 0
      executions.length = 0
      toolExecutionGate = yield* Deferred.make<void>()
      toolExecutionsStarted = yield* Deferred.make<void>()
      const providerGate = yield* Deferred.make<void>()
      response = []
      responses = undefined
      const initial = Stream.fromIterable([
        LLMEvent.stepStart({ index: 0 }),
        ...Array.from({ length: 5 }, (_, index) =>
          LLMEvent.toolCall({ id: `call-echo-${index}`, name: "echo", input: { text: `${index}` } }),
        ),
      ])
      const final = Stream.fromIterable([
        LLMEvent.stepFinish({ index: 0, reason: "tool-calls" }),
        LLMEvent.finish({ reason: "tool-calls" }),
      ])
      streamGate = undefined
      responseStream = Stream.concat(
        initial,
        Stream.fromEffect(Deferred.await(providerGate)).pipe(Stream.flatMap(() => final)),
      )

      const run = yield* session.resume(sessionID).pipe(Effect.forkChild)
      yield* Deferred.await(toolExecutionsStarted)

      expect(executions).toHaveLength(5)
      expect(maxActiveToolExecutions).toBe(5)
      expect(yield* session.context(sessionID)).toMatchObject([
        { type: "user", text: "Echo five times" },
        {
          type: "assistant",
          content: Array.from({ length: 5 }, (_, index) => ({
            type: "tool",
            id: `call-echo-${index}`,
            state: { status: "running", input: { text: `${index}` } },
          })),
        },
      ])

      yield* Deferred.succeed(providerGate, undefined)
      yield* Effect.yieldNow
      expect(requests).toHaveLength(1)

      yield* Deferred.succeed(toolExecutionGate, undefined)
      yield* Fiber.join(run)
      toolExecutionGate = undefined
      toolExecutionsStarted = undefined

      expect(executions).toHaveLength(5)
      expect(maxActiveToolExecutions).toBe(5)
      expect(requests).toHaveLength(2)
    }),
  )

  it.effect("settles repeated provider-local tool call IDs against their owning assistant messages", () =>
    Effect.gen(function* () {
      yield* setup
      const session = yield* SessionV2.Service
      yield* session.prompt({ sessionID, prompt: new Prompt({ text: "Echo twice" }), resume: false })

      requests.length = 0
      executions.length = 0
      responses = [
        [
          LLMEvent.stepStart({ index: 0 }),
          LLMEvent.toolCall({ id: "tool_0", name: "echo", input: { text: "first" } }),
          LLMEvent.stepFinish({ index: 0, reason: "tool-calls" }),
          LLMEvent.finish({ reason: "tool-calls" }),
        ],
        [
          LLMEvent.stepStart({ index: 0 }),
          LLMEvent.toolCall({ id: "tool_0", name: "echo", input: { text: "second" } }),
          LLMEvent.stepFinish({ index: 0, reason: "tool-calls" }),
          LLMEvent.finish({ reason: "tool-calls" }),
        ],
        [],
      ]

      yield* session.resume(sessionID)

      expect(executions).toEqual(["first", "second"])
      expect(requests).toHaveLength(3)
      expect(yield* session.context(sessionID)).toMatchObject([
        { type: "user", text: "Echo twice" },
        {
          type: "assistant",
          content: [
            {
              type: "tool",
              id: "tool_0",
              state: { status: "completed", structured: { text: "first" }, content: [{ type: "text", text: "first" }] },
            },
          ],
        },
        {
          type: "assistant",
          content: [
            {
              type: "tool",
              id: "tool_0",
              state: {
                status: "completed",
                structured: { text: "second" },
                content: [{ type: "text", text: "second" }],
              },
            },
          ],
        },
      ])

      yield* replaySessionProjection(sessionID)

      expect(yield* session.context(sessionID)).toMatchObject([
        { type: "user", text: "Echo twice" },
        {
          type: "assistant",
          content: [
            {
              type: "tool",
              id: "tool_0",
              state: { status: "completed", structured: { text: "first" }, content: [{ type: "text", text: "first" }] },
            },
          ],
        },
        {
          type: "assistant",
          content: [
            {
              type: "tool",
              id: "tool_0",
              state: {
                status: "completed",
                structured: { text: "second" },
                content: [{ type: "text", text: "second" }],
              },
            },
          ],
        },
      ])
    }),
  )

  it.effect("joins concurrent resume calls into one active provider run", () =>
    Effect.gen(function* () {
      yield* setup
      const session = yield* SessionV2.Service
      yield* session.prompt({ sessionID, prompt: new Prompt({ text: "Run once" }), resume: false })

      requests.length = 0
      responses = undefined
      response = [
        LLMEvent.stepStart({ index: 0 }),
        LLMEvent.textStart({ id: "text-once" }),
        LLMEvent.textDelta({ id: "text-once", text: "Once" }),
        LLMEvent.textEnd({ id: "text-once" }),
        LLMEvent.stepFinish({ index: 0, reason: "stop" }),
        LLMEvent.finish({ reason: "stop" }),
      ]
      streamGate = yield* Deferred.make<void>()
      streamStarted = yield* Deferred.make<void>()

      const first = yield* session.resume(sessionID).pipe(Effect.forkChild)
      yield* Deferred.await(streamStarted)
      const second = yield* session.resume(sessionID).pipe(Effect.forkChild)
      yield* Effect.yieldNow

      expect(requests).toHaveLength(1)
      yield* Deferred.succeed(streamGate, undefined)
      yield* Fiber.join(first)
      yield* Fiber.join(second)
      streamGate = undefined
      streamStarted = undefined

      expect(requests).toHaveLength(1)
      expect(yield* session.context(sessionID)).toMatchObject([
        { type: "user", text: "Run once" },
        { type: "assistant", finish: "stop", content: [{ type: "text", id: "text-once", text: "Once" }] },
      ])
    }),
  )

  it.effect("steers an active provider turn with newly recorded prompts", () =>
    Effect.gen(function* () {
      yield* setup
      const session = yield* SessionV2.Service
      yield* session.prompt({ sessionID, prompt: new Prompt({ text: "Start working" }), resume: false })

      requests.length = 0
      responses = [
        [
          LLMEvent.stepStart({ index: 0 }),
          LLMEvent.stepFinish({ index: 0, reason: "stop" }),
          LLMEvent.finish({ reason: "stop" }),
        ],
        [
          LLMEvent.stepStart({ index: 0 }),
          LLMEvent.stepFinish({ index: 0, reason: "stop" }),
          LLMEvent.finish({ reason: "stop" }),
        ],
      ]
      streamGate = yield* Deferred.make<void>()
      streamStarted = yield* Deferred.make<void>()

      const first = yield* session.resume(sessionID).pipe(Effect.forkChild)
      yield* Deferred.await(streamStarted)
      yield* session.prompt({ sessionID, prompt: new Prompt({ text: "Change direction" }) })
      yield* Deferred.succeed(streamGate, undefined)
      yield* Fiber.join(first)
      streamGate = undefined
      streamStarted = undefined
      yield* Effect.yieldNow

      expect(requests).toHaveLength(2)
      expect(userTexts(requests[0]!)).toEqual(["Start working"])
      expect(userTexts(requests[1]!)).toEqual(["Start working", "Change direction"])
      expect((yield* session.context(sessionID)).map((message) => message.type)).toEqual([
        "user",
        "assistant",
        "user",
        "assistant",
      ])
    }),
  )

  it.effect("starts queued input after the active activity settles", () =>
    Effect.gen(function* () {
      yield* setup
      const session = yield* SessionV2.Service
      yield* session.prompt({ sessionID, prompt: new Prompt({ text: "Start working" }), resume: false })

      requests.length = 0
      responses = [
        [
          LLMEvent.stepStart({ index: 0 }),
          LLMEvent.toolCall({ id: "call-echo", name: "echo", input: { text: "hello" } }),
          LLMEvent.stepFinish({ index: 0, reason: "tool-calls" }),
          LLMEvent.finish({ reason: "tool-calls" }),
        ],
        [
          LLMEvent.stepStart({ index: 0 }),
          LLMEvent.stepFinish({ index: 0, reason: "stop" }),
          LLMEvent.finish({ reason: "stop" }),
        ],
        [
          LLMEvent.stepStart({ index: 0 }),
          LLMEvent.stepFinish({ index: 0, reason: "stop" }),
          LLMEvent.finish({ reason: "stop" }),
        ],
      ]
      streamGate = yield* Deferred.make<void>()
      streamStarted = yield* Deferred.make<void>()

      const first = yield* session.resume(sessionID).pipe(Effect.forkChild)
      yield* Deferred.await(streamStarted)
      yield* session.prompt({
        sessionID,
        prompt: new Prompt({ text: "Wait until the next activity" }),
        delivery: "queue",
      })
      yield* Deferred.succeed(streamGate, undefined)
      yield* Fiber.join(first)
      streamGate = undefined
      streamStarted = undefined

      expect(requests).toHaveLength(3)
      expect(userTexts(requests[0]!)).toEqual(["Start working"])
      expect(userTexts(requests[1]!)).toEqual(["Start working"])
      expect(userTexts(requests[2]!)).toEqual(["Start working", "Wait until the next activity"])
    }),
  )

  it.effect("preserves durable queued input for a later wake after interruption", () =>
    Effect.gen(function* () {
      yield* setup
      const session = yield* SessionV2.Service
      const { db } = yield* Database.Service
      yield* session.prompt({ sessionID, prompt: new Prompt({ text: "Interrupt current work" }), resume: false })

      requests.length = 0
      responses = [
        [],
        [
          LLMEvent.stepStart({ index: 0 }),
          LLMEvent.stepFinish({ index: 0, reason: "stop" }),
          LLMEvent.finish({ reason: "stop" }),
        ],
      ]
      streamGate = yield* Deferred.make<void>()
      streamStarted = yield* Deferred.make<void>()

      const run = yield* session.resume(sessionID).pipe(Effect.forkChild)
      yield* Deferred.await(streamStarted)
      yield* session.prompt({
        sessionID,
        prompt: new Prompt({ text: "Run after interrupt" }),
        delivery: "queue",
      })
      yield* session.interrupt(sessionID)
      expect(yield* Fiber.await(run)).toMatchObject({ _tag: "Failure" })
      expect(requests).toHaveLength(1)
      expect(yield* SessionInput.hasPending(db, sessionID, "queue")).toBe(true)
      const resumed = yield* session.resume(sessionID).pipe(Effect.forkChild)
      while (requests.length < 2) yield* Effect.yieldNow
      yield* Deferred.succeed(streamGate, undefined)
      yield* Fiber.join(resumed)
      streamGate = undefined
      streamStarted = undefined

      expect(requests).toHaveLength(2)
      expect(userTexts(requests[0]!)).toEqual(["Interrupt current work"])
      expect(userTexts(requests[1]!)).toEqual(["Interrupt current work", "Run after interrupt"])
    }),
  )

  it.effect("preserves durable steering input for a later resume after interruption", () =>
    Effect.gen(function* () {
      yield* setup
      const session = yield* SessionV2.Service
      const { db } = yield* Database.Service
      yield* session.prompt({ sessionID, prompt: new Prompt({ text: "Interrupt current work" }), resume: false })

      requests.length = 0
      responses = [
        [],
        [
          LLMEvent.stepStart({ index: 0 }),
          LLMEvent.stepFinish({ index: 0, reason: "stop" }),
          LLMEvent.finish({ reason: "stop" }),
        ],
      ]
      streamGate = yield* Deferred.make<void>()
      streamStarted = yield* Deferred.make<void>()

      const run = yield* session.resume(sessionID).pipe(Effect.forkChild)
      yield* Deferred.await(streamStarted)
      yield* session.prompt({
        sessionID,
        prompt: new Prompt({ text: "Steer after interrupt" }),
      })
      yield* session.interrupt(sessionID)
      expect(yield* Fiber.await(run)).toMatchObject({ _tag: "Failure" })
      expect(requests).toHaveLength(1)
      expect(yield* SessionInput.hasPending(db, sessionID, "steer")).toBe(true)

      const resumed = yield* session.resume(sessionID).pipe(Effect.forkChild)
      while (requests.length < 2) yield* Effect.yieldNow
      yield* Deferred.succeed(streamGate, undefined)
      yield* Fiber.join(resumed)
      streamGate = undefined
      streamStarted = undefined

      expect(requests).toHaveLength(2)
      expect(userTexts(requests[0]!)).toEqual(["Interrupt current work"])
      expect(userTexts(requests[1]!)).toEqual(["Interrupt current work", "Steer after interrupt"])
    }),
  )

  it.effect("runs queued active inputs as separate FIFO activities", () =>
    Effect.gen(function* () {
      yield* setup
      const session = yield* SessionV2.Service
      yield* session.prompt({ sessionID, prompt: new Prompt({ text: "Start working" }), resume: false })

      requests.length = 0
      responses = [
        [
          LLMEvent.stepStart({ index: 0 }),
          LLMEvent.stepFinish({ index: 0, reason: "stop" }),
          LLMEvent.finish({ reason: "stop" }),
        ],
        [
          LLMEvent.stepStart({ index: 0 }),
          LLMEvent.stepFinish({ index: 0, reason: "stop" }),
          LLMEvent.finish({ reason: "stop" }),
        ],
        [
          LLMEvent.stepStart({ index: 0 }),
          LLMEvent.stepFinish({ index: 0, reason: "stop" }),
          LLMEvent.finish({ reason: "stop" }),
        ],
      ]
      streamGate = yield* Deferred.make<void>()
      streamStarted = yield* Deferred.make<void>()

      const first = yield* session.resume(sessionID).pipe(Effect.forkChild)
      yield* Deferred.await(streamStarted)
      yield* session.prompt({ sessionID, prompt: new Prompt({ text: "Queue first" }), delivery: "queue" })
      yield* session.prompt({ sessionID, prompt: new Prompt({ text: "Queue second" }), delivery: "queue" })
      yield* Deferred.succeed(streamGate, undefined)
      yield* Fiber.join(first)
      streamGate = undefined
      streamStarted = undefined

      expect(requests).toHaveLength(3)
      expect(userTexts(requests[0]!)).toEqual(["Start working"])
      expect(userTexts(requests[1]!)).toEqual(["Start working", "Queue first"])
      expect(userTexts(requests[2]!)).toEqual(["Start working", "Queue first", "Queue second"])
    }),
  )

  it.effect("opens queued input after idle steering activity settles", () =>
    Effect.gen(function* () {
      yield* setup
      const session = yield* SessionV2.Service
      yield* session.prompt({ sessionID, prompt: new Prompt({ text: "Start steering activity" }), resume: false })
      yield* session.prompt({
        sessionID,
        prompt: new Prompt({ text: "Queue later activity" }),
        delivery: "queue",
        resume: false,
      })

      requests.length = 0
      responses = [
        [
          LLMEvent.stepStart({ index: 0 }),
          LLMEvent.stepFinish({ index: 0, reason: "stop" }),
          LLMEvent.finish({ reason: "stop" }),
        ],
        [
          LLMEvent.stepStart({ index: 0 }),
          LLMEvent.stepFinish({ index: 0, reason: "stop" }),
          LLMEvent.finish({ reason: "stop" }),
        ],
      ]

      yield* session.resume(sessionID)

      expect(requests).toHaveLength(2)
      expect(userTexts(requests[0]!)).toEqual(["Start steering activity"])
      expect(userTexts(requests[1]!)).toEqual(["Start steering activity", "Queue later activity"])
    }),
  )

  it.effect("coalesces steers into the active queued activity before starting the next queued activity", () =>
    Effect.gen(function* () {
      yield* setup
      const session = yield* SessionV2.Service
      yield* session.prompt({ sessionID, prompt: new Prompt({ text: "Start working" }), resume: false })

      requests.length = 0
      responses = [
        [
          LLMEvent.stepStart({ index: 0 }),
          LLMEvent.stepFinish({ index: 0, reason: "stop" }),
          LLMEvent.finish({ reason: "stop" }),
        ],
        [
          LLMEvent.stepStart({ index: 0 }),
          LLMEvent.stepFinish({ index: 0, reason: "stop" }),
          LLMEvent.finish({ reason: "stop" }),
        ],
        [
          LLMEvent.stepStart({ index: 0 }),
          LLMEvent.stepFinish({ index: 0, reason: "stop" }),
          LLMEvent.finish({ reason: "stop" }),
        ],
        [
          LLMEvent.stepStart({ index: 0 }),
          LLMEvent.stepFinish({ index: 0, reason: "stop" }),
          LLMEvent.finish({ reason: "stop" }),
        ],
      ]
      const firstGate = yield* Deferred.make<void>()
      const secondGate = yield* Deferred.make<void>()
      streamGate = firstGate

      const first = yield* session.resume(sessionID).pipe(Effect.forkChild)
      while (requests.length < 1) yield* Effect.yieldNow
      yield* session.prompt({ sessionID, prompt: new Prompt({ text: "Queue first" }), delivery: "queue" })
      yield* session.prompt({ sessionID, prompt: new Prompt({ text: "Queue second" }), delivery: "queue" })
      streamGate = secondGate
      yield* Deferred.succeed(firstGate, undefined)
      while (requests.length < 2) yield* Effect.yieldNow
      yield* session.prompt({ sessionID, prompt: new Prompt({ text: "Steer first queued activity" }) })
      yield* session.prompt({ sessionID, prompt: new Prompt({ text: "Also steer first queued activity" }) })
      yield* Deferred.succeed(secondGate, undefined)
      yield* Fiber.join(first)
      streamGate = undefined

      expect(requests).toHaveLength(4)
      expect(userTexts(requests[0]!)).toEqual(["Start working"])
      expect(userTexts(requests[1]!)).toEqual(["Start working", "Queue first"])
      expect(userTexts(requests[2]!)).toEqual([
        "Start working",
        "Queue first",
        "Steer first queued activity",
        "Also steer first queued activity",
      ])
      expect(userTexts(requests[3]!)).toEqual([
        "Start working",
        "Queue first",
        "Steer first queued activity",
        "Also steer first queued activity",
        "Queue second",
      ])
    }),
  )

  it.effect("coalesces multiple active steering prompts into one continuation turn", () =>
    Effect.gen(function* () {
      yield* setup
      const session = yield* SessionV2.Service
      yield* session.prompt({ sessionID, prompt: new Prompt({ text: "Start working" }), resume: false })

      requests.length = 0
      responses = [
        [
          LLMEvent.stepStart({ index: 0 }),
          LLMEvent.stepFinish({ index: 0, reason: "stop" }),
          LLMEvent.finish({ reason: "stop" }),
        ],
        [
          LLMEvent.stepStart({ index: 0 }),
          LLMEvent.stepFinish({ index: 0, reason: "stop" }),
          LLMEvent.finish({ reason: "stop" }),
        ],
      ]
      streamGate = yield* Deferred.make<void>()
      streamStarted = yield* Deferred.make<void>()

      const first = yield* session.resume(sessionID).pipe(Effect.forkChild)
      yield* Deferred.await(streamStarted)
      yield* session.prompt({ sessionID, prompt: new Prompt({ text: "First steer" }) })
      yield* session.prompt({ sessionID, prompt: new Prompt({ text: "Second steer" }) })
      yield* Deferred.succeed(streamGate, undefined)
      yield* Fiber.join(first)
      streamGate = undefined
      streamStarted = undefined
      yield* Effect.yieldNow

      expect(requests).toHaveLength(2)
      expect(userTexts(requests[1]!)).toEqual(["Start working", "First steer", "Second steer"])
      yield* (yield* SessionRunCoordinator.Service).wake(sessionID)
      yield* Effect.yieldNow
      expect(requests).toHaveLength(2)
    }),
  )

  it.effect("runs steering input accepted while the active provider turn fails", () =>
    Effect.gen(function* () {
      yield* setup
      const session = yield* SessionV2.Service
      yield* session.prompt({ sessionID, prompt: new Prompt({ text: "Start working" }), resume: false })

      requests.length = 0
      responses = undefined
      response = []
      streamFailure = providerUnavailable()
      streamGate = yield* Deferred.make<void>()
      streamStarted = yield* Deferred.make<void>()

      const first = yield* session.resume(sessionID).pipe(Effect.forkChild)
      yield* Deferred.await(streamStarted)
      yield* session.prompt({ sessionID, prompt: new Prompt({ text: "Recover with this" }) })
      yield* Deferred.succeed(streamGate, undefined)
      expect(yield* Fiber.join(first).pipe(Effect.flip)).toBe(streamFailure)

      streamFailure = undefined
      streamGate = undefined
      streamStarted = undefined
      yield* Effect.yieldNow

      expect(requests).toHaveLength(2)
      expect(userTexts(requests[1]!)).toEqual(["Start working", "Recover with this"])
    }),
  )

  it.effect("durably fails local tools left running by a prior process before continuing", () =>
    Effect.gen(function* () {
      yield* setup
      const session = yield* SessionV2.Service
      const events = yield* EventV2.Service
      yield* session.prompt({ sessionID, prompt: new Prompt({ text: "Recover interrupted tool" }), resume: false })
      yield* SessionInput.promoteSteers((yield* Database.Service).db, events, sessionID, Number.MAX_SAFE_INTEGER)
      const assistantMessageID = SessionMessage.ID.create()
      yield* events.publish(SessionEvent.Step.Started, {
        sessionID,
        assistantMessageID,
        timestamp: yield* DateTime.now,
        agent: "build",
        model: { id: ModelV2.ID.make("fake-model"), providerID: ProviderV2.ID.make("fake") },
      })
      yield* events.publish(SessionEvent.Tool.Input.Started, {
        sessionID,
        timestamp: yield* DateTime.now,
        assistantMessageID,
        callID: "call-interrupted",
        name: "echo",
      })
      yield* events.publish(SessionEvent.Tool.Input.Ended, {
        sessionID,
        timestamp: yield* DateTime.now,
        assistantMessageID,
        callID: "call-interrupted",
        text: '{"text":"stale"}',
      })
      yield* events.publish(SessionEvent.Tool.CalledV1, {
        sessionID,
        timestamp: yield* DateTime.now,
        assistantMessageID,
        callID: "call-interrupted",
        tool: "echo",
        input: { text: "stale" },
        provider: { executed: false },
      })
      requests.length = 0
      response = []
      yield* session.resume(sessionID)

      expect(requests).toHaveLength(1)
      expect(requests[0]?.messages.map((message) => message.role)).toEqual(["user", "assistant", "tool"])
      expect(yield* session.context(sessionID)).toMatchObject([
        { type: "user", text: "Recover interrupted tool" },
        {
          type: "assistant",
          content: [
            {
              type: "tool",
              id: "call-interrupted",
              state: { status: "error", error: { type: "unknown", message: "Tool execution interrupted" } },
            },
          ],
        },
      ])
    }),
  )

  it.effect("reconnects pending and running tasks through the captured registry instead of failing them", () =>
    Effect.gen(function* () {
      yield* setup
      const session = yield* SessionV2.Service
      const events = yield* EventV2.Service
      let recovered = 0
      yield* (yield* ToolRegistry.Service).register({
        task: Tool.make({
          description: "Recovered task",
          input: Schema.Struct({ prompt: Schema.String }),
          output: Schema.Struct({ result: Schema.String }),
          execute: ({ prompt }) =>
            Effect.sync(() => {
              recovered++
              return { result: prompt }
            }),
        }),
      })
      yield* session.prompt({ sessionID, prompt: new Prompt({ text: "Recover pending task" }), resume: false })
      yield* SessionInput.promoteSteers((yield* Database.Service).db, events, sessionID, Number.MAX_SAFE_INTEGER)
      const assistantMessageID = SessionMessage.ID.create()
      yield* events.publish(SessionEvent.Step.Started, {
        sessionID,
        assistantMessageID,
        timestamp: yield* DateTime.now,
        agent: "build",
        model: { id: ModelV2.ID.make("fake-model"), providerID: ProviderV2.ID.make("fake") },
      })
      for (const item of [
        { callID: "call-task-pending", prompt: "once" },
        { callID: "call-task-running", prompt: "twice" },
      ])
        yield* events.publish(
          SessionEvent.Task.Prepared,
          {
            sessionID,
            timestamp: yield* DateTime.now,
            assistantMessageID,
            callID: item.callID,
            input: { prompt: item.prompt },
            callerAgent: AgentV2.ID.make("build"),
            permissions: [],
            plan: { multiAgent: "v2" },
            agent: AgentV2.ID.make("general"),
            available: [AgentV2.ID.make("general")],
            model: { id: ModelV2.ID.make("fake-model"), providerID: ProviderV2.ID.make("fake") },
            projectID: Project.ID.global,
            location: { directory: AbsolutePath.make("/project") },
            title: "Recovered task (@general subagent)",
            ceiling: [],
          },
          { id: SessionTask.preparedEventID(sessionID, assistantMessageID, item.callID) },
        )
      yield* events.publish(SessionEvent.Tool.Input.Started, {
        sessionID,
        timestamp: yield* DateTime.now,
        assistantMessageID,
        callID: "call-task-pending",
        name: "task",
      })
      yield* events.publish(SessionEvent.Tool.Input.Ended, {
        sessionID,
        timestamp: yield* DateTime.now,
        assistantMessageID,
        callID: "call-task-pending",
        text: '{"prompt":"once"}',
      })
      yield* events.publish(SessionEvent.Tool.Input.Started, {
        sessionID,
        timestamp: yield* DateTime.now,
        assistantMessageID,
        callID: "call-task-running",
        name: "task",
      })
      yield* events.publish(SessionEvent.Tool.Input.Ended, {
        sessionID,
        timestamp: yield* DateTime.now,
        assistantMessageID,
        callID: "call-task-running",
        text: '{"prompt":"twice"}',
      })
      yield* events.publish(SessionEvent.Tool.CalledV1, {
        sessionID,
        timestamp: yield* DateTime.now,
        assistantMessageID,
        callID: "call-task-running",
        tool: "task",
        input: { prompt: "twice" },
        provider: { executed: false },
      })
      requests.length = 0
      response = []

      yield* session.resume(sessionID)

      expect(recovered).toBe(2)
      expect(yield* session.context(sessionID)).toMatchObject([
        { type: "user", text: "Recover pending task" },
        {
          type: "assistant",
          content: [
            { type: "tool", id: "call-task-pending", state: { status: "completed" } },
            { type: "tool", id: "call-task-running", state: { status: "completed" } },
          ],
        },
      ])
    }),
  )

  it.effect("recovers a durable task with its originating immutable agent, permissions, and harness plan", () =>
    Effect.gen(function* () {
      yield* setup
      const session = yield* SessionV2.Service
      const events = yield* EventV2.Service
      const db = (yield* Database.Service).db
      const contexts: Tool.Context[] = []
      yield* (yield* ToolRegistry.Service).register({
        task: Tool.make({
          description: "Recovered immutable task",
          input: Schema.Struct({ prompt: Schema.String }),
          output: Schema.Struct({ result: Schema.String }),
          execute: ({ prompt }, context) => {
            contexts.push(context)
            return Effect.succeed({ result: prompt })
          },
        }),
      })
      yield* session.prompt({ sessionID, prompt: new Prompt({ text: "Recover immutable task" }), resume: false })
      yield* SessionInput.promoteSteers(db, events, sessionID, Number.MAX_SAFE_INTEGER)
      const assistantMessageID = SessionMessage.ID.create()
      const callID = "call-task-immutable"
      const childID = SessionV2.ID.make("ses_task_immutable_child")
      const original = [{ action: "edit", resource: "original-secret", effect: "deny" as const }]
      const childModel = ModelV2.Ref.make({
        providerID: ProviderV2.ID.make("fake"),
        id: ModelV2.ID.make("fake-model"),
      })
      yield* events.publish(SessionEvent.Step.Started, {
        sessionID,
        assistantMessageID,
        timestamp: yield* DateTime.now,
        agent: "build",
        model: childModel,
      })
      yield* events.publish(SessionEvent.Tool.Input.Started, {
        sessionID,
        timestamp: yield* DateTime.now,
        assistantMessageID,
        callID,
        name: "task",
      })
      yield* events.publish(SessionEvent.Tool.Input.Ended, {
        sessionID,
        timestamp: yield* DateTime.now,
        assistantMessageID,
        callID,
        text: '{"prompt":"original"}',
      })
      yield* events.publish(SessionEvent.Tool.CalledV1, {
        sessionID,
        timestamp: yield* DateTime.now,
        assistantMessageID,
        callID,
        tool: "task",
        input: { prompt: "original" },
        provider: { executed: false },
      })
      yield* events.publish(
        SessionEvent.Task.Requested,
        {
          sessionID,
          timestamp: yield* DateTime.now,
          assistantMessageID,
          callID,
          childSessionID: childID,
          promptMessageID: SessionMessage.ID.make("msg_task_immutable_prompt"),
          description: "Immutable",
          prompt: "original",
          agent: "general",
          model: childModel,
          multiAgent: "v2",
          callerAgent: "build",
          permissions: original,
          plan: { mode: "code-only", multiAgent: "v2" },
          projectID: Project.ID.global,
          location: { directory: AbsolutePath.make("/project") },
          title: "Immutable (@general subagent)",
          ceiling: [],
        },
        { id: SessionTask.requestEventID(sessionID, assistantMessageID, callID) },
      )
      yield* db
        .update(SessionTable)
        .set({ agent: "reviewer", model: { providerID: "fake", id: "replacement" } })
        .where(eq(SessionTable.id, sessionID))
        .run()
        .pipe(Effect.orDie)
      yield* (yield* AgentV2.Service).transform((editor) =>
        editor.update(AgentV2.ID.make("reviewer"), (agent) => {
          agent.permissions = [{ action: "read", resource: "mutated", effect: "allow" }]
        }),
      )
      currentCatalog = catalogModel("gpt-5.6-luna", "gpt-5.6-luna")
      response = []

      yield* session.resume(sessionID)

      expect(contexts).toHaveLength(1)
      expect(contexts[0]).toMatchObject({ agent: "build", multiAgent: "v2" })
      expect(contexts[0]?.permissions).toEqual(original)
      expect(contexts[0]?.plan).toEqual({ mode: "code-only", multiAgent: "v2", patch: undefined, shell: undefined })
      expect(contexts[0]?.task?.childSessionID).toBe(childID)
    }),
  )

  it.effect("recovers a resumed task end to end through TaskTool, SessionRunner, and SessionExecutionLocal", () =>
    Effect.gen(function* () {
      yield* setup
      const session = yield* SessionV2.Service
      const events = yield* EventV2.Service
      const db = (yield* Database.Service).db
      const store = yield* SessionStore.Service
      const runtime = yield* SessionRuntime.Service
      const runner = yield* SessionRunner.Service
      yield* session.prompt({ sessionID, prompt: new Prompt({ text: "Recover resumed task" }), resume: false })
      yield* SessionInput.promoteSteers(db, events, sessionID, Number.MAX_SAFE_INTEGER)
      const originMessageID = SessionMessage.ID.make("msg_e2e_resume_origin")
      const resumeMessageID = SessionMessage.ID.make("msg_e2e_resume_current")
      const originCallID = "call-e2e-resume-origin"
      const resumeCallID = "call-e2e-resume-current"
      const childID = SessionTask.childID(sessionID, originMessageID, originCallID)
      const model = ModelV2.Ref.make({
        providerID: ProviderV2.ID.make("fake"),
        id: ModelV2.ID.make("fake-model"),
        variant: ModelV2.VariantID.make("default"),
      })
      const title = "Original task (@general subagent)"
      const request = (messageID: SessionMessage.ID, callID: string, description: string, prompt: string) => ({
        sessionID,
        timestamp: DateTime.makeUnsafe(0),
        assistantMessageID: messageID,
        callID,
        childSessionID: childID,
        promptMessageID: SessionTask.promptID(sessionID, messageID, callID),
        description,
        prompt,
        agent: "general",
        model,
        multiAgent: "v2" as const,
        callerAgent: AgentV2.ID.make("build"),
        permissions: [{ action: "edit", resource: "resume-secret", effect: "deny" as const }],
        plan: { multiAgent: "v2" as const },
        projectID: Project.ID.global,
        location: { directory: AbsolutePath.make("/project") },
        title,
        ceiling: [],
      })
      yield* db
        .insert(SessionTable)
        .values({
          id: childID,
          project_id: Project.ID.global,
          parent_id: sessionID,
          slug: childID,
          directory: "/project",
          title,
          version: "test",
          runtime: "v2",
          agent: "general",
          model,
          metadata: {
            task: {
              version: 1,
              parentID: sessionID,
              agent: "general",
              origin: { messageID: originMessageID, callID: originCallID },
              ceiling: [],
            },
          },
        })
        .run()
        .pipe(Effect.orDie)
      yield* events.publish(
        SessionEvent.Task.Requested,
        request(originMessageID, originCallID, "Original task", "original work"),
        { id: SessionTask.requestEventID(sessionID, originMessageID, originCallID) },
      )
      yield* events.publish(SessionEvent.Step.Started, {
        sessionID,
        timestamp: yield* DateTime.now,
        assistantMessageID: resumeMessageID,
        agent: "build",
        model,
      })
      yield* events.publish(SessionEvent.Tool.Input.Started, {
        sessionID,
        timestamp: yield* DateTime.now,
        assistantMessageID: resumeMessageID,
        callID: resumeCallID,
        name: "task",
      })
      const input = {
        description: "Continue after restart",
        prompt: "resume work",
        subagent_type: "general",
        task_id: childID,
      }
      yield* events.publish(SessionEvent.Tool.Input.Ended, {
        sessionID,
        timestamp: yield* DateTime.now,
        assistantMessageID: resumeMessageID,
        callID: resumeCallID,
        text: JSON.stringify(input),
      })
      yield* events.publish(SessionEvent.Tool.CalledV1, {
        sessionID,
        timestamp: yield* DateTime.now,
        assistantMessageID: resumeMessageID,
        callID: resumeCallID,
        tool: "task",
        input,
        provider: { executed: false },
      })
      yield* events.publish(
        SessionEvent.Task.Requested,
        request(resumeMessageID, resumeCallID, input.description, input.prompt),
        { id: SessionTask.requestEventID(sessionID, resumeMessageID, resumeCallID) },
      )
      yield* SessionInput.admit(db, events, {
        id: SessionTask.promptID(sessionID, resumeMessageID, resumeCallID),
        sessionID: childID,
        prompt: new Prompt({ text: input.prompt }),
        delivery: "steer",
      })
      yield* db
        .update(SessionTable)
        .set({ agent: "reviewer", model: { providerID: "fake", id: "replacement" } })
        .where(eq(SessionTable.id, sessionID))
        .run()
        .pipe(Effect.orDie)
      yield* (yield* AgentV2.Service).transform((editor) =>
        editor.update(AgentV2.ID.make("reviewer"), (agent) => {
          agent.permissions = [{ action: "read", resource: "mutated", effect: "allow" }]
        }),
      )
      currentCatalog = catalogModel("gpt-5.6-luna", "gpt-5.6-luna")
      requests.length = 0
      responses = [
        fragmentFixture("text", "text-e2e-resumed-child", ["resumed result"]).completeEvents,
        fragmentFixture("text", "text-e2e-resumed-parent", ["parent continued"]).completeEvents,
      ]
      const local = SessionExecutionLocal.layer.pipe(
        Layer.provide(Layer.succeed(Database.Service, { db })),
        Layer.provide(Layer.succeed(SessionStore.Service, store)),
        Layer.provide(Layer.succeed(SessionRuntime.Service, runtime)),
        Layer.provide(
          Layer.mock(LocationServiceMap, {
            get: () => Layer.succeed(SessionRunner.Service, runner),
          }),
        ),
      )

      yield* Effect.gen(function* () {
        const execution = yield* SessionExecution.Service
        yield* execution.wait(sessionID)
      }).pipe(Effect.provide(local), Effect.provide(TaskTool.layer))

      expect(requests.filter((item) => userTexts(item).includes("resume work"))).toHaveLength(1)
      const settled = (yield* session.context(sessionID))
        .flatMap((message) => (message.type === "assistant" ? message.content : []))
        .find((part) => part.type === "tool" && part.id === resumeCallID)
      expect(settled).toMatchObject({
        type: "tool",
        id: resumeCallID,
        state: {
          status: "completed",
          structured: {
            task_id: childID,
            state: "completed",
            result: "resumed result",
          },
        },
      })
    }),
  )

  it.effect("creates a missing child from the request snapshot through the full recovery stack", () =>
    Effect.gen(function* () {
      yield* setup
      const session = yield* SessionV2.Service
      const events = yield* EventV2.Service
      const database = yield* Database.Service
      const store = yield* SessionStore.Service
      const runtime = yield* SessionRuntime.Service
      const runner = yield* SessionRunner.Service
      yield* session.prompt({ sessionID, prompt: new Prompt({ text: "Recover request-first task" }), resume: false })
      yield* SessionInput.promoteSteers(database.db, events, sessionID, Number.MAX_SAFE_INTEGER)
      const messageID = SessionMessage.ID.make("msg_e2e_request_before_child")
      const callID = "call-e2e-request-before-child"
      const childID = SessionTask.childID(sessionID, messageID, callID)
      const model = ModelV2.Ref.make({
        providerID: ProviderV2.ID.make("fake"),
        id: ModelV2.ID.make("fake-model"),
        variant: ModelV2.VariantID.make("default"),
      })
      const input = { description: "Request first", prompt: "request snapshot work", subagent_type: "general" }
      yield* events.publish(SessionEvent.Step.Started, {
        sessionID,
        timestamp: yield* DateTime.now,
        assistantMessageID: messageID,
        agent: "build",
        model,
      })
      yield* events.publish(SessionEvent.Tool.Input.Started, {
        sessionID,
        timestamp: yield* DateTime.now,
        assistantMessageID: messageID,
        callID,
        name: "task",
      })
      yield* events.publish(SessionEvent.Tool.Input.Ended, {
        sessionID,
        timestamp: yield* DateTime.now,
        assistantMessageID: messageID,
        callID,
        text: JSON.stringify(input),
      })
      yield* events.publish(SessionEvent.Tool.CalledV1, {
        sessionID,
        timestamp: yield* DateTime.now,
        assistantMessageID: messageID,
        callID,
        tool: "task",
        input,
        provider: { executed: false },
      })
      const request = {
        sessionID,
        timestamp: yield* DateTime.now,
        assistantMessageID: messageID,
        callID,
        childSessionID: childID,
        promptMessageID: SessionTask.promptID(sessionID, messageID, callID),
        description: input.description,
        prompt: input.prompt,
        agent: AgentV2.ID.make("general"),
        model,
        multiAgent: "v2" as const,
        callerAgent: AgentV2.ID.make("build"),
        permissions: [{ action: "edit", resource: "snapshot-secret", effect: "deny" as const }],
        plan: { mode: "code-only" as const, multiAgent: "v2" as const },
        projectID: Project.ID.global,
        location: { directory: AbsolutePath.make("/project") },
        title: "Request first (@general subagent)",
        ceiling: [
          { action: "task", resource: "*", effect: "deny" as const },
          { action: "todowrite", resource: "*", effect: "deny" as const },
        ],
      }
      yield* events.publish(SessionEvent.Task.Requested, request, {
        id: SessionTask.requestEventID(sessionID, messageID, callID),
      })
      yield* database.db
        .update(SessionTable)
        .set({ agent: "reviewer", model: { providerID: "fake", id: "replacement" } })
        .where(eq(SessionTable.id, sessionID))
        .run()
        .pipe(Effect.orDie)
      yield* (yield* AgentV2.Service).transform((editor) =>
        editor.update(AgentV2.ID.make("reviewer"), (agent) => {
          agent.permissions = [{ action: "read", resource: "mutated", effect: "allow" }]
        }),
      )
      currentCatalog = catalogModel("gpt-5.6-luna", "gpt-5.6-luna")
      requests.length = 0
      responses = [
        fragmentFixture("text", "text-e2e-request-child", ["snapshot result"]).completeEvents,
        fragmentFixture("text", "text-e2e-request-parent", ["parent continued"]).completeEvents,
      ]
      const local = SessionExecutionLocal.layer.pipe(
        Layer.provide(Layer.succeed(Database.Service, database)),
        Layer.provide(Layer.succeed(SessionStore.Service, store)),
        Layer.provide(Layer.succeed(SessionRuntime.Service, runtime)),
        Layer.provide(
          Layer.mock(LocationServiceMap, {
            get: () => Layer.succeed(SessionRunner.Service, runner),
          }),
        ),
      )

      yield* Effect.gen(function* () {
        const execution = yield* SessionExecution.Service
        yield* execution.wait(sessionID)
      }).pipe(Effect.provide(local), Effect.provide(TaskTool.layer))

      expect(requests.filter((item) => userTexts(item).includes(input.prompt))).toHaveLength(1)
      expect(
        yield* database.db.select().from(SessionTable).where(eq(SessionTable.id, childID)).get().pipe(Effect.orDie),
      ).toMatchObject({
        agent: "general",
        model,
        title: request.title,
        metadata: { task: { ceiling: request.ceiling } },
      })
      const settled = (yield* session.context(sessionID))
        .flatMap((message) => (message.type === "assistant" ? message.content : []))
        .find((part) => part.type === "tool" && part.id === callID)
      expect(settled).toMatchObject({
        state: { status: "completed", structured: { result: "snapshot result", task_id: childID } },
      })
    }),
  )

  it.effect("recovers a pre-request task only from its immutable prepared snapshot", () =>
    Effect.gen(function* () {
      yield* setup
      const session = yield* SessionV2.Service
      const events = yield* EventV2.Service
      const database = yield* Database.Service
      const store = yield* SessionStore.Service
      const runtime = yield* SessionRuntime.Service
      const runner = yield* SessionRunner.Service
      yield* session.prompt({ sessionID, prompt: new Prompt({ text: "Recover prepared task" }), resume: false })
      yield* SessionInput.promoteSteers(database.db, events, sessionID, Number.MAX_SAFE_INTEGER)
      const messageID = SessionMessage.ID.make("msg_e2e_prepared_before_request")
      const callID = "call-e2e-prepared-before-request"
      const childID = SessionTask.childID(sessionID, messageID, callID)
      const model = ModelV2.Ref.make({
        providerID: ProviderV2.ID.make("fake"),
        id: ModelV2.ID.make("fake-model"),
        variant: ModelV2.VariantID.make("default"),
      })
      const input = { description: "Prepared first", prompt: "prepared snapshot work", subagent_type: "general" }
      const permissions = [
        { action: "task", resource: "general", effect: "allow" as const },
        { action: "edit", resource: "prepared-secret", effect: "deny" as const },
      ]
      const plan = { mode: "code-only" as const, multiAgent: "v2" as const }
      const ceiling = [
        permissions[1]!,
        { action: "task", resource: "*", effect: "deny" as const },
        { action: "todowrite", resource: "*", effect: "deny" as const },
      ]
      yield* events.publish(SessionEvent.Step.Started, {
        sessionID,
        timestamp: yield* DateTime.now,
        assistantMessageID: messageID,
        agent: "build",
        model,
      })
      yield* events.publish(
        SessionEvent.Task.Prepared,
        {
          sessionID,
          timestamp: yield* DateTime.now,
          assistantMessageID: messageID,
          callID,
          input,
          callerAgent: AgentV2.ID.make("build"),
          permissions,
          plan,
          agent: AgentV2.ID.make("general"),
          available: [AgentV2.ID.make("general")],
          model,
          projectID: Project.ID.global,
          location: { directory: AbsolutePath.make("/project") },
          title: "Prepared first (@general subagent)",
          ceiling,
        },
        { id: SessionTask.preparedEventID(sessionID, messageID, callID) },
      )
      yield* events.publish(SessionEvent.Tool.Input.Started, {
        sessionID,
        timestamp: yield* DateTime.now,
        assistantMessageID: messageID,
        callID,
        name: "task",
      })
      yield* events.publish(SessionEvent.Tool.Input.Ended, {
        sessionID,
        timestamp: yield* DateTime.now,
        assistantMessageID: messageID,
        callID,
        text: JSON.stringify(input),
      })
      expect(yield* SessionTask.request(database.db, sessionID, messageID, callID)).toBeUndefined()
      yield* database.db
        .update(SessionTable)
        .set({ agent: "reviewer", model: { providerID: "fake", id: "replacement" } })
        .where(eq(SessionTable.id, sessionID))
        .run()
        .pipe(Effect.orDie)
      yield* (yield* AgentV2.Service).transform((editor) => {
        editor.update(AgentV2.ID.make("build"), (agent) => {
          agent.permissions = [{ action: "task", resource: "general", effect: "deny" }]
        })
        editor.update(AgentV2.ID.make("reviewer"), (agent) => {
          agent.permissions = [{ action: "read", resource: "mutated", effect: "allow" }]
        })
        editor.remove(AgentV2.ID.make("general"))
      })
      currentCatalog = catalogModel("gpt-5.6-luna", "gpt-5.6-luna")
      requests.length = 0
      responses = [
        fragmentFixture("text", "text-e2e-prepared-child", ["prepared result"]).completeEvents,
        fragmentFixture("text", "text-e2e-prepared-parent", ["parent continued"]).completeEvents,
      ]
      const local = SessionExecutionLocal.layer.pipe(
        Layer.provide(Layer.succeed(Database.Service, database)),
        Layer.provide(Layer.succeed(SessionStore.Service, store)),
        Layer.provide(Layer.succeed(SessionRuntime.Service, runtime)),
        Layer.provide(
          Layer.mock(LocationServiceMap, {
            get: () => Layer.succeed(SessionRunner.Service, runner),
          }),
        ),
      )

      yield* Effect.gen(function* () {
        const execution = yield* SessionExecution.Service
        yield* execution.wait(sessionID)
      }).pipe(Effect.provide(local), Effect.provide(TaskTool.layer))

      expect(
        (yield* session.context(sessionID))
          .flatMap((message) => (message.type === "assistant" ? message.content : []))
          .find((part) => part.type === "tool" && part.id === callID),
      ).toMatchObject({ state: { status: "completed" } })
      const request = (yield* SessionTask.request(database.db, sessionID, messageID, callID))!
      expect(request).toMatchObject({ callerAgent: "build", permissions, plan, agent: "general", model, ceiling })
      expect(requests.filter((item) => userTexts(item).includes(input.prompt))).toHaveLength(1)
      expect(
        yield* database.db
          .select()
          .from(EventTable)
          .where(eq(EventTable.id, SessionTask.progressEventID(sessionID, messageID, callID)))
          .get()
          .pipe(Effect.orDie),
      ).toMatchObject({
        data: {
          assistantMessageID: messageID,
          callID,
          structured: { childSessionID: childID, agent: "general", model },
        },
      })
      expect(
        yield* database.db.select().from(SessionTable).where(eq(SessionTable.id, childID)).all().pipe(Effect.orDie),
      ).toHaveLength(1)
    }),
  )

  it.effect("terminally fails the parent when cleanup wins immediately before Task.Execute", () =>
    Effect.gen(function* () {
      yield* setup
      const session = yield* SessionV2.Service
      const events = yield* EventV2.Service
      const database = yield* Database.Service
      const store = yield* SessionStore.Service
      const runtime = yield* SessionRuntime.Service
      const runner = yield* SessionRunner.Service
      yield* session.prompt({ sessionID, prompt: new Prompt({ text: "Race task cleanup" }), resume: false })
      yield* SessionInput.promoteSteers(database.db, events, sessionID, Number.MAX_SAFE_INTEGER)
      const messageID = SessionMessage.ID.make("msg_e2e_task_execute_race")
      const callID = "call-e2e-task-execute-race"
      const childID = SessionTask.childID(sessionID, messageID, callID)
      const promptID = SessionTask.promptID(sessionID, messageID, callID)
      const model = ModelV2.Ref.make({
        providerID: ProviderV2.ID.make("fake"),
        id: ModelV2.ID.make("fake-model"),
        variant: ModelV2.VariantID.make("default"),
      })
      const input = { description: "Race", prompt: "never reach child provider", subagent_type: "general" }
      yield* events.publish(SessionEvent.Step.Started, {
        sessionID,
        timestamp: yield* DateTime.now,
        assistantMessageID: messageID,
        agent: "build",
        model,
      })
      yield* events.publish(SessionEvent.Tool.Input.Started, {
        sessionID,
        timestamp: yield* DateTime.now,
        assistantMessageID: messageID,
        callID,
        name: "task",
      })
      yield* events.publish(SessionEvent.Tool.Input.Ended, {
        sessionID,
        timestamp: yield* DateTime.now,
        assistantMessageID: messageID,
        callID,
        text: JSON.stringify(input),
      })
      yield* events.publish(SessionEvent.Tool.CalledV1, {
        sessionID,
        timestamp: yield* DateTime.now,
        assistantMessageID: messageID,
        callID,
        tool: "task",
        input,
        provider: { executed: false },
      })
      yield* events.publish(
        SessionEvent.Task.Requested,
        {
          sessionID,
          timestamp: yield* DateTime.now,
          assistantMessageID: messageID,
          callID,
          childSessionID: childID,
          promptMessageID: promptID,
          description: input.description,
          prompt: input.prompt,
          agent: "general",
          model,
          multiAgent: "v2",
          callerAgent: AgentV2.ID.make("build"),
          permissions: [],
          plan: { multiAgent: "v2" },
          projectID: Project.ID.global,
          location: { directory: AbsolutePath.make("/project") },
          title: "Race (@general subagent)",
          ceiling: [],
        },
        { id: SessionTask.requestEventID(sessionID, messageID, callID) },
      )
      let executes = 0
      yield* events.listen((event) => {
        if (Schema.is(SessionEvent.Task.Execute)(event)) {
          executes++
          return Effect.void
        }
        if (!Schema.is(SessionEvent.PromptLifecycle.Admitted)(event) || event.data.messageID !== promptID)
          return Effect.void
        return events.publish(
          SessionEvent.Task.Interrupted,
          {
            sessionID,
            timestamp: event.data.timestamp,
            assistantMessageID: messageID,
            callID,
            childSessionID: childID,
          },
          { id: SessionTask.interruptedEventID(sessionID, messageID, callID) },
        )
      })
      requests.length = 0
      responses = [fragmentFixture("text", "text-race-should-not-run", ["unexpected"]).completeEvents]
      const local = SessionExecutionLocal.layer.pipe(
        Layer.provide(Layer.succeed(Database.Service, database)),
        Layer.provide(Layer.succeed(SessionStore.Service, store)),
        Layer.provide(Layer.succeed(SessionRuntime.Service, runtime)),
        Layer.provide(
          Layer.mock(LocationServiceMap, {
            get: () => Layer.succeed(SessionRunner.Service, runner),
          }),
        ),
      )

      yield* Effect.gen(function* () {
        const execution = yield* SessionExecution.Service
        yield* execution.wait(sessionID)
      }).pipe(Effect.provide(local), Effect.provide(TaskTool.layer))

      expect(executes).toBe(0)
      expect(requests.filter((item) => userTexts(item).includes(input.prompt))).toHaveLength(0)
      const settled = (yield* session.context(sessionID))
        .flatMap((message) => (message.type === "assistant" ? message.content : []))
        .find((part) => part.type === "tool" && part.id === callID)
      expect(settled).toMatchObject({
        state: { status: "error", error: { message: "Tool execution interrupted" } },
      })
    }),
  )

  it.effect("settles parent interruption before recovered task execution reaches the child", () =>
    Effect.gen(function* () {
      yield* setup
      const session = yield* SessionV2.Service
      const events = yield* EventV2.Service
      const database = yield* Database.Service
      const store = yield* SessionStore.Service
      const runtime = yield* SessionRuntime.Service
      const runner = yield* SessionRunner.Service
      yield* session.prompt({ sessionID, prompt: new Prompt({ text: "Interrupted recovery" }), resume: false })
      yield* SessionInput.promoteSteers(database.db, events, sessionID, Number.MAX_SAFE_INTEGER)
      const messageID = SessionMessage.ID.make("msg_e2e_parent_interrupt_barrier")
      const callID = "call-e2e-parent-interrupt-barrier"
      const childID = SessionTask.childID(sessionID, messageID, callID)
      const model = ModelV2.Ref.make({
        providerID: ProviderV2.ID.make("fake"),
        id: ModelV2.ID.make("fake-model"),
        variant: ModelV2.VariantID.make("default"),
      })
      const input = { description: "Blocked", prompt: "never reach provider", subagent_type: "general" }
      yield* database.db
        .insert(SessionTable)
        .values({
          id: childID,
          project_id: Project.ID.global,
          parent_id: sessionID,
          slug: childID,
          directory: "/project",
          title: "Blocked (@general subagent)",
          version: "test",
          runtime: "v2",
          agent: "general",
          model,
          metadata: {
            task: {
              version: 1,
              parentID: sessionID,
              agent: "general",
              origin: { messageID, callID },
              ceiling: [],
            },
          },
        })
        .run()
        .pipe(Effect.orDie)
      yield* events.publish(SessionEvent.Step.Started, {
        sessionID,
        timestamp: yield* DateTime.now,
        assistantMessageID: messageID,
        agent: "build",
        model,
      })
      yield* events.publish(SessionEvent.Tool.Input.Started, {
        sessionID,
        timestamp: yield* DateTime.now,
        assistantMessageID: messageID,
        callID,
        name: "task",
      })
      yield* events.publish(SessionEvent.Tool.Input.Ended, {
        sessionID,
        timestamp: yield* DateTime.now,
        assistantMessageID: messageID,
        callID,
        text: JSON.stringify(input),
      })
      yield* events.publish(SessionEvent.Tool.CalledV1, {
        sessionID,
        timestamp: yield* DateTime.now,
        assistantMessageID: messageID,
        callID,
        tool: "task",
        input,
        provider: { executed: false },
      })
      yield* events.publish(
        SessionEvent.Task.Requested,
        {
          sessionID,
          timestamp: yield* DateTime.now,
          assistantMessageID: messageID,
          callID,
          childSessionID: childID,
          promptMessageID: SessionTask.promptID(sessionID, messageID, callID),
          description: input.description,
          prompt: input.prompt,
          agent: "general",
          model,
          multiAgent: "v2",
          callerAgent: AgentV2.ID.make("build"),
          permissions: [],
          plan: { multiAgent: "v2" },
          projectID: Project.ID.global,
          location: { directory: AbsolutePath.make("/project") },
          title: "Blocked (@general subagent)",
          ceiling: [],
        },
        { id: SessionTask.requestEventID(sessionID, messageID, callID) },
      )
      yield* events.publish(SessionEvent.InterruptRequested, {
        sessionID,
        timestamp: yield* DateTime.now,
      })
      yield* database.db
        .update(SessionTable)
        .set({ runtime_state: "draining" })
        .where(eq(SessionTable.id, sessionID))
        .run()
        .pipe(Effect.orDie)
      requests.length = 0
      responses = [fragmentFixture("text", "text-should-not-run", ["unexpected"]).completeEvents]
      const local = SessionExecutionLocal.layer.pipe(
        Layer.provide(Layer.succeed(Database.Service, database)),
        Layer.provide(Layer.succeed(SessionStore.Service, store)),
        Layer.provide(Layer.succeed(SessionRuntime.Service, runtime)),
        Layer.provide(
          Layer.mock(LocationServiceMap, {
            get: () => Layer.succeed(SessionRunner.Service, runner),
          }),
        ),
      )

      yield* Effect.gen(function* () {
        const execution = yield* SessionExecution.Service
        yield* execution.wait(sessionID)
      }).pipe(Effect.provide(local), Effect.provide(TaskTool.layer))

      expect(requests.filter((item) => userTexts(item).includes(input.prompt))).toHaveLength(0)
      const settled = (yield* session.context(sessionID))
        .flatMap((message) => (message.type === "assistant" ? message.content : []))
        .find((part) => part.type === "tool" && part.id === callID)
      expect(settled).toMatchObject({
        state: { status: "error", error: { message: "Tool execution interrupted" } },
      })
      expect(yield* SessionTask.interrupted(database.db, sessionID, messageID, callID)).toBeFalse()
    }),
  )

  it.effect("settles a pending task interrupted before its durable request", () =>
    Effect.gen(function* () {
      yield* setup
      const session = yield* SessionV2.Service
      const events = yield* EventV2.Service
      const database = yield* Database.Service
      const store = yield* SessionStore.Service
      const runtime = yield* SessionRuntime.Service
      const runner = yield* SessionRunner.Service
      const agents = yield* AgentV2.Service
      yield* agents.transform((editor) => {
        editor.update(AgentV2.ID.make("build"), (agent) => {
          agent.permissions.push({ action: "task", resource: "general", effect: "allow" })
        })
        editor.update(AgentV2.ID.make("general"), (agent) => {
          agent.mode = "subagent"
        })
      })
      yield* session.prompt({ sessionID, prompt: new Prompt({ text: "Interrupted before request" }), resume: false })
      yield* SessionInput.promoteSteers(database.db, events, sessionID, Number.MAX_SAFE_INTEGER)
      const messageID = SessionMessage.ID.make("msg_e2e_interrupt_without_request")
      const callID = "call-e2e-interrupt-without-request"
      const model = ModelV2.Ref.make({
        providerID: ProviderV2.ID.make("fake"),
        id: ModelV2.ID.make("fake-model"),
        variant: ModelV2.VariantID.make("default"),
      })
      const input = { description: "Never create", prompt: "never dispatch", subagent_type: "general" }
      yield* events.publish(SessionEvent.Step.Started, {
        sessionID,
        timestamp: yield* DateTime.now,
        assistantMessageID: messageID,
        agent: "build",
        model,
      })
      yield* events.publish(SessionEvent.Tool.Input.Started, {
        sessionID,
        timestamp: yield* DateTime.now,
        assistantMessageID: messageID,
        callID,
        name: "task",
      })
      yield* events.publish(SessionEvent.Tool.Input.Ended, {
        sessionID,
        timestamp: yield* DateTime.now,
        assistantMessageID: messageID,
        callID,
        text: JSON.stringify(input),
      })
      yield* events.publish(SessionEvent.InterruptRequested, {
        sessionID,
        timestamp: yield* DateTime.now,
      })
      yield* database.db
        .update(SessionTable)
        .set({ runtime_state: "draining" })
        .where(eq(SessionTable.id, sessionID))
        .run()
        .pipe(Effect.orDie)
      requests.length = 0
      responses = [fragmentFixture("text", "text-without-request-should-not-run", ["unexpected"]).completeEvents]
      const local = SessionExecutionLocal.layer.pipe(
        Layer.provide(Layer.succeed(Database.Service, database)),
        Layer.provide(Layer.succeed(SessionStore.Service, store)),
        Layer.provide(Layer.succeed(SessionRuntime.Service, runtime)),
        Layer.provide(
          Layer.mock(LocationServiceMap, {
            get: () => Layer.succeed(SessionRunner.Service, runner),
          }),
        ),
      )

      yield* Effect.gen(function* () {
        const execution = yield* SessionExecution.Service
        yield* execution.wait(sessionID)
      }).pipe(Effect.provide(local), Effect.provide(TaskTool.layer))

      expect(yield* SessionTask.request(database.db, sessionID, messageID, callID)).toBeUndefined()
      expect(requests.filter((item) => userTexts(item).includes(input.prompt))).toHaveLength(0)
      const settled = (yield* session.context(sessionID))
        .flatMap((message) => (message.type === "assistant" ? message.content : []))
        .find((part) => part.type === "tool" && part.id === callID)
      expect(settled).toMatchObject({
        state: { status: "error", error: { message: "Tool execution interrupted" } },
      })
    }),
  )

  it.effect("durably fails hosted tools left running by a prior process before continuing inline", () =>
    Effect.gen(function* () {
      yield* setup
      const session = yield* SessionV2.Service
      const events = yield* EventV2.Service
      yield* session.prompt({
        sessionID,
        prompt: new Prompt({ text: "Recover interrupted hosted tool" }),
        resume: false,
      })
      yield* SessionInput.promoteSteers((yield* Database.Service).db, events, sessionID, Number.MAX_SAFE_INTEGER)
      const assistantMessageID = SessionMessage.ID.create()
      yield* events.publish(SessionEvent.Step.Started, {
        sessionID,
        assistantMessageID,
        timestamp: yield* DateTime.now,
        agent: "build",
        model: { id: ModelV2.ID.make("fake-model"), providerID: ProviderV2.ID.make("fake") },
      })
      yield* events.publish(SessionEvent.Tool.Input.Started, {
        sessionID,
        timestamp: yield* DateTime.now,
        assistantMessageID,
        callID: "call-hosted-interrupted",
        name: "web_search",
      })
      yield* events.publish(SessionEvent.Tool.Input.Ended, {
        sessionID,
        timestamp: yield* DateTime.now,
        assistantMessageID,
        callID: "call-hosted-interrupted",
        text: '{"query":"stale"}',
      })
      yield* events.publish(SessionEvent.Tool.CalledV1, {
        sessionID,
        timestamp: yield* DateTime.now,
        assistantMessageID,
        callID: "call-hosted-interrupted",
        tool: "web_search",
        input: { query: "stale" },
        provider: { executed: true, metadata: { openai: { itemId: "call-hosted-interrupted" } } },
      })
      requests.length = 0
      response = []
      yield* session.resume(sessionID)

      expect(requests).toHaveLength(1)
      expect(requests[0]?.messages.map((message) => message.role)).toEqual(["user", "assistant"])
      expect(requests[0]?.messages[1]?.content).toMatchObject([
        {
          type: "tool-call",
          id: "call-hosted-interrupted",
          providerExecuted: true,
          providerMetadata: { openai: { itemId: "call-hosted-interrupted" } },
        },
        { type: "tool-result", id: "call-hosted-interrupted", providerExecuted: true, result: { type: "error" } },
      ])
    }),
  )

  it.effect("durably fails pending tool input left by a prior process before continuing", () =>
    Effect.gen(function* () {
      yield* setup
      const session = yield* SessionV2.Service
      const events = yield* EventV2.Service
      yield* session.prompt({
        sessionID,
        prompt: new Prompt({ text: "Recover interrupted tool input" }),
        resume: false,
      })
      yield* SessionInput.promoteSteers((yield* Database.Service).db, events, sessionID, Number.MAX_SAFE_INTEGER)
      const assistantMessageID = SessionMessage.ID.create()
      yield* events.publish(SessionEvent.Step.Started, {
        sessionID,
        assistantMessageID,
        timestamp: yield* DateTime.now,
        agent: "build",
        model: { id: ModelV2.ID.make("fake-model"), providerID: ProviderV2.ID.make("fake") },
      })
      yield* events.publish(SessionEvent.Tool.Input.Started, {
        sessionID,
        timestamp: yield* DateTime.now,
        assistantMessageID,
        callID: "call-pending-interrupted",
        name: "echo",
      })
      requests.length = 0
      response = []
      yield* session.resume(sessionID)

      expect(requests).toHaveLength(1)
      expect(requests[0]?.messages.map((message) => message.role)).toEqual(["user", "assistant", "tool"])
      expect(yield* session.context(sessionID)).toMatchObject([
        { type: "user", text: "Recover interrupted tool input" },
        { type: "assistant", content: [{ type: "tool", id: "call-pending-interrupted", state: { status: "error" } }] },
      ])
    }),
  )

  it.effect("starts the first queued activity when woken while idle", () =>
    Effect.gen(function* () {
      yield* setup
      const session = yield* SessionV2.Service
      yield* session.prompt({
        sessionID,
        prompt: new Prompt({ text: "Wait for fresh activity" }),
        delivery: "queue",
        resume: false,
      })

      requests.length = 0
      yield* (yield* SessionRunCoordinator.Service).wake(sessionID)
      yield* Effect.yieldNow

      expect(requests).toHaveLength(1)
      expect(userTexts(requests[0]!)).toEqual(["Wait for fresh activity"])
    }),
  )

  it.effect("does not spend one activity step budget across queued activities", () =>
    Effect.gen(function* () {
      yield* setup
      const session = yield* SessionV2.Service
      const queued = Array.from({ length: 26 }, (_, index) => `Queued activity ${index + 1}`)
      for (const text of queued) {
        yield* session.prompt({ sessionID, prompt: new Prompt({ text }), delivery: "queue", resume: false })
      }

      requests.length = 0
      responses = queued.map(() => [
        LLMEvent.stepStart({ index: 0 }),
        LLMEvent.stepFinish({ index: 0, reason: "stop" }),
        LLMEvent.finish({ reason: "stop" }),
      ])

      yield* session.resume(sessionID)

      expect(requests).toHaveLength(queued.length)
      expect(userTexts(requests.at(-1)!)).toEqual(queued)
    }),
  )

  it.effect("retries inbox input after prompt projection rolls back", () =>
    Effect.gen(function* () {
      yield* setup
      const session = yield* SessionV2.Service
      const events = yield* EventV2.Service
      const defect = new Error("fail after prompt promotion")
      let fail = true
      yield* events.project(SessionEvent.PromptLifecycle.Promoted, () => (fail ? Effect.die(defect) : Effect.void))
      yield* session.prompt({ sessionID, prompt: new Prompt({ text: "Recover promoted input" }), resume: false })

      expect(yield* session.resume(sessionID).pipe(Effect.catchDefect(Effect.succeed))).toBe(defect)
      fail = false
      requests.length = 0
      response = [
        LLMEvent.stepStart({ index: 0 }),
        LLMEvent.stepFinish({ index: 0, reason: "stop" }),
        LLMEvent.finish({ reason: "stop" }),
      ]

      yield* (yield* SessionRunCoordinator.Service).wake(sessionID)
      while (requests.length === 0) yield* Effect.yieldNow

      expect(userTexts(requests[0]!)).toEqual(["Recover promoted input"])
    }),
  )

  it.effect("does not strand a committed promotion when a post-commit listener defects", () =>
    Effect.gen(function* () {
      yield* setup
      const session = yield* SessionV2.Service
      const events = yield* EventV2.Service
      yield* events.listen((event) =>
        event.type === SessionEvent.PromptLifecycle.Promoted.type
          ? Effect.die("fail after prompt promotion commits")
          : Effect.void,
      )
      yield* session.prompt({
        sessionID,
        prompt: new Prompt({ text: "Run committed promotion" }),
        resume: false,
      })

      requests.length = 0
      yield* session.resume(sessionID)

      expect(requests).toHaveLength(1)
      expect(userTexts(requests[0]!)).toEqual(["Run committed promotion"])
    }),
  )

  it.effect("runs different sessions concurrently", () =>
    Effect.gen(function* () {
      yield* setup
      yield* insertSession(otherSessionID)
      const session = yield* SessionV2.Service
      yield* session.prompt({ sessionID, prompt: new Prompt({ text: "Run first" }), resume: false })
      yield* session.prompt({ sessionID: otherSessionID, prompt: new Prompt({ text: "Run second" }), resume: false })

      requests.length = 0
      responses = undefined
      response = []
      streamGate = yield* Deferred.make<void>()
      streamStarted = yield* Deferred.make<void>()

      const first = yield* session.resume(sessionID).pipe(Effect.forkChild)
      yield* Deferred.await(streamStarted)
      const second = yield* session.resume(otherSessionID).pipe(Effect.forkChild)
      yield* Effect.yieldNow

      expect(requests).toHaveLength(2)
      expect(requests.map((request) => request.providerOptions?.openai?.promptCacheKey)).toEqual([
        sessionID,
        otherSessionID,
      ])
      yield* Deferred.succeed(streamGate, undefined)
      yield* Fiber.join(first)
      yield* Fiber.join(second)
      streamGate = undefined
      streamStarted = undefined
    }),
  )

  it.effect("bounds external session prompt cache keys", () =>
    Effect.gen(function* () {
      yield* setup
      const externalSessionID = SessionV2.ID.fromExternal({
        namespace: "discord",
        key: "thread-one",
      })
      const otherExternalSessionID = SessionV2.ID.fromExternal({
        namespace: "discord",
        key: "thread-two",
      })
      yield* insertSession(externalSessionID)
      yield* insertSession(otherExternalSessionID)
      const session = yield* SessionV2.Service
      yield* session.prompt({
        sessionID: externalSessionID,
        prompt: new Prompt({ text: "Run external session" }),
        resume: false,
      })
      yield* session.prompt({
        sessionID: otherExternalSessionID,
        prompt: new Prompt({ text: "Run other external session" }),
        resume: false,
      })

      requests.length = 0
      yield* session.resume(externalSessionID)
      yield* session.resume(otherExternalSessionID)

      const keys = requests.map((request) => request.providerOptions?.openai?.promptCacheKey)
      expect(keys).toEqual([externalSessionID.slice(4), otherExternalSessionID.slice(4)])
      expect(keys.every((key) => typeof key === "string" && key.length === 64)).toBe(true)
      expect(keys[0]).not.toBe(keys[1])
    }),
  )

  it.effect("fans out one failed run and allows a later retry", () =>
    Effect.gen(function* () {
      yield* setup
      const session = yield* SessionV2.Service
      yield* session.prompt({ sessionID, prompt: new Prompt({ text: "Retry after failure" }), resume: false })

      requests.length = 0
      responses = undefined
      response = []
      streamFailure = providerUnavailable()
      streamGate = yield* Deferred.make<void>()
      streamStarted = yield* Deferred.make<void>()

      const first = yield* session.resume(sessionID).pipe(Effect.forkChild)
      yield* Deferred.await(streamStarted)
      const second = yield* session.resume(sessionID).pipe(Effect.forkChild)
      yield* Effect.yieldNow

      expect(requests).toHaveLength(1)
      yield* Deferred.succeed(streamGate, undefined)
      const [firstExit, secondExit] = yield* Effect.all([Fiber.await(first), Fiber.await(second)])
      expect(secondExit).toEqual(firstExit)

      streamFailure = undefined
      streamGate = undefined
      streamStarted = undefined
      yield* session.resume(sessionID)
      expect(requests).toHaveLength(2)
    }),
  )

  it.effect("durably settles local tool failures before continuing", () =>
    Effect.gen(function* () {
      yield* setup
      const session = yield* SessionV2.Service
      yield* session.prompt({ sessionID, prompt: new Prompt({ text: "Call missing" }), resume: false })

      requests.length = 0
      responses = [
        [
          LLMEvent.stepStart({ index: 0 }),
          LLMEvent.toolCall({ id: "call-missing", name: "missing", input: {} }),
          LLMEvent.stepFinish({ index: 0, reason: "tool-calls" }),
          LLMEvent.finish({ reason: "tool-calls" }),
        ],
        [
          LLMEvent.stepStart({ index: 0 }),
          LLMEvent.textStart({ id: "text-after-error" }),
          LLMEvent.textDelta({ id: "text-after-error", text: "Recovered" }),
          LLMEvent.textEnd({ id: "text-after-error" }),
          LLMEvent.stepFinish({ index: 0, reason: "stop" }),
          LLMEvent.finish({ reason: "stop" }),
        ],
      ]
      streamGate = undefined
      streamStarted = undefined

      yield* session.resume(sessionID)

      expect(requests).toHaveLength(2)
      expect(yield* session.context(sessionID)).toMatchObject([
        { type: "user", text: "Call missing" },
        {
          type: "assistant",
          content: [
            {
              type: "tool",
              id: "call-missing",
              state: { status: "error", error: { message: "Unknown tool: missing" } },
            },
          ],
        },
        { type: "assistant", finish: "stop", content: [{ type: "text", id: "text-after-error", text: "Recovered" }] },
      ])
    }),
  )

  it.effect("propagates unexpected local tool defects operationally", () =>
    Effect.gen(function* () {
      yield* setup
      const session = yield* SessionV2.Service
      yield* session.prompt({ sessionID, prompt: new Prompt({ text: "Call defect" }), resume: false })

      requests.length = 0
      responses = [
        [
          LLMEvent.stepStart({ index: 0 }),
          LLMEvent.toolCall({ id: "call-defect", name: "defect", input: {} }),
          LLMEvent.stepFinish({ index: 0, reason: "tool-calls" }),
          LLMEvent.finish({ reason: "tool-calls" }),
        ],
      ]

      expect(yield* session.resume(sessionID).pipe(Effect.catchDefect(Effect.succeed))).toBe("unexpected tool defect")

      expect(requests).toHaveLength(1)
      expect(yield* session.context(sessionID)).toMatchObject([
        { type: "user", text: "Call defect" },
        {
          type: "assistant",
          content: [
            {
              type: "tool",
              id: "call-defect",
              state: {
                status: "error",
                error: { type: "unknown", message: "Tool execution failed: unexpected tool defect" },
              },
            },
          ],
        },
      ])
    }),
  )

  it.effect("interrupts runner continuation when a question is dismissed", () =>
    Effect.gen(function* () {
      yield* setup
      const session = yield* SessionV2.Service
      const registry = yield* ToolRegistry.Service
      const questions = yield* QuestionV2.Service
      yield* registry.register({
        question: Tool.make({
          description: "Ask the user",
          input: Schema.Struct({}),
          output: Schema.Struct({}),
          execute: (_, context) =>
            questions.ask({ sessionID: context.sessionID, questions: [] }).pipe(Effect.as({}), Effect.orDie),
        }),
      })
      yield* session.prompt({ sessionID, prompt: new Prompt({ text: "Ask then stop" }), resume: false })

      requests.length = 0
      responses = [
        [
          LLMEvent.stepStart({ index: 0 }),
          LLMEvent.toolCall({ id: "call-question", name: "question", input: {} }),
          LLMEvent.stepFinish({ index: 0, reason: "tool-calls" }),
          LLMEvent.finish({ reason: "tool-calls" }),
        ],
        [],
      ]

      const run = yield* session.resume(sessionID).pipe(Effect.exit, Effect.forkChild)
      let pending = yield* questions.list()
      while (pending.length === 0) {
        yield* Effect.yieldNow
        pending = yield* questions.list()
      }
      yield* questions.reject(pending[0]!.id)
      const exit = yield* Fiber.join(run)

      expect(exit._tag).toBe("Failure")
      if (exit._tag === "Failure") expect(Cause.hasInterruptsOnly(exit.cause)).toBe(true)
      expect(requests).toHaveLength(1)
      expect(yield* session.context(sessionID)).toMatchObject([
        { type: "user", text: "Ask then stop" },
        {
          type: "assistant",
          content: [
            {
              type: "tool",
              id: "call-question",
              state: { status: "error", error: { type: "unknown", message: "Tool execution interrupted" } },
            },
          ],
        },
      ])
    }),
  )

  it.effect("awaits started local tools before surfacing provider stream failure", () =>
    Effect.gen(function* () {
      yield* setup
      const session = yield* SessionV2.Service
      yield* session.prompt({ sessionID, prompt: new Prompt({ text: "Settle before failing" }), resume: false })
      const failure = providerUnavailable()
      toolExecutionGate = yield* Deferred.make<void>()
      responseStream = Stream.concat(
        Stream.fromIterable([
          LLMEvent.stepStart({ index: 0 }),
          LLMEvent.toolCall({ id: "call-before-failure", name: "echo", input: { text: "settle" } }),
        ]),
        Stream.fail(failure),
      )

      const run = yield* session.resume(sessionID).pipe(Effect.forkChild)
      while (executions.length === 0) yield* Effect.yieldNow
      yield* Effect.yieldNow
      yield* Deferred.succeed(toolExecutionGate, undefined)
      expect(yield* Fiber.join(run).pipe(Effect.flip)).toBe(failure)
      toolExecutionGate = undefined

      expect(yield* session.context(sessionID)).toMatchObject([
        { type: "user", text: "Settle before failing" },
        {
          type: "assistant",
          content: [
            { type: "tool", id: "call-before-failure", state: { status: "completed", structured: { text: "settle" } } },
          ],
        },
      ])
    }),
  )

  it.effect("durably fails blocked local tools when a provider turn is interrupted", () =>
    Effect.gen(function* () {
      yield* setup
      const session = yield* SessionV2.Service
      yield* session.prompt({ sessionID, prompt: new Prompt({ text: "Interrupt blocked tool" }), resume: false })
      executions.length = 0
      toolExecutionGate = yield* Deferred.make<void>()
      responseStream = Stream.concat(
        Stream.fromIterable([
          LLMEvent.stepStart({ index: 0 }),
          LLMEvent.toolCall({ id: "call-before-interrupt", name: "echo", input: { text: "blocked" } }),
        ]),
        Stream.never,
      )

      const run = yield* session.resume(sessionID).pipe(Effect.forkChild)
      while (executions.length === 0) yield* Effect.yieldNow
      yield* session.interrupt(sessionID)
      toolExecutionGate = undefined

      expect(yield* Fiber.await(run)).toMatchObject({ _tag: "Failure" })
      yield* session.interrupt(sessionID)
      expect(yield* session.context(sessionID)).toMatchObject([
        { type: "user", text: "Interrupt blocked tool" },
        {
          type: "assistant",
          content: [
            {
              type: "tool",
              id: "call-before-interrupt",
              state: { status: "error", error: { type: "unknown", message: "Tool execution interrupted" } },
            },
          ],
        },
      ])

      yield* replaySessionProjection(sessionID)

      expect(yield* session.context(sessionID)).toMatchObject([
        { type: "user", text: "Interrupt blocked tool" },
        { type: "assistant", content: [{ type: "tool", id: "call-before-interrupt", state: { status: "error" } }] },
      ])
      requests.length = 0
      responseStream = undefined
      response = []
      yield* session.resume(sessionID)
      expect(requests[0]?.messages.map((message) => message.role)).toEqual(["user", "assistant", "tool"])
    }),
  )

  it.effect("interrupts a blocked provider turn without local tool activity", () =>
    Effect.gen(function* () {
      yield* setup
      const session = yield* SessionV2.Service
      yield* session.prompt({ sessionID, prompt: new Prompt({ text: "Interrupt provider" }), resume: false })
      requests.length = 0
      response = []
      streamGate = yield* Deferred.make<void>()
      streamStarted = yield* Deferred.make<void>()

      const run = yield* session.resume(sessionID).pipe(Effect.forkChild)
      yield* Deferred.await(streamStarted)
      yield* session.interrupt(sessionID)
      const exit = yield* Fiber.await(run)
      streamGate = undefined
      streamStarted = undefined

      expect(Exit.isFailure(exit) && Cause.hasInterruptsOnly(exit.cause)).toBeTrue()
      expect(requests).toHaveLength(1)
      yield* session.interrupt(sessionID)
    }),
  )

  it.effect("durably fails blocked local tools when interrupted while awaiting settlement", () =>
    Effect.gen(function* () {
      yield* setup
      const session = yield* SessionV2.Service
      yield* session.prompt({ sessionID, prompt: new Prompt({ text: "Interrupt tool settlement" }), resume: false })
      executions.length = 0
      toolExecutionGate = yield* Deferred.make<void>()
      response = [
        LLMEvent.stepStart({ index: 0 }),
        LLMEvent.toolCall({ id: "call-await-interrupt", name: "echo", input: { text: "blocked" } }),
        LLMEvent.stepFinish({ index: 0, reason: "tool-calls" }),
        LLMEvent.finish({ reason: "tool-calls" }),
      ]

      const runner = yield* SessionRunner.Service
      const run = yield* runner.run({ sessionID, force: true }).pipe(Effect.forkChild)
      while (executions.length === 0) yield* Effect.yieldNow
      yield* Fiber.interrupt(run)
      toolExecutionGate = undefined

      expect(yield* Fiber.await(run)).toMatchObject({ _tag: "Failure" })
      expect(yield* session.context(sessionID)).toMatchObject([
        { type: "user", text: "Interrupt tool settlement" },
        {
          type: "assistant",
          content: [
            {
              type: "tool",
              id: "call-await-interrupt",
              state: { status: "error", error: { type: "unknown", message: "Tool execution interrupted" } },
            },
          ],
        },
      ])
    }),
  )

  it.effect("fails after the bounded number of local tool continuation steps", () =>
    Effect.gen(function* () {
      yield* setup
      const session = yield* SessionV2.Service
      yield* session.prompt({ sessionID, prompt: new Prompt({ text: "Loop forever" }), resume: false })

      requests.length = 0
      authorizations.length = 0
      executions.length = 0
      streamGate = undefined
      streamStarted = undefined
      responses = Array.from({ length: 25 }, (_, index) => [
        LLMEvent.stepStart({ index: 0 }),
        LLMEvent.toolCall({ id: `call-echo-${index}`, name: "echo", input: { text: `${index}` } }),
        LLMEvent.stepFinish({ index: 0, reason: "tool-calls" }),
        LLMEvent.finish({ reason: "tool-calls" }),
      ])

      const failure = yield* session.resume(sessionID).pipe(Effect.flip)

      expect(failure).toMatchObject({ _tag: "SessionRunner.StepLimitExceededError", sessionID, limit: 25 })
      expect(requests).toHaveLength(25)
      expect(executions).toHaveLength(25)
    }),
  )

  it.effect("does not restart a capped tool loop for a coalesced stale wake", () =>
    Effect.gen(function* () {
      yield* setup
      const session = yield* SessionV2.Service
      const coordinator = yield* SessionRunCoordinator.Service
      yield* session.prompt({ sessionID, prompt: new Prompt({ text: "Loop forever" }), resume: false })

      requests.length = 0
      responses = Array.from({ length: 25 }, (_, index) => [
        LLMEvent.stepStart({ index: 0 }),
        LLMEvent.toolCall({ id: `call-capped-${index}`, name: "echo", input: { text: `${index}` } }),
        LLMEvent.stepFinish({ index: 0, reason: "tool-calls" }),
        LLMEvent.finish({ reason: "tool-calls" }),
      ])
      streamGate = yield* Deferred.make<void>()
      streamStarted = yield* Deferred.make<void>()

      const run = yield* session.resume(sessionID).pipe(Effect.forkChild)
      yield* Deferred.await(streamStarted)
      yield* coordinator.wake(sessionID)
      yield* Deferred.succeed(streamGate, undefined)
      expect(yield* Fiber.join(run).pipe(Effect.flip)).toMatchObject({ _tag: "SessionRunner.StepLimitExceededError" })
      streamGate = undefined
      streamStarted = undefined
      yield* Effect.yieldNow

      expect(requests).toHaveLength(25)
    }),
  )

  it.effect("accepts a terminal response on the final bounded provider turn", () =>
    Effect.gen(function* () {
      yield* setup
      const session = yield* SessionV2.Service
      yield* session.prompt({ sessionID, prompt: new Prompt({ text: "Finish at the limit" }), resume: false })

      requests.length = 0
      responses = [
        ...Array.from({ length: 24 }, (_, index) => [
          LLMEvent.stepStart({ index: 0 }),
          LLMEvent.toolCall({ id: `call-terminal-${index}`, name: "echo", input: { text: `${index}` } }),
          LLMEvent.stepFinish({ index: 0, reason: "tool-calls" }),
          LLMEvent.finish({ reason: "tool-calls" }),
        ]),
        [
          LLMEvent.stepStart({ index: 0 }),
          LLMEvent.stepFinish({ index: 0, reason: "stop" }),
          LLMEvent.finish({ reason: "stop" }),
        ],
      ]

      yield* session.resume(sessionID)

      expect(requests).toHaveLength(25)
    }),
  )

  it.effect("projects provider errors as terminal assistant step failures", () =>
    Effect.gen(function* () {
      yield* setup
      const session = yield* SessionV2.Service
      yield* session.prompt({ sessionID, prompt: new Prompt({ text: "Fail durably" }), resume: false })

      requests.length = 0
      responses = undefined
      streamGate = undefined
      streamStarted = undefined
      response = [LLMEvent.stepStart({ index: 0 }), LLMEvent.providerError({ message: "Provider unavailable" })]

      yield* session.resume(sessionID)

      expect(requests).toHaveLength(1)
      expect(yield* session.context(sessionID)).toMatchObject([
        { type: "user", text: "Fail durably" },
        { type: "assistant", finish: "error", error: { type: "unknown", message: "Provider unavailable" } },
      ])
    }),
  )

  it.effect("projects provider errors emitted before assistant step start", () =>
    Effect.gen(function* () {
      yield* setup
      const session = yield* SessionV2.Service
      yield* session.prompt({ sessionID, prompt: new Prompt({ text: "Fail before step" }), resume: false })

      requests.length = 0
      response = [LLMEvent.providerError({ message: "Provider unavailable" })]

      yield* session.resume(sessionID)

      expect(requests).toHaveLength(1)
      expect(yield* session.context(sessionID)).toMatchObject([
        { type: "user", text: "Fail before step" },
        { type: "assistant", finish: "error", error: { type: "unknown", message: "Provider unavailable" } },
      ])
    }),
  )

  it.effect("does not recover context overflow after durable assistant output", () =>
    Effect.gen(function* () {
      yield* setup
      const session = yield* SessionV2.Service
      yield* session.prompt({ sessionID, prompt: new Prompt({ text: "Fail after output" }), resume: false })

      requests.length = 0
      response = [
        LLMEvent.stepStart({ index: 0 }),
        LLMEvent.textStart({ id: "text-partial" }),
        LLMEvent.textDelta({ id: "text-partial", text: "Partial" }),
        LLMEvent.textEnd({ id: "text-partial" }),
        LLMEvent.providerError({ message: "prompt too long", classification: "context-overflow" }),
      ]
      yield* session.resume(sessionID)

      expect(requests).toHaveLength(1)
      expect(yield* session.context(sessionID)).toMatchObject([
        { type: "user", text: "Fail after output" },
        {
          type: "assistant",
          finish: "error",
          error: { message: "prompt too long" },
          content: [{ type: "text", text: "Partial" }],
        },
      ])
    }),
  )

  it.effect("projects raw provider stream failures as terminal assistant step failures", () =>
    Effect.gen(function* () {
      yield* setup
      const session = yield* SessionV2.Service
      yield* session.prompt({ sessionID, prompt: new Prompt({ text: "Fail raw stream durably" }), resume: false })
      const failure = providerUnavailable()
      responseStream = Stream.fail(failure)

      expect(yield* session.resume(sessionID).pipe(Effect.flip)).toBe(failure)
      yield* replaySessionProjection(sessionID)
      expect(yield* session.context(sessionID)).toMatchObject([
        { type: "user", text: "Fail raw stream durably" },
        { type: "assistant", finish: "error", error: { type: "unknown", message: "Provider unavailable" } },
      ])
    }),
  )

  it.effect("does not continue automatically after a provider error follows a local tool call", () =>
    Effect.gen(function* () {
      yield* setup
      const session = yield* SessionV2.Service
      yield* session.prompt({
        sessionID,
        prompt: new Prompt({ text: "Do not continue failed provider" }),
        resume: false,
      })

      requests.length = 0
      const executionCount = executions.length
      response = [
        LLMEvent.stepStart({ index: 0 }),
        LLMEvent.toolCall({ id: "call-before-provider-error", name: "echo", input: { text: "settled" } }),
        LLMEvent.providerError({ message: "Provider unavailable" }),
      ]

      yield* session.resume(sessionID)

      expect(requests).toHaveLength(1)
      expect(executions.slice(executionCount)).toEqual(["settled"])
    }),
  )

  it.effect("durably fails a hosted tool when its provider errors before returning a result", () =>
    Effect.gen(function* () {
      yield* setup
      const session = yield* SessionV2.Service
      yield* session.prompt({ sessionID, prompt: new Prompt({ text: "Fail hosted tool durably" }), resume: false })

      requests.length = 0
      response = [
        LLMEvent.stepStart({ index: 0 }),
        LLMEvent.toolCall({
          id: "call-hosted-provider-error",
          name: "web_search",
          input: { query: "effect" },
          providerExecuted: true,
        }),
        LLMEvent.providerError({ message: "Provider unavailable" }),
      ]

      yield* session.resume(sessionID)

      expect(requests).toHaveLength(1)
      expect(yield* session.context(sessionID)).toMatchObject([
        { type: "user", text: "Fail hosted tool durably" },
        {
          type: "assistant",
          content: [{ type: "tool", id: "call-hosted-provider-error", state: { status: "error" } }],
        },
      ])
    }),
  )

  it.effect("durably fails a hosted tool left unresolved at normal provider EOF", () =>
    Effect.gen(function* () {
      yield* setup
      const session = yield* SessionV2.Service
      yield* session.prompt({ sessionID, prompt: new Prompt({ text: "Fail hosted tool at EOF" }), resume: false })
      response = [
        LLMEvent.stepStart({ index: 0 }),
        LLMEvent.toolCall({
          id: "call-hosted-eof",
          name: "web_search",
          input: { query: "effect" },
          providerExecuted: true,
        }),
      ]

      yield* session.resume(sessionID)
      yield* replaySessionProjection(sessionID)

      expect(yield* session.context(sessionID)).toMatchObject([
        { type: "user", text: "Fail hosted tool at EOF" },
        { type: "assistant", content: [{ type: "tool", id: "call-hosted-eof", state: { status: "error" } }] },
      ])
    }),
  )

  it.effect("durably fails a hosted tool left unresolved by a raw provider stream failure", () =>
    Effect.gen(function* () {
      yield* setup
      const session = yield* SessionV2.Service
      yield* session.prompt({
        sessionID,
        prompt: new Prompt({ text: "Fail hosted tool on raw failure" }),
        resume: false,
      })
      const failure = providerUnavailable()
      responseStream = Stream.concat(
        Stream.fromIterable([
          LLMEvent.stepStart({ index: 0 }),
          LLMEvent.toolCall({
            id: "call-hosted-raw-failure",
            name: "web_search",
            input: { query: "effect" },
            providerExecuted: true,
          }),
        ]),
        Stream.fail(failure),
      )

      expect(yield* session.resume(sessionID).pipe(Effect.flip)).toBe(failure)
      yield* replaySessionProjection(sessionID)
      expect(yield* session.context(sessionID)).toMatchObject([
        { type: "user", text: "Fail hosted tool on raw failure" },
        {
          type: "assistant",
          finish: "error",
          error: { type: "unknown", message: "Provider unavailable" },
          content: [{ type: "tool", id: "call-hosted-raw-failure", state: { status: "error" } }],
        },
      ])
    }),
  )

  it.effect("keeps interleaved assistant text blocks separate", () =>
    Effect.gen(function* () {
      yield* setup
      const session = yield* SessionV2.Service
      yield* session.prompt({ sessionID, prompt: new Prompt({ text: "Two blocks" }), resume: false })

      responses = undefined
      streamGate = undefined
      streamStarted = undefined
      response = [
        LLMEvent.stepStart({ index: 0 }),
        LLMEvent.textStart({ id: "text-1" }),
        LLMEvent.textStart({ id: "text-2" }),
        LLMEvent.textDelta({ id: "text-1", text: "First" }),
        LLMEvent.textDelta({ id: "text-2", text: "Second" }),
        LLMEvent.textEnd({ id: "text-1" }),
        LLMEvent.textEnd({ id: "text-2" }),
        LLMEvent.stepFinish({ index: 0, reason: "stop" }),
        LLMEvent.finish({ reason: "stop" }),
      ]

      yield* session.resume(sessionID)

      expect(yield* session.context(sessionID)).toMatchObject([
        { type: "user", text: "Two blocks" },
        {
          type: "assistant",
          content: [
            { type: "text", id: "text-1", text: "First" },
            { type: "text", id: "text-2", text: "Second" },
          ],
        },
      ])
    }),
  )

  for (const kind of fragmentKinds) {
    it.effect(`broadcasts provider ${kind} deltas without storing projection rewrites`, () =>
      verifyEphemeralDeltas(kind),
    )

    it.effect(`durably closes partial ${kind} when the provider stream fails`, () => verifyPartialFlushOnFailure(kind))

    it.effect(`durably closes partial ${kind} when the provider stream is interrupted`, () =>
      verifyPartialFlushOnInterruption(kind),
    )
  }

  it.effect("rejects duplicate streamed text starts", () =>
    Effect.gen(function* () {
      yield* setup
      const session = yield* SessionV2.Service
      responses = undefined
      streamGate = undefined
      streamStarted = undefined
      response = [LLMEvent.textStart({ id: "text-1" }), LLMEvent.textStart({ id: "text-1" })]

      expect(yield* session.resume(sessionID).pipe(Effect.catchDefect(Effect.succeed))).toBe(
        "Duplicate text start: text-1",
      )
    }),
  )

  it.effect("transitions streamed raw tool input to parsed called input", () =>
    Effect.gen(function* () {
      yield* setup
      const session = yield* SessionV2.Service
      yield* session.prompt({ sessionID, prompt: new Prompt({ text: "Call provider tool" }), resume: false })

      responses = undefined
      streamGate = undefined
      streamStarted = undefined
      response = [
        LLMEvent.stepStart({ index: 0 }),
        LLMEvent.toolInputStart({ id: "call-parsed", name: "web_search" }),
        LLMEvent.toolInputDelta({ id: "call-parsed", name: "web_search", text: '{"query":"hello"}' }),
        LLMEvent.toolInputEnd({ id: "call-parsed", name: "web_search" }),
        LLMEvent.toolCall({ id: "call-parsed", name: "web_search", input: { query: "hello" }, providerExecuted: true }),
      ]

      yield* session.resume(sessionID)

      expect(yield* session.context(sessionID)).toMatchObject([
        { type: "user", text: "Call provider tool" },
        {
          type: "assistant",
          content: [{ type: "tool", id: "call-parsed", state: { status: "error", input: { query: "hello" } } }],
        },
      ])
    }),
  )

  const harnessCases = [
    { id: "gpt-5.6", api: "gpt-5.6", profile: "gpt-5.6", effort: "low" },
    { id: "gpt-5.6-sol", api: "gpt-5.6-sol", profile: "gpt-5.6-sol", effort: "low" },
    { id: "gpt-5.6-terra", api: "gpt-5.6-terra", profile: "gpt-5.6-terra", effort: "medium" },
    {
      id: "gpt-5.6-luna",
      api: "gpt-5.6-luna",
      profile: "gpt-5.6-luna",
      effort: "medium",
      efforts: ["low", "medium", "high", "xhigh", "max"],
    },
    { id: "gpt-5.6-sol-fast", api: "gpt-5.6-sol", profile: "gpt-5.6-sol", effort: "low" },
  ] as const

  for (const item of harnessCases) {
    it.effect(`activates the golden V2 harness for ${item.id}`, () =>
      Effect.gen(function* () {
        yield* setup
        currentCatalog = catalogModel(item.id, item.api, "@ai-sdk/openai", item.efforts)
        const agents = yield* AgentV2.Service
        yield* agents.transform((editor) =>
          editor.update(AgentV2.ID.make("build"), (agent) => {
            agent.system = "Explicit agent addition"
            agent.mode = "primary"
          }),
        )
        const session = yield* SessionV2.Service
        yield* session.prompt({ sessionID, prompt: new Prompt({ text: `Run ${item.id}` }), resume: false })
        requests.length = 0
        response = [
          LLMEvent.stepStart({ index: 0 }),
          LLMEvent.stepFinish({ index: 0, reason: "stop" }),
          LLMEvent.finish({ reason: "stop" }),
        ]

        yield* session.resume(sessionID)

        expect(requests).toHaveLength(1)
        const request = requests[0]!
        const profile = ModelHarness.profiles[item.profile]
        const instructions = yield* ModelHarness.instructions(profile)
        expect(request.model.route).toMatchObject({
          protocol: "openai-responses",
          capabilities: ["responses-lite", "custom-tools"],
          defaults: { limits: { context: 372_000, output: 128_000 } },
        })
        expect(request.tools).toHaveLength(1)
        expect(request.tools[0]).toMatchObject({ type: "custom", name: "exec" })
        expect(request.system.map((part) => part.text)).toEqual([
          instructions,
          "Explicit agent addition",
          "Initial context",
        ])
        expect(Bun.CryptoHasher.hash("sha256", request.system[0]!.text, "hex")).toBe(
          profile.instruction.contentHash.slice(7),
        )
        expect(request.providerOptions?.openai).toEqual({
          promptCacheKey: sessionID,
          reasoningEffort: item.effort,
          reasoningSummary: "none",
          responsesMode: "lite",
          textVerbosity: "low",
        })

        const prepared = yield* LLMClient.prepare<OpenAIResponses.OpenAIResponsesBody>(request)
        expect(prepared.body).toMatchObject({
          model: item.api,
          instructions: "",
          parallel_tool_calls: false,
          prompt_cache_key: sessionID,
          store: false,
          include: ["reasoning.encrypted_content"],
          reasoning: { effort: item.effort, context: "all_turns" },
          text: { verbosity: "low" },
        })
        expect(JSON.parse(JSON.stringify(prepared.body))).not.toHaveProperty("tools")
        expect(JSON.parse(JSON.stringify(prepared.body.reasoning))).not.toHaveProperty("summary")
        expect(prepared.body.input[0]).toMatchObject({
          type: "additional_tools",
          role: "developer",
          tools: [{ type: "custom", name: "exec" }],
        })
        expect(prepared.body.input[1]).toEqual({
          type: "message",
          role: "developer",
          content: request.system.map((part) => ({ type: "input_text", text: part.text })),
        })
      }),
    )
  }

  for (const item of [
    { id: "gpt-5.6", api: "gpt-5.6", version: "v2" },
    { id: "gpt-5.6-luna", api: "gpt-5.6-luna", version: "v1" },
  ] as const) {
    it.effect(`passes the ${item.version} multi-agent plan through ${item.id} tool settlement`, () =>
      Effect.gen(function* () {
        yield* setup
        currentCatalog = catalogModel(item.id, item.api)
        const session = yield* SessionV2.Service
        yield* session.prompt({ sessionID, prompt: new Prompt({ text: `Plan ${item.version}` }), resume: false })
        authorizations.length = 0
        responses = [
          [
            LLMEvent.stepStart({ index: 0 }),
            LLMEvent.toolCall({ id: `call-plan-${item.version}`, name: "echo", input: { text: item.version } }),
            LLMEvent.stepFinish({ index: 0, reason: "tool-calls" }),
            LLMEvent.finish({ reason: "tool-calls" }),
          ],
          [],
        ]

        yield* session.resume(sessionID)

        expect(authorizations).toHaveLength(1)
        expect(authorizations[0]?.multiAgent).toBe(item.version)
      }),
    )
  }

  it.effect("leaves unrelated models in full Responses and function-tool mode", () =>
    Effect.gen(function* () {
      yield* setup
      currentCatalog = catalogModel("gpt-5.5")
      const agents = yield* AgentV2.Service
      yield* agents.transform((editor) =>
        editor.update(AgentV2.ID.make("build"), (agent) => {
          agent.system = "Unprofiled agent addition"
          agent.mode = "primary"
        }),
      )
      const session = yield* SessionV2.Service
      yield* session.prompt({ sessionID, prompt: new Prompt({ text: "Run unrelated model" }), resume: false })
      requests.length = 0

      yield* session.resume(sessionID)

      const request = requests[0]!
      expect(request.system.map((part) => part.text)).toEqual(["Unprofiled agent addition", "Initial context"])
      expect(request.tools).toHaveLength(2)
      expect(request.tools.every((tool) => !("type" in tool))).toBe(true)
      expect(request.providerOptions?.openai).toEqual({ promptCacheKey: sessionID })
      const prepared = yield* LLMClient.prepare<OpenAIResponses.OpenAIResponsesBody>(request)
      expect(prepared.body.tools).toHaveLength(2)
      expect(prepared.body.input[0]).toEqual({
        role: "system",
        content: "Unprofiled agent addition\nInitial context",
      })
      expect(prepared.body.input.some((item) => "type" in item && item.type === "additional_tools")).toBe(false)
      expect(prepared.body).not.toHaveProperty("instructions")
      expect(prepared.body).not.toHaveProperty("parallel_tool_calls")
    }),
  )

  it.effect("preserves supported explicit effort variants and maps ultra to max on the wire", () =>
    Effect.gen(function* () {
      yield* setup
      const { db } = yield* Database.Service
      currentCatalog = catalogModel("gpt-5.6-sol")
      yield* db
        .update(SessionTable)
        .set({ model: { id: "gpt-5.6-sol", providerID: "openai", variant: "ultra" } })
        .where(eq(SessionTable.id, sessionID))
        .run()
        .pipe(Effect.orDie)
      const session = yield* SessionV2.Service
      yield* session.prompt({ sessionID, prompt: new Prompt({ text: "Use explicit ultra" }), resume: false })
      requests.length = 0

      yield* session.resume(sessionID)

      expect(requests[0]?.providerOptions?.openai?.reasoningEffort).toBe("ultra")
      const prepared = yield* LLMClient.prepare<OpenAIResponses.OpenAIResponsesBody>(requests[0]!)
      expect(prepared.body.reasoning).toEqual({ effort: "max", context: "all_turns" })
    }),
  )

  it.effect("rejects unsupported profile effort variants before provider execution", () =>
    Effect.gen(function* () {
      yield* setup
      const { db } = yield* Database.Service
      currentCatalog = catalogModel("gpt-5.6-luna", "gpt-5.6-luna", "@ai-sdk/openai", [
        "low",
        "medium",
        "high",
        "xhigh",
        "max",
      ])
      yield* db
        .update(SessionTable)
        .set({ model: { id: "gpt-5.6-luna", providerID: "openai", variant: "ultra" } })
        .where(eq(SessionTable.id, sessionID))
        .run()
        .pipe(Effect.orDie)
      const session = yield* SessionV2.Service
      yield* session.prompt({ sessionID, prompt: new Prompt({ text: "Reject ultra" }), resume: false })
      requests.length = 0

      const failure = yield* session.resume(sessionID).pipe(Effect.flip)

      expect(failure).toEqual(
        new ModelHarness.UnsupportedReasoningError({
          profileID: "gpt-5.6-luna",
          variant: "ultra",
          supported: ["low", "medium", "high", "xhigh", "max"],
        }),
      )
      expect(requests).toEqual([])
    }),
  )

  it.effect("fails closed on harness routes without typed Responses Lite support", () =>
    Effect.gen(function* () {
      yield* setup
      currentCatalog = catalogModel("gpt-5.6-sol", "gpt-5.6-sol", "@ai-sdk/openai-compatible")
      const session = yield* SessionV2.Service
      yield* session.prompt({ sessionID, prompt: new Prompt({ text: "Reject classic transport" }), resume: false })
      requests.length = 0

      const failure = yield* session.resume(sessionID).pipe(Effect.flip)

      expect(failure).toEqual(
        new ModelHarness.IncompatibilityError({ profileID: "gpt-5.6-sol", missing: ["responses-lite"] }),
      )
      expect(requests).toEqual([])
    }),
  )

  it.effect("persists fenced bounded child progress under the outer exec call without child inputs", () =>
    Effect.gen(function* () {
      yield* setup
      currentCatalog = catalogModel("gpt-5.6-sol")
      const session = yield* SessionV2.Service
      yield* session.prompt({ sessionID, prompt: new Prompt({ text: "Run nested echo" }), resume: false })
      requests.length = 0
      responses = [
        [
          LLMEvent.stepStart({ index: 0 }),
          LLMEvent.toolCall({
            id: "call-exec-progress",
            name: "exec",
            toolType: "custom",
            input: 'return await tools.echo({ text: "child-secret" })',
          }),
          LLMEvent.stepFinish({ index: 0, reason: "tool-calls" }),
          LLMEvent.finish({ reason: "tool-calls" }),
        ],
        [
          LLMEvent.stepStart({ index: 0 }),
          LLMEvent.stepFinish({ index: 0, reason: "stop" }),
          LLMEvent.finish({ reason: "stop" }),
        ],
      ]

      yield* session.resume(sessionID)

      const rows = (yield* (yield* Database.Service).db
        .select({ type: EventTable.type, data: EventTable.data })
        .from(EventTable)
        .where(eq(EventTable.aggregate_id, sessionID))
        .orderBy(asc(EventTable.seq))
        .all()
        .pipe(Effect.orDie))
        .filter((row) => row.type === EventV2.versionedType(SessionEvent.Tool.Progress.type, 1))
        .map((row) => row.data)
      expect(rows).toMatchObject([
        {
          callID: "call-exec-progress",
          structured: { started: 1, settled: 0, latest: { name: "echo", outcome: "started" } },
          content: [],
        },
        {
          callID: "call-exec-progress",
          structured: { started: 1, settled: 1, latest: { name: "echo", outcome: "success" } },
          content: [],
        },
      ])
      expect(JSON.stringify(rows)).not.toContain("child-secret")
      expect(requests).toHaveLength(2)
    }),
  )

  it.effect("rejects malformed streamed tool input ordering", () =>
    Effect.gen(function* () {
      yield* setup
      const session = yield* SessionV2.Service
      responses = undefined
      streamGate = undefined
      streamStarted = undefined
      response = [LLMEvent.toolInputDelta({ id: "call-1", name: "read", text: "{}" })]

      expect(yield* session.resume(sessionID).pipe(Effect.catchDefect(Effect.succeed))).toBe(
        "Tool input delta before start: call-1",
      )
    }),
  )
})
