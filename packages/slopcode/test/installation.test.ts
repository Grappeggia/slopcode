import { describe, expect, test } from "bun:test"
import fs from "fs/promises"
import path from "path"
import { pathToFileURL } from "url"

const root = path.resolve(import.meta.dir, "..")
const installationPath = pathToFileURL(path.join(root, "src", "installation", "index.ts")).href

const tools = [
  "sudo",
  "nix",
  "npm",
  "yarn",
  "pnpm",
  "bun",
  "brew",
  "port",
  "dpkg-query",
  "zypper",
  "dnf",
  "yum",
  "apk",
  "pkg",
  "pacman",
  "paru",
  "snap",
  "scoop",
  "choco",
]

async function installTools(dir: string) {
  const driver = path.join(dir, "tool.mjs")
  const code = [
    'import fs from "fs"',
    "",
    'const cmd = process.argv[2] || ""',
    "const args = process.argv.slice(3)",
    "const env = process.env",
    "",
    "if (env.SLOPCODE_TEST_LOG) {",
    '  fs.appendFileSync(env.SLOPCODE_TEST_LOG, `${cmd}|${process.cwd()}|${args.join(" ")}\\n`)',
    "}",
    "",
    "const out = (value) => {",
    '  process.stdout.write(`${value ?? ""}\\n`)',
    "}",
    "",
    "const run = (items) => {",
    "  if (items.length === 0) process.exit(1)",
    '  const bin = process.platform === "win32" && !/[\\\\/]/.test(items[0]) && !items[0].toLowerCase().endsWith(".cmd") ? `${items[0]}.cmd` : items[0]',
    '  const proc = Bun.spawnSync([bin, ...items.slice(1)], { stdout: "pipe", stderr: "pipe", env, cwd: process.cwd() })',
    "  if (proc.stdout) process.stdout.write(proc.stdout)",
    "  if (proc.stderr) process.stderr.write(proc.stderr)",
    "  process.exit(proc.exitCode ?? 0)",
    "}",
    "",
    'if (cmd === "sudo") {',
    '  run(args[0] === "-n" ? args.slice(1) : args)',
    "}",
    "",
    "switch (cmd) {",
    '  case "nix":',
    '    if (args[0] === "profile" && args[1] === "list" && args[2] === "--json") out(env.SLOPCODE_TEST_NIX_JSON ?? "{}")',
    "    break",
    '  case "npm":',
    '    if (args[0] === "config" && args[1] === "get" && args[2] === "registry") out(env.SLOPCODE_TEST_NPM_REGISTRY ?? "https://registry.npmjs.org")',
    '    if (args[0] === "list") out(env.SLOPCODE_TEST_NPM_LIST)',
    "    break",
    '  case "yarn":',
    '    if (args[0] === "--version") out(env.SLOPCODE_TEST_YARN_VERSION ?? "1.22.22")',
    '    if (args[0] === "config" && args[1] === "get" && args[2] === "projectCwd") out(env.SLOPCODE_TEST_YARN_PROJECT)',
    '    if (args[0] === "config" && args[1] === "get" && args[2] === "npmRegistryServer") out(env.SLOPCODE_TEST_YARN_REGISTRY ?? "https://registry.npmjs.org")',
    '    if (args[0] === "global" && args[1] === "list") out(env.SLOPCODE_TEST_YARN_GLOBAL_LIST)',
    "    break",
    '  case "pnpm":',
    '    if (args[0] === "list") out(env.SLOPCODE_TEST_PNPM_LIST)',
    "    break",
    '  case "bun":',
    '    if (args[0] === "pm" && args[1] === "ls") out(env.SLOPCODE_TEST_BUN_LIST)',
    "    break",
    '  case "brew":',
    '    if (args[0] === "list" && args[1] === "--formula") out(env.SLOPCODE_TEST_BREW_LIST)',
    "    break",
    '  case "port":',
    '    if (args[0] === "installed") out(env.SLOPCODE_TEST_PORT_INSTALLED)',
    '    if (args[0] === "info") out(env.SLOPCODE_TEST_PORT_INFO)',
    "    break",
    '  case "dpkg-query":',
    "    out(env.SLOPCODE_TEST_DPKG_QUERY)",
    "    break",
    '  case "zypper":',
    '    if (args[0] === "search") out(env.SLOPCODE_TEST_ZYPPER_SEARCH)',
    '    if (args[0] === "info") out(env.SLOPCODE_TEST_ZYPPER_INFO)',
    "    break",
    '  case "dnf":',
    '    if (args[0] === "list" && args[1] === "--installed") out(env.SLOPCODE_TEST_DNF_LIST)',
    '    if (args[0] === "info") out(env.SLOPCODE_TEST_DNF_INFO)',
    "    break",
    '  case "yum":',
    '    if (args[0] === "list" && args[1] === "installed") out(env.SLOPCODE_TEST_YUM_LIST)',
    '    if (args[0] === "info") out(env.SLOPCODE_TEST_YUM_INFO)',
    "    break",
    '  case "apk":',
    '    if (args[0] === "info" && args[1] === "-e") out(env.SLOPCODE_TEST_APK_INFO_E)',
    '    if (args[0] === "policy") out(env.SLOPCODE_TEST_APK_POLICY)',
    "    break",
    '  case "pkg":',
    '    if (args[0] === "info") out(env.SLOPCODE_TEST_PKG_INFO)',
    '    if (args[0] === "rquery") out(env.SLOPCODE_TEST_PKG_RQUERY)',
    "    break",
    '  case "pacman":',
    '    if (args[0] === "-Q") out(env.SLOPCODE_TEST_PACMAN_Q)',
    '    if (args[0] === "-Si") out(env.SLOPCODE_TEST_PACMAN_INFO)',
    "    break",
    '  case "paru":',
    '    if (args[0] === "-Q") out(env.SLOPCODE_TEST_PARU_Q)',
    '    if (args[0] === "-Si") out(env.SLOPCODE_TEST_PARU_INFO)',
    "    break",
    '  case "snap":',
    '    if (args[0] === "list") out(env.SLOPCODE_TEST_SNAP_LIST)',
    "    break",
    '  case "scoop":',
    '    if (args[0] === "list") out(env.SLOPCODE_TEST_SCOOP_LIST)',
    "    break",
    '  case "choco":',
    '    if (args[0] === "list") out(env.SLOPCODE_TEST_CHOCO_LIST)',
    "    break",
    "}",
    "",
    "process.exit(0)",
    "",
  ].join("\n")
  await Bun.write(driver, code)

  const sh = (name: string) =>
    [
      "#!/bin/sh",
      `exec ${JSON.stringify(process.execPath)} ${JSON.stringify(driver)} ${JSON.stringify(name)} "$@"`,
      "",
    ].join("\n")
  const cmd = (name: string) =>
    ["@echo off", `"${process.execPath}" "${driver}" ${name} %*`, "exit /b %ERRORLEVEL%", ""].join("\r\n")

  await Promise.all(
    tools
      .flatMap((name) => [
        async () => {
          const file = path.join(dir, name)
          await Bun.write(file, sh(name))
          await fs.chmod(file, 0o755)
        },
        ...(process.platform === "win32" ? [async () => Bun.write(path.join(dir, `${name}.cmd`), cmd(name))] : []),
      ])
      .map((write) => write()),
  )
}

