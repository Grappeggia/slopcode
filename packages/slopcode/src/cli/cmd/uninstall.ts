import type { Argv } from "yargs"
import { UI } from "../ui"
import * as prompts from "@clack/prompts"
import { Installation } from "../../installation"
import { Global } from "../../global"
import { $ } from "bun"
import fs from "fs/promises"
import path from "path"
import os from "os"
import { Filesystem } from "../../util/filesystem"

interface UninstallArgs {
  keepConfig: boolean
  keepData: boolean
  dryRun: boolean
  force: boolean
}

interface RemovalTargets {
  directories: Array<{ path: string; label: string; keep: boolean }>
  shellConfig: string | null
  binary: string | null
}

export const UninstallCommand = {
  command: "uninstall",
  describe: "uninstall slopcode and remove all related files",
  builder: (yargs: Argv) =>
    yargs
      .option("keep-config", {
        alias: "c",
        type: "boolean",
        describe: "keep configuration files",
        default: false,
      })
      .option("keep-data", {
        alias: "d",
        type: "boolean",
        describe: "keep session data and snapshots",
        default: false,
      })
      .option("dry-run", {
        type: "boolean",
        describe: "show what would be removed without removing",
        default: false,
      })
      .option("force", {
        alias: "f",
        type: "boolean",
        describe: "skip confirmation prompts",
        default: false,
      }),

  handler: async (args: UninstallArgs) => {
    UI.empty()
    UI.println(UI.logo("  "))
    UI.empty()
    prompts.intro("Uninstall SlopCode")

    const method = await Installation.method()
    prompts.log.info(`Installation method: ${method}`)

    const targets = await collectRemovalTargets(args, method)

    await showRemovalSummary(targets, method)

    if (!args.force && !args.dryRun) {
      const confirm = await prompts.confirm({
        message: "Are you sure you want to uninstall?",
        initialValue: false,
      })
      if (!confirm || prompts.isCancel(confirm)) {
        prompts.outro("Cancelled")
        return
      }
    }

    if (args.dryRun) {
      prompts.log.warn("Dry run - no changes made")
      prompts.outro("Done")
      return
    }

    await executeUninstall(method, targets)

    prompts.outro("Done")
  },
}

async function collectRemovalTargets(args: UninstallArgs, method: Installation.Method): Promise<RemovalTargets> {
  const directories: RemovalTargets["directories"] = [
    { path: Global.Path.data, label: "Data", keep: args.keepData },
    { path: Global.Path.cache, label: "Cache", keep: false },
    { path: Global.Path.config, label: "Config", keep: args.keepConfig },
    { path: Global.Path.state, label: "State", keep: false },
  ]

  const shellConfig = method === "curl" ? await getShellConfigFile() : null
  const binary = method === "curl" ? process.execPath : null

  return { directories, shellConfig, binary }
}

async function showRemovalSummary(targets: RemovalTargets, method: Installation.Method) {
  prompts.log.message("The following will be removed:")

  for (const dir of targets.directories) {
    const exists = await fs
      .access(dir.path)
      .then(() => true)
      .catch(() => false)
    if (!exists) continue

    const size = await getDirectorySize(dir.path)
    const sizeStr = formatSize(size)
    const status = dir.keep ? UI.Style.TEXT_DIM + "(keeping)" : ""
    const prefix = dir.keep ? "○" : "✓"

    prompts.log.info(`  ${prefix} ${dir.label}: ${shortenPath(dir.path)} ${UI.Style.TEXT_DIM}(${sizeStr})${status}`)
  }

  if (targets.binary) {
    prompts.log.info(`  ✓ Binary: ${shortenPath(targets.binary)}`)
  }

  if (targets.shellConfig) {
    prompts.log.info(`  ✓ Shell PATH in ${shortenPath(targets.shellConfig)}`)
  }

  if (method !== "curl" && method !== "unknown") {
    const nix = method === "nix" ? await Installation.nixSelector() : undefined
    const yarn = method === "yarn" ? await Installation.yarnContext() : undefined
    const cmds: Record<string, string> = {
      npm: "npm uninstall -g slopcode",
      pnpm: "pnpm uninstall -g slopcode",
      bun: "bun remove -g slopcode",
      yarn:
        yarn?.mode === "berry"
          ? yarn.root
            ? `cd "${yarn.root}" && yarn remove slopcode`
            : "yarn remove slopcode (run from your Yarn project root)"
          : "yarn global remove slopcode",
      nix: nix ? `nix profile remove ${nix}` : "nix profile remove github:teamslop/slopcode#slopcode",
      brew: "brew uninstall slopcode",
      macports: "sudo port -N uninstall slopcode",
      apt: "sudo apt-get remove -y slopcode",
      zypper: "sudo zypper --non-interactive rm slopcode",
      dnf: "sudo dnf remove -y slopcode",
      yum: "sudo yum remove -y slopcode",
      apk: "sudo apk del slopcode",
      pkg: "sudo pkg delete -y slopcode",
      pacman: "sudo pacman -R --noconfirm slopcode",
      paru: "paru -R --noconfirm slopcode-bin",
      snap: "sudo snap remove slopcode",
      choco: "choco uninstall slopcode",
      scoop: "scoop uninstall slopcode",
    }
    prompts.log.info(`  ✓ Package: ${cmds[method] || method}`)
  }
}

