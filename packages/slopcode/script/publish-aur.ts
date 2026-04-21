#!/usr/bin/env bun

import { $ } from "bun"
import { Script } from "@slopcode-ai/script"
import fs from "fs/promises"
import os from "os"
import path from "path"

const key = process.env.AUR_KEY
const repo = process.env.AUR_REPO ?? "slopcode-bin"
const branch = process.env.AUR_BRANCH ?? "master"
const pkg = process.env.AUR_PACKAGE ?? "slopcode-bin"
const source = process.env.GH_REPO ?? "teamslop/slopcode"
const token = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN

const run = async () => {
  if (Script.channel !== "latest") {
    console.log("aur: skip", Script.channel)
    return
  }

  if (!Script.release) {
    console.log("aur: skip release")
    return
  }

  if (!key) {
    console.log("aur: skip missing AUR_KEY")
    return
  }

  const version = Script.version.replace(/^v/, "")
  if (!version) {
    throw new Error("Missing release version")
  }

  const tag = `v${version}`
  const base = `https://github.com/${source}/releases/download/${tag}`
  const x64url = `${base}/slopcode-linux-x64-baseline.tar.gz`
  const arm64url = `${base}/slopcode-linux-arm64.tar.gz`
  const fetchAsset = async (url: string) => {
    const headers = token
      ? {
          Authorization: `Bearer ${token}`,
        }
      : undefined
    const res = await fetch(url, { headers })
    if (!res.ok) {
      throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`)
    }
    return new Uint8Array(await res.arrayBuffer())
  }
  const hash = (data: Uint8Array) => new Bun.CryptoHasher("sha256").update(data).digest("hex")
  const [x64, arm64] = await Promise.all([fetchAsset(x64url).then(hash), fetchAsset(arm64url).then(hash)])

  const pkgbuild = [
    `pkgname=${pkg}`,
    `pkgver=${version}`,
    "pkgrel=1",
    'pkgdesc="The open source AI slopcoding agent focused on terminal workflows."',
    "arch=('x86_64' 'aarch64')",
    'url="https://slopcode.dev"',
    "license=('MIT')",
    "depends=('glibc' 'gcc-libs')",
    "provides=('slopcode')",
    "conflicts=('slopcode')",
    `source_x86_64=("slopcode-linux-x64-baseline.tar.gz::${x64url}")`,
    `source_aarch64=("slopcode-linux-arm64.tar.gz::${arm64url}")`,
    `sha256sums_x86_64=('${x64}')`,
    `sha256sums_aarch64=('${arm64}')`,
    "",
    "package() {",
    '  install -Dm755 "$srcdir/slopcode" "$pkgdir/usr/bin/slopcode"',
    '  if [[ -d "$srcdir/neovim" ]]; then',
    '    install -dm755 "$pkgdir/usr/lib/slopcode"',
    '    cp -a "$srcdir/neovim" "$pkgdir/usr/lib/slopcode/neovim"',
    "  fi",
    "}",
    "",
  ].join("\n")

  if (!pkgbuild.includes('/usr/lib/slopcode/neovim')) {
    throw new Error("aur: missing neovim sidecar install step")
  }

  const src = [
    `pkgbase = ${pkg}`,
    "\tpkgdesc = The open source AI slopcoding agent focused on terminal workflows.",
    `\tpkgver = ${version}`,
    "\tpkgrel = 1",
    "\turl = https://slopcode.dev",
    "\tarch = x86_64",
    "\tarch = aarch64",
    "\tlicense = MIT",
    "\tdepends = glibc",
    "\tdepends = gcc-libs",
    "\tprovides = slopcode",
    "\tconflicts = slopcode",
    `\tsource_x86_64 = slopcode-linux-x64-baseline.tar.gz::${x64url}`,
    `\tsource_aarch64 = slopcode-linux-arm64.tar.gz::${arm64url}`,
    `\tsha256sums_x86_64 = ${x64}`,
    `\tsha256sums_aarch64 = ${arm64}`,
    "",
    `pkgname = ${pkg}`,
    "",
  ].join("\n")

  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "slopcode-aur-"))
  const root = path.join(tmp, "repo")
  const ssh = path.join(tmp, "ssh")
  await fs.mkdir(ssh, { recursive: true, mode: 0o700 })

  const id = path.join(ssh, "id_rsa")
  await Bun.write(id, key.endsWith("\n") ? key : `${key}\n`)
  await fs.chmod(id, 0o600)

  const known = path.join(ssh, "known_hosts")
  await Bun.write(known, await $`ssh-keyscan -H aur.archlinux.org`.quiet().text())
  await fs.chmod(known, 0o600)

  const env = {
    ...process.env,
    GIT_SSH_COMMAND: `ssh -i ${id} -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes -o UserKnownHostsFile=${known}`,
  }

  await $`git clone --branch ${branch} --single-branch ssh://aur@aur.archlinux.org/${repo}.git ${root}`.env(env)
  await Bun.write(path.join(root, "PKGBUILD"), pkgbuild)
  await Bun.write(path.join(root, ".SRCINFO"), src)

  const status = (await $`git status --porcelain`.cwd(root).text()).trim()
  if (!status) {
    console.log("aur: already up to date", repo, Script.version)
    return
  }

  await $`git add PKGBUILD .SRCINFO`.cwd(root)
  await $`git -c user.name=slopcode -c user.email=slopcode@users.noreply.github.com commit -m ${`${pkg} ${Script.version}`}`.cwd(
    root,
  )
  await $`git push origin ${branch}`.cwd(root)

  console.log("aur: updated", repo, Script.version)
}

await run()
