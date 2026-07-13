import { describe, expect } from "bun:test"
import { Database } from "@slopcode-ai/core/database/database"
import { EventV2 } from "@slopcode-ai/core/event"
import { Project } from "@slopcode-ai/core/project"
import { ProjectTable } from "@slopcode-ai/core/project/sql"
import { AbsolutePath } from "@slopcode-ai/core/schema"
import { SessionV2 } from "@slopcode-ai/core/session"
import { SessionInput } from "@slopcode-ai/core/session/input"
import { SessionMessage } from "@slopcode-ai/core/session/message"
import { SessionProjector } from "@slopcode-ai/core/session/projector"
import { SessionMessageTable, SessionTable } from "@slopcode-ai/core/session/sql"
import { eq } from "drizzle-orm"
import { Effect, Layer, Schema } from "effect"
import { testEffect } from "./lib/effect"

const database = Database.layerFromPath(":memory:")
const events = EventV2.layer.pipe(Layer.provide(database))
const projector = SessionProjector.layer.pipe(Layer.provide(events), Layer.provide(database))
const it = testEffect(Layer.mergeAll(database, events, projector))

const session = Effect.gen(function* () {
  const { db } = yield* Database.Service
  const id = SessionV2.ID.make("ses_shell_lifecycle")
  yield* db
    .insert(ProjectTable)
    .values({ id: Project.ID.global, worktree: AbsolutePath.make("/project"), sandboxes: [] })
    .onConflictDoNothing()
    .run()
    .pipe(Effect.orDie)
  yield* db
    .insert(SessionTable)
    .values({
      id,
      project_id: Project.ID.global,
      slug: id,
      directory: "/project",
      title: "Shell lifecycle",
      version: "test",
      runtime: "v2",
    })
    .onConflictDoNothing()
    .run()
    .pipe(Effect.orDie)
  return id
})

describe("SessionInput shell lifecycle", () => {
  it.effect("allows exactly one of pre-start terminal or Started to win", () =>
    Effect.gen(function* () {
      const { db } = yield* Database.Service
      const event = yield* EventV2.Service
      const sessionID = yield* session

      for (let index = 0; index < 12; index++) {
        const id = SessionMessage.ID.make(`msg_shell_transition_race_${index}`)
        const request = yield* SessionInput.admitShell(db, event, {
          id,
          sessionID,
          command: "touch marker",
          resume: false,
        })
        yield* Effect.all(
          [
            SessionInput.startShell(db, event, request).pipe(Effect.exit),
            SessionInput.endShell(
              db,
              event,
              request,
              { status: "failed", output: "Unable to start shell command.", truncated: false },
              "requested",
            ).pipe(Effect.exit),
          ],
          { concurrency: "unbounded" },
        )
        const started = yield* SessionInput.startedShell(db, id)
        const terminal = (yield* SessionInput.terminalShell(db, id)) !== undefined

        expect([started, terminal].filter(Boolean)).toHaveLength(1)
        if (terminal) expect(yield* SessionInput.startShell(db, event, request)).toBeFalse()
      }
    }),
  )

  it.effect("discovers pending sessions in one grouped result without duplicates", () =>
    Effect.gen(function* () {
      const { db } = yield* Database.Service
      const event = yield* EventV2.Service
      const sessionID = yield* session
      for (let index = 0; index < 24; index++) {
        const request = yield* SessionInput.admitShell(db, event, {
          id: SessionMessage.ID.make(`msg_shell_scan_${index}`),
          sessionID,
          command: `printf ${index}`,
          resume: false,
        })
        if (index === 23) continue
        yield* SessionInput.startShell(db, event, request)
        yield* SessionInput.endShell(db, event, request, {
          status: "completed",
          output: String(index),
          exitCode: 0,
          truncated: false,
        })
      }

      expect(yield* SessionInput.pendingShellSessions(db)).toEqual([sessionID])
    }),
  )

  it.effect("projects requested and pre-start terminal shell state", () =>
    Effect.gen(function* () {
      const { db } = yield* Database.Service
      const event = yield* EventV2.Service
      const sessionID = yield* session
      const id = SessionMessage.ID.make("msg_shell_prestart_projection")
      const request = yield* SessionInput.admitShell(db, event, {
        id,
        sessionID,
        command: "pwd",
        resume: false,
      })
      const requested = yield* db
        .select()
        .from(SessionMessageTable)
        .where(eq(SessionMessageTable.id, id))
        .get()
        .pipe(Effect.orDie)
      const message = Schema.decodeUnknownSync(SessionMessage.Message)({
        ...requested!.data,
        id,
        type: requested!.type,
      })
      expect(message).toMatchObject({
        id,
        type: "shell",
        command: "pwd",
        output: "",
      })
      expect(message.time).not.toHaveProperty("completed")

      yield* SessionInput.endShell(
        db,
        event,
        request,
        { status: "interrupted", output: "Shell command was interrupted before completion.", truncated: false },
        "requested",
      )

      const terminal = yield* db
        .select()
        .from(SessionMessageTable)
        .where(eq(SessionMessageTable.id, id))
        .get()
        .pipe(Effect.orDie)
      expect(
        Schema.decodeUnknownSync(SessionMessage.Message)({ ...terminal!.data, id, type: terminal!.type }),
      ).toMatchObject({
        id,
        type: "shell",
        command: "pwd",
        status: "interrupted",
        output: "Shell command was interrupted before completion.",
        time: { completed: expect.anything() },
      })
    }),
  )
})
