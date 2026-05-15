import path from "path"
import { Global } from "@/global"

export type Reference = {
  label: string
  remote: string
  protocol: string
}

function clean(input: string) {
  return input.trim().replace(/\/+$/, "")
}

function hash(input: string) {
  return Bun.hash.xxHash32(input).toString(16)
}

function githubShorthand(input: string) {
  if (!/^[\w.-]+\/[\w.-]+$/.test(input)) return
  return `https://github.com/${input}.git`
}

function hostPath(input: string) {
  if (!/^[\w.-]+\/[\w./-]+$/.test(input)) return
  const [host, ...rest] = input.split("/")
  if (!host.includes(".")) return
  return `https://${host}/${rest.join("/")}.git`
}

export function parseRepositoryReference(input: string): Reference | undefined {
  const value = clean(input)
  const remote = githubShorthand(value) ?? hostPath(value) ?? value

  if (remote.startsWith("git@")) {
    const label = remote.replace(/^git@/, "").replace(":", "/").replace(/\.git$/, "")
    return { label, remote, protocol: "ssh:" }
  }

  try {
    const url = new URL(remote)
    if (!url.protocol.endsWith(":")) return
    return {
      label: `${url.host}${url.pathname}`.replace(/^\/+/, "").replace(/\.git$/, ""),
      remote,
      protocol: url.protocol,
    }
  } catch {
    return
  }
}

export function parseRemoteRepositoryReference(input: string) {
  const reference = parseRepositoryReference(input)
  if (!reference || reference.protocol === "file:") {
    throw new Error("Repository must be a git URL, host/path reference, or GitHub owner/repo shorthand")
  }
  return reference
}

export function validateRepositoryBranch(branch: string) {
  if (!branch || branch.startsWith("-") || branch.includes("..") || /[~^:?*[\\\]\x00-\x20]/.test(branch)) {
    throw new Error(`Invalid repository branch or ref: ${branch}`)
  }
}

export function repositoryCachePath(reference: Reference) {
  const safe = reference.label.replace(/[^a-zA-Z0-9._-]+/g, "__")
  return path.join(Global.Path.repos, `${safe}-${hash(reference.remote)}`)
}
