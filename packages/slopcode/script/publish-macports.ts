#!/usr/bin/env bun

import { $ } from "bun"
import { Script } from "@slopcode-ai/script"
import fs from "fs/promises"
import os from "os"
import path from "path"

const source = process.env.GH_REPO ?? "teamslop/slopcode"
const upstream = process.env.MACPORTS_UPSTREAM_REPO ?? "macports/macports-ports"
const fork = process.env.MACPORTS_FORK_REPO?.trim()
const file = process.env.MACPORTS_PORT_PATH ?? "devel/slopcode/Portfile"
const token = process.env.MACPORTS_TOKEN ?? process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN
const prefix = process.env.MACPORTS_BRANCH_PREFIX ?? "slopcode-bump-"
const enforce = process.env.SLOPCODE_ENFORCE_MACPORTS === "true"

const run = async () => {
  if (Script.channel !== "latest") {
    console.log("macports: skip", Script.channel)
    return
  }

  if (!Script.release) {
    console.log("macports: skip release")
    return
  }

  if (process.env.SLOPCODE_DISABLE_MACPORTS === "true") {
    if (enforce) {
      throw new Error("macports: disabled in a required release")
    }
    console.log("macports: disabled")
    return
  }

  if (!token) {
    if (enforce) {
      throw new Error("macports: missing MACPORTS_TOKEN/GITHUB_TOKEN/GH_TOKEN in a required release")
    }
    console.log("macports: skip missing MACPORTS_TOKEN/GITHUB_TOKEN/GH_TOKEN")
    return
  }

  if (!fork) {
    if (enforce) {
      throw new Error("macports: missing MACPORTS_FORK_REPO in a required release")
    }
    console.log("macports: skip missing MACPORTS_FORK_REPO")
    return
  }

  const owner = fork.split("/")[0]
  if (!owner) {
    throw new Error(`Invalid MACPORTS_FORK_REPO: ${fork}`)
  }

  const version = Script.version.replace(/^v/, "")
  if (!version) {
    throw new Error("Missing release version")
  }

  const branch = `${prefix}${version.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`
  const title = `slopcode ${Script.version}`
  const env = {
    ...process.env,
    GH_TOKEN: token,
  }

  const headers = {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "X-GitHub-Api-Version": "2022-11-28",
  }
  const info = await fetch(`https://api.github.com/repos/${upstream}`, { headers })
  if (!info.ok) {
    throw new Error(`Failed to read ${upstream}: ${info.status} ${info.statusText}`)
  }
  const repo = (await info.json()) as {
    default_branch?: string
  }
  const base = process.env.MACPORTS_BASE_BRANCH ?? repo.default_branch ?? "master"

  const open = (await fetch(
    `https://api.github.com/repos/${upstream}/pulls?state=open&head=${encodeURIComponent(`${owner}:${branch}`)}&base=${encodeURIComponent(base)}`,
    { headers },
  ).then(async (res) => {
    if (!res.ok) {
      throw new Error(`Failed to list pull requests for ${upstream}: ${res.status} ${res.statusText}`)
    }
    return (await res.json()) as { html_url?: string }[]
  })) as { html_url?: string }[]
  if (open[0]?.html_url) {
    console.log("macports: already open", open[0].html_url)
    return
  }

  const tag = `v${Script.version}`
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "slopcode-macports-"))
  const dist = path.join(tmp, "dist")
  const root = path.join(tmp, "repo")
  await fs.mkdir(dist, { recursive: true })

  await $`gh release download ${tag} --repo ${source} --dir ${dist} --pattern slopcode-darwin-arm64.tar.gz --pattern slopcode-darwin-x64-baseline.tar.gz`.env(
    env,
  )

  const arm = path.join(dist, "slopcode-darwin-arm64.tar.gz")
  const x64 = path.join(dist, "slopcode-darwin-x64-baseline.tar.gz")
  if (!(await Bun.file(arm).exists()) || !(await Bun.file(x64).exists())) {
    throw new Error("macports: missing darwin release artifacts")
  }

  const hash = async (file: string, alg: "ripemd160" | "sha256") =>
    new Bun.CryptoHasher(alg).update(await Bun.file(file).arrayBuffer()).digest("hex")

  const armMeta = {
    rmd160: await hash(arm, "ripemd160"),
    sha256: await hash(arm, "sha256"),
    size: (await fs.stat(arm)).size,
  }
  const x64Meta = {
    rmd160: await hash(x64, "ripemd160"),
    sha256: await hash(x64, "sha256"),
    size: (await fs.stat(x64)).size,
  }

  const body = `# -*- coding: utf-8; mode: tcl; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- vim:fenc=utf-8:ft=tcl:et:sw=4:ts=4:sts=4

PortSystem          1.0

name                slopcode
version             ${version}
revision            0
categories          devel
platforms           darwin
supported_archs     arm64 x86_64
installs_libs       no
license             MIT
maintainers         nomaintainer

description         The open source AI slopcoding agent.
long_description    SlopCode is the open source AI slopcoding agent focused on terminal workflows.
homepage            https://slopcode.dev
master_sites        https://github.com/teamslop/slopcode/releases/download/v${version}

if {\${configure.build_arch} eq "arm64"} {
    distname        slopcode-darwin-arm64
    checksums       rmd160  ${armMeta.rmd160} \\
                    sha256  ${armMeta.sha256} \\
                    size    ${armMeta.size}
} else {
    distname        slopcode-darwin-x64-baseline
    checksums       rmd160  ${x64Meta.rmd160} \\
                    sha256  ${x64Meta.sha256} \\
                    size    ${x64Meta.size}
}

use_configure       no

build {}

destroot {
    xinstall -m 0755 -W \${worksrcpath} slopcode \${destroot}\${prefix}/bin
}
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

  const target = path.join(root, file)
  const prev = (await Bun.file(target).exists()) ? await Bun.file(target).text() : ""
  if (prev.trim() === body.trim()) {
    console.log("macports: already up to date", Script.version)
    return
  }

  await fs.mkdir(path.dirname(target), { recursive: true })
  await Bun.write(target, body)

  const status = (await $`git status --porcelain`.cwd(root).text()).trim()
  if (!status) {
    console.log("macports: already up to date", Script.version)
    return
  }

  await $`git add ${file}`.cwd(root)
  await $`git -c user.name=slopcode -c user.email=slopcode@users.noreply.github.com commit -m ${title}`.cwd(root)
  await $`git push -u origin ${branch}`.cwd(root)

  const text = [
    "## Summary",
    `- Add or update the ${file} port for slopcode ${Script.version}.`,
    "- Use official darwin release tarballs for arm64 and x86_64 with updated checksums.",
    "",
    "Generated by release automation.",
  ].join("\n")

  const pr =
    await $`gh pr create --repo ${upstream} --base ${base} --head ${owner}:${branch} --title ${title} --body ${text}`
      .env(env)
      .text()

  console.log("macports: opened", pr.trim())
}

await run()
