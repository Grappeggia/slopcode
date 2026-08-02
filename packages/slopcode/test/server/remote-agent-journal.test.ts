import { Database } from "@slopcode-ai/core/database/database"
import { describe, expect, test } from "bun:test"
import { Effect, Layer } from "effect"
import path from "node:path"
import {
  limits,
  Service as Journal,
  layer as journalLayer,
} from "../../src/server/routes/instance/httpapi/handlers/remote-agent-journal"
import type {
  RemoteAgentJobEvent,
  RemoteAgentJobState,
} from "../../src/server/routes/instance/httpapi/groups/remote-runtime"
import { tmpdir } from "../fixture/fixture"
import { MAX_REMOTE_JOB_EVENTS } from "../../src/server/routes/instance/httpapi/groups/remote-runtime"

type State = typeof RemoteAgentJobState.Type
type Event = typeof RemoteAgentJobEvent.Type

function state(id = "job_test"): State {
  return {
    id,
    workspaceID: "workspace_test",
    directory: "/project",
    agent: "codex-cli",
    status: "queued",
    updatedAt: 1,
  }
}

function run<A, E>(filename: string, effect: Effect.Effect<A, E, Journal>) {
  return Effect.runPromise(
    effect.pipe(
      Effect.provide(journalLayer.pipe(Layer.provide(Database.layerFromPath(filename).pipe(Layer.fresh)))),
      Effect.scoped,
    ),
  )
}

function append(jobID: string, message: string) {
  return Journal.use((journal) =>
    journal.append({
      jobID,
      id: `evt_${message}`,
      type: "job.progress",
      data: { message },
      reduce: (current, event) => ({
        ...current,
        cursor: event.cursor,
        status: "running",
        updatedAt: Number(event.cursor),
      }),
    }),
  )
}

function start(id = "job_test", fingerprint = "first") {
  return Journal.use((journal) => journal.start({ state: state(id), root: "/project", fingerprint }))
}

describe("remote agent journal", () => {
  test("recovers durable snapshots and events after a service restart", async () => {
    await using tmp = await tmpdir({ config: { formatter: false, lsp: false } })
    const filename = path.join(tmp.path, "journal.sqlite")
    await run(
      filename,
      Effect.gen(function* () {
        expect((yield* start()).type).toBe("created")
        yield* append("job_test", "connected")
      }),
    )
    await run(
      filename,
      Effect.gen(function* () {
        const journal = yield* Journal
        expect((yield* journal.get("job_test"))?.state).toMatchObject({ status: "running", cursor: "1" })
        expect(yield* journal.replay({ jobID: "job_test" })).toMatchObject({
          type: "events",
          events: [expect.objectContaining({ cursor: "1", data: { message: "connected" } })],
        })
      }),
    )
  })

  test("returns duplicates and rejects idempotency conflicts without replacing state", async () => {
    await run(
      ":memory:",
      Effect.gen(function* () {
        expect((yield* start()).type).toBe("created")
        expect((yield* start()).type).toBe("duplicate")
        expect((yield* start("job_test", "changed")).type).toBe("conflict")
        expect((yield* (yield* Journal).get("job_test"))?.fingerprint).toBe("first")
      }),
    )
  })

  test("requires a snapshot when a retained event tail no longer covers the cursor", async () => {
    await run(
      ":memory:",
      Effect.gen(function* () {
        yield* start()
        yield* Effect.all(Array.from({ length: 3 }, (_, index) => append("job_test", String(index))))
        const journal = yield* Journal
        const initial = yield* journal.replay({ jobID: "job_test", cursor: "0" })
        expect(initial.type).toBe("events")
        if (initial.type === "events") expect(initial.events[0]).toMatchObject({ cursor: "1" })
        yield* Effect.all(
          Array.from({ length: MAX_REMOTE_JOB_EVENTS }, (_, index) => append("job_test", `tail-${index}`)),
        )
        expect(yield* journal.replay({ jobID: "job_test", cursor: "0" })).toMatchObject({
          type: "snapshot_required",
          state: expect.objectContaining({ id: "job_test", status: "running" }),
        })
      }),
    )
  })

  test("serializes interaction responses by revision and makes a matching retry idempotent", async () => {
    await run(
      ":memory:",
      Effect.gen(function* () {
        const journal = yield* Journal
        yield* start()
        expect(
          yield* journal.createInteraction({
            jobID: "job_test",
            id: "int_test",
            kind: "approval",
            payload: { title: "Run tests", token: "not persisted" },
          }),
        ).toMatchObject({ revision: 1, payload: { title: "Run tests" } })
        const first = journal.resolveInteraction({
          jobID: "job_test",
          id: "int_test",
          revision: 1,
          digest: "approve",
          resolution: { answer: "yes", secret: "not persisted" },
        })
        const second = journal.resolveInteraction({
          jobID: "job_test",
          id: "int_test",
          revision: 1,
          digest: "approve",
          resolution: { answer: "yes" },
        })
        expect(
          (yield* Effect.all([first, second], { concurrency: "unbounded" })).map((item) => item.type).sort(),
        ).toEqual(["duplicate", "resolved"])
        expect(
          yield* journal.resolveInteraction({
            jobID: "job_test",
            id: "int_test",
            revision: 1,
            digest: "reject",
            resolution: { answer: "no" },
          }),
        ).toMatchObject({ type: "conflict" })
      }),
    )
  })

  test("enforces bounded artifact metadata and expires single-use plan tokens", async () => {
    await run(
      ":memory:",
      Effect.gen(function* () {
        const journal = yield* Journal
        yield* start()
        const artifacts = yield* Effect.all(
          Array.from({ length: limits.artifacts }, (_, index) =>
            journal.saveArtifact({
              jobID: "job_test",
              id: `art_${index}`,
              metadata: { name: `artifact-${index}`, secret: "omit" },
            }),
          ),
        )
        expect(artifacts.every((item) => item === "saved")).toBe(true)
        expect(yield* journal.saveArtifact({ jobID: "job_test", id: "art_over", metadata: { name: "over" } })).toBe(
          "quota",
        )
        yield* journal.preparePlan({ token: "prp_one", jobID: "job_test", planID: "pln_one", digest: "hash", now: 10 })
        expect(yield* journal.consumePlan({ token: "prp_one", digest: "hash", now: 11 })).toBe("consumed")
        expect(yield* journal.consumePlan({ token: "prp_one", digest: "hash", now: 12 })).toBe("used")
        yield* journal.preparePlan({
          token: "prp_expired",
          jobID: "job_test",
          planID: "pln_one",
          digest: "hash",
          now: 10,
        })
        expect(yield* journal.consumePlan({ token: "prp_expired", digest: "hash", now: 10 + limits.tokenTTL })).toBe(
          "expired",
        )
      }),
    )
  })
})
