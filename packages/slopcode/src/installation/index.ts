import { BusEvent } from "@/bus/bus-event"
import path from "path"
import { $ } from "bun"
import z from "zod"
import { NamedError } from "@slopcode-ai/util/error"
import { product } from "@slopcode-ai/util/product"
import { Log } from "../util/log"
import { Flag } from "../flag/flag"

declare global {
  const SLOPCODE_VERSION: string
  const SLOPCODE_CHANNEL: string
}

export namespace Installation {
  const log = Log.create({ service: "installation" })
  const pkg = product.package
  const nixRef = product.id
  const repo = product.github.full_repo
  const nixMatch = new RegExp(`(^|[^a-z0-9])${nixRef}([^a-z0-9]|$)`, "i")

  const aptNormalizedVersion = (value: string) => {
    const plain = value.trim().replace(/^v/, "")
    if (!plain) return plain
    const noEpoch = plain.includes(":") ? plain.split(":").slice(-1)[0] : plain
    const upstream = noEpoch.replace(/-[^-]+$/, "")
    return upstream.replace(/~/g, "-")
  }

  const aptPackageVersion = (value: string) => {
    const plain = value.trim().replace(/^v/, "")
    if (!plain) return plain
    if (plain.includes(":")) return plain
    if (/-\d+$/.test(plain)) return plain
    return `${plain.replace(/-/g, "~")}-1`
  }

  const aptCandidate = (policy: string) => {
    const match = policy.match(/^\s*Candidate:\s*(\S+)/m)
    if (!match) {
      return
    }
    const value = match[1]
    if (value === "(none)") {
      return
    }
    return value
  }

  const aptPolicy = () => $`apt-cache policy ${pkg}`.throws(false).quiet().text()

  const infoVersion = (info: string) => {
    const match = info.match(/^\s*Version\s*:\s*(\S+)/m)
    if (!match) {
      return
    }
    return match[1]
  }

  const rpmVersion = (info: string) => {
    const version = infoVersion(info)
    if (!version) {
      return
    }
    const release = info.match(/^\s*Release\s*:\s*(\S+)/m)?.[1]
    if (!release) {
      return version
    }
    return `${version}-${release}`
  }

  const apkVersion = (info: string) => {
    const value = info.match(/^\s*([0-9][A-Za-z0-9._:+~-]*)\s*:/m)?.[1]
    if (!value) {
      return
    }
    return value.replace(/-r\d+$/, "")
  }

  const pkgVersion = (info: string) => {
    const value = info.trim().split("\n")[0]?.trim().replace(/^v/, "")
    if (!value) {
      return
    }
    const noEpoch = value.includes(":") ? value.split(":").slice(-1)[0] : value
    return noEpoch.replace(/_[0-9]+$/, "")
  }

  const portVersion = (info: string) => {
    const value = info.match(/@([0-9][A-Za-z0-9._:+~-]*)/)?.[1]
    if (!value) {
      return
    }
    return value.replace(/_[0-9]+$/, "")
  }

  const aptNeedsPrivilege = (stderr: string) => {
    const text = stderr.toLowerCase()
    return (
      text.includes("a password is required") ||
      text.includes("not in the sudoers") ||
      text.includes("permission denied") ||
      text.includes("no tty present") ||
      text.includes("command not found")
    )
  }

  const rpmNeedsPrivilege = (stderr: string) => {
    const text = stderr.toLowerCase()
    return (
      aptNeedsPrivilege(stderr) ||
      text.includes("superuser privileges") ||
      text.includes("run under the root user") ||
      text.includes("need to be root") ||
      text.includes("run this command as root") ||
      text.includes("root privileges are required")
    )
  }

  const zypperNeedsPrivilege = (stderr: string) => {
    const text = stderr.toLowerCase()
    return rpmNeedsPrivilege(stderr) || text.includes("you must be root")
  }

