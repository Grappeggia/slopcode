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
const checks = [
  "webBuild",
  "debugBuild",
  "notificationPermission",
  "notificationActions",
  "terminalEvents",
  "exactSessionLink",
  "duplicateLinkDelivery",
  "cursorReplayWake",
  "fcmPayloadWake",
  "activityResolution",
  "screenshots",
  "fcmTransport",
  "liveSsh",
] as const

if (!/^[a-zA-Z0-9._]+$/.test(packageID)) throw new Error("ANDROID_PACKAGE must be an Android package identifier.")

mkdirSync(root, { recursive: true })

type Check = { status: "passed" | "failed" | "unavailable"; detail?: string }

function run(command: string[]) {
  const result = Bun.spawnSync(command, { stdout: "pipe", stderr: "pipe" })
  const bytes = result.stdout
  const output = new TextDecoder().decode(bytes)
  const error = new TextDecoder().decode(result.stderr)
  return { code: result.exitCode, output, error, bytes }
}

function detail(result: { output: string; error: string }, fallback: string) {
  return safe(result.error.trim() || result.output.trim() || fallback).slice(-2_000)
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
  if (result.code !== 0) throw new Error(detail(result, "screencap failed"))
  await Bun.write(join(root, `${name}.png`), result.bytes)
}

function setting(namespace: string, key: string) {
  const result = adb("shell", "settings", "get", namespace, key)
  if (result.code !== 0) throw new Error(detail(result, `Could not read ${namespace}/${key}`))
  return result.output.trim()
}

function restore(namespace: string, key: string, value: string) {
  const result = value && value !== "null"
    ? adb("shell", "settings", "put", namespace, key, value)
    : adb("shell", "settings", "delete", namespace, key)
  if (result.code !== 0) throw new Error(detail(result, `Could not restore ${namespace}/${key}`))
}

async function capture(name: string, rotation: "portrait" | "landscape", dark: boolean) {
  for (const command of [
    ["shell", "settings", "put", "system", "accelerometer_rotation", "0"],
    ["shell", "settings", "put", "system", "user_rotation", rotation === "portrait" ? "0" : "1"],
    ["shell", "cmd", "uimode", "night", dark ? "yes" : "no"],
    ["shell", "am", "start", "-n", `${packageID}/.MainActivity`],
  ]) {
    const result = adb(...command)
    if (result.code !== 0) throw new Error(detail(result, `${command.join(" ")} failed`))
  }
  await Bun.sleep(1_000)
  await screenshot(name)
}

const report: {
  command: string
  serial: string
  package: string
  screenshots: string[]
  checks: Record<string, Check>
} = {
  command: "bun scripts/validate-android-audit.ts",
  serial: serial ?? "default",
  package: packageID,
  screenshots: [],
  checks: Object.fromEntries(checks.map((name) => [name, { status: "failed", detail: "Skipped after an earlier validation failure." }])),
}

const missing = required.filter((key) => !Bun.env[key])
let rotation: string | undefined
let userRotation: string | undefined
let night: string | undefined

function commandCheck(name: string, command: string[]) {
  const result = run(command)
  report.checks[name] = result.code === 0
    ? { status: "passed" }
    : { status: "failed", detail: detail(result, `${command.join(" ")} failed`) }
  return result.code === 0
}

function unavailable(name: string, value: string) {
  report.checks[name] = { status: "unavailable", detail: value }
}

