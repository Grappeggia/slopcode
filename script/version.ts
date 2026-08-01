#!/usr/bin/env bun

import { $ } from "bun"
import { Script } from "@slopcode-ai/script"

export const releaseInfo = async (repo = process.env.GH_REPO ?? "teamslop/slopcode") => {
  const tag = `v${Script.version}`
  const notes = process.env.SLOPCODE_RELEASE_NOTES?.trim()
  const output = {
    version: Script.version,
    release: "",
    tag,
    repo,
  }

  if (!Script.preview) {
    const bullets = notes?.split(/\r?\n/).filter((line) => line.trim().startsWith("- ")) ?? []
    if (!notes || bullets.length === 0 || bullets.length > 3) {
      throw new Error("SLOPCODE_RELEASE_NOTES must contain one to three concise bullet points.")
    }
    const existing = await $`gh release view ${tag} --json tagName,id,isDraft --repo ${repo}`.quiet().nothrow()
    if (existing.exitCode !== 0) {
      await $`gh release create ${tag} -d --title ${tag} --notes ${notes} --repo ${repo}`
    } else if (!(await existing.json()).isDraft) {
      throw new Error(`Release ${tag} is already published; only draft releases can be resumed.`)
    } else {
      await $`gh release edit ${tag} --notes ${notes} --repo ${repo}`
    }

    const release = await $`gh release view ${tag} --json tagName,id,isDraft --repo ${repo}`.json()
    output.release = `${release.id}`
    output.tag = release.tagName
  }

  return output
}

if (import.meta.main) {
  const output = await releaseInfo()
  if (process.env.GITHUB_OUTPUT) {
    await Bun.write(
      process.env.GITHUB_OUTPUT,
      [`version=${output.version}`, `release=${output.release}`, `tag=${output.tag}`, `repo=${output.repo}`].join("\n"),
    )
  }
}