  const macportsNeedsPrivilege = (stderr: string) => {
    const text = stderr.toLowerCase()
    return (
      aptNeedsPrivilege(stderr) ||
      text.includes("insufficient privileges") ||
      text.includes("must be run as root") ||
      text.includes("are not allowed to write") ||
      text.includes("permission denied")
    )
  }

  const apkNeedsPrivilege = (stderr: string) => {
    const text = stderr.toLowerCase()
    return (
      aptNeedsPrivilege(stderr) ||
      text.includes("unable to lock database") ||
      text.includes("failed to open apk database") ||
      text.includes("operation not permitted")
    )
  }

  const pkgNeedsPrivilege = (stderr: string) => {
    const text = stderr.toLowerCase()
    return (
      aptNeedsPrivilege(stderr) ||
      text.includes("insufficient privileges") ||
      text.includes("not enough privileges") ||
      text.includes("must be root")
    )
  }

  const snapNeedsPrivilege = (stderr: string) => {
    const text = stderr.toLowerCase()
    return (
      text.includes("a password is required") ||
      text.includes("not in the sudoers") ||
      text.includes("permission denied") ||
      text.includes("requires root") ||
      text.includes("must be run as root") ||
      text.includes("no tty present") ||
      text.includes("command not found")
    )
  }

  const pacmanNeedsPrivilege = (stderr: string) => {
    const text = stderr.toLowerCase()
    return (
      text.includes("a password is required") ||
      text.includes("not in the sudoers") ||
      text.includes("permission denied") ||
      text.includes("no tty present") ||
      text.includes("command not found") ||
      text.includes("you cannot perform this operation unless you are root")
    )
  }

  const aptUpgradeCommand = (pkg: string) => {
    const env = {
      DEBIAN_FRONTEND: "noninteractive",
      ...process.env,
    }
    if (typeof process.getuid === "function" && process.getuid() === 0) {
      return $`apt-get install -y --only-upgrade ${pkg}`.env(env)
    }
    return $`sudo -n apt-get install -y --only-upgrade ${pkg}`.env(env)
  }

  const zypperUpgradeCommand = (pkg: string) => {
    if (typeof process.getuid === "function" && process.getuid() === 0) {
      return $`zypper --non-interactive update ${pkg}`
    }
    return $`sudo -n zypper --non-interactive update ${pkg}`
  }

  const dnfUpgradeCommand = (pkg: string) => {
    if (typeof process.getuid === "function" && process.getuid() === 0) {
      return $`dnf upgrade -y ${pkg}`
    }
    return $`sudo -n dnf upgrade -y ${pkg}`
  }

  const yumUpgradeCommand = (pkg: string) => {
    if (typeof process.getuid === "function" && process.getuid() === 0) {
      return $`yum update -y ${pkg}`
    }
    return $`sudo -n yum update -y ${pkg}`
  }

  const apkUpgradeCommand = (pkg: string) => {
    if (typeof process.getuid === "function" && process.getuid() === 0) {
      return $`apk upgrade --no-interactive ${pkg}`
    }
    return $`sudo -n apk upgrade --no-interactive ${pkg}`
  }

  const pkgUpgradeCommand = (pkg: string) => {
    if (typeof process.getuid === "function" && process.getuid() === 0) {
      return $`pkg upgrade -y ${pkg}`
    }
    return $`sudo -n pkg upgrade -y ${pkg}`
  }

  const macportsUpgradeCommand = (pkg: string) => {
    if (typeof process.getuid === "function" && process.getuid() === 0) {
      return $`port -N upgrade ${pkg}`
    }
    return $`sudo -n port -N upgrade ${pkg}`
  }

  const pacmanUpgradeCommand = (pkg: string) => {
    if (typeof process.getuid === "function" && process.getuid() === 0) {
      return $`pacman -S --noconfirm --needed ${pkg}`
    }
    return $`sudo -n pacman -S --noconfirm --needed ${pkg}`
  }

