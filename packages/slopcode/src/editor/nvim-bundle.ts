import { spawnSync } from "node:child_process"
import path from "node:path"
import { Filesystem } from "@/util/filesystem"

export namespace NvimBundle {
  export const version = "v0.12.1"

  export type Info = {
    root: string
    bin: string
    runtime: string
    env: Record<string, string>
  }

  type Probe = {
    info?: Info
    error?: string
  }

  const probes = new Map<string, Promise<Probe>>()

  const binary = () => (process.platform === "win32" ? "nvim.exe" : "nvim")

  const runtime = (root: string) => path.join(root, "share", "nvim", "runtime")

  const envs = async (root: string) => {
    const env: Record<string, string> = {}
    const lib = path.join(root, "lib")
    const luaLib = path.join(root, "lib", "lua", "5.1")
    if (await Filesystem.exists(lib)) {
      env.LD_LIBRARY_PATH = [lib, (await Filesystem.exists(luaLib)) ? luaLib : undefined, process.env.LD_LIBRARY_PATH]
        .filter(Boolean)
        .join(":")
    }
    const lua = path.join(root, "share", "lua", "5.1")
    if (await Filesystem.exists(lua)) {
      env.LUA_PATH = [`${lua}/?.lua`, `${lua}/?/init.lua`, process.env.LUA_PATH].filter(Boolean).join(";")
    }
    const cpath = path.join(root, "lib", "lua", "5.1")
    if (await Filesystem.exists(cpath)) {
      env.LUA_CPATH = [`${cpath}/?.so`, process.env.LUA_CPATH].filter(Boolean).join(";")
    }
    return env
  }

  const complete = async (root: string) => {
    const bin = path.join(root, "bin", binary())
    if (!(await Filesystem.exists(bin))) return
    const run = runtime(root)
    if (!(await Filesystem.exists(run))) return
    return {
      root,
      bin,
      runtime: run,
      env: await envs(root),
    } satisfies Info
  }

  const env = async () => {
    const bin = process.env.SLOPCODE_NVIM_BIN_PATH
    if (!bin) return
    if (!(await Filesystem.exists(bin))) return
    const run =
      process.env.SLOPCODE_VIMRUNTIME ?? path.join(path.dirname(path.dirname(bin)), "share", "nvim", "runtime")
    if (!(await Filesystem.exists(run))) return
    return {
      root: path.dirname(path.dirname(bin)),
      bin,
      runtime: run,
      env: await envs(path.dirname(path.dirname(bin))),
    } satisfies Info
  }

  const roots = () => {
    const dir = path.dirname(process.execPath)
    return [
      process.env.SLOPCODE_NVIM_ROOT,
      path.join(dir, "neovim"),
      path.join(dir, "..", "lib", "slopcode", "neovim"),
    ].filter((item): item is string => !!item)
  }

  const message = (info: Info) => {
    const result = spawnSync(info.bin, ["--version"], {
      encoding: "utf8",
      timeout: 5000,
      env: {
        ...process.env,
        NVIM_APPNAME: "slopcode-editor-check",
        VIMRUNTIME: info.runtime,
        ...info.env,
      },
    })
    if (!result.error && result.status === 0) return { info } satisfies Probe
    const error = [
      result.error?.message,
      typeof result.stderr === "string" ? result.stderr.trim() : "",
      typeof result.stdout === "string" ? result.stdout.trim() : "",
      typeof result.status === "number" ? `exit ${result.status}` : "",
    ]
      .filter(Boolean)
      .join("\n")
    if (process.platform === "linux" && error.includes("GLIBC_")) {
      return {
        error: `Bundled Neovim is incompatible with this Linux runtime.\n${error}`,
      } satisfies Probe
    }
    return {
      error: error || "Bundled Neovim failed its startup probe.",
    } satisfies Probe
  }

  const probe = (info: Info) => {
    const key = `${info.bin}:${info.runtime}`
    const hit = probes.get(key)
    if (hit) return hit
    const task = Promise.resolve(message(info))
    probes.set(key, task)
    return task
  }

  export async function resolve() {
    const forced = await env()
    if (forced) return forced
    for (const root of roots()) {
      const hit = await complete(root)
      if (hit) return hit
    }
  }

  export async function ready() {
    const hit = await resolve()
    if (!hit) return
    return (await probe(hit)).info
  }

  export async function problem() {
    const hit = await resolve()
    if (!hit) return
    return (await probe(hit)).error
  }
}
