#!/usr/bin/env bun

import { Script } from "@slopcode-ai/script"
import { $ } from "bun"
import { fileURLToPath } from "url"
import path from "node:path"
import { manifestName, verifyManifest, writeManifest } from "../packages/slopcode/script/artifact-manifest.ts"
import { gatePublication, gateRelease, prepareRelease } from "@slopcode-ai/script/release"
import { releaseInfo } from "./version.ts"

const dir = fileURLToPath(new URL("..", import.meta.url))

const highlightsTemplate = `
<!--
Add highlights before publishing. Delete this section if no highlights.

- For multiple highlights, use multiple <highlight> tags
- Highlights with the same source attribute get grouped together
-->

<!--
<highlight source="SourceName (TUI/Desktop/Web/Core)">
  <h2>Feature title goes here</h2>
  <p short="Short description used for Desktop Recap">
    Full description of the feature or change
  </p>

  https://github.com/user-attachments/assets/uuid-for-video (you will want to drag & drop the video or picture)

  <img
    width="1912"
    height="1164"
    alt="image"
    src="https://github.com/user-attachments/assets/uuid-for-image"
  />
</highlight>
-->

`

const prep = process.env.SLOPCODE_PREPARE_ONLY === "true"
const only = process.env.SLOPCODE_PUBLISH_ONLY === "true"
if (prep && only) {
  throw new Error("SLOPCODE_PREPARE_ONLY and SLOPCODE_PUBLISH_ONLY cannot both be true")
}
const mode = prep ? "prep" : only ? "publish" : "full"
const resume = process.env.SLOPCODE_RELEASE_RESUME === "true"
const lineage =
  Script.release && !Script.preview && mode !== "publish"
    ? await gateRelease({ version: Script.version, cwd: dir, remote: "origin", branch: "dev", resume })
    : Script.release && !Script.preview
      ? await gatePublication({
          version: Script.version,
          source: process.env.SLOPCODE_SOURCE_SHA,
          previous: process.env.SLOPCODE_PREVIOUS_TAG,
          cwd: dir,
          remote: "origin",
          branch: "dev",
        })
      : undefined

console.log("=== publishing ===\n")

