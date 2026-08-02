import { Database } from "@slopcode-ai/core/database/database"
import {
  MAX_REMOTE_JOB_EVENTS,
  RemoteAgentConfig,
  RemoteAgentJobEvent,
  RemoteAgentJobState,
} from "../groups/remote-runtime"
import { Context, Effect, Layer } from "effect"
import { sql, type SQLWrapper } from "drizzle-orm"

type State = typeof RemoteAgentJobState.Type
type Event = typeof RemoteAgentJobEvent.Type
type Config = typeof RemoteAgentConfig.Type
type Connection = Parameters<Parameters<Database.Interface["db"]["transaction"]>[0]>[0]
type Query = SQLWrapper | string
type SafeConnection = {
  readonly run: (query: Query) => Effect.Effect<unknown>
  readonly get: <A>(query: Query) => Effect.Effect<A | undefined>
  readonly all: <A>(query: Query) => Effect.Effect<A[]>
}

export const limits = {
  eventBytes: 256 * 1024,
  stateBytes: 1024 * 1024,
  artifacts: 64,
  tokenTTL: 5 * 60 * 1000,
  idempotencyTTL: 24 * 60 * 60 * 1000,
} as const

export type Job = {
  readonly state: State
  readonly root: string
  readonly config?: Config
  readonly fingerprint: string
  readonly idempotencyKey?: string
}

export type Interaction = {
  readonly id: string
  readonly kind: "approval" | "question"
  readonly revision: number
  readonly status: "pending" | "in_flight" | "resolved"
  readonly payload: Record<string, unknown>
  readonly resolution?: Record<string, unknown>
}

export class JobNotFoundError extends Error {
  readonly _tag = "RemoteAgentJournalJobNotFoundError"

  constructor(readonly jobID: string) {
    super(`Remote agent job not found: ${jobID}`)
  }
}

function encoded(value: unknown, limit: number) {
  const json = JSON.stringify(value)
  if (!json || Buffer.byteLength(json) > limit) return
  return json
}

function json<T>(value: string) {
  return JSON.parse(value) as T
}

function cursor(value: string | undefined) {
  if (!value || !/^\d+$/.test(value)) return
  return Number(value)
}

function event(row: { id: string; sequence: number; job_id: string; type: string; data: string }): Event {
  return { id: row.id, cursor: String(row.sequence), jobID: row.job_id, type: row.type, data: json(row.data) }
}

function job(row: { state: string; root: string; config: string | null; fingerprint: string }): Job {
  return {
    state: json<State>(row.state),
    root: row.root,
    ...(row.config ? { config: json<Config>(row.config) } : {}),
    fingerprint: row.fingerprint,
  }
}

function safe(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(safe)
  if (typeof value !== "object" || value === null) return value
  return Object.fromEntries(
    Object.entries(value).flatMap(([key, item]) =>
      /(?:password|passphrase|private[-_]?key|api[-_]?key|secret|token|authorization|cookie|credential)/i.test(key)
        ? []
        : [[key, safe(item)]],
    ),
  )
}

function queries(tx: Connection): SafeConnection {
  return {
    run: (query: Query) => tx.run(query).pipe(Effect.orDie),
    get: <A>(query: Query) => tx.get<A>(query).pipe(Effect.orDie),
    all: <A>(query: Query) => tx.all<A>(query).pipe(Effect.orDie),
  }
}

