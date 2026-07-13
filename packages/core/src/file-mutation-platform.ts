import { Context, Effect } from "effect"

export interface PlatformInterface {
  readonly name: string
  readonly secure: boolean
  readonly exchange?: (directory: number, left: string, right: string) => boolean
  readonly move?: (directory: number, left: string, right: string) => boolean
  readonly unlink?: (directory: number, name: string) => boolean
}

export class Platform extends Context.Service<Platform, PlatformInterface>()("@slopcode/v2/FileMutation/Platform") {}

export const make = Effect.acquireRelease(
  Effect.gen(function* () {
    if (process.platform !== "linux" || typeof Bun === "undefined") {
      return { value: Platform.of({ name: process.platform, secure: false }) }
    }
    const ffi = yield* Effect.promise(() => import("bun:ffi"))
    const libc = ffi.dlopen("libc.so.6", {
      renameat2: { args: ["i32", "ptr", "i32", "ptr", "u32"], returns: "i32" },
      unlinkat: { args: ["i32", "ptr", "i32"], returns: "i32" },
    })
    const pointer = (value: string) => ffi.ptr(Buffer.from(`${value}\0`))
    return {
      value: Platform.of({
        name: "linux",
        secure: true,
        exchange: (directory, left, right) =>
          libc.symbols.renameat2(directory, pointer(left), directory, pointer(right), 2) === 0,
        move: (directory, left, right) =>
          libc.symbols.renameat2(directory, pointer(left), directory, pointer(right), 1) === 0,
        unlink: (directory, name) => libc.symbols.unlinkat(directory, pointer(name), 0) === 0,
      }),
      close: libc.close,
    }
  }),
  (resource) => Effect.sync(() => resource.close?.()),
).pipe(Effect.map((resource) => resource.value))
