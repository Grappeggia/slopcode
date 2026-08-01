import { AppProcess } from "@slopcode-ai/core/process"
import { Context, Effect, Layer } from "effect"
import { describe, expect, test, afterEach } from "bun:test"
import { mkdir, symlink, writeFile } from "node:fs/promises"
import path from "node:path"
import { HttpApiApp } from "../../src/server/routes/instance/httpapi/server"
import {
  MAX_CODEX_PROMPT_LENGTH,
  MAX_CODEX_OUTPUT_BYTES,
  MAX_REMOTE_ENTRIES,
  RemoteRuntimePaths,
} from "../../src/server/routes/instance/httpapi/groups/remote-runtime"
import { buildAgentCommand, resolveRemoteFolder, runAgentPrompt } from "../../src/server/routes/instance/httpapi/handlers/remote-runtime"
import { workspaceProxyURL } from "../../src/server/shared/workspace-routing"
import { resetDatabase } from "../fixture/db"
import { disposeAllInstances, tmpdir } from "../fixture/fixture"

const context = Context.empty() as Context.Context<unknown>

function request(
  route: string,
  directory: string,
  query: Record<string, string>,
  init?: { method?: string; body?: string },
) {
  const url = new URL(`http://localhost${route}`)
  for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value)
  return HttpApiApp.webHandler().handler(
    new Request(url, {
      method: init?.method,
      body: init?.body,
      headers: {
        "x-slopcode-directory": directory,
        ...(init?.body ? { "content-type": "application/json" } : {}),
      },
    }),
    context,
  )
}

function processResult(input: Partial<AppProcess.RunResult> = {}): AppProcess.RunResult {
  return {
    command: "codex exec",
    exitCode: 0,
    stdout: Buffer.alloc(0),
    stderr: Buffer.alloc(0),
    stdoutTruncated: false,
    stderrTruncated: false,
    ...input,
  }
}

afterEach(async () => {
  await disposeAllInstances()
  await resetDatabase()
})

