import { describe, expect, test } from "bun:test"
import { isAllowedCorsOrigin } from "slopcode/server/cors"
import { rendererCorsOrigins } from "../security"
import { createIpcAuthorization, guardIpc, isTrustedRendererUrl, protectNavigation } from "./security"

type NavigationEvent = {
  url: string
  isMainFrame: boolean
  preventDefault: () => void
}

function navigation(dev?: string) {
  const listeners = new Map<string, (event: NavigationEvent) => void>()
  const opened: string[] = []
  const navigated: string[] = []
  let popup: ((details: { url: string }) => { action: "deny" }) | undefined
  const contents = {
    on(event: string, listener: (event: NavigationEvent) => void) {
      listeners.set(event, listener)
      return contents
    },
    setWindowOpenHandler(handler: (details: { url: string }) => { action: "deny" }) {
      popup = handler
    },
    loadURL(url: string) {
      navigated.push(url)
      return Promise.resolve()
    },
  }

  protectNavigation(contents as never, (url) => opened.push(url), dev)

  return {
    opened,
    navigated,
    navigate(event: "will-frame-navigate" | "will-redirect", url: string, isMainFrame = true) {
      let prevented = false
      listeners.get(event)?.({
        url,
        isMainFrame,
        preventDefault: () => {
          prevented = true
        },
      })
      return prevented
    },
    popup(url: string) {
      if (!popup) throw new Error("window open handler was not registered")
      return popup({ url })
    },
  }
}

type Frame = {
  url: string
  processId: number
  routingId: number
  detached: boolean
  isDestroyed: () => boolean
}

function sender(url = "oc://renderer/index.html", processId = 1) {
  let destroyed = false
  let dispose = () => undefined
  const frame: Frame = {
    url,
    processId,
    routingId: 1,
    detached: false,
    isDestroyed: () => false,
  }
  const contents = {
    mainFrame: frame,
    isDestroyed: () => destroyed,
    once(event: string, listener: () => void) {
      if (event === "destroyed") dispose = listener
      return contents
    },
  }
  return {
    contents,
    frame,
    destroy() {
      destroyed = true
      dispose()
    },
  }
}

function event(sender: ReturnType<typeof sender>, frame: Frame | null = sender.frame) {
  return { sender: sender.contents, senderFrame: frame }
}

function ipc() {
  const handlers = new Map<string, (event: unknown, ...args: unknown[]) => unknown>()
  const listeners = new Map<string, (event: unknown, ...args: unknown[]) => void>()
  return {
    handlers,
    listeners,
    main: {
      handle(channel: string, listener: (event: unknown, ...args: unknown[]) => unknown) {
        handlers.set(channel, listener)
      },
      on(channel: string, listener: (event: unknown, ...args: unknown[]) => void) {
        listeners.set(channel, listener)
        return this
      },
    },
  }
}

describe("desktop renderer trust", () => {
  test("allows only the production renderer origin or exact configured development origin", () => {
    expect(isTrustedRendererUrl("oc://renderer/index.html")).toBe(true)
    expect(isTrustedRendererUrl("oc://renderer/settings?q=1#general")).toBe(true)
    expect(isTrustedRendererUrl("oc://renderer.evil/index.html")).toBe(false)
    expect(isTrustedRendererUrl("oc://renderer:444/index.html")).toBe(false)
    expect(isTrustedRendererUrl("oc://user@renderer/index.html")).toBe(false)

    const dev = "http://localhost:5173/app/"
    expect(isTrustedRendererUrl("http://localhost:5173/index.html", dev)).toBe(true)
    expect(isTrustedRendererUrl("http://localhost:5174/index.html", dev)).toBe(false)
    expect(isTrustedRendererUrl("https://localhost:5173/index.html", dev)).toBe(false)
    expect(isTrustedRendererUrl("file:///tmp/index.html", "file:///tmp/")).toBe(false)
  })
})

describe("privileged window navigation", () => {
  test("allows trusted renderer navigation", () => {
    const boundary = navigation()

    expect(boundary.navigate("will-frame-navigate", "oc://renderer/settings")).toBe(false)
    expect(boundary.opened).toEqual([])
  })

  test("allows navigation on the configured development renderer origin", () => {
    const boundary = navigation("http://localhost:5173")

    expect(boundary.navigate("will-frame-navigate", "http://localhost:5173/settings")).toBe(false)
    expect(boundary.navigate("will-frame-navigate", "http://localhost:5174/settings")).toBe(true)
  })

  test("prevents a raw Markdown same-frame web navigation and opens it externally", () => {
    const boundary = navigation()

    expect(boundary.navigate("will-frame-navigate", "https://attacker.example/phish")).toBe(true)
    expect(boundary.opened).toEqual(["https://attacker.example/phish"])
  })

  test("prevents untrusted subframe navigation without opening it externally", () => {
    const boundary = navigation()

    expect(boundary.navigate("will-frame-navigate", "https://attacker.example/frame", false)).toBe(true)
    expect(boundary.opened).toEqual([])
  })

  test("prevents untrusted redirects without treating them as intentional external links", () => {
    const boundary = navigation()

    expect(boundary.navigate("will-redirect", "https://attacker.example/redirect")).toBe(true)
    expect(boundary.opened).toEqual([])
  })

  test("denies new windows while sending safe web targets to the system browser", () => {
    const boundary = navigation()

    expect(boundary.popup("https://example.com/docs")).toEqual({ action: "deny" })
    expect(boundary.opened).toEqual(["https://example.com/docs"])
    expect(boundary.navigated).toEqual([])
  })

  test("routes a trusted production target-blank popup through the existing window", () => {
    const boundary = navigation()

    expect(boundary.popup("oc://renderer/settings")).toEqual({ action: "deny" })
    expect(boundary.navigated).toEqual(["oc://renderer/settings"])
    expect(boundary.opened).toEqual([])
  })

  test("routes a trusted development target-blank popup through the existing window", () => {
    const boundary = navigation("http://localhost:5173")

    expect(boundary.popup("http://localhost:5173/settings")).toEqual({ action: "deny" })
    expect(boundary.navigated).toEqual(["http://localhost:5173/settings"])
    expect(boundary.opened).toEqual([])
  })

  test("rejects file, script, data, and custom scheme navigation", () => {
    for (const url of [
      "file:///tmp/secret",
      "javascript:alert(document.domain)",
      "data:text/html,hostile",
      "shell:open",
      "slopcode://session/secret",
    ]) {
      const boundary = navigation()
      expect(boundary.navigate("will-frame-navigate", url)).toBe(true)
      expect(boundary.popup(url)).toEqual({ action: "deny" })
      expect(boundary.opened).toEqual([])
      expect(boundary.navigated).toEqual([])
    }
  })
})

