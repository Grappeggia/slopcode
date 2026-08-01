import { describe, expect, test } from "bun:test"
import {
  canOpenExternalUrl,
  detectAndroidCapabilities,
  getAndroidBridge,
  parsePermission,
  parseStringArray,
} from "./bridge"

function port(handler: (request: { id: string; method: string; args?: unknown[] }) => unknown) {
  return {
    onmessage: null as null | ((event: { data?: string }) => void),
    postMessage(message: string) {
      const request = JSON.parse(message) as { id: string; method: string; args?: unknown[] }
      const result = handler(request)
      this.onmessage?.({
        data: JSON.stringify({
          id: request.id,
          ok: true,
          result,
        }),
      })
    },
  }
}

describe("android bridge capability detection", () => {
  test("detects implemented boundaries from the RPC bridge", async () => {
    const bridge = getAndroidBridge({
      SlopcodeAndroid: port((request) => {
        if (request.method === "capabilities") {
          return {
            secureStorage: true,
            qrPairing: false,
            notifications: true,
            deepLinks: true,
            remoteTransport: true,
          }
        }
        return null
      }),
    })

    await expect(detectAndroidCapabilities(bridge)).resolves.toEqual({
      secureStorage: true,
      qrPairing: false,
      notifications: true,
      deepLinks: true,
      remoteTransport: true,
    })
  })

  test("falls back cleanly when the bridge is unavailable", async () => {
    await expect(detectAndroidCapabilities()).resolves.toEqual({
      secureStorage: false,
      qrPairing: false,
      notifications: false,
      deepLinks: false,
      remoteTransport: false,
    })
  })
})

describe("android bridge parsing helpers", () => {
  test("reads string arrays safely", () => {
    expect(parseStringArray('["one","two",3]')).toEqual(["one", "two"])
    expect(parseStringArray(["one", "two", 3])).toEqual(["one", "two"])
    expect(parseStringArray("oops")).toEqual([])
  })

  test("normalizes notification permission values", () => {
    expect(parsePermission("granted")).toBe("granted")
    expect(parsePermission("denied")).toBe("denied")
    expect(parsePermission("wat")).toBe("prompt")
  })

  test("only allows safe external link schemes", () => {
    expect(canOpenExternalUrl("https://slopcode.dev")).toBeTrue()
    expect(canOpenExternalUrl("mailto:team@slopcode.dev")).toBeTrue()
    expect(canOpenExternalUrl("javascript:alert(1)")).toBeFalse()
    expect(canOpenExternalUrl("http://remote.example.test")).toBeFalse()
  })
})
