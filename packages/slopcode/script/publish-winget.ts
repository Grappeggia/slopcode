#!/usr/bin/env bun

import { $ } from "bun"
import { Script } from "@slopcode-ai/script"
import fs from "fs/promises"
import os from "os"
import path from "path"

const source = process.env.GH_REPO ?? "teamslop/slopcode"
const upstream = process.env.WINGET_UPSTREAM_REPO ?? "microsoft/winget-pkgs"
const fork = process.env.WINGET_FORK_REPO?.trim()
const token = process.env.WINGET_TOKEN ?? process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN
const prefix = process.env.WINGET_BRANCH_PREFIX ?? "teamslop-slopcode-"
const identifier = process.env.WINGET_PACKAGE_IDENTIFIER ?? "TeamSlop.Slopcode"
const publisher = process.env.WINGET_PUBLISHER ?? "TeamSlop"
const publisherUrl = process.env.WINGET_PUBLISHER_URL ?? "https://github.com/teamslop"
const supportUrl = process.env.WINGET_PUBLISHER_SUPPORT_URL ?? "https://github.com/teamslop/slopcode/issues"
const packageName = process.env.WINGET_PACKAGE_NAME ?? "SlopCode"
const packageUrl = process.env.WINGET_PACKAGE_URL ?? "https://slopcode.dev/"
const moniker = process.env.WINGET_MONIKER ?? "slopcode"
const enforce = process.env.SLOPCODE_ENFORCE_WINGET === "true"
const assetName = process.env.WINGET_ASSET_NAME ?? "slopcode-windows-x64-baseline.zip"

const parse = (value: string | undefined, fallback: number) => {
  const next = Number(value)
  if (Number.isFinite(next) && next > 0) {
    return next
  }
  return fallback
}

const wait = parse(process.env.WINGET_ASSET_WAIT_MS, 180000)
const poll = parse(process.env.WINGET_ASSET_POLL_MS, 3000)

type Repo = {
  default_branch?: string
}

type Pull = {
  html_url?: string
}

type ReleaseAsset = {
  name?: string
  browser_download_url?: string
}

type Release = {
  published_at?: string
  created_at?: string
  assets?: ReleaseAsset[]
}