async function executeUninstall(method: Installation.Method, targets: RemovalTargets) {
  const spinner = prompts.spinner()
  const errors: string[] = []

  for (const dir of targets.directories) {
    if (dir.keep) {
      prompts.log.step(`Skipping ${dir.label} (--keep-${dir.label.toLowerCase()})`)
      continue
    }

    const exists = await fs
      .access(dir.path)
      .then(() => true)
      .catch(() => false)
    if (!exists) continue

    spinner.start(`Removing ${dir.label}...`)
    const err = await fs.rm(dir.path, { recursive: true, force: true }).catch((e) => e)
    if (err) {
      spinner.stop(`Failed to remove ${dir.label}`, 1)
      errors.push(`${dir.label}: ${err.message}`)
      continue
    }
    spinner.stop(`Removed ${dir.label}`)
  }

  if (targets.shellConfig) {
    spinner.start("Cleaning shell config...")
    const err = await cleanShellConfig(targets.shellConfig).catch((e) => e)
    if (err) {
      spinner.stop("Failed to clean shell config", 1)
      errors.push(`Shell config: ${err.message}`)
    } else {
      spinner.stop("Cleaned shell config")
    }
  }

  if (method !== "curl" && method !== "unknown") {
    const nix = method === "nix" ? await Installation.nixSelector() : undefined
    const yarn = method === "yarn" ? await Installation.yarnContext() : undefined
    const cmds: Record<string, string[] | undefined> = {
      npm: ["npm", "uninstall", "-g", "slopcode"],
      pnpm: ["pnpm", "uninstall", "-g", "slopcode"],
      bun: ["bun", "remove", "-g", "slopcode"],
      yarn:
        yarn?.mode === "berry"
          ? yarn.root
            ? ["yarn", "remove", "slopcode"]
            : undefined
          : ["yarn", "global", "remove", "slopcode"],
      nix: nix ? ["nix", "profile", "remove", nix] : ["nix", "profile", "remove", "github:teamslop/slopcode#slopcode"],
      brew: ["brew", "uninstall", "slopcode"],
      macports: ["port", "-N", "uninstall", "slopcode"],
      apt: ["apt-get", "remove", "-y", "slopcode"],
      zypper: ["zypper", "--non-interactive", "rm", "slopcode"],
      dnf: ["dnf", "remove", "-y", "slopcode"],
      yum: ["yum", "remove", "-y", "slopcode"],
      apk: ["apk", "del", "slopcode"],
      pkg: ["pkg", "delete", "-y", "slopcode"],
      pacman: ["pacman", "-R", "--noconfirm", "slopcode"],
      paru: ["paru", "-R", "--noconfirm", "slopcode-bin"],
      snap: ["snap", "remove", "slopcode"],
      choco: ["choco", "uninstall", "slopcode"],
      scoop: ["scoop", "uninstall", "slopcode"],
    }

    const cmd = cmds[method]
    if (method === "yarn" && yarn?.mode === "berry" && !yarn.root) {
      prompts.log.warn("Could not detect Yarn project root. Run `yarn remove slopcode` from your project root.")
    }
    if (cmd) {
      spinner.start(`Running ${cmd.join(" ")}...`)
      const apt = () => {
        const env = {
          DEBIAN_FRONTEND: "noninteractive",
          ...process.env,
        }
        if (typeof process.getuid === "function" && process.getuid() === 0) {
          return $`apt-get remove -y slopcode`.env(env)
        }
        return $`sudo -n apt-get remove -y slopcode`.env(env)
      }
      const zypper = () => {
        if (typeof process.getuid === "function" && process.getuid() === 0) {
          return $`zypper --non-interactive rm slopcode`
        }
        return $`sudo -n zypper --non-interactive rm slopcode`
      }
      const dnf = () => {
        if (typeof process.getuid === "function" && process.getuid() === 0) {
          return $`dnf remove -y slopcode`
        }
        return $`sudo -n dnf remove -y slopcode`
      }
      const yum = () => {
        if (typeof process.getuid === "function" && process.getuid() === 0) {
          return $`yum remove -y slopcode`
        }
        return $`sudo -n yum remove -y slopcode`
      }
      const apk = () => {
        if (typeof process.getuid === "function" && process.getuid() === 0) {
          return $`apk del slopcode`
        }
        return $`sudo -n apk del slopcode`
      }
      const pkg = () => {
        if (typeof process.getuid === "function" && process.getuid() === 0) {
          return $`pkg delete -y slopcode`
        }
        return $`sudo -n pkg delete -y slopcode`
      }
      const macports = () => {
        if (typeof process.getuid === "function" && process.getuid() === 0) {
          return $`port -N uninstall slopcode`
        }
        return $`sudo -n port -N uninstall slopcode`
      }
      const pacman = () => {
        if (typeof process.getuid === "function" && process.getuid() === 0) {
          return $`pacman -R --noconfirm slopcode`
        }
        return $`sudo -n pacman -R --noconfirm slopcode`
      }
      const snap = () => {
        if (typeof process.getuid === "function" && process.getuid() === 0) {
          return $`snap remove slopcode`
        }
        return $`sudo -n snap remove slopcode`
      }
      const result =
        method === "choco"
          ? await $`echo Y | choco uninstall slopcode -y -r`.quiet().nothrow()
          : method === "apt"
            ? await apt().quiet().nothrow()
            : method === "zypper"
              ? await zypper().quiet().nothrow()
              : method === "dnf"
                ? await dnf().quiet().nothrow()
                : method === "yum"
                  ? await yum().quiet().nothrow()
                  : method === "apk"
                    ? await apk().quiet().nothrow()
                    : method === "pkg"
                      ? await pkg().quiet().nothrow()
                      : method === "macports"
                        ? await macports().quiet().nothrow()
                        : method === "pacman"
                          ? await pacman().quiet().nothrow()
                          : method === "snap"
                            ? await snap().quiet().nothrow()
                            : method === "yarn" && yarn?.mode === "berry" && yarn.root
                              ? await $`yarn remove slopcode`.cwd(yarn.root).quiet().nothrow()
                              : await $`${cmd}`.quiet().nothrow()
      if (result.exitCode !== 0) {
        spinner.stop(`Package manager uninstall failed: exit code ${result.exitCode}`, 1)
        const manual =
          method === "apt"
            ? "sudo apt-get remove -y slopcode"
            : method === "zypper"
              ? "sudo zypper --non-interactive rm slopcode"
              : method === "dnf"
                ? "sudo dnf remove -y slopcode"
                : method === "yum"
                  ? "sudo yum remove -y slopcode"
                  : method === "apk"
                    ? "sudo apk del slopcode"
                    : method === "pkg"
                      ? "sudo pkg delete -y slopcode"
                      : method === "macports"
                        ? "sudo port -N uninstall slopcode"
                        : method === "pacman"
                          ? "sudo pacman -R --noconfirm slopcode"
                          : method === "snap"
                            ? "sudo snap remove slopcode"
                            : method === "yarn" && yarn?.mode === "berry" && yarn.root
                              ? `cd "${yarn.root}" && yarn remove slopcode`
                              : cmd.join(" ")
        const stderr = result.stderr.toString("utf8").toLowerCase()
        if (
          method === "choco" &&
          result.stdout.toString("utf8").includes("not running from an elevated command shell")
        ) {
          prompts.log.warn(`You may need to run '${cmd.join(" ")}' from an elevated command shell`)
        } else if (
          (method === "apt" || method === "zypper" || method === "dnf" || method === "yum") &&
          [
            "a password is required",
            "not in the sudoers",
            "permission denied",
            "no tty present",
            "command not found",
            "superuser privileges",
            "run under the root user",
            "need to be root",
            "run this command as root",
            "root privileges are required",
            "you must be root",
          ].some((item) => stderr.includes(item))
        ) {
          prompts.log.warn(`You may need to run '${manual}' from a privileged shell`)
        } else if (
          method === "apk" &&
          [
            "a password is required",
            "not in the sudoers",
            "permission denied",
            "no tty present",
            "command not found",
            "unable to lock database",
            "failed to open apk database",
            "operation not permitted",
          ].some((item) => stderr.includes(item))
        ) {
          prompts.log.warn(`You may need to run '${manual}' from a privileged shell`)
        } else if (
          method === "pkg" &&
          [
            "a password is required",
            "not in the sudoers",
            "permission denied",
            "no tty present",
            "command not found",
            "insufficient privileges",
            "not enough privileges",
            "must be root",
          ].some((item) => stderr.includes(item))
        ) {
          prompts.log.warn(`You may need to run '${manual}' from a privileged shell`)
        } else if (
          method === "macports" &&
          [
            "a password is required",
            "not in the sudoers",
            "permission denied",
            "no tty present",
            "command not found",
            "insufficient privileges",
            "must be run as root",
            "are not allowed to write",
          ].some((item) => stderr.includes(item))
        ) {
          prompts.log.warn(`You may need to run '${manual}' from a privileged shell`)
        } else if (
          method === "pacman" &&
          [
            "a password is required",
            "not in the sudoers",
            "permission denied",
            "no tty present",
            "command not found",
            "you cannot perform this operation unless you are root",
          ].some((item) => stderr.includes(item))
        ) {
          prompts.log.warn(`You may need to run '${manual}' from a privileged shell`)
        } else if (
          method === "snap" &&
          [
            "a password is required",
            "not in the sudoers",
            "permission denied",
            "requires root",
            "must be run as root",
            "no tty present",
            "command not found",
          ].some((item) => stderr.includes(item))
        ) {
          prompts.log.warn(`You may need to run '${manual}' from a privileged shell`)
        } else {
          prompts.log.warn(`You may need to run manually: ${manual}`)
        }
      } else {
        spinner.stop("Package removed")
      }
    }
  }

  if (method === "curl" && targets.binary) {
    UI.empty()
    prompts.log.message("To finish removing the binary, run:")
    prompts.log.info(`  rm "${targets.binary}"`)

    const binDir = path.dirname(targets.binary)
    if (binDir.includes(".slopcode")) {
      prompts.log.info(`  rmdir "${binDir}" 2>/dev/null`)
    }
  }

  if (errors.length > 0) {
    UI.empty()
    prompts.log.warn("Some operations failed:")
    for (const err of errors) {
      prompts.log.error(`  ${err}`)
    }
  }

  UI.empty()
  prompts.log.success("Thank you for using SlopCode!")
}

