#!/usr/bin/env bun

import { $ } from "bun"
import { Script } from "@slopcode-ai/script"

type Release = {
  id: number
  tag_name: string
  draft: boolean
  body?: string
}

const releases = async (repo: string) =>
  (await $`gh api repos/${repo}/releases?per_page=100`.json()) as Release[]

export const releaseInfo = async (repo = process.env.GH_REPO ?? "teamslop/slopcode") => {
  const tag = `v${Script.version}`
  const output = {
    version: Script.version,
    release: "",
    tag,
    repo,
  }

  if (!Script.preview) {
    const explicit = process.env.SLOPCODE_RELEASE_NOTES?.trim()
    const current = (await releases(repo)).find((item) => item.tag_name === tag)
    const inferred = (await $`git log -n 20 --pretty=format:%s`.text())
      .split(/\r?\n/)
      .filter((line) => line && !/^(chore|ci|release|test)(\(|:)/i.test(line))
      .slice(0, 3)
      .map((line) => `- ${line.replace(/\s+/g, " ").slice(0, 160)}`)
      .join("\n")
    const notes = explicit || current?.body?.trim() || inferred || "- Updated SlopCode runtime support."
    const bullets = notes?.split(/\r?\n/).filter((line) => line.trim().startsWith("- ")) ?? []
    if (!notes || bullets.length === 0 || bullets.length > 3) {
      throw new Error("Release notes must contain one to three concise bullet points.")
    }
    if (!current) {
      await $`gh release create ${tag} -d --title ${tag} --notes ${notes} --repo ${repo}`
    } else if (!current.draft) {
      throw new Error(`Release ${tag} is already published; only draft releases can be resumed.`)
    } else {
      await $`gh api --method PATCH repos/${repo}/releases/${current.id} -f body=${notes}`
    }

    const release = (await releases(repo)).find((item) => item.tag_name === tag)
    if (!release) throw new Error(`Could not find draft release ${tag}.`)
    output.release = `${release.id}`
    output.tag = release.tag_name
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
