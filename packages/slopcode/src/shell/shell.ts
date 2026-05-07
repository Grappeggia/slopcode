import { Flag } from "@/flag/flag"
import { lazy } from "@/util/lazy"
import { Filesystem } from "@/util/filesystem"
import { which } from "@/util/which"
import path from "path"
import { spawn, type ChildProcess } from "child_process"
import { setTimeout as sleep } from "node:timers/promises"

const SIGKILL_TIMEOUT_MS = 200
const META: Record<string, { deny?: boolean; login?: boolean; posix?: boolean; ps?: boolean }> = {
  bash: { login: true, posix: true },
  dash: { login: true, posix: true },
  fish: { deny: true, login: true },
  ksh: { login: true, posix: true },
  nu: { deny: true },
  powershell: { ps: true },
  pwsh: { ps: true },
  sh: { login: true, posix: true },
  zsh: { login: true, posix: true },
  cmd: {},
}

export namespace Shell {
  export type Item = {
    path: string
    name: string
    acceptable: boolean
  }

  export async function killTree(proc: ChildProcess, opts?: { exited?: () => boolean }): Promise<void> {
    const pid = proc.pid
    if (!pid || opts?.exited?.()) return

    if (process.platform === "win32") {
      await new Promise<void>((resolve) => {
        const killer = spawn("taskkill", ["/pid", String(pid), "/f", "/t"], { stdio: "ignore" })
        killer.once("exit", () => resolve())
        killer.once("error", () => resolve())
      })
      return
    }

    try {
      process.kill(-pid, "SIGTERM")
      await sleep(SIGKILL_TIMEOUT_MS)
      if (!opts?.exited?.()) {
        process.kill(-pid, "SIGKILL")
      }
    } catch {
      proc.kill("SIGTERM")
      await sleep(SIGKILL_TIMEOUT_MS)
      if (!opts?.exited?.()) {
        proc.kill("SIGKILL")
      }
    }
  }

  export function gitbash() {
    if (process.platform !== "win32") return
    if (Flag.SLOPCODE_GIT_BASH_PATH) return Flag.SLOPCODE_GIT_BASH_PATH
    const git = which("git")
    if (!git) return
    const file = path.join(git, "..", "..", "bin", "bash.exe")
    if (Filesystem.stat(file)?.isFile()) return file
  }

  export function name(file: string) {
    if (process.platform === "win32") return path.win32.parse(Filesystem.windowsPath(file)).name.toLowerCase()
    return path.basename(file).toLowerCase()
  }

  export function login(file: string) {
    return META[name(file)]?.login === true
  }

  export function posix(file: string) {
    return META[name(file)]?.posix === true
  }

  export function ps(file: string) {
    return META[name(file)]?.ps === true
  }

  function acceptableShell(file: string) {
    return META[name(file)]?.deny !== true
  }

  function fallback() {
    if (process.platform === "win32") return process.env.COMSPEC || "cmd.exe"
    if (process.platform === "darwin") return "/bin/zsh"
    return which("bash") || "/bin/sh"
  }

  function full(file: string) {
    if (process.platform !== "win32") return file
    const next = Filesystem.windowsPath(file)
    if (path.win32.dirname(next) !== ".") return next
    if (name(next) === "bash") return gitbash() || which(next) || next
    return which(next) || next
  }

  function resolve(file: string) {
    const next = full(file)
    if (path.isAbsolute(Filesystem.windowsPath(next))) {
      if (Filesystem.stat(next)?.isFile()) return next
      return
    }
    return which(next) ?? undefined
  }

  function select(file: string | undefined, opts?: { acceptable?: boolean }) {
    if (file && (!opts?.acceptable || acceptableShell(file))) {
      const shell = resolve(file)
      if (shell) return shell
    }
    if (process.platform === "win32") {
      return [which("pwsh"), which("powershell"), gitbash(), process.env.COMSPEC || "cmd.exe"].find(Boolean) || "cmd.exe"
    }
    return fallback()
  }

  const defaultPreferred = lazy(() => select(process.env.SHELL))
  const defaultAcceptable = lazy(() => select(process.env.SHELL, { acceptable: true }))

  export function preferred(configShell?: string) {
    if (configShell) return select(configShell)
    return defaultPreferred()
  }

  export function acceptable(configShell?: string) {
    if (configShell) return select(configShell, { acceptable: true })
    return defaultAcceptable()
  }

  export async function list(): Promise<Item[]> {
    const files =
      process.platform === "win32"
        ? [which("pwsh"), which("powershell"), gitbash(), process.env.COMSPEC || "cmd.exe"].filter(
            (item): item is string => Boolean(item),
          )
        : Array.from(
            new Set(
              (await Filesystem.readText("/etc/shells").catch(() => ""))
                .split("\n")
                .map((line) => line.trim())
                .filter((line) => line && !line.startsWith("#")),
            ),
          )
    const unique = Array.from(new Set(files.map((file) => resolve(file)).filter((file): file is string => Boolean(file))))
    return unique.map((file) => ({
      path: file,
      name: resolve(name(file)) ? name(file) : file,
      acceptable: acceptableShell(file),
    }))
  }
}
