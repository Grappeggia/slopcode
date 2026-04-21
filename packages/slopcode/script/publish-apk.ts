#!/usr/bin/env bun

import { $ } from "bun"
import { Script } from "@slopcode-ai/script"
import fs from "fs/promises"
import os from "os"
import path from "path"
import { gunzipSync } from "zlib"

const token = process.env.APK_REPO_TOKEN ?? process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN
const repo = process.env.APK_REPO_REPO ?? "teamslop/apk-slopcode"
const branch = process.env.APK_REPO_BRANCH ?? "main"
const base = (process.env.APK_REPO_BASE_URL ?? "https://teamslop.github.io/apk-slopcode").replace(/\/$/, "")
const source = process.env.GH_REPO ?? "teamslop/slopcode"
const image = process.env.APK_REPO_IMAGE ?? "alpine:3.20"
const enforce = process.env.SLOPCODE_ENFORCE_APK === "true"

const tarEntry = (data: Buffer | Uint8Array, file: string) => {
  let offset = 0
  while (offset + 512 <= data.length) {
    const header = Uint8Array.from(data.subarray(offset, offset + 512))
    const name = Buffer.from(header.subarray(0, 100)).toString("utf8").replace(/\0.*$/, "")
    if (!name) {
      return
    }

    const sizeRaw = Buffer.from(header.subarray(124, 136)).toString("utf8").replace(/\0.*$/, "").trim()
    const size = Number.parseInt(sizeRaw || "0", 8)
    const start = offset + 512
    const end = start + size
    if (name === file) {
      return Uint8Array.from(data.subarray(start, end))
    }

    offset = start + Math.ceil(size / 512) * 512
  }
}