try {
  const build = Bun.env.ANDROID_AUDIT_BUILD !== "0"
  const web = build && commandCheck("webBuild", ["bun", "run", "build:web"])
  const debug = build && web && commandCheck("debugBuild", ["./gradlew", ":app:assembleDebug"])
  if (!build) {
    unavailable("webBuild", "Skipped by ANDROID_AUDIT_BUILD=0; using the existing debug APK.")
    unavailable("debugBuild", "Skipped by ANDROID_AUDIT_BUILD=0; using the existing debug APK.")
  }
  if (build && !web) report.checks.debugBuild = { status: "failed", detail: "Web build failed, so the debug APK was not built." }

  const unit = [
    ["notificationPermission", "dev.slopcode.android.NotificationPermissionTest"],
    ["notificationActions", "dev.slopcode.android.RemoteJobNotificationTest"],
    ["terminalEvents", "dev.slopcode.android.RemoteJobModelsTest.revokedAndExpiredEventsAreTerminalAndUnknownEventsDoNotReenableApproval"],
    ["exactSessionLink", "dev.slopcode.android.DeepLinkDeliveryTest.notificationHrefRetainsPendingApprovalSessionWhenIntentDataIsAbsent"],
    ["duplicateLinkDelivery", "dev.slopcode.android.DeepLinkDeliveryTest.duplicateNotificationTapDeliversOneExactSessionLink"],
    ["cursorReplayWake", "dev.slopcode.android.RemoteJobModelsTest.offlineReconnectResumesFromCursorAndIgnoresDuplicateEvent"],
    ["fcmPayloadWake", "dev.slopcode.android.RemoteJobPushTest"],
  ] as const
  unit.forEach(([name, test]) => commandCheck(name, ["./gradlew", ":app:testDebugUnitTest", "--tests", test]))

  const device = adb("get-state")
  if (device.code !== 0 || device.output.trim() !== "device") {
    const message = detail(device, "No ready Android emulator/device was found.")
    report.checks.activityResolution = { status: "failed", detail: message }
    report.checks.screenshots = { status: "failed", detail: message }
  } else if ((build && !debug) || !(await Bun.file("app/build/outputs/apk/debug/app-debug.apk").exists())) {
    const message = "Debug APK is unavailable after the build check."
    report.checks.activityResolution = { status: "failed", detail: message }
    report.checks.screenshots = { status: "failed", detail: message }
  } else {
    const install = adb("install", "-r", "app/build/outputs/apk/debug/app-debug.apk")
    if (install.code !== 0) {
      const message = detail(install, "APK installation failed.")
      report.checks.activityResolution = { status: "failed", detail: message }
      report.checks.screenshots = { status: "failed", detail: message }
    } else {
      rotation = setting("system", "accelerometer_rotation")
      userRotation = setting("system", "user_rotation")
      night = setting("secure", "ui_night_mode")
      const instrumentation = commandCheck(
        "activityResolution",
        ["./gradlew", ":app:connectedDebugAndroidTest", "-Pandroid.testInstrumentationRunnerArguments.class=dev.slopcode.android.SshTransportInstrumentedTest#deepLinkIntentResolvesToMainActivity"],
      )
      const matrix = [
        ["portrait-light", "portrait", false],
        ["portrait-dark", "portrait", true],
        ["landscape-light", "landscape", false],
        ["landscape-dark", "landscape", true],
      ] as const
      try {
        const reinstall = adb("install", "-r", "app/build/outputs/apk/debug/app-debug.apk")
        if (reinstall.code !== 0) throw new Error(detail(reinstall, "APK reinstallation before screenshots failed."))
        for (const [name, orientation, dark] of matrix) {
          await capture(name, orientation, dark)
          report.screenshots.push(`${name}.png`)
        }
        report.checks.screenshots = { status: "passed" }
      } catch (cause) {
        report.checks.screenshots = { status: "failed", detail: cause instanceof Error ? cause.message : String(cause) }
      }
      if (!instrumentation) report.checks.activityResolution = { status: "failed", detail: report.checks.activityResolution.detail }
    }
  }

  unavailable(
    "fcmTransport",
    "Firebase delivery is not exercised: this checkout has no registered Firebase project/device token or protected sender credentials. fcmPayloadWake verifies native payload parsing and wake metadata without advancing the persisted SSE cursor.",
  )
  if (missing.length > 0) {
    unavailable("liveSsh", `Missing protected SSH configuration: ${missing.join(", ")}`)
  } else if (Bun.env.ANDROID_AUDIT_RUN_LIVE_SSH === "1") {
    const result = run(["bash", "scripts/run-ssh-e2e-all-agents.sh"])
    report.checks.liveSsh = result.code === 0
      ? { status: "passed" }
      : { status: "failed", detail: detail(result, "Configured live SSH harness failed.") }
    await Bun.write(join(root, "live-ssh.log"), safe(`${result.output}\n${result.error}`))
  } else {
    unavailable("liveSsh", "Protected SSH configuration is present but live execution is disabled; set ANDROID_AUDIT_RUN_LIVE_SSH=1.")
  }
} catch (cause) {
  const message = cause instanceof Error ? cause.message : String(cause)
  Object.entries(report.checks).forEach(([name, value]) => {
    if (value.status === "failed" && value.detail?.startsWith("Skipped after")) report.checks[name] = { status: "failed", detail: message }
  })
} finally {
  try {
    if (rotation !== undefined) restore("system", "accelerometer_rotation", rotation)
    if (userRotation !== undefined) restore("system", "user_rotation", userRotation)
    if (night !== undefined) {
      const result = adb("shell", "cmd", "uimode", "night", night == "2" ? "yes" : "no")
      if (result.code !== 0) report.checks.screenshots = { status: "failed", detail: detail(result, "Could not restore night mode.") }
    }
  } catch (cause) {
    report.checks.screenshots = { status: "failed", detail: cause instanceof Error ? cause.message : String(cause) }
  }
  const logs = run(["adb", ...(serial ? ["-s", serial] : []), "logcat", "-d", "-t", "400"])
  await Bun.write(join(root, "logcat.txt"), safe(`${logs.output}\n${logs.error}`))
  await Bun.write(join(root, "report.json"), JSON.stringify(report, null, 2))
}

console.log(JSON.stringify({ report: join(root, "report.json"), ...report }))
if (Object.values(report.checks).some((check) => check.status === "failed")) process.exitCode = 1
