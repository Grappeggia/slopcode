export * as PluginV2 from "./plugin"

import { createDraft, finishDraft, type Draft } from "immer"
import type { LanguageModelV3 } from "@ai-sdk/provider"
import { Context, Deferred, Effect, Exit, Layer, Schema, Scope } from "effect"
import type { ModelV2 } from "./model"
import type { Catalog } from "./catalog"
import { EventV2 } from "./event"
import { KeyedMutex } from "./effect/keyed-mutex"
import type { PluginTool } from "./plugin/tool"

export const ID = Schema.String.pipe(Schema.brand("Plugin.ID"))
export type ID = typeof ID.Type

export const Event = {
  Added: EventV2.define({
    type: "plugin.added",
    schema: {
      id: ID,
    },
  }),
  Failed: EventV2.define({
    type: "plugin.failed",
    schema: {
      id: ID.pipe(Schema.optional),
      source: Schema.String,
      package: Schema.String.pipe(Schema.optional),
      stage: Schema.Literals(["install", "entrypoint", "compatibility", "import", "factory", "hook-shape"]).pipe(
        Schema.optional,
      ),
      message: Schema.String,
    },
  }),
  Warning: EventV2.define({
    type: "plugin.warning",
    schema: {
      id: ID.pipe(Schema.optional),
      source: Schema.String,
      package: Schema.String,
      message: Schema.String,
    },
  }),
}

type HookSpec = {
  "catalog.transform": {
    input: Catalog.Editor
    output: {}
  }
  "aisdk.language": {
    input: {
      model: ModelV2.Info
      sdk: any
      options: Record<string, any>
    }
    output: {
      language?: LanguageModelV3
    }
  }
  "aisdk.sdk": {
    input: {
      model: ModelV2.Info
      package: string
      options: Record<string, any>
    }
    output: {
      sdk?: any
    }
  }
  "tool.execute.before": {
    input: {
      tool: string
      sessionID: string
      callID: string
    }
    output: {
      args: unknown
    }
  }
  "tool.execute.after": {
    input: {
      tool: string
      sessionID: string
      callID: string
      args: unknown
    }
    output: {
      title?: string
      output: string
      metadata?: Record<string, unknown>
      attachments?: ReadonlyArray<PluginTool.Attachment>
    }
  }
}

export type Hooks = {
  [Name in keyof HookSpec]: Readonly<HookSpec[Name]["input"]> & {
    -readonly [Field in keyof HookSpec[Name]["output"]]: HookSpec[Name]["output"][Field] extends object
      ? Draft<HookSpec[Name]["output"][Field]>
      : HookSpec[Name]["output"][Field]
  }
}

export type HookFunctions = {
  [key in keyof Hooks]?: (input: Hooks[key]) => Effect.Effect<void>
}

export type Registration = HookFunctions & {
  readonly tool?: Readonly<Record<string, PluginTool.Definition>>
  readonly dispose?: () => void | Promise<void>
}

export type HookInput<Name extends keyof Hooks> = HookSpec[Name]["input"]
export type HookOutput<Name extends keyof Hooks> = HookSpec[Name]["output"]

export type Effect<R = never> = Effect.Effect<Registration | void, never, R | Scope.Scope>

export function define<R>(input: { id: ID; effect: Effect.Effect<Registration | void, never, R> }) {
  return input
}

type ToolAdapter = (
  id: ID,
  tools: Readonly<Record<string, PluginTool.Definition>>,
  slot: object,
) => Effect.Effect<void, PluginTool.LoadError, Scope.Scope>

const adapters = new WeakMap<Interface, { adapter?: ToolAdapter; ready: Deferred.Deferred<void> }>()

export const attachTools = (service: Interface, adapter: ToolAdapter) =>
  Effect.acquireRelease(
    Effect.gen(function* () {
      const state = adapters.get(service)
      if (!state) return yield* Effect.die("Plugin service is not initialized")
      state.adapter = adapter
      yield* Deferred.succeed(state.ready, undefined)
    }),
    () =>
      Effect.sync(() => {
        const state = adapters.get(service)
        if (state) state.adapter = undefined
      }),
  )

