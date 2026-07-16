export * as PermissionSaved from "./saved"

import { and, eq, type SQL } from "drizzle-orm"
import { Context, Effect, Layer, Schema } from "effect"
import { Database } from "../database/database"
import { LayerNode } from "../effect/layer-node"
import { ProjectV2 } from "../project"
import { ProjectTable } from "../project/sql"
import { AbsolutePath, withStatics } from "../schema"
import { SessionSchema } from "../session/schema"
import { SessionTable } from "../session/sql"
import { Identifier } from "../util/identifier"
import { PermissionTable } from "./sql"

export const ID = Schema.String.pipe(
  Schema.brand("PermissionSaved.ID"),
  withStatics((schema) => ({ create: () => schema.make("psv_" + Identifier.ascending()) })),
)
export type ID = typeof ID.Type

export const Scope = Schema.Literals(["project", "session", "global"]).annotate({
  identifier: "PermissionSaved.Scope",
})
export type Scope = typeof Scope.Type

export const Match = Schema.Literals(["pattern", "exact"]).annotate({ identifier: "PermissionSaved.Match" })
export type Match = typeof Match.Type

export const Info = Schema.Struct({
  id: ID,
  projectID: ProjectV2.ID,
  sessionID: SessionSchema.ID.pipe(Schema.optional),
  scope: Scope,
  match: Match,
  action: Schema.String,
  resource: Schema.String,
}).annotate({ identifier: "PermissionSaved.Info" })
export type Info = typeof Info.Type

export const ListInput = Schema.Struct({
  projectID: ProjectV2.ID.pipe(Schema.optional),
  sessionID: SessionSchema.ID.pipe(Schema.optional),
  scope: Scope.pipe(Schema.optional),
}).annotate({ identifier: "PermissionSaved.ListInput" })
export type ListInput = typeof ListInput.Type

const Entries = Schema.Array(
  Schema.Struct({
    action: Schema.String,
    resources: Schema.Array(Schema.String),
  }),
)

export const AddBatchInput = Schema.Union([
  Schema.Struct({ scope: Schema.Literal("project"), projectID: ProjectV2.ID, entries: Entries }),
  Schema.Struct({ scope: Schema.Literal("session"), sessionID: SessionSchema.ID, entries: Entries }),
  Schema.Struct({ scope: Schema.Literal("global"), entries: Entries }),
]).annotate({ identifier: "PermissionSaved.AddBatchInput" })
export type AddBatchInput = typeof AddBatchInput.Type

export const AddInput = Schema.Union([
  Schema.Struct({
    scope: Schema.Literal("project"),
    projectID: ProjectV2.ID,
    action: Schema.String,
    resources: Schema.Array(Schema.String),
  }),
  Schema.Struct({
    scope: Schema.Literal("session"),
    sessionID: SessionSchema.ID,
    action: Schema.String,
    resources: Schema.Array(Schema.String),
  }),
  Schema.Struct({
    scope: Schema.Literal("global"),
    action: Schema.String,
    resources: Schema.Array(Schema.String),
  }),
]).annotate({ identifier: "PermissionSaved.AddInput" })
export type AddInput = typeof AddInput.Type

export const SelectInput = Schema.Union([
  Schema.Struct({ scope: Schema.Literal("project"), projectID: ProjectV2.ID }),
  Schema.Struct({ scope: Schema.Literal("session"), sessionID: SessionSchema.ID }),
  Schema.Struct({ scope: Schema.Literal("global") }),
]).annotate({ identifier: "PermissionSaved.SelectInput" })
export type SelectInput = typeof SelectInput.Type

export interface Interface {
  readonly list: (input?: ListInput) => Effect.Effect<ReadonlyArray<Info>>
  readonly add: (input: AddInput) => Effect.Effect<void>
  readonly addBatch: (input: AddBatchInput) => Effect.Effect<void>
  readonly remove: (input: SelectInput & { id: ID }) => Effect.Effect<boolean>
  readonly clear: (input: SelectInput) => Effect.Effect<number>
}

export class Service extends Context.Service<Service, Interface>()("@slopcode/v2/PermissionSaved") {}

