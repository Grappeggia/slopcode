#!/usr/bin/env bun

import { $ } from "bun"

const args = process.argv.slice(2)
const dry = args.includes("--dry-run")
const value = args.find((item) => !item.startsWith("--"))
const invalid = args.filter((item) => item.startsWith("--") && item !== "--dry-run")
const ref = process.env.SLOPCODE_RELEASE_REF ?? "dev"

if (!value || invalid.length > 0) {
  console.log(
    [
      "Usage: bun run release <patch|minor|major|version> [--dry-run]",
      "",
      "Examples:",
      "  bun run release patch",
      "  bun run release minor",
      "  bun run release 1.2.3",
    ].join("\n"),
  )
  process.exit(1)
}

const key = ["major", "minor", "patch"].includes(value) ? "bump" : "version"
const repo = process.env.GH_REPO ?? (ref === "beta" ? "teamslop/slopcode-beta" : "teamslop/slopcode")
const env: Record<string, string | undefined> = {
  ...process.env,
  GH_REPO: repo,
  SLOPCODE_RELEASE: "local",
}
if (key === "bump") {
  env.SLOPCODE_BUMP = value
} else {
  env.SLOPCODE_VERSION = value
}

const version = (
  await $`bun --eval ${"console.log = () => {}; const { Script } = await import('@slopcode-ai/script'); process.stdout.write(Script.version)"}`
    .env(env)
    .text()
).trim()
if (!version) {
  throw new Error("Could not resolve release version")
}

const prep = {
  command: "bun ./script/publish.ts",
  env: {
    GH_REPO: env.GH_REPO,
    SLOPCODE_RELEASE: env.SLOPCODE_RELEASE,
    SLOPCODE_BUMP: env.SLOPCODE_BUMP,
    SLOPCODE_VERSION: env.SLOPCODE_VERSION,
    SLOPCODE_PREPARE_ONLY: "true",
  },
}
const publish = {
  command: `gh workflow run publish.yml --ref ${ref} -f version=${version}`,
  ref,
  repo,
  input: {
    version,
  },
}

const parse = <T>(text: string) => JSON.parse(text) as T

const runWait = 120000
const runPoll = 5000
const completionWait = 7200000
const completionPoll = 15000

if (dry) {
  console.log(
    JSON.stringify(
      {
        prepare: prep,
        publish,
      },
      null,
      2,
    ),
  )
  process.exit(0)
}

if (process.platform !== "linux") {
  throw new Error("Release prep must run on Linux so Debian artifacts are generated.")
}

const dirty = (await $`git status --porcelain`.text()).trim()
if (dirty) {
  throw new Error("Release from a clean worktree only. Commit or stash changes first.")
}

await $`git fetch origin ${ref}`
const behind = Number((await $`git rev-list --count HEAD..origin/${ref}`.text()).trim() || "0")
if (behind > 0) {
  throw new Error(`Branch is behind origin/${ref}. Rebase or fast-forward before releasing.`)
}

const sha = (await $`git rev-parse HEAD`.text()).trim()

await $`bun ./script/publish.ts`.env({
  ...env,
  SLOPCODE_PREPARE_ONLY: "true",
})
await $`gh workflow run publish.yml --ref ${ref} -f version=${version}`

const waitForRun = async (left: number): Promise<{ databaseId: number; url?: string }> => {
  const runs = parse<Array<{ databaseId: number; headSha?: string; url?: string }>>(
    await $`gh run list --workflow publish.yml --branch ${ref} --json databaseId,headSha,url`.text(),
  )
  const hit = runs.find((item) => item.headSha === sha)
  if (hit) return hit
  if (left <= 0) {
    throw new Error(`Timed out waiting for publish.yml run for ${sha}`)
  }
  const next = Math.min(runPoll, left)
  await Bun.sleep(next)
  return waitForRun(left - next)
}

const waitForCompletion = async (id: number, left: number): Promise<string> => {
  const run = parse<{ status: string; conclusion?: string; url?: string }>(
    await $`gh run view ${id} --json status,conclusion,url`.text(),
  )
  if (run.status === "completed") {
    if (run.conclusion !== "success") {
      throw new Error(`publish.yml failed: ${run.url ?? `run ${id}`} (${run.conclusion ?? "unknown"})`)
    }
    return run.url ?? `run ${id}`
  }
  if (left <= 0) {
    throw new Error(`Timed out waiting for publish.yml to finish: ${run.url ?? `run ${id}`}`)
  }
  const next = Math.min(completionPoll, left)
  await Bun.sleep(next)
  return waitForCompletion(id, left - next)
}

const run = await waitForRun(runWait)
const url = await waitForCompletion(run.databaseId, completionWait)
console.log(
  [`Prepared release assets locally for ${version}.`, `publish.yml completed on ${ref}.`, `Run: ${url}`].join("\n"),
)
