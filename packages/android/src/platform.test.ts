import { describe, expect, test } from "bun:test"
import type { AndroidNativeBridge, NotificationPermission } from "./bridge"
import { appStorage, persistRemoteWorkspace, readInitialWorkspaceState, shellBridge } from "./platform"

function native(permission: NotificationPermission = "granted", result: NotificationPermission = permission) {
  const values = new Map<string, string>()
  const calls: string[] = []
  const key = (namespace: string, name: string) => `${namespace}:${name}`
  const bridge = {
    capabilities: async () => ({
      secureStorage: true,
      qrPairing: false,
      notifications: true,
      deepLinks: true,
      remoteTransport: false,
    }),
    storageGet: async (namespace: string, name: string) => values.get(key(namespace, name)) ?? null,
    storageSet: async (namespace: string, name: string, value: string) => {
      values.set(key(namespace, name), value)
    },
    storageRemove: async (namespace: string, name: string) => {
      values.delete(key(namespace, name))
    },
    storageClear: async (namespace: string) => {
      for (const item of values.keys()) if (item.startsWith(`${namespace}:`)) values.delete(item)
    },
    storageKeys: async (namespace: string) =>
      [...values.keys()]
        .filter((item) => item.startsWith(`${namespace}:`))
        .map((item) => item.slice(namespace.length + 1)),
    storageLength: async (namespace: string) =>
      [...values.keys()].filter((item) => item.startsWith(`${namespace}:`)).length,
    scanQrPairing: async () => null,
    notificationPermission: async () => {
      calls.push("permission")
      return permission
    },
    requestNotificationPermission: async () => {
      calls.push("request")
      return result
    },
    showNotification: async () => {
      calls.push("show")
    },
    consumeDeepLinks: async () => [],
    remoteSend: async () => {
      calls.push("remote")
      return "ok"
    },
    openLink: async () => false,
  } satisfies AndroidNativeBridge
  return { bridge, calls, values }
}

describe("android notification use", () => {
  test("requests on first use and shows only after grant", async () => {
    const fake = native("prompt", "granted")
    const shell = await shellBridge(fake.bridge)

    await shell.notify("Title", "Description")

    expect(fake.calls).toEqual(["permission", "request", "show"])
  })

  test("does not request after denial and does not show after dismissal", async () => {
    const denied = native("denied", "granted")
    const deniedShell = await shellBridge(denied.bridge)
    await deniedShell.notify("Title")
    expect(denied.calls).toEqual(["permission"])

    const dismissed = native("prompt", "prompt")
    const dismissedShell = await shellBridge(dismissed.bridge)
    await dismissedShell.notify("Title")
    expect(dismissed.calls).toEqual(["permission", "request"])
  })
})

describe("android storage boundaries", () => {
  test("uses native storage when the bridge exists", async () => {
    const fake = native()
    const storage = appStorage(fake.bridge)()

    await storage.setItem("theme", "dark")

    expect(await storage.getItem("theme")).toBe("dark")
    expect(fake.values.size).toBe(1)
  })

  test("uses volatile storage without a bridge and never persists remote state", async () => {
    const storage = appStorage(null)()
    await storage.setItem("theme", "dark")
    expect(await storage.getItem("theme")).toBe("dark")
    expect(await appStorage(null)().getItem("theme")).toBeNull()

    await expect(
      persistRemoteWorkspace(
        { version: 1, serverUrl: "https://remote.example.test" },
        { password: "secret" },
        null,
      ),
    ).rejects.toThrow("secure storage")
    await expect(readInitialWorkspaceState(null)).resolves.toEqual({ state: { version: 1 } })
  })
})

test("does not expose remote transport when native configuration is absent", async () => {
  const fake = native()
  const shell = await shellBridge(fake.bridge)

  expect(shell.capabilities.remoteTransport).toBeFalse()
  expect(shell.remoteSend).toBeUndefined()
  expect(fake.calls).not.toContain("remote")
})
