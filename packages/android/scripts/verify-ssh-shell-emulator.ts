import {
  auditSshShellLayout,
  sshShellRect,
  SSH_SHELL_VISUAL_FIXTURES,
  type SshShellRect,
  type SshShellVisualFixture,
} from "../src/ssh-shell-visual"

const serial = Bun.env.ANDROID_SERIAL ?? "emulator-5554"
const packageID = Bun.env.ANDROID_PACKAGE ?? "dev.slopcode.android"
const cdpPort = Number(Bun.env.SSH_SHELL_CDP_PORT ?? "9222")
const screenshotDir = Bun.env.SSH_SHELL_SCREENSHOT_DIR ?? "/tmp"
const requestedScreenshot = Bun.env.SSH_SHELL_SCREENSHOT
const namespace = "slopcode.android.remote.dat"
const workspaceKey = "ssh.workspace.v1"
const colorKey = "slopcode.android.ssh.color-scheme"
const decode = new TextDecoder()

type StorageSnapshot = Map<string, string>
type LocalSnapshot = Record<string, string>

type Probe = {
  scheme: string
  storedScheme: string | null
  viewport: { width: number; height: number; visualHeight: number; devicePixelRatio: number }
  insets: { top: number; right: number; bottom: number; left: number; imeBottom: number }
  device: {
    orientation: "portrait" | "landscape"
    navigation: "system" | "gesture"
    userRotation: string
    navigationMode: string
  }
  initial: {
    menu: unknown
    add: unknown
    primary: unknown
    primaryPosition: string | null
    controls: Array<{ rect: unknown; minHeight: string }>
  }
  bottom: { add: unknown; primary: unknown }
  drawer: {
    opened: boolean
    openAriaHidden: string | null
    openInert: boolean
    openFocusInside: boolean
    closedAriaHidden: string | null
    closedInert: boolean
    closedFocusReturned: boolean
  }
  keyboard: {
    requested: boolean
    available: boolean
    deviceVisible: boolean
    focused: boolean
    input: unknown
    visualHeight: number
  }
  interactive: {
    available: boolean
    controls: Array<{ label: string; rect: unknown; minHeight: string }>
    tabs: Array<{ selected: string | null; controls: string | null }>
    inputLabel: string | null
  }
}

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

function keyboardVisibleOnDevice() {
  return optional("shell", "dumpsys", "input_method").includes("mInputShown=true")
}

function message(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

function requireValue(condition: unknown, detail: string): asserts condition {
  if (!condition) throw new Error(detail)
}

function rect(value: unknown): SshShellRect | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return
  const next = value as Record<string, unknown>
  if (
    typeof next.left !== "number" ||
    typeof next.top !== "number" ||
    typeof next.right !== "number" ||
    typeof next.bottom !== "number" ||
    typeof next.width !== "number" ||
    typeof next.height !== "number"
  )
    return
  return {
    left: next.left,
    top: next.top,
    right: next.right,
    bottom: next.bottom,
    width: next.width,
    height: next.height,
  }
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function strings(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []
}

function parseMap(value: unknown): LocalSnapshot {
  if (!record(value)) throw new Error("The WebView returned an invalid local-storage snapshot.")
  return Object.fromEntries(
    Object.entries(value).filter((item): item is [string, string] => typeof item[1] === "string"),
  )
}

function sameMap(first: Map<string, string>, second: Map<string, string>) {
  if (first.size !== second.size) return false
  return [...first].every(([key, value]) => second.get(key) === value)
}

function sameRecord(first: LocalSnapshot, second: LocalSnapshot) {
  const keys = Object.keys(first)
  return keys.length === Object.keys(second).length && keys.every((key) => second[key] === first[key])
}

async function wait(ms: number) {
  await Bun.sleep(ms)
}

async function processID() {
  for (let attempt = 0; attempt < 30; attempt += 1) {
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
      reject(new Error("Timed out waiting for WebView evaluation."))
    }, 8000)
    socket.addEventListener("error", () => {
      clearTimeout(timer)
      reject(new Error("Could not connect to the Android WebView debugger."))
    })
    socket.addEventListener("open", () => {
      socket.send(
        JSON.stringify({
          id: 1,
          method: "Runtime.evaluate",
          params: { expression, returnByValue: true, awaitPromise: true },
        }),
      )
    })
    socket.addEventListener("message", (event) => {
      const value = JSON.parse(String(event.data)) as {
        id?: number
        error?: { message?: string }
        result?: {
          result?: { value?: unknown }
          exceptionDetails?: { text?: string; exception?: { description?: string } }
        }
      }
      if (value.id !== 1) return
      clearTimeout(timer)
      socket.close()
      if (value.error) {
        reject(new Error(value.error.message ?? "WebView evaluation failed."))
        return
      }
      if (value.result?.exceptionDetails) {
        reject(
          new Error(
            value.result.exceptionDetails.exception?.description ??
              value.result.exceptionDetails.text ??
              "WebView evaluation failed.",
          ),
        )
        return
      }
      resolve(value.result?.result?.value)
    })
  })
}

