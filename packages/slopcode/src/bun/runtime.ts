import path from "path"

export namespace BunRuntime {
  const bun = (file: string) => {
    const base = path.basename(file).toLowerCase()
    return base === "bun" || base === "bun.exe"
  }

  export function which(input?: { exec_path?: string; bun_path?: string; lookup?: string }) {
    const exec = input?.exec_path ?? process.execPath
    if (bun(exec)) return exec
    const env = input?.bun_path ?? process.env.SLOPCODE_BUN_PATH
    if (env) return env
    const found = input?.lookup ?? Bun.which("bun")
    if (found) return found
    return "bun"
  }
}