  const snapUpgradeCommand = () => {
    if (typeof process.getuid === "function" && process.getuid() === 0) {
      return $`snap refresh ${pkg}`
    }
    return $`sudo -n snap refresh ${pkg}`
  }

  const normalizeValue = (value: string) => {
    const clean = value.trim().replace(/^"|"$/g, "")
    if (!clean || clean === "undefined" || clean === "null") {
      return
    }
    return clean
  }

  const normalizeRegistry = (value: string) => {
    const clean = normalizeValue(value)
    if (!clean) {
      return
    }
    return clean.endsWith("/") ? clean.slice(0, -1) : clean
  }

  const npmRegistry = async () => {
    const value = await $`npm config get registry`.quiet().nothrow().text()
    return normalizeRegistry(value) || "https://registry.npmjs.org"
  }

  const yarnRegistry = async () => {
    const value = await $`yarn config get npmRegistryServer`.quiet().nothrow().text()
    return normalizeRegistry(value) || (await npmRegistry())
  }

  const yarnMajor = async () => {
    const value = (await $`yarn --version`.quiet().nothrow().text()).trim().replace(/^v/, "")
    const major = Number.parseInt(value.split(".")[0] || "", 10)
    if (!Number.isFinite(major)) {
      return
    }
    return major
  }

  const yarnProject = async () => {
    const value = await $`yarn config get projectCwd`.quiet().nothrow().text()
    return normalizeValue(value)
  }

  export async function yarnContext() {
    const major = await yarnMajor()
    const mode = major && major >= 2 ? "berry" : major === 1 ? "classic" : "unknown"
    if (mode !== "berry") {
      return { mode }
    }
    return {
      mode,
      root: await yarnProject(),
    }
  }

  const nixVersionInstallable = (source: string) => {
    const normalized = source.startsWith("flake:") ? source.replace(/^flake:/, "") : source
    const arch = process.arch === "x64" ? "x86_64" : process.arch === "arm64" ? "aarch64" : process.arch
    const os = process.platform === "darwin" ? "darwin" : process.platform === "linux" ? "linux" : process.platform
    return `${normalized}#packages.${arch}-${os}.${nixRef}.version`
  }

  const isNixEntry = (entry: {
    attrPath?: string
    flake?: string
    originalUrl?: string
    url?: string
    storePaths?: string[]
  }) => {
    const source = [entry.attrPath, entry.flake, entry.originalUrl, entry.url, ...(entry.storePaths ?? [])]
    return source.some((item) => !!item && nixMatch.test(item))
  }

  const nixEntry = async () => {
    const output = await $`nix profile list --json`.throws(false).quiet().text()
    if (!output.trim()) {
      return
    }
    try {
      const parsed = JSON.parse(output) as Record<
        string,
        {
          attrPath?: string
          flake?: string
          originalUrl?: string
          url?: string
          storePaths?: string[]
        }
      >
      const pair = Object.entries(parsed).find(([, value]) => isNixEntry(value))
      if (!pair) {
        return
      }
      const [index, value] = pair
      return {
        index,
        ...value,
      }
    } catch {
      return
    }
  }

  const nixSource = (entry: {
    attrPath?: string
    flake?: string
    originalUrl?: string
    url?: string
    storePaths?: string[]
  }) => {
    if (entry.flake) {
      return entry.flake
    }
    if (entry.originalUrl) {
      return entry.originalUrl
    }
    if (entry.url) {
      return entry.url
    }
    return
  }

  export type Method = Awaited<ReturnType<typeof method>>

  export async function nixSelector() {
    return (await nixEntry())?.index
  }

  export const Event = {
    Updated: BusEvent.define(
      "installation.updated",
      z.object({
        version: z.string(),
      }),
    ),
    UpdateAvailable: BusEvent.define(
      "installation.update-available",
      z.object({
        version: z.string(),
      }),
    ),
  }

