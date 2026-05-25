#!/usr/bin/env bun

import { $ } from "bun"
import { Script } from "@slopcode-ai/script"
import fs from "fs/promises"
import os from "os"
import path from "path"

const pkg = "slopcode"
const upstream = process.env.HOMEBREW_CORE_UPSTREAM_REPO ?? "Homebrew/homebrew-core"
const fork = process.env.HOMEBREW_CORE_FORK_REPO?.trim()
const file = process.env.HOMEBREW_CORE_PATH ?? "Formula/s/slopcode.rb"
const token = process.env.HOMEBREW_CORE_TOKEN ?? process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN
const prefix = process.env.HOMEBREW_CORE_BRANCH_PREFIX ?? "slopcode-bump-"
const version = Script.version.replace(/^v/, "")
const branch = `${prefix}${version.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`

const parse = (value: string, fallback: number) => {
  const next = Number(value)
  if (Number.isFinite(next) && next > 0) {
    return next
  }
  return fallback
}

const wait = parse(process.env.HOMEBREW_CORE_NPM_WAIT_MS ?? "120000", 120000)
const poll = parse(process.env.HOMEBREW_CORE_NPM_POLL_MS ?? "3000", 3000)
const registry = (process.env.npm_config_registry ?? "https://registry.npmjs.org").replace(/\/$/, "")
const title = `slopcode ${Script.version}`

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

const format = (url: string, sha256: string) => `class Slopcode < Formula
  desc "The open source AI slopcoding agent."
  homepage "https://slopcode.dev"
  url "${url}"
  sha256 "${sha256}"
  license "MIT"

  livecheck do
    throttle 10
  end

  depends_on "node"
  depends_on "ripgrep"

  def install
    system "npm", "install", *std_npm_args
    bin.install_symlink libexec.glob("bin/*")
  end

  test do
    assert_match version.to_s, shell_output("#{bin}/slopcode --version")
  end
end
`

const rewrite = (body: string, url: string, sha256: string) =>
  body
    .replace(/^\s*url\s+["'][^"']+["']\s*$/m, `  url "${url}"`)
    .replace(/^\s*sha256\s+["'][^"']+["']\s*$/m, `  sha256 "${sha256}"`)

const run = async () => {
  if (Script.channel !== "latest") {
    console.log("homebrew core: skip", Script.channel)
    return
  }

  if (!Script.release) {
    console.log("homebrew core: skip release")
    return
  }

  if (!fork) {
    console.log("homebrew core: skip missing HOMEBREW_CORE_FORK_REPO")
    return
  }

  if (!token) {
    console.log("homebrew core: skip missing HOMEBREW_CORE_TOKEN/GITHUB_TOKEN/GH_TOKEN")
    return
  }

  const owner = fork.split("/")[0]
  if (!owner) {
    throw new Error(`Invalid HOMEBREW_CORE_FORK_REPO: ${fork}`)
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

  const repo = (await info.json()) as {
    default_branch?: string
  }
  const base = process.env.HOMEBREW_CORE_BASE_BRANCH ?? repo.default_branch ?? "master"
  const env = {
    ...process.env,
    GH_TOKEN: token,
  }

  const open = (await fetch(
    `https://api.github.com/repos/${upstream}/pulls?state=open&head=${encodeURIComponent(`${owner}:${branch}`)}&base=${encodeURIComponent(base)}`,
    {
      headers,
    },
  ).then(async (res) => {
    if (!res.ok) {
      throw new Error(`Failed to list pull requests for ${upstream}: ${res.status} ${res.statusText}`)
    }
    return (await res.json()) as {
      html_url?: string
    }[]
  })) as {
    html_url?: string
  }[]
  if (open[0]?.html_url) {
    console.log("homebrew core: already open", open[0].html_url)
    return
  }

  const ref = `${registry}/${pkg}/${Script.version}`
  const npm = await fetchReady(ref, wait)
  const meta = (await npm.json()) as {
    dist?: {
      tarball?: string
    }
  }
  const tarball = meta.dist?.tarball
  if (!tarball) {
    throw new Error(`Missing tarball URL in package metadata for ${pkg}@${Script.version}`)
  }

  const tar = await fetchReady(tarball, wait)
  const sha256 = new Bun.CryptoHasher("sha256").update(await tar.arrayBuffer()).digest("hex")

  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "slopcode-homebrew-core-"))
  const root = path.join(tmp, "repo")
  await $`gh repo clone ${fork} ${root} -- --depth=1`.env(env)
  await $`git remote set-url origin https://x-access-token:${token}@github.com/${fork}.git`.cwd(root)
  const remotes = await $`git remote`.cwd(root).text()
  if (!remotes.split("\n").includes("upstream")) {
    await $`git remote add upstream https://github.com/${upstream}.git`.cwd(root)
  }
  await $`git remote set-url upstream https://github.com/${upstream}.git`.cwd(root)
  await $`git fetch upstream ${base}`.cwd(root)
  await $`git fetch origin ${branch}`.cwd(root).nothrow()
  await $`git checkout -B ${branch} upstream/${base}`.cwd(root)

  const target = path.join(root, file)
  const prev = (await Bun.file(target).exists()) ? await Bun.file(target).text() : ""
  const next = prev
    ? (() => {
        const out = rewrite(prev, tarball, sha256)
        if (!out.includes(`url "${tarball}"`) || !out.includes(`sha256 "${sha256}"`)) {
          throw new Error(`Failed to update ${file}; missing url or sha256 stanza`)
        }
        return out
      })()
    : format(tarball, sha256)

  if (next.trim() === prev.trim()) {
    console.log("homebrew core: already up to date", Script.version)
    return
  }

  await fs.mkdir(path.dirname(target), { recursive: true })
  await Bun.write(target, next)

  const status = (await $`git status --porcelain`.cwd(root).text()).trim()
  if (!status) {
    console.log("homebrew core: already up to date", Script.version)
    return
  }

  await $`git add ${file}`.cwd(root)
  await $`git -c user.name=slopcode -c user.email=slopcode@users.noreply.github.com commit -m ${title}`.cwd(root)
  await $`git push --force origin ${branch}`.cwd(root)

  const body = [
    "## Summary",
    `- Bump slopcode to ${Script.version}.`,
    "- Refresh npm tarball URL and sha256.",
    "",
    "Generated by release automation.",
  ].join("\n")
  const pr =
    await $`gh pr create --repo ${upstream} --base ${base} --head ${owner}:${branch} --title ${title} --body ${body}`
      .env(env)
      .text()

  console.log("homebrew core: opened", pr.trim())
}

await run()