async function runCase(op: "method" | "latest" | "upgrade", env: Record<string, string | undefined>) {
  const dir = await fs.mkdtemp(path.join(root, ".slopcode-test-tools-"))
  const log = path.join(dir, "commands.log")
  await installTools(dir)
  const berryProject = env.SLOPCODE_TEST_YARN_PROJECT
  if (berryProject) {
    await fs.mkdir(berryProject, { recursive: true })
  }

  const code = [
    "const { Installation } = await import(process.env.INSTALLATION_PATH)",
    "const op = process.env.OP",
    "const method = process.env.METHOD",
    "const target = process.env.TARGET || ''",
    "try {",
    "  if (op === 'method') {",
    "    const value = await Installation.method()",
    "    console.log('RESULT:' + JSON.stringify({ value }))",
    "  } else if (op === 'latest') {",
    "    const value = await Installation.latest(method)",
    "    console.log('RESULT:' + JSON.stringify({ value }))",
    "  } else if (op === 'upgrade') {",
    "    await Installation.upgrade(method, target)",
    "    console.log('RESULT:' + JSON.stringify({ ok: true }))",
    "  } else {",
    "    throw new Error('invalid OP')",
    "  }",
    "} catch (error) {",
    "  const data = error && typeof error === 'object' && 'data' in error ? error.data : undefined",
    "  console.log('RESULT:' + JSON.stringify({ ok: false, error: String(error), data }))",
    "  process.exit(1)",
    "}",
  ].join("\n")

  const proc = Bun.spawn([process.execPath, "--eval", code], {
    cwd: root,
    stdout: "pipe",
    stderr: "pipe",
    env: {
      ...process.env,
      PATH: `${dir}${path.delimiter}${process.env.PATH || ""}`,
      SLOPCODE_TEST_LOG: log,
      INSTALLATION_PATH: installationPath,
      OP: op,
      ...env,
    },
  })

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ])

  const line = stdout.split("\n").find((item) => item.startsWith("RESULT:"))
  const result = line ? JSON.parse(line.slice("RESULT:".length)) : undefined
  const logs = (await Bun.file(log).exists())
    ? (await Bun.file(log).text()).split("\n").filter((item) => item.trim().length > 0)
    : []

  await fs.rm(dir, { recursive: true, force: true })

  return {
    exitCode,
    stderr,
    stdout,
    result,
    logs,
  }
}

