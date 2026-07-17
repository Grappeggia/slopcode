export * as PermissionSaved from "./saved"

import { and, eq, type SQL } from "drizzle-orm"
import { Context, Effect, Layer, Schema } from "effect"
import { Database } from "../database/database"
import { LayerNode } from "../effect/layer-node"
import { FSUtil } from "../fs-util"
import type { Location } from "../location"
import { ProjectV2 } from "../project"
import { ProjectTable } from "../project/sql"
import { AbsolutePath, withStatics } from "../schema"
import { SessionSchema } from "../session/schema"
import { SessionTable } from "../session/sql"
import { Identifier } from "../util/identifier"
import { Hash } from "../util/hash"
import { PermissionTable } from "./sql"

export const ID = Schema.String.pipe(
  Schema.brand("PermissionSaved.ID"),
  withStatics((schema) => ({ create: () => schema.make("psv_" + Identifier.ascending()) })),
)
export type ID = typeof ID.Type

export const DirectoryID = Schema.String.pipe(
  Schema.check(
    Schema.makeFilter((value) =>
      /^[0-9a-f]{64}$/.test(value) ? undefined : "Expected a lowercase 64-character SHA-256 value",
    ),
  ),
  Schema.brand("PermissionSaved.DirectoryID"),
  withStatics((schema) => ({ create: (directory: string) => schema.make(Hash.sha256(FSUtil.resolve(directory))) })),
)
export type DirectoryID = typeof DirectoryID.Type

export const Scope = Schema.Literals(["project", "session", "global", "directory"]).annotate({
  identifier: "PermissionSaved.Scope",
})
export type Scope = typeof Scope.Type

export const Match = Schema.Literals(["pattern", "exact"]).annotate({ identifier: "PermissionSaved.Match" })
export type Match = typeof Match.Type

export const Info = Schema.Struct({
  id: ID,
  projectID: ProjectV2.ID,
  sessionID: SessionSchema.ID.pipe(Schema.optional),
  directoryID: DirectoryID.pipe(Schema.optional),
  scope: Scope,
  match: Match,
  action: Schema.String,
  resource: Schema.String,
})
  .check(
    Schema.makeFilter((value) => {
      if (value.scope === "project")
        return value.match === "pattern" && value.sessionID === undefined && value.directoryID === undefined
          ? undefined
          : "Invalid project permission"
      if (value.scope === "global")
        return value.match === "exact" &&
          value.sessionID === undefined &&
          value.directoryID === undefined &&
          value.projectID === ProjectV2.ID.global
          ? undefined
          : "Invalid global permission"
      if (value.scope === "directory")
        return value.match === "pattern" &&
          value.sessionID === undefined &&
          value.directoryID !== undefined &&
          value.projectID === ProjectV2.ID.global
          ? undefined
          : "Invalid directory permission"
      return value.match === "exact" && value.sessionID !== undefined && value.directoryID === undefined
        ? undefined
        : "Invalid session permission"
    }),
  )
  .annotate({ identifier: "PermissionSaved.Info" })
export type Info = typeof Info.Type

export const ListInput = Schema.Struct({
  projectID: ProjectV2.ID.pipe(Schema.optional),
  sessionID: SessionSchema.ID.pipe(Schema.optional),
  directoryID: DirectoryID.pipe(Schema.optional),
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
  Schema.Struct({ scope: Schema.Literal("directory"), directoryID: DirectoryID, entries: Entries }),
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
    scope: Schema.Literal("directory"),
    directoryID: DirectoryID,
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
  Schema.Struct({ scope: Schema.Literal("directory"), directoryID: DirectoryID }),
]).annotate({ identifier: "PermissionSaved.SelectInput" })
export type SelectInput = typeof SelectInput.Type