export interface Interface {
  readonly start: (
    input: Job & { readonly now?: number },
  ) => Effect.Effect<{ readonly type: "created" | "duplicate" | "conflict"; readonly job: Job }>
  readonly list: () => Effect.Effect<Job[]>
  readonly get: (jobID: string) => Effect.Effect<Job | undefined>
  readonly failStart: (input: {
    readonly jobID: string
    readonly message: string
  }) => Effect.Effect<State, JobNotFoundError>
  readonly append: (input: {
    readonly jobID: string
    readonly id: string
    readonly type: string
    readonly data: Event["data"]
    readonly reduce: (state: State, event: Event) => State
    readonly interaction?: {
      readonly id: string
      readonly kind: "approval" | "question"
      readonly payload: Record<string, unknown>
    }
    readonly completion?: { readonly id: string; readonly revision: number; readonly digest: string }
  }) => Effect.Effect<{ readonly state: State; readonly event: Event }, JobNotFoundError>
  readonly replay: (input: {
    readonly jobID: string
    readonly cursor?: string
  }) => Effect.Effect<
    | { readonly type: "events"; readonly events: Event[] }
    | { readonly type: "snapshot_required"; readonly state: State; readonly cursor: string },
    JobNotFoundError
  >
  readonly createInteraction: (input: {
    readonly jobID: string
    readonly id: string
    readonly kind: "approval" | "question"
    readonly payload: Record<string, unknown>
  }) => Effect.Effect<Interaction, JobNotFoundError>
  readonly beginInteraction: (input: {
    readonly jobID: string
    readonly id: string
    readonly revision: number
    readonly digest: string
  }) => Effect.Effect<{
    readonly type: "deliver" | "duplicate" | "stale" | "conflict" | "missing"
    readonly interaction?: Interaction
  }>
  readonly saveArtifact: (input: {
    readonly jobID: string
    readonly id: string
    readonly metadata: Record<string, unknown>
  }) => Effect.Effect<"saved" | "duplicate" | "quota", JobNotFoundError>
  readonly artifacts: (jobID: string) => Effect.Effect<Record<string, unknown>[], JobNotFoundError>
  readonly preparePlan: (input: {
    readonly token: string
    readonly jobID: string
    readonly planID: string
    readonly digest: string
    readonly now?: number
  }) => Effect.Effect<void, JobNotFoundError>
  readonly consumePlan: (input: {
    readonly token: string
    readonly jobID: string
    readonly digest: string
    readonly now?: number
  }) => Effect.Effect<"consumed" | "expired" | "used" | "conflict" | "missing">
}

export class Service extends Context.Service<Service, Interface>()("@slopcode/RemoteAgentJournal") {}

function tables(db: Database.Interface["db"]) {
  return Effect.all([
    db.run(sql`CREATE TABLE IF NOT EXISTS remote_agent_job (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      root TEXT NOT NULL,
      directory TEXT NOT NULL,
      agent TEXT NOT NULL,
      backend_session_id TEXT,
      state TEXT NOT NULL,
      config TEXT,
      fingerprint TEXT NOT NULL,
      terminal_outcome TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )`),
    db.run(sql`CREATE TABLE IF NOT EXISTS remote_agent_event (
      job_id TEXT NOT NULL,
      sequence INTEGER NOT NULL,
      id TEXT NOT NULL,
      type TEXT NOT NULL,
      data TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      PRIMARY KEY (job_id, sequence),
      UNIQUE (id)
    )`),
    db.run(sql`CREATE INDEX IF NOT EXISTS remote_agent_event_tail ON remote_agent_event (job_id, sequence)`),
    db.run(sql`CREATE TABLE IF NOT EXISTS remote_agent_idempotency (
      scope TEXT NOT NULL,
      key TEXT NOT NULL,
      digest TEXT NOT NULL,
      result TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      PRIMARY KEY (scope, key)
    )`),
    db.run(sql`CREATE TABLE IF NOT EXISTS remote_agent_interaction (
      job_id TEXT NOT NULL,
      id TEXT NOT NULL,
      kind TEXT NOT NULL,
      revision INTEGER NOT NULL,
      status TEXT NOT NULL,
      payload TEXT NOT NULL,
      resolution TEXT,
      digest TEXT,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (job_id, id)
    )`),
    db.run(sql`CREATE TABLE IF NOT EXISTS remote_agent_artifact (
      job_id TEXT NOT NULL,
      id TEXT NOT NULL,
      metadata TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      PRIMARY KEY (job_id, id)
    )`),
    db.run(sql`CREATE TABLE IF NOT EXISTS remote_agent_plan_token (
      token TEXT PRIMARY KEY,
      job_id TEXT NOT NULL,
      plan_id TEXT NOT NULL,
      digest TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      consumed_at INTEGER
    )`),
  ]).pipe(Effect.asVoid)
}

