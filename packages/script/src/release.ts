import { gateLineage, LineageError, releaseStateRef, revalidateLineageHistory, type LineageResult } from "./lineage"
import { fileURLToPath } from "node:url"

const run = async (cwd: string, args: string[]) => {
  const proc = Bun.spawn(["git", ...args], { cwd, stdout: "pipe", stderr: "pipe" })
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

const ancestor = async (cwd: string, older: string, newer: string) => {
  const result = await run(cwd, ["merge-base", "--is-ancestor", older, newer])
  if (result.code === 0) return true
  if (result.code === 1) return false
  throw new Error(`Could not compare release commits: ${result.stderr || `git exited with ${result.code}`}`)
}

export type NpmPublication = {
  name?: string
  version?: string
  gitHead?: string
  repository?: string | { url?: string }
  dist?: { integrity?: string; attestations?: { url?: string } }
  _npmUser?: { trustedPublisher?: { id?: string } }
  provenanceTrusted?: boolean
}

export type NpmAttestations = {
  attestations?: Array<{ predicateType?: string; bundle?: unknown }>
}

type NpmFetch = (input: string | URL) => Promise<Response>

export type NpmProvenanceVerifier = (
  bundle: unknown,
  options: { certificateIssuer: string; certificateIdentityURI: string },
) => Promise<unknown>

const issuer = "https://token.actions.githubusercontent.com"
const identity = "^https://github\\.com/teamslop/slopcode/\\.github/workflows/publish\\.yml@refs/heads/dev$"

const object = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null
const text = (value: unknown) => (typeof value === "string" ? value : undefined)

const parsePublication = (value: unknown): NpmPublication => {
  if (!object(value)) return {}
  const repository =
    typeof value.repository === "string"
      ? value.repository
      : object(value.repository)
        ? { url: text(value.repository.url) }
        : undefined
  const dist = object(value.dist) ? value.dist : undefined
  const attestations = dist && object(dist.attestations) ? dist.attestations : undefined
  const user = object(value._npmUser) ? value._npmUser : undefined
  const publisher = user && object(user.trustedPublisher) ? user.trustedPublisher : undefined
  return {
    name: text(value.name),
    version: text(value.version),
    gitHead: text(value.gitHead),
    repository,
    dist: dist
      ? {
          integrity: text(dist.integrity),
          attestations: attestations ? { url: text(attestations.url) } : undefined,
        }
      : undefined,
    _npmUser: user ? { trustedPublisher: publisher ? { id: text(publisher.id) } : undefined } : undefined,
  }
}

const parseAttestations = (value: unknown): NpmAttestations => {
  if (!object(value) || !Array.isArray(value.attestations)) return {}
  return {
    attestations: value.attestations.flatMap((item) =>
      object(item) ? [{ predicateType: text(item.predicateType), bundle: item.bundle }] : [],
    ),
  }
}

const verifyBundle: NpmProvenanceVerifier = async (bundle, options) => {
  if (
    !object(bundle) ||
    !object(bundle.verificationMaterial) ||
    !object(bundle.dsseEnvelope) ||
    !Array.isArray(bundle.dsseEnvelope.signatures) ||
    bundle.dsseEnvelope.signatures.length === 0
  ) {
    throw new Error("npm provenance bundle is unsigned or incomplete")
  }
  const proc = Bun.spawn(["node", fileURLToPath(new URL("./sigstore-verify.mjs", import.meta.url))], {
    stdin: "pipe",
    stdout: "pipe",
    stderr: "pipe",
  })
  proc.stdin.write(JSON.stringify({ bundle, options }))
  await proc.stdin.end()
  const [stdout, stderr, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ])
  if (code !== 0) throw new Error(`npm provenance cryptographic verification failed: ${stderr.trim()}`)
  const verified: unknown = JSON.parse(stdout)
  return verified
}

const sha512 = (integrity: string) => {
  const match = integrity.match(/^sha512-([A-Za-z0-9+/]+={0,2})$/)
  if (!match) return
  const digest = Buffer.from(match[1], "base64")
  if (digest.length !== 64 || digest.toString("base64") !== match[1]) return
  return digest.toString("hex")
}

