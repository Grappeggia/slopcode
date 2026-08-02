import { AppProcess } from "@slopcode-ai/core/process"
import { Context, Effect, Layer } from "effect"
import { describe, expect, test, afterEach } from "bun:test"
import { mkdir, symlink, writeFile } from "node:fs/promises"
import path from "node:path"
import { HttpApiApp } from "../../src/server/routes/instance/httpapi/server"
import {
  MAX_CODEX_PROMPT_LENGTH,
  MAX_CODEX_OUTPUT_BYTES,
  MAX_REMOTE_AGENT_COMMAND_DESCRIPTION_LENGTH,
  MAX_REMOTE_AGENT_VERSION_LENGTH,
  REMOTE_AGENT_VERSION_TIMEOUT,
  MAX_REMOTE_ENTRIES,
  MAX_REMOTE_PATH_LENGTH,
  RemoteRuntimePaths,
} from "../../src/server/routes/instance/httpapi/groups/remote-runtime"
import {
  browseSshRemoteFolder,
  buildAgentCommand,
  buildAgentInteractiveCommand,
  buildAgentVersionCommand,
  buildSshBrowseCommand,
  discoverRemoteCommands,
  parseRemoteCommandMetadata,
  parseSshBrowseOutput,
  resolveRemoteFolder,
  runAgentCatalog,
  runAgentVersion,
  runAgentPrompt,
} from "../../src/server/routes/instance/httpapi/handlers/remote-runtime"
import { PtyPaths } from "../../src/server/routes/instance/httpapi/groups/pty"
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
  test("builds a strict SSH browse command and parses bounded directory metadata", async () => {
    const command = buildSshBrowseCommand("marcos@example.test", 2222, "/Users/marcos")
    expect(command?.command).toBe("ssh")
    expect(command?.args).toContain("BatchMode=yes")
    expect(command?.args).toContain("StrictHostKeyChecking=yes")
    expect(command?.args?.some((item) => item.startsWith("UserKnownHostsFile="))).toBe(true)
    expect(command?.args).toContain("ConnectTimeout=15")
    expect(command?.args).toEqual(
      expect.arrayContaining(["-p", "2222", "marcos@example.test", "sh", "-se", "--", "'/Users/marcos'"]),
    )
    expect(command?.options.shell).toBeUndefined()
    const unsafe = "/Users/a b; touch /tmp/pwned/'quote"
    expect(buildSshBrowseCommand("marcos@example.test", 22, unsafe)?.args?.at(-1)).toBe(
      "'/Users/a b; touch /tmp/pwned/'\"'\"'quote'",
    )
    expect(buildSshBrowseCommand("marcos@-bad", 22, "/")).toBeUndefined()
    expect(
      parseSshBrowseOutput(
        "CURRENT\t/Users/marcos\nPARENT\t/Users\nENTRY\tProjects\t/Users/marcos/Projects\nENTRY\t..\t/Users/..\n",
      ),
    ).toEqual({
      root: "/",
      current: "/Users/marcos",
      parent: "/Users",
      entries: [{ name: "Projects", path: "/Users/marcos/Projects", type: "directory" }],
    })

    const process = Layer.mock(AppProcess.Service)({
      run: () =>
        Effect.succeed(
          processResult({
            stdout: Buffer.from("CURRENT\t/\nENTRY\tUsers\t/Users\n"),
          }),
        ),
    })
    await expect(
      Effect.runPromise(
        browseSshRemoteFolder({ authority: "marcos@example.test", port: 22 }).pipe(Effect.provide(process)),
      ),
    ).resolves.toEqual({
      root: "/",
      current: "/",
      entries: [{ name: "Users", path: "/Users", type: "directory" }],
    })
  })

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

  test("validates the catalog agent and selected path at the authenticated route", async () => {
    await using tmp = await tmpdir({ config: { formatter: false, lsp: false } })
    const unknown = await request(RemoteRuntimePaths.catalog, tmp.path, { agent: "shell" })
    const traversal = await request(RemoteRuntimePaths.catalog, tmp.path, {
      agent: "codex-cli",
      path: path.posix.join(tmp.path, ".."),
    })
    const oversized = await request(RemoteRuntimePaths.catalog, tmp.path, {
      agent: "codex-cli",
      path: `/${"x".repeat(MAX_REMOTE_PATH_LENGTH)}`,
    })
    expect(unknown.status).toBe(400)
    expect(traversal.status).toBe(403)
    expect(oversized.status).toBe(400)
  })

  test("serves a catalog endpoint with the fixed executable and no templates", async () => {
    if (process.platform === "win32") return
    await using tmp = await tmpdir({ config: { formatter: false, lsp: false } })
    await using bin = await tmpdir({ config: { formatter: false, lsp: false } })
    await symlink(process.execPath, path.join(bin.path, "codex"))
    const previous = process.env.PATH
    process.env.PATH = `${bin.path}${path.delimiter}${previous ?? ""}`
    try {
      const response = await request(RemoteRuntimePaths.catalog, tmp.path, { agent: "codex-cli", path: tmp.path })
      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.agent).toBe("codex-cli")
      expect(typeof body.version).toBe("string")
      expect(body.version.length).toBeGreaterThan(0)
      expect(body.commands).toContainEqual(expect.objectContaining({ name: "help" }))
      expect(body.commands).toContainEqual(expect.objectContaining({ name: "approvals" }))
      expect(body.commands).toContainEqual(expect.objectContaining({ name: "sandbox" }))
      expect(JSON.stringify(body)).not.toContain("template")
    } finally {
      if (previous === undefined) delete process.env.PATH
      else process.env.PATH = previous
    }
  })

  test("opens a ticket-scoped interactive session with a fixed agent executable", async () => {
    if (process.platform === "win32") return
    await using tmp = await tmpdir({ config: { formatter: false, lsp: false } })
    await using bin = await tmpdir({ config: { formatter: false, lsp: false } })
    await writeFile(path.join(bin.path, "codex"), "#!/bin/sh\nsleep 10\n", { mode: 0o755 })
    const previous = process.env.PATH
    process.env.PATH = `${bin.path}${path.delimiter}${previous ?? ""}`
    try {
      const response = await request(
        RemoteRuntimePaths.session,
        tmp.path,
        { path: tmp.path },
        { method: "POST", body: JSON.stringify({ agent: "codex-cli" }) },
      )
      expect(response.status).toBe(200)
      const body = await response.json()
      const ptyID = body.ptyID
      expect(body).toMatchObject({ directory: tmp.path, ptyID: expect.stringMatching(/^pty_/) })
      expect(body.ticket).toEqual(expect.any(String))
      expect(body.expires_in).toBeGreaterThan(0)

      const removed = await request(`${PtyPaths.remove.replace(":ptyID", ptyID)}`, tmp.path, {}, { method: "DELETE" })
      expect(removed.status).toBe(200)
    } finally {
      if (previous === undefined) delete process.env.PATH
      else process.env.PATH = previous
    }
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

    await expect(
      Effect.runPromise(resolveRemoteFolder({ root: tmp.path, current: path.join(tmp.path, "src") })),
    ).resolves.toEqual({
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

  test("builds fixed version argv and runs it in the selected folder with bounds", async () => {
    for (const agent of ["codex-cli", "opencode-cli", "claude-code"] as const) {
      const command = buildAgentVersionCommand(agent, "/authorized/project")
      expect(command).toMatchObject({
        command: agent === "codex-cli" ? "codex" : agent === "opencode-cli" ? "opencode" : "claude",
        args: ["--version"],
        options: { cwd: "/authorized/project", stdin: "ignore", extendEnv: true },
      })
      expect(command?.options.shell).toBeUndefined()
    }
    expect(buildAgentVersionCommand("shell" as never, "/authorized/project")).toBeUndefined()

    const calls: Array<{ command: string; args: readonly string[]; options: unknown }> = []
    const process = Layer.mock(AppProcess.Service)({
      run: (command, options) => {
        const standard = command as unknown as { command: string; args: readonly string[] }
        calls.push({ command: standard.command, args: standard.args, options })
        return Effect.succeed(processResult({ stdout: Buffer.from("claude 1.2.3\n") }))
      },
    })
    await expect(
      Effect.runPromise(
        runAgentVersion({ agent: "claude-code", directory: "/authorized/project" }).pipe(Effect.provide(process)),
      ),
    ).resolves.toBe("claude 1.2.3")
    expect(calls[0]).toMatchObject({
      command: "claude",
      args: ["--version"],
      options: {
        timeout: REMOTE_AGENT_VERSION_TIMEOUT,
        maxOutputBytes: expect.any(Number),
        maxErrorBytes: expect.any(Number),
      },
    })

    const oversized = Layer.mock(AppProcess.Service)({
      run: () =>
        Effect.succeed(processResult({ stdout: Buffer.from("v".repeat(MAX_REMOTE_AGENT_VERSION_LENGTH + 1)) })),
    })
    await expect(
      Effect.runPromise(
        runAgentVersion({ agent: "codex-cli", directory: "/authorized/project" }).pipe(Effect.provide(oversized)),
      ),
    ).rejects.toThrow("invalid version metadata")
  })

  test("discovers bounded frontmatter metadata without returning templates", async () => {
    expect(
      parseRemoteCommandMetadata(
        "review.md",
        "---\ndescription: Review the project\nagent: plan\nmodel: sonnet\nsubtask: true\n---\nsecret template",
      ),
    ).toEqual({ name: "review", description: "Review the project", agent: "plan", model: "sonnet", subtask: true })
    expect(parseRemoteCommandMetadata("bad.md", "---\nsubtask: maybe\n---\nignored")).toBeUndefined()
    expect(
      parseRemoteCommandMetadata(
        "large.md",
        `---\ndescription: ${"x".repeat(MAX_REMOTE_AGENT_COMMAND_DESCRIPTION_LENGTH + 1)}\n---\nignored`,
      ),
    ).toBeUndefined()

    await using tmp = await tmpdir({ config: { formatter: false, lsp: false } })
    const commands = path.join(tmp.path, ".claude", "commands")
    const skills = path.join(tmp.path, ".claude", "skills", "security-review")
    await mkdir(commands, { recursive: true })
    await mkdir(skills, { recursive: true })
    await writeFile(path.join(commands, "review.md"), "---\ndescription: Review it\nsubtask: true\n---\nsecret")
    await writeFile(path.join(skills, "SKILL.md"), "---\ndescription: Review security\n---\nsecret skill")
    await writeFile(path.join(commands, "bad.md"), "---\nsubtask: no\n---\nsecret")
    await writeFile(
      path.join(commands, "large.md"),
      `---\ndescription: ${"x".repeat(MAX_REMOTE_AGENT_COMMAND_DESCRIPTION_LENGTH + 1)}\n---\nsecret`,
    )
    const discovered = await discoverRemoteCommands("claude-code", tmp.path)
    expect(discovered).toContainEqual({ name: "review", description: "Review it", subtask: true })
    expect(discovered).toContainEqual({ name: "security-review", description: "Review security" })
    expect(JSON.stringify(discovered)).not.toContain("secret")
  })

  test("combines baked and project-local commands behind a bounded version check", async () => {
    await using tmp = await tmpdir({ config: { formatter: false, lsp: false } })
    const commands = path.join(tmp.path, ".opencode", "commands")
    await mkdir(commands, { recursive: true })
    await writeFile(
      path.join(commands, "deploy.md"),
      "---\ndescription: Deploy safely\nmodel: openai/gpt-5\n---\nrun deploy",
    )
    await writeFile(
      path.join(tmp.path, "opencode.jsonc"),
      '{\n  "command": {\n    "check": {\n      "description": "Check the project",\n      "agent": "plan",\n      "template": "secret config template"\n    }\n  }\n}',
    )
    const process = Layer.mock(AppProcess.Service)({
      run: (command) => {
        const standard = command as unknown as { command: string; args: readonly string[] }
        expect(standard.command).toBe("opencode")
        expect(standard.args).toEqual(["--version"])
        return Effect.succeed(processResult({ stdout: Buffer.from("opencode 2.0.0\n") }))
      },
    })
    const result = await Effect.runPromise(
      runAgentCatalog({ agent: "opencode-cli", directory: tmp.path }).pipe(Effect.provide(process)),
    )
    expect(result.agent).toBe("opencode-cli")
    expect(result.version).toBe("opencode 2.0.0")
    expect(result.commands).toContainEqual({ name: "deploy", description: "Deploy safely", model: "openai/gpt-5" })
    expect(result.commands).toContainEqual({ name: "check", description: "Check the project", agent: "plan" })
    expect(JSON.stringify(result.commands)).not.toContain("secret config template")
    expect(result.commands.every((command) => !Object.hasOwn(command, "template"))).toBe(true)
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
    expect(buildAgentCommand("claude-code", prompt, { model: "sonnet", permissionMode: "acceptEdits" })).toEqual({
      executable: "claude",
      args: ["-p", "--model", "sonnet", "--permission-mode", "acceptEdits", "--", prompt],
    })
    expect(buildAgentCommand("claude-code", prompt, { profile: "default" })).toBeUndefined()
  })

  test("builds interactive argv without turning the PTY into a shell", () => {
    expect(
      buildAgentInteractiveCommand("codex-cli", {
        model: "gpt-5",
        profile: "safe-profile",
        sandbox: "workspace-write",
        approval: "on-request",
      }),
    ).toEqual({
      executable: "codex",
      args: [
        "--model",
        "gpt-5",
        "--profile",
        "safe-profile",
        "--sandbox",
        "workspace-write",
        "--ask-for-approval",
        "on-request",
      ],
    })
    expect(buildAgentInteractiveCommand("opencode-cli", { model: "openai/gpt-5", profile: "build" })).toEqual({
      executable: "opencode",
      args: ["--model", "openai/gpt-5", "--agent", "build"],
    })
    expect(buildAgentInteractiveCommand("claude-code", { model: "sonnet", permissionMode: "plan" })).toEqual({
      executable: "claude",
      args: ["--model", "sonnet", "--permission-mode", "plan"],
    })
    expect(buildAgentInteractiveCommand("claude-code", { profile: "default" })).toBeUndefined()
    expect(buildAgentInteractiveCommand("opencode-cli", { permissionMode: "plan" })).toBeUndefined()
  })

  test("runs selected executables with cwd and no client-controlled shell options", async () => {
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
    expect(commands[0].options.env).toEqual({ SLOPCODE_REMOTE_SUPERVISOR_TOKEN: undefined })

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

    await Effect.runPromise(
      runAgentPrompt({
        agent: "claude-code",
        directory: "/authorized/project",
        prompt: "inspect with Claude Code",
        config: { permissionMode: "plan" },
      }).pipe(Effect.provide(process)),
    )
    expect(commands[2]).toMatchObject({
      command: "claude",
      args: ["-p", "--permission-mode", "plan", "--", "inspect with Claude Code"],
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
