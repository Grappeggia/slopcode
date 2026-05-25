#!/usr/bin/env bun

import { $ } from "bun"
import { Script } from "@slopcode-ai/script"
import fs from "fs/promises"
import os from "os"
import path from "path"
import { gzipSync } from "zlib"

const token = process.env.APT_REPO_TOKEN ?? process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN
const repo = process.env.APT_REPO_REPO ?? "teamslop/apt-slopcode"
const branch = process.env.APT_REPO_BRANCH ?? "main"
const dist = process.env.APT_REPO_DIST ?? "stable"
const component = process.env.APT_REPO_COMPONENT ?? "main"
const origin = process.env.APT_REPO_ORIGIN ?? "SlopCode"
const label = process.env.APT_REPO_LABEL ?? "SlopCode"
const description = process.env.APT_REPO_DESCRIPTION ?? "SlopCode apt repository"
const base = (process.env.APT_REPO_BASE_URL ?? "https://teamslop.github.io/apt-slopcode").replace(/\/$/, "")
const key = process.env.APT_REPO_GPG_PRIVATE_KEY
const pass = process.env.APT_REPO_GPG_PASSPHRASE
const source = process.env.GH_REPO ?? "teamslop/slopcode"
const enforce = process.env.SLOPCODE_ENFORCE_APT === "true"