async function getShellConfigFile(): Promise<string | null> {
  const shell = path.basename(process.env.SHELL || "bash")
  const home = os.homedir()
  const xdgConfig = process.env.XDG_CONFIG_HOME || path.join(home, ".config")

  const configFiles: Record<string, string[]> = {
    fish: [path.join(xdgConfig, "fish", "config.fish")],
    zsh: [
      path.join(home, ".zshrc"),
      path.join(home, ".zshenv"),
      path.join(xdgConfig, "zsh", ".zshrc"),
      path.join(xdgConfig, "zsh", ".zshenv"),
    ],
    bash: [
      path.join(home, ".bashrc"),
      path.join(home, ".bash_profile"),
      path.join(home, ".profile"),
      path.join(xdgConfig, "bash", ".bashrc"),
      path.join(xdgConfig, "bash", ".bash_profile"),
    ],
    ash: [path.join(home, ".ashrc"), path.join(home, ".profile")],
    sh: [path.join(home, ".profile")],
  }

  const candidates = configFiles[shell] || configFiles.bash

  for (const file of candidates) {
    const exists = await fs
      .access(file)
      .then(() => true)
      .catch(() => false)
    if (!exists) continue

    const content = await Filesystem.readText(file).catch(() => "")
    if (content.includes("# slopcode") || content.includes(".slopcode/bin")) {
      return file
    }
  }

  return null
}