const trustedStatement = (bundle: unknown, expected: { name: string; version: string; integrity: string }) => {
  if (!object(bundle) || !object(bundle.dsseEnvelope)) return false
  if (bundle.dsseEnvelope.payloadType !== "application/vnd.in-toto+json") return false
  const payload = text(bundle.dsseEnvelope.payload)
  if (!payload) return false
  const statement: unknown = JSON.parse(Buffer.from(payload, "base64").toString())
  if (!object(statement) || statement._type !== "https://in-toto.io/Statement/v1") return false
  if (statement.predicateType !== "https://slsa.dev/provenance/v1") return false
  if (!Array.isArray(statement.subject) || statement.subject.length !== 1) return false
  const subject = statement.subject[0]
  if (!object(subject) || subject.name !== `pkg:npm/${expected.name}@${expected.version}`) return false
  if (!object(subject.digest) || subject.digest.sha512 !== sha512(expected.integrity)) return false
  if (!object(statement.predicate) || !object(statement.predicate.buildDefinition)) return false
  const external = statement.predicate.buildDefinition.externalParameters
  if (!object(external) || !object(external.workflow)) return false
  const path = text(external.workflow.path)
  const canonical = path?.startsWith("/") ? path.slice(1) : path
  return (
    external.workflow.repository === "https://github.com/teamslop/slopcode" &&
    canonical === ".github/workflows/publish.yml" &&
    external.workflow.ref === "refs/heads/dev"
  )
}

export async function readNpmProvenance(
  data: NpmAttestations,
  expected: { name: string; version: string; integrity: string },
  verifier: NpmProvenanceVerifier = verifyBundle,
): Promise<boolean | undefined> {
  const attestations = data.attestations?.filter((item) => item.predicateType === "https://slsa.dev/provenance/v1")
  if (!attestations?.length) return undefined
  for (const item of attestations) {
    const bundle = await verifier(item.bundle, { certificateIssuer: issuer, certificateIdentityURI: identity })
    if (trustedStatement(bundle, expected)) return true
  }
  return false
}

export async function readNpmPublication(registry: string, name: string, version: string, request: NpmFetch = fetch) {
  const path = encodeURIComponent(name).replace(/^%40/, "@")
  const response = await request(`${registry.replace(/\/$/, "")}/${path}/${version}`)
  if (response.status === 404) return
  if (response.ok) return parsePublication(await response.json())
  throw new Error(`Could not verify npm release state: ${response.status} ${response.statusText}`)
}

export function npmAttestationURL(registry: string, publication: NpmPublication) {
  const url = publication.dist?.attestations?.url
  if (!url || !publication.name || !publication.version) throw new Error("npm attestation metadata is incomplete")
  const path = encodeURIComponent(publication.name).replace(/^%40/, "@")
  const expected = new URL(
    `/-/npm/v1/attestations/${path}@${encodeURIComponent(publication.version)}`,
    new URL(registry).origin,
  )
  const actual = new URL(url)
  if (actual.href !== expected.href) {
    throw new Error(`Refuse npm attestation URL outside the configured registry: ${actual.href}`)
  }
  return actual
}

export async function loadNpmPublication(
  registry: string,
  name: string,
  version: string,
  options: { request?: NpmFetch; verifier?: NpmProvenanceVerifier } = {},
) {
  const request = options.request ?? fetch
  const publication = await readNpmPublication(registry, name, version, request)
  if (!publication?.dist?.attestations?.url) return publication
  const url = npmAttestationURL(registry, publication)
  const response = await request(url)
  if (response.status === 404) return publication
  if (!response.ok) throw new Error(`Could not verify npm provenance: ${response.status} ${response.statusText}`)
  if (!publication.name || !publication.version || !publication.dist.integrity) return publication
  publication.provenanceTrusted = await readNpmProvenance(
    parseAttestations(await response.json()),
    { name: publication.name, version: publication.version, integrity: publication.dist.integrity },
    options.verifier,
  )
  return publication
}

const npmPublication = (version: string) =>
  loadNpmPublication(process.env.npm_config_registry ?? "https://registry.npmjs.org", "slopcode", version)

export function verifyNpmPublication(
  publication: NpmPublication,
  expected: { name: string; version: string; source: string },
) {
  const repository = typeof publication.repository === "string" ? publication.repository : publication.repository?.url
  const canonical = repository
    ?.replace(/^git\+/, "")
    .replace(/\.git$/, "")
    .replace(/\/$/, "")
  if (
    publication.name !== expected.name ||
    publication.version !== expected.version ||
    publication.gitHead !== expected.source ||
    canonical !== "https://github.com/teamslop/slopcode" ||
    !publication.dist?.integrity ||
    !publication.dist?.attestations?.url ||
    publication._npmUser?.trustedPublisher?.id !== "github" ||
    publication.provenanceTrusted !== true
  ) {
    throw new Error(
      `Refuse foreign or unverifiable npm publication for ${expected.name}@${expected.version}; expected source ${expected.source} with SlopCode repository metadata and npm provenance.`,
    )
  }
  return publication
}

const ready = (publication?: NpmPublication) =>
  !!publication?.name &&
  !!publication.version &&
  !!publication.gitHead &&
  !!publication.repository &&
  !!publication.dist?.integrity &&
  !!publication.dist?.attestations?.url &&
  !!publication._npmUser?.trustedPublisher?.id &&
  publication.provenanceTrusted !== undefined