const run = async () => {
  if (Script.channel !== "latest") {
    console.log("apk repo: skip", Script.channel)
    return
  }

  if (!Script.release) {
    console.log("apk repo: skip release")
    return
  }

  if (process.env.SLOPCODE_DISABLE_APK === "true") {
    if (enforce) {
      throw new Error("apk repo: disabled in a required release")
    }
    console.log("apk repo: disabled")
    return
  }

  if (!token) {
    if (enforce) {
      throw new Error("apk repo: missing APK_REPO_TOKEN/GITHUB_TOKEN/GH_TOKEN in a required release")
    }
    console.log("apk repo: skip missing APK_REPO_TOKEN/GITHUB_TOKEN/GH_TOKEN")
    return
  }

  const docker = (await $`which docker`.quiet().nothrow().text()).trim()
  if (!docker) {
    if (enforce) {
      throw new Error("apk repo: docker is required in a required release")
    }
    console.log("apk repo: skip missing docker")
    return
  }

  const version = Script.version.replace(/^v/, "")
  if (!version) {
    throw new Error("Missing release version")
  }

  const tag = `v${Script.version}`
  const env = {
    ...process.env,
    GH_TOKEN: token,
  }
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "slopcode-apk-"))
  const artifacts = path.join(tmp, "artifacts")
  const root = path.join(tmp, "repo")
  const build = path.join(tmp, "build")
  const out = path.join(tmp, "out")
  const arch = path.join(root, "x86_64")
  await fs.mkdir(artifacts, { recursive: true })
  await fs.mkdir(build, { recursive: true })
  await fs.mkdir(out, { recursive: true })

  await $`gh release download ${tag} --repo ${source} --dir ${artifacts} --pattern slopcode-linux-x64-baseline-musl.tar.gz`.env(
    env,
  )
  await $`gh repo clone ${repo} ${root} -- --depth=1 --branch ${branch}`.env(env)
  await fs.mkdir(arch, { recursive: true })

  await $`tar -xzf ${path.join(artifacts, "slopcode-linux-x64-baseline-musl.tar.gz")} -C ${build}`
  const binary = path.join(build, "slopcode")
  if (!(await Bun.file(binary).exists())) {
    throw new Error(`Missing apk source binary at ${binary}`)
  }

  const apkbuild = [
    "pkgname=slopcode",
    `pkgver=${version}`,
    "pkgrel=0",
    'pkgdesc="The open source AI slopcoding agent focused on terminal workflows."',
    'url="https://slopcode.dev"',
    'arch="x86_64"',
    'license="MIT"',
    'maintainer="SlopCode Team <support@slopcode.dev>"',
    'options="!check !strip"',
    'source="$pkgname"',
    "build() {",
    "  :",
    "}",
    "package() {",
    '  install -Dm755 "$srcdir/$pkgname" "$pkgdir/usr/bin/slopcode"',
    '  if [ -d "$srcdir/neovim" ]; then',
    '    install -dm755 "$pkgdir/usr/lib/slopcode"',
    '    cp -a "$srcdir/neovim" "$pkgdir/usr/lib/slopcode/neovim"',
    "  fi",
    "}",
    "",
  ].join("\n")
  await Bun.write(path.join(build, "APKBUILD"), apkbuild)

  const command = [
    "apk add --no-cache alpine-sdk >/dev/null",
    "adduser -D builder >/dev/null",
    "addgroup builder abuild >/dev/null",
    "chown -R builder:builder /work/build",
    "su builder -c 'cd /work/build && abuild-keygen -a -n >/dev/null && abuild checksum >/dev/null && abuild -r -P /work/out rootpkg'",
    "apk index --allow-untrusted -o /work/out/work/x86_64/APKINDEX.tar.gz /work/out/work/x86_64/*.apk",
  ].join(" && ")
  await $`docker run --rm --platform linux/amd64 -v ${tmp}:/work ${image} sh -lc ${command}`

  const built = path.join(out, "work", "x86_64")
  const pkg = await Array.fromAsync(new Bun.Glob("*.apk").scan({ cwd: built })).then((arr) => arr[0])
  if (!pkg) {
    throw new Error("Missing apk artifact")
  }

  const indexTar = path.join(built, "APKINDEX.tar.gz")
  if (!(await Bun.file(indexTar).exists())) {
    throw new Error("Missing APKINDEX.tar.gz")
  }

  await $`docker run --rm --platform linux/amd64 -v ${tmp}:/work ${image} sh -lc ${[
    "set -eu",
    "mkdir -p /work/verify/etc/apk/keys",
    "cp -a /etc/apk/keys/. /work/verify/etc/apk/keys/",
    `apk add --allow-untrusted --root /work/verify --initdb /work/out/work/x86_64/${pkg} >/dev/null`,
    "test -x /work/verify/usr/bin/slopcode",
    "test -x /work/verify/usr/lib/slopcode/neovim/bin/nvim",
  ].join(" && ")}`

  await $`cp ${path.join(built, pkg)} ${path.join(arch, pkg)}`
  await $`cp ${indexTar} ${path.join(arch, "APKINDEX.tar.gz")}`

  const plain = tarEntry(gunzipSync(new Uint8Array(await Bun.file(indexTar).arrayBuffer())), "APKINDEX")
  if (!plain) {
    throw new Error("Missing APKINDEX entry in archive")
  }
  await Bun.write(path.join(arch, "APKINDEX"), plain)

  const install = [
    "#!/usr/bin/env sh",
    "set -eu",
    'if [ "$(id -u)" -ne 0 ]; then',
    '  echo "Please run as root (sudo)." >&2',
    "  exit 1",
    "fi",
    'arch="$(apk --print-arch)"',
    'if [ "$arch" != "x86_64" ]; then',
    '  echo "Unsupported architecture: $arch" >&2',
    "  exit 1",
    "fi",
    `repo="${base}"`,
    'if ! grep -qxF "$repo" /etc/apk/repositories; then',
    '  printf "%s\\n" "$repo" >> /etc/apk/repositories',
    "fi",
    "apk update",
    "apk add --allow-untrusted slopcode",
    "",
  ].join("\n")

  await Bun.write(path.join(root, "install.sh"), install)
  await $`chmod 755 ${path.join(root, "install.sh")}`
  await Bun.write(
    path.join(root, "latest.json"),
    JSON.stringify(
      {
        version,
        updated_at: new Date().toISOString(),
        package: pkg,
      },
      null,
      2,
    ) + "\n",
  )

  await $`git remote set-url origin https://x-access-token:${token}@github.com/${repo}.git`.cwd(root)
  const status = (await $`git status --porcelain`.cwd(root).text()).trim()
  if (!status) {
    console.log("apk repo: already up to date")
    return
  }

  await $`git add .`.cwd(root)
  await $`git -c user.name=slopcode -c user.email=slopcode@users.noreply.github.com commit -m ${`slopcode ${Script.version}`}`.cwd(
    root,
  )
  await $`git push origin ${branch}`.cwd(root)

  console.log("apk repo: updated", repo, Script.version)
}

await run()