function nativeCallExpression(method: string, args: readonly unknown[]) {
  return `(async () => {
    const port = window.SlopcodeAndroid;
    if (!port) return JSON.stringify({ ok: false, message: "Android bridge unavailable" });
    const previous = port.onmessage;
    const id = "ssh-shell-checker-" + Date.now() + "-" + Math.random();
    const result = await new Promise((resolve) => {
      let timer;
      const finish = (value) => {
        clearTimeout(timer);
        resolve(value);
      };
      timer = setTimeout(() => finish({ ok: false, message: "Android bridge request timed out" }), 8000);
      port.onmessage = (event) => {
        try { previous?.(event); } catch {}
        let value;
        try { value = JSON.parse(String(event.data)); } catch { return; }
        if (value?.id !== id) return;
        finish(value);
      };
      port.postMessage(JSON.stringify({ id, method: ${JSON.stringify(method)}, args: ${JSON.stringify(args)} }));
    });
    port.onmessage = previous;
    return JSON.stringify(result);
  })()`
}

async function native(url: string, method: string, ...args: unknown[]) {
  const raw = await evaluate(url, nativeCallExpression(method, args))
  requireValue(typeof raw === "string", `Android bridge ${method} returned no response.`)
  const value = JSON.parse(raw) as { ok?: boolean; result?: unknown; message?: string; code?: string }
  requireValue(value.ok === true, `Android bridge ${method} failed: ${value.message ?? value.code ?? "unknown error"}`)
  return value.result
}

async function waitForBridge(url: string) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    if ((await evaluate(url, 'typeof window.SlopcodeAndroid === "object"')) === true) return
    await wait(250)
  }
  throw new Error("The Android bridge was not available.")
}

async function forwardDebugger() {
  const pid = await processID()
  optional("forward", "--remove", `tcp:${cdpPort}`)
  adb("forward", `tcp:${cdpPort}`, `localabstract:webview_devtools_remote_${pid}`)
  return await endpoint()
}

async function launch() {
  optional("shell", "am", "force-stop", packageID)
  optional("shell", "monkey", "-p", packageID, "1")
  await wait(700)
  return await forwardDebugger()
}

async function snapshotStorage(url: string) {
  const keys = strings(await native(url, "storageKeys", namespace))
  const values: StorageSnapshot = new Map()
  for (const key of keys) {
    const value = await native(url, "storageGet", namespace, key)
    if (typeof value === "string") values.set(key, value)
  }
  return values
}

async function restoreStorage(url: string, snapshot: StorageSnapshot) {
  const current = strings(await native(url, "storageKeys", namespace))
  for (const key of current) {
    if (!snapshot.has(key)) await native(url, "storageRemove", namespace, key)
  }
  for (const [key, value] of snapshot) await native(url, "storageSet", namespace, key, value)
}

async function snapshotLocalStorage(url: string) {
  const raw = await evaluate(
    url,
    `JSON.stringify(Object.fromEntries(Object.keys(localStorage).map((key) => [key, localStorage.getItem(key)])))`,
  )
  requireValue(typeof raw === "string", "The WebView returned no local-storage snapshot.")
  return parseMap(JSON.parse(raw))
}

