import fs from "fs/promises"
import path from "path"
import { describe, expect } from "bun:test"
import { Effect, Layer, Schema } from "effect"
import { AbsolutePath, Location, Model, SlopCode, Session, Tool } from "@slopcode-ai/core/public"
import { Database } from "@slopcode-ai/core/database/database"
import { EventV2 } from "@slopcode-ai/core/event"
import { EventTable } from "@slopcode-ai/core/event/sql"
import { SessionInputTable, SessionTable } from "@slopcode-ai/core/session/sql"
import { Prompt } from "@slopcode-ai/core/session/prompt"
import { eq } from "drizzle-orm"
import { tmpdir } from "./fixture/tmpdir"
import { testEffect } from "./lib/effect"

const it = testEffect(Layer.mergeAll(SlopCode.layer, Database.defaultLayer, EventV2.defaultLayer))

describe("public native SlopCode API", () => {
  it.effect("exposes only the intentional Session capabilities", () =>
    Effect.gen(function* () {
      const slopcode = yield* SlopCode.Service

      expect(Object.keys(slopcode).sort()).toEqual(["sessions", "tools"])

      expect(Object.keys(slopcode.sessions).sort()).toEqual([
        "context",
        "create",
        "events",
        "get",
        "interrupt",
        "list",
        "message",
        "messages",
        "prompt",
        "skill",
        "switchAgent",
        "switchModel",
      ])
      expect(Session.ID.create()).toStartWith("ses_")
      expect(Session.MessageID.create()).toStartWith("msg_")
      expect(yield* slopcode.sessions.list()).toBeArray()
      yield* slopcode.tools.register({
        public_tool: Tool.make({
          description: "Public tool",
          input: Schema.Struct({}),
          output: Schema.Struct({ ok: Schema.Boolean }),
          execute: () => Effect.succeed({ ok: true }),
        }),
      })
    }),
  )

  it.live("switches to an available model and variant", () =>
    Effect.acquireRelease(
      Effect.promise(() => tmpdir()),
      (tmp) => Effect.promise(() => tmp[Symbol.asyncDispose]()),
    ).pipe(
      Effect.flatMap((tmp) =>
        Effect.gen(function* () {
          yield* writeProvider(tmp.path)
          const slopcode = yield* SlopCode.Service
          const sessionID = Session.ID.create()
          const model = ref({ variant: "fast" })
          yield* slopcode.sessions.create({
            id: sessionID,
            location: Location.Ref.make({ directory: AbsolutePath.make(tmp.path) }),
          })

          yield* slopcode.sessions.switchModel({ sessionID, model })

          expect((yield* slopcode.sessions.get(sessionID)).model).toEqual(model)
        }),
      ),
    ),
  )

  it.live("validates agent and skill catalogs through public embedding methods", () =>
    Effect.acquireRelease(
      Effect.promise(() => tmpdir()),
      (tmp) => Effect.promise(() => tmp[Symbol.asyncDispose]()),
    ).pipe(
      Effect.flatMap((tmp) =>
        Effect.gen(function* () {
          const slopcode = yield* SlopCode.Service
          const sessionID = Session.ID.create()
          yield* slopcode.sessions.create({
            id: sessionID,
            location: Location.Ref.make({ directory: AbsolutePath.make(tmp.path) }),
          })

          yield* slopcode.sessions.switchAgent({ sessionID, agent: "plan" })
          const admitted = yield* slopcode.sessions.skill({
            sessionID,
            skill: "customize-slopcode",
            resume: false,
          })
          const agentError = yield* slopcode.sessions.switchAgent({ sessionID, agent: "missing" }).pipe(Effect.flip)
          const skillError = yield* slopcode.sessions
            .skill({ sessionID, skill: "missing", resume: false })
            .pipe(Effect.flip)

          expect((yield* slopcode.sessions.get(sessionID)).agent).toBe("plan")
          expect(admitted.prompt.text).toContain("slopcode.json")
          expect(agentError).toBeInstanceOf(Session.AgentUnavailableError)
          expect(skillError).toBeInstanceOf(Session.SkillNotFoundError)
        }),
      ),
    ),
  )

  it.live("rejects missing and Location-disabled models without changing the Session", () =>
    Effect.acquireRelease(
      Effect.promise(() => Promise.all([tmpdir(), tmpdir()])),
      (dirs) => Effect.promise(() => Promise.all(dirs.map((dir) => dir[Symbol.asyncDispose]())).then(() => undefined)),
    ).pipe(
      Effect.flatMap(([available, disabled]) =>
        Effect.gen(function* () {
          yield* writeProvider(available.path)
          yield* writeProvider(disabled.path, true)
          const slopcode = yield* SlopCode.Service
          const availableID = Session.ID.create()
          const disabledID = Session.ID.create()
          yield* slopcode.sessions.create({
            id: availableID,
            location: Location.Ref.make({ directory: AbsolutePath.make(available.path) }),
          })
          yield* slopcode.sessions.create({
            id: disabledID,
            location: Location.Ref.make({ directory: AbsolutePath.make(disabled.path) }),
          })

          yield* slopcode.sessions.switchModel({ sessionID: availableID, model: ref({ variant: "default" }) })
          const disabledError = yield* slopcode.sessions
            .switchModel({ sessionID: disabledID, model: ref() })
            .pipe(Effect.flip)
          const missingError = yield* slopcode.sessions
            .switchModel({ sessionID: disabledID, model: ref({ id: "missing" }) })
            .pipe(Effect.flip)

          expect(disabledError).toBeInstanceOf(Session.ModelUnavailableError)
          expect(missingError).toBeInstanceOf(Session.ModelUnavailableError)
          expect((yield* slopcode.sessions.get(availableID)).model).toEqual(ref({ variant: "default" }))
          expect((yield* slopcode.sessions.get(disabledID)).model).toBeUndefined()
        }),
      ),
    ),
  )

  it.live("rejects an unavailable variant without changing the Session", () =>
    Effect.acquireRelease(
      Effect.promise(() => tmpdir()),
      (tmp) => Effect.promise(() => tmp[Symbol.asyncDispose]()),
    ).pipe(
      Effect.flatMap((tmp) =>
        Effect.gen(function* () {
          yield* writeProvider(tmp.path)
          const slopcode = yield* SlopCode.Service
          const sessionID = Session.ID.create()
          const selected = ref({ variant: "fast" })
          yield* slopcode.sessions.create({
            id: sessionID,
            location: Location.Ref.make({ directory: AbsolutePath.make(tmp.path) }),
          })
          yield* slopcode.sessions.switchModel({ sessionID, model: selected })

          const error = yield* slopcode.sessions
            .switchModel({ sessionID, model: ref({ variant: "unknown" }) })
            .pipe(Effect.flip)

          expect(error).toBeInstanceOf(Session.VariantUnavailableError)
          expect((yield* slopcode.sessions.get(sessionID)).model).toEqual(selected)
        }),
      ),
    ),
  )

  it.effect("preserves the typed not-found error for a missing Session", () =>
    Effect.gen(function* () {
      const slopcode = yield* SlopCode.Service
      const sessionID = Session.ID.create()
      const error = yield* slopcode.sessions
        .switchModel({
          sessionID,
          model: Schema.decodeUnknownSync(Model.Ref)({ id: "claude-sonnet-4-5", providerID: "anthropic" }),
        })
        .pipe(Effect.flip)

      expect(error).toBeInstanceOf(Session.NotFoundError)
      if (error instanceof Session.NotFoundError) expect(error.sessionID).toBe(sessionID)
    }),
  )

  it.live("rejects an unsupported model route before persisting a switch", () =>
    Effect.acquireRelease(
      Effect.promise(() => tmpdir()),
      (tmp) => Effect.promise(() => tmp[Symbol.asyncDispose]()),
    ).pipe(
      Effect.flatMap((tmp) =>
        Effect.gen(function* () {
          yield* writeProvider(tmp.path, false, true)
          const slopcode = yield* SlopCode.Service
          const sessionID = Session.ID.create()
          yield* slopcode.sessions.create({
            id: sessionID,
            location: Location.Ref.make({ directory: AbsolutePath.make(tmp.path) }),
          })

          expect(yield* slopcode.sessions.switchModel({ sessionID, model: ref() }).pipe(Effect.flip)).toMatchObject({
            _tag: "SessionRunnerModel.UnsupportedApiError",
            api: "native",
          })
          expect((yield* slopcode.sessions.get(sessionID)).model).toBeUndefined()
        }),
      ),
    ),
  )

  it.live("fences every native mutating control for V1 and transition runtimes before mutation", () =>
    Effect.acquireRelease(
      Effect.promise(() => tmpdir()),
      (tmp) => Effect.promise(() => tmp[Symbol.asyncDispose]()),
    ).pipe(
      Effect.flatMap((tmp) =>
        Effect.gen(function* () {
          yield* writeProvider(tmp.path)
          const slopcode = yield* SlopCode.Service
          const { db } = yield* Database.Service
          const states = [
            { owner: "v1", state: "ready" },
            { owner: "v2", state: "draining" },
            { owner: "v2", state: "migrating" },
            { owner: "v2", state: "paused" },
          ] as const

          for (const runtime of states) {
            const sessionID = Session.ID.create()
            yield* slopcode.sessions.create({
              id: sessionID,
              location: Location.Ref.make({ directory: AbsolutePath.make(tmp.path) }),
            })
            yield* db
              .update(SessionTable)
              .set({ runtime: runtime.owner, runtime_state: runtime.state })
              .where(eq(SessionTable.id, sessionID))
              .run()
              .pipe(Effect.orDie)
            const before = yield* db
              .select()
              .from(EventTable)
              .where(eq(EventTable.aggregate_id, sessionID))
              .all()
              .pipe(Effect.orDie)
            const inputs = yield* db
              .select()
              .from(SessionInputTable)
              .where(eq(SessionInputTable.session_id, sessionID))
              .all()
              .pipe(Effect.orDie)
            const controls = [
              slopcode.sessions.prompt({ sessionID, prompt: new Prompt({ text: "blocked" }) }),
              slopcode.sessions.skill({ sessionID, skill: "customize-slopcode", resume: false }),
              slopcode.sessions.switchAgent({ sessionID, agent: "plan" }),
              slopcode.sessions.switchModel({ sessionID, model: ref() }),
              slopcode.sessions.interrupt(sessionID),
            ]

            for (const control of controls) {
              expect(yield* control.pipe(Effect.flip)).toMatchObject({
                _tag: "SessionRuntime.Mismatch",
                actualOwner: runtime.owner,
                actualState: runtime.state,
              })
            }
            expect(
              yield* db
                .select()
                .from(EventTable)
                .where(eq(EventTable.aggregate_id, sessionID))
                .all()
                .pipe(Effect.orDie),
            ).toEqual(before)
            expect(
              yield* db
                .select()
                .from(SessionInputTable)
                .where(eq(SessionInputTable.session_id, sessionID))
                .all()
                .pipe(Effect.orDie),
            ).toEqual(inputs)
            expect((yield* slopcode.sessions.get(sessionID)).model).toBeUndefined()
          }
        }),
      ),
    ),
  )
})

const ref = (input: { id?: string; variant?: string } = {}) =>
  Schema.decodeUnknownSync(Model.Ref)({
    id: input.id ?? "chat",
    providerID: "public-test",
    variant: input.variant,
  })

const writeProvider = (directory: string, disabled = false, unsupported = false) =>
  Effect.promise(() =>
    fs.writeFile(
      path.join(directory, "slopcode.json"),
      JSON.stringify({
        providers: {
          "public-test": {
            name: "Public test",
            api: unsupported
              ? { type: "native", settings: {} }
              : { type: "aisdk", package: "@ai-sdk/openai", url: "https://public-test.example/v1" },
            models: {
              chat: {
                disabled,
                variants: [{ id: "fast" }],
              },
            },
          },
        },
      }),
    ),
  )
