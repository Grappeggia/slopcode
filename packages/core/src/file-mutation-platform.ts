import { Context, Effect } from "effect"
import fs from "fs/promises"

export interface PlatformInterface {
  readonly name: string
  readonly capabilities: {
    readonly mutation: boolean
    readonly staging: boolean
    readonly exchange: boolean
  }
  readonly path: (directory: number, child?: string) => string
  readonly locate?: (directory: number) => Promise<string | undefined>
  readonly executable?: (directory: number, child: string, parent: string) => string
  readonly exchange?: (directory: number, left: string, right: string) => boolean
  readonly link?: (source: number, child: string, target: number, name: string) => boolean
  readonly move?: (directory: number, left: string, right: string) => boolean
  readonly unlink?: (directory: number, name: string) => boolean
}

export class Platform extends Context.Service<Platform, PlatformInterface>()("@slopcode/v2/FileMutation/Platform") {}

export const descriptorPath = (name: "linux" | "darwin", directory: number, child = "") =>
  `${name === "linux" ? "/proc/self/fd" : "/dev/fd"}/${directory}${child ? `/${child}` : ""}`

export const unsupported = (name: string) =>
  Platform.of({
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
        fcntl: { args: ["i32", "i32", "ptr"], returns: "i32" },
        linkat: { args: ["i32", "ptr", "i32", "ptr", "i32"], returns: "i32" },
        renameatx_np: { args: ["i32", "ptr", "i32", "ptr", "u32"], returns: "i32" },
        unlinkat: { args: ["i32", "ptr", "i32"], returns: "i32" },
      })
      return {
        value: Platform.of({
          name: "darwin",
          capabilities: { mutation: true, staging: false, exchange: true },
          path: (directory, child = "") => descriptorPath("darwin", directory, child),
          locate: async (directory) => {
            const buffer = Buffer.alloc(1024)
            if (libc.symbols.fcntl(directory, 50, ffi.ptr(buffer)) !== 0) return undefined
            const end = buffer.indexOf(0)
            const located = await fs.realpath(buffer.subarray(0, end < 0 ? buffer.length : end).toString()).catch(() => undefined)
            if (!located) return undefined
            const [held, current] = await Promise.all([
              fs.stat(descriptorPath("darwin", directory), { bigint: true }).catch(() => undefined),
              fs.stat(located, { bigint: true }).catch(() => undefined),
            ])
            return held?.dev === current?.dev && held?.ino === current?.ino ? located : undefined
          },
          exchange: (directory, left, right) =>
            libc.symbols.renameatx_np(directory, pointer(left), directory, pointer(right), 0x00000002) === 0,
          link: (source, child, target, name) =>
            libc.symbols.linkat(source, pointer(child), target, pointer(name), 0) === 0,
          move: (directory, left, right) =>
            libc.symbols.renameatx_np(directory, pointer(left), directory, pointer(right), 0x00000004) === 0,
          unlink: (directory, name) => libc.symbols.unlinkat(directory, pointer(name), 0) === 0,
        }),
        close: libc.close,
      }
    }
    const libc = ffi.dlopen("libc.so.6", {
      renameat2: { args: ["i32", "ptr", "i32", "ptr", "u32"], returns: "i32" },
      linkat: { args: ["i32", "ptr", "i32", "ptr", "i32"], returns: "i32" },
      unlinkat: { args: ["i32", "ptr", "i32"], returns: "i32" },
    })
    return {
      value: Platform.of({
        name: "linux",
        capabilities: { mutation: true, staging: true, exchange: true },
        path: (directory, child = "") => descriptorPath("linux", directory, child),
        locate: async (directory) => {
          const descriptor = descriptorPath("linux", directory)
          const link = await fs.readlink(descriptor).catch(() => undefined)
          if (!link) return undefined
          const located = await fs.realpath(link).catch(() => undefined)
          if (!located) return undefined
          const [held, current] = await Promise.all([
            fs.stat(descriptor, { bigint: true }).catch(() => undefined),
            fs.stat(located, { bigint: true }).catch(() => undefined),
          ])
          return held?.dev === current?.dev && held?.ino === current?.ino ? located : undefined
        },
        executable: (directory, child) => `/proc/${process.pid}/fd/${directory}/${child}`,
        exchange: (directory, left, right) =>
          libc.symbols.renameat2(directory, pointer(left), directory, pointer(right), 2) === 0,
        link: (source, child, target, name) =>
          libc.symbols.linkat(source, pointer(child), target, pointer(name), 0) === 0,
        move: (directory, left, right) =>
          libc.symbols.renameat2(directory, pointer(left), directory, pointer(right), 1) === 0,
        unlink: (directory, name) => libc.symbols.unlinkat(directory, pointer(name), 0) === 0,
      }),
      close: libc.close,
    }
  }),
  (resource) => Effect.sync(() => resource.close?.()),
).pipe(Effect.map((resource) => resource.value))
