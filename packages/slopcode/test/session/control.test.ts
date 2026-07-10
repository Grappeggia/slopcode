import { describe, expect } from "bun:test"
import { Database } from "@slopcode-ai/core/database/database"
import { Project } from "@slopcode-ai/core/project"
import { ProjectTable } from "@slopcode-ai/core/project/sql"
import { AbsolutePath } from "@slopcode-ai/core/schema"
import { SessionV2 } from "@slopcode-ai/core/session"
import { SessionInput } from "@slopcode-ai/core/session/input"
import { SessionMessage } from "@slopcode-ai/core/session/message"
import { SessionRuntime } from "@slopcode-ai/core/session/runtime"
import { SessionTable } from "@slopcode-ai/core/session/sql"
import { SessionV1 } from "@slopcode-ai/core/v1/session"
import { DateTime, Effect, Layer, Stream } from "effect"
import { SessionControl } from "../../src/session/control"
import { SessionPrompt } from "../../src/session/prompt"
import { MessageID, SessionID } from "../../src/session/schema"
import { testEffect } from "../lib/effect"

const database = Database.layerFromPath(":memory:")
const runtime = SessionRuntime.layer.pipe(Layer.provide(database))
const sessionID = SessionID.make("ses_control_test")
const legacyCalls: SessionPrompt.PromptInput[] = []
const v2Calls: Array<{ readonly prompt: string; readonly resume?: boolean }> = []
const legacyMessage = {
  info: {
    id: MessageID.ascending(),
    role: "user",
    sessionID,
    time: { created: 0 },
    agent: "build",
    model: { providerID: "test", modelID: "test" },
  },
  parts: [],
} as unknown as SessionV1.WithParts

const legacy = Layer.succeed(
  SessionPrompt.Service,
  SessionPrompt.Service.of({
    cancel: () => Effect.void,
    prompt: (input) =>
      Effect.sync(() => {
        legacyCalls.push(input)
        return legacyMessage
      }),
    loop: () => Effect.succeed(legacyMessage),
    shell: () => Effect.die("unused"),
    command: () => Effect.die("unused"),
    resolvePromptParts: () => Effect.succeed([]),
  }),
)

const sessions = Layer.succeed(
  SessionV2.Service,
  SessionV2.Service.of({
    list: () => Effect.succeed([]),
    create: () => Effect.die("unused"),
    get: () => Effect.die("unused"),
    messages: () => Effect.succeed([]),
    message: () => Effect.succeed(undefined),
    context: () => Effect.succeed([]),
    events: () => Stream.empty,
    switchAgent: () => Effect.die("unused"),
    switchModel: () => Effect.void,
    prompt: (input) =>
      Effect.sync(() => {
        v2Calls.push({ prompt: input.prompt.text, resume: input.resume })
        return new SessionInput.Admitted({
          admittedSeq: 1,
          id: input.id ?? SessionMessage.ID.create(),
          sessionID: input.sessionID,
          prompt: input.prompt,
          delivery: input.delivery ?? "steer",
          timeCreated: DateTime.makeUnsafe(0),
        })
      }),
    shell: () => Effect.die("unused"),
    skill: () => Effect.die("unused"),
    compact: () => Effect.die("unused"),
    wait: () => Effect.die("unused"),
    resume: () => Effect.void,
    interrupt: () => Effect.void,
  }),
)
const control = SessionControl.layer.pipe(Layer.provide(runtime), Layer.provide(legacy), Layer.provide(sessions))
const it = testEffect(Layer.mergeAll(database, runtime, legacy, sessions, control))

const setup = Effect.gen(function* () {
  const { db } = yield* Database.Service
  legacyCalls.length = 0
  v2Calls.length = 0
  yield* db
    .insert(ProjectTable)
    .values({ id: Project.ID.global, worktree: AbsolutePath.make("/project"), sandboxes: [] })
    .onConflictDoNothing()
    .run()
    .pipe(Effect.orDie)
  yield* db
    .insert(SessionTable)
    .values({
      id: sessionID,
      project_id: Project.ID.global,
      slug: "test",
      directory: "/project",
      title: "test",
      version: "test",
    })
    .onConflictDoNothing()
    .run()
    .pipe(Effect.orDie)
})

describe("SessionControl", () => {
  it.effect("routes V1-owned prompts to SessionPrompt", () =>
    Effect.gen(function* () {
      yield* setup
      const control = yield* SessionControl.Service

      expect(yield* control.prompt({ sessionID, parts: [{ type: "text", text: "legacy" }] })).toBe(legacyMessage)
      expect(legacyCalls).toHaveLength(1)
      expect(v2Calls).toEqual([])
    }),
  )

  it.effect("routes V2-owned prompts to SessionV2", () =>
    Effect.gen(function* () {
      yield* setup
      const control = yield* SessionControl.Service
      const runtime = yield* SessionRuntime.Service
      yield* runtime.assign({ sessionID, owner: "v2", expectedOwner: "v1", expectedEpoch: 0 })

      expect(
        yield* control.prompt({ sessionID, noReply: true, parts: [{ type: "text", text: "next" }] }),
      ).toMatchObject({ prompt: { text: "next" } })
      expect(legacyCalls).toEqual([])
      expect(v2Calls).toEqual([{ prompt: "next", resume: false }])
    }),
  )
})
