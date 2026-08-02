import semver from "semver"

export type LineageMode = "release" | "verify"

export type LineageIssue = {
  code: "dirty" | "branch" | "source" | "previous" | "published" | "tag-source" | "tag-branch" | "version" | "state"
  message: string
}

type BaseState = {
  remote: string
  branch: string
  source: string
  upstream: string
  target: string
  monotonic?: boolean
  highest?: string
  priors?: Array<{
    tag: string
    sha: string
    ancestor: boolean
  }>
}

export type LineageState =
  | (BaseState & {
      mode: "release"
      current: string
      head: string
      clean: boolean
      targetLocal: boolean
      targetRemote: boolean
      previous?: {
        tag: string
        sha: string
        ancestor: boolean
        immediate?: boolean
      }
    })
  | (BaseState & {
      mode: "verify"
      targetSha?: string
      tagAncestor?: boolean
      previous?: {
        tag: string
        sha?: string
        ancestor?: boolean
        immediate?: boolean
      }
    })

type BaseOptions = {
  target: string
  cwd?: string
  remote?: string
  branch?: string
}

export type LineageOptions =
  | (BaseOptions & {
      mode: "release"
      previous?: string
      resume?: boolean
    })
  | (BaseOptions & {
      mode: "verify"
      source: string
      previous?: string
    })

export type LineageResult = {
  mode: LineageMode
  remote: string
  branch: string
  source: string
  upstream: string
  target: string
  previous?: string
}

export class LineageError extends Error {
  constructor(public readonly issues: LineageIssue[]) {
    super(issues.map((issue) => issue.message).join("\n"))
    this.name = "LineageError"
  }
}

export function validateLineage(state: LineageState): LineageIssue[] {
  const history = (state.priors ?? [])
    .filter((item) => !item.ancestor)
    .map((item) => ({
      code: "previous" as const,
      message: `Previous release tag "${item.tag}" (${item.sha}) is not an ancestor of source ${state.source}. Release history has diverged from the canonical source.`,
    }))
  const order =
    state.monotonic === false
      ? [
          {
            code: "version" as const,
            message:
              state.mode === "release"
                ? `Release target "${state.target}" must be strictly greater than the highest freshly fetched remote release tag "${state.highest}".`
                : `Verified target "${state.target}" is older than freshly fetched remote release tag "${state.highest}".`,
          },
        ]
      : []
  if (state.mode === "verify") {
    return [
      ...order,
      ...(state.targetSha !== state.source
        ? [
            {
              code: "tag-source" as const,
              message: `Target tag "${state.target}" resolves to ${state.targetSha ?? "no commit"}, not expected source ${state.source}. Verify the workflow input and tag provenance.`,
            },
          ]
        : []),
      ...(state.tagAncestor === false
        ? [
            {
              code: "tag-branch" as const,
              message: `Target tag "${state.target}" (${state.targetSha}) is not an ancestor of ${state.remote}/${state.branch} (${state.upstream}). Refuse provenance verification for a tag outside the canonical release line.`,
            },
          ]
        : []),
      ...history,
      ...(state.previous && (state.priors === undefined || !state.previous.sha) && state.previous.ancestor !== true
        ? [
            {
              code: "previous" as const,
              message: state.previous.sha
                ? `Previous release tag "${state.previous.tag}" (${state.previous.sha}) is not an ancestor of source ${state.source}. Release history has diverged from the canonical source.`
                : `Previous release tag "${state.previous.tag}" does not resolve to a commit on remote "${state.remote}".`,
            },
          ]
        : []),
      ...(state.previous?.immediate === false
        ? [
            {
              code: "previous" as const,
              message: `Previous release tag "${state.previous.tag}" is not the immediate semantic predecessor of target "${state.target}" among freshly fetched remote release tags.`,
            },
          ]
        : []),
    ]
  }

  return [
    ...order,
    ...(!state.clean
      ? [
          {
            code: "dirty" as const,
            message: "Release worktree is dirty. Commit or stash changes before releasing.",
          },
        ]
      : []),
    ...(state.current !== state.branch
      ? [
          {
            code: "branch" as const,
            message: `Release must run on branch "${state.branch}"; current branch is "${state.current || "detached HEAD"}". Switch to the canonical branch before releasing.`,
          },
        ]
      : []),
    ...(state.head !== state.upstream
      ? [
          {
            code: "source" as const,
            message: `Release source HEAD (${state.head}) must exactly match ${state.remote}/${state.branch} (${state.upstream}). Fetch and rebase or fast-forward the canonical branch before releasing.`,
          },
        ]
      : []),
    ...history,
    ...(state.previous && state.priors === undefined && !state.previous.ancestor
      ? [
          {
            code: "previous" as const,
            message: `Previous release tag "${state.previous.tag}" (${state.previous.sha}) is not an ancestor of source ${state.source}. Release history has diverged from the canonical source.`,
          },
        ]
      : []),
    ...(state.previous?.immediate === false
      ? [
          {
            code: "previous" as const,
            message: `Previous release tag "${state.previous.tag}" is not the immediate semantic predecessor of target "${state.target}" among freshly fetched remote release tags.`,
          },
        ]
      : []),
    ...(state.targetLocal || state.targetRemote
      ? [
          {
            code: "published" as const,
            message: `Target tag "${state.target}" already exists${state.targetRemote ? ` on remote "${state.remote}"` : " locally"}. Choose an unpublished version; use mode "verify" only for non-publishing provenance checks.`,
          },
        ]
      : []),
  ]
}

