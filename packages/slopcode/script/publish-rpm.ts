#!/usr/bin/env bun

import { $ } from "bun"
import { Script } from "@slopcode-ai/script"
import fs from "fs/promises"
import os from "os"
import path from "path"

const token = process.env.RPM_REPO_TOKEN ?? process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN
const repo = process.env.RPM_REPO_REPO ?? "teamslop/rpm-slopcode"
const branch = process.env.RPM_REPO_BRANCH ?? "main"
const base = (process.env.RPM_REPO_BASE_URL ?? "https://teamslop.github.io/rpm-slopcode").replace(/\/$/, "")
const source = process.env.GH_REPO ?? "teamslop/slopcode"
const enforce = process.env.SLOPCODE_ENFORCE_RPM === "true"

const run = async () => {
  if (Script.channel !== "latest") {
    console.log("rpm repo: skip", Script.channel)
    return
  }

  if (!Script.release) {
    console.log("rpm repo: skip release")
    return
  }

  if (process.env.SLOPCODE_DISABLE_RPM === "true") {
    if (enforce) {
      throw new Error("rpm repo: disabled in a required release")
    }
    console.log("rpm repo: disabled")
    return
  }

  if (!token) {
    if (enforce) {
      throw new Error("rpm repo: missing RPM_REPO_TOKEN/GITHUB_TOKEN/GH_TOKEN in a required release")
    }
    console.log("rpm repo: skip missing RPM_REPO_TOKEN/GITHUB_TOKEN/GH_TOKEN")
    return
  }

  const rpmbuild = (await $`which rpmbuild`.quiet().nothrow().text()).trim()
  const createrepo = (await $`which createrepo_c`.quiet().nothrow().text()).trim()
  if (!rpmbuild || !createrepo) {
    if (enforce) {
      throw new Error("rpm repo: rpmbuild and createrepo_c are required in a required release")
    }
    console.log("rpm repo: skip missing rpmbuild/createrepo_c")
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
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "slopcode-rpm-"))
  const artifacts = path.join(tmp, "artifacts")
  const root = path.join(tmp, "repo")
  const stable = path.join(root, "stable")
  await fs.mkdir(artifacts, { recursive: true })

  await $`gh release download ${tag} --repo ${source} --dir ${artifacts} --pattern slopcode-linux-x64-baseline.tar.gz --pattern slopcode-linux-arm64.tar.gz`.env(
    env,
  )
  await $`gh repo clone ${repo} ${root} -- --depth=1 --branch ${branch}`.env(env)
  await fs.mkdir(stable, { recursive: true })

  const date = (() => {
    const parts = new Date().toUTCString().split(" ")
    const day = parts[0]?.replace(",", "") || "Wed"
    const month = parts[2] || "Mar"
    const dayOfMonth = parts[1] || "04"
    const year = parts[3] || "2026"
    return `${day} ${month} ${dayOfMonth} ${year}`
  })()

  const built = await Promise.all(
    [
      {
        arch: "x86_64",
        asset: "slopcode-linux-x64-baseline.tar.gz",
      },
      {
        arch: "aarch64",
        asset: "slopcode-linux-arm64.tar.gz",
      },
    ].map(async (item) => {
      const work = path.join(tmp, item.arch)
      const src = path.join(work, "src")
      const top = path.join(work, "rpmbuild")
      await fs.mkdir(src, { recursive: true })
      await fs.mkdir(path.join(top, "SOURCES"), { recursive: true })
      await fs.mkdir(path.join(top, "SPECS"), { recursive: true })

      await $`tar -xzf ${path.join(artifacts, item.asset)} -C ${src}`
      const binary = path.join(src, "slopcode")
      if (!(await Bun.file(binary).exists())) {
        throw new Error(`Missing rpm source binary at ${binary}`)
      }

      await $`cp ${binary} ${path.join(top, "SOURCES", "slopcode")}`
      if (await Bun.file(path.join(src, "neovim")).exists()) {
        await $`cp -r ${path.join(src, "neovim")} ${path.join(top, "SOURCES", "neovim")}`
      }

      const spec = [
        "%global __os_install_post %{nil}",
        "%global _build_id_links none",
        "%global debug_package %{nil}",
        "Name: slopcode",
        `Version: ${version}`,
        "Release: 1",
        "Summary: The open source AI slopcoding agent",
        "License: MIT",
        "URL: https://slopcode.dev",
        `BuildArch: ${item.arch}`,
        "Source0: slopcode",
        "",
        "%description",
        "SlopCode is an open source AI slopcoding agent focused on terminal workflows.",
        "",
        "%prep",
        "",
        "%build",
        "",
        "%install",
        "install -Dm755 %{SOURCE0} %{buildroot}/usr/bin/slopcode",
        "if [ -d %{_sourcedir}/neovim ]; then",
        "  mkdir -p %{buildroot}/usr/lib/slopcode",
        "  cp -a %{_sourcedir}/neovim %{buildroot}/usr/lib/slopcode/neovim",
        "fi",
        "",
        "%files",
        "/usr/bin/slopcode",
        "%dir /usr/lib/slopcode",
        "/usr/lib/slopcode/neovim",
        "",
        "%changelog",
        `* ${date} SlopCode Team <support@slopcode.dev> - ${version}-1`,
        "- Automated release",
        "",
      ].join("\n")
      await Bun.write(path.join(top, "SPECS", "slopcode.spec"), spec)

      await $`rpmbuild --define ${`_topdir ${top}`} --target ${item.arch} -bb ${path.join(top, "SPECS", "slopcode.spec")}`

      const built = await Array.fromAsync(new Bun.Glob(`RPMS/${item.arch}/*.rpm`).scan({ cwd: top })).then(
        (arr) => arr[0],
      )
      if (!built) {
        throw new Error(`Missing rpm artifact for ${item.arch}`)
      }

      const srcRpm = path.join(top, built)
      const list = await $`rpm -qlp ${srcRpm}`.text()
      if (!list.includes("/usr/bin/slopcode") || !list.includes("/usr/lib/slopcode/neovim/bin/nvim")) {
        throw new Error(`RPM smoke failed for ${item.arch}`)
      }
      const dstRpm = path.join(stable, path.basename(srcRpm))
      await $`cp ${srcRpm} ${dstRpm}`
      return {
        arch: item.arch,
        file: path.basename(dstRpm),
      }
    }),
  )

  await $`createrepo_c --update ${stable}`

  const install = [
    "#!/usr/bin/env bash",
    "set -euo pipefail",
    'if [ "$(id -u)" -ne 0 ]; then',
    '  echo "Please run as root (sudo)." >&2',
    "  exit 1",
    "fi",
    "if command -v zypper >/dev/null 2>&1; then",
    "  mkdir -p /etc/zypp/repos.d",
    "  cat > /etc/zypp/repos.d/slopcode.repo <<'EOF'",
    "[slopcode]",
    "name=SlopCode",
    `baseurl=${base}/stable`,
    "enabled=1",
    "gpgcheck=0",
    "repo_gpgcheck=0",
    "EOF",
    "  zypper --non-interactive refresh",
    "  zypper --non-interactive install slopcode",
    "  exit 0",
    "fi",
    "mkdir -p /etc/yum.repos.d",
    "cat > /etc/yum.repos.d/slopcode.repo <<'EOF'",
    "[slopcode]",
    "name=SlopCode",
    `baseurl=${base}/stable`,
    "enabled=1",
    "gpgcheck=0",
    "repo_gpgcheck=0",
    "EOF",
    "if command -v dnf >/dev/null 2>&1; then",
    "  dnf -y makecache",
    "  dnf -y install slopcode",
    "  exit 0",
    "fi",
    "if command -v yum >/dev/null 2>&1; then",
    "  yum -y makecache",
    "  yum -y install slopcode",
    "  exit 0",
    "fi",
    'echo "Neither zypper, dnf, nor yum was found" >&2',
    "exit 1",
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
        packages: built,
      },
      null,
      2,
    ) + "\n",
  )

  await $`git remote set-url origin https://x-access-token:${token}@github.com/${repo}.git`.cwd(root)
  const status = (await $`git status --porcelain`.cwd(root).text()).trim()
  if (!status) {
    console.log("rpm repo: already up to date")
    return
  }

  await $`git add .`.cwd(root)
  await $`git -c user.name=slopcode -c user.email=slopcode@users.noreply.github.com commit -m ${`slopcode ${Script.version}`}`.cwd(
    root,
  )
  await $`git push origin ${branch}`.cwd(root)

  console.log("rpm repo: updated", repo, Script.version)
}

await run()
