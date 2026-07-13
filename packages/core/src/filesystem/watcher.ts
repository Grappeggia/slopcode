export * as Watcher from "./watcher"

// @ts-ignore
import { createWrapper } from "@parcel/watcher/wrapper"
import type ParcelWatcher from "@parcel/watcher"
import { Cause, Context, Effect, Layer, Option, Schema } from "effect"
import path from "path"
import { Config } from "../config"
import { EventV2 } from "../event"
import { Flag } from "../flag/flag"
import { FSUtil } from "../fs-util"
import { Git } from "../git"
import { Location } from "../location"
import { lazy } from "../util/lazy"
import { Ignore } from "./ignore"
import { Protected } from "./protected"
import { MutationEvents } from "../mutation-events"

declare const SLOPCODE_LIBC: string | undefined

const SUBSCRIBE_TIMEOUT_MS = 10_000

export const Event = {
  Updated: EventV2.define({
    type: "file.watcher.updated",
    schema: {
      file: Schema.String,
      event: Schema.Literals(["add", "change", "unlink"]),
    },
  }),
}

const watcher = lazy((): typeof import("@parcel/watcher") | undefined => {
  try {
    const libc = typeof SLOPCODE_LIBC === "undefined" ? undefined : SLOPCODE_LIBC
    const binding = require(
      `@parcel/watcher-${process.platform}-${process.arch}${process.platform === "linux" ? `-${libc || "glibc"}` : ""}`,
    )
    return createWrapper(binding) as typeof import("@parcel/watcher")
  } catch {
    return
  }
})

function getBackend() {
  if (process.platform === "win32") return "windows"
  if (process.platform === "darwin") return "fs-events"
  if (process.platform === "linux") return "inotify"
}

function protecteds(dir: string) {
  return Protected.paths().filter((item) => {
    const relative = path.relative(dir, item)
    return relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative)
  })
}

export const hasNativeBinding = () => !!watcher()
export const isMutationStage = (file: string) => path.basename(file).startsWith(".") && path.basename(file).includes(".slopcode-")

export const callback = (input: {
  readonly ownership?: MutationEvents.Interface
  readonly publish: (file: string, event: MutationEvents.Kind) => Effect.Effect<void>
  readonly run: (effect: Effect.Effect<void>) => void
}): ParcelWatcher.SubscribeCallback => (_error, updates) => {
  for (const update of updates) {
    if (isMutationStage(update.path)) continue
    const event = update.type === "create" ? "add" : update.type === "update" ? "change" : "unlink"
    const file = FSUtil.normalizePath(update.path)
    const publish = input.publish(file, event)
    input.run(input.ownership ? input.ownership.native(file, event, publish).pipe(Effect.asVoid) : publish)
  }
}

export interface Interface {}

export class Service extends Context.Service<Service, Interface>()("@slopcode/v2/FileWatcher") {}

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    if (yield* Flag.SLOPCODE_EXPERIMENTAL_DISABLE_FILEWATCHER) return Service.of({})

    const backend = getBackend()
    const location = yield* Location.Service
    if (!backend) {
      yield* Effect.logError("watcher backend not supported", {
        directory: location.directory,
        platform: process.platform,
      })
      return Service.of({})
    }

    const w = watcher()
    if (!w) return Service.of({})

    yield* Effect.logInfo("watcher backend", { directory: location.directory, platform: process.platform, backend })
    const events = yield* EventV2.Service
    const reconciler = yield* Effect.serviceOption(MutationEvents.Service)
    const fs = yield* FSUtil.Service
    const git = yield* Git.Service
    const context = yield* Effect.context()
    const runFork = Effect.runForkWith(context)
    const subscriptions: ParcelWatcher.AsyncSubscription[] = []
    yield* Effect.addFinalizer(() =>
      Effect.promise(() => Promise.allSettled(subscriptions.map((subscription) => subscription.unsubscribe()))),
    )

    const onUpdate = callback({
      ownership: Option.getOrUndefined(reconciler),
      publish: (file, event) => events.publish(Event.Updated, { file, event }),
      run: (effect) => { runFork(effect) },
    })

    const subscribe = (directory: string, ignore: string[]) => {
      const pending = w.subscribe(directory, onUpdate, { ignore, backend })
      return Effect.promise(() => pending).pipe(
        Effect.tap((subscription) => Effect.sync(() => subscriptions.push(subscription))),
        Effect.timeout(SUBSCRIBE_TIMEOUT_MS),
        Effect.catchCause((cause) => {
          pending.then((subscription) => subscription.unsubscribe()).catch(() => {})
          return Effect.logError("failed to subscribe", { directory, cause: Cause.pretty(cause) })
        }),
      )
    }

    const config = (yield* (yield* Config.Service).entries())
      .filter((entry): entry is Config.Document => entry.type === "document")
      .flatMap((item) => item.info.watcher?.ignore ?? [])
    if (yield* Flag.SLOPCODE_EXPERIMENTAL_FILEWATCHER) {
      yield* Effect.forkScoped(
        subscribe(location.directory, ["**/.slopcode-*", ...Ignore.PATTERNS, ...config, ...protecteds(location.directory)]),
      )
    }

    if (location.vcs?.type === "git") {
      const resolved = yield* git.dir(location.directory)
      const vcs = resolved ? yield* fs.realPath(resolved).pipe(Effect.catch(() => Effect.succeed(resolved))) : undefined
      if (vcs && !config.includes(".git") && !config.includes(vcs) && (!resolved || !config.includes(resolved))) {
        const ignore = (yield* fs.readDirectoryEntries(vcs).pipe(Effect.catch(() => Effect.succeed([])))).flatMap(
          (entry) => (entry.name === "HEAD" ? [] : [entry.name]),
        )
        yield* Effect.forkScoped(subscribe(vcs, ignore))
      }
    }

    return Service.of({})
  }).pipe(
    Effect.catchCause((cause) => {
      return Effect.logError("failed to init watcher service", { cause: Cause.pretty(cause) }).pipe(
        Effect.as(Service.of({})),
      )
    }),
  ),
)

export const locationLayer = layer.pipe(Layer.provide(Config.locationLayer), Layer.provide(Git.defaultLayer))