const run = async (cwd: string, args: string[]) => {
  const proc = Bun.spawn(["git", ...args], {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
  })
  const [stdout, stderr, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ])
  return { stdout: stdout.trim(), stderr: stderr.trim(), code }
}

const git = async (cwd: string, args: string[]) => {
  const result = await run(cwd, args)
  if (result.code === 0) return result.stdout
  throw new Error(`git ${args.join(" ")} failed: ${result.stderr || `exit code ${result.code}`}`)
}

const resolve = async (cwd: string, ref: string) => {
  const result = await run(cwd, ["rev-parse", "--verify", `${ref}^{commit}`])
  return result.code === 0 ? result.stdout : undefined
}

const exists = async (cwd: string, ref: string) => (await run(cwd, ["rev-parse", "--verify", ref])).code === 0

const ancestor = async (cwd: string, older: string, newer: string) => {
  const result = await run(cwd, ["merge-base", "--is-ancestor", older, newer])
  if (result.code === 0) return true
  if (result.code === 1) return false
  throw new Error(`Could not compare release lineage: ${result.stderr || `git exited with ${result.code}`}`)
}

const tag = (value: string, stable = false) => {
  const parsed = semver.parse(value.trim())
  if (!parsed)
    throw new Error(`Invalid release version or tag "${value}". Expected a semantic version such as 1.2.3 or v1.2.3.`)
  if (stable && (parsed.prerelease.length || parsed.build.length)) {
    throw new Error(`Release target "${value}" must be a stable semantic version without prerelease or build metadata.`)
  }
  return `v${parsed.version}`
}

type ReleaseTag = { tag: string; ref: string; version: string; sha: string }

type RemoteHistory = {
  cwd: string
  remote: string
  branch: string
  target: string
  targetVersion: string
  tags: string
  upstream: string
  published: ReleaseTag[]
  highest?: ReleaseTag
  priors: ReleaseTag[]
  targetSha?: string
  stateSha?: string
}

// CAS anchor moved only by release tooling; ordinary commits to the canonical branch do not touch it.
export const releaseStateRef = "refs/heads/slopcode-release-state"

