import { BusEvent } from "@/bus/bus-event"
import { Bus } from "@/bus"
import path from "path"
import z from "zod"
import { formatPatch, structuredPatch } from "diff"
import { Log } from "@/util/log"
import { Instance } from "./instance"
import { FileWatcher } from "@/file/watcher"
import { Filesystem } from "@/util/filesystem"
import { git } from "@/util/git"

const log = Log.create({ service: "vcs" })

export namespace Vcs {
  export const Mode = z.enum(["git", "branch"])
  export type Mode = z.infer<typeof Mode>

  export const FileDiff = z
    .object({
      file: z.string(),
      patch: z.string(),
      additions: z.number(),
      deletions: z.number(),
      status: z.enum(["added", "deleted", "modified"]).optional(),
    })
    .meta({
      ref: "VcsFileDiff",
    })
  export type FileDiff = z.infer<typeof FileDiff>

  export const Event = {
    BranchUpdated: BusEvent.define(
      "vcs.branch.updated",
      z.object({
        branch: z.string().optional(),
      }),
    ),
  }

  export const Info = z
    .object({
      branch: z.string().optional(),
      default_branch: z.string().optional(),
    })
    .meta({
      ref: "VcsInfo",
    })
  export type Info = z.infer<typeof Info>

  const count = (text: string) => {
    if (!text) return 0
    if (!text.endsWith("\n")) return text.split("\n").length
    return text.slice(0, -1).split("\n").length
  }

  const state = Instance.state(
    async () => {
      if (Instance.project.vcs !== "git") {
        return { branch: async () => undefined, defaultBranch: async () => undefined, unsubscribe: undefined }
      }
      let current = await currentBranch()
      let root = await defaultBranch()
      log.info("initialized", { branch: current, default_branch: root })

      const unsubscribe = Bus.subscribe(FileWatcher.Event.Updated, async (evt) => {
        if (!evt.properties.file.endsWith("HEAD")) return
        const next = await currentBranch()
        const nextRoot = await defaultBranch()
        if (next !== current) {
          log.info("branch changed", { from: current, to: next })
          current = next
          Bus.publish(Event.BranchUpdated, { branch: next })
        }
        root = nextRoot
      })

      return {
        branch: async () => current,
        defaultBranch: async () => root,
        unsubscribe,
      }
    },
    async (entry) => {
      entry.unsubscribe?.()
    },
  )

  async function run(args: string[], cwd = Instance.directory) {
    const result = await git(args, { cwd })
    return {
      exitCode: result.exitCode,
      stdout: result.text(),
    }
  }

  async function currentBranch() {
    const result = await run(["rev-parse", "--abbrev-ref", "HEAD"], Instance.worktree)
    if (result.exitCode !== 0) return undefined
    const value = result.stdout.trim()
    return value || undefined
  }

  async function hasRef(ref: string) {
    const result = await run(["rev-parse", "--verify", ref], Instance.worktree)
    return result.exitCode === 0
  }

  async function hasHead() {
    return hasRef("HEAD")
  }

  async function defaultBranch() {
    const symbolic = await run(["symbolic-ref", "refs/remotes/origin/HEAD"], Instance.worktree)
    if (symbolic.exitCode === 0) {
      const value = symbolic.stdout.trim().split("/").at(-1)
      if (value) return value
    }

    for (const value of ["dev", "main", "master"]) {
      if (await hasRef(`origin/${value}`)) return value
      if (await hasRef(value)) return value
    }
  }

  async function prefix() {
    const result = await run(["rev-parse", "--show-prefix"], Instance.directory)
    return result.exitCode === 0 ? result.stdout.trim() : ""
  }

  async function mergeBase(ref: string) {
    const result = await run(["merge-base", "HEAD", ref], Instance.directory)
    if (result.exitCode !== 0) return undefined
    return result.stdout.trim() || undefined
  }

  async function read(file: string) {
    const full = path.join(Instance.directory, file)
    if (!(await Filesystem.exists(full))) return ""
    const buf = await Filesystem.readBytes(full).catch(() => Buffer.alloc(0))
    if (buf.includes(0)) return ""
    return buf.toString("utf8")
  }

