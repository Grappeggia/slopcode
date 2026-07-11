import { describe, expect } from "bun:test"
import { Context, Deferred, Effect, Exit, Fiber, Layer, Scope } from "effect"
import { EventV2 } from "@slopcode-ai/core/event"
import { PluginV2 } from "@slopcode-ai/core/plugin"
import { State } from "@slopcode-ai/core/state"
import { it } from "./lib/effect"

const events = Layer.mock(EventV2.Service)({
  publish: (definition, data) =>
    Effect.succeed({
      id: EventV2.ID.make("evt_plugin_test"),
      type: definition.type,
      data,
    }),
})
const plugins = PluginV2.layer.pipe(Layer.provide(events))

function state() {
  return State.create({
    initial: () => ({ values: [] as string[] }),
    draft: (draft) => ({
      add: (value: string) => draft.values.push(value),
    }),
  })
}

describe("PluginV2", () => {
  it.effect("closes plugin-owned scopes when the registry layer finalizes", () =>
    Effect.gen(function* () {
      const values = state()
      const layerScope = yield* Scope.fork(yield* Scope.Scope)
      const plugin = Context.get(yield* Layer.buildWithScope(Layer.fresh(plugins), layerScope), PluginV2.Service)

      yield* plugin.add({
        id: PluginV2.ID.make("scoped"),
        effect: Effect.gen(function* () {
          yield* values.transform((editor) => editor.add("scoped"))
        }),
      })
      expect(values.get().values).toEqual(["scoped"])

      yield* Scope.close(layerScope, Exit.void)
      expect(values.get().values).toEqual([])
    }),
  )

  it.effect("serializes same-ID additions and leaves one removable attachment", () =>
    Effect.gen(function* () {
      const values = state()
      const layerScope = yield* Scope.fork(yield* Scope.Scope)
      const plugin = Context.get(yield* Layer.buildWithScope(Layer.fresh(plugins), layerScope), PluginV2.Service)
      const id = PluginV2.ID.make("shared")
      const firstStarted = yield* Deferred.make<void>()
      const releaseFirst = yield* Deferred.make<void>()

      const first = yield* plugin
        .add({
          id,
          effect: Effect.gen(function* () {
            yield* values.transform((editor) => editor.add("first"))
            yield* Deferred.succeed(firstStarted, undefined)
            yield* Deferred.await(releaseFirst)
          }),
        })
        .pipe(Effect.forkChild)
      yield* Deferred.await(firstStarted)

      const second = yield* plugin
        .add({
          id,
          effect: Effect.gen(function* () {
            yield* values.transform((editor) => editor.add("second"))
          }),
        })
        .pipe(Effect.forkChild({ startImmediately: true }))
      expect(values.get().values).toEqual(["first"])

      yield* Deferred.succeed(releaseFirst, undefined)
      yield* Fiber.join(first)
      yield* Fiber.join(second)
      expect(values.get().values).toEqual(["second"])

      yield* plugin.remove(id)
      expect(values.get().values).toEqual([])
    }),
  )

  it.effect("transfers ownership atomically across installation and replacement disposal", () =>
    Effect.gen(function* () {
      const layerScope = yield* Scope.fork(yield* Scope.Scope)
      const plugin = Context.get(yield* Layer.buildWithScope(Layer.fresh(plugins), layerScope), PluginV2.Service)
      const installed = yield* Deferred.make<void>()
      let cleaned = 0
      let disposed = 0
      let transferred = 0
      yield* PluginV2.attachTools(plugin, (id, _tools, _slot) =>
        id === PluginV2.ID.make("install-interrupt")
          ? Effect.acquireRelease(Effect.void, () => Effect.sync(() => cleaned++)).pipe(
              Effect.andThen(Deferred.succeed(installed, undefined)),
              Effect.andThen(Effect.never),
            )
          : Effect.void,
      )
      const interrupted = yield* plugin
        .add({
          id: PluginV2.ID.make("install-interrupt"),
          effect: Effect.succeed({
            tool: { waiting: { description: "waiting", args: {}, execute: async () => "waiting" } },
            dispose: () => disposed++,
          }),
          transfer: () => transferred++,
        })
        .pipe(Effect.forkChild)
      yield* Deferred.await(installed)
      yield* Fiber.interrupt(interrupted)
      expect({ cleaned, disposed, transferred }).toEqual({ cleaned: 1, disposed: 1, transferred: 0 })

      const id = PluginV2.ID.make("replace-interrupt")
      const closing = yield* Deferred.make<void>()
      const release = yield* Deferred.make<void>()
      yield* plugin.add({
        id,
        effect: Effect.succeed({
          "tool.execute.before": () => Effect.sync(() => undefined),
          dispose: () =>
            Effect.runPromise(Deferred.succeed(closing, undefined).pipe(Effect.andThen(Deferred.await(release)))),
        }),
      })
      let replacement = 0
      const replacing = yield* plugin
        .add({
          id,
          effect: Effect.succeed({ "tool.execute.before": () => Effect.sync(() => replacement++) }),
          transfer: () => transferred++,
        })
        .pipe(Effect.forkChild)
      yield* Deferred.await(closing)
      const interruption = yield* Fiber.interrupt(replacing).pipe(Effect.forkChild)
      expect(transferred).toBe(1)
      yield* plugin.triggerFor(
        id,
        "tool.execute.before",
        { tool: "test", sessionID: "session", callID: "call" },
        { args: {} },
      )
      expect(replacement).toBe(1)
      yield* Deferred.succeed(release, undefined)
      yield* Fiber.join(interruption)
      yield* Scope.close(layerScope, Exit.void)
    }),
  )

  it.effect("transfers ownership before Added publication can be interrupted", () =>
    Effect.gen(function* () {
      const publishing = yield* Deferred.make<void>()
      const scope = yield* Scope.fork(yield* Scope.Scope)
      const context = yield* Layer.buildWithScope(
        Layer.fresh(
          PluginV2.layer.pipe(
            Layer.provide(
              Layer.mock(EventV2.Service)({
                publish: (definition, data) =>
                  definition.type === PluginV2.Event.Added.type
                    ? Deferred.succeed(publishing, undefined).pipe(Effect.andThen(Effect.never))
                    : Effect.succeed({ id: EventV2.ID.make("evt_plugin_test"), type: definition.type, data }),
              }),
            ),
          ),
        ),
        scope,
      )
      const plugin = Context.get(context, PluginV2.Service)
      let called = 0
      let transferred = 0
      const adding = yield* plugin
        .add({
          id: PluginV2.ID.make("added-interrupt"),
          effect: Effect.succeed({ "tool.execute.before": () => Effect.sync(() => called++) }),
          transfer: () => transferred++,
        })
        .pipe(Effect.forkChild)
      yield* Deferred.await(publishing)
      yield* Fiber.interrupt(adding)
      expect(transferred).toBe(1)
      yield* plugin.triggerFor(
        PluginV2.ID.make("added-interrupt"),
        "tool.execute.before",
        { tool: "test", sessionID: "session", callID: "call" },
        { args: {} },
      )
      expect(called).toBe(1)
      yield* Scope.close(scope, Exit.void)
    }),
  )
})