const releases = async (cwd: string, prefix: string) =>
  Promise.all(
    (await git(cwd, ["for-each-ref", "--format=%(refname)", prefix]))
      .split("\n")
      .filter(Boolean)
      .map(async (ref): Promise<ReleaseTag | undefined> => {
        const item = ref.slice(prefix.length)
        const version = semver.valid(item)
        if (!version) return
        const sha = await resolve(cwd, ref)
        if (!sha) return
        return { tag: `v${version}`, ref, version, sha }
      }),
  ).then((items) =>
    items
      .filter((item): item is ReleaseTag => !!item)
      .sort((a, b) => semver.rcompare(a.version, b.version) || b.tag.localeCompare(a.tag)),
  )

const prior = (items: ReleaseTag[], target: string) => items.filter((item) => semver.lt(item.version, target))

const history = (cwd: string, items: ReleaseTag[], source: string) =>
  Promise.all(items.map(async (item) => ({ ...item, ancestor: await ancestor(cwd, item.sha, source) })))

const remoteHistory = async (options: { target: string; cwd: string; remote: string; branch: string }) => {
  const target = tag(options.target, true)
  const targetVersion = target.slice(1)
  const tags = `refs/slopcode/lineage/${options.remote}/tags/`
  const heads = `refs/slopcode/lineage/${options.remote}/heads/`
  await git(options.cwd, [
    "fetch",
    "--force",
    "--prune",
    "--no-tags",
    options.remote,
    `+refs/heads/${options.branch}:refs/remotes/${options.remote}/${options.branch}`,
    `+refs/heads/*:${heads}*`,
    `+refs/tags/*:${tags}*`,
  ])
  const upstream = await resolve(options.cwd, `refs/remotes/${options.remote}/${options.branch}`)
  if (!upstream)
    throw new Error(`Could not resolve freshly fetched canonical branch ${options.remote}/${options.branch}.`)
  const stateSha = await resolve(options.cwd, `${heads}${releaseStateRef.slice("refs/heads/".length)}`)
  const all = await releases(options.cwd, tags)
  const published = stateSha ? (await history(options.cwd, all, stateSha)).filter((item) => item.ancestor) : all
  return {
    ...options,
    target,
    targetVersion,
    tags,
    upstream,
    published,
    highest: published[0],
    priors: prior(published, targetVersion),
    targetSha: await resolve(options.cwd, `${tags}${target}`),
    stateSha,
  } satisfies RemoteHistory
}

const inspectHistory = async (remote: RemoteHistory, source: string, previous?: string) => {
  const expected = remote.priors[0]?.tag
  const previousTag = previous ? tag(previous) : expected
  const previousSha = previousTag ? remote.published.find((item) => item.tag === previousTag)?.sha : undefined
  return {
    expected,
    previousTag,
    previousSha,
    ancestry: await history(remote.cwd, remote.priors, source),
  }
}

const stateIssues = (remote: RemoteHistory, publishedSource?: string): LineageIssue[] => {
  if (publishedSource && remote.stateSha !== publishedSource) {
    return [
      {
        code: "state",
        message: `Published resume target requires ${releaseStateRef} at ${publishedSource}, got ${remote.stateSha ?? "no ref"}.`,
      },
    ]
  }
  if (!remote.stateSha) return []
  if (remote.highest && remote.stateSha === remote.highest.sha) return []
  return [
    {
      code: "state",
      message: `${releaseStateRef} (${remote.stateSha}) must match the highest release source ${remote.highest?.sha ?? "none"}.`,
    },
  ]
}

