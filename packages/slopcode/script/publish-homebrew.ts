#!/usr/bin/env bun

import { Script } from "@slopcode-ai/script"

const pkg = "slopcode"
const repo = process.env.HOMEBREW_TAP_REPO ?? "teamslop/homebrew-slopcode"
const branch = process.env.HOMEBREW_TAP_BRANCH ?? "main"
const file = process.env.HOMEBREW_TAP_PATH ?? "Formula/slopcode.rb"
const token = process.env.HOMEBREW_TAP_TOKEN ?? process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN

const run = async () => {
  if (Script.channel !== "latest") {
    console.log("homebrew tap: skip", Script.channel)
    return
  }

  if (!token) {
    console.log("homebrew tap: skip missing HOMEBREW_TAP_TOKEN/GITHUB_TOKEN/GH_TOKEN")
    return
  }

  const headers = {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "X-GitHub-Api-Version": "2022-11-28",
  }
  const registry = (process.env.npm_config_registry ?? "https://registry.npmjs.org").replace(/\/$/, "")
  const parse = (value: string, fallback: number) => {
    const next = Number(value)
    if (Number.isFinite(next) && next > 0) {
      return next
    }
    return fallback
  }
  const wait = parse(process.env.HOMEBREW_TAP_NPM_WAIT_MS ?? "120000", 120000)
  const poll = parse(process.env.HOMEBREW_TAP_NPM_POLL_MS ?? "3000", 3000)
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
  const ref = `${registry}/${pkg}/${Script.version}`
  const res = await fetchReady(ref, wait)

  const meta = (await res.json()) as {
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
  const formula = `class Slopcode < Formula
  desc "The open source AI slopcoding agent."
  homepage "https://slopcode.dev"
  url "${tarball}"
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

  const api = `https://api.github.com/repos/${repo}/contents/${file}`
  const get = await fetch(`${api}?ref=${branch}`, {
    headers,
  })
  if (get.status !== 404 && !get.ok) {
    throw new Error(`Failed to read ${repo}/${file}: ${get.status} ${get.statusText}`)
  }

  const prev = get.status === 404 ? undefined : ((await get.json()) as { sha: string; content: string })
  const current = prev ? atob(prev.content.replaceAll("\n", "")) : ""
  if (current.trim() === formula.trim()) {
    console.log("homebrew tap: already up to date", repo, file, Script.version)
    return
  }

  const body = {
    message: `slopcode ${Script.version}`,
    content: btoa(formula),
    branch,
    sha: prev?.sha,
  }
  const put = await fetch(api, {
    method: "PUT",
    headers: {
      ...headers,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  })

  if (!put.ok) {
    throw new Error(`Failed to write ${repo}/${file}: ${put.status} ${put.statusText} ${await put.text()}`)
  }

  console.log("homebrew tap: updated", repo, file, Script.version)
}

await run()