async function restoreLocalStorage(url: string, snapshot: LocalSnapshot) {
  const value = JSON.stringify(snapshot)
  await evaluate(
    url,
    `(() => {
      const values = ${value};
      localStorage.clear();
      Object.entries(values).forEach(([key, item]) => localStorage.setItem(key, item));
      location.reload();
      return true;
    })()`,
  )
  await wait(700)
}

function setDisplay(fixture: SshShellVisualFixture) {
  adb("shell", "wm", "size", fixture.orientation === "landscape" ? "2400x1080" : "1080x2400")
  adb("shell", "wm", "user-rotation", "lock", fixture.orientation === "landscape" ? "1" : "0")
  adb("shell", "settings", "put", "system", "accelerometer_rotation", "0")
  adb("shell", "settings", "put", "system", "user_rotation", fixture.orientation === "landscape" ? "1" : "0")
  adb("shell", "settings", "put", "secure", "navigation_mode", fixture.insets === "gesture" ? "2" : "0")
  adb("shell", "settings", "put", "secure", "show_ime_with_hard_keyboard", fixture.keyboard ? "1" : "0")
  adb("shell", "settings", "put", "system", "font_scale", String(fixture.fontScale))
}

async function setScheme(url: string, scheme: SshShellVisualFixture["scheme"]) {
  await evaluate(
    url,
    `(() => {
      localStorage.setItem(${JSON.stringify(colorKey)}, ${JSON.stringify(scheme)});
      location.reload();
      return true;
    })()`,
  ).catch(() => undefined)
  await wait(700)
  const next = await forwardDebugger()
  await waitForBridge(next)
  const raw = await evaluate(
    next,
    `JSON.stringify({ rendered: document.documentElement.dataset.colorScheme ?? null, stored: localStorage.getItem(${JSON.stringify(colorKey)}) })`,
  )
  const value =
    typeof raw === "string" ? (JSON.parse(raw) as { rendered?: string | null; stored?: string | null }) : undefined
  requireValue(
    value?.rendered === scheme && value.stored === scheme,
    `Could not set the rendered theme to ${scheme}: ${JSON.stringify(value)}`,
  )
  return next
}

function screenshotPath(fixture: SshShellVisualFixture) {
  if (requestedScreenshot && fixture.id === SSH_SHELL_VISUAL_FIXTURES[0].id) return requestedScreenshot
  return `${screenshotDir}/slopcode-task2-${fixture.id}.png`
}

const readyExpression = `(() => {
  const label = (node) => node?.textContent?.trim() ?? "";
  const buttons = [...document.querySelectorAll("button")];
  return JSON.stringify({
    add: buttons.some((node) => label(node) === "Add computer"),
    primary: buttons.some((node) => label(node) === "Continue"),
  });
})()`

