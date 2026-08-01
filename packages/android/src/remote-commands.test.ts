import { describe, expect, test } from "bun:test"
import { bakedRemoteCommandCatalog, fetchRemoteAgentCatalog, mergeRemoteCommandCatalog } from "./remote-commands"

describe("Android remote command catalogs", () => {
  test("bakes command surfaces for each remote harness", () => {
    expect(bakedRemoteCommandCatalog("local-slopcode").commands.map((item) => item.name)).toEqual(["init", "review"])
    expect(bakedRemoteCommandCatalog("codex-cli").commands.map((item) => item.name)).toContain("status")
    expect(bakedRemoteCommandCatalog("opencode-cli").commands.map((item) => item.name)).toContain("undo")
    expect(bakedRemoteCommandCatalog("claude-code").commands.map((item) => item.name)).toContain("compact")
  })

  test("lets remote metadata override baked command entries", () => {
    const catalog = mergeRemoteCommandCatalog("opencode-cli", "1.2.3", [
      { name: "init", description: "remote init" },
      { name: "deploy", description: "ship it" },
    ])
    expect(catalog.version).toBe("1.2.3")
    expect(catalog.commands.find((item) => item.name === "init")?.description).toBe("remote init")
    expect(catalog.commands.map((item) => item.name)).toContain("deploy")
  })

  test("fetches an authenticated CLI catalog with version and path scope", async () => {
    let request: { url: string; init?: RequestInit } | undefined
    const catalog = await fetchRemoteAgentCatalog(
      {
        serverUrl: "https://desktop.example.test",
        username: "slopcode",
        password: "secret",
        workspaceID: "wrk_remote_mac",
        directory: "/Users/marcos/Projects/slopcode",
        agent: "claude-code",
      },
      async (url, init) => {
        request = { url: String(url), init }
        return Response.json({
          agent: "claude-code",
          version: "2.1.0",
          commands: [{ name: "review", description: "review changes" }, { name: "project:check" }],
        })
      },
    )

    const url = new URL(request!.url)
    expect(url.pathname).toBe("/remote/agent/catalog")
    expect(url.searchParams.get("workspace")).toBe("wrk_remote_mac")
    expect(url.searchParams.get("path")).toBe("/Users/marcos/Projects/slopcode")
    expect(url.searchParams.get("agent")).toBe("claude-code")
    expect(new Headers(request!.init?.headers).get("authorization")).toBe("Basic c2xvcGNvZGU6c2VjcmV0")
    expect(catalog.version).toBe("2.1.0")
    expect(catalog.commands.map((item) => item.name)).toContain("project:check")
  })

  test("rejects malformed or oversized catalog responses", async () => {
    const input = {
      serverUrl: "https://desktop.example.test",
      username: "slopcode",
      password: "secret",
      workspaceID: "wrk_remote_mac",
      directory: "/Users/marcos/Projects/slopcode",
      agent: "codex-cli" as const,
    }
    await expect(
      fetchRemoteAgentCatalog(input, async () => Response.json({ agent: "opencode-cli", version: "1", commands: [] })),
    ).rejects.toThrow("invalid response")

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(256 * 1024))
        controller.enqueue(new Uint8Array(1))
        controller.close()
      },
    })
    await expect(fetchRemoteAgentCatalog(input, async () => new Response(stream))).rejects.toThrow("exceeded")
  })
})