  async function show(ref: string, file: string, base: string) {
    const result = await run(["show", `${ref}:${base}${file}`], Instance.worktree)
    if (result.exitCode !== 0) return ""
    const buf = Buffer.from(result.stdout)
    if (buf.includes(0)) return ""
    return result.stdout
  }

  async function status() {
    const result = await run(["status", "--porcelain=v1", "-z", "--untracked-files=all"], Instance.directory)
    if (result.exitCode !== 0) return [] as Array<{ file: string; status: "added" | "deleted" | "modified" }>
    const tokens = result.stdout.split("\0").filter(Boolean)
    const items: Array<{ file: string; status: "added" | "deleted" | "modified" }> = []
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i]
      const code = token.slice(0, 2)
      let file = token.slice(3)
      if (code.includes("R") || code.includes("C")) {
        file = tokens[i + 1] ?? file
        i += 1
      }
      const kind = code === "??" || code.includes("A") ? "added" : code.includes("D") ? "deleted" : "modified"
      items.push({ file, status: kind })
    }
    return items
  }

  async function numstat(ref: string) {
    const result = await run(["diff", "--numstat", "--no-renames", ref, "--", "."], Instance.directory)
    if (result.exitCode !== 0) return new Map<string, { additions: number; deletions: number }>()
    return new Map(
      result.stdout
        .trim()
        .split("\n")
        .filter(Boolean)
        .map((line) => {
          const [additions, deletions, file] = line.split("\t")
          const added = additions === "-" ? 0 : parseInt(additions)
          const removed = deletions === "-" ? 0 : parseInt(deletions)
          return [
            file,
            {
              additions: Number.isFinite(added) ? added : 0,
              deletions: Number.isFinite(removed) ? removed : 0,
            },
          ] as const
        }),
    )
  }

  async function changed(ref: string) {
    const result = await run(["diff", "--name-status", "--no-renames", ref, "--", "."], Instance.directory)
    if (result.exitCode !== 0) return [] as Array<{ file: string; status: "added" | "deleted" | "modified" }>
    return result.stdout
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const [code, file] = line.split("\t")
        const kind: "added" | "deleted" | "modified" = code?.startsWith("A")
          ? "added"
          : code?.startsWith("D")
            ? "deleted"
            : "modified"
        return { file, status: kind }
      })
  }

  async function files(
    ref: string | undefined,
    list: Array<{ file: string; status: "added" | "deleted" | "modified" }>,
  ) {
    const base = ref ? await prefix() : ""
    const stats = ref ? await numstat(ref) : new Map<string, { additions: number; deletions: number }>()
    const done = new Set<string>()
    const result: FileDiff[] = []
    for (const item of list) {
      if (!item.file || done.has(item.file)) continue
      done.add(item.file)
      const before = item.status === "added" || !ref ? "" : await show(ref, item.file, base ? `${base}` : "")
      const after = item.status === "deleted" ? "" : await read(item.file)
      result.push({
        file: item.file,
        patch: formatPatch(
          structuredPatch(item.file, item.file, before, after, "", "", { context: Number.MAX_SAFE_INTEGER }),
        ),
        additions: stats.get(item.file)?.additions ?? (item.status === "added" ? count(after) : 0),
        deletions: stats.get(item.file)?.deletions ?? (item.status === "deleted" ? count(before) : 0),
        status: item.status,
      })
    }
    return result.toSorted((a, b) => a.file.localeCompare(b.file))
  }

  export async function init() {
    await state()
  }

  export async function branch() {
    return await state().then((entry) => entry.branch())
  }

  export async function default_branch() {
    return await state().then((entry) => entry.defaultBranch())
  }

  export async function diff(mode: Mode) {
    if (Instance.project.vcs !== "git") return []
    if (!(await hasHead())) return files(undefined, await status())
    if (mode === "git") return files("HEAD", await status())
    const baseName = await defaultBranch()
    if (!baseName) return []
    const current = await branch()
    if (current && current === baseName) return []
    const ref = await mergeBase(`origin/${baseName}`)
    if (!ref) return []
    const extra = await status().then((list) => list.filter((item) => item.status === "added"))
    return files(ref, [...(await changed(ref)), ...extra])
  }
}