const probeExpression = (keyboardRequested: boolean) => String.raw`(async () => {
  const frame = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  const delay = (value) => new Promise((resolve) => setTimeout(resolve, value));
  const box = (node) => {
    if (!node) return null;
    const value = node.getBoundingClientRect();
    return { left: value.left, top: value.top, right: value.right, bottom: value.bottom, width: value.width, height: value.height };
  };
  const label = (node) => node?.textContent?.trim() ?? "";
  const button = (value) => [...document.querySelectorAll("button")].find((node) => label(node) === value);
  const visible = (node) => {
    const value = box(node);
    return value && value.width > 0 && value.height > 0 && value.right > 0 && value.left < innerWidth && value.bottom > 0 && value.top < innerHeight;
  };
  const controls = () => [...document.querySelectorAll("[data-ssh-shell] button, [data-ssh-shell] input:not([type=checkbox]), [data-ssh-shell] textarea, [data-ssh-shell] select, [data-ssh-shell] summary")]
    .filter((node) => visible(node))
    .map((node) => ({ label: label(node), rect: box(node), minHeight: getComputedStyle(node).minHeight }));
  const number = (name) => Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name)) || 0;
  const menu = document.querySelector("[data-ssh-menu-toggle]");
  const drawer = document.querySelector("[data-ssh-drawer]");
  const main = document.querySelector("[data-ssh-shell] main");
  const add = button("Add computer");
  const primary = button("Continue");
  const initial = {
    menu: box(menu),
    add: box(add),
    primary: box(primary),
    primaryPosition: primary ? getComputedStyle(primary).position : null,
    controls: controls(),
  };

  menu?.click();
  await frame();
  const opened = {
    opened: drawer?.getAttribute("aria-hidden") !== "true",
    ariaHidden: drawer?.getAttribute("aria-hidden") ?? null,
    inert: drawer?.inert === true,
    focusInside: !!drawer?.contains(document.activeElement),
  };
  menu?.click();
  await frame();
  const closed = {
    ariaHidden: drawer?.getAttribute("aria-hidden") ?? null,
    inert: drawer?.inert === true,
    focusReturned: document.activeElement === menu,
  };

  let keyboard = { requested: ${keyboardRequested}, available: false, deviceVisible: false, focused: false, input: null, visualHeight: visualViewport?.height ?? innerHeight };
  const interactiveRoot = document.querySelector("[data-ssh-interactive]");
  const tabs = [...document.querySelectorAll('[role="tab"]')].map((node) => ({ selected: node.getAttribute("aria-selected"), controls: node.getAttribute("aria-controls") }));
  const interactive = {
    available: !!interactiveRoot,
    controls: interactiveRoot ? [...interactiveRoot.querySelectorAll("button, input, textarea, select")].map((node) => ({ label: label(node), rect: box(node), minHeight: getComputedStyle(node).minHeight })).filter((value) => value.rect && value.rect.width > 0 && value.rect.height > 0) : [],
    tabs,
    inputLabel: document.querySelector("#ssh-session-input")?.getAttribute("aria-label") ?? null,
  };

  if (${keyboardRequested}) {
    button("Add computer")?.click();
    await frame();
    const input = document.querySelector("input:not([type=hidden])");
    input?.focus();
    await delay(700);
    const visualHeight = visualViewport?.height ?? innerHeight;
    const imeBottom = number("--android-ime-bottom");
    keyboard = {
      requested: true,
      available: imeBottom > 0 || visualHeight < innerHeight - 40,
      focused: document.activeElement === input,
      input: box(input),
      visualHeight,
    };
  } else {
    if (main) main.scrollIntoView({ block: "center", inline: "nearest" });
    primary?.scrollIntoView({ block: "center", inline: "nearest" });
    await frame();
  }
  const bottom = { add: box(button("Add computer")), primary: box(button("Continue")) };
  return JSON.stringify({
    scheme: document.documentElement.dataset.colorScheme ?? null,
    storedScheme: localStorage.getItem(${JSON.stringify(colorKey)}),
    viewport: { width: innerWidth, height: innerHeight, visualHeight: visualViewport?.height ?? innerHeight, devicePixelRatio },
    insets: { top: number("--android-inset-top"), right: number("--android-inset-right"), bottom: number("--android-inset-bottom"), left: number("--android-inset-left"), imeBottom: number("--android-ime-bottom") },
    initial,
    bottom,
    drawer: { opened: opened.opened, openAriaHidden: opened.ariaHidden, openInert: opened.inert, openFocusInside: opened.focusInside, closedAriaHidden: closed.ariaHidden, closedInert: closed.inert, closedFocusReturned: closed.focusReturned },
    keyboard,
    interactive,
  });
})()`

async function ready(url: string) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const raw = await evaluate(url, readyExpression)
    if (typeof raw === "string") {
      const value = JSON.parse(raw) as { add?: boolean; primary?: boolean }
      if (value.add && value.primary) return
    }
    await wait(300)
  }
  throw new Error("The Android onboarding layout did not become ready in time.")
}

async function waitForViewport(url: string, fixture: SshShellVisualFixture) {
  for (let attempt = 0; attempt < 24; attempt += 1) {
    const raw = await evaluate(url, "JSON.stringify({ width: innerWidth, height: innerHeight })")
    if (typeof raw === "string") {
      const value = JSON.parse(raw) as { width?: number; height?: number }
      const landscape =
        typeof value.width === "number" && typeof value.height === "number" && value.width > value.height
      if (landscape === (fixture.orientation === "landscape")) return
    }
    await wait(250)
  }
  throw new Error(`${fixture.id}: the WebView viewport did not reach ${fixture.orientation}.`)
}