async function cleanShellConfig(file: string) {
  const content = await Filesystem.readText(file)
  const lines = content.split("\n")

  const filtered: string[] = []
  let skip = false

  for (const line of lines) {
    const trimmed = line.trim()

    if (trimmed === "# slopcode") {
      skip = true
      continue
    }

    if (skip) {
      skip = false
      if (trimmed.includes(".slopcode/bin") || trimmed.includes("fish_add_path")) {
        continue
      }
    }

    if (
      (trimmed.startsWith("export PATH=") && trimmed.includes(".slopcode/bin")) ||
      (trimmed.startsWith("fish_add_path") && trimmed.includes(".slopcode"))
    ) {
      continue
    }

    filtered.push(line)
  }

  while (filtered.length > 0 && filtered[filtered.length - 1].trim() === "") {
    filtered.pop()
  }

  const output = filtered.join("\n") + "\n"
  await Filesystem.write(file, output)
}

async function getDirectorySize(dir: string): Promise<number> {
  let total = 0

  const walk = async (current: string) => {
    const entries = await fs.readdir(current, { withFileTypes: true }).catch(() => [])

    for (const entry of entries) {
      const full = path.join(current, entry.name)
      if (entry.isDirectory()) {
        await walk(full)
        continue
      }
      if (entry.isFile()) {
        const stat = await fs.stat(full).catch(() => null)
        if (stat) total += stat.size
      }
    }
  }

  await walk(dir)
  return total
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

function shortenPath(p: string): string {
  const home = os.homedir()
  if (p.startsWith(home)) {
    return p.replace(home, "~")
  }
  return p
}
