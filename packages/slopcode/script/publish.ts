#!/usr/bin/env bun
import { $ } from "bun"
import pkg from "../package.json"
import { Script } from "@slopcode-ai/script"
import { fileURLToPath } from "url"
import { gunzipSync } from "zlib"

const dir = fileURLToPath(new URL("..", import.meta.url))
process.chdir(dir)

const aliasNames = new Set(["sloppycode"])

const binaries = await Array.fromAsync(new Bun.Glob("*/package.json").scan({ cwd: "./dist" })).then((arr) =>
  Promise.all(
    arr.map(async (filepath) => {
      const dir = filepath.replace(/\/package\.json$/, "")
      if (dir === pkg.name || aliasNames.has(dir)) return

      const item = await Bun.file(`./dist/${filepath}`).json()
      let name = item.name
      if (name.startsWith(`${pkg.name}-bin-bin-`)) {
        name = name.replace(`${pkg.name}-bin-bin-`, `${pkg.name}-bin-`)
      }
      if (name.startsWith(`${pkg.name}-`) && !name.startsWith(`${pkg.name}-bin-`)) {
        name = name.replace(`${pkg.name}-`, `${pkg.name}-bin-`)
      }

      if (name !== item.name) {
        await Bun.file(`./dist/${filepath}`).write(
          JSON.stringify(
            {
              ...item,
              name,
            },
            null,
            2,
          ),
        )
      }

      if (item.version !== Script.version) {
        throw new Error(`Binary artifact version mismatch for ${name}: expected ${Script.version}, got ${item.version}`)
      }

      return {
        dir,
        name,
        version: item.version,
      }
    }),
  ).then((arr) => arr.flatMap((item) => (item ? [item] : []))),
)
const deps = Object.fromEntries(binaries.map((item) => [item.name, item.version]))
console.log("binaries", deps)
const version = Script.version
if (binaries.length === 0) {
  throw new Error("No binary artifacts found in ./dist")
}
const otp = process.env.NPM_OTP?.trim()
const skipPack = process.env.SLOPCODE_SKIP_PACK === "true"
const registry = (process.env.npm_config_registry ?? "https://registry.npmjs.org").replace(/\/$/, "")
const exists = (name: string, version: string) => fetch(`${registry}/${name}/${version}`).then((x) => x.ok)
const latestRelease = Script.channel === "latest" && Script.release
const supplemental = process.env.SLOPCODE_ENABLE_SUPPLEMENTAL_CHANNELS === "true"
const enforceApt = process.env.SLOPCODE_ENFORCE_APT === "true"
const enforceRpm = process.env.SLOPCODE_ENFORCE_RPM === "true"
const enforceApk = process.env.SLOPCODE_ENFORCE_APK === "true"
const enforceMacports = process.env.SLOPCODE_ENFORCE_MACPORTS === "true"
const aptBase = (process.env.APT_REPO_BASE_URL ?? "https://teamslop.github.io/apt-slopcode").replace(/\/$/, "")
const aptDist = process.env.APT_REPO_DIST ?? "stable"
const aptComponent = process.env.APT_REPO_COMPONENT ?? "main"
const rpmBase = (process.env.RPM_REPO_BASE_URL ?? "https://teamslop.github.io/rpm-slopcode").replace(/\/$/, "")
const apkBase = (process.env.APK_REPO_BASE_URL ?? "https://teamslop.github.io/apk-slopcode").replace(/\/$/, "")
const parse = (value: string | undefined, fallback: number) => {
  const next = Number(value)
  if (Number.isFinite(next) && next > 0) {
    return next
  }
  return fallback
}
const aptWait = parse(process.env.SLOPCODE_APT_PARITY_WAIT_MS, 600000)
const aptPoll = parse(process.env.SLOPCODE_APT_PARITY_POLL_MS, 5000)
const npmWait = parse(process.env.SLOPCODE_NPM_PARITY_WAIT_MS, 600000)
const npmPoll = parse(process.env.SLOPCODE_NPM_PARITY_POLL_MS, 5000)
const rpmWait = parse(process.env.SLOPCODE_RPM_PARITY_WAIT_MS, 600000)
const rpmPoll = parse(process.env.SLOPCODE_RPM_PARITY_POLL_MS, 5000)
const apkWait = parse(process.env.SLOPCODE_APK_PARITY_WAIT_MS, 600000)
const apkPoll = parse(process.env.SLOPCODE_APK_PARITY_POLL_MS, 5000)
const normalize = (value: string) => {
  const raw = value.trim().replace(/^v/, "")
  if (!raw) {
    return ""
  }
  const noEpoch = raw.includes(":") ? raw.split(":").slice(-1)[0] : raw
  const upstream = noEpoch.replace(/-[^-]+$/, "")
  return upstream.replace(/~/g, "-")
}
const aptVersion = (value: string) => {
  const raw = value.match(/^Version:\s*(.+)$/m)?.[1]
  if (!raw) {
    return ""
  }
  return normalize(raw)
}
const rpmVersion = (value: string) => {
  const match = value.match(/<name>slopcode<\/name>[\s\S]*?<version\s+[^>]*ver="([^"]+)"[^>]*rel="([^"]+)"/)
  if (!match) {
    return ""
  }
  return normalize(`${match[1]}-${match[2]}`)
}
const apkVersion = (value: string) => {
  const match = value.match(/(?:^|\n)P:slopcode\nV:([^\n]+)/)
  if (!match) {
    return ""
  }
  return normalize(match[1])
}
const readNpm = () =>
  fetch(`${registry}/${pkg.name}/latest`)
    .then((res) => {
      if (!res.ok) {
        throw new Error(res.statusText)
      }
      return res.json()
    })
    .then((data: { version?: string }) => data.version?.replace(/^v/, "") ?? "")
    .catch(() => "")
