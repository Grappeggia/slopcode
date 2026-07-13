#!/usr/bin/env bun

import { gateLineage, type LineageMode } from "./lineage"

const usage = `Usage:
  bun run lineage release --version <version> [--resume] [--previous-tag <tag>] [--remote origin] [--branch dev] [--repo <path>]
  bun run lineage verify --tag <tag> --source <sha> [--previous-tag <tag>] [--require-previous-if-any] [--remote origin] [--branch dev] [--repo <path>]

"release" is a publishing preflight and rejects an existing target tag unless --resume is explicit.
"verify" is non-publishing and validates an existing tag's workflow provenance.`

const args = process.argv.slice(2)
const mode = args.shift() as LineageMode | undefined
if (mode !== "release" && mode !== "verify") {
  console.error(usage)
  process.exit(1)
}

const values = new Map<string, string>()
const options = new Set(["--version", "--tag", "--source", "--previous-tag", "--remote", "--branch", "--repo"])
const flags = new Set(["--resume", "--require-previous-if-any"])

for (let index = 0; index < args.length; index++) {
  const arg = args[index]
  if (flags.has(arg)) {
    values.set(arg, "true")
    continue
  }
  if (!options.has(arg) || !args[index + 1] || args[index + 1].startsWith("--")) {
    console.error(`Unknown or incomplete option: ${arg}\n\n${usage}`)
    process.exit(1)
  }
  values.set(arg, args[index + 1])
  index++
}

const target = mode === "release" ? (values.get("--version") ?? values.get("--tag")) : values.get("--tag")
if (!target || (mode === "verify" && !values.get("--source"))) {
  console.error(usage)
  process.exit(1)
}

const common = {
  target,
  remote: values.get("--remote"),
  branch: values.get("--branch"),
  cwd: values.get("--repo"),
}
const result = await (mode === "verify"
  ? gateLineage({ mode, ...common, source: values.get("--source")!, previous: values.get("--previous-tag") })
  : gateLineage({
      mode,
      ...common,
      previous: values.get("--previous-tag"),
      resume: values.get("--resume") === "true",
    }))

if (values.get("--require-previous-if-any") === "true" && !values.get("--previous-tag") && result.previous) {
  throw new Error(`Previous release tag ${result.previous} must be supplied explicitly.`)
}

console.log(JSON.stringify(result, null, 2))
