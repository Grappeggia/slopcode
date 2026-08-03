const serial = Bun.env.ANDROID_SERIAL ?? "emulator-5554"
const packageID = Bun.env.ANDROID_PACKAGE ?? "dev.slopcode.android"
const cdpPort = Number(Bun.env.SSH_SHELL_CDP_PORT ?? "9222")
const screenshot = Bun.env.SSH_SHELL_SCREENSHOT ?? "/tmp/slopcode-task2-landscape-layout.png"
const decode = new TextDecoder()

function adb(...args: string[]) {
  const result = Bun.spawnSync(["adb", "-s", serial, ...args], { stdout: "pipe", stderr: "pipe" })
  const stdout = decode.decode(result.stdout)
  const stderr = decode.decode(result.stderr)
  if (result.exitCode !== 0) throw new Error(stderr.trim() || stdout.trim() || `adb ${args.join(" ")} failed`)
  return stdout.trim()
}

function optional(...args: string[]) {
  try {
    return adb(...args)
  } catch {
    return ""
  }
}

function rect(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return
  const next = value as Record<string, unknown>
  return typeof next.left === "number" &&
      typeof next.top === "number" &&
      typeof next.right === "number" &&
      typeof next.bottom === "number" &&
      typeof next.width === "number" &&
      typeof next.height === "number"
    ? next as {
        left: number
        top: number
        right: number
        bottom: number
        width: number
        height: number
      }
    : undefined
}

function overlaps(first: ReturnType<typeof rect>, second: ReturnType<typeof rect>) {
  if (!first || !second) return false
  return first.left < second.right && first.right > second.left && first.top < second.bottom && first.bottom > second.top
}

async function wait(ms: number) {
  await Bun.sleep(ms)
}

async function processID() {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const value = optional("shell", "pidof", packageID).split(/\s+/)[0]
    if (value) return value
    await wait(250)
  }
  throw new Error(`Could not find the ${packageID} process.`)
}