async function probe(url: string, keyboardRequested: boolean) {
  const raw = await evaluate(url, probeExpression(keyboardRequested))
  requireValue(typeof raw === "string", "The WebView visual probe returned no result.")
  const value = JSON.parse(raw) as Omit<Probe, "device">
  if (keyboardRequested) {
    const tapRaw = await evaluate(
      url,
      `(() => {
        const input = document.querySelector("input:not([type=hidden])");
        input?.scrollIntoView({ block: "center", inline: "nearest" });
        const rect = input?.getBoundingClientRect();
        return JSON.stringify({
          dpr: devicePixelRatio,
          rect: rect ? { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height } : null,
        });
      })()`,
    )
    const tap = typeof tapRaw === "string" ? (JSON.parse(tapRaw) as { dpr?: number; rect?: unknown }) : undefined
    const input = rect(tap?.rect ?? value.keyboard.input)
    if (input) {
      await wait(300)
      const dpr = tap?.dpr ?? value.viewport.devicePixelRatio
      const x = Math.round((input.left + input.width / 2) * dpr)
      const y = Math.round((input.top + input.height / 2) * dpr)
      for (const offset of [0, -160, 160, -320, 320, -480, 480]) {
        if (keyboardVisibleOnDevice()) break
        adb("shell", "input", "tap", String(x), String(Math.max(80, y + offset)))
        await wait(180)
      }
      await wait(700)
      const refreshed = await evaluate(
        url,
        `(() => {
          const input = document.querySelector("input:not([type=hidden])");
          const rect = input?.getBoundingClientRect();
          const number = (name) => Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name)) || 0;
          return JSON.stringify({
            requested: true,
            available: number("--android-ime-bottom") > 0 || (visualViewport?.height ?? innerHeight) < innerHeight - 40,
            focused: document.activeElement === input,
            input: rect ? { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height } : null,
            visualHeight: visualViewport?.height ?? innerHeight,
          });
        })()`,
      )
      if (typeof refreshed === "string") {
        const next = JSON.parse(refreshed) as Probe["keyboard"]
        const deviceVisible = keyboardVisibleOnDevice()
        value.keyboard = { ...next, available: next.available || deviceVisible, deviceVisible }
      }
    }
  }
  const navigationMode = adb("shell", "settings", "get", "secure", "navigation_mode")
  const userRotation = adb("shell", "settings", "get", "system", "user_rotation")
  return {
    ...value,
    device: {
      orientation: value.viewport.width <= value.viewport.height ? "portrait" : "landscape",
      navigation: navigationMode === "2" ? "gesture" : "system",
      userRotation,
      navigationMode,
    },
  } satisfies Probe
}

async function capture(path: string) {
  const result = Bun.spawnSync(["adb", "-s", serial, "exec-out", "screencap", "-p"], { stdout: "pipe", stderr: "pipe" })
  if (result.exitCode !== 0)
    throw new Error(decode.decode(result.stderr) || "Could not capture the emulator screenshot.")
  await Bun.write(path, result.stdout)
}