export async function revalidateLineageHistory(options: {
  target: string
  source: string
  previous?: string
  cwd?: string
  remote?: string
  branch?: string
  resume?: boolean
}) {
  const cwd = options.cwd ?? process.cwd()
  const remote = options.remote ?? "origin"
  const branch = options.branch ?? "dev"
  const fetched = await remoteHistory({ target: options.target, cwd, remote, branch })
  const source = await resolve(cwd, options.source)
  if (!source) throw new Error(`Prepared release source ${options.source} does not resolve to a commit.`)
  const inspected = await inspectHistory(fetched, source, options.previous)
  const captured = options.previous ? tag(options.previous) : undefined
  const issues: LineageIssue[] = [
    ...stateIssues(fetched, options.resume && fetched.targetSha ? source : undefined),
    ...inspected.ancestry
      .filter((item) => !item.ancestor)
      .map((item) => ({
        code: "previous" as const,
        message: `Previous release tag "${item.tag}" (${item.sha}) is not an ancestor of source ${source}. Release history has diverged from the canonical source.`,
      })),
    ...(captured !== inspected.expected
      ? [
          {
            code: "previous" as const,
            message: `Captured previous release tag "${captured ?? "none"}" is no longer the immediate semantic predecessor "${inspected.expected ?? "none"}" of target "${fetched.target}".`,
          },
        ]
      : []),
    ...(!options.resume && fetched.highest && !semver.gt(fetched.targetVersion, fetched.highest.version)
      ? [
          {
            code: "version" as const,
            message: `Release target "${fetched.target}" must be strictly greater than the highest freshly fetched remote release tag "${fetched.highest.tag}".`,
          },
        ]
      : []),
    ...(!options.resume && fetched.targetSha
      ? [
          {
            code: "published" as const,
            message: `Target tag "${fetched.target}" appeared on remote "${remote}" during release preparation.`,
          },
        ]
      : []),
    ...(options.resume && fetched.targetSha && fetched.targetSha !== source
      ? [
          {
            code: "tag-source" as const,
            message: `Resume target "${fetched.target}" resolves to ${fetched.targetSha}, not prepared source ${source}.`,
          },
        ]
      : []),
    ...(options.resume && fetched.targetSha && fetched.highest?.tag !== fetched.target
      ? [
          {
            code: "version" as const,
            message: `Resume target "${fetched.target}" is no longer the highest freshly fetched remote release tag "${fetched.highest?.tag}".`,
          },
        ]
      : []),
    ...(options.resume &&
    !fetched.targetSha &&
    fetched.highest &&
    !semver.gt(fetched.targetVersion, fetched.highest.version)
      ? [
          {
            code: "version" as const,
            message: `Unpublished resume target "${fetched.target}" must be strictly greater than the highest freshly fetched remote release tag "${fetched.highest.tag}".`,
          },
        ]
      : []),
  ]
  if (issues.length) throw new LineageError(issues)
  return {
    target: fetched.target,
    source,
    previous: inspected.expected,
    upstream: fetched.upstream,
    targetSha: fetched.targetSha,
    stateSha: fetched.stateSha,
  }
}