export interface Interface {
  readonly add: (input: {
    id: ID
    effect: Effect.Effect<void | Registration, never, Scope.Scope>
  }) => Effect.Effect<void, PluginTool.LoadError, never>
  readonly remove: (id: ID) => Effect.Effect<void>
  readonly triggerFor: <Name extends keyof Hooks>(
    id: ID,
    name: Name,
    input: HookInput<Name>,
    output: HookOutput<Name>,
  ) => Effect.Effect<HookInput<Name> & HookOutput<Name>>
  readonly trigger: <Name extends keyof Hooks>(
    name: Name,
    input: HookInput<Name>,
    output: HookOutput<Name>,
  ) => Effect.Effect<HookInput<Name> & HookOutput<Name>>
}

export class Service extends Context.Service<Service, Interface>()("@slopcode/v2/Plugin") {}

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    let hooks: {
      id: ID
      hooks: HookFunctions
      scope: Scope.Closeable
      slot: object
      reserved: boolean
    }[] = []
    const events = yield* EventV2.Service
    const scope = yield* Scope.Scope
    const locks = KeyedMutex.makeUnsafe<ID>()
    const ready = yield* Deferred.make<void>()

    const svc = Service.of({
      add: Effect.fn("Plugin.add")(function* (input) {
        yield* locks.withLock(input.id)(
          Effect.gen(function* () {
            const existing = hooks.find((item) => item.id === input.id)
            const slot = existing?.slot ?? {}
            const childScope = yield* Scope.fork(scope)
            const result = yield* input.effect.pipe(
              Scope.provide(childScope),
              Effect.withSpan("Plugin.load", {
                attributes: {
                  "plugin.id": input.id,
                },
              }),
              Effect.onExit((exit) => (Exit.isFailure(exit) ? Scope.close(childScope, exit) : Effect.void)),
            )
            if (result?.dispose)
              yield* Effect.addFinalizer(() =>
                Effect.promise(() => Promise.resolve(result.dispose?.())).pipe(Effect.orDie),
              ).pipe(Scope.provide(childScope))
            const reserve =
              adapters.get(svc)?.adapter !== undefined || existing?.reserved === true || result?.tool !== undefined
            if (reserve) {
              if (!adapters.get(svc)?.adapter) yield* Deferred.await(ready)
              const adapter = adapters.get(svc)?.adapter
              if (!adapter) return yield* Effect.die("Plugin tool adapter is unavailable")
              yield* adapter(input.id, result?.tool ?? {}, slot).pipe(
                Scope.provide(childScope),
                Effect.tapError((error) =>
                  events.publish(Event.Failed, {
                    id: input.id,
                    source: `plugin:${input.id}`,
                    message: error.message,
                  }),
                ),
                Effect.onError((cause) => Scope.close(childScope, Exit.failCause(cause))),
              )
            }
            const item = { id: input.id, hooks: result ?? {}, scope: childScope, slot, reserved: reserve }
            hooks = existing ? hooks.map((current) => (current === existing ? item : current)) : [...hooks, item]
            if (existing) yield* Scope.close(existing.scope, Exit.void).pipe(Effect.ignore)
            yield* events.publish(Event.Added, { id: input.id })
          }),
        )
      }),
      trigger: Effect.fn("Plugin.trigger")(function* (name, input, output) {
        return yield* svc.triggerFor(ID.make("*"), name, input, output)
      }),
      triggerFor: Effect.fn("Plugin.triggerFor")(function* (id, name, input, output) {
        const draftEntries = new Map<string, ReturnType<typeof createDraft>>()
        const event = {
          ...input,
          ...output,
        } as Record<string, unknown>

        for (const [field, value] of Object.entries(output)) {
          if (value && typeof value === "object") {
            draftEntries.set(field, createDraft(value))
            event[field] = draftEntries.get(field)
          }
        }

        for (const item of hooks) {
          if (id !== ID.make("*") && item.id !== id) continue
          const match = item.hooks[name]
          if (!match) continue
          yield* match(event as any).pipe(
            Effect.withSpan(`Plugin.hook.${name}`, {
              attributes: {
                plugin: item.id,
                hook: name,
              },
            }),
          )
        }

        for (const [field, draft] of draftEntries) {
          if (event[field] === draft) event[field] = finishDraft(draft)
        }

        return event as any
      }),
      remove: Effect.fn("Plugin.remove")(function* (id) {
        yield* locks.withLock(id)(
          Effect.gen(function* () {
            const existing = hooks.find((item) => item.id === id)
            hooks = hooks.filter((item) => item.id !== id)
            if (existing) yield* Scope.close(existing.scope, Exit.void).pipe(Effect.ignore)
          }),
        )
      }),
    })
    adapters.set(svc, { ready })
    return svc
  }),
)

export const locationLayer = layer

// slopcode
// sdcok