function selected(input: SelectInput) {
  if (input.scope === "project")
    return and(eq(PermissionTable.scope, input.scope), eq(PermissionTable.project_id, input.projectID))
  if (input.scope === "session")
    return and(eq(PermissionTable.scope, input.scope), eq(PermissionTable.session_id, input.sessionID))
  return eq(PermissionTable.scope, input.scope)
}

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const { db } = yield* Database.Service

    const list = Effect.fn("PermissionSaved.list")(function* (input?: ListInput) {
      const filters: SQL[] = []
      if (input?.projectID) filters.push(eq(PermissionTable.project_id, input.projectID))
      if (input?.sessionID) filters.push(eq(PermissionTable.session_id, input.sessionID))
      if (input?.scope) filters.push(eq(PermissionTable.scope, input.scope))
      const rows = yield* db
        .select()
        .from(PermissionTable)
        .where(filters.length ? and(...filters) : undefined)
        .all()
        .pipe(Effect.orDie)
      return rows.map(
        (row): Info => ({
          id: row.id,
          projectID: row.project_id,
          ...(row.session_id ? { sessionID: row.session_id } : {}),
          scope: row.scope,
          match: row.match,
          action: row.action,
          resource: row.resource,
        }),
      )
    })

    const addBatch = Effect.fn("PermissionSaved.addBatch")(function* (input: AddBatchInput) {
      const entries = Array.from(
        new Map(
          input.entries
            .flatMap((entry) => entry.resources.map((resource) => ({ action: entry.action, resource })))
            .map((item) => [JSON.stringify([item.action, item.resource]), item]),
        ).values(),
      )
      if (!entries.length) return
      yield* db
        .transaction((tx) =>
          Effect.gen(function* () {
            if (input.scope === "global")
              yield* tx
                .insert(ProjectTable)
                .values({ id: ProjectV2.ID.global, worktree: AbsolutePath.make("/"), sandboxes: [] })
                .onConflictDoNothing()
                .run()
            const session =
              input.scope === "session"
                ? yield* tx.select().from(SessionTable).where(eq(SessionTable.id, input.sessionID)).get()
                : undefined
            if (input.scope === "session" && !session) return yield* Effect.die(`Session not found: ${input.sessionID}`)
            const projectID =
              input.scope === "global"
                ? ProjectV2.ID.global
                : input.scope === "session"
                  ? session!.project_id
                  : input.projectID
            yield* tx
              .insert(PermissionTable)
              .values(
                entries.map((item) => ({
                  id: ID.create(),
                  project_id: projectID,
                  session_id: input.scope === "session" ? input.sessionID : null,
                  scope: input.scope,
                  match: input.scope === "project" ? ("pattern" as const) : ("exact" as const),
                  action: item.action,
                  resource: item.resource,
                })),
              )
              .onConflictDoNothing()
              .run()
          }),
        )
        .pipe(Effect.orDie)
    })

    const add = Effect.fn("PermissionSaved.add")(function* (input: AddInput) {
      const entries = [{ action: input.action, resources: input.resources }]
      if (input.scope === "project") return yield* addBatch({ scope: input.scope, projectID: input.projectID, entries })
      if (input.scope === "session") return yield* addBatch({ scope: input.scope, sessionID: input.sessionID, entries })
      return yield* addBatch({ scope: input.scope, entries })
    })

    const remove = Effect.fn("PermissionSaved.remove")(function* (input: SelectInput & { id: ID }) {
      const rows = yield* db
        .delete(PermissionTable)
        .where(and(eq(PermissionTable.id, input.id), selected(input)))
        .returning({ id: PermissionTable.id })
        .all()
        .pipe(Effect.orDie)
      return rows.length > 0
    })

    const clear = Effect.fn("PermissionSaved.clear")(function* (input: SelectInput) {
      const rows = yield* db
        .delete(PermissionTable)
        .where(selected(input))
        .returning({ id: PermissionTable.id })
        .all()
        .pipe(Effect.orDie)
      return rows.length
    })

    return Service.of({ list, add, addBatch, remove, clear })
  }),
)

export const defaultLayer = layer.pipe(Layer.provide(Database.defaultLayer))

export const node = LayerNode.make(layer, [Database.node])
