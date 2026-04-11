#!/usr/bin/env bun

import { Script } from "@slopcode-ai/script"
import { $ } from "bun"
import { fileURLToPath } from "url"
import { releaseInfo } from "./version.ts"

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

console.log("=== publishing ===\n")

if (mode !== "publish") {
  const pkgjsons = await Array.fromAsync(new Bun.Glob("**/package.json").scan()).then((arr) =>
    arr.filter((x) => !x.includes("node_modules") && !x.includes("dist") && !x.split(/[\\/]/).includes("tmp")),
  )

  for (const file of pkgjsons) {
    let pkg = await Bun.file(file).text()
    pkg = pkg.replaceAll(/"version": "[^"]+"/g, `"version": "${Script.version}"`)
    console.log("updated:", file)
    await Bun.file(file).write(pkg)
  }

  const extensionToml = fileURLToPath(new URL("../packages/extensions/zed/extension.toml", import.meta.url))
  let toml = await Bun.file(extensionToml).text()
  toml = toml.replace(/^version = "[^"]+"/m, `version = "${Script.version}"`)
  toml = toml.replaceAll(/releases\/download\/v[^/]+\//g, `releases/download/v${Script.version}/`)
  console.log("updated:", extensionToml)
  await Bun.file(extensionToml).write(toml)

  await $`bun install`
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

if (Script.release) {
  if (!Script.preview && mode !== "publish") {
    const dirty = (await $`git status --porcelain`.text()).trim().length > 0
    if (dirty) {
      await $`git commit -am "release: v${Script.version}"`
    } else {
      console.log("release: skip commit (no version changes)")
    }

    await $`git fetch --tags origin`
    const tag = `v${Script.version}`
    const tagged = (await $`git tag -l ${tag}`.text()).trim().length > 0
    if (!tagged) {
      await $`git tag ${tag}`
    } else {
      console.log("release: skip tag", tag)
    }

    await $`git push origin HEAD --tags`
    await new Promise((resolve) => setTimeout(resolve, 5_000))
    const release = await releaseInfo()
    process.env.GH_REPO = release.repo
  }

  // Non-npm publishing channels are intentionally disabled for npm-only rollout.
  // await import(`../packages/desktop/scripts/finalize-latest-json.ts`)
}

if (mode !== "publish") {
  await buildLocal()
}

if (mode === "prep") {
  console.log("\n=== local prepare complete ===\n")
} else {
  console.log("\n=== cli ===\n")
  await import(`../packages/slopcode/script/publish.ts`)

  if (Script.release && !Script.preview) {
    await $`gh release edit v${Script.version} --draft=false --repo ${process.env.GH_REPO}`
  }
}

// Non-npm publishing channels are intentionally disabled for npm-only rollout.
// console.log("\n=== sdk ===\n")
// await import(`../packages/sdk/js/script/publish.ts`)
// console.log("\n=== plugin ===\n")
// await import(`../packages/plugin/script/publish.ts`)

const dir = fileURLToPath(new URL("..", import.meta.url))
process.chdir(dir)