export async function verifyNpmPublications<T extends { name: string; version: string }>(options: {
  items: T[]
  source: string
  load: (item: T) => Promise<NpmPublication | undefined>
  timeout: number
  interval: number
  sleep?: (ms: number) => Promise<void>
}) {
  const loop = async (left: number): Promise<void> => {
    const publications = await Promise.all(
      options.items.map(async (item) => ({ item, value: await options.load(item) })),
    )
    const pending = publications.filter((item) => !ready(item.value))
    publications
      .filter((item): item is { item: T; value: NpmPublication } => ready(item.value))
      .forEach((item) => verifyNpmPublication(item.value, { ...item.item, source: options.source }))
    if (!pending.length) return
    if (left <= 0) {
      throw new Error(
        `npm provenance verification timed out: ${pending.map((item) => `${item.item.name}@${item.item.version}`).join(", ")}`,
      )
    }
    const next = Math.min(options.interval, left)
    await (options.sleep ?? Bun.sleep)(next)
    return loop(left - next)
  }
  await loop(options.timeout)
}

const version = (value: string) => {
  if (value.startsWith("v")) throw new Error(`Release version must not use a "v" prefix: ${value}`)
  return value
}

export async function gateRelease(options: {
  version: string
  cwd?: string
  remote?: string
  branch?: string
  resume?: boolean
  publication?: (version: string) => Promise<NpmPublication | undefined>
}) {
  version(options.version)
  const result = await gateLineage({
    mode: "release",
    target: options.version,
    cwd: options.cwd,
    remote: options.remote,
    branch: options.branch,
    resume: options.resume,
  })
  const publication = await (options.publication ?? npmPublication)(options.version)
  if (publication && !options.resume) {
    throw new Error(`npm package slopcode@${options.version} is already published; use explicit resume only.`)
  }
  if (publication)
    verifyNpmPublication(publication, { name: "slopcode", version: options.version, source: result.source })
  return result
}

export async function gatePublication(options: {
  version: string
  source?: string
  previous?: string
  cwd?: string
  remote?: string
  branch?: string
  publication?: (version: string) => Promise<NpmPublication | undefined>
}) {
  version(options.version)
  if (!options.source) throw new Error("Release publication requires source SHA provenance.")
  const cwd = options.cwd ?? process.cwd()
  const result = await gateLineage({
    mode: "verify",
    target: options.version,
    source: options.source,
    previous: options.previous,
    cwd,
    remote: options.remote,
    branch: options.branch,
  })
  if (!options.previous && result.previous) {
    throw new Error(`Release publication requires previous tag provenance for ${result.previous}.`)
  }
  const head = await resolve(cwd, "HEAD")
  const current = (await run(cwd, ["symbolic-ref", "--quiet", "--short", "HEAD"])).stdout
  const dirty = await git(cwd, ["status", "--porcelain", "--untracked-files=all"])
  if (head !== result.source || current || dirty) {
    throw new Error("Release publication requires a clean detached checkout at the verified tag source.")
  }
  const publication = await (options.publication ?? npmPublication)(options.version)
  if (publication)
    verifyNpmPublication(publication, { name: "slopcode", version: options.version, source: result.source })
  return result
}

export const findDispatch = <T extends { displayTitle?: string }>(runs: T[], id: string) =>
  runs.find((item) => item.displayTitle === id)

export const dispatchID = (version: string, source: string) => `release-${version}-${source}`

export const dispatchPlan = (run?: { status: string; conclusion?: string }) => {
  if (!run) return "dispatch" as const
  if (run.status !== "completed") return "wait" as const
  if (run.conclusion === "success") return "success" as const
  return "rerun" as const
}

export async function publishNpmSequence<T extends { name: string; version: string }>(options: {
  binaries: T[]
  main: T
  aliases: T[]
  publish: (item: T) => Promise<void>
  verify: (items: T[]) => Promise<void>
  finalize: () => Promise<void>
}) {
  for (const item of options.binaries) await options.publish(item)
  await options.verify(options.binaries)
  await options.publish(options.main)
  await options.verify([options.main])
  for (const item of options.aliases) await options.publish(item)
  await options.verify(options.aliases)
  await options.finalize()
}