describe("desktop sidecar CORS", () => {
  test("configures exact production and development renderer origins", () => {
    const cors = { cors: rendererCorsOrigins("https://desktop-dev.example/app/") }

    expect(rendererCorsOrigins()).toEqual(["oc://renderer"])
    expect(rendererCorsOrigins("file:///tmp/renderer")).toEqual(["oc://renderer"])
    expect(cors.cors).toEqual(["oc://renderer", "https://desktop-dev.example"])
    expect(isAllowedCorsOrigin("oc://renderer", cors)).toBe(true)
    expect(isAllowedCorsOrigin("https://desktop-dev.example", cors)).toBe(true)
    expect(isAllowedCorsOrigin("oc://renderer.attacker", cors)).toBe(false)
    expect(isAllowedCorsOrigin("https://attacker.example", cors)).toBe(false)
    expect(cors.cors).not.toContain("*")
  })
})

describe("desktop IPC authorization", () => {
  test("accepts registered live main frames, including multiple windows", () => {
    const authorization = createIpcAuthorization()
    const first = sender()
    const second = sender("oc://renderer/index.html", 2)
    authorization.add(first.contents as never)
    authorization.add(second.contents as never)

    expect(authorization.allows(event(first) as never)).toBe(true)
    expect(authorization.allows(event(second) as never)).toBe(true)
  })

  test("accepts IPC only from the configured development renderer origin", () => {
    const authorization = createIpcAuthorization()
    authorization.configure("http://localhost:5173")
    const trusted = sender("http://localhost:5173/index.html")
    const hostile = sender("http://localhost:5174/index.html", 2)
    authorization.add(trusted.contents as never)
    authorization.add(hostile.contents as never)

    expect(authorization.allows(event(trusted) as never)).toBe(true)
    expect(authorization.allows(event(hostile) as never)).toBe(false)
  })

  test("rejects unregistered, destroyed, untrusted main-frame, and subframe senders", () => {
    const authorization = createIpcAuthorization()
    const unregistered = sender()
    expect(authorization.allows(event(unregistered) as never)).toBe(false)

    const destroyed = sender()
    authorization.add(destroyed.contents as never)
    destroyed.destroy()
    expect(authorization.allows(event(destroyed) as never)).toBe(false)

    const hostile = sender("https://attacker.example/")
    authorization.add(hostile.contents as never)
    expect(authorization.allows(event(hostile) as never)).toBe(false)

    const nested = sender()
    authorization.add(nested.contents as never)
    expect(
      authorization.allows(
        event(nested, {
          ...nested.frame,
          url: "oc://renderer/frame.html",
          routingId: 2,
        }) as never,
      ),
    ).toBe(false)
    expect(authorization.allows(event(nested, null) as never)).toBe(false)
  })

  test("rejects before sidecar credentials can be retrieved by an untrusted sender", () => {
    const authorization = createIpcAuthorization()
    const trusted = sender()
    const hostile = sender("https://attacker.example/")
    authorization.add(trusted.contents as never)
    authorization.add(hostile.contents as never)
    const raw = ipc()
    const guarded = guardIpc(raw.main as never, authorization)
    const credentials = { url: "http://127.0.0.1:1234", username: "slopcode", password: "secret" }
    let invoked = 0
    guarded.handle("await-initialization", () => {
      invoked++
      return credentials
    })
    const handle = raw.handlers.get("await-initialization")!

    expect(() => handle(event(hostile))).toThrow("Unauthorized IPC sender")
    expect(invoked).toBe(0)
    expect(handle(event(trusted))).toEqual(credentials)
    expect(invoked).toBe(1)
  })

  test("drops untrusted send events before invoking their listeners", () => {
    const authorization = createIpcAuthorization()
    const trusted = sender()
    const hostile = sender("https://attacker.example/")
    authorization.add(trusted.contents as never)
    authorization.add(hostile.contents as never)
    const raw = ipc()
    const guarded = guardIpc(raw.main as never, authorization)
    const opened: string[] = []
    guarded.on("open-link", (_event, url: string) => opened.push(url))
    const listener = raw.listeners.get("open-link")!

    listener(event(hostile), "https://attacker.example/")
    expect(opened).toEqual([])
    listener(event(trusted), "https://example.com/")
    expect(opened).toEqual(["https://example.com/"])
  })
})