  export const Info = z
    .object({
      version: z.string(),
      latest: z.string(),
    })
    .meta({
      ref: "InstallationInfo",
    })
  export type Info = z.infer<typeof Info>

  export async function info() {
    return {
      version: VERSION,
      latest: await latest(),
    }
  }

  export function isPreview() {
    return CHANNEL !== "latest"
  }

  export function isLocal() {
    return CHANNEL === "local"
  }

  export async function method() {
    if (process.execPath.includes(path.join(`.${product.id}`, "bin"))) return "curl"
    if (process.execPath.includes(path.join(".local", "bin"))) return "curl"
    const exec = process.execPath.toLowerCase()
    if (await nixSelector()) return "nix"
    const agent = process.env.npm_config_user_agent?.toLowerCase()
    if (agent?.includes("yarn/")) return "yarn"

    const checks = [
      {
        name: "npm" as const,
        command: () => $`npm list -g --depth=0`.throws(false).quiet().text(),
      },
      {
        name: "yarn" as const,
        command: () => $`yarn global list`.throws(false).quiet().text(),
      },
      {
        name: "pnpm" as const,
        command: () => $`pnpm list -g --depth=0`.throws(false).quiet().text(),
      },
      {
        name: "bun" as const,
        command: () => $`bun pm ls -g`.throws(false).quiet().text(),
      },
      {
        name: "brew" as const,
        command: () => $`brew list --formula ${pkg}`.throws(false).quiet().text(),
      },
      {
        name: "macports" as const,
        command: () => $`port installed ${pkg}`.throws(false).quiet().text(),
      },
      {
        name: "apt" as const,
        command: () => $`dpkg-query -W -f='\${Package}' ${pkg}`.throws(false).quiet().text(),
      },
      {
        name: "zypper" as const,
        command: () => $`zypper search --installed-only --match-exact ${pkg}`.throws(false).quiet().text(),
      },
      {
        name: "dnf" as const,
        command: () => $`dnf list --installed ${pkg}`.throws(false).quiet().text(),
      },
      {
        name: "yum" as const,
        command: () => $`yum list installed ${pkg}`.throws(false).quiet().text(),
      },
      {
        name: "apk" as const,
        command: () => $`apk info -e ${pkg}`.throws(false).quiet().text(),
      },
      {
        name: "pkg" as const,
        command: () => $`pkg info ${pkg}`.throws(false).quiet().text(),
      },
      {
        name: "pacman" as const,
        command: () => $`pacman -Q ${pkg}`.throws(false).quiet().text(),
      },
      {
        name: "paru" as const,
        match: "slopcode-bin",
        command: () => $`paru -Q slopcode-bin`.throws(false).quiet().text(),
      },
      {
        name: "snap" as const,
        command: () => $`snap list ${pkg}`.throws(false).quiet().text(),
      },
      {
        name: "scoop" as const,
        command: () => $`scoop list ${pkg}`.throws(false).quiet().text(),
      },
      {
        name: "choco" as const,
        command: () => $`choco list --limit-output ${pkg}`.throws(false).quiet().text(),
      },
    ]

    checks.sort((a, b) => {
      const aMatches = exec.includes(a.name)
      const bMatches = exec.includes(b.name)
      if (aMatches && !bMatches) return -1
      if (!aMatches && bMatches) return 1
      return 0
    })

    for (const check of checks) {
      const output = await check.command()
      const installedName = check.match || pkg
      if (output.includes(installedName)) {
        return check.name
      }
    }

    return "unknown"
  }

  export const UpgradeFailedError = NamedError.create(
    "UpgradeFailedError",
    z.object({
      stderr: z.string(),
    }),
  )