function assertProbe(fixture: SshShellVisualFixture, value: Probe) {
  requireValue(
    value.scheme === fixture.scheme,
    `${fixture.id}: rendered theme is ${value.scheme ?? "unknown"}, expected ${fixture.scheme}; stored=${value.storedScheme ?? "none"}.`,
  )
  const menu = rect(value.initial.menu)
  const add = rect(value.initial.add)
  const primary = rect(value.initial.primary)
  const bottomAdd = rect(value.bottom.add)
  const bottomPrimary = rect(value.bottom.primary)
  requireValue(
    menu && (fixture.keyboard || add) && (fixture.keyboard || primary),
    `${fixture.id}: onboarding controls were not rendered.`,
  )

  const status =
    fixture.orientation === "landscape" && value.insets.top === 0
      ? sshShellRect(0, 0, Math.max(32, value.insets.left), value.viewport.height)
      : sshShellRect(0, 0, value.viewport.width, Math.max(32, value.insets.top))
  const controls = value.initial.controls.flatMap((item) => {
    const next = rect(item.rect)
    return next ? [next] : []
  })
  const audit = menu ? auditSshShellLayout({ menu, statusBar: status, addComputer: add, primary, controls }) : undefined
  requireValue(
    audit?.menuClearsStatusBar,
    `${fixture.id}: hamburger intersects the measured status-bar region: ${JSON.stringify({ menu, status, insets: value.insets, viewport: value.viewport })}`,
  )
  requireValue(audit?.primaryClearsAddComputer, `${fixture.id}: Continue intersects Add computer.`)
  requireValue(
    audit?.controlsMeetTouchTarget && controls.length > 0,
    `${fixture.id}: a rendered control is below 48dp.`,
  )
  requireValue(
    value.drawer.opened &&
      value.drawer.openAriaHidden !== "true" &&
      !value.drawer.openInert &&
      value.drawer.openFocusInside,
    `${fixture.id}: drawer did not expose modal focus semantics when open: ${JSON.stringify(value.drawer)}`,
  )
  requireValue(
    value.drawer.closedAriaHidden === "true" && value.drawer.closedInert && value.drawer.closedFocusReturned,
    `${fixture.id}: closed drawer leaked focus or accessibility exposure: ${JSON.stringify(value.drawer)}`,
  )
  requireValue(
    value.device.orientation === fixture.orientation,
    `${fixture.id}: measured orientation is ${value.device.orientation}, expected ${fixture.orientation}.`,
  )
  requireValue(
    value.device.navigation === fixture.insets,
    `${fixture.id}: measured navigation mode is ${value.device.navigation}, expected ${fixture.insets}.`,
  )

  if (!fixture.keyboard) {
    const expectedPosition = fixture.primaryAction === "flow" ? "static" : "sticky"
    requireValue(
      value.initial.primaryPosition === expectedPosition,
      `${fixture.id}: primary action position is ${value.initial.primaryPosition}.`,
    )
    requireValue(bottomAdd && bottomPrimary, `${fixture.id}: bottom onboarding controls were not rendered.`)
    requireValue(
      auditSshShellLayout({ menu, statusBar: status, addComputer: bottomAdd, primary: bottomPrimary, controls })
        .primaryClearsAddComputer,
      `${fixture.id}: bottom control audit was invalid.`,
    )
    requireValue(
      bottomPrimary.bottom <= value.viewport.height - value.insets.bottom + 1,
      `${fixture.id}: Continue is not reachable above the bottom inset: ${JSON.stringify({ bottomPrimary, viewport: value.viewport, insets: value.insets })}`,
    )
  }

  if (fixture.keyboard) {
    const input = rect(value.keyboard.input)
    requireValue(
      value.keyboard.available &&
        value.keyboard.focused &&
        input &&
        input.top >= -1 &&
        input.bottom <= value.keyboard.visualHeight + 1,
      `${fixture.id}: the requested keyboard did not appear or the focused input is not visible: ${JSON.stringify(value.keyboard)}`,
    )
  }

  if (value.interactive.available) {
    requireValue(value.interactive.tabs.length >= 2, `${fixture.id}: interactive mode tabs are missing.`)
    requireValue(
      value.interactive.tabs.filter((item) => item.selected === "true").length === 1,
      `${fixture.id}: interactive tab selection is invalid.`,
    )
    requireValue(
      value.interactive.inputLabel === "Prompt or interactive PTY input",
      `${fixture.id}: interactive prompt input is not labeled.`,
    )
    requireValue(
      value.interactive.controls.every((item) => {
        const next = rect(item.rect)
        return !!next && next.width >= 48 && next.height >= 48 && Number.parseFloat(item.minHeight) >= 48
      }),
      `${fixture.id}: interactive PTY control is below the 48dp target.`,
    )
  }
}

