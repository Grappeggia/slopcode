import { Context, Effect } from "effect"

export interface PlatformInterface {
  readonly name: string
  readonly capabilities: {
    readonly mutation: boolean
    readonly staging: boolean
    readonly exchange: boolean
  }
  readonly path: (directory: number, child?: string) => string
  readonly executable?: (directory: number, child: string, parent: string) => string
  readonly exchange?: (directory: number, left: string, right: string) => boolean
  readonly move?: (directory: number, left: string, right: string) => boolean
  readonly unlink?: (directory: number, name: string) => boolean
}

export class Platform extends Context.Service<Platform, PlatformInterface>()("@slopcode/v2/FileMutation/Platform") {}

export const descriptorPath = (name: "linux" | "darwin", directory: number, child = "") =>
  `${name === "linux" ? "/proc/self/fd" : "/dev/fd"}/${directory}${child ? `/${child}` : ""}`

export const unsupported = (name: string) => Platform.of({
  name,
  capabilities: { mutation: false, staging: false, exchange: false },
  path: (directory, child = "") => `${name}-handle://${directory}/${child}`,
})

export const make = Effect.acquireRelease(
  Effect.gen(function* () {
    if (typeof Bun === "undefined" || (process.platform !== "linux" && process.platform !== "darwin")) {
      return { value: unsupported(process.platform) }
    }
    const ffi = yield* Effect.promise(() => import("bun:ffi"))
    const pointer = (value: string) => ffi.ptr(Buffer.from(`${value}\0`))
    if (process.platform === "darwin") {
      const libc = ffi.dlopen("/usr/lib/libSystem.B.dylib", {
        renameatx_np: { args: ["i32", "ptr", "i32", "ptr", "u32"], returns: "i32" },
        unlinkat: { args: ["i32", "ptr", "i32"], returns: "i32" },
      })
      return {
        value: Platform.of({
          name: "darwin",
          capabilities: { mutation: true, staging: true, exchange: true },
          path: (directory, child = "") => descriptorPath("darwin", directory, child),
          executable: (_directory, child, parent) => `${parent}/${child}`,
          exchange: (directory, left, right) =>
            libc.symbols.renameatx_np(directory, pointer(left), directory, pointer(right), 0x00000002) === 0,
          move: (directory, left, right) =>
            libc.symbols.renameatx_np(directory, pointer(left), directory, pointer(right), 0x00000004) === 0,
          unlink: (directory, name) => libc.symbols.unlinkat(directory, pointer(name), 0) === 0,
        }),
        close: libc.close,
      }
    }
    const libc = ffi.dlopen("libc.so.6", {
      renameat2: { args: ["i32", "ptr", "i32", "ptr", "u32"], returns: "i32" },
      unlinkat: { args: ["i32", "ptr", "i32"], returns: "i32" },
    })
    return {
      value: Platform.of({
        name: "linux",
        capabilities: { mutation: true, staging: true, exchange: true },
        path: (directory, child = "") => descriptorPath("linux", directory, child),
        executable: (directory, child) => `/proc/${process.pid}/fd/${directory}/${child}`,
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