describe("remote runtime HttpApi", () => {
  test("browses only metadata with directories first and a bounded entry count", async () => {
    await using tmp = await tmpdir({ config: { formatter: false, lsp: false } })
    await mkdir(path.join(tmp.path, "z-directory"))
    await mkdir(path.join(tmp.path, "a-directory"))
    await writeFile(path.join(tmp.path, "readme.txt"), "not returned")
    await Promise.all(
      Array.from({ length: MAX_REMOTE_ENTRIES + 25 }, (_, index) =>
        writeFile(path.join(tmp.path, `file-${String(index).padStart(3, "0")}.txt`), "content"),
      ),
    )

    const response = await request(RemoteRuntimePaths.browse, tmp.path, { path: tmp.path })
    expect(response.status).toBe(200)
    const body = await response.json()

    expect(body.root).toBe(tmp.path)
    expect(body.current).toBe(tmp.path)
    expect(body.parent).toBeUndefined()
    expect(body.entries).toHaveLength(MAX_REMOTE_ENTRIES)
    expect(body.entries.slice(0, 2).map((entry: { type: string }) => entry.type)).toEqual(["directory", "directory"])
    expect(body.entries.slice(0, 2).map((entry: { name: string }) => entry.name)).toEqual([
      "a-directory",
      "z-directory",
    ])
    expect(
      body.entries.every((entry: Record<string, unknown>) => Object.keys(entry).sort().join(",") === "name,path,type"),
    ).toBe(true)
    expect(JSON.stringify(body)).not.toContain("not returned")
  })

  test("starts at the authenticated instance directory when path is omitted", async () => {
    await using tmp = await tmpdir({ config: { formatter: false, lsp: false } })
    await mkdir(path.join(tmp.path, "src"))

    const response = await request(RemoteRuntimePaths.browse, tmp.path, {})
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.root).toBe(tmp.path)
    expect(body.current).toBe(tmp.path)
    expect(body.entries).toContainEqual({
      name: "src",
      path: path.join(tmp.path, "src"),
      type: "directory",
    })
  })

  test("rejects traversal, file paths, and symlink escapes", async () => {
    await using tmp = await tmpdir({ config: { formatter: false, lsp: false } })
    await using outside = await tmpdir({ config: { formatter: false, lsp: false } })
    await writeFile(path.join(tmp.path, "file.txt"), "file")
    await writeFile(path.join(outside.path, "secret.txt"), "secret contents")
    if (process.platform !== "win32") await symlink(outside.path, path.join(tmp.path, "escape"))

    const traversal = await request(RemoteRuntimePaths.browse, tmp.path, {
      path: path.posix.join(tmp.path, ".."),
    })
    const file = await request(RemoteRuntimePaths.browse, tmp.path, {
      path: path.posix.join(tmp.path, "missing.txt"),
    })
    const existingFile = await request(RemoteRuntimePaths.browse, tmp.path, {
      path: path.posix.join(tmp.path, "file.txt"),
    })
    expect(traversal.status).toBe(403)
    expect(file.status).toBe(404)
    expect(existingFile.status).toBe(404)

    if (process.platform !== "win32") {
      const symlinkPath = await request(RemoteRuntimePaths.browse, tmp.path, {
        path: path.posix.join(tmp.path, "escape"),
      })
      const listing = await request(RemoteRuntimePaths.browse, tmp.path, { path: tmp.path })
      expect(symlinkPath.status).toBe(403)
      expect((await listing.json()).entries).not.toContainEqual(expect.objectContaining({ name: "escape" }))
    }
  })

  test("requires an absolute POSIX browse path", async () => {
    await using tmp = await tmpdir({ config: { formatter: false, lsp: false } })
    const response = await request(RemoteRuntimePaths.browse, tmp.path, { path: "relative/path" })
    expect(response.status).toBe(400)
  })

  test("rejects an oversized prompt at the authenticated instance route", async () => {
    await using tmp = await tmpdir({ config: { formatter: false, lsp: false } })
    const response = await request(
      RemoteRuntimePaths.prompt,
      tmp.path,
      {},
      {
        method: "POST",
        body: JSON.stringify({ agent: "codex-cli", prompt: "x".repeat(MAX_CODEX_PROMPT_LENGTH + 1) }),
      },
    )
    const nul = await request(
      RemoteRuntimePaths.prompt,
      tmp.path,
      {},
      {
        method: "POST",
        body: JSON.stringify({ agent: "codex-cli", prompt: "safe\0unsafe" }),
      },
    )
    expect(response.status).toBe(400)
    expect(nul.status).toBe(400)
  })

  test("preserves the selected path while workspace routing removes only selectors", () => {
    const result = workspaceProxyURL(
      "https://remote.example/base",
      new URL("http://local.example/remote/ssh/browse?workspace=ws_1&directory=%2Froot&path=%2Froot%2Fsrc"),
    )

    expect(result.pathname).toBe("/base/remote/ssh/browse")
    expect(result.searchParams.get("path")).toBe("/root/src")
    expect(result.searchParams.get("workspace")).toBeNull()
    expect(result.searchParams.get("directory")).toBeNull()

    const prompt = workspaceProxyURL(
      "https://remote.example/base",
      new URL("http://local.example/remote/agent/prompt?workspace=ws_1&directory=%2Froot&path=%2Froot%2Fsrc"),
    )
    expect(prompt.pathname).toBe("/base/remote/agent/prompt")
    expect(prompt.searchParams.get("path")).toBe("/root/src")
    expect(prompt.searchParams.get("workspace")).toBeNull()
    expect(prompt.searchParams.get("directory")).toBeNull()
  })

  test("resolves an agent folder only within the authenticated instance root", async () => {
    await using tmp = await tmpdir({ config: { formatter: false, lsp: false } })
    await using outside = await tmpdir({ config: { formatter: false, lsp: false } })
    await mkdir(path.join(tmp.path, "src"))
    await writeFile(path.join(tmp.path, "file.txt"), "file")

    await expect(Effect.runPromise(resolveRemoteFolder({ root: tmp.path, current: path.join(tmp.path, "src") }))).resolves.toEqual({
      root: tmp.path,
      current: path.join(tmp.path, "src"),
    })
    await expect(Effect.runPromise(resolveRemoteFolder({ root: tmp.path, current: outside.path }))).rejects.toThrow(
      "outside the instance directory",
    )
    await expect(
      Effect.runPromise(resolveRemoteFolder({ root: tmp.path, current: path.join(tmp.path, "file.txt") })),
    ).rejects.toBeDefined()
  })
})