export interface Interface {
  readonly list: (input?: ListInput) => Effect.Effect<ReadonlyArray<Info>>
  readonly add: (input: AddInput) => Effect.Effect<void>
  readonly addBatch: (input: AddBatchInput) => Effect.Effect<void>
  readonly remove: (input: SelectInput & { id: ID }) => Effect.Effect<boolean>
  readonly clear: (input: SelectInput) => Effect.Effect<number>
  readonly listCurrent: (
    location: Pick<Location.Interface, "directory" | "project" | "vcs">,
  ) => Effect.Effect<ReadonlyArray<Info>>
  readonly removeCurrent: (input: {
    id: ID
    location: Pick<Location.Interface, "directory" | "project" | "vcs">
  }) => Effect.Effect<boolean>
}

export class Service extends Context.Service<Service, Interface>()("@slopcode/v2/PermissionSaved") {}

function selected(input: SelectInput) {
  if (input.scope === "project")
    return and(eq(PermissionTable.scope, input.scope), eq(PermissionTable.project_id, input.projectID))
  if (input.scope === "session")
    return and(eq(PermissionTable.scope, input.scope), eq(PermissionTable.session_id, input.sessionID))
  if (input.scope === "directory")
    return and(eq(PermissionTable.scope, input.scope), eq(PermissionTable.directory_id, input.directoryID))
  return eq(PermissionTable.scope, input.scope)
}

export function current(
  location: Pick<Location.Interface, "directory" | "project" | "vcs">,
): Extract<SelectInput, { scope: "project" | "directory" }> {
  if (location.vcs?.type === "git" && location.project.id !== ProjectV2.ID.global)
    return { scope: "project", projectID: location.project.id }
  return { scope: "directory", directoryID: DirectoryID.create(location.directory) }
}

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const { db } = yield* Database.Service

    const list = Effect.fn("PermissionSaved.list")(function* (input?: ListInput) {
      const filters: SQL[] = []
      if (input?.projectID) filters.push(eq(PermissionTable.project_id, input.projectID))
      if (input?.sessionID) filters.push(eq(PermissionTable.session_id, input.sessionID))
      if (input?.directoryID) filters.push(eq(PermissionTable.directory_id, input.directoryID))
      if (input?.scope) filters.push(eq(PermissionTable.scope, input.scope))
      const rows = yield* db
        .select({
          row: PermissionTable,
          owner: SessionTable.project_id,
        })
        .from(PermissionTable)
        .leftJoin(SessionTable, eq(PermissionTable.session_id, SessionTable.id))
        .where(filters.length ? and(...filters) : undefined)
        .all()
        .pipe(Effect.orDie)
      return rows
        .map((item) => ({
          id: item.row.id,
          projectID: item.row.project_id,
          ...(item.row.session_id ? { sessionID: item.row.session_id } : {}),
          ...(item.row.directory_id ? { directoryID: item.row.directory_id } : {}),
          scope: item.row.scope,
          match: item.row.match,
          action: item.row.action,
          resource: item.row.resource,
          owner: item.owner,
        }))
        .filter((item) => Schema.is(Info)(item) && (item.scope !== "session" || item.owner === item.projectID))
        .map(({ owner: _, ...item }) => item)
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
            if (input.scope === "global" || input.scope === "directory")
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
              input.scope === "global" || input.scope === "directory"
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
                  directory_id: input.scope === "directory" ? input.directoryID : null,
                  scope: input.scope,
                  match:
                    input.scope === "project" || input.scope === "directory"
                      ? ("pattern" as const)
                      : ("exact" as const),
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
      if (input.scope === "directory")
        return yield* addBatch({ scope: input.scope, directoryID: input.directoryID, entries })
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

    const listCurrent = Effect.fn("PermissionSaved.listCurrent")(function* (
      location: Pick<Location.Interface, "directory" | "project" | "vcs">,
    ) {
      return yield* list(current(location))
    })

    const removeCurrent = Effect.fn("PermissionSaved.removeCurrent")(function* (input: {
      id: ID
      location: Pick<Location.Interface, "directory" | "project" | "vcs">
    }) {
      return yield* remove({ id: input.id, ...current(input.location) })
    })

    return Service.of({ list, add, addBatch, remove, clear, listCurrent, removeCurrent })
  }),
)

export const defaultLayer = layer.pipe(Layer.provide(Database.defaultLayer))

export const node = LayerNode.make(layer, [Database.node])