const run = async () => {
  if (Script.channel !== "latest") {
    console.log("apt repo: skip", Script.channel)
    return
  }

  if (!Script.release) {
    console.log("apt repo: skip release")
    return
  }

  if (process.env.SLOPCODE_DISABLE_APT === "true") {
    if (enforce) {
      throw new Error("apt repo: disabled in a required release")
    }
    console.log("apt repo: disabled")
    return
  }

  if (!token || !key) {
    if (enforce) {
      throw new Error("apt repo: missing APT_REPO_TOKEN/APT_REPO_GPG_PRIVATE_KEY in a required release")
    }
    console.log("apt repo: skip missing APT_REPO_TOKEN/APT_REPO_GPG_PRIVATE_KEY")
    return
  }

  const scan = (await $`which dpkg-scanpackages`.quiet().nothrow().text()).trim()
  if (!scan) {
    throw new Error("dpkg-scanpackages is required")
  }

  const gpg = (await $`which gpg`.quiet().nothrow().text()).trim()
  if (!gpg) {
    throw new Error("gpg is required")
  }

  const tag = `v${Script.version}`
  const version = (() => {
    const value = Script.version.replace(/^v/, "")
    if (!value) {
      return "0.0.0-1"
    }
    if (value.includes(":")) {
      return value
    }
    if (/-\d+$/.test(value)) {
      return value
    }
    return `${value.replace(/-/g, "~")}-1`
  })()

  const env = {
    ...process.env,
    GH_TOKEN: token,
  }
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "slopcode-apt-"))
  const artifacts = path.join(tmp, "artifacts")
  const root = path.join(tmp, "repo")
  await fs.mkdir(artifacts, { recursive: true })

  await $`gh release download ${tag} --repo ${source} --dir ${artifacts} --pattern slopcode-linux-amd64.deb --pattern slopcode-linux-arm64.deb`.env(
    env,
  )
  await $`gh repo clone ${repo} ${root} -- --depth=1 --branch ${branch}`.env(env)

  const pool = path.join(root, "pool", "main", "s", "slopcode")
  await fs.mkdir(pool, { recursive: true })

  await Promise.all([
    $`cp ${path.join(artifacts, "slopcode-linux-amd64.deb")} ${path.join(pool, `slopcode_${version}_amd64.deb`)}`,
    $`cp ${path.join(artifacts, "slopcode-linux-arm64.deb")} ${path.join(pool, `slopcode_${version}_arm64.deb`)}`,
  ])

  const archs = ["amd64", "arm64"]

  const build = async (arch: string) => {
    const dir = path.join(root, "dists", dist, component, `binary-${arch}`)
    await fs.mkdir(dir, { recursive: true })
    const index = await $`dpkg-scanpackages --arch ${arch} pool /dev/null`.cwd(root).text()
    await Bun.write(path.join(dir, "Packages"), index)
    await Bun.write(path.join(dir, "Packages.gz"), Uint8Array.from(gzipSync(index, { level: 9 })))
  }

  await Promise.all(archs.map((arch) => build(arch)))

  const files = archs.flatMap((arch) => [
    path.join("dists", dist, component, `binary-${arch}`, "Packages"),
    path.join("dists", dist, component, `binary-${arch}`, "Packages.gz"),
  ])

  const hash = (alg: "md5" | "sha1" | "sha256", data: Uint8Array) =>
    new Bun.CryptoHasher(alg).update(data).digest("hex")

  const sums = await Promise.all(
    files.map(async (file) => {
      const data = new Uint8Array(await Bun.file(path.join(root, file)).arrayBuffer())
      return {
        file,
        size: data.byteLength,
        md5: hash("md5", data),
        sha1: hash("sha1", data),
        sha256: hash("sha256", data),
      }
    }),
  )

  const release = path.join(root, "dists", dist, "Release")
  await Bun.write(
    release,
    [
      `Origin: ${origin}`,
      `Label: ${label}`,
      `Suite: ${dist}`,
      `Codename: ${dist}`,
      `Date: ${new Date().toUTCString()}`,
      `Architectures: ${archs.join(" ")}`,
      `Components: ${component}`,
      `Description: ${description}`,
      "MD5Sum:",
      ...sums.map((item) => ` ${item.md5} ${item.size} ${item.file}`),
      "SHA1:",
      ...sums.map((item) => ` ${item.sha1} ${item.size} ${item.file}`),
      "SHA256:",
      ...sums.map((item) => ` ${item.sha256} ${item.size} ${item.file}`),
      "",
    ].join("\n"),
  )

  const install = [
    "#!/usr/bin/env bash",
    "set -euo pipefail",
    'if [ "$(id -u)" -ne 0 ]; then',
    '  echo "Please run as root (sudo)." >&2',
    "  exit 1",
    "fi",
    'arch="$(dpkg --print-architecture)"',
    'if [ "$arch" != "amd64" ] && [ "$arch" != "arm64" ]; then',
    '  echo "Unsupported architecture: $arch" >&2',
    "  exit 1",
    "fi",
    `curl -fsSL ${base}/slopcode.asc | gpg --dearmor -o /usr/share/keyrings/slopcode-archive-keyring.gpg`,
    `echo "deb [signed-by=/usr/share/keyrings/slopcode-archive-keyring.gpg arch=$arch] ${base} ${dist} ${component}" > /etc/apt/sources.list.d/slopcode.list`,
    "apt-get update",
    "apt-get install -y slopcode",
    "",
  ].join("\n")
  await Bun.write(path.join(root, "install.sh"), install)
  await $`chmod 755 ${path.join(root, "install.sh")}`

  const gnupg = path.join(tmp, "gnupg")
  await fs.mkdir(gnupg, { recursive: true, mode: 0o700 })
  const signEnv = {
    ...process.env,
    GNUPGHOME: gnupg,
  }
  const secret = path.join(tmp, "secret.asc")
  await Bun.write(secret, key)
  await $`gpg --batch --import ${secret}`.env(signEnv)

  const listed = await $`gpg --batch --with-colons --list-secret-keys`.env(signEnv).text()
  const keyID =
    process.env.APT_REPO_GPG_KEY_ID ??
    listed
      .split("\n")
      .find((line) => line.startsWith("fpr:") && line.split(":")[9])
      ?.split(":")[9]
  if (!keyID) {
    throw new Error("Could not resolve apt signing key fingerprint")
  }

  await $`gpg --batch --yes --armor --output ${path.join(root, "slopcode.asc")} --export ${keyID}`.env(signEnv)
  await $`gpg --batch --yes --output ${path.join(root, "slopcode.gpg")} --export ${keyID}`.env(signEnv)

  const releaseGpg = path.join(root, "dists", dist, "Release.gpg")
  const inRelease = path.join(root, "dists", dist, "InRelease")
  if (pass) {
    await $`gpg --batch --yes --pinentry-mode loopback --passphrase ${pass} --default-key ${keyID} --output ${releaseGpg} --detach-sign ${release}`.env(
      signEnv,
    )
    await $`gpg --batch --yes --pinentry-mode loopback --passphrase ${pass} --default-key ${keyID} --output ${inRelease} --clearsign ${release}`.env(
      signEnv,
    )
  } else {
    await $`gpg --batch --yes --default-key ${keyID} --output ${releaseGpg} --detach-sign ${release}`.env(signEnv)
    await $`gpg --batch --yes --default-key ${keyID} --output ${inRelease} --clearsign ${release}`.env(signEnv)
  }

  await $`git remote set-url origin https://x-access-token:${token}@github.com/${repo}.git`.cwd(root)
  const status = (await $`git status --porcelain`.cwd(root).text()).trim()
  if (!status) {
    console.log("apt repo: already up to date")
    return
  }

  await $`git add .`.cwd(root)
  await $`git -c user.name=slopcode -c user.email=slopcode@users.noreply.github.com commit -m ${`slopcode ${Script.version}`}`.cwd(
    root,
  )
  await $`git push origin ${branch}`.cwd(root)

  console.log("apt repo: updated", repo, Script.version)
}

await run()