describe("remote agent runtime", () => {
  test("requires an explicit supported agent at the HTTP route", async () => {
    await using tmp = await tmpdir({ config: { formatter: false, lsp: false } })
    const missing = await request(
      RemoteRuntimePaths.prompt,
      tmp.path,
      {},
      {
        method: "POST",
        body: JSON.stringify({ prompt: "missing agent" }),
      },
    )
    const unknown = await request(
      RemoteRuntimePaths.prompt,
      tmp.path,
      {},
      {
        method: "POST",
        body: JSON.stringify({ agent: "shell", prompt: "unknown agent" }),
      },
    )
    expect(missing.status).toBe(400)
    expect(unknown.status).toBe(400)
  })

  test("builds fixed argv with validated allowlisted configuration", () => {
    const prompt = "$(touch /tmp/should-not-run) --model injected"
    expect(
      buildAgentCommand("codex-cli", prompt, {
        model: "gpt-5",
        profile: "safe-profile",
        sandbox: "workspace-write",
        approval: "on-request",
      }),
    ).toEqual({
      executable: "codex",
      args: [
        "exec",
        "--model",
        "gpt-5",
        "--profile",
        "safe-profile",
        "--sandbox",
        "workspace-write",
        "--ask-for-approval",
        "on-request",
        "--",
        prompt,
      ],
    })
    expect(buildAgentCommand("opencode-cli", prompt, { model: "openai/gpt-5", profile: "build" })).toEqual({
      executable: "opencode",
      args: ["run", "--model", "openai/gpt-5", "--agent", "build", "--", prompt],
    })
    expect(buildAgentCommand("opencode-cli", prompt, { sandbox: "workspace-write" })).toBeUndefined()
  })

  test("runs both selected executables with cwd and no client-controlled shell options", async () => {
    const commands: Array<{ command: string; args: readonly string[]; options: Record<string, unknown> }> = []
    const process = Layer.mock(AppProcess.Service)({
      run: (command) => {
        commands.push(command as unknown as (typeof commands)[number])
        return Effect.succeed(processResult({ stdout: Buffer.from("done") }))
      },
    })

    const result = await Effect.runPromise(
      runAgentPrompt({
        agent: "codex-cli",
        directory: "/authorized/project",
        prompt: "inspect the project",
        config: { model: "gpt-5" },
      }).pipe(Effect.provide(process)),
    )

    expect(result).toEqual({ output: "done", status: "completed", exitCode: 0 })
    expect(commands[0]).toMatchObject({
      command: "codex",
      args: ["exec", "--model", "gpt-5", "--", "inspect the project"],
      options: { cwd: "/authorized/project", stdin: "ignore", extendEnv: true },
    })
    expect(commands[0].options.shell).toBeUndefined()
    expect(commands[0].options.env).toBeUndefined()

    await Effect.runPromise(
      runAgentPrompt({ agent: "opencode-cli", directory: "/authorized/project", prompt: "inspect with opencode" }).pipe(
        Effect.provide(process),
      ),
    )
    expect(commands[1]).toMatchObject({
      command: "opencode",
      args: ["run", "--", "inspect with opencode"],
      options: { cwd: "/authorized/project", stdin: "ignore", extendEnv: true },
    })
  })

  test("returns failed and timed-out statuses without exposing process command details", async () => {
    const failed = Layer.mock(AppProcess.Service)({
      run: () => Effect.succeed(processResult({ exitCode: 7, stderr: Buffer.from("failed") })),
    })
    const timeout = Layer.mock(AppProcess.Service)({
      run: () =>
        Effect.fail(
          new AppProcess.AppProcessError({
            command: "codex exec secret prompt",
            cause: new Error("Timed out"),
            stderr: "timed out",
          }),
        ),
    })

    const [failedResult, timeoutResult] = await Promise.all([
      Effect.runPromise(
        runAgentPrompt({ agent: "codex-cli", directory: "/project", prompt: "fail" }).pipe(Effect.provide(failed)),
      ),
      Effect.runPromise(
        runAgentPrompt({ agent: "codex-cli", directory: "/project", prompt: "wait" }).pipe(Effect.provide(timeout)),
      ),
    ])

    expect(failedResult).toEqual({ output: "failed", status: "failed", exitCode: 7 })
    expect(timeoutResult).toEqual({ output: "timed out", status: "timed_out" })
    expect(JSON.stringify(timeoutResult)).not.toContain("secret prompt")
  })

  test("bounds combined stdout and stderr output", async () => {
    const process = Layer.mock(AppProcess.Service)({
      run: () =>
        Effect.succeed(
          processResult({
            stdout: Buffer.alloc(MAX_CODEX_OUTPUT_BYTES, "a"),
            stderr: Buffer.alloc(MAX_CODEX_OUTPUT_BYTES, "b"),
          }),
        ),
    })

    const result = await Effect.runPromise(
      runAgentPrompt({ agent: "codex-cli", directory: "/project", prompt: "large" }).pipe(Effect.provide(process)),
    )
    expect(Buffer.byteLength(result.output)).toBeLessThanOrEqual(MAX_CODEX_OUTPUT_BYTES)
  })
})
