import { afterEach, describe, expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { gateLineage, LineageError, releaseStateRef, validateLineage, type LineageState } from "../src/lineage"

const dirs: string[] = []

const git = async (cwd: string, ...args: string[]) => {
  const proc = Bun.spawn(["git", ...args], { cwd, stdout: "pipe", stderr: "pipe" })
  const [stdout, stderr, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ])
  if (code !== 0) throw new Error(`git ${args.join(" ")} failed: ${stderr}`)
  return stdout.trim()
}

const commit = async (repo: string, name: string) => {
  await Bun.write(path.join(repo, name), crypto.randomUUID())
  await git(repo, "add", name)
  await git(repo, "commit", "-m", name)
  return git(repo, "rev-parse", "HEAD")
}

const setup = async (branch = "dev", remote = "origin") => {
  const root = await mkdtemp(path.join(tmpdir(), "slopcode-lineage-"))
  dirs.push(root)
  const bare = path.join(root, "remote.git")
  const repo = path.join(root, "repo")
  await git(root, "init", "--bare", bare)
  await git(root, "clone", bare, repo)
  await git(repo, "config", "user.email", "lineage@example.com")
  await git(repo, "config", "user.name", "Lineage Test")
  if (remote !== "origin") await git(repo, "remote", "rename", "origin", remote)
  await git(repo, "switch", "-c", branch)
  const base = await commit(repo, "base")
  await git(repo, "push", "-u", remote, branch)
  return { root, repo, bare, branch, remote, base }
}

const peer = async (ctx: Awaited<ReturnType<typeof setup>>) => {
  const repo = path.join(ctx.root, "peer")
  await git(ctx.root, "clone", ctx.bare, repo)
  await git(repo, "config", "user.email", "lineage@example.com")
  await git(repo, "config", "user.name", "Lineage Test")
  await git(repo, "switch", "--track", "-c", ctx.branch, `origin/${ctx.branch}`)
  return repo
}

const cli = async (...args: string[]) => {
  const proc = Bun.spawn([process.execPath, path.resolve(import.meta.dir, "../src/lineage-cli.ts"), ...args], {
    stdout: "pipe",
    stderr: "pipe",
  })
  const [stdout, stderr, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ])
  return { stdout, stderr, code }
}

const release = (repo: string, target = "0.2.211") =>
  gateLineage({
    mode: "release",
    target,
    cwd: repo,
  })

afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

