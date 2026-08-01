import { describe, expect, test } from "bun:test"
import { parseRemoteAgentResult, promptCodexCli, promptOpencodeCli, promptRemoteAgent } from "./codex-cli"

const input = {
  serverUrl: "https://desktop.example.test/",
  username: "slopcode",
  password: "desktop-secret",
  workspaceID: "wrk_remote_mac",
  directory: "/Users/marcos/Projects/slopcode",
  prompt: "Run the tests and summarize failures.",
}

describe("Android remote agent session", () => {
  test("posts the exact Codex payload and workspace query", async () => {
    let request: { url: string; init?: RequestInit } | undefined
    const result = await promptCodexCli(input, async (url, init) => {
      request = { url: String(url), init }
      return Response.json({ output: "All tests passed.", status: "completed", exitCode: 0 })
    })

    expect(result).toEqual({ output: "All tests passed.", status: "completed", exitCode: 0 })
    const endpoint = new URL(request!.url)
    expect(endpoint.pathname).toBe("/remote/agent/prompt")
    expect(endpoint.searchParams.get("workspace")).toBe("wrk_remote_mac")
    expect(request?.init?.method).toBe("POST")
    expect(request?.init?.redirect).toBe("error")
    expect(request?.init?.credentials).toBe("omit")
    const headers = new Headers(request?.init?.headers)
    expect(headers.get("authorization")).toBe("Basic c2xvcGNvZGU6ZGVza3RvcC1zZWNyZXQ=")
    expect(headers.get("content-type")).toBe("application/json")
    expect(headers.get("x-slopcode-workspace")).toBeNull()
    expect(headers.get("x-slopcode-directory")).toBeNull()
    const body = JSON.parse(String(request?.init?.body)) as Record<string, unknown>
    expect(body).toEqual({ agent: "codex-cli", prompt: input.prompt })
    expect(body).not.toHaveProperty("workspaceID")
    expect(body).not.toHaveProperty("remoteDirectory")
    expect(body).not.toHaveProperty("command")
    expect(body).not.toHaveProperty("argv")
    expect(body).not.toHaveProperty("env")
  })

  test("posts OpenCode with only the allowlisted optional config", async () => {
    let request: { url: string; init?: RequestInit } | undefined
    await promptRemoteAgent(
      {
        ...input,
        agent: "opencode-cli",
        config: { model: "gpt-5", profile: "safe-profile", sandbox: "workspace-write", approval: "on-request" },
      },
      async (url, init) => {
        request = { url: String(url), init }
        return Response.json({ output: "OpenCode finished.", status: "timed_out" })
      },
    )

    const endpoint = new URL(request!.url)
    expect(endpoint.pathname).toBe("/remote/agent/prompt")
    expect(endpoint.searchParams.get("workspace")).toBe(input.workspaceID)
    expect(JSON.parse(String(request?.init?.body))).toEqual({
      agent: "opencode-cli",
      prompt: input.prompt,
      config: { model: "gpt-5", profile: "safe-profile", sandbox: "workspace-write", approval: "on-request" },
    })
  })

  test("accepts only the bounded server result shape", () => {
    expect(parseRemoteAgentResult({ output: "ok", status: "timed_out" })).toEqual({ output: "ok", status: "timed_out" })
    expect(parseRemoteAgentResult({ output: "ok", status: "failed", exitCode: 7 })).toEqual({
      output: "ok",
      status: "failed",
      exitCode: 7,
    })
    expect(parseRemoteAgentResult({ output: "ok", status: "completed", metadata: {} })).toBeUndefined()
    expect(parseRemoteAgentResult({ output: "ok", status: "completed", extra: true })).toBeUndefined()
    expect(parseRemoteAgentResult({ output: "ok", status: "running" })).toBeUndefined()
    expect(parseRemoteAgentResult({ output: "ok", status: "completed", exitCode: 1.5 })).toBeUndefined()
    expect(parseRemoteAgentResult({ output: "ok", status: "completed", exitCode: "0" })).toBeUndefined()
    expect(parseRemoteAgentResult({ output: "x".repeat(64 * 1024 + 1), status: "completed" })).toBeUndefined()
  })

  test("rejects invalid workspace paths, agents, config, and prompt bounds before network access", async () => {
    let calls = 0
    const fetcher = async () => {
      calls += 1
      return Response.json({ output: "never", status: "completed" })
    }
    await expect(promptCodexCli({ ...input, directory: "/Users/../private" }, fetcher)).rejects.toThrow("workspace")
    await expect(promptRemoteAgent({ ...input, agent: "invalid-agent" as never }, fetcher)).rejects.toThrow("workspace")
    await expect(promptRemoteAgent({ ...input, agent: "opencode-cli", config: { command: "sh" } as never }, fetcher)).rejects.toThrow("configuration")
    await expect(promptCodexCli({ ...input, prompt: "x".repeat(32 * 1024 + 1) }, fetcher)).rejects.toThrow("workspace")
    expect(calls).toBe(0)
  })

  test("caps streamed responses", async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(128 * 1024))
        controller.enqueue(new Uint8Array(1))
        controller.close()
      },
    })
    await expect(promptCodexCli(input, async () => new Response(stream, { status: 200 }))).rejects.toThrow("exceeded")
  })

  test("keeps the OpenCode convenience wrapper bound to its agent", async () => {
    let body = ""
    await promptOpencodeCli(input, async (_url, init) => {
      body = String(init?.body)
      return Response.json({ output: "ok", status: "completed" })
    })
    expect(JSON.parse(body)).toMatchObject({ agent: "opencode-cli", prompt: input.prompt })
  })
})
