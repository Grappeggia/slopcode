import { describe, expect, test } from "bun:test"
import { detectAndroidCapabilities, parsePermission, parseStringArray } from "./bridge"

describe("android bridge capability detection", () => {
  test("detects implemented boundaries from bridge methods", () => {
    const capabilities = detectAndroidCapabilities({
      storageGet: () => null,
      storageSet: () => undefined,
      storageRemove: () => undefined,
      notificationPermission: () => "granted",
      showNotification: () => undefined,
      consumeDeepLinks: () => "[]",
      remoteSend: () => "{}",
    })

    expect(capabilities).toEqual({
      secureStorage: true,
      qrPairing: false,
      notifications: true,
      deepLinks: true,
      remoteTransport: true,
    })
  })

  test("prefers explicit native capability flags for optional features", () => {
    const capabilities = detectAndroidCapabilities({
      scanQrPairing: () => null,
      remoteSend: () => "{}",
      capabilities: () =>
        JSON.stringify({
          secureStorage: true,
          qrPairing: false,
          notifications: true,
          deepLinks: true,
          remoteTransport: false,
        }),
    })

    expect(capabilities.qrPairing).toBeFalse()
    expect(capabilities.remoteTransport).toBeFalse()
    expect(capabilities.secureStorage).toBeTrue()
  })
})

describe("android bridge parsing helpers", () => {
  test("reads string arrays safely", () => {
    expect(parseStringArray('["one","two",3]')).toEqual(["one", "two"])
    expect(parseStringArray("oops")).toEqual([])
  })

  test("normalizes notification permission values", () => {
    expect(parsePermission("granted")).toBe("granted")
    expect(parsePermission("denied")).toBe("denied")
    expect(parsePermission("wat")).toBe("prompt")
  })
})