const originalSize = adb("shell", "wm", "size")
const originalOverride = /Override size: (\d+x\d+)/.exec(originalSize)?.[1]
const originalFontScale = adb("shell", "settings", "get", "system", "font_scale")
const originalAccelerometerRotation = adb("shell", "settings", "get", "system", "accelerometer_rotation")
const originalUserRotation = adb("shell", "settings", "get", "system", "user_rotation")
const originalUserRotationMode = adb("shell", "wm", "user-rotation")
const originalNavigationMode = adb("shell", "settings", "get", "secure", "navigation_mode")
const originalShowImeWithHardKeyboard = adb("shell", "settings", "get", "secure", "show_ime_with_hard_keyboard")
const originalRunning = !!optional("shell", "pidof", packageID)
let currentURL: string | undefined
let storageSnapshot: StorageSnapshot | undefined
let localSnapshot: LocalSnapshot | undefined
let keyboardShown = false

function restoreDeviceSettings() {
  if (originalOverride) adb("shell", "wm", "size", originalOverride)
  else adb("shell", "wm", "size", "reset")
  if (/^lock [0-3]$/.test(originalUserRotationMode)) {
    const rotation = originalUserRotationMode.slice(-1)
    adb("shell", "wm", "user-rotation", "lock", rotation)
  } else if (originalUserRotationMode === "free") adb("shell", "wm", "user-rotation", "free")
  else optional("shell", "wm", "user-rotation", "free")
  if (/^\d+(?:\.\d+)?$/.test(originalFontScale))
    adb("shell", "settings", "put", "system", "font_scale", originalFontScale)
  else optional("shell", "settings", "delete", "system", "font_scale")
  if (/^\d+$/.test(originalAccelerometerRotation))
    adb("shell", "settings", "put", "system", "accelerometer_rotation", originalAccelerometerRotation)
  else optional("shell", "settings", "delete", "system", "accelerometer_rotation")
  if (/^\d+$/.test(originalUserRotation))
    adb("shell", "settings", "put", "system", "user_rotation", originalUserRotation)
  else optional("shell", "settings", "delete", "system", "user_rotation")
  if (/^\d+$/.test(originalNavigationMode))
    adb("shell", "settings", "put", "secure", "navigation_mode", originalNavigationMode)
  else optional("shell", "settings", "delete", "secure", "navigation_mode")
  if (/^\d+$/.test(originalShowImeWithHardKeyboard))
    adb("shell", "settings", "put", "secure", "show_ime_with_hard_keyboard", originalShowImeWithHardKeyboard)
  else optional("shell", "settings", "delete", "secure", "show_ime_with_hard_keyboard")
}

