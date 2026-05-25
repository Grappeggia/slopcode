#!/usr/bin/env bun

import { $ } from "bun"
import { Script } from "@slopcode-ai/script"

export const releaseInfo = async (repo = process.env.GH_REPO ?? "teamslop/slopcode") => {
  const tag = `v${Script.version}`
  const output = {
    version: Script.version,
    release: "",
    tag,
    repo,
  }

  if (!Script.preview) {
    const existing = await $`gh release view ${tag} --json tagName,id --repo ${repo}`.quiet().nothrow()
    if (existing.exitCode !== 0) {
      await $`gh release create ${tag} -d --title ${tag} --notes "Release ${tag}" --repo ${repo}`
    }

    const release = await $`gh release view ${tag} --json tagName,id --repo ${repo}`.json()
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