  async function getBrewFormula() {
    const tap = `${product.github.owner}/${product.github.repo}/${pkg}`
    const tapFormula = await $`brew list --formula ${tap}`.throws(false).quiet().text()
    if (tapFormula.includes(pkg)) return tap
    const coreFormula = await $`brew list --formula ${pkg}`.throws(false).quiet().text()
    if (coreFormula.includes(pkg)) return pkg
    return pkg
  }

  export async function upgrade(method: Method, target: string) {
    let cmd
    switch (method) {
      case "curl":
        cmd = $`curl -fsSL ${product.urls.install} | bash`.env({
          ...process.env,
          VERSION: target,
        })
        break
      case "npm":
        cmd = $`npm install -g ${pkg}@${target}`
        break
      case "pnpm":
        cmd = $`pnpm install -g ${pkg}@${target}`
        break
      case "yarn": {
        const yarn = await yarnContext()
        if (yarn.mode === "berry") {
          if (!yarn.root) {
            throw new UpgradeFailedError({
              stderr:
                "Could not detect a Yarn Berry project root. Run this command from your Yarn project or use --method npm, --method pnpm, or --method bun.",
            })
          }
          cmd = $`yarn up ${pkg}@${target}`.cwd(yarn.root)
          break
        }
        cmd = $`yarn global add ${pkg}@${target}`
        break
      }
      case "bun":
        cmd = $`bun install -g ${pkg}@${target}`
        break
      case "nix": {
        const selector = await nixSelector()
        if (!selector) {
          throw new UpgradeFailedError({
            stderr: `Could not find ${pkg} in your nix profile. Install with: nix profile install github:${repo}#${nixRef}`,
          })
        }
        cmd = $`nix profile upgrade ${selector}`
        break
      }
      case "brew": {
        const formula = await getBrewFormula()
        if (formula.includes("/")) {
          const tap = `${product.github.owner}/${product.github.repo}`
          cmd = $`brew tap ${tap} && cd "$(brew --repo ${tap})" && git pull --ff-only && brew upgrade ${formula}`.env({
            HOMEBREW_NO_AUTO_UPDATE: "1",
            ...process.env,
          })
          break
        }
        cmd = $`brew upgrade ${formula}`.env({
          HOMEBREW_NO_AUTO_UPDATE: "1",
          ...process.env,
        })
        break
      }
      case "apt": {
        const candidate = aptCandidate(await aptPolicy())
        const version = candidate && aptNormalizedVersion(candidate) === target ? undefined : aptPackageVersion(target)
        const targetPkg = version ? `${pkg}=${version}` : pkg
        cmd = aptUpgradeCommand(targetPkg)
        break
      }
      case "zypper":
        cmd = zypperUpgradeCommand(pkg)
        break
      case "dnf":
        cmd = dnfUpgradeCommand(pkg)
        break
      case "yum":
        cmd = yumUpgradeCommand(pkg)
        break
      case "apk":
        cmd = apkUpgradeCommand(pkg)
        break
      case "pkg":
        cmd = pkgUpgradeCommand(pkg)
        break
      case "macports":
        cmd = macportsUpgradeCommand(pkg)
        break
      case "pacman":
        cmd = pacmanUpgradeCommand(pkg)
        break
      case "paru":
        cmd = $`paru -S --noconfirm --needed slopcode-bin`
        break
      case "choco":
        cmd = $`echo Y | choco upgrade ${pkg} --version=${target}`
        break
      case "scoop":
        cmd = $`scoop install ${pkg}@${target}`
        break

      case "snap":
        cmd = snapUpgradeCommand()
        break
      default:
        throw new Error(`Unknown method: ${method}`)
    }
    const result = await cmd.quiet().throws(false)
    if (result.exitCode !== 0) {
      const stderrText = result.stderr.toString("utf8")
      const stdoutText = result.stdout.toString("utf8")
      const output = stderrText.trim() ? stderrText : stdoutText
      const stderr =
        method === "choco"
          ? "not running from an elevated command shell"
          : method === "apt" && aptNeedsPrivilege(stderrText)
            ? "not running from a privileged shell"
            : method === "zypper" && zypperNeedsPrivilege(stderrText)
              ? "not running from a privileged shell"
              : (method === "dnf" || method === "yum") && rpmNeedsPrivilege(stderrText)
                ? "not running from a privileged shell"
                : method === "apk" && apkNeedsPrivilege(stderrText)
                  ? "not running from a privileged shell"
                  : method === "pkg" && pkgNeedsPrivilege(stderrText)
                    ? "not running from a privileged shell"
                    : method === "macports" && macportsNeedsPrivilege(stderrText)
                      ? "not running from a privileged shell"
                      : method === "pacman" && pacmanNeedsPrivilege(stderrText)
                        ? "not running from a privileged shell"
                        : method === "snap" && snapNeedsPrivilege(stderrText)
                          ? "not running from a privileged shell"
                          : output
      throw new UpgradeFailedError({
        stderr: stderr,
      })
    }
    log.info("upgraded", {
      method,
      target,
      stdout: result.stdout.toString(),
      stderr: result.stderr.toString(),
    })
    await $`${process.execPath} --version`.nothrow().quiet().text()
  }