function find(tx: SafeConnection, id: string) {
  return tx.get<{ state: string; root: string; config: string | null; fingerprint: string }>(
    sql`SELECT state, root, config, fingerprint FROM remote_agent_job WHERE id = ${id}`,
  )
}

function interaction(row: {
  id: string
  kind: "approval" | "question"
  revision: number
  status: "pending" | "in_flight" | "resolved"
  payload: string
  resolution: string | null
}): Interaction {
  return {
    id: row.id,
    kind: row.kind,
    revision: row.revision,
    status: row.status,
    payload: json(row.payload),
    ...(row.resolution ? { resolution: json(row.resolution) } : {}),
  }
}

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const { db } = yield* Database.Service
    yield* tables(db)
    const atomic = <A, E>(effect: (tx: SafeConnection) => Effect.gen.Return<A, E, never>) =>
      db
        .transaction((tx) => Effect.gen(() => effect(queries(tx))), { behavior: "immediate" })
        .pipe(Effect.catchTag("SqlError", (error) => Effect.die(error)))

    const start: Interface["start"] = (input) =>
      atomic(function* (tx) {
        const now = input.now ?? Date.now()
        const state = encoded(input.state, limits.stateBytes)
        if (!state) return { type: "conflict" as const, job: input }
        const config = input.config && encoded(input.config, 16 * 1024)
        const scope = `${input.state.workspaceID}:${input.root}`
        const key = input.idempotencyKey ?? input.state.id
        yield* tx.run(sql`DELETE FROM remote_agent_idempotency WHERE expires_at <= ${now}`)
        const claim = yield* tx.get<{ digest: string; result: string }>(
          sql`SELECT digest, result FROM remote_agent_idempotency WHERE scope = ${scope} AND key = ${key}`,
        )
        if (claim) {
          const stored = yield* find(tx, claim.result)
          if (stored)
            return {
              type: claim.digest === input.fingerprint ? ("duplicate" as const) : ("conflict" as const),
              job: job(stored),
            }
        }
        const current = yield* find(tx, input.state.id)
        if (current) {
          const stored = job(current)
          return {
            type: stored.fingerprint === input.fingerprint ? ("duplicate" as const) : ("conflict" as const),
            job: stored,
          }
        }
        yield* tx.run(sql`INSERT INTO remote_agent_job (
          id, workspace_id, root, directory, agent, backend_session_id, state, config, fingerprint, created_at, updated_at
        ) VALUES (
          ${input.state.id}, ${input.state.workspaceID}, ${input.root}, ${input.state.directory}, ${input.state.agent},
          ${input.state.sessionID ?? null}, ${state}, ${config ?? null}, ${input.fingerprint}, ${now}, ${now}
        )`)
        yield* tx.run(sql`INSERT INTO remote_agent_idempotency (scope, key, digest, result, expires_at)
          VALUES (${scope}, ${key}, ${input.fingerprint}, ${input.state.id}, ${now + limits.idempotencyTTL})`)
        return { type: "created" as const, job: input }
      })

    const get: Interface["get"] = (id) =>
      db
        .get<{
          state: string
          root: string
          config: string | null
          fingerprint: string
        }>(sql`SELECT state, root, config, fingerprint FROM remote_agent_job WHERE id = ${id}`)
        .pipe(Effect.orDie)
        .pipe(Effect.map((row) => (row ? job(row) : undefined)))

    const failStart: Interface["failStart"] = (input) =>
      atomic(function* (tx) {
        const current = yield* find(tx, input.jobID)
        if (!current) return yield* Effect.fail(new JobNotFoundError(input.jobID))
        const state = { ...job(current).state, status: "failed" as const, error: input.message, updatedAt: Date.now() }
        const stored = encoded(state, limits.stateBytes)
        if (!stored) return yield* Effect.die(new Error("remote agent snapshot exceeds durable retention limit"))
        yield* tx.run(sql`UPDATE remote_agent_job SET state = ${stored}, terminal_outcome = 'failed', updated_at = ${Date.now()}
          WHERE id = ${input.jobID}`)
        return state
      })

    const list: Interface["list"] = () =>
      db
        .all<{
          state: string
          root: string
          config: string | null
          fingerprint: string
        }>(sql`SELECT state, root, config, fingerprint FROM remote_agent_job ORDER BY updated_at`)
        .pipe(Effect.orDie)
        .pipe(Effect.map((rows) => rows.map(job)))

    const append: Interface["append"] = (input) =>
      atomic(function* (tx) {
        const current = yield* find(tx, input.jobID)
        if (!current) return yield* Effect.fail(new JobNotFoundError(input.jobID))
        const last = yield* tx.get<{ sequence: number }>(
          sql`SELECT sequence FROM remote_agent_event WHERE job_id = ${input.jobID} ORDER BY sequence DESC LIMIT 1`,
        )
        const next = (last?.sequence ?? 0) + 1
        const prior = input.interaction
          ? yield* tx.get<{ revision: number }>(
              sql`SELECT revision FROM remote_agent_interaction WHERE job_id = ${input.jobID} AND id = ${input.interaction.id}`,
            )
          : undefined
        const revision = (prior?.revision ?? 0) + 1
        const values = safe(input.data) as Event["data"]
        const candidate = {
          id: input.id,
          cursor: String(next),
          jobID: input.jobID,
          type: input.type,
          data: {
            ...values,
            ...(input.interaction?.kind === "approval" && values.approval
              ? { approval: { ...values.approval, revision } }
              : {}),
            ...(input.interaction?.kind === "question" && values.question
              ? { question: { ...values.question, revision } }
              : {}),
          },
        } satisfies Event
        if (input.completion) {
          const current = yield* tx.get<{ revision: number; status: string; digest: string | null }>(
            sql`SELECT revision, status, digest FROM remote_agent_interaction WHERE job_id = ${input.jobID} AND id = ${input.completion.id}`,
          )
          if (
            !current ||
            current.status !== "in_flight" ||
            current.revision !== input.completion.revision ||
            current.digest !== input.completion.digest
          )
            return yield* Effect.die(new Error("remote agent interaction delivery is no longer pending"))
        }
        const data = encoded(candidate.data, limits.eventBytes)
        if (!data) return yield* Effect.die(new Error("remote agent event exceeds durable retention limit"))
        const state = input.reduce(job(current).state, candidate)
        const stored = encoded(state, limits.stateBytes)
        if (!stored) return yield* Effect.die(new Error("remote agent snapshot exceeds durable retention limit"))
        const now = Date.now()
        yield* tx.run(sql`INSERT INTO remote_agent_event (job_id, sequence, id, type, data, created_at)
          VALUES (${input.jobID}, ${next}, ${input.id}, ${input.type}, ${data}, ${now})`)
        yield* tx.run(sql`DELETE FROM remote_agent_event
          WHERE job_id = ${input.jobID} AND sequence <= ${next - MAX_REMOTE_JOB_EVENTS}`)
        if (input.interaction) {
          const payload = encoded(safe(input.interaction.payload), 64 * 1024)
          if (!payload) return yield* Effect.die(new Error("remote agent interaction exceeds retention limit"))
          yield* tx.run(sql`INSERT INTO remote_agent_interaction (
            job_id, id, kind, revision, status, payload, updated_at
          ) VALUES (${input.jobID}, ${input.interaction.id}, ${input.interaction.kind}, ${revision}, 'pending', ${payload}, ${now})
          ON CONFLICT(job_id, id) DO UPDATE SET kind = excluded.kind, revision = excluded.revision,
            status = 'pending', payload = excluded.payload, resolution = NULL, digest = NULL, updated_at = excluded.updated_at`)
        }
        if (input.completion)
          yield* tx.run(sql`UPDATE remote_agent_interaction SET status = 'resolved', revision = revision + 1, updated_at = ${now}
            WHERE job_id = ${input.jobID} AND id = ${input.completion.id} AND revision = ${input.completion.revision}
              AND status = 'in_flight' AND digest = ${input.completion.digest}`)
        yield* tx.run(sql`UPDATE remote_agent_job SET state = ${stored}, backend_session_id = ${state.sessionID ?? null},
          terminal_outcome = ${["completed", "failed", "stopped"].includes(state.status) ? state.status : null}, updated_at = ${now}
          WHERE id = ${input.jobID}`)
        return { state, event: candidate }
      })

    const replay: Interface["replay"] = (input) =>
      atomic(function* (tx) {
        const current = yield* find(tx, input.jobID)
        if (!current) return yield* Effect.fail(new JobNotFoundError(input.jobID))
        const after = cursor(input.cursor)
        const first = yield* tx.get<{ sequence: number }>(
          sql`SELECT sequence FROM remote_agent_event WHERE job_id = ${input.jobID} ORDER BY sequence LIMIT 1`,
        )
        if (after !== undefined && first && after < first.sequence - 1) {
          return { type: "snapshot_required" as const, state: job(current).state, cursor: String(first.sequence - 1) }
        }
        const events = yield* tx.all<{ id: string; sequence: number; job_id: string; type: string; data: string }>(
          sql`SELECT id, sequence, job_id, type, data FROM remote_agent_event
            WHERE job_id = ${input.jobID} AND sequence > ${after ?? 0} ORDER BY sequence`,
        )
        return { type: "events" as const, events: events.map(event) }
      })

    const createInteraction: Interface["createInteraction"] = (input) =>
      atomic(function* (tx) {
        if (!(yield* find(tx, input.jobID))) return yield* Effect.fail(new JobNotFoundError(input.jobID))
        const payload = encoded(safe(input.payload), 64 * 1024)
        if (!payload) return yield* Effect.die(new Error("remote agent interaction exceeds retention limit"))
        const current = yield* tx.get<{
          id: string
          kind: "approval" | "question"
          revision: number
          status: "pending" | "resolved"
          payload: string
          resolution: string | null
        }>(
          sql`SELECT id, kind, revision, status, payload, resolution FROM remote_agent_interaction WHERE job_id = ${input.jobID} AND id = ${input.id}`,
        )
        if (current) return interaction(current)
        yield* tx.run(sql`INSERT INTO remote_agent_interaction (job_id, id, kind, revision, status, payload, updated_at)
          VALUES (${input.jobID}, ${input.id}, ${input.kind}, 1, 'pending', ${payload}, ${Date.now()})`)
        return { id: input.id, kind: input.kind, revision: 1, status: "pending", payload: json(payload) }
      })

    const beginInteraction: Interface["beginInteraction"] = (input) =>
      atomic(function* (tx) {
        const current = yield* tx.get<{
          id: string
          kind: "approval" | "question"
          revision: number
          status: "pending" | "in_flight" | "resolved"
          payload: string
          resolution: string | null
          digest: string | null
        }>(
          sql`SELECT id, kind, revision, status, payload, resolution, digest FROM remote_agent_interaction WHERE job_id = ${input.jobID} AND id = ${input.id}`,
        )
        if (!current) return { type: "missing" as const }
        if (current.status === "resolved")
          return {
            type: current.digest === input.digest ? ("duplicate" as const) : ("conflict" as const),
            interaction: interaction(current),
          }
        if (current.revision !== input.revision) return { type: "stale" as const, interaction: interaction(current) }
        if (current.status === "in_flight")
          return {
            type: current.digest === input.digest ? ("deliver" as const) : ("conflict" as const),
            interaction: interaction(current),
          }
        yield* tx.run(sql`UPDATE remote_agent_interaction SET status = 'in_flight', digest = ${input.digest}, updated_at = ${Date.now()}
          WHERE job_id = ${input.jobID} AND id = ${input.id} AND revision = ${input.revision} AND status = 'pending'`)
        return { type: "deliver" as const, interaction: { ...interaction(current), status: "in_flight" } }
      })

    const saveArtifact: Interface["saveArtifact"] = (input) =>
      atomic(function* (tx) {
        if (!(yield* find(tx, input.jobID))) return yield* Effect.fail(new JobNotFoundError(input.jobID))
        const exists = yield* tx.get(
          sql`SELECT id FROM remote_agent_artifact WHERE job_id = ${input.jobID} AND id = ${input.id}`,
        )
        if (exists) return "duplicate" as const
        const count = yield* tx.get<{ count: number }>(
          sql`SELECT count(*) as count FROM remote_agent_artifact WHERE job_id = ${input.jobID}`,
        )
        if ((count?.count ?? 0) >= limits.artifacts) return "quota" as const
        const metadata = encoded(safe(input.metadata), 16 * 1024)
        if (!metadata) return "quota" as const
        yield* tx.run(sql`INSERT INTO remote_agent_artifact (job_id, id, metadata, created_at)
          VALUES (${input.jobID}, ${input.id}, ${metadata}, ${Date.now()})`)
        return "saved" as const
      })

    const artifacts: Interface["artifacts"] = (jobID) =>
      Effect.gen(function* () {
        if (!(yield* db.get(sql`SELECT id FROM remote_agent_job WHERE id = ${jobID}`).pipe(Effect.orDie)))
          return yield* Effect.fail(new JobNotFoundError(jobID))
        return (yield* db
          .all<{ metadata: string }>(
            sql`SELECT metadata FROM remote_agent_artifact WHERE job_id = ${jobID} ORDER BY created_at, id`,
          )
          .pipe(Effect.orDie)).map((item) => json<Record<string, unknown>>(item.metadata))
      })

    const preparePlan: Interface["preparePlan"] = (input) =>
      atomic(function* (tx) {
        if (!(yield* find(tx, input.jobID))) return yield* Effect.fail(new JobNotFoundError(input.jobID))
        const now = input.now ?? Date.now()
        yield* tx.run(sql`DELETE FROM remote_agent_plan_token WHERE expires_at <= ${now} OR consumed_at IS NOT NULL`)
        yield* tx.run(sql`INSERT INTO remote_agent_plan_token (token, job_id, plan_id, digest, expires_at)
          VALUES (${input.token}, ${input.jobID}, ${input.planID}, ${input.digest}, ${now + limits.tokenTTL})`)
      })

    const consumePlan: Interface["consumePlan"] = (input) =>
      atomic(function* (tx) {
        const now = input.now ?? Date.now()
        const current = yield* tx.get<{
          job_id: string
          digest: string
          expires_at: number
          consumed_at: number | null
        }>(
          sql`SELECT job_id, digest, expires_at, consumed_at FROM remote_agent_plan_token WHERE token = ${input.token}`,
        )
        if (!current) return "missing" as const
        if (current.job_id !== input.jobID) return "conflict" as const
        if (current.expires_at <= now) return "expired" as const
        if (current.consumed_at !== null) return "used" as const
        if (current.digest !== input.digest) return "conflict" as const
        yield* tx.run(sql`UPDATE remote_agent_plan_token SET consumed_at = ${now}
          WHERE token = ${input.token} AND consumed_at IS NULL AND expires_at > ${now}`)
        return "consumed" as const
      })

    return Service.of({
      start,
      list,
      get,
      failStart,
      append,
      replay,
      createInteraction,
      beginInteraction,
      saveArtifact,
      artifacts,
      preparePlan,
      consumePlan,
    })
  }),
)