async function cleanup() {
  const failures: string[] = []
  const attempt = async (name: string, action: () => Promise<void> | void) => {
    try {
      await action()
    } catch (cause) {
      failures.push(`${name}: ${message(cause)}`)
    }
  }

  if (storageSnapshot && localSnapshot) {
    await attempt("open app for cleanup", async () => {
      currentURL ??= await launch()
      await waitForBridge(currentURL)
    })
    if (currentURL) {
      await attempt("restore encrypted workspace storage", () => restoreStorage(currentURL!, storageSnapshot!))
      await attempt("restore WebView storage", () => restoreLocalStorage(currentURL!, localSnapshot!))
      await attempt("stop app after restoring WebView storage", () => {
        optional("shell", "am", "force-stop", packageID)
        currentURL = undefined
      })
    }
  }
  if (keyboardShown) optional("shell", "input", "keyevent", "4")
  await attempt("restore Android display settings", restoreDeviceSettings)

  if (storageSnapshot && localSnapshot) {
    await attempt("verify restored state", async () => {
      const url = await launch()
      currentURL = url
      await waitForBridge(url)
      const stored = await snapshotStorage(url)
      const local = await snapshotLocalStorage(url)
      requireValue(
        sameMap(storageSnapshot!, stored),
        `encrypted workspace storage differs after cleanup: ${JSON.stringify({ expected: Object.fromEntries(storageSnapshot!), actual: Object.fromEntries(stored) })}`,
      )
      const expectedLocal = { ...localSnapshot! }
      const actualLocal = { ...local }
      if (!Object.hasOwn(expectedLocal, colorKey)) delete actualLocal[colorKey]
      requireValue(
        sameRecord(expectedLocal, actualLocal),
        `WebView storage differs after cleanup: ${JSON.stringify({ expected: expectedLocal, actual: local })}`,
      )
      restoreDeviceSettings()
      await wait(200)
      const size = adb("shell", "wm", "size")
      requireValue(
        (/Override size: (\d+x\d+)/.exec(size)?.[1] ?? undefined) === originalOverride,
        "display size differs after cleanup",
      )
      const font = adb("shell", "settings", "get", "system", "font_scale")
      requireValue(font === originalFontScale, "font scale differs after cleanup")
      requireValue(
        adb("shell", "settings", "get", "system", "accelerometer_rotation") === originalAccelerometerRotation,
        "accelerometer rotation differs after cleanup",
      )
      requireValue(
        adb("shell", "settings", "get", "system", "user_rotation") === originalUserRotation,
        "user rotation differs after cleanup",
      )
      requireValue(
        adb("shell", "wm", "user-rotation") === originalUserRotationMode,
        "window-manager rotation differs after cleanup",
      )
      requireValue(
        adb("shell", "settings", "get", "secure", "navigation_mode") === originalNavigationMode,
        "navigation mode differs after cleanup",
      )
      requireValue(
        adb("shell", "settings", "get", "secure", "show_ime_with_hard_keyboard") === originalShowImeWithHardKeyboard,
        "IME keyboard setting differs after cleanup",
      )
    })
  }
  if (!originalRunning) optional("shell", "am", "force-stop", packageID)
  optional("forward", "--remove", `tcp:${cdpPort}`)
  if (failures.length) return failures.join("; ")
  return ""
}

let failure: unknown
const results: Array<{
  id: string
  scheme: string
  orientation: string
  fontScale: number
  keyboard: string
  interactive: string
  screenshot: string
}> = []

try {
  currentURL = await launch()
  await waitForBridge(currentURL)
  storageSnapshot = await snapshotStorage(currentURL)
  localSnapshot = await snapshotLocalStorage(currentURL)
  const fixture = {
    version: 1,
    target: "agent@fixture.test",
    profile: "agent@fixture.test:22",
    host: "fixture.test",
    port: 22,
    username: "agent",
    directory: "/home/agent/temp",
    agent: "opencode-cli",
    recentTargets: ["agent@fixture.test"],
    recentFolders: ["/home/agent/temp"],
  }
  await native(currentURL, "storageSet", namespace, workspaceKey, JSON.stringify(fixture))
  currentURL = await launch()

  for (const item of SSH_SHELL_VISUAL_FIXTURES) {
    optional("shell", "input", "keyevent", "4")
    await wait(250)
    setDisplay(item)
    currentURL = await launch()
    await waitForBridge(currentURL)
    currentURL = await setScheme(currentURL, item.scheme)
    await waitForViewport(currentURL, item)
    await ready(currentURL)
    const value = await probe(currentURL, item.keyboard)
    assertProbe(item, value)
    keyboardShown ||= item.keyboard && value.keyboard.available
    const path = screenshotPath(item)
    await capture(path)
    results.push({
      id: item.id,
      scheme: item.scheme,
      orientation: item.orientation,
      fontScale: item.fontScale,
      keyboard: item.keyboard ? (value.keyboard.deviceVisible ? "available" : "unavailable") : "not-requested",
      interactive: value.interactive.available ? "available" : "unavailable",
      screenshot: path,
    })
  }
} catch (cause) {
  failure = cause
}

const cleanupFailure = await cleanup()
if (failure) throw failure
if (cleanupFailure) throw new Error(`Emulator check passed its assertions but cleanup failed: ${cleanupFailure}`)
console.log(
  JSON.stringify({
    ok: true,
    matrix: results,
    cleanupVerified: true,
    interactivePty: results.some((item) => item.interactive === "available") ? "available" : "unavailable",
    note: "interactive PTY was not exercised because the checker has no live authenticated SSH fixture",
  }),
)
