import { Memory } from "@/memory/memory"
import { Effect } from "effect"
import { HttpApiBuilder, HttpApiError } from "effect/unstable/httpapi"
import { InstanceHttpApi } from "../api"
import { ListQuery } from "../groups/memory"

export const memoryHandlers = HttpApiBuilder.group(InstanceHttpApi, "memory", (handlers) =>
  Effect.gen(function* () {
    const memory = yield* Memory.Service

    const list = Effect.fn("MemoryHttpApi.list")(function* (ctx: { query: typeof ListQuery.Type }) {
      return yield* memory.list({ includeDisabled: ctx.query.includeDisabled })
    })

    const create = Effect.fn("MemoryHttpApi.create")(function* (ctx: { payload: Memory.CreateInput }) {
      const item = yield* memory.create(ctx.payload)
      if (!item) return yield* new HttpApiError.BadRequest({})
      return item
    })

    const update = Effect.fn("MemoryHttpApi.update")(function* (ctx: {
      params: { memoryID: Memory.ID }
      payload: Memory.UpdateInput
    }) {
      const item = yield* memory.update(ctx.params.memoryID, ctx.payload)
      if (!item) return yield* new HttpApiError.BadRequest({})
      return item
    })

    const remove = Effect.fn("MemoryHttpApi.remove")(function* (ctx: { params: { memoryID: Memory.ID } }) {
      yield* memory.remove(ctx.params.memoryID)
      return true
    })

    return handlers.handle("list", list).handle("create", create).handle("update", update).handle("remove", remove)
  }),
)