describe("release lineage", () => {
  test("ignores higher upstream tags outside the SlopCode release series", async () => {
    const ctx = await setup()
    await git(ctx.repo, "switch", "-c", "upstream-tags")
    const upstream = await commit(ctx.repo, "upstream")
    await git(ctx.repo, "push", "origin", `${upstream}:refs/tags/v0.3.9`)
    await git(ctx.repo, "push", "origin", `${upstream}:refs/tags/v1.14.51`)
    await git(ctx.repo, "switch", "dev")
    await git(ctx.repo, "push", "origin", `${ctx.base}:refs/tags/v0.2.196`)
    await git(ctx.repo, "push", "origin", `${ctx.base}:${releaseStateRef}`)
    const source = await commit(ctx.repo, "release")
    await git(ctx.repo, "push")

    await expect(release(ctx.repo, "0.2.197")).resolves.toMatchObject({
      source,
      target: "v0.2.197",
      previous: "v0.2.196",
    })
  })

  test("rejects a target outside the configured SlopCode release series", async () => {
    const ctx = await setup()

    await expect(release(ctx.repo, "0.3.0")).rejects.toThrow(
      'Release target "0.3.0" is outside the configured SlopCode release series',
    )
  })

  test("still rejects divergent tags in the SlopCode release series", async () => {
    const ctx = await setup()
    await git(ctx.repo, "switch", "-c", "published-line")
    const divergent = await commit(ctx.repo, "published")
    await git(ctx.repo, "push", "origin", `${divergent}:refs/tags/v0.2.195`)
    await git(ctx.repo, "switch", "dev")
    await git(ctx.repo, "push", "origin", `${ctx.base}:refs/tags/v0.2.196`)

    await expect(release(ctx.repo, "0.2.197")).rejects.toThrow('Previous release tag "v0.2.195"')
  })

  test("still rejects newer tags in the SlopCode release series", async () => {
    const ctx = await setup()
    await git(ctx.repo, "switch", "-c", "published-line")
    const newer = await commit(ctx.repo, "published")
    await git(ctx.repo, "push", "origin", `${newer}:refs/tags/v0.2.198`)
    await git(ctx.repo, "switch", "dev")
    await git(ctx.repo, "push", "origin", `${ctx.base}:refs/tags/v0.2.196`)

    await expect(release(ctx.repo, "0.2.197")).rejects.toThrow(
      'must be strictly greater than the highest freshly fetched remote release tag "v0.2.198"',
    )
  })

  test("accepts the exact clean canonical branch", async () => {
    const ctx = await setup()
    await git(ctx.repo, "tag", "v0.2.200")
    await git(ctx.repo, "push", "origin", "v0.2.200")
    const source = await commit(ctx.repo, "release")
    await git(ctx.repo, "push")

    await expect(release(ctx.repo)).resolves.toMatchObject({
      source,
      upstream: source,
      target: "v0.2.211",
      previous: "v0.2.200",
    })
  })

  test("supports a first release with no predecessor", async () => {
    const ctx = await setup()

    await expect(release(ctx.repo, "0.2.200")).resolves.toMatchObject({
      target: "v0.2.200",
      previous: undefined,
    })
  })

  test("rejects a feature branch ahead of dev", async () => {
    const ctx = await setup()
    await git(ctx.repo, "switch", "-c", "feature")
    await commit(ctx.repo, "feature")

    await expect(release(ctx.repo)).rejects.toThrow('Release must run on branch "dev"')
    await expect(release(ctx.repo)).rejects.toThrow("must exactly match origin/dev")
  })

  test("rejects a canonical branch made stale by remote advancement", async () => {
    const ctx = await setup()
    const other = await peer(ctx)
    await commit(other, "remote-release")
    await git(other, "push")

    await expect(release(ctx.repo)).rejects.toThrow("must exactly match origin/dev")
  })

  test("rejects old dev after a divergent previous release", async () => {
    const ctx = await setup()
    await git(ctx.repo, "switch", "-c", "published-line")
    await commit(ctx.repo, "published")
    await git(ctx.repo, "tag", "v0.2.220")
    await git(ctx.repo, "push", "origin", "v0.2.220")
    await git(ctx.repo, "switch", "dev")

    await expect(release(ctx.repo, "0.2.221")).rejects.toThrow('Previous release tag "v0.2.220"')
    await expect(release(ctx.repo, "0.2.221")).rejects.toThrow("is not an ancestor of source")
  })

  test("rejects a remote-only divergent previous release", async () => {
    const ctx = await setup()
    await git(ctx.repo, "switch", "-c", "published-line")
    const source = await commit(ctx.repo, "remote-published")
    await git(ctx.repo, "push", "origin", `${source}:refs/tags/v0.2.220`)
    await git(ctx.repo, "switch", "dev")

    await expect(release(ctx.repo, "0.2.221")).rejects.toThrow('Previous release tag "v0.2.220"')
  })

  test("rejects a release-state anchor that does not match the highest release source", async () => {
    const ctx = await setup()
    await git(ctx.repo, "push", "origin", `${ctx.base}:refs/tags/v0.2.200`)
    await git(ctx.repo, "switch", "-c", "wrong-state")
    const wrong = await commit(ctx.repo, "wrong-state")
    await git(ctx.repo, "push", "origin", `${wrong}:${releaseStateRef}`)
    await git(ctx.repo, "switch", "dev")

    await expect(release(ctx.repo, "0.2.211")).rejects.toThrow(`${releaseStateRef} (${wrong}) must match`)
  })

  test("rejects prerelease, build-metadata, and backward release targets", async () => {
    const ctx = await setup()
    await git(ctx.repo, "push", "origin", `${ctx.base}:refs/tags/v0.2.220`)

    await expect(release(ctx.repo, "0.2.221-rc.1")).rejects.toThrow("must be a stable semantic version")
    await expect(release(ctx.repo, "0.2.221+retry")).rejects.toThrow("must be a stable semantic version")
    await expect(release(ctx.repo, "0.2.219")).rejects.toThrow("must be strictly greater")
    await expect(release(ctx.repo, "0.2.219")).rejects.toThrow('"v0.2.220"')
  })

  test("requires every divergent prior release line in the candidate source", async () => {
    const ctx = await setup()
    await git(ctx.repo, "switch", "-c", "older-release")
    const older = await commit(ctx.repo, "older-release")
    await git(ctx.repo, "push", "origin", `${older}:refs/tags/v0.2.200`)
    await git(ctx.repo, "switch", "dev")
    const newest = await commit(ctx.repo, "newest-release")
    await git(ctx.repo, "push", "origin", "dev", `${newest}:refs/tags/v0.2.211`)

    await expect(release(ctx.repo, "0.2.212")).rejects.toThrow('Previous release tag "v0.2.200"')
    await git(ctx.repo, "merge", "--no-ff", "older-release", "-m", "merge older release line")
    await git(ctx.repo, "push", "origin", "dev")
    await expect(release(ctx.repo, "0.2.212")).resolves.toMatchObject({ previous: "v0.2.211" })
  })

  test("always enforces a clean release worktree", async () => {
    const ctx = await setup()
    await Bun.write(path.join(ctx.repo, "dirty"), "dirty")

    await expect(release(ctx.repo)).rejects.toThrow("Release worktree is dirty")
  })

  test("supports configurable remotes and canonical branches", async () => {
    const ctx = await setup("stable", "central")

    await expect(
      gateLineage({
        mode: "release",
        target: "0.2.230",
        cwd: ctx.repo,
        remote: "central",
        branch: "stable",
      }),
    ).resolves.toMatchObject({ remote: "central", branch: "stable", source: ctx.base })
  })

  test("canonicalizes valid remote semantic tags without a v prefix", async () => {
    const ctx = await setup()
    await git(ctx.repo, "push", "origin", `${ctx.base}:refs/tags/0.2.200`)

    await expect(release(ctx.repo, "0.2.211")).resolves.toMatchObject({ previous: "v0.2.200" })
  })

  test("requires the actual immediate semantic predecessor", async () => {
    const ctx = await setup()
    await git(ctx.repo, "push", "origin", `${ctx.base}:refs/tags/v0.2.200`)
    const middle = await commit(ctx.repo, "middle")
    await git(ctx.repo, "push", "origin", `${middle}:refs/tags/v0.2.211`)
    const source = await commit(ctx.repo, "target")
    await git(ctx.repo, "push")
    await git(ctx.repo, "push", "origin", `${source}:refs/tags/v0.2.212`)

    await expect(
      gateLineage({
        mode: "verify",
        target: "v0.2.212",
        source,
        previous: "v0.2.200",
        cwd: ctx.repo,
      }),
    ).rejects.toThrow("not the immediate semantic predecessor")
    await expect(
      gateLineage({
        mode: "verify",
        target: "v0.2.212",
        source,
        previous: "v0.2.211",
        cwd: ctx.repo,
      }),
    ).resolves.toMatchObject({ previous: "v0.2.211" })
  })

  test("verifies the supplied previous release tag is in the source lineage", async () => {
    const ctx = await setup()
    await git(ctx.repo, "push", "origin", `${ctx.base}:refs/tags/v0.2.200`)
    const source = await commit(ctx.repo, "release")
    await git(ctx.repo, "push")
    await git(ctx.repo, "push", "origin", `${source}:refs/tags/v0.2.211`)

    await expect(
      gateLineage({
        mode: "verify",
        target: "v0.2.211",
        source,
        previous: "v0.2.200",
        cwd: ctx.repo,
      }),
    ).resolves.toMatchObject({ previous: "v0.2.200" })
  })

  test("rejects a supplied previous tag outside the source lineage", async () => {
    const ctx = await setup()
    await git(ctx.repo, "switch", "-c", "side")
    const side = await commit(ctx.repo, "side")
    await git(ctx.repo, "push", "origin", `${side}:refs/tags/v0.2.200`)
    await git(ctx.repo, "switch", "dev")
    await git(ctx.repo, "push", "origin", `${ctx.base}:refs/tags/v0.2.211`)

    await expect(
      gateLineage({
        mode: "verify",
        target: "v0.2.211",
        source: ctx.base,
        previous: "v0.2.200",
        cwd: ctx.repo,
      }),
    ).rejects.toThrow('Previous release tag "v0.2.200"')
  })

  test("requires an explicit previous tag to be the immediate predecessor", async () => {
    const ctx = await setup()
    await git(ctx.repo, "push", "origin", `${ctx.base}:refs/tags/v0.2.200`)
    const middle = await commit(ctx.repo, "middle")
    await git(ctx.repo, "push", "origin", "dev", `${middle}:refs/tags/v0.2.201`)

    await expect(
      gateLineage({ mode: "release", target: "0.2.211", previous: "v0.2.200", cwd: ctx.repo }),
    ).rejects.toThrow("not the immediate semantic predecessor")
    await expect(
      gateLineage({ mode: "release", target: "0.2.211", previous: "v0.2.201", cwd: ctx.repo }),
    ).resolves.toMatchObject({ previous: "v0.2.201" })
  })

  test("rejects a target tag that is already published", async () => {
    const ctx = await setup()
    await git(ctx.repo, "push", "origin", `${ctx.base}:refs/tags/v0.2.211`)
    await git(ctx.repo, "push", "origin", `${ctx.base}:refs/tags/v1.14.51`)

    await expect(release(ctx.repo)).rejects.toThrow('Target tag "v0.2.211" already exists on remote "origin"')
    await expect(release(ctx.repo)).rejects.toThrow('use mode "verify"')
  })

  test("rejects an existing target tag without a v prefix", async () => {
    const ctx = await setup()
    await git(ctx.repo, "push", "origin", `${ctx.base}:refs/tags/0.2.211`)

    await expect(release(ctx.repo)).rejects.toThrow('Target tag "v0.2.211" already exists on remote "origin"')
  })
})

