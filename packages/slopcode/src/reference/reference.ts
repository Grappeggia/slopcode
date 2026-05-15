import path from "path"
import { Config } from "@/config/config"
import { Global } from "@/global"
import { Instance } from "@/project/instance"
import { Filesystem } from "@/util/filesystem"
import { parseRepositoryReference, repositoryCachePath, type Reference as RepositoryReference } from "@/util/repository"
import { RepositoryCache } from "./repository-cache"

export type Resolved =
  | {
      name: string
      kind: "local"
      path: string
    }
  | {
      name: string
      kind: "git"
      repository: string
      reference: RepositoryReference
      path: string
      branch?: string
    }
  | {
      name: string
      kind: "invalid"
      repository: string
      message: string
    }

type ReferenceEntry = NonNullable<Config.Info["reference"]>[string]

function referencePath(value: string) {
  if (value.startsWith("~/")) return path.join(Global.Path.home, value.slice(2))
  return path.isAbsolute(value) ? value : path.resolve(Instance.worktree === "/" ? Instance.directory : Instance.worktree, value)
}

function resolveGit(input: { name: string; repository: string; branch?: string }): Resolved {
  const parsed = parseRepositoryReference(input.repository)
  if (!parsed || parsed.protocol === "file:") {
    return {
      name: input.name,
      kind: "invalid",
      repository: input.repository,
      message: "Repository must be a git URL, host/path reference, or GitHub owner/repo shorthand",
    }
  }
  return {
    name: input.name,
    kind: "git",
    repository: input.repository,
    reference: parsed,
    path: repositoryCachePath(parsed),
    branch: input.branch,
  }
}

function resolve(input: { name: string; reference: ReferenceEntry }): Resolved {
  if (typeof input.reference === "string") {
    if (input.reference.startsWith(".") || input.reference.startsWith("/") || input.reference.startsWith("~")) {
      return { name: input.name, kind: "local", path: referencePath(input.reference) }
    }
    return resolveGit({ name: input.name, repository: input.reference })
  }

  if ("path" in input.reference) return { name: input.name, kind: "local", path: referencePath(input.reference.path) }
  return resolveGit({ name: input.name, repository: input.reference.repository, branch: input.reference.branch })
}

export namespace Reference {
  export async function list() {
    const cfg = await Config.get()
    return Object.entries(cfg.reference ?? {}).map(([name, reference]) => resolve({ name, reference }))
  }

  export async function get(name: string) {
    return list().then((references) => references.find((reference) => reference.name === name))
  }

  export async function init() {
    await Promise.all(
      (await list())
        .filter((reference): reference is Extract<Resolved, { kind: "git" }> => reference.kind === "git")
        .map((reference) => RepositoryCache.ensure({ reference: reference.reference, branch: reference.branch }).catch(() => undefined)),
    )
  }

  export async function ensure(target?: string) {
    const references = await list()
    if (!target) {
      await init()
      return
    }
    await Promise.all(
      references
        .filter((reference): reference is Extract<Resolved, { kind: "git" }> => reference.kind === "git" && Filesystem.contains(reference.path, target))
        .map((reference) => RepositoryCache.ensure({ reference: reference.reference, branch: reference.branch }).catch(() => undefined)),
    )
  }

  export async function contains(target?: string) {
    if (!target) return false
    return (await list()).some((reference) => reference.kind === "git" && Filesystem.contains(reference.path, target))
  }
}
