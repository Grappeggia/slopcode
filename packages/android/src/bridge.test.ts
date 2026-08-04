import { describe, expect, test } from "bun:test"
import {
  canOpenExternalUrl,
  detectAndroidCapabilities,
  getAndroidBridge,
  parseDeepLinkMessage,
  parsePermission,
  parseSupportedDeepLinks,
  parseStringArray,
  sshTransportBridge,
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
            backgroundExecution: true,
            remoteJobs: true,
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
      backgroundExecution: true,
      remoteJobs: true,
    })
  })

  test("falls back cleanly when the bridge is unavailable", async () => {
    await expect(detectAndroidCapabilities()).resolves.toEqual({
      secureStorage: false,
      qrPairing: false,
      notifications: false,
      deepLinks: false,
      remoteTransport: false,
      backgroundExecution: false,
      remoteJobs: false,
    })
  })
})

describe("android bridge parsing helpers", () => {
  test("selects and returns the native canonical SSH workspace", async () => {
    const calls: Array<{ method: string; args?: unknown[] }> = []
    const bridge = getAndroidBridge({
      SlopcodeAndroid: port((request) => {
        calls.push({ method: request.method, args: request.args })
        if (request.method === "sshSelectWorkspace") return { path: "/srv/canonical-project" }
        return true
      }),
    })
    const ssh = sshTransportBridge(bridge)
    expect(ssh).toBeDefined()
    await expect(ssh!.selectWorkspace("/srv/project-link")).resolves.toBe("/srv/canonical-project")
    expect(calls).toContainEqual({ method: "sshSelectWorkspace", args: ["/srv/project-link"] })
  })

  test("exposes strict native orchestrator prerequisite RPCs", async () => {
    const calls: Array<{ method: string; args?: unknown[] }> = []
    const bridge = getAndroidBridge({
      SlopcodeAndroid: port((request) => {
        calls.push({ method: request.method, args: request.args })
        if (request.method === "sshOrchestratorPreflight")
          return { executable: "slopcode", version: "1.2.3", ok: true, exitCode: 0, error: null }
        if (request.method === "sshOrchestratorInstall")
          return {
            executable: "slopcode",
            package: "slopcode@latest",
            operation: "install_or_upgrade",
            ok: true,
            exitCode: 0,
            error: null,
          }
        return true
      }),
    })
    const ssh = sshTransportBridge(bridge)!
    await expect(ssh.orchestratorPreflight!("/home/marcos/temp")).resolves.toMatchObject({ ok: true, version: "1.2.3" })
    await expect(ssh.orchestratorInstall!("/home/marcos/temp")).resolves.toMatchObject({
      ok: true,
      package: "slopcode@latest",
    })
    expect(calls.filter((item) => item.method.startsWith("sshOrchestrator"))).toEqual([
      { method: "sshOrchestratorPreflight", args: ['{"directory":"/home/marcos/temp"}'] },
      { method: "sshOrchestratorInstall", args: ['{"directory":"/home/marcos/temp"}'] },
    ])
  })

  test("reads string arrays safely", () => {
    expect(parseStringArray('["one","two",3]')).toEqual(["one", "two"])
    expect(parseStringArray(["one", "two", 3])).toEqual(["one", "two"])
    expect(parseStringArray("oops")).toEqual([])
  })

  test("accepts only bounded structured Slopcode deep links", () => {
    const nonce = "0123456789abcdef"
    expect(parseSupportedDeepLinks(["slopcode://open-project?directory=%2Fa", "https://evil.example"])).toEqual([
      "slopcode://open-project?directory=%2Fa",
    ])
    expect(parseSupportedDeepLinks(["slopcode://open-project?directory=/a&token=secret"])).toEqual([])
    expect(
      parseDeepLinkMessage(
        JSON.stringify({
          type: "slopcode.deep-links",
          channel: "slopcode.android.deep-links",
          nonce,
          ready: true,
          urls: ["slopcode://new-session?directory=/a&prompt=hi"],
        }),
        nonce,
      ),
    ).toEqual(["slopcode://new-session?directory=/a&prompt=hi"])
    expect(
      parseDeepLinkMessage(JSON.stringify({ type: "other", urls: ["slopcode://open-project?directory=/a"] }), nonce),
    ).toEqual([])
    expect(
      parseDeepLinkMessage(
        JSON.stringify({
          type: "slopcode.deep-links",
          channel: "slopcode.android.deep-links",
          nonce: "wrong",
          ready: true,
          urls: ["slopcode://open-project?directory=/a"],
        }),
        nonce,
      ),
    ).toEqual([])
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
