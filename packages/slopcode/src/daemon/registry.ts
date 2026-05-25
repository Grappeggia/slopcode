import { Global } from "@/global"
import { Filesystem } from "@/util/filesystem"
import { createHash } from "crypto"
import fs from "fs/promises"
import path from "path"
import z from "zod"

export namespace DaemonRegistry {
  export const Info = z.object({
    directory: z.string(),
    view_id: z.string().optional(),
    pid: z.number().int().positive(),
    url: z.string(),
    token: z.string(),
    version: z.string(),
    protocol: z.number().int().positive(),
    started_at: z.number().int().positive(),
    idle_timeout_ms: z.number().int().positive(),
  })

  export type Info = z.infer<typeof Info>

  export function normalize(directory: string) {
    return Filesystem.normalizePath(path.resolve(directory))
  }

  function key(directory: string, viewID?: string) {
    return createHash("sha1")
      .update(`${normalize(directory)}\n${viewID ?? "shared"}`)
      .digest("hex")
  }

  function root() {
    return path.join(Global.Path.state, "daemon")
  }

  export function paths(directory: string, viewID?: string) {
    const id = key(directory, viewID)
    return {
      root: root(),
      info: path.join(root(), `${id}.json`),
      lock: path.join(root(), `${id}.lock`),
    }
  }

  export async function read(directory: string, viewID?: string) {
    const json = await Bun.file(paths(directory, viewID).info)
      .json()
      .catch(() => undefined)
    if (!json) return
    const parsed = Info.safeParse(json)
    if (!parsed.success) return
    return parsed.data
  }

  export async function write(info: Info) {
    const file = paths(info.directory, info.view_id).info
    await fs.mkdir(path.dirname(file), { recursive: true })
    await Filesystem.writeJson(file, {
      ...info,
      directory: normalize(info.directory),
    })
  }

  export async function remove(directory: string, viewID?: string) {
    const { info, lock } = paths(directory, viewID)
    await fs.rm(info, { force: true }).catch(() => undefined)
    await fs.rm(lock, { recursive: true, force: true }).catch(() => undefined)
  }

  export async function alive(pid: number) {
    try {
      process.kill(pid, 0)
      return true
    } catch {
      return false
    }
  }

  export async function acquire(directory: string, viewID?: string, timeout = 10_000) {
    const lock = paths(directory, viewID).lock
    await fs.mkdir(path.dirname(lock), { recursive: true })
    const start = Date.now()
    while (true) {
      try {
        await fs.mkdir(lock)
        break
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error
        if (Date.now() - start >= timeout) {
          throw new Error(`Timed out waiting for daemon lock for ${normalize(directory)}`)
        }
        await Bun.sleep(50)
      }
    }
    return {
      async [Symbol.asyncDispose]() {
        await fs.rm(lock, { recursive: true, force: true }).catch(() => undefined)
      },
    }
  }
}