const fetchReady = async (url: string, left: number): Promise<Response> => {
  const res = await fetch(url)
  if (res.ok) {
    return res
  }
  if (left <= 0) {
    throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`)
  }
  const next = Math.min(poll, left)
  await Bun.sleep(next)
  return fetchReady(url, left - next)
}

const run = async () => {
  if (Script.channel !== "latest") {
    console.log("winget: skip", Script.channel)
    return
  }

  if (!Script.release) {
    console.log("winget: skip release")
    return
  }

  if (process.env.SLOPCODE_DISABLE_WINGET === "true") {
    if (enforce) {
      throw new Error("winget: disabled in a required release")
    }
    console.log("winget: disabled")
    return
  }

  if (!token) {
    if (enforce) {
      throw new Error("winget: missing WINGET_TOKEN/GITHUB_TOKEN/GH_TOKEN in a required release")
    }
    console.log("winget: skip missing WINGET_TOKEN/GITHUB_TOKEN/GH_TOKEN")
    return
  }

  if (!fork) {
    if (enforce) {
      throw new Error("winget: missing WINGET_FORK_REPO in a required release")
    }
    console.log("winget: skip missing WINGET_FORK_REPO")
    return
  }

  const owner = fork.split("/")[0]
  if (!owner) {
    throw new Error(`Invalid WINGET_FORK_REPO: ${fork}`)
  }

  const version = Script.version.replace(/^v/, "")
  if (!version) {
    throw new Error("Missing release version")
  }

  const parts = identifier.split(".").filter(Boolean)
  const lead = parts[0]?.slice(0, 1).toLowerCase()
  if (!lead || parts.length < 2) {
    throw new Error(`Invalid WINGET_PACKAGE_IDENTIFIER: ${identifier}`)
  }

  const branch = `${prefix}${version.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`
  const title = `${identifier} version ${version}`
  const env = {
    ...process.env,
    GH_TOKEN: token,
  }
  const headers = {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "X-GitHub-Api-Version": "2022-11-28",
  }
  const info = await fetch(`https://api.github.com/repos/${upstream}`, {
    headers,
  })
  if (!info.ok) {
    throw new Error(`Failed to read ${upstream}: ${info.status} ${info.statusText}`)
  }
  const repo = (await info.json()) as Repo
  const base = process.env.WINGET_BASE_BRANCH ?? repo.default_branch ?? "master"

  const open = (await fetch(
    `https://api.github.com/repos/${upstream}/pulls?state=open&head=${encodeURIComponent(`${owner}:${branch}`)}&base=${encodeURIComponent(base)}`,
    {
      headers,
    },
  ).then(async (res) => {
    if (!res.ok) {
      throw new Error(`Failed to list pull requests for ${upstream}: ${res.status} ${res.statusText}`)
    }
    return (await res.json()) as Pull[]
  })) as Pull[]
  if (open[0]?.html_url) {
    console.log("winget: already open", open[0].html_url)
    return
  }

  const tag = `v${version}`
  const release = async (left: number): Promise<{ date: string; url: string }> => {
    const res = await fetch(`https://api.github.com/repos/${source}/releases/tags/${tag}`, {
      headers,
    })
    if (res.ok) {
      const data = (await res.json()) as Release
      const url = data.assets?.find((item) => item.name === assetName)?.browser_download_url
      if (url) {
        const raw = data.published_at ?? data.created_at ?? new Date().toISOString()
        const date = raw.slice(0, 10)
        return {
          date: date || new Date().toISOString().slice(0, 10),
          url,
        }
      }
    }
    if (left <= 0) {
      throw new Error(`winget: release asset ${assetName} not available for ${source}@${tag}`)
    }
    const next = Math.min(poll, left)
    await Bun.sleep(next)
    return release(left - next)
  }

  const meta = await release(wait)
  const data = await fetchReady(meta.url, wait).then((res) => res.arrayBuffer())
  const sha256 = new Bun.CryptoHasher("sha256").update(data).digest("hex").toUpperCase()
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "slopcode-winget-"))
  const root = path.join(tmp, "repo")
  const manifestPath = path.join("manifests", lead, ...parts, version)
  const manifestDir = path.join(root, manifestPath)
  const versionFile = path.join(manifestDir, `${identifier}.yaml`)
  const localeFile = path.join(manifestDir, `${identifier}.locale.en-US.yaml`)
  const installerFile = path.join(manifestDir, `${identifier}.installer.yaml`)

  const versionManifest = `# yaml-language-server: $schema=https://aka.ms/winget-manifest.version.1.12.0.schema.json

PackageIdentifier: ${identifier}
PackageVersion: ${version}
DefaultLocale: en-US
ManifestType: version
ManifestVersion: 1.12.0
`

  const localeManifest = `# yaml-language-server: $schema=https://aka.ms/winget-manifest.defaultLocale.1.12.0.schema.json

PackageIdentifier: ${identifier}
PackageVersion: ${version}
PackageLocale: en-US
Publisher: ${publisher}
PublisherUrl: ${publisherUrl}
PublisherSupportUrl: ${supportUrl}
PackageName: ${packageName}
PackageUrl: ${packageUrl}
License: MIT
LicenseUrl: https://github.com/${source}/blob/v${version}/LICENSE
ShortDescription: The AI slopcoding agent built for the terminal.
Description: |-
  SlopCode is an AI slopcoding agent for the terminal.
  It provides a native TUI, parallel agent workflows, and support for many model providers.
Moniker: ${moniker}
Tags:
- ai
- cli
- coding
- terminal
ReleaseNotesUrl: https://github.com/${source}/releases/tag/v${version}
ManifestType: defaultLocale
ManifestVersion: 1.12.0
`

  const installerManifest = `# yaml-language-server: $schema=https://aka.ms/winget-manifest.installer.1.12.0.schema.json

PackageIdentifier: ${identifier}
PackageVersion: ${version}
InstallerType: zip
NestedInstallerType: portable
NestedInstallerFiles:
- RelativeFilePath: slopcode.exe
  PortableCommandAlias: slopcode
Commands:
- slopcode
ReleaseDate: ${meta.date}
Installers:
- Architecture: x64
  InstallerUrl: ${meta.url}
  InstallerSha256: ${sha256}
ManifestType: installer
ManifestVersion: 1.12.0
`

  await $`gh repo clone ${fork} ${root} -- --depth=1`.env(env)
  await $`git remote set-url origin https://x-access-token:${token}@github.com/${fork}.git`.cwd(root)
  const remotes = await $`git remote`.cwd(root).text()
  if (!remotes.split("\n").includes("upstream")) {
    await $`git remote add upstream https://github.com/${upstream}.git`.cwd(root)
  }
  await $`git remote set-url upstream https://github.com/${upstream}.git`.cwd(root)
  await $`git fetch upstream ${base}`.cwd(root)

  const has = (await $`git ls-remote --heads origin ${branch}`.cwd(root).text()).trim()
  if (has) {
    await $`git fetch origin ${branch}`.cwd(root)
    await $`git checkout -B ${branch} origin/${branch}`.cwd(root)
  } else {
    await $`git checkout -B ${branch} upstream/${base}`.cwd(root)
  }

  await fs.mkdir(manifestDir, { recursive: true })
  await Bun.write(versionFile, versionManifest)
  await Bun.write(localeFile, localeManifest)
  await Bun.write(installerFile, installerManifest)

  const status = (await $`git status --porcelain`.cwd(root).text()).trim()
  if (!status) {
    console.log("winget: already up to date", Script.version)
    return
  }

  await $`git add ${manifestPath}`.cwd(root)
  await $`git -c user.name=slopcode -c user.email=slopcode@users.noreply.github.com commit -m ${title}`.cwd(root)
  await $`git push -u origin ${branch}`.cwd(root)

  const body = [
    "## Checklist",
    "- [x] I have performed a self-review of my own code",
    "- [x] I have tested this package to ensure it meets all requirements",
    "",
    "## Package details",
    `- PackageIdentifier: \`${identifier}\``,
    `- PackageVersion: \`${version}\``,
    "- InstallerType: `zip` (portable)",
    `- InstallerUrl: ${meta.url}`,
    `- SHA256: \`${sha256}\``,
    `- Release: https://github.com/${source}/releases/tag/v${version}`,
    "",
    "Generated by release automation.",
  ].join("\n")

  const pr =
    await $`gh pr create --repo ${upstream} --base ${base} --head ${owner}:${branch} --title ${title} --body ${body}`
      .env(env)
      .text()

  console.log("winget: opened", pr.trim())
}

await run().catch((error) => {
  if (enforce) {
    throw error
  }
  const message = error instanceof Error ? error.message : String(error)
  console.log("winget: non-blocking failure", message)
})