  export const VERSION = typeof SLOPCODE_VERSION === "string" ? SLOPCODE_VERSION : "local"
  export const CHANNEL = typeof SLOPCODE_CHANNEL === "string" ? SLOPCODE_CHANNEL : "local"
  export const USER_AGENT = `${product.id}/${CHANNEL}/${VERSION}/${Flag.SLOPCODE_CLIENT}`

  export async function latest(installMethod?: Method) {
    const detectedMethod = installMethod || (await method())

    if (detectedMethod === "brew") {
      const formula = await getBrewFormula()
      if (formula.includes("/")) {
        const infoJson = await $`brew info --json=v2 ${formula}`.quiet().text()
        const info = JSON.parse(infoJson)
        const version = info.formulae?.[0]?.versions?.stable
        if (!version) throw new Error(`Could not detect version for tap formula: ${formula}`)
        return version
      }
      return fetch(`https://formulae.brew.sh/api/formula/${pkg}.json`)
        .then((res) => {
          if (!res.ok) throw new Error(res.statusText)
          return res.json()
        })
        .then((data: any) => data.versions.stable)
    }

    if (detectedMethod === "macports") {
      const info = await $`port info ${pkg}`.throws(false).quiet().text()
      const version = portVersion(info)
      if (!version) {
        return VERSION
      }
      const latest = aptNormalizedVersion(version)
      if (!latest) {
        return VERSION
      }
      return latest
    }

    if (detectedMethod === "apt") {
      const candidate = aptCandidate(await aptPolicy())
      if (!candidate) {
        return VERSION
      }
      const latest = aptNormalizedVersion(candidate)
      if (!latest) {
        return VERSION
      }
      return latest
    }

    if (detectedMethod === "zypper") {
      const info = await $`zypper info ${pkg}`.throws(false).quiet().text()
      const version = rpmVersion(info)
      if (!version) {
        return VERSION
      }
      const latest = aptNormalizedVersion(version)
      if (!latest) {
        return VERSION
      }
      return latest
    }

    if (detectedMethod === "dnf") {
      const info = await $`dnf info ${pkg}`.throws(false).quiet().text()
      const version = rpmVersion(info)
      if (!version) {
        return VERSION
      }
      const latest = aptNormalizedVersion(version)
      if (!latest) {
        return VERSION
      }
      return latest
    }

    if (detectedMethod === "yum") {
      const info = await $`yum info ${pkg}`.throws(false).quiet().text()
      const version = rpmVersion(info)
      if (!version) {
        return VERSION
      }
      const latest = aptNormalizedVersion(version)
      if (!latest) {
        return VERSION
      }
      return latest
    }

    if (detectedMethod === "apk") {
      const info = await $`apk policy ${pkg}`.throws(false).quiet().text()
      const version = apkVersion(info)
      if (!version) {
        return VERSION
      }
      const latest = aptNormalizedVersion(version)
      if (!latest) {
        return VERSION
      }
      return latest
    }

    if (detectedMethod === "pkg") {
      const info = await $`pkg rquery %v ${pkg}`.throws(false).quiet().text()
      const version = pkgVersion(info)
      if (!version) {
        return VERSION
      }
      const latest = aptNormalizedVersion(version)
      if (!latest) {
        return VERSION
      }
      return latest
    }

    if (detectedMethod === "pacman") {
      const info = await $`pacman -Si ${pkg}`.throws(false).quiet().text()
      const version = infoVersion(info)
      if (!version) {
        return VERSION
      }
      const latest = aptNormalizedVersion(version)
      if (!latest) {
        return VERSION
      }
      return latest
    }

    if (detectedMethod === "paru") {
      const info = await $`paru -Si slopcode-bin`.throws(false).quiet().text()
      const version = infoVersion(info)
      if (!version) {
        return VERSION
      }
      const latest = aptNormalizedVersion(version)
      if (!latest) {
        return VERSION
      }
      return latest
    }

    if (detectedMethod === "snap") {
      const info = await $`snap info ${pkg}`.throws(false).quiet().text()
      const stable = info.match(/^\s*(?:latest\/)?stable:\s*([^\s]+)/m)?.[1]?.replace(/^v/, "")
      return stable || VERSION
    }

    if (detectedMethod === "nix") {
      const entry = await nixEntry()
      if (!entry) {
        return VERSION
      }
      const source = nixSource(entry)
      if (!source) {
        return VERSION
      }
      if (source.includes("nixpkgs")) {
        const latest = (await $`nix eval --raw nixpkgs#${nixRef}.version`.quiet().nothrow().text()).trim()
        if (latest) {
          return latest
        }
      }
      const latest = (await $`nix eval --raw ${nixVersionInstallable(source)}`.quiet().nothrow().text()).trim()
      if (latest) {
        return latest
      }
      return VERSION
    }

    if (detectedMethod === "yarn") {
      const registry = await yarnRegistry()
      const channel = CHANNEL
      return fetch(`${registry}/${pkg}/${channel}`)
        .then((res) => {
          if (!res.ok) throw new Error(res.statusText)
          return res.json()
        })
        .then((data: any) => data.version)
    }

    if (detectedMethod === "npm" || detectedMethod === "bun" || detectedMethod === "pnpm") {
      const registry = await npmRegistry()
      const channel = CHANNEL
      return fetch(`${registry}/${pkg}/${channel}`)
        .then((res) => {
          if (!res.ok) throw new Error(res.statusText)
          return res.json()
        })
        .then((data: any) => data.version)
    }

    if (detectedMethod === "choco") {
      return fetch(
        `https://community.chocolatey.org/api/v2/Packages?$filter=Id%20eq%20%27${pkg}%27%20and%20IsLatestVersion&$select=Version`,
        { headers: { Accept: "application/json;odata=verbose" } },
      )
        .then((res) => {
          if (!res.ok) throw new Error(res.statusText)
          return res.json()
        })
        .then((data: any) => data.d.results[0].Version)
    }

    if (detectedMethod === "scoop") {
      return fetch(`https://raw.githubusercontent.com/ScoopInstaller/Main/master/bucket/${pkg}.json`, {
        headers: { Accept: "application/json" },
      })
        .then((res) => {
          if (!res.ok) throw new Error(res.statusText)
          return res.json()
        })
        .then((data: any) => data.version)
    }

    return fetch(`https://api.github.com/repos/${repo}/releases/latest`)
      .then((res) => {
        if (!res.ok) throw new Error(res.statusText)
        return res.json()
      })
      .then((data: any) => data.tag_name.replace(/^v/, ""))
  }
}