export async function prepareRelease(options: {
  cwd: string
  version: string
  lineage: LineageResult
  resume?: boolean
  build: () => Promise<void>
  verify: () => Promise<void>
  manifest: (source: string) => Promise<void>
  release: (source: string) => Promise<void>
  upload: (source: string) => Promise<void>
}) {
  const tree = async () => {
    const stash = await git(options.cwd, ["stash", "create"])
    return git(options.cwd, ["rev-parse", stash ? `${stash}^{tree}` : "HEAD^{tree}"])
  }
  const original = await git(options.cwd, ["rev-parse", "HEAD"])
  const base = await git(options.cwd, ["rev-parse", "HEAD^{tree}"])
  const expected = await tree()
  const unknown = await git(options.cwd, ["ls-files", "--others", "--exclude-standard"])
  if (original !== options.lineage.source) {
    throw new Error(`Release preparation source changed: expected ${options.lineage.source}, got ${original}`)
  }
  if (unknown) throw new Error(`Release preparation contains unexpected untracked source: ${unknown}`)
  if (options.resume && expected !== base) {
    throw new Error("Resume preparation contains tracked source drift from the exact verified release source.")
  }

  await options.build()
  await options.verify()

  const tag = `v${options.version.replace(/^v/, "")}`
  const built = await git(options.cwd, ["rev-parse", "HEAD"])
  if (built !== original) {
    throw new Error(`Release build changed HEAD from ${original} to ${built}; preparation cannot create commits.`)
  }
  const created = await git(options.cwd, ["ls-files", "--others", "--exclude-standard"])
  if (created) throw new Error(`Release build created unexpected untracked source: ${created}`)
  if ((await tree()) !== expected) {
    throw new Error("Release build or verification modified tracked source outside the captured version preparation.")
  }

  if (!options.resume && expected !== base) {
    await git(options.cwd, ["add", "-u"])
    const staged = await git(options.cwd, ["write-tree"])
    if (staged !== expected) throw new Error("Release staging does not match the captured version preparation tree.")
    await git(options.cwd, ["commit", "-m", `release: ${tag}`])
  }

  const source = await git(options.cwd, ["rev-parse", "HEAD"])
  const dirty = await git(options.cwd, ["status", "--porcelain", "--untracked-files=all"])
  if (dirty)
    throw new Error("Release source is dirty after the release commit; refuse to tag artifacts from another tree.")
  if (options.resume && source !== original) {
    throw new Error(`Resume source changed after verification: expected ${options.lineage.source}, got ${source}`)
  }
  if (!options.resume && expected !== base) {
    const committed = await git(options.cwd, ["rev-parse", "HEAD^{tree}"])
    if (committed !== expected) {
      throw new Error("Release commit tree does not match the captured version preparation tree.")
    }
    const parents = (await git(options.cwd, ["rev-list", "--parents", "-n", "1", source])).split(" ")
    if (parents.length !== 2 || parents[1] !== original) {
      throw new Error(`Release preparation must create exactly one commit whose parent is ${original}.`)
    }
  } else if (source !== original) {
    throw new Error(`Release preparation unexpectedly changed HEAD from ${original} to ${source}.`)
  }
  await options.manifest(source)

  const fresh = await revalidateLineageHistory({
    target: options.version,
    source,
    previous: options.lineage.previous,
    cwd: options.cwd,
    remote: options.lineage.remote,
    branch: options.lineage.branch,
    resume: options.resume,
  })
  const local = await resolve(options.cwd, `refs/tags/${tag}`)
  if (local && local !== source) {
    throw new LineageError([
      {
        code: "tag-source",
        message: `Target tag "${tag}" resolves locally to ${local}, not prepared source ${source}.`,
      },
    ])
  }
  const createdTag = !local
  if (createdTag) await git(options.cwd, ["tag", tag, source])

  const upstream = fresh.upstream
  const remote = fresh.targetSha
  if (remote && remote !== source) {
    throw new LineageError([
      {
        code: "tag-source",
        message: `Target tag "${tag}" resolves remotely to ${remote}, not prepared source ${source}.`,
      },
    ])
  }

  if (!remote) {
    const branch = (await ancestor(options.cwd, upstream, source))
      ? source
      : (await ancestor(options.cwd, source, upstream))
        ? upstream
        : undefined
    if (!branch) throw new Error(`Prepared source ${source} has diverged from fresh remote dev ${upstream}.`)
    const pushed = await run(options.cwd, [
      "push",
      "--atomic",
      `--force-with-lease=${releaseStateRef}:${fresh.stateSha ?? ""}`,
      options.lineage.remote,
      `${branch}:refs/heads/${options.lineage.branch}`,
      `refs/tags/${tag}:refs/tags/${tag}`,
      `${source}:${releaseStateRef}`,
    ])
    if (pushed.code !== 0) {
      if (createdTag) await git(options.cwd, ["tag", "-d", tag])
      throw new Error(
        `Atomic release push failed; ${releaseStateRef} changed or another ref was rejected: ${pushed.stderr || `exit code ${pushed.code}`}`,
      )
    }
  } else if (!(await ancestor(options.cwd, source, upstream))) {
    throw new Error(`Published target tag ${tag} is not an ancestor of fresh remote dev ${upstream}.`)
  }

  await options.release(source)
  await options.upload(source)
  return { version: options.version.replace(/^v/, ""), source, tag, previous: options.lineage.previous }
}