describe("tag provenance", () => {
  test("accepts a published tag matching a source on origin/dev", async () => {
    const ctx = await setup()
    await git(ctx.repo, "tag", "v0.2.200")
    await git(ctx.repo, "push", "origin", "v0.2.200")

    await expect(
      gateLineage({ mode: "verify", target: "v0.2.200", source: ctx.base, cwd: ctx.repo }),
    ).resolves.toMatchObject({ target: "v0.2.200", source: ctx.base })
  })

  test("derives no predecessor for the first release and derives it for later releases", async () => {
    const ctx = await setup()
    await git(ctx.repo, "push", "origin", `${ctx.base}:refs/tags/v0.2.200`)

    await expect(
      gateLineage({ mode: "verify", target: "v0.2.200", source: ctx.base, cwd: ctx.repo }),
    ).resolves.toMatchObject({ previous: undefined })

    const source = await commit(ctx.repo, "next-release")
    await git(ctx.repo, "push", "origin", "dev", `${source}:refs/tags/v0.2.211`)
    await expect(gateLineage({ mode: "verify", target: "v0.2.211", source, cwd: ctx.repo })).resolves.toMatchObject({
      previous: "v0.2.200",
    })
  })

  test("rejects a tag/source mismatch", async () => {
    const ctx = await setup()
    await git(ctx.repo, "tag", "v0.2.200")
    await git(ctx.repo, "push", "origin", "v0.2.200")
    const source = await commit(ctx.repo, "new-source")
    await git(ctx.repo, "push")

    await expect(gateLineage({ mode: "verify", target: "v0.2.200", source, cwd: ctx.repo })).rejects.toThrow(
      "not expected source",
    )
  })

  test("rejects verification of an older target after a newer release exists", async () => {
    const ctx = await setup()
    await git(ctx.repo, "push", "origin", `${ctx.base}:refs/tags/v0.2.200`)
    const newer = await commit(ctx.repo, "newer-release")
    await git(ctx.repo, "push", "origin", "dev", `${newer}:refs/tags/v0.2.220`)

    await expect(gateLineage({ mode: "verify", target: "v0.2.200", source: ctx.base, cwd: ctx.repo })).rejects.toThrow(
      'older than freshly fetched remote release tag "v0.2.220"',
    )
  })

  test("rejects a matching tag outside origin/dev", async () => {
    const ctx = await setup()
    await git(ctx.repo, "switch", "-c", "side")
    const source = await commit(ctx.repo, "side")
    await git(ctx.repo, "tag", "v0.2.200")
    await git(ctx.repo, "push", "origin", "v0.2.200")

    await expect(gateLineage({ mode: "verify", target: "v0.2.200", source, cwd: ctx.repo })).rejects.toThrow(
      "is not an ancestor of origin/dev",
    )
  })

  test("verification requires all prior divergent release lines", async () => {
    const ctx = await setup()
    await git(ctx.repo, "switch", "-c", "older-release")
    const older = await commit(ctx.repo, "older-release")
    await git(ctx.repo, "push", "origin", `${older}:refs/tags/v0.2.200`)
    await git(ctx.repo, "switch", "dev")
    const source = await commit(ctx.repo, "newest-release")
    await git(ctx.repo, "push", "origin", "dev", `${source}:refs/tags/v0.2.211`, `${source}:refs/tags/v0.2.212`)

    await expect(
      gateLineage({ mode: "verify", target: "v0.2.212", source, previous: "v0.2.211", cwd: ctx.repo }),
    ).rejects.toThrow('Previous release tag "v0.2.200"')
  })

  test("supports configurable remotes and canonical branches", async () => {
    const ctx = await setup("stable", "central")
    await git(ctx.repo, "push", "central", `${ctx.base}:refs/tags/v0.2.230`)

    await expect(
      gateLineage({
        mode: "verify",
        target: "v0.2.230",
        source: ctx.base,
        cwd: ctx.repo,
        remote: "central",
        branch: "stable",
      }),
    ).resolves.toMatchObject({ remote: "central", branch: "stable", source: ctx.base })
  })

  test("ignores unrelated malformed and non-commit semantic tags", async () => {
    const ctx = await setup()
    await git(ctx.repo, "push", "origin", `${ctx.base}:refs/tags/v0.2.200`)
    await Bun.write(path.join(ctx.repo, "blob"), "not a commit")
    const blob = await git(ctx.repo, "hash-object", "-w", "blob")
    await git(ctx.repo, "push", "origin", `${blob}:refs/tags/v999.0.0`)
    await git(ctx.repo, "push", "origin", `${blob}:refs/tags/not-a-release`)

    await expect(
      gateLineage({ mode: "verify", target: "v0.2.200", source: ctx.base, cwd: ctx.repo }),
    ).resolves.toMatchObject({ target: "v0.2.200", source: ctx.base })
  })
})

