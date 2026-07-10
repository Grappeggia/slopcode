export * as SessionRuntime from "./runtime"

import { and, eq, sql } from "drizzle-orm"
import { Context, DateTime, Effect, Layer, Schema } from "effect"
import { Database } from "../database/database"
import { LayerNode } from "../effect/layer-node"
import { NonNegativeInt } from "../schema"
import { V2Schema } from "../v2-schema"
import { SessionSchema } from "./schema"
import { SessionTable } from "./sql"

export const Owner = Schema.Literals(["v1", "v2"])
export type Owner = typeof Owner.Type

export const State = Schema.Literals(["ready", "draining", "migrating", "paused"])
export type State = typeof State.Type

export class Info extends Schema.Class<Info>("SessionRuntime.Info")({
  sessionID: SessionSchema.ID,
  owner: Owner,
  epoch: NonNegativeInt,
  state: State,
  time: Schema.Struct({
    updated: V2Schema.DateTimeUtcFromMillis,
  }),
}) {}

export class NotFound extends Schema.TaggedErrorClass<NotFound>()("SessionRuntime.NotFound", {
  sessionID: SessionSchema.ID,
}) {}

export class Mismatch extends Schema.TaggedErrorClass<Mismatch>()("SessionRuntime.Mismatch", {
  sessionID: SessionSchema.ID,
  expectedOwner: Owner.pipe(Schema.optional),
  actualOwner: Owner,
  expectedEpoch: NonNegativeInt.pipe(Schema.optional),
  actualEpoch: NonNegativeInt,
}) {}

export type Error = NotFound | Mismatch

export interface Interface {
  readonly get: (sessionID: SessionSchema.ID) => Effect.Effect<Info | undefined>
  readonly assert: (input: {
    readonly sessionID: SessionSchema.ID
    readonly owner: Owner
    readonly epoch?: number
  }) => Effect.Effect<Info, Error>
  readonly assign: (input: {
    readonly sessionID: SessionSchema.ID
    readonly owner?: Owner
    readonly state?: State
    readonly expectedOwner?: Owner
    readonly expectedEpoch?: number
  }) => Effect.Effect<Info, Error>
}

export class Service extends Context.Service<Service, Interface>()("@slopcode/v2/SessionRuntime") {}

const info = (row: typeof SessionTable.$inferSelect) =>
  new Info({
    sessionID: SessionSchema.ID.make(row.id),
    owner: row.runtime,
    epoch: row.runtime_epoch,
    state: row.runtime_state,
    time: { updated: DateTime.makeUnsafe(row.time_updated) },
  })

const mismatch = (
  row: typeof SessionTable.$inferSelect,
  expected: { readonly owner?: Owner; readonly epoch?: number },
) =>
  new Mismatch({
    sessionID: SessionSchema.ID.make(row.id),
    expectedOwner: expected.owner,
    actualOwner: row.runtime,
    expectedEpoch: expected.epoch,
    actualEpoch: row.runtime_epoch,
  })

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const db = (yield* Database.Service).db

    const get = Effect.fn("SessionRuntime.get")(function* (sessionID: SessionSchema.ID) {
      const row = yield* db.select().from(SessionTable).where(eq(SessionTable.id, sessionID)).get().pipe(Effect.orDie)
      return row ? info(row) : undefined
    })

    const assert = Effect.fn("SessionRuntime.assert")(function* (input: {
      readonly sessionID: SessionSchema.ID
      readonly owner: Owner
      readonly epoch?: number
    }) {
      const row = yield* db
        .select()
        .from(SessionTable)
        .where(eq(SessionTable.id, input.sessionID))
        .get()
        .pipe(Effect.orDie)
      if (!row) return yield* new NotFound({ sessionID: input.sessionID })
      if (row.runtime !== input.owner || (input.epoch !== undefined && row.runtime_epoch !== input.epoch))
        return yield* mismatch(row, { owner: input.owner, epoch: input.epoch })
      return info(row)
    })

    return Service.of({
      get,
      assert,
      assign: Effect.fn("SessionRuntime.assign")(function* (input) {
        const updated = DateTime.toEpochMillis(yield* DateTime.now)
        const row = yield* db
          .update(SessionTable)
          .set({
            ...(input.owner === undefined ? {} : { runtime: input.owner }),
            ...(input.state === undefined ? {} : { runtime_state: input.state }),
            runtime_epoch: sql`${SessionTable.runtime_epoch} + 1`,
            time_updated: updated,
          })
          .where(
            and(
              eq(SessionTable.id, input.sessionID),
              input.expectedOwner === undefined ? undefined : eq(SessionTable.runtime, input.expectedOwner),
              input.expectedEpoch === undefined ? undefined : eq(SessionTable.runtime_epoch, input.expectedEpoch),
            ),
          )
          .returning()
          .get()
          .pipe(Effect.orDie)
        if (row) return info(row)
        const current = yield* db
          .select()
          .from(SessionTable)
          .where(eq(SessionTable.id, input.sessionID))
          .get()
          .pipe(Effect.orDie)
        if (!current) return yield* new NotFound({ sessionID: input.sessionID })
        return yield* mismatch(current, { owner: input.expectedOwner, epoch: input.expectedEpoch })
      }),
    })
  }),
)

export const defaultLayer = layer.pipe(Layer.provide(Database.defaultLayer))

export const node = LayerNode.make(layer, [Database.node])
