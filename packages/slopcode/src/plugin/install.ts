import path from "path"
import {
  type ParseError as JsoncParseError,
  applyEdits,
  modify,
  parse as parseJsonc,
  printParseErrorCode,
} from "jsonc-parser"
import { ConfigPaths } from "@/config/paths"
import { Global } from "@/global"
import { Filesystem } from "@/util/filesystem"
import { Lock } from "@/util/lock"
import { parsePluginSpecifier, readPluginPackage, resolvePluginTarget } from "./shared"

type Mode = "noop" | "add" | "replace"
type Kind = "server"

type Ok<T> = { ok: true } & T
type Err<C extends string, T> = { ok: false; code: C } & T

export type Target = {
  kind: Kind
}

export type InstallDeps = {
  resolve: (spec: string) => Promise<string>
}

export type PatchDeps = {
  readText: (file: string) => Promise<string>
  write: (file: string, text: string) => Promise<void>
  exists: (file: string) => Promise<boolean>
  files: (dir: string, name: "slopcode") => string[]
}

export type PatchInput = {
  spec: string
  targets: Target[]
  force?: boolean
  global?: boolean
  vcs?: string
  worktree: string
  directory: string
  config?: string
}

export type InstallResult = Ok<{ target: string }> | Err<"install_failed", { error: unknown }>

export type ManifestResult =
  | Ok<{ targets: Target[] }>
  | Err<"manifest_read_failed", { file: string; error: unknown }>
  | Err<"manifest_no_targets", { file: string }>

export type PatchItem = {
  kind: Kind
  mode: Mode
  file: string
}

type PatchErr =
  | Err<"invalid_json", { kind: Kind; file: string; line: number; col: number; parse: string }>
  | Err<"patch_failed", { kind: Kind; error: unknown }>

type PatchOne = Ok<{ item: PatchItem }> | PatchErr

export type PatchResult = Ok<{ dir: string; items: PatchItem[] }> | (PatchErr & { dir: string })

const installDep: InstallDeps = {
  resolve: (spec) => resolvePluginTarget(spec),
}