if (mode !== "publish") {
  const pkgjsons = await Array.fromAsync(new Bun.Glob("**/package.json").scan({ cwd: dir })).then((arr) =>
    arr.filter((x) => !x.includes("node_modules") && !x.includes("dist") && !x.split(/[\\/]/).includes("tmp")),
  )

  if (resume) {
    const mismatched = (
      await Promise.all(
        pkgjsons.map(async (file) => {
          const pkg = (await Bun.file(path.join(dir, file)).json()) as { version?: string }
          return pkg.version && pkg.version !== Script.version ? file : undefined
        }),
      )
    ).filter((file): file is string => !!file)
    if (mismatched.length) {
      throw new Error(`Resume source does not contain version ${Script.version}: ${mismatched.join(", ")}`)
    }
    await $`bun install --frozen-lockfile`.cwd(dir)
  } else {
    for (const file of pkgjsons) {
      let pkg = await Bun.file(path.join(dir, file)).text()
      pkg = pkg.replaceAll(/"version": "[^"]+"/g, `"version": "${Script.version}"`)
      console.log("updated:", file)
      await Bun.file(path.join(dir, file)).write(pkg)
    }

    const extensionToml = fileURLToPath(new URL("../packages/extensions/zed/extension.toml", import.meta.url))
    let toml = await Bun.file(extensionToml).text()
    toml = toml.replace(/^version = "[^"]+"/m, `version = "${Script.version}"`)
    toml = toml.replaceAll(/releases\/download\/v[^/]+\//g, `releases/download/v${Script.version}/`)
    console.log("updated:", extensionToml)
    await Bun.file(extensionToml).write(toml)

    await $`bun install --frozen-lockfile`.cwd(dir)
  }
}

const forceBuild = process.env.SLOPCODE_FORCE_BUILD === "true"
const skipBuild = process.env.SLOPCODE_SKIP_BUILD === "true"
const buildLocal = async () => {
  if (Script.release) {
    if (skipBuild) {
      throw new Error("Local build skipped but release assets must be generated")
    }
    console.log("\n=== local build ===\n")
    await import(`../packages/slopcode/script/build.ts`)
    return
  }

  const dist = await Array.fromAsync(new Bun.Glob("packages/slopcode/dist/*/package.json").scan())
  if (!forceBuild && dist.length > 0) {
    console.log("build: using existing ./packages/slopcode/dist bundle")
    return
  }

  if (skipBuild) {
    throw new Error("Local build skipped but forcing or generating ./packages/slopcode/dist was required")
  }

  console.log("\n=== local build ===\n")
  await import(`../packages/slopcode/script/build.ts`)
}

// Non-npm publishing channels are intentionally disabled for npm-only rollout.
// await import(`../packages/sdk/js/script/build.ts`)

let prepared: Awaited<ReturnType<typeof prepareRelease>> | undefined
if (mode !== "publish" && lineage) {
  const dist = path.join(dir, "packages", "slopcode", "dist")
  let repo = process.env.GH_REPO ?? "teamslop/slopcode"
  prepared = await prepareRelease({
    cwd: dir,
    version: Script.version,
    lineage,
    resume,
    build: buildLocal,
    verify: async () => {
      console.log("\n=== artifact verification ===\n")
      await import(`../packages/slopcode/script/verify-artifacts.ts`)
      process.chdir(dir)
    },
    manifest: async (source) => {
      await writeManifest(dist, source, Script.version)
      await verifyManifest(dist, source, Script.version)
    },
    release: async () => {
      const info = await releaseInfo()
      repo = info.repo
      process.env.GH_REPO = repo
    },
    upload: async () => {
      const files = (await Array.fromAsync(new Bun.Glob("*").scan({ cwd: dist })))
        .filter(
          (name) => name === manifestName || name.endsWith(".zip") || name.endsWith(".tar.gz") || name.endsWith(".deb"),
        )
        .map((name) => path.join(dist, name))
      await $`gh release upload ${lineage.target} ${files} --clobber --repo ${repo}`
    },
  })

  if (process.env.SLOPCODE_RELEASE_OUTPUT) {
    await Bun.write(
      process.env.SLOPCODE_RELEASE_OUTPUT,
      `${JSON.stringify({
        version: prepared.version,
        source_sha: prepared.source,
        previous_tag: prepared.previous,
        tag: prepared.tag,
      })}\n`,
    )
  }

  // Non-npm publishing channels are intentionally disabled for npm-only rollout.
  // await import(`../packages/desktop/scripts/finalize-latest-json.ts`)
} else if (mode !== "publish") {
  await buildLocal()
  console.log("\n=== artifact verification ===\n")
  await import(`../packages/slopcode/script/verify-artifacts.ts`)
  process.chdir(dir)
}

if (mode === "prep") {
  console.log("\n=== local prepare complete ===\n")
} else {
  console.log("\n=== cli ===\n")
  await import(`../packages/slopcode/script/publish.ts`)

  if (Script.release && !Script.preview) {
    type Release = { id: number; tag_name: string; draft: boolean }
    const repo = process.env.GH_REPO ?? "teamslop/slopcode"
    const releases = (await $`gh api repos/${repo}/releases?per_page=100`.json()) as Release[]
    const release = releases.find((item) => item.tag_name === `v${Script.version}`)
    if (!release) throw new Error(`Could not find release v${Script.version}.`)
    if (release.draft) {
      await $`gh api --method PATCH repos/${repo}/releases/${release.id} -f draft=false`
    } else {
      console.log(`release: already finalized v${Script.version}`)
    }
  }
}

// Non-npm publishing channels are intentionally disabled for npm-only rollout.
// console.log("\n=== sdk ===\n")
// await import(`../packages/sdk/js/script/publish.ts`)
// console.log("\n=== plugin ===\n")
// await import(`../packages/plugin/script/publish.ts`)

process.chdir(dir)
