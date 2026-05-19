import { describe, expect, test } from "bun:test"
import path from "path"
import { decode, encode } from "@/cli/cmd/tui/android-host/protocol"
import { probe, sidecar, wanted } from "@/cli/cmd/tui/android-host/probe"
import { frame } from "@/cli/cmd/tui/android-host/sidecar"

describe("Android host", () => {
  test("encodes and validates the IPC protocol", () => {
    const item = frame({ width: 80, height: 24, text: "SlopCode\nAndroid" })

    expect(decode(encode(item))).toEqual(item)
    expect(decode("{")).toBeUndefined()
    expect(decode(JSON.stringify({ version: 1, type: "frame" }))).toBeUndefined()
  })

  test("selects Android host modes explicitly", () => {
    expect(wanted("")).toBeUndefined()
    expect(wanted("0")).toBeUndefined()
    expect(wanted("false")).toBeUndefined()
    expect(wanted("sidecar")).toBe("sidecar")
    expect(wanted("1")).toBe("opentui")
    expect(sidecar({ root: "/tmp/slopcode" })).toBe(path.join("/tmp/slopcode", "bin", "slopcode-android-host"))
  })

  test("probes OpenTUI and sidecar availability", async () => {
    const fs = {
      existsSync: (file: Parameters<typeof import("fs").existsSync>[0]) =>
        String(file).endsWith("slopcode-android-host"),
    }

    expect(await probe({ platform: "linux", host: "1", importer: async () => ({}) })).toMatchObject({
      enabled: false,
      strategy: "fallback",
      reason: "not-android",
    })
    expect(await probe({ platform: "android" })).toMatchObject({
      enabled: false,
      strategy: "fallback",
      reason: "android-host-disabled",
    })
    expect(await probe({ platform: "android", host: "1", importer: async () => ({}) })).toMatchObject({
      enabled: true,
      available: true,
      strategy: "opentui",
      reason: "opentui-ready",
    })
    expect(
      await probe({
        platform: "android",
        host: "1",
        importer: async () => {
          throw new Error("bun:ffi unavailable")
        },
      }),
    ).toMatchObject({
      enabled: true,
      available: false,
      strategy: "fallback",
      reason: "bun:ffi unavailable",
    })
    expect(await probe({ platform: "android", host: "sidecar", root: "/tmp/slopcode", fs })).toMatchObject({
      enabled: true,
      available: true,
      strategy: "sidecar",
      reason: "sidecar-ready",
    })
  })
})