describe("lineage CLI", () => {
  test("returns JSON and exit zero for a valid release", async () => {
    const ctx = await setup()
    const result = await cli("release", "--version", "0.2.211", "--repo", ctx.repo)

    expect(result.code).toBe(0)
    expect(JSON.parse(result.stdout)).toMatchObject({ mode: "release", target: "v0.2.211" })
  })

  test("rejects removed safety bypasses", async () => {
    const result = await cli("release", "--version", "0.2.211", "--allow-dirty")

    expect(result.code).toBe(1)
    expect(result.stderr).toContain("Unknown or incomplete option: --allow-dirty")
  })

  test("requires an explicit predecessor only when prior release history exists", async () => {
    const first = await setup()
    await git(first.repo, "push", "origin", `${first.base}:refs/tags/v0.2.200`)
    const initial = await cli(
      "verify",
      "--tag",
      "v0.2.200",
      "--source",
      first.base,
      "--require-previous-if-any",
      "--repo",
      first.repo,
    )
    expect(initial.code).toBe(0)

    const source = await commit(first.repo, "next-release")
    await git(first.repo, "push", "origin", "dev", `${source}:refs/tags/v0.2.211`)
    const later = await cli(
      "verify",
      "--tag",
      "v0.2.211",
      "--source",
      source,
      "--require-previous-if-any",
      "--repo",
      first.repo,
    )
    expect(later.code).toBe(1)
    expect(later.stderr).toContain("must be supplied explicitly")
  })
})

test("pure validation returns actionable, coded errors", () => {
  const state: LineageState = {
    mode: "release",
    remote: "upstream",
    branch: "stable",
    current: "topic",
    head: "bbb",
    source: "bbb",
    upstream: "aaa",
    clean: false,
    target: "v0.2.220",
    targetLocal: false,
    targetRemote: false,
  }

  expect(validateLineage(state)).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ code: "dirty", message: expect.stringContaining("Commit or stash") }),
      expect.objectContaining({ code: "branch", message: expect.stringContaining('branch "stable"') }),
      expect.objectContaining({ code: "source", message: expect.stringContaining("upstream/stable") }),
    ]),
  )
  expect(new LineageError(validateLineage(state)).message).toContain("canonical branch")
  expect(
    validateLineage({
      mode: "verify",
      remote: "upstream",
      branch: "stable",
      source: "aaa",
      upstream: "bbb",
      target: "v0.2.220",
      targetSha: "ccc",
      tagAncestor: false,
    }).map((issue) => issue.code),
  ).toEqual(["tag-source", "tag-branch"])
})