async function endpoint() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${cdpPort}/json`)
      const values = (await response.json()) as Array<{ webSocketDebuggerUrl?: string }>
      const value = values.find((item) => item.webSocketDebuggerUrl)?.webSocketDebuggerUrl
      if (value) return value
    } catch {}
    await wait(250)
  }
  throw new Error("The Android WebView debugging endpoint did not become available.")
}

async function evaluate(url: string, expression: string) {
  return await new Promise<unknown>((resolve, reject) => {
    const socket = new WebSocket(url)
    const timer = setTimeout(() => {
      socket.close()
      reject(new Error("Timed out waiting for WebView layout evaluation."))
    }, 5000)
    socket.addEventListener("error", () => {
      clearTimeout(timer)
      reject(new Error("Could not connect to the Android WebView debugger."))
    })
    socket.addEventListener("open", () => {
      socket.send(JSON.stringify({
        id: 1,
        method: "Runtime.evaluate",
        params: { expression, returnByValue: true },
      }))
    })
    socket.addEventListener("message", (event) => {
      const value = JSON.parse(String(event.data)) as {
        id?: number
        error?: { message?: string }
        result?: { result?: { value?: unknown } }
      }
      if (value.id !== 1) return
      clearTimeout(timer)
      socket.close()
      if (value.error) {
        reject(new Error(value.error.message ?? "WebView evaluation failed."))
        return
      }
      resolve(value.result?.result?.value)
    })
  })
}

const expression = `(() => {
  const box = (node) => {
    if (!node) return null;
    const value = node.getBoundingClientRect();
    return {left:value.left, top:value.top, right:value.right, bottom:value.bottom, width:value.width, height:value.height};
  };
  const label = (node) => node?.textContent?.trim() ?? "";
  const buttons = [...document.querySelectorAll("button")];
  const button = (name) => buttons.find((node) => label(node) === name);
  const root = document.documentElement;
  const style = getComputedStyle(root);
  const number = (name) => Number.parseFloat(style.getPropertyValue(name)) || 0;
  const main = document.querySelector("[data-ssh-shell] > main");
  const controls = [...document.querySelectorAll("[data-ssh-shell] button, [data-ssh-shell] input:not([type=checkbox]), [data-ssh-shell] textarea, [data-ssh-shell] select, [data-ssh-shell] summary")]
    .map((node) => ({label: label(node), rect: box(node), minHeight: getComputedStyle(node).minHeight}))
    .filter((value) => value.rect && value.rect.width > 0 && value.rect.height > 0);
  const primary = button("Continue");
  const add = button("Add computer");
  const initial = {
    menu: box(document.querySelector("[data-ssh-menu-toggle]")),
    add: box(add),
    primary: box(primary),
    primaryPosition: primary ? getComputedStyle(primary).position : null,
    controls,
  };
  if (main) main.scrollTop = main.scrollHeight;
  const bottom = {
    add: box(add),
    primary: box(primary),
  };
  return JSON.stringify({
    viewport: {width: innerWidth, height: innerHeight},
    insets: {
      top: number("--android-inset-top"),
      right: number("--android-inset-right"),
      bottom: number("--android-inset-bottom"),
      left: number("--android-inset-left"),
      imeBottom: number("--android-ime-bottom"),
    },
    initial,
    bottom,
  });
})()`

const seedWorkspace = `(() => {
  if (!window.SlopcodeAndroid) return false;
  const value = {
    version: 1,
    target: "agent@fixture.test",
    profile: "agent@fixture.test:22",
    host: "fixture.test",
    port: 22,
    username: "agent",
    directory: "/home/agent/temp",
    agent: "slopcode-cli",
    recentTargets: ["agent@fixture.test"],
    recentFolders: ["/home/agent/temp"]
  };
  window.SlopcodeAndroid.postMessage(JSON.stringify({
    id: "ssh-shell-layout-fixture",
    method: "storageSet",
    args: ["slopcode.android.remote.dat", "ssh.workspace.v1", JSON.stringify(value)]
  }));
  return true;
})()`

let debuggerForwarded = false

try {
  adb("shell", "wm", "size", "2400x1080")
  adb("shell", "settings", "put", "system", "font_scale", "1.0")
  adb("shell", "am", "force-stop", packageID)
  optional("shell", "monkey", "-p", packageID, "1")
  await wait(500)

  const pid = await processID()
  optional("forward", "--remove", `tcp:${cdpPort}`)
  adb("forward", `tcp:${cdpPort}`, `localabstract:webview_devtools_remote_${pid}`)
  debuggerForwarded = true
  let url = await endpoint()
  let seeded = false
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if ((await evaluate(url, seedWorkspace)) === true) {
      seeded = true
      break
    }
    await wait(250)
    url = await endpoint()
  }
  if (!seeded) throw new Error("The Android bridge was not available to seed the layout fixture.")
  await wait(200)
  adb("shell", "am", "force-stop", packageID)
  optional("shell", "monkey", "-p", packageID, "1")
  await wait(500)
  const seededPid = await processID()
  optional("forward", "--remove", `tcp:${cdpPort}`)
  adb("forward", `tcp:${cdpPort}`, `localabstract:webview_devtools_remote_${seededPid}`)
  url = await endpoint()
  let value: {
    viewport: { width: number; height: number }
    insets: { top: number; right: number; bottom: number; left: number; imeBottom: number }
    initial: { menu: unknown; add: unknown; primary: unknown; primaryPosition: string | null; controls: Array<{ rect: unknown; minHeight: string }> }
    bottom: { add: unknown; primary: unknown }
  } | undefined
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const raw = await evaluate(url, expression)
    if (typeof raw === "string") {
      const next = JSON.parse(raw) as typeof value
      if (next.initial.add && next.initial.primary) {
        value = next
        break
      }
    }
    await wait(250)
  }
  if (!value) throw new Error("The Android onboarding layout did not become ready in time.")
  const menu = rect(value.initial.menu)
  const add = rect(value.initial.add)
  const primary = rect(value.initial.primary)
  const bottomAdd = rect(value.bottom.add)
  const bottomPrimary = rect(value.bottom.primary)
  const status = value.insets.top > 0
    ? { left: 0, top: 0, right: value.viewport.width, bottom: value.insets.top }
    : { left: 0, top: 0, right: Math.max(56, value.insets.left), bottom: value.viewport.height }
  const statusRect = rect({ ...status, width: status.right - status.left, height: status.bottom - status.top })
  const controlFailure = value.initial.controls.find((item) => {
    const value = rect(item.rect)
    return !value || value.width < 48 || value.height < 48 || Number.parseFloat(item.minHeight) < 48
  })
  if (!menu || !add || !primary) throw new Error("Onboarding Add computer and Continue controls were not rendered.")
  if (!statusRect || overlaps(menu, statusRect) || menu.top < 32) throw new Error(`Landscape hamburger overlaps the status-bar region: ${JSON.stringify({ menu, statusRect, insets: value.insets })}`)
  if (!bottomAdd || overlaps(add, primary) || overlaps(bottomAdd, bottomPrimary)) throw new Error(`Continue overlaps Add computer: ${JSON.stringify({ initial: { add, primary }, bottom: value.bottom })}`)
  if (value.initial.primaryPosition !== "static") throw new Error(`Landscape onboarding primary action must use normal flow, got ${value.initial.primaryPosition}.`)
  if (!bottomPrimary || bottomPrimary.bottom > value.viewport.height - value.insets.bottom + 1) throw new Error(`Continue is not reachable at the bottom of the scroll container: ${JSON.stringify({ bottomPrimary, viewport: value.viewport, insets: value.insets })}`)
  if (controlFailure) throw new Error(`A rendered control is below the 48dp target: ${JSON.stringify(controlFailure)}`)
  await wait(800)
  const bytes = Bun.spawnSync(["adb", "-s", serial, "exec-out", "screencap", "-p"], { stdout: "pipe", stderr: "pipe" }).stdout
  await Bun.write(screenshot, bytes)
  console.log(JSON.stringify({ ok: true, screenshot, viewport: value.viewport, insets: value.insets, menu, add, primary, bottomAdd, bottomPrimary }))
} finally {
  if (debuggerForwarded) optional("forward", "--remove", `tcp:${cdpPort}`)
  optional("shell", "wm", "size", "reset")
}