const readApt = (arch: string) =>
  fetch(`${aptBase}/dists/${aptDist}/${aptComponent}/binary-${arch}/Packages`)
    .then((res) => {
      if (!res.ok) {
        throw new Error(res.statusText)
      }
      return res.text()
    })
    .then(aptVersion)
    .catch(() => "")
const readRpm = () =>
  fetch(`${rpmBase}/stable/repodata/primary.xml.gz`)
    .then((res) => {
      if (!res.ok) {
        throw new Error(res.statusText)
      }
      return res.arrayBuffer()
    })
    .then((data) => rpmVersion(gunzipSync(new Uint8Array(data)).toString("utf8")))
    .catch(() => "")
const readApk = () =>
  fetch(`${apkBase}/x86_64/APKINDEX`)
    .then((res) => {
      if (!res.ok) {
        throw new Error(res.statusText)
      }
      return res.text()
    })
    .then(apkVersion)
    .catch(() => "")
const verifyAptParity = async () => {
  if (!latestRelease || !enforceApt) {
    return
  }
  const target = Script.version.replace(/^v/, "")
  const loop = async (left: number) => {
    const [npm, amd64, arm64] = await Promise.all([readNpm(), readApt("amd64"), readApt("arm64")])
    if (npm === target && amd64 === target && arm64 === target) {
      console.log("apt parity: ok", target)
      return
    }
    if (left <= 0) {
      throw new Error(
        `apt parity failed: expected ${target}, npm=${npm || "missing"}, apt-amd64=${amd64 || "missing"}, apt-arm64=${arm64 || "missing"}`,
      )
    }
    const next = Math.min(aptPoll, left)
    await Bun.sleep(next)
    return loop(left - next)
  }
  await loop(aptWait)
}
const verifyRpmParity = async () => {
  if (!latestRelease || !enforceRpm) {
    return
  }
  const target = Script.version.replace(/^v/, "")
  const loop = async (left: number) => {
    const [npm, rpm] = await Promise.all([readNpm(), readRpm()])
    if (npm === target && rpm === target) {
      console.log("rpm parity: ok", target)
      return
    }
    if (left <= 0) {
      throw new Error(`rpm parity failed: expected ${target}, npm=${npm || "missing"}, rpm=${rpm || "missing"}`)
    }
    const next = Math.min(rpmPoll, left)
    await Bun.sleep(next)
    return loop(left - next)
  }
  await loop(rpmWait)
}
const verifyApkParity = async () => {
  if (!latestRelease || !enforceApk) {
    return
  }
  const target = Script.version.replace(/^v/, "")
  const loop = async (left: number) => {
    const [npm, apk] = await Promise.all([readNpm(), readApk()])
    if (npm === target && apk === target) {
      console.log("apk parity: ok", target)
      return
    }
    if (left <= 0) {
      throw new Error(`apk parity failed: expected ${target}, npm=${npm || "missing"}, apk=${apk || "missing"}`)
    }
    const next = Math.min(apkPoll, left)
    await Bun.sleep(next)
    return loop(left - next)
  }
  await loop(apkWait)
}

const verifyNpmTargets = async (items: { name: string; version: string }[]) => {
  const loop = async (left: number) => {
    const result = await Promise.all(items.map(async (item) => ({ ...item, ready: await exists(item.name, item.version) })))
    const missing = result.filter((item) => !item.ready)
    if (missing.length === 0) {
      console.log("npm parity: ok", items.map((item) => `${item.name}@${item.version}`).join(", "))
      return
    }
    if (left <= 0) {
      throw new Error(`npm parity failed: ${missing.map((item) => `${item.name}@${item.version}`).join(", ")}`)
    }
    const next = Math.min(npmPoll, left)
    await Bun.sleep(next)
    return loop(left - next)
  }
  await loop(npmWait)
}

const readme = (await Bun.file("./README.npm.md").text()).trim()
if (!readme) {
  throw new Error("README.npm.md is missing or empty")
}

const metadata = {
  description: "The open source AI slopcoding agent.",
  homepage: "https://slopcode.dev",
  repository: {
    type: "git",
    url: "git+https://github.com/teamslop/slopcode.git",
  },
  bugs: {
    url: "https://github.com/teamslop/slopcode/issues",
  },
  keywords: ["ai", "agent", "coding", "cli", "terminal", "tui", "developer-tools", "llm"],
  funding: {
    url: "https://github.com/sponsors/teamslop",
  },
}

