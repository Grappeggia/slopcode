import path from "node:path"
import { Filesystem } from "@/util/filesystem"

export namespace NvimBundle {
  export const version = "v0.12.1"

  export type Info = {
    root: string
    bin: string
    runtime: string
  }

  const binary = () => (process.platform === "win32" ? "nvim.exe" : "nvim")

  const runtime = (root: string) => path.join(root, "share", "nvim", "runtime")

  const complete = async (root: string) => {
    const bin = path.join(root, "bin", binary())
    if (!(await Filesystem.exists(bin))) return
    const run = runtime(root)
    if (!(await Filesystem.exists(run))) return
    return {
      root,
      bin,
      runtime: run,
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

  export async function resolve() {
    const forced = await env()
    if (forced) return forced
    for (const root of roots()) {
      const hit = await complete(root)
      if (hit) return hit
    }
  }
}
