#!/usr/bin/env bun

import { $ } from "bun"
import path from "node:path"
import os from "node:os"
import { dispatchID, dispatchPlan, findDispatch, gateRelease } from "@slopcode-ai/script/release"

const args = process.argv.slice(2)
const dry = args.includes("--dry-run")
const resume = args.includes("--resume")
const value = args.find((item) => !item.startsWith("--"))
const invalid = args.filter((item) => item.startsWith("--") && item !== "--dry-run" && item !== "--resume")
const ref = "dev"

if (!value || invalid.length > 0) {
  console.log(
    [
      "Usage: bun run release <patch|minor|major|version> [--dry-run]",
      "       bun run release <version> --resume",
      "",
      "Examples:",
      "  bun run release patch",
      "  bun run release minor",
      "  bun run release 1.2.3",
      "  bun run release 1.2.3 --resume  # recover the same unpublished explicit target",
    ].join("\n"),
  )
  process.exit(1)
}

const key = ["major", "minor", "patch"].includes(value) ? "bump" : "version"
if (key === "version" && value.startsWith("v")) {
  throw new Error(`Release version must not use a "v" prefix: ${value}`)
}
if (resume && key === "bump") {
  throw new Error("Release resume requires an explicit semantic version, not a bump name.")
}
const repo = process.env.GH_REPO ?? "teamslop/slopcode"
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

const parse = <T>(text: string) => JSON.parse(text) as T

const runWait = 120000
const runPoll = 5000
const completionWait = 7200000
const completionPoll = 15000

if (dry) {
  console.log(
    JSON.stringify(
      {
        dry_run: true,
        target: version,
        resume,
        side_effects: "none",
        summary: resume
          ? "Would validate the existing target tag/source and immediate predecessor, verify any partial npm publication provenance, rebuild from that source, reuse a draft release, upload checksummed assets, and recover the deterministic publish run."
          : "Would verify the clean exact origin/dev lineage and unpublished target, mutate versions, build and verify assets, atomically push dev plus one tag, create a draft release, upload checksummed assets, and dispatch publishing.",
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

const lineage = await gateRelease({ version, remote: "origin", branch: ref, resume })

type Run = {
  databaseId: number
  displayTitle?: string
  status: string
  conclusion?: string
  url?: string
}

const getRun = async (dispatch: string) =>
  findDispatch(
    parse<Run[]>(
      await $`gh run list --workflow publish.yml --branch ${ref} --json databaseId,displayTitle,status,conclusion,url --limit 100`.text(),
    ),
    dispatch,
  )

async function waitForRun(dispatch: string, left: number): Promise<Run> {
  const hit = await getRun(dispatch)
  if (hit) return hit
  if (left <= 0) throw new Error(`Timed out waiting for publish.yml run ${dispatch}`)
  const next = Math.min(runPoll, left)
  await Bun.sleep(next)
  return waitForRun(dispatch, left - next)
}

async function waitForCompletion(id: number, left: number): Promise<string> {
  const run = parse<{ status: string; conclusion?: string; url?: string }>(
    await $`gh run view ${id} --json status,conclusion,url`.text(),
  )
  if (run.status === "completed") {
    if (run.conclusion !== "success") {
      throw new Error(`publish.yml failed: ${run.url ?? `run ${id}`} (${run.conclusion ?? "unknown"})`)
    }
    return run.url ?? `run ${id}`
  }
  if (left <= 0) throw new Error(`Timed out waiting for publish.yml to finish: ${run.url ?? `run ${id}`}`)
  const next = Math.min(completionPoll, left)
  await Bun.sleep(next)
  return waitForCompletion(id, left - next)
}

async function waitForRerun(id: number, left: number): Promise<string> {
  const run = parse<{ status: string; conclusion?: string }>(await $`gh run view ${id} --json status,conclusion`.text())
  if (run.status !== "completed" || run.conclusion === "success") {
    return waitForCompletion(id, completionWait)
  }
  if (left <= 0) throw new Error(`Timed out waiting for failed publish.yml run ${id} to rerun`)
  const next = Math.min(runPoll, left)
  await Bun.sleep(next)
  return waitForRerun(id, left - next)
}

const earlyID = resume ? dispatchID(version, lineage.source) : undefined
const early = earlyID ? await getRun(earlyID) : undefined
const earlyPlan = dispatchPlan(early)
if (early && (earlyPlan === "success" || earlyPlan === "wait")) {
  const url =
    earlyPlan === "success"
      ? (early.url ?? `run ${early.databaseId}`)
      : await waitForCompletion(early.databaseId, completionWait)
  console.log(`Recovered publish.yml run: ${url}`)
  process.exit(0)
}
if (early && earlyPlan === "rerun") {
  const draft = (await $`gh release view ${lineage.target} --json isDraft --jq .isDraft --repo ${repo}`.text()).trim()
  if (draft === "false") {
    await $`gh run rerun ${early.databaseId}`.nothrow()
    const url = await waitForRerun(early.databaseId, runWait)
    console.log(`Recovered finalized publish.yml run: ${url}`)
    process.exit(0)
  }
  if (draft !== "true") throw new Error(`Could not verify draft state for ${lineage.target}.`)
}

const output = path.join(os.tmpdir(), `slopcode-release-${process.pid}-${crypto.randomUUID()}.json`)

const head = (await $`git rev-parse HEAD`.text()).trim()
const detached = resume && head !== lineage.source
if (detached) await $`git switch --detach ${lineage.source}`
try {
  await $`bun ./script/publish.ts`.env({
    ...env,
    SLOPCODE_PREPARE_ONLY: "true",
    SLOPCODE_RELEASE_RESUME: resume ? "true" : undefined,
    SLOPCODE_RELEASE_OUTPUT: output,
  })
} finally {
  if (detached) await $`git switch ${ref}`
}

const prepared = parse<{
  version: string
  source_sha: string
  previous_tag?: string
  tag: string
  release_id: string
}>(await Bun.file(output).text())
await Bun.file(output).delete()
if (
  prepared.version !== version ||
  prepared.tag !== lineage.target ||
  prepared.previous_tag !== lineage.previous ||
  !/^RE_[A-Za-z0-9_-]+$/.test(prepared.release_id)
) {
  throw new Error("Prepared release result does not match the verified lineage and target version.")
}

const dispatch = dispatchID(prepared.version, prepared.source_sha)
const existing = await getRun(dispatch)
const plan = dispatchPlan(existing)
if (plan === "success") {
  console.log(`Recovered successful publish.yml run: ${existing?.url ?? `run ${existing?.databaseId}`}`)
  process.exit(0)
}
if (plan === "dispatch") {
  const previous = prepared.previous_tag ? ["-f", `previous_tag=${prepared.previous_tag}`] : []
  await $`gh workflow run publish.yml --ref ${ref} -f version=${prepared.version} -f source_sha=${prepared.source_sha} ${previous} -f dispatch_id=${dispatch} -f release_id=${prepared.release_id}`.nothrow()
}
if (plan === "rerun") {
  await $`gh run rerun ${existing!.databaseId}`.nothrow()
  await Bun.sleep(2000)
}

const run = existing ?? (await waitForRun(dispatch, runWait))
const url =
  plan === "rerun"
    ? await waitForRerun(run.databaseId, runWait)
    : await waitForCompletion(run.databaseId, completionWait)
console.log(
  [`Prepared release assets locally for ${version}.`, `publish.yml completed on ${ref}.`, `Run: ${url}`].join("\n"),
)