export async function gateLineage(options: LineageOptions): Promise<LineageResult> {
  const cwd = options.cwd ?? process.cwd()
  const remote = options.remote ?? "origin"
  const branch = options.branch ?? "dev"
  const fetched = await remoteHistory({ target: options.target, cwd, remote, branch })
  const { target, targetVersion, tags, upstream, highest, priors } = fetched

  if (options.mode === "verify") {
    const source = await resolve(cwd, options.source)
    if (!source) throw new Error("Verification mode requires --source resolving to the expected release commit SHA.")
    const inspected = await inspectHistory(fetched, source, options.previous)
    const state: LineageState = {
      mode: "verify",
      remote,
      branch,
      source,
      upstream,
      target,
      monotonic: !highest || !semver.gt(highest.version, targetVersion),
      highest: highest?.tag,
      priors: inspected.ancestry,
      targetSha: fetched.targetSha,
      tagAncestor: fetched.targetSha ? await ancestor(cwd, fetched.targetSha, upstream) : undefined,
      previous: inspected.previousTag
        ? {
            tag: inspected.previousTag,
            sha: inspected.previousSha,
            ancestor: inspected.previousSha ? await ancestor(cwd, inspected.previousSha, source) : undefined,
            immediate: inspected.previousTag === inspected.expected,
          }
        : undefined,
    }
    const issues = validateLineage(state)
    if (issues.length) throw new LineageError(issues)
    return { mode: "verify", remote, branch, source, upstream, target, previous: inspected.previousTag }
  }

  const head = await resolve(cwd, "HEAD")
  if (!head) throw new Error(`Could not resolve HEAD in git repository "${cwd}".`)
  const current = (await run(cwd, ["symbolic-ref", "--quiet", "--short", "HEAD"])).stdout
  const inspected = await inspectHistory(fetched, head, options.previous)
  const { expected, previousTag, previousSha } = inspected
  if (options.previous && !previousSha) {
    throw new Error(
      `Explicit previous release tag "${previousTag}" does not resolve to a commit on remote "${remote}". Correct --previous-tag or the published tag.`,
    )
  }
  if (previousTag && !previousSha) {
    throw new Error(`Latest release tag "${previousTag}" could not be resolved to a commit.`)
  }

  const targetLocalSha = await resolve(cwd, `refs/tags/${target}`)
  const targetRemoteSha = fetched.targetSha
  if (options.resume && targetLocalSha && targetRemoteSha && targetLocalSha !== targetRemoteSha) {
    throw new LineageError([
      {
        code: "tag-source",
        message: `Target tag "${target}" differs locally (${targetLocalSha}) and on remote "${remote}" (${targetRemoteSha}). Refuse to resume an ambiguous release.`,
      },
    ])
  }
  const source = options.resume ? (targetRemoteSha ?? targetLocalSha ?? head) : head
  const ancestry = source === head ? inspected.ancestry : await history(cwd, priors, source)
  const clean = (await git(cwd, ["status", "--porcelain", "--untracked-files=all"])) === ""
  const resumedBranch = current === branch || (!current && head === source)
  const resumedLine = !options.resume
    ? true
    : targetRemoteSha
      ? await ancestor(cwd, source, upstream)
      : (await ancestor(cwd, upstream, source)) || (await ancestor(cwd, source, upstream))
  const state: LineageState = {
    mode: "release",
    remote,
    branch,
    current,
    head,
    source,
    upstream,
    clean,
    target,
    monotonic:
      !highest ||
      semver.gt(targetVersion, highest.version) ||
      !!(options.resume && targetRemoteSha && highest.tag === target),
    highest: highest?.tag,
    priors: ancestry,
    targetLocal: options.resume ? false : await exists(cwd, `refs/tags/${target}`),
    targetRemote: options.resume ? false : await exists(cwd, `${tags}${target}`),
    previous:
      previousTag && previousSha
        ? {
            tag: previousTag,
            sha: previousSha,
            ancestor: await ancestor(cwd, previousSha, source),
            immediate: previousTag === expected,
          }
        : undefined,
  }
  if (options.resume) {
    const issues: LineageIssue[] = [
      ...stateIssues(fetched, targetRemoteSha ? source : undefined),
      ...(!clean
        ? [{ code: "dirty" as const, message: "Release worktree is dirty. Commit or stash changes before releasing." }]
        : []),
      ...(!resumedBranch
        ? [
            {
              code: "branch" as const,
              message: `Release resume must run on branch "${branch}" or at the exact target tag commit; current branch is "${current || "detached HEAD"}".`,
            },
          ]
        : []),
      ...(!resumedLine
        ? [
            {
              code: "source" as const,
              message: `Resume source ${source} has diverged from ${remote}/${branch} (${upstream}).`,
            },
          ]
        : []),
      ...validateLineage(state).filter((issue) => issue.code === "previous" || issue.code === "version"),
    ]
    if (issues.length) throw new LineageError(issues)
    return { mode: "release", remote, branch, source, upstream, target, previous: previousTag }
  }
  const issues = [...stateIssues(fetched), ...validateLineage(state)]
  if (issues.length) throw new LineageError(issues)

  return {
    mode: "release",
    remote,
    branch,
    source: head,
    upstream,
    target,
    previous: previousTag,
  }
}