for (const key of ["description", "homepage", "repository", "bugs", "keywords"] as const) {
  if (!metadata[key]) {
    throw new Error(`Missing npm metadata field: ${key}`)
  }
}

if (metadata.keywords.length === 0) {
  throw new Error("Missing npm metadata field: keywords")
}

const aliases = [
  {
    name: "sloppycode",
    bin: "sloppycode",
    description: "Alias for slopcode, the open source AI slopcoding agent.",
  },
] as const

const stage = async (input: { name: string; bin: string; description: string }) => {
  await $`rm -rf ./dist/${input.name}`
  await $`mkdir -p ./dist/${input.name}`
  await $`cp -r ./bin ./dist/${input.name}/bin`
  await $`cp ./script/postinstall.mjs ./dist/${input.name}/postinstall.mjs`
  await Bun.file(`./dist/${input.name}/LICENSE`).write(await Bun.file("../../LICENSE").text())
  await Bun.file(`./dist/${input.name}/README.md`).write(readme + "\n")
  await Bun.file(`./dist/${input.name}/package.json`).write(
    JSON.stringify(
      {
        name: input.name,
        description: input.description,
        homepage: metadata.homepage,
        repository: metadata.repository,
        bugs: metadata.bugs,
        keywords: metadata.keywords,
        funding: metadata.funding,
        bin: {
          [input.bin]: `./bin/${pkg.name}`,
        },
        files: ["bin", "postinstall.mjs", "README.md", "LICENSE"],
        scripts: {
          postinstall: "bun ./postinstall.mjs || node ./postinstall.mjs",
        },
        version: version,
        license: pkg.license,
        optionalDependencies: deps,
      },
      null,
      2,
    ),
  )
}

await Promise.all([
  stage({
    name: pkg.name,
    bin: pkg.name,
    description: metadata.description,
  }),
  ...aliases.map((item) => stage(item)),
])

if (latestRelease) {
  if (enforceApt && process.env.SLOPCODE_DISABLE_APT === "true") {
    throw new Error("apt repo: disabled in a required release")
  }
  if (enforceRpm && process.env.SLOPCODE_DISABLE_RPM === "true") {
    throw new Error("rpm repo: disabled in a required release")
  }
  if (enforceApk && process.env.SLOPCODE_DISABLE_APK === "true") {
    throw new Error("apk repo: disabled in a required release")
  }
  if (enforceMacports && process.env.SLOPCODE_DISABLE_MACPORTS === "true") {
    throw new Error("macports sync: disabled in a required release")
  }
  await import("./publish-apt.ts")
  await import("./publish-rpm.ts")
  await import("./publish-apk.ts")
  await import("./publish-macports.ts")
}

const publishBinary = async (binary: (typeof binaries)[number]) => {
  if (await exists(binary.name, binary.version)) {
    console.log("skip", binary.name, binary.version)
    return
  }

  if (!skipPack) {
    if (process.platform !== "win32") {
      await $`chmod -R 755 .`.cwd(`./dist/${binary.dir}`)
    }
    await $`bash -lc "rm -f ./*.tgz"`.cwd(`./dist/${binary.dir}`)
    await $`bun pm pack`.cwd(`./dist/${binary.dir}`)
  }

  const publish = otp
    ? $`npm publish *.tgz --access public --tag ${Script.channel} --otp=${otp}`
    : $`npm publish *.tgz --access public --tag ${Script.channel}`
  await publish.cwd(`./dist/${binary.dir}`)
}

const publishPackage = async (name: string) => {
  if (await exists(name, version)) {
    console.log("skip", name, version)
    return
  }

  await $`bash -lc "rm -f ./*.tgz"`.cwd(`./dist/${name}`)
  await $`bun pm pack`.cwd(`./dist/${name}`)
  const publish = otp
    ? $`npm publish *.tgz --access public --tag ${Script.channel} --otp=${otp}`
    : $`npm publish *.tgz --access public --tag ${Script.channel}`
  await publish.cwd(`./dist/${name}`)
}

for (const binary of binaries) {
  await publishBinary(binary)
}
await verifyNpmTargets(binaries)
await publishPackage(pkg.name)
await verifyNpmTargets([{ name: pkg.name, version }])
for (const item of aliases) {
  await publishPackage(item.name)
}
await verifyAptParity()
await verifyRpmParity()
await verifyApkParity()

if (Script.channel === "latest" && supplemental) {
  const jobs = [import("./publish-aur.ts"), import("./publish-snap.ts")]
  if (process.env.SLOPCODE_DISABLE_HOMEBREW !== "true") {
    jobs.push(import("./publish-homebrew.ts"))
  } else {
    console.log("homebrew tap: disabled")
  }
  await Promise.all(jobs)
} else if (Script.channel === "latest") {
  console.log("supplemental channels: disabled")
}

// Supplemental channels sourced from npm artifacts.
//
// Disabled channels:
// - GHCR container publish
