import { afterEach, describe, expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { gateLineage, releaseStateRef } from "../src/lineage"
import {
  dispatchID,
  dispatchPlan,
  findDispatch,
  gatePublication,
  gateRelease,
  npmAttestationURL,
  readNpmProvenance,
  prepareRelease,
  publishNpmSequence,
  verifyNpmPublication,
  verifyNpmPublications,
  type NpmPublication,
} from "../src/release"
import { manifestName, verifyManifest, writeManifest } from "../../slopcode/script/artifact-manifest"

const root = path.resolve(import.meta.dir, "../../..")
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

const commit = async (repo: string, name: string, value: string = crypto.randomUUID()) => {
  await Bun.write(path.join(repo, name), value)
  await git(repo, "add", name)
  await git(repo, "commit", "-m", name)
  return git(repo, "rev-parse", "HEAD")
}

const setup = async (prior = true) => {
  const dir = await mkdtemp(path.join(tmpdir(), "slopcode-release-"))
  dirs.push(dir)
  const bare = path.join(dir, "remote.git")
  const repo = path.join(dir, "repo")
  await git(dir, "init", "--bare", bare)
  await git(dir, "clone", bare, repo)
  await git(repo, "config", "user.email", "release@example.com")
  await git(repo, "config", "user.name", "Release Test")
  await git(repo, "switch", "-c", "dev")
  const base = await commit(repo, "version", "1.0.0")
  if (prior) await git(repo, "tag", "v1.0.0")
  await git(repo, "push", "-u", "origin", "dev", ...(prior ? ["v1.0.0"] : []))
  return { dir, bare, repo, base }
}

const peer = async (ctx: Awaited<ReturnType<typeof setup>>) => {
  const repo = path.join(ctx.dir, `peer-${crypto.randomUUID()}`)
  await git(ctx.dir, "clone", ctx.bare, repo)
  await git(repo, "config", "user.email", "peer@example.com")
  await git(repo, "config", "user.name", "Peer Test")
  await git(repo, "switch", "--track", "-c", "dev", "origin/dev")
  return repo
}

afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

describe("release state transitions", () => {
  test("refuses a dirty tree created after the release commit", async () => {
    const ctx = await setup()
    const lineage = await gateRelease({ version: "1.1.0", cwd: ctx.repo, publication: async () => undefined })
    await Bun.write(path.join(ctx.repo, "version"), "1.1.0")
    const hook = path.join(ctx.repo, ".git", "hooks", "post-commit")
    await Bun.write(hook, "#!/bin/sh\nprintf dirty > version\n")
    await Bun.$`chmod +x ${hook}`

    await expect(
      prepareRelease({
        cwd: ctx.repo,
        version: "1.1.0",
        lineage,
        build: async () => {},
        verify: async () => {},
        manifest: async () => {},
        release: async () => {},
        upload: async () => {},
      }),
    ).rejects.toThrow("dirty after the release commit")
    expect(await git(ctx.repo, "tag", "--list", "v1.1.0")).toBe("")
  })

  test("refuses tracked source drift created by the build", async () => {
    const ctx = await setup()
    const lineage = await gateRelease({ version: "1.1.0", cwd: ctx.repo, publication: async () => undefined })
    await Bun.write(path.join(ctx.repo, "version"), "1.1.0")

    await expect(
      prepareRelease({
        cwd: ctx.repo,
        version: "1.1.0",
        lineage,
        build: async () => void (await Bun.write(path.join(ctx.repo, "version"), "build drift")),
        verify: async () => {},
        manifest: async () => {},
        release: async () => {},
        upload: async () => {},
      }),
    ).rejects.toThrow("modified tracked source")
    expect(await git(ctx.repo, "tag", "--list", "v1.1.0")).toBe("")
  })

  test("refuses a clean commit created by the build", async () => {
    const ctx = await setup()
    const lineage = await gateRelease({ version: "1.1.0", cwd: ctx.repo, publication: async () => undefined })
    await Bun.write(path.join(ctx.repo, "version"), "1.1.0")

    await expect(
      prepareRelease({
        cwd: ctx.repo,
        version: "1.1.0",
        lineage,
        build: async () => void (await commit(ctx.repo, "build-commit")),
        verify: async () => {},
        manifest: async () => {},
        release: async () => {},
        upload: async () => {},
      }),
    ).rejects.toThrow("Release build changed HEAD")
    expect(await git(ctx.repo, "tag", "--list", "v1.1.0")).toBe("")
  })

  test("refuses a pre-commit hook that changes the committed tree", async () => {
    const ctx = await setup()
    const lineage = await gateRelease({ version: "1.1.0", cwd: ctx.repo, publication: async () => undefined })
    await Bun.write(path.join(ctx.repo, "version"), "1.1.0")
    const hook = path.join(ctx.repo, ".git", "hooks", "pre-commit")
    await Bun.write(hook, "#!/bin/sh\nprintf hook > version\ngit add version\n")
    await Bun.$`chmod +x ${hook}`

    await expect(
      prepareRelease({
        cwd: ctx.repo,
        version: "1.1.0",
        lineage,
        build: async () => {},
        verify: async () => {},
        manifest: async () => {},
        release: async () => {},
        upload: async () => {},
      }),
    ).rejects.toThrow("commit tree does not match")
    expect(await git(ctx.repo, "tag", "--list", "v1.1.0")).toBe("")
  })

  test("refuses a post-commit hook that creates an extra clean commit", async () => {
    const ctx = await setup()
    const lineage = await gateRelease({ version: "1.1.0", cwd: ctx.repo, publication: async () => undefined })
    await Bun.write(path.join(ctx.repo, "version"), "1.1.0")
    const hook = path.join(ctx.repo, ".git", "hooks", "post-commit")
    await Bun.write(
      hook,
      '#!/bin/sh\nmarker="$(git rev-parse --git-dir)/release-extra"\nif [ ! -f "$marker" ]; then\n  touch "$marker"\n  git commit --allow-empty -m hook-extra\nfi\n',
    )
    await Bun.$`chmod +x ${hook}`

    await expect(
      prepareRelease({
        cwd: ctx.repo,
        version: "1.1.0",
        lineage,
        build: async () => {},
        verify: async () => {},
        manifest: async () => {},
        release: async () => {},
        upload: async () => {},
      }),
    ).rejects.toThrow("exactly one commit")
    expect(await git(ctx.repo, "tag", "--list", "v1.1.0")).toBe("")
  })

  test("refuses unexpected untracked source created during preparation", async () => {
    const ctx = await setup()
    const lineage = await gateRelease({ version: "1.1.0", cwd: ctx.repo, publication: async () => undefined })
    await Bun.write(path.join(ctx.repo, "version"), "1.1.0")

    await expect(
      prepareRelease({
        cwd: ctx.repo,
        version: "1.1.0",
        lineage,
        build: async () => void (await Bun.write(path.join(ctx.repo, "unexpected.ts"), "export {}")),
        verify: async () => {},
        manifest: async () => {},
        release: async () => {},
        upload: async () => {},
      }),
    ).rejects.toThrow("unexpected untracked source")
    expect(await git(ctx.repo, "tag", "--list", "v1.1.0")).toBe("")
  })

  test("does not mistake ignored build artifacts for source drift", async () => {
    const ctx = await setup()
    await Bun.write(path.join(ctx.repo, ".gitignore"), "artifact.tmp\n")
    await git(ctx.repo, "add", ".gitignore")
    await git(ctx.repo, "commit", "-m", "ignore build artifact")
    await git(ctx.repo, "push", "origin", "dev")
    const lineage = await gateRelease({ version: "1.1.0", cwd: ctx.repo, publication: async () => undefined })
    await Bun.write(path.join(ctx.repo, "version"), "1.1.0")

    const result = await prepareRelease({
      cwd: ctx.repo,
      version: "1.1.0",
      lineage,
      build: async () => void (await Bun.write(path.join(ctx.repo, "artifact.tmp"), "ignored")),
      verify: async () => {},
      manifest: async () => {},
      release: async () => {},
      upload: async () => {},
    })

    expect(result.source).toBe(await git(ctx.repo, "rev-parse", "v1.1.0^{commit}"))
    expect(await git(ctx.repo, "ls-remote", "origin", releaseStateRef)).toStartWith(result.source)
  })

  test("moves an existing release-state anchor during a subsequent release", async () => {
    const ctx = await setup()
    await git(ctx.repo, "push", "origin", `${ctx.base}:${releaseStateRef}`)
    const lineage = await gateRelease({ version: "1.1.0", cwd: ctx.repo, publication: async () => undefined })
    await Bun.write(path.join(ctx.repo, "version"), "1.1.0")

    const result = await prepareRelease({
      cwd: ctx.repo,
      version: "1.1.0",
      lineage,
      build: async () => {},
      verify: async () => {},
      manifest: async () => {},
      release: async () => {},
      upload: async () => {},
    })

    expect(await git(ctx.repo, "ls-remote", "origin", releaseStateRef)).toStartWith(result.source)
    expect(await git(ctx.repo, "ls-remote", "origin", "refs/tags/v1.1.0")).toStartWith(result.source)
  })

  test("lease failure keeps the losing release atomic and removes its local target tag", async () => {
    const ctx = await setup()
    await git(ctx.repo, "push", "origin", `${ctx.base}:${releaseStateRef}`)
    const other = await peer(ctx)
    const divergent = await commit(other, "concurrent-release")
    const hook = path.join(ctx.repo, ".git", "hooks", "pre-push")
    await Bun.write(
      hook,
      `#!/bin/sh\ngit -C "${other}" push --atomic origin "${divergent}:${releaseStateRef}" "${divergent}:refs/tags/v1.1.0"\n`,
    )
    await Bun.$`chmod +x ${hook}`
    const lineage = await gateRelease({ version: "1.2.0", cwd: ctx.repo, publication: async () => undefined })
    await Bun.write(path.join(ctx.repo, "version"), "1.2.0")

    await expect(
      prepareRelease({
        cwd: ctx.repo,
        version: "1.2.0",
        lineage,
        build: async () => {},
        verify: async () => {},
        manifest: async () => {},
        release: async () => {},
        upload: async () => {},
      }),
    ).rejects.toThrow("Atomic release push failed")

    expect(await git(ctx.repo, "tag", "--list", "v1.2.0")).toBe("")
    expect(await git(ctx.repo, "ls-remote", "origin", "refs/heads/dev")).toStartWith(ctx.base)
    expect(await git(ctx.repo, "ls-remote", "origin", "refs/tags/v1.2.0")).toBe("")
    expect(await git(ctx.repo, "ls-remote", "origin", releaseStateRef)).toStartWith(divergent)
    expect(await git(ctx.repo, "ls-remote", "origin", "refs/tags/v1.1.0")).toStartWith(divergent)
  })

  test("revalidates fresh remote release tags before creating or pushing the target tag", async () => {
    const ctx = await setup()
    const lineage = await gateRelease({ version: "1.2.0", cwd: ctx.repo, publication: async () => undefined })
    await Bun.write(path.join(ctx.repo, "version"), "1.2.0")

    await expect(
      prepareRelease({
        cwd: ctx.repo,
        version: "1.2.0",
        lineage,
        build: async () => {
          const other = await peer(ctx)
          const divergent = await commit(other, "divergent-release")
          await git(other, "push", "origin", `${divergent}:refs/tags/v1.1.0`)
        },
        verify: async () => {},
        manifest: async () => {},
        release: async () => {},
        upload: async () => {},
      }),
    ).rejects.toThrow("no longer the immediate semantic predecessor")
    expect(await git(ctx.repo, "tag", "--list", "v1.2.0")).toBe("")
    expect(await git(ctx.repo, "ls-remote", "origin", "refs/tags/v1.2.0")).toBe("")
    expect(await git(ctx.repo, "ls-remote", "origin", "refs/heads/dev")).toStartWith(ctx.base)
  })

  test("resumes a local release commit after failure before tag creation", async () => {
    const ctx = await setup()
    const lineage = await gateRelease({ version: "1.1.0", cwd: ctx.repo, publication: async () => undefined })
    await Bun.write(path.join(ctx.repo, "version"), "1.1.0")

    await expect(
      prepareRelease({
        cwd: ctx.repo,
        version: "1.1.0",
        lineage,
        build: async () => {},
        verify: async () => {},
        manifest: async () => {
          throw new Error("manifest failed")
        },
        release: async () => {},
        upload: async () => {},
      }),
    ).rejects.toThrow("manifest failed")
    const source = await git(ctx.repo, "rev-parse", "HEAD")
    expect(await git(ctx.repo, "tag", "--list", "v1.1.0")).toBe("")

    const resumed = await gateRelease({
      version: "1.1.0",
      cwd: ctx.repo,
      resume: true,
      publication: async () => undefined,
    })
    const result = await prepareRelease({
      cwd: ctx.repo,
      version: "1.1.0",
      lineage: resumed,
      resume: true,
      build: async () => {},
      verify: async () => {},
      manifest: async () => {},
      release: async () => {},
      upload: async () => {},
    })

    expect(result.source).toBe(source)
    expect(await git(ctx.repo, "rev-parse", "v1.1.0^{commit}")).toBe(source)
    expect(await git(ctx.repo, "ls-remote", "origin", "refs/tags/v1.1.0")).toStartWith(source)
    expect(await git(ctx.repo, "rev-list", "--count", "HEAD")).toBe("2")

    const options = {
      cwd: ctx.repo,
      version: "1.1.0",
      lineage: resumed,
      resume: true,
      build: async () => {},
      verify: async () => {},
      manifest: async () => {},
      release: async () => {},
      upload: async () => {},
    }
    const unexpected = path.join(ctx.repo, "unexpected.ts")
    await Bun.write(unexpected, "export {}")
    await expect(prepareRelease(options)).rejects.toThrow("unexpected untracked source")
    await rm(unexpected)
    await Bun.write(path.join(ctx.repo, "version"), "resume drift")
    await expect(prepareRelease(options)).rejects.toThrow("tracked source drift")
  })

  test("resumes after remote side effects without moving the commit or tag", async () => {
    const ctx = await setup()
    const events: string[] = []
    const lineage = await gateRelease({ version: "1.1.0", cwd: ctx.repo, publication: async () => undefined })
    await Bun.write(path.join(ctx.repo, "version"), "1.1.0")

    await expect(
      prepareRelease({
        cwd: ctx.repo,
        version: "1.1.0",
        lineage,
        build: async () => void events.push("build"),
        verify: async () => void events.push("verify"),
        manifest: async () => void events.push("manifest"),
        release: async () => void events.push("release"),
        upload: async () => {
          events.push("upload")
          throw new Error("upload failed")
        },
      }),
    ).rejects.toThrow("upload failed")

    const source = await git(ctx.repo, "rev-parse", "HEAD")
    expect(events).toEqual(["build", "verify", "manifest", "release", "upload"])
    expect(await git(ctx.repo, "rev-parse", "v1.1.0^{commit}")).toBe(source)
    expect(await git(ctx.repo, "ls-remote", "origin", "refs/tags/v1.1.0")).toStartWith(source)
    expect(await git(ctx.repo, "rev-list", "--count", "HEAD")).toBe("2")

    events.length = 0
    const resumed = await gateRelease({
      version: "1.1.0",
      cwd: ctx.repo,
      resume: true,
      publication: async () => undefined,
    })
    const result = await prepareRelease({
      cwd: ctx.repo,
      version: "1.1.0",
      lineage: resumed,
      resume: true,
      build: async () => void events.push("build"),
      verify: async () => void events.push("verify"),
      manifest: async (sha) => void events.push(`manifest:${sha}`),
      release: async () => void events.push("reuse-release"),
      upload: async () => void events.push("reupload-clobber"),
    })

    expect(result.source).toBe(source)
    expect(result.previous).toBe("v1.0.0")
    expect(events).toEqual(["build", "verify", `manifest:${source}`, "reuse-release", "reupload-clobber"])
    expect(await git(ctx.repo, "rev-list", "--count", "HEAD")).toBe("2")
    expect(await git(ctx.repo, "ls-remote", "origin", releaseStateRef)).toStartWith(source)
  })

  test("refuses a published resume when the release-state anchor is missing", async () => {
    const ctx = await setup()
    const source = await commit(ctx.repo, "published-without-state", "1.1.0")
    await git(ctx.repo, "tag", "v1.1.0")
    await git(ctx.repo, "push", "origin", "dev", "v1.1.0")

    await expect(
      gateRelease({ version: "1.1.0", cwd: ctx.repo, resume: true, publication: async () => undefined }),
    ).rejects.toThrow(`requires ${releaseStateRef}`)
  })

  test("accepts workflow provenance after dev advances beyond the tag", async () => {
    const ctx = await setup()
    const source = await commit(ctx.repo, "release", "1.1.0")
    await git(ctx.repo, "tag", "v1.1.0")
    await git(ctx.repo, "push", "origin", "dev", "v1.1.0")
    const other = await peer(ctx)
    await commit(other, "automation")
    await git(other, "push", "origin", "dev")

    await expect(
      gateLineage({
        mode: "verify",
        target: "v1.1.0",
        source,
        previous: "v1.0.0",
        cwd: ctx.repo,
      }),
    ).resolves.toMatchObject({ source, target: "v1.1.0", previous: "v1.0.0" })
  })

  test("rejects feature, dirty, mismatched-tag, and published-version resumes", async () => {
    const feature = await setup()
    await git(feature.repo, "switch", "-c", "feature")
    await expect(
      gateRelease({ version: "1.1.0", cwd: feature.repo, publication: async () => undefined }),
    ).rejects.toThrow('branch "dev"')

    const dirty = await setup()
    await Bun.write(path.join(dirty.repo, "dirty"), "dirty")
    await expect(
      gateRelease({ version: "1.1.0", cwd: dirty.repo, publication: async () => undefined }),
    ).rejects.toThrow("worktree is dirty")

    const mismatch = await setup()
    await git(mismatch.repo, "tag", "v1.1.0")
    const other = await peer(mismatch)
    const side = await commit(other, "other")
    await git(other, "tag", "-f", "v1.1.0", side)
    await git(other, "push", "origin", "v1.1.0")
    await expect(
      gateRelease({ version: "1.1.0", cwd: mismatch.repo, resume: true, publication: async () => undefined }),
    ).rejects.toThrow("differs locally")

    const published = await setup()
    await expect(
      gateRelease({
        version: "1.1.0",
        cwd: published.repo,
        resume: true,
        publication: async () => ({ name: "slopcode", version: "1.1.0" }),
      }),
    ).rejects.toThrow("foreign or unverifiable")
  })

  test("publication accepts only a clean detached verified source", async () => {
    const ctx = await setup()
    const source = await commit(ctx.repo, "release", "1.1.0")
    await git(ctx.repo, "tag", "v1.1.0")
    await git(ctx.repo, "push", "origin", "dev", "v1.1.0")
    const options = {
      version: "1.1.0",
      source,
      previous: "v1.0.0",
      cwd: ctx.repo,
      publication: async () => ({
        name: "slopcode",
        version: "1.1.0",
        gitHead: source,
        repository: { url: "git+https://github.com/teamslop/slopcode.git" },
        dist: {
          integrity: `sha512-${Buffer.alloc(64).toString("base64")}`,
          attestations: { url: "https://registry.npmjs.org/-/npm/v1/attestations/example" },
        },
        _npmUser: { trustedPublisher: { id: "github" } },
        provenanceTrusted: true,
      }),
    }

    await expect(gatePublication(options)).rejects.toThrow("clean detached checkout")
    await git(ctx.repo, "switch", "--detach", source)
    await expect(gatePublication(options)).resolves.toMatchObject({ source, previous: "v1.0.0" })
    await Bun.write(path.join(ctx.repo, "dirty"), "dirty")
    await expect(gatePublication(options)).rejects.toThrow("clean detached checkout")
  })

  test("publication allows no predecessor only for the first release", async () => {
    const first = await setup(false)
    const initial = await commit(first.repo, "first-release", "1.0.0")
    await git(first.repo, "tag", "v1.0.0")
    await git(first.repo, "push", "origin", "dev", "v1.0.0")
    await git(first.repo, "switch", "--detach", initial)
    await expect(
      gatePublication({
        version: "1.0.0",
        source: initial,
        cwd: first.repo,
        publication: async () => undefined,
      }),
    ).resolves.toMatchObject({ previous: undefined })

    const later = await setup()
    const source = await commit(later.repo, "later-release", "1.1.0")
    await git(later.repo, "tag", "v1.1.0")
    await git(later.repo, "push", "origin", "dev", "v1.1.0")
    await git(later.repo, "switch", "--detach", source)
    await expect(
      gatePublication({
        version: "1.1.0",
        source,
        cwd: later.repo,
        publication: async () => undefined,
      }),
    ).rejects.toThrow("requires previous tag provenance")
  })

  test("rejects v-prefixed versions before repository or registry access", async () => {
    let registry = false
    await expect(
      gateRelease({
        version: "v1.1.0",
        cwd: "/does/not/exist",
        publication: async () => {
          registry = true
          return undefined
        },
      }),
    ).rejects.toThrow('must not use a "v" prefix')
    expect(registry).toBe(false)
  })
})

describe("npm publication recovery", () => {
  const source = "a".repeat(40)
  const digest = "ab".repeat(64)
  const integrity = `sha512-${Buffer.from(digest, "hex").toString("base64")}`
  const items = {
    binaries: [{ name: "slopcode-bin-linux-x64", version: "1.1.0" }],
    main: { name: "slopcode", version: "1.1.0" },
    aliases: [{ name: "sloppycode", version: "1.1.0" }],
  }
  const metadata = (item: { name: string; version: string }): NpmPublication => ({
    ...item,
    gitHead: source,
    repository: { url: "git+https://github.com/teamslop/slopcode.git" },
    dist: {
      integrity,
      attestations: { url: `https://registry.npmjs.org/-/npm/v1/attestations/${item.name}@${item.version}` },
    },
    _npmUser: { trustedPublisher: { id: "github" } },
    provenanceTrusted: true,
  })
  const workflow = {
    repository: "https://github.com/teamslop/slopcode",
    path: ".github/workflows/publish.yml",
    ref: "refs/heads/dev",
  }
  const attestation = (
    options: {
      workflow?: { repository: string; path: string; ref: string }
      name?: string
      version?: string
      digest?: string
    } = {},
  ) => ({
    attestations: [
      {
        predicateType: "https://slsa.dev/provenance/v1",
        bundle: {
          dsseEnvelope: {
            payloadType: "application/vnd.in-toto+json",
            payload: Buffer.from(
              JSON.stringify({
                _type: "https://in-toto.io/Statement/v1",
                subject: [
                  {
                    name: `pkg:npm/${options.name ?? items.main.name}@${options.version ?? items.main.version}`,
                    digest: { sha512: options.digest ?? digest },
                  },
                ],
                predicateType: "https://slsa.dev/provenance/v1",
                predicate: {
                  buildDefinition: {
                    externalParameters: { workflow: options.workflow ?? workflow },
                  },
                },
              }),
            ).toString("base64"),
          },
        },
      },
    ],
  })
  const expected = { ...items.main, integrity }
  const verified = async (bundle: unknown) => bundle

  test("requires cryptographic verification with the exact GitHub Actions workflow identity", async () => {
    const calls: Array<{ certificateIssuer: string; certificateIdentityURI: string }> = []
    await expect(
      readNpmProvenance(attestation(), expected, async (bundle, options) => {
        calls.push(options)
        return bundle
      }),
    ).resolves.toBe(true)
    expect(calls).toEqual([
      {
        certificateIssuer: "https://token.actions.githubusercontent.com",
        certificateIdentityURI:
          "^https://github\\.com/teamslop/slopcode/\\.github/workflows/publish\\.yml@refs/heads/dev$",
      },
    ])
  })

  test("production verification delegates the bundle to the maintained Sigstore library", async () => {
    const release = await Bun.file(path.join(root, "packages/script/src/release.ts")).text()
    const verifier = await Bun.file(path.join(root, "packages/script/src/sigstore-verify.mjs")).text()
    expect(release).toContain('Bun.spawn(["node", fileURLToPath(new URL("./sigstore-verify.mjs", import.meta.url))]')
    expect(verifier).toContain('import { verify } from "sigstore"')
    expect(verifier).toContain("await verify(input.bundle, input.options)")
    expect(verifier).toContain("process.stdout.write(JSON.stringify(input.bundle))")
  })

  test("accepts npm's observed leading-slash workflow path encoding", async () => {
    await expect(
      readNpmProvenance(
        attestation({ workflow: { ...workflow, path: "/.github/workflows/publish.yml" } }),
        expected,
        verified,
      ),
    ).resolves.toBe(true)
  })

  test("does not trust an unsigned synthetic bundle in production", async () => {
    await expect(readNpmProvenance(attestation(), expected)).rejects.toThrow()
  })

  test("cannot accept a bundle rejected by certificate verification", async () => {
    await expect(
      readNpmProvenance(attestation(), expected, async () => {
        throw new Error("wrong certificate identity")
      }),
    ).rejects.toThrow("wrong certificate identity")
  })

  test.each([
    { workflow: { ...workflow, path: ".github/workflows/other.yml" } },
    { workflow: { ...workflow, ref: "refs/heads/main" } },
    { workflow: { ...workflow, repository: "https://github.com/other/slopcode" } },
    { name: "other" },
    { version: "9.9.9" },
    { digest: "cd".repeat(64) },
  ])("rejects a verified bundle with unrelated statement data: %o", async (options) => {
    await expect(readNpmProvenance(attestation(options), expected, verified)).resolves.toBe(false)
  })

  test("restricts attestation fetches to the configured registry's canonical endpoint", () => {
    expect(npmAttestationURL("https://registry.npmjs.org/custom", metadata(items.main)).href).toBe(
      `https://registry.npmjs.org/-/npm/v1/attestations/${items.main.name}@${items.main.version}`,
    )
    expect(() =>
      npmAttestationURL("https://registry.npmjs.org", {
        ...metadata(items.main),
        dist: {
          integrity,
          attestations: {
            url: `https://attacker.example/-/npm/v1/attestations/${items.main.name}@${items.main.version}`,
          },
        },
      }),
    ).toThrow("outside the configured registry")
  })

  test("polls until complete npm metadata and attestations are available", async () => {
    const states = [undefined, { ...metadata(items.main), provenanceTrusted: undefined }, metadata(items.main)]
    let sleeps = 0
    await verifyNpmPublications({
      items: [items.main],
      source,
      load: async () => states.shift(),
      timeout: 2,
      interval: 1,
      sleep: async () => void sleeps++,
    })
    expect(sleeps).toBe(2)
    expect(states).toHaveLength(0)
  })

  test("continues aliases and finalization after main package publication", async () => {
    const registry = new Map<string, NpmPublication>()
    const events: string[] = []
    let fail = true
    const publish = async (item: { name: string; version: string }) => {
      const hit = registry.get(item.name)
      if (hit) {
        verifyNpmPublication(hit, { ...item, source })
        events.push(`skip:${item.name}`)
        return
      }
      registry.set(item.name, metadata(item))
      events.push(`publish:${item.name}`)
      if (item.name === "slopcode" && fail) throw new Error("client lost after main")
    }
    const run = () =>
      publishNpmSequence({
        ...items,
        publish,
        verify: async (targets) => {
          targets.forEach((item) => verifyNpmPublication(registry.get(item.name)!, { ...item, source }))
          events.push(`verify:${targets.map((item) => item.name).join(",")}`)
        },
        finalize: async () => void events.push("finalize"),
      })

    await expect(run()).rejects.toThrow("client lost after main")
    fail = false
    await run()
    expect(events).toEqual([
      "publish:slopcode-bin-linux-x64",
      "verify:slopcode-bin-linux-x64",
      "publish:slopcode",
      "skip:slopcode-bin-linux-x64",
      "verify:slopcode-bin-linux-x64",
      "skip:slopcode",
      "verify:slopcode",
      "publish:sloppycode",
      "verify:sloppycode",
      "finalize",
    ])
  })

  test("cannot finalize until every npm target has verified provenance", async () => {
    const registry = new Map<string, NpmPublication>()
    let finalized = false

    await expect(
      publishNpmSequence({
        ...items,
        publish: async (item) => {
          registry.set(item.name, {
            ...metadata(item),
            gitHead: item.name === "sloppycode" ? "b".repeat(40) : source,
          })
        },
        verify: async (targets) => {
          targets.forEach((item) => verifyNpmPublication(registry.get(item.name)!, { ...item, source }))
        },
        finalize: async () => void (finalized = true),
      }),
    ).rejects.toThrow("foreign or unverifiable")
    expect(finalized).toBe(false)
  })

  test("rechecks all packages and idempotently completes after finalization loss", async () => {
    const registry = new Map<string, NpmPublication>()
    let finalized = false
    let lose = true
    const events: string[] = []
    const run = () =>
      publishNpmSequence({
        ...items,
        publish: async (item) => {
          const hit = registry.get(item.name)
          if (hit) {
            verifyNpmPublication(hit, { ...item, source })
            events.push(`skip:${item.name}`)
            return
          }
          registry.set(item.name, metadata(item))
          events.push(`publish:${item.name}`)
        },
        verify: async () => {},
        finalize: async () => {
          if (finalized) {
            events.push("already-finalized")
            return
          }
          finalized = true
          events.push("finalize")
          if (lose) throw new Error("client lost after finalization")
        },
      })

    await expect(run()).rejects.toThrow("client lost after finalization")
    lose = false
    await run()
    expect(events.slice(-4)).toEqual([
      "skip:slopcode-bin-linux-x64",
      "skip:slopcode",
      "skip:sloppycode",
      "already-finalized",
    ])
  })

  test("rejects an existing package with foreign provenance", () => {
    expect(() =>
      verifyNpmPublication({ ...metadata(items.main), gitHead: "b".repeat(40) }, { ...items.main, source }),
    ).toThrow("foreign or unverifiable")
  })
})

describe("workflow contracts", () => {
  test("publish gates release preparation before version mutation", async () => {
    const source = await Bun.file(path.join(root, "script/publish.ts")).text()
    expect(source.indexOf("await gateRelease(")).toBeLessThan(source.indexOf('if (mode !== "publish")'))
    expect(source).not.toContain("SLOPCODE_RELEASE_BASE_SHA")
  })

  test("uses exact dispatch identity and source checkout without binding the event SHA", async () => {
    const source = await Bun.file(path.join(root, ".github/workflows/publish.yml")).text()
    expect(source).toContain('run-name: "${{ inputs.dispatch_id }}"')
    expect(source).toMatch(/dispatch_id:\n\s+description:[\s\S]*?required: true/)
    expect(source).toContain("group: publish-release")
    expect(source.match(/ref: dev/g)).toHaveLength(3)
    expect(source.match(/Bootstrap candidate trust from canonical dev/g)).toHaveLength(3)
    expect(source.match(/git checkout --detach refs\/remotes\/origin\/dev/g)).toHaveLength(3)
    expect(
      source.match(
        /git fetch --force --no-tags origin[^\n]+\n\s+git checkout --detach refs\/remotes\/origin\/dev\n\s+test "\$\(git rev-parse HEAD\)" = "\$\(git rev-parse refs\/remotes\/origin\/dev\)"/g,
      ),
    ).toHaveLength(3)
    expect(source.match(/bun run --cwd packages\/script lineage verify/g)).toHaveLength(3)
    expect(source.match(/git checkout --detach "\$SOURCE"/g)).toHaveLength(2)
    expect(source.indexOf("Bootstrap candidate trust from canonical dev")).toBeLessThan(
      source.indexOf("uses: ./.github/actions/setup-bun"),
    )
    expect(source).toContain("lineage verify")
    expect(source).toContain("artifact-manifest.ts verify")
    expect(source).not.toContain('test "$GITHUB_SHA" = "${{ inputs.source_sha }}"')
  })

  test("supports an empty predecessor only for first-release workflow dispatch", async () => {
    const workflow = await Bun.file(path.join(root, ".github/workflows/publish.yml")).text()
    const dispatcher = await Bun.file(path.join(root, "script/release.ts")).text()
    const publisher = await Bun.file(path.join(root, "script/publish.ts")).text()

    expect(workflow).toMatch(/previous_tag:\n\s+description:[^\n]+\n\s+required: false\n\s+default: ""/)
    expect(workflow.match(/--require-previous-if-any/g)).toHaveLength(3)
    expect(workflow.match(/if \[ -n "\$PREVIOUS" \]; then args\+=\(--previous-tag "\$PREVIOUS"\); fi/g)).toHaveLength(3)
    expect(dispatcher).toContain("previous_tag?: string")
    expect(dispatcher).toContain(
      'const previous = prepared.previous_tag ? ["-f", `previous_tag=${prepared.previous_tag}`] : []',
    )
    expect(dispatcher).not.toContain("previous_tag=${prepared.previous_tag} -f dispatch_id")
    expect(publisher).toContain("previous_tag: prepared.previous")
  })

  test("uses frozen installs, OIDC npm publishing, and least-privilege job permissions", async () => {
    const workflow = await Bun.file(path.join(root, ".github/workflows/publish.yml")).text()
    const publish = workflow.slice(workflow.indexOf("  publish:"))
    const script = await Bun.file(path.join(root, "script/publish.ts")).text()

    expect(workflow.match(/install-flags: --frozen-lockfile/g)).toHaveLength(3)
    expect(script).not.toMatch(/bun install`/)
    expect(script.match(/bun install --frozen-lockfile/g)).toHaveLength(2)
    expect(workflow).not.toContain("NPM_TOKEN")
    expect(workflow).not.toContain("NODE_AUTH_TOKEN")
    expect(workflow).not.toContain("_authToken")
    expect(workflow.slice(0, workflow.indexOf("jobs:"))).toContain("contents: read")
    expect(workflow.slice(0, workflow.indexOf("jobs:"))).not.toContain("id-token: write")
    expect(publish).toContain("id-token: write")
    expect(publish).toContain("contents: read")
    expect(publish).not.toContain("contents: write")
    expect(publish).not.toContain("packages: write")
  })

  test("cleans and installs dependencies from detached verified source before build or publication", async () => {
    const workflow = await Bun.file(path.join(root, ".github/workflows/publish.yml")).text()
    const build = workflow.slice(workflow.indexOf("  build-tauri:"), workflow.indexOf("  publish:"))
    const publish = workflow.slice(workflow.indexOf("  publish:"))

    expect(workflow.match(/Install verified source dependencies/g)).toHaveLength(2)
    for (const job of [build, publish]) {
      const detach = job.indexOf('git checkout --detach "$SOURCE"')
      const install = job.indexOf("- name: Install verified source dependencies")
      expect(detach).toBeGreaterThan(-1)
      expect(install).toBeGreaterThan(detach)
      expect(job.slice(install)).toContain("git clean -ffdx")
      expect(job.slice(install)).toContain("bun install --frozen-lockfile")
    }
    expect(build.indexOf("apple-actions/import-codesign-certs")).toBeGreaterThan(
      build.indexOf("- name: Install verified source dependencies"),
    )
    expect(publish.indexOf("actions/setup-node")).toBeGreaterThan(
      publish.indexOf("- name: Install verified source dependencies"),
    )
    expect(publish.indexOf("run: ./script/publish.ts")).toBeGreaterThan(
      publish.indexOf("- name: Install verified source dependencies"),
    )
  })

  test("release npm verification loads and verifies complete provenance before returning", async () => {
    const source = await Bun.file(path.join(root, "packages/slopcode/script/publish.ts")).text()
    expect(source).toContain("await verifyNpmPublications({")
    expect(source).toContain("load: (item) => loadNpmPublication(registry, item.name, item.version)")
    expect(source.indexOf("await verifyNpmPublications({")).toBeLessThan(source.indexOf("await verifyAptParity()"))
  })

  test("matches only the exact unique dispatch run", () => {
    const id = dispatchID("1.2.3", "a".repeat(40))
    expect(id).toBe(`release-1.2.3-${"a".repeat(40)}`)
    const runs = [
      { databaseId: 1, displayTitle: "release-1.2.3-other" },
      { databaseId: 2, displayTitle: "release-1.2.3-exact" },
    ]
    expect(findDispatch(runs, "release-1.2.3-exact")?.databaseId).toBe(2)
    expect(findDispatch(runs, "release-1.2.3-missing")).toBeUndefined()
    expect(dispatchPlan()).toBe("dispatch")
    expect(dispatchPlan({ status: "queued" })).toBe("wait")
    expect(dispatchPlan({ status: "completed", conclusion: "success" })).toBe("success")
    expect(dispatchPlan({ status: "completed", conclusion: "failure" })).toBe("rerun")
  })

  test("recovers when dispatch was accepted but the client lost the response", () => {
    const id = dispatchID("1.2.3", "a".repeat(40))
    expect(dispatchPlan(findDispatch([], id))).toBe("dispatch")
    const accepted = [{ displayTitle: id, status: "queued" }]
    expect(dispatchPlan(findDispatch(accepted, id))).toBe("wait")
    const completed = [{ displayTitle: id, status: "completed", conclusion: "success" }]
    expect(dispatchPlan(findDispatch(completed, id))).toBe("success")
  })
})

describe("release artifact manifest", () => {
  test("binds artifact checksums to source and version", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "slopcode-artifacts-"))
    dirs.push(dir)
    await Bun.write(path.join(dir, "slopcode-cli-dist.tar.gz"), "artifact")

    const manifest = await writeManifest(dir, "a".repeat(40), "1.2.3")
    expect(manifest.artifacts).toHaveLength(1)
    expect(await Bun.file(path.join(dir, manifestName)).exists()).toBe(true)
    await expect(verifyManifest(dir, "a".repeat(40), "1.2.3", ["slopcode-cli-dist.tar.gz"])).resolves.toMatchObject({
      source_sha: "a".repeat(40),
      version: "1.2.3",
    })

    await Bun.write(path.join(dir, "slopcode-cli-dist.tar.gz"), "tampered")
    await expect(verifyManifest(dir, "a".repeat(40), "1.2.3", ["slopcode-cli-dist.tar.gz"])).rejects.toThrow(
      "checksum mismatch",
    )
  })
})