describe("installation package manager behaviors", () => {
  test("detects yarn from npm user agent", async () => {
    const run = await runCase("method", {
      npm_config_user_agent: "yarn/4.9.0 npm/? node/?",
    })
    expect(run.exitCode).toBe(0)
    expect(run.result?.value).toBe("yarn")
  })

  test("detects zypper installs", async () => {
    const run = await runCase("method", {
      npm_config_user_agent: "",
      SLOPCODE_TEST_ZYPPER_SEARCH: "i | slopcode | package | 0.1.15-1 | x86_64",
    })
    expect(run.exitCode).toBe(0)
    expect(run.result?.value).toBe("zypper")
  })

  test("detects macports installs", async () => {
    const run = await runCase("method", {
      npm_config_user_agent: "",
      SLOPCODE_TEST_PORT_INSTALLED: "The following ports are currently installed:\n  slopcode @0.1.15_0 (active)",
    })
    expect(run.exitCode).toBe(0)
    expect(run.result?.value).toBe("macports")
  })

  test("detects dnf installs", async () => {
    const run = await runCase("method", {
      npm_config_user_agent: "",
      SLOPCODE_TEST_DNF_LIST: "Installed Packages\nslopcode.x86_64 0.1.15-1 @updates",
    })
    expect(run.exitCode).toBe(0)
    expect(run.result?.value).toBe("dnf")
  })

  test("detects yum installs", async () => {
    const run = await runCase("method", {
      npm_config_user_agent: "",
      SLOPCODE_TEST_YUM_LIST: "Installed Packages\nslopcode.x86_64 0.1.15-1 @base",
    })
    expect(run.exitCode).toBe(0)
    expect(run.result?.value).toBe("yum")
  })

  test("detects apk installs", async () => {
    const run = await runCase("method", {
      npm_config_user_agent: "",
      SLOPCODE_TEST_APK_INFO_E: "slopcode",
    })
    expect(run.exitCode).toBe(0)
    expect(run.result?.value).toBe("apk")
  })

  test("detects pkg installs", async () => {
    const run = await runCase("method", {
      npm_config_user_agent: "",
      SLOPCODE_TEST_PKG_INFO: "slopcode-0.1.15",
    })
    expect(run.exitCode).toBe(0)
    expect(run.result?.value).toBe("pkg")
  })
  test("parses latest zypper version", async () => {
    const run = await runCase("latest", {
      METHOD: "zypper",
      SLOPCODE_TEST_ZYPPER_INFO:
        "Repository      : slopcode\nName            : slopcode\nVersion         : 0.1.26\nRelease         : 2.1",
    })
    expect(run.exitCode).toBe(0)
    expect(run.result?.value).toBe("0.1.26")
  })

  test("parses latest macports version", async () => {
    const run = await runCase("latest", {
      METHOD: "macports",
      SLOPCODE_TEST_PORT_INFO: "slopcode @0.1.27_1 (devel)\nVariants:             universal",
    })
    expect(run.exitCode).toBe(0)
    expect(run.result?.value).toBe("0.1.27")
  })

  test("detects pacman installs", async () => {
    const run = await runCase("method", {
      npm_config_user_agent: "",
      SLOPCODE_TEST_PACMAN_Q: "slopcode 0.1.15-1",
    })
    expect(run.exitCode).toBe(0)
    expect(run.result?.value).toBe("pacman")
  })

  test("detects paru installs", async () => {
    const run = await runCase("method", {
      npm_config_user_agent: "",
      SLOPCODE_TEST_PARU_Q: "slopcode-bin 0.1.15-1",
    })
    expect(run.exitCode).toBe(0)
    expect(run.result?.value).toBe("paru")
  })

  test("parses latest dnf version", async () => {
    const run = await runCase("latest", {
      METHOD: "dnf",
      SLOPCODE_TEST_DNF_INFO: "Name         : slopcode\nVersion      : 0.1.22\nRelease      : 3.fc40",
    })
    expect(run.exitCode).toBe(0)
    expect(run.result?.value).toBe("0.1.22")
  })

  test("parses latest yum version", async () => {
    const run = await runCase("latest", {
      METHOD: "yum",
      SLOPCODE_TEST_YUM_INFO: "Name        : slopcode\nVersion     : 0.1.23\nRelease     : 1.el9",
    })
    expect(run.exitCode).toBe(0)
    expect(run.result?.value).toBe("0.1.23")
  })

  test("parses latest apk version", async () => {
    const run = await runCase("latest", {
      METHOD: "apk",
      SLOPCODE_TEST_APK_POLICY:
        "slopcode policy:\n  0.1.24-r2:\n    https://dl-cdn.alpinelinux.org/alpine/edge/testing",
    })
    expect(run.exitCode).toBe(0)
    expect(run.result?.value).toBe("0.1.24")
  })

  test("parses latest pkg version", async () => {
    const run = await runCase("latest", {
      METHOD: "pkg",
      SLOPCODE_TEST_PKG_RQUERY: "0.1.25_1",
    })
    expect(run.exitCode).toBe(0)
    expect(run.result?.value).toBe("0.1.25")
  })

  test("parses latest pacman version", async () => {
    const run = await runCase("latest", {
      METHOD: "pacman",
      SLOPCODE_TEST_PACMAN_INFO: "Repository      : extra\nName            : slopcode\nVersion         : 1:0.1.20-1",
    })
    expect(run.exitCode).toBe(0)
    expect(run.result?.value).toBe("0.1.20")
  })

  test("parses latest paru version", async () => {
    const run = await runCase("latest", {
      METHOD: "paru",
      SLOPCODE_TEST_PARU_INFO: "Repository      : aur\nName            : slopcode-bin\nVersion         : 0.1.21-2",
    })
    expect(run.exitCode).toBe(0)
    expect(run.result?.value).toBe("0.1.21")
  })

  test("runs yarn classic upgrade with global add", async () => {
    const run = await runCase("upgrade", {
      METHOD: "yarn",
      TARGET: "0.9.0",
      SLOPCODE_TEST_YARN_VERSION: "1.22.22",
    })
    expect(run.exitCode).toBe(0)
    expect(run.logs.some((item) => item.endsWith("|global add slopcode@0.9.0"))).toBe(true)
  })

  test("runs npm Android upgrade with optional runtime deps", async () => {
    const run = await runCase("upgrade", {
      METHOD: "npm",
      TARGET: "0.9.0",
      SLOPCODE_TEST_PLATFORM: "android",
      TERMUX_VERSION: "1",
    })
    expect(run.exitCode).toBe(0)
    expect(run.logs.some((item) => item.endsWith("|install -g slopcode@0.9.0 --include=optional"))).toBe(true)
  })

  test("runs yarn berry upgrade in project root", async () => {
    const project = path.join(root, ".slopcode-test-berry")
    const run = await runCase("upgrade", {
      METHOD: "yarn",
      TARGET: "0.9.1",
      SLOPCODE_TEST_YARN_VERSION: "4.9.0",
      SLOPCODE_TEST_YARN_PROJECT: project,
    })
    expect(run.exitCode).toBe(0)
    expect(run.logs.some((item) => item === `yarn|${project}|up slopcode@0.9.1`)).toBe(true)
    await fs.rm(project, { recursive: true, force: true })
  })

  test("runs zypper upgrade command", async () => {
    const run = await runCase("upgrade", {
      METHOD: "zypper",
      TARGET: "0.9.2",
    })
    expect(run.exitCode).toBe(0)
    expect(
      run.logs.some(
        (item) =>
          (item.startsWith("zypper|") && item.endsWith("|--non-interactive update slopcode")) ||
          (item.startsWith("sudo|") && item.includes("zypper --non-interactive update slopcode")),
      ),
    ).toBe(true)
  })

  test("runs macports upgrade command", async () => {
    const run = await runCase("upgrade", {
      METHOD: "macports",
      TARGET: "0.9.2",
    })
    expect(run.exitCode).toBe(0)
    expect(
      run.logs.some(
        (item) =>
          (item.startsWith("port|") && item.endsWith("|-N upgrade slopcode")) ||
          (item.startsWith("sudo|") && item.includes("port -N upgrade slopcode")),
      ),
    ).toBe(true)
  })

  test("runs dnf upgrade command", async () => {
    const run = await runCase("upgrade", {
      METHOD: "dnf",
      TARGET: "0.9.2",
    })
    expect(run.exitCode).toBe(0)
    expect(
      run.logs.some(
        (item) =>
          (item.startsWith("dnf|") && item.endsWith("|upgrade -y slopcode")) ||
          (item.startsWith("sudo|") && item.includes("dnf upgrade -y slopcode")),
      ),
    ).toBe(true)
  })

  test("runs yum upgrade command", async () => {
    const run = await runCase("upgrade", {
      METHOD: "yum",
      TARGET: "0.9.2",
    })
    expect(run.exitCode).toBe(0)
    expect(
      run.logs.some(
        (item) =>
          (item.startsWith("yum|") && item.endsWith("|update -y slopcode")) ||
          (item.startsWith("sudo|") && item.includes("yum update -y slopcode")),
      ),
    ).toBe(true)
  })

  test("runs apk upgrade command", async () => {
    const run = await runCase("upgrade", {
      METHOD: "apk",
      TARGET: "0.9.2",
    })
    expect(run.exitCode).toBe(0)
    expect(
      run.logs.some(
        (item) =>
          (item.startsWith("apk|") && item.endsWith("|upgrade --no-interactive slopcode")) ||
          (item.startsWith("sudo|") && item.includes("apk upgrade --no-interactive slopcode")),
      ),
    ).toBe(true)
  })

  test("runs pkg upgrade command", async () => {
    const run = await runCase("upgrade", {
      METHOD: "pkg",
      TARGET: "0.9.2",
    })
    expect(run.exitCode).toBe(0)
    expect(
      run.logs.some(
        (item) =>
          (item.startsWith("pkg|") && item.endsWith("|upgrade -y slopcode")) ||
          (item.startsWith("sudo|") && item.includes("pkg upgrade -y slopcode")),
      ),
    ).toBe(true)
  })

  test("runs pacman upgrade command", async () => {
    const run = await runCase("upgrade", {
      METHOD: "pacman",
      TARGET: "0.9.2",
    })
    expect(run.exitCode).toBe(0)
    expect(
      run.logs.some(
        (item) =>
          (item.startsWith("pacman|") && item.endsWith("|-S --noconfirm --needed slopcode")) ||
          (item.startsWith("sudo|") && item.includes("pacman -S --noconfirm --needed slopcode")),
      ),
    ).toBe(true)
  })

  test("runs paru upgrade for slopcode-bin", async () => {
    const run = await runCase("upgrade", {
      METHOD: "paru",
      TARGET: "0.9.3",
    })
    expect(run.exitCode).toBe(0)
    expect(run.logs.some((item) => item.endsWith("|-S --noconfirm --needed slopcode-bin"))).toBe(true)
  })
})