const patchDep: PatchDeps = {
  readText: (file) => Filesystem.readText(file),
  write: async (file, text) => {
    await Filesystem.write(file, text)
  },
  exists: (file) => Filesystem.exists(file),
  files: (dir, name) => ConfigPaths.fileInDirectory(dir, name),
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function pluginSpec(item: unknown) {
  if (typeof item === "string") return item
  if (!Array.isArray(item)) return
  if (typeof item[0] !== "string") return
  return item[0]
}

function pluginList(data: unknown) {
  if (!isRecord(data)) return
  if (!Array.isArray(data.plugin)) return
  return data.plugin
}

function patch(text: string, key: Array<string | number>, value: unknown, insert = false) {
  return applyEdits(
    text,
    modify(text, key, value, {
      formattingOptions: {
        tabSize: 2,
        insertSpaces: true,
      },
      isArrayInsertion: insert,
    }),
  )
}

function patchPluginList(text: string, list: unknown[] | undefined, spec: string, next: unknown, force = false) {
  const pkg = parsePluginSpecifier(spec).pkg
  const rows = (list ?? []).map((item, i) => ({
    item,
    i,
    spec: pluginSpec(item),
  }))
  const dup = rows.filter((item) => {
    if (!item.spec) return false
    if (item.spec === spec) return true
    if (item.spec.startsWith("file://")) return false
    return parsePluginSpecifier(item.spec).pkg === pkg
  })

  if (!dup.length) {
    if (!list) {
      return {
        mode: "add" as const,
        text: patch(text, ["plugin"], [next]),
      }
    }
    return {
      mode: "add" as const,
      text: patch(text, ["plugin", list.length], next, true),
    }
  }

  if (!force) {
    return {
      mode: "noop" as const,
      text,
    }
  }

  const keep = dup[0]
  if (!keep) {
    return {
      mode: "noop" as const,
      text,
    }
  }

  if (dup.length === 1 && keep.spec === spec) {
    return {
      mode: "noop" as const,
      text,
    }
  }

  let out = text
  if (typeof keep.item === "string") out = patch(out, ["plugin", keep.i], next)
  if (Array.isArray(keep.item) && typeof keep.item[0] === "string") out = patch(out, ["plugin", keep.i, 0], spec)

  const del = dup
    .map((item) => item.i)
    .filter((i) => i !== keep.i)
    .sort((a, b) => b - a)

  for (const i of del) out = patch(out, ["plugin", i], undefined)

  return {
    mode: "replace" as const,
    text: out,
  }
}

function exportValue(value: unknown) {
  if (typeof value === "string") {
    const next = value.trim()
    if (next) return next
    return
  }
  if (!isRecord(value)) return
  for (const key of ["import", "default"]) {
    const next = value[key]
    if (typeof next !== "string") continue
    const hit = next.trim()
    if (hit) return hit
  }
}

function hasServerTarget(pkg: Record<string, unknown>) {
  const exp = pkg.exports
  if (isRecord(exp)) {
    const value = exportValue(exp["./server"])
    if (value) return true
  }
  const main = pkg.main
  if (typeof main !== "string") return false
  return Boolean(main.trim())
}

function patchDir(input: PatchInput) {
  if (input.global) return input.config ?? Global.Path.config
  const git = input.vcs === "git" && input.worktree !== "/"
  return path.join(git ? input.worktree : input.directory, ".slopcode")
}

async function patchOne(dir: string, target: Target, spec: string, force: boolean, dep: PatchDeps): Promise<PatchOne> {
  using _ = await Lock.write(`plug-config:${dir}:slopcode`)

  const files = dep.files(dir, "slopcode")
  let cfg = files[0]
  for (const file of files) {
    if (!(await dep.exists(file))) continue
    cfg = file
    break
  }

  const src = await dep.readText(cfg).catch((err: NodeJS.ErrnoException) => {
    if (err.code === "ENOENT") return "{}"
    return err
  })
  if (src instanceof Error) {
    return {
      ok: false,
      code: "patch_failed",
      kind: target.kind,
      error: src,
    }
  }

  const text = src.trim() ? src : "{}"
  const errs: JsoncParseError[] = []
  const data = parseJsonc(text, errs, { allowTrailingComma: true })
  if (errs.length) {
    const err = errs[0]
    const lines = text.substring(0, err.offset).split("\n")
    return {
      ok: false,
      code: "invalid_json",
      kind: target.kind,
      file: cfg,
      line: lines.length,
      col: lines[lines.length - 1].length + 1,
      parse: printParseErrorCode(err.error),
    }
  }

  const out = patchPluginList(text, pluginList(data), spec, spec, force)
  if (out.mode === "noop") {
    return {
      ok: true,
      item: {
        kind: target.kind,
        mode: out.mode,
        file: cfg,
      },
    }
  }

  const write = await dep.write(cfg, out.text).catch((error: unknown) => error)
  if (write instanceof Error) {
    return {
      ok: false,
      code: "patch_failed",
      kind: target.kind,
      error: write,
    }
  }

  return {
    ok: true,
    item: {
      kind: target.kind,
      mode: out.mode,
      file: cfg,
    },
  }
}

export async function installPlugin(spec: string, dep: InstallDeps = installDep): Promise<InstallResult> {
  const target = await dep.resolve(spec).then(
    (item) => ({ ok: true as const, item }),
    (error: unknown) => ({ ok: false as const, error }),
  )
  if (!target.ok) {
    return {
      ok: false,
      code: "install_failed",
      error: target.error,
    }
  }
  return {
    ok: true,
    target: target.item,
  }
}

export async function readPluginManifest(target: string): Promise<ManifestResult> {
  const pkg = await readPluginPackage(target).then(
    (item) => ({ ok: true as const, item }),
    (error: unknown) => ({ ok: false as const, error }),
  )
  if (!pkg.ok) {
    return {
      ok: false,
      code: "manifest_read_failed",
      file: target,
      error: pkg.error,
    }
  }

  if (!hasServerTarget(pkg.item.json)) {
    return {
      ok: false,
      code: "manifest_no_targets",
      file: pkg.item.pkg,
    }
  }

  return {
    ok: true,
    targets: [{ kind: "server" }],
  }
}

export async function patchPluginConfig(input: PatchInput, dep: PatchDeps = patchDep): Promise<PatchResult> {
  const dir = patchDir(input)
  const items: PatchItem[] = []
  for (const target of input.targets) {
    const hit = await patchOne(dir, target, input.spec, Boolean(input.force), dep)
    if (!hit.ok) {
      return {
        ...hit,
        dir,
      }
    }
    items.push(hit.item)
  }
  return {
    ok: true,
    dir,
    items,
  }
}
