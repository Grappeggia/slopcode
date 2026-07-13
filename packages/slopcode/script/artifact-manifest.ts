#!/usr/bin/env bun

import fs from "node:fs/promises"
import path from "node:path"

export const manifestName = "release-manifest.json"

type Manifest = {
  schema: 1
  source_sha: string
  version: string
  artifacts: Array<{
    name: string
    sha256: string
  }>
}

const digest = async (file: string) =>
  new Bun.CryptoHasher("sha256").update(await Bun.file(file).arrayBuffer()).digest("hex")

const assets = async (dir: string) =>
  (await fs.readdir(dir))
    .filter((name) => name.endsWith(".zip") || name.endsWith(".tar.gz") || name.endsWith(".deb"))
    .sort()

export async function writeManifest(dir: string, source: string, version: string) {
  const files = await assets(dir)
  if (!files.includes("slopcode-cli-dist.tar.gz")) {
    throw new Error("manifest: missing slopcode-cli-dist.tar.gz")
  }
  const manifest: Manifest = {
    schema: 1,
    source_sha: source,
    version,
    artifacts: await Promise.all(
      files.map(async (name) => ({
        name,
        sha256: await digest(path.join(dir, name)),
      })),
    ),
  }
  await Bun.write(path.join(dir, manifestName), `${JSON.stringify(manifest, null, 2)}\n`)
  return manifest
}

export async function verifyManifest(dir: string, source: string, version: string, names?: string[]) {
  const manifest = (await Bun.file(path.join(dir, manifestName)).json()) as Manifest
  if (manifest.schema !== 1 || manifest.source_sha !== source || manifest.version !== version) {
    throw new Error(
      `manifest: provenance mismatch (expected ${source} v${version}, got ${manifest.source_sha} v${manifest.version})`,
    )
  }
  const files = names?.length ? names : manifest.artifacts.map((item) => item.name)
  await Promise.all(
    files.map(async (name) => {
      const item = manifest.artifacts.find((candidate) => candidate.name === name)
      if (!item) throw new Error(`manifest: unlisted artifact ${name}`)
      const actual = await digest(path.join(dir, name))
      if (actual !== item.sha256) {
        throw new Error(`manifest: checksum mismatch for ${name}`)
      }
    }),
  )
  return manifest
}

if (import.meta.main) {
  const args = process.argv.slice(2)
  const mode = args.shift()
  const value = (name: string) => {
    const index = args.indexOf(name)
    return index === -1 ? undefined : args[index + 1]
  }
  const dir = value("--dir")
  const source = value("--source")
  const version = value("--version")
  if (!dir || !source || !version || (mode !== "write" && mode !== "verify")) {
    throw new Error(
      "Usage: artifact-manifest.ts <write|verify> --dir <path> --source <sha> --version <version> [--artifact <name>]",
    )
  }
  if (mode === "write") {
    await writeManifest(dir, source, version)
  } else {
    await verifyManifest(dir, source, version, value("--artifact") ? [value("--artifact")!] : undefined)
  }
  console.log(`manifest: ${mode} ok`)
}
