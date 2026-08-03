import { mkdirSync } from "node:fs"
import { join } from "node:path"

const serial = Bun.env.ANDROID_SERIAL
const packageID = Bun.env.ANDROID_PACKAGE ?? "dev.slopcode.android"
const root = Bun.env.ANDROID_AUDIT_REPORT_DIR ?? `/tmp/slopcode-android-audit-${Date.now()}`
const required = [
  "SSH_HOST",
  "SSH_USER",
  "SSH_KEY_FILE",
  "SSH_PASSWORD_FILE",
  "SSH_E2E_SETUP_AGENT",
  "SSH_E2E_ALLOW_INSTALL",
  "SSH_E2E_CONFIRM",
  "SSH_E2E_NETWORK_LOSS",
]

if (!/^[a-zA-Z0-9._]+$/.test(packageID)) throw new Error("ANDROID_PACKAGE must be an Android package identifier.")

mkdirSync(root, { recursive: true })

function run(command: string[], quiet = false) {
  const result = Bun.spawnSync(command, { stdout: "pipe", stderr: "pipe" })
  const bytes = result.stdout
  const stderr = result.stderr
  const output = new TextDecoder().decode(bytes)
  const error = new TextDecoder().decode(stderr)
  if (result.exitCode !== 0 && !quiet) throw new Error(error.trim() || output.trim() || `${command.join(" ")} failed`)
  return { code: result.exitCode, output, error, bytes }
}

function adb(...args: string[]) {
  return run(["adb", ...(serial ? ["-s", serial] : []), ...args])
}

function safe(value: string) {
  return value
    .replaceAll(/(authorization|password|passphrase|token|secret)\s*[:=]\s*[^\s]+/gi, "$1=<redacted>")
    .slice(-128 * 1024)
}

async function screenshot(name: string) {
  const result = run(["adb", ...(serial ? ["-s", serial] : []), "exec-out", "screencap", "-p"])
  await Bun.write(join(root, `${name}.png`), result.bytes)
}

function setting(namespace: string, key: string) {
  return adb("shell", "settings", "get", namespace, key).output.trim()
}

function restore(namespace: string, key: string, value: string) {
  if (value && value !== "null") adb("shell", "settings", "put", namespace, key, value)
  if (!value || value === "null") adb("shell", "settings", "delete", namespace, key)
}

async function capture(name: string, rotation: "portrait" | "landscape", dark: boolean) {
  adb("shell", "settings", "put", "system", "accelerometer_rotation", "0")
  adb("shell", "settings", "put", "system", "user_rotation", rotation === "portrait" ? "0" : "1")
  adb("shell", "cmd", "uimode", "night", dark ? "yes" : "no")
  adb("shell", "am", "start", "-n", `${packageID}/.MainActivity`)
  await Bun.sleep(1_000)
  await screenshot(name)
}

const report: Record<string, unknown> = {
  command: "bun scripts/validate-android-audit.ts",
  serial: serial ?? "default",
  package: packageID,
  screenshots: [],
  unit: "not run",
  instrumentation: "not run",
  liveSsh: "unavailable",
}

const missing = required.filter((key) => !Bun.env[key])
let rotation: string | undefined
let userRotation: string | undefined
let night: string | undefined

try {
  if (adb("get-state").output.trim() !== "device") throw new Error("No ready Android emulator/device was found.")
  if (Bun.env.ANDROID_AUDIT_BUILD !== "0") {
    run(["bun", "run", "build:web"])
    run(["./gradlew", ":app:assembleDebug"])
  }
  const apk = "app/build/outputs/apk/debug/app-debug.apk"
  if (!(await Bun.file(apk).exists())) throw new Error(`${apk} is missing; run with ANDROID_AUDIT_BUILD=1 or build the debug APK first.`)
  adb("install", "-r", apk)
  rotation = setting("system", "accelerometer_rotation")
  userRotation = setting("system", "user_rotation")
  night = setting("secure", "ui_night_mode")

  const matrix = [
    ["portrait-light", "portrait", false],
    ["portrait-dark", "portrait", true],
    ["landscape-light", "landscape", false],
    ["landscape-dark", "landscape", true],
  ] as const
  for (const [name, orientation, dark] of matrix) {
    await capture(name, orientation, dark)
    ;(report.screenshots as string[]).push(`${name}.png`)
  }

  const unit = run([
    "./gradlew",
    ":app:testDebugUnitTest",
    "--tests",
    "dev.slopcode.android.NotificationPermissionTest",
    "--tests",
    "dev.slopcode.android.RemoteJobNotificationTest",
  ])
  report.unit = unit.code === 0 ? "passed" : "failed"
  const instrumentation = run(["./gradlew", ":app:connectedDebugAndroidTest", "-Pandroid.testInstrumentationRunnerArguments.class=dev.slopcode.android.SshTransportInstrumentedTest#deepLinkIntentResolvesToMainActivity"])
  report.instrumentation = instrumentation.code === 0 ? "passed" : "failed"

  if (missing.length > 0) {
    report.liveSsh = `unavailable: ${missing.join(", ")}`
  } else if (Bun.env.ANDROID_AUDIT_RUN_LIVE_SSH === "1") {
    const live = run(["bash", "scripts/run-ssh-e2e-all-agents.sh"], true)
    report.liveSsh = live.code === 0 ? "passed" : `failed (${live.code})`
    await Bun.write(join(root, "live-ssh.log"), safe(`${live.output}\n${live.error}`))
    if (live.code !== 0) throw new Error("Configured live SSH harness failed; see the bounded report log.")
  } else {
    report.liveSsh = "configured but not run (set ANDROID_AUDIT_RUN_LIVE_SSH=1)"
  }
} catch (cause) {
  report.error = cause instanceof Error ? cause.message : String(cause)
  throw cause
} finally {
  if (rotation !== undefined) restore("system", "accelerometer_rotation", rotation)
  if (userRotation !== undefined) restore("system", "user_rotation", userRotation)
  if (night !== undefined) adb("shell", "cmd", "uimode", "night", night == "2" ? "yes" : "no")
  const logs = run(["adb", ...(serial ? ["-s", serial] : []), "logcat", "-d", "-t", "400"], true)
  await Bun.write(join(root, "logcat.txt"), safe(`${logs.output}\n${logs.error}`))
  await Bun.write(join(root, "report.json"), JSON.stringify(report, null, 2))
}

console.log(JSON.stringify({ report: join(root, "report.json"), ...report }))
