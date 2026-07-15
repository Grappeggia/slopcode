export * as PermissionSaved from "./saved"

import { and, eq } from "drizzle-orm"
import { Context, Effect, Layer, Schema } from "effect"
import { Database } from "../database/database"
import { LayerNode } from "../effect/layer-node"
import { ProjectV2 } from "../project"
import { ProjectTable } from "../project/sql"
import { AbsolutePath, withStatics } from "../schema"
import { Hash } from "../util/hash"
import { Identifier } from "../util/identifier"
import { PermissionTable } from "./sql"

export const ID = Schema.String.pipe(
  Schema.brand("PermissionSaved.ID"),
  withStatics((schema) => ({ create: () => schema.make("psv_" + Identifier.ascending()) })),
)
export type ID = typeof ID.Type

export const Info = Schema.Struct({
  id: ID,
  projectID: ProjectV2.ID,
  action: Schema.String,
  resource: Schema.String,
}).annotate({ identifier: "PermissionSaved.Info" })
export type Info = typeof Info.Type

export const ListInput = Schema.Struct({
  projectID: ProjectV2.ID.pipe(Schema.optional),
}).annotate({ identifier: "PermissionSaved.ListInput" })
export type ListInput = typeof ListInput.Type

export const AddInput = Schema.Struct({
  projectID: ProjectV2.ID,
  action: Schema.String,
  resources: Schema.Array(Schema.String),
}).annotate({ identifier: "PermissionSaved.AddInput" })
export type AddInput = typeof AddInput.Type

export const ScopeInput = Schema.Struct({
  projectID: ProjectV2.ID,
  directory: AbsolutePath,
}).annotate({ identifier: "PermissionSaved.ScopeInput" })
export type ScopeInput = typeof ScopeInput.Type

export function scopeID(input: ScopeInput) {
  if (input.projectID !== ProjectV2.ID.global) return input.projectID
  return ProjectV2.ID.make(Hash.fast(`permission-scope:${input.directory}`))
}

export interface Interface {
  readonly list: (input?: ListInput) => Effect.Effect<ReadonlyArray<Info>>
  readonly scope: (input: ScopeInput) => Effect.Effect<ProjectV2.ID>
  readonly add: (input: AddInput) => Effect.Effect<void>
  readonly remove: (input: { id: ID; projectID: ProjectV2.ID }) => Effect.Effect<boolean>
  readonly clear: (projectID: ProjectV2.ID) => Effect.Effect<number>
}

export class Service extends Context.Service<Service, Interface>()("@slopcode/v2/PermissionSaved") {}

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const { db } = yield* Database.Service

    const list = Effect.fn("PermissionSaved.list")(function* (input?: ListInput) {
      const rows = yield* db
        .select()
        .from(PermissionTable)
        .where(input?.projectID ? eq(PermissionTable.project_id, input.projectID) : undefined)
        .all()
        .pipe(Effect.orDie)
      return rows.map(
        (row): Info => ({ id: row.id, projectID: row.project_id, action: row.action, resource: row.resource }),
      )
    })

    const scope = Effect.fn("PermissionSaved.scope")(function* (input: ScopeInput) {
      const projectID = scopeID(input)
      if (projectID === input.projectID) return projectID
      yield* db
        .insert(ProjectTable)
        .values({ id: projectID, worktree: input.directory, sandboxes: [] })
        .onConflictDoNothing()
        .run()
        .pipe(Effect.orDie)
      return projectID
    })

    const add = Effect.fn("PermissionSaved.add")(function* (input: AddInput) {
      if (!input.resources.length) return
      yield* db
        .insert(PermissionTable)
        .values(
          input.resources.map((resource) => ({
            id: ID.create(),
            project_id: input.projectID,
            action: input.action,
            resource,
          })),
        )
        .onConflictDoNothing()
        .run()
        .pipe(Effect.orDie)
    })

    const remove = Effect.fn("PermissionSaved.remove")(function* (input: { id: ID; projectID: ProjectV2.ID }) {
      const rows = yield* db
        .delete(PermissionTable)
        .where(and(eq(PermissionTable.id, input.id), eq(PermissionTable.project_id, input.projectID)))
        .returning({ id: PermissionTable.id })
        .all()
        .pipe(Effect.orDie)
      return rows.length > 0
    })

    const clear = Effect.fn("PermissionSaved.clear")(function* (projectID: ProjectV2.ID) {
      const rows = yield* db
        .delete(PermissionTable)
        .where(eq(PermissionTable.project_id, projectID))
        .returning({ id: PermissionTable.id })
        .all()
        .pipe(Effect.orDie)
      return rows.length
    })

    return Service.of({ list, scope, add, remove, clear })
  }),
)

export const defaultLayer = layer.pipe(Layer.provide(Database.defaultLayer))

export const node = LayerNode.make(layer, [Database.node])
