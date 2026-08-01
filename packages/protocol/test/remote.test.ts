import { describe, expect, test } from "bun:test"
import { Effect, Schema } from "effect"
import {
  RemoteEnvelope,
  RemoteEnvelopeJson,
  RemotePairing,
  RemotePairingSelection,
  RemoteCodexCliConfig,
  RemoteCodexCliRequest,
  RemoteCodexCliResult,
  RemoteAgentMode,
  RemoteAgentRequest,
  RemoteAgentResult,
  RemoteSshFolderLimits,
  RemoteSshFolderListing,
  RemoteWorkspace,
  RemoteWorkspaceJson,
  RemoteWorkspaceSelectInput,
} from "../src/remote"

describe("remote protocol contracts", () => {
  test("accepts a local request envelope", async () => {
    const value = await Effect.runPromise(
      Schema.decodeUnknownEffect(RemoteEnvelope)({
        version: "v1",
        kind: "request",
        id: "req_local-1",
        type: "workspace.open",
        idempotencyKey: "idem.local-1",
        device: {
          id: "dev_client-1",
          name: "Desktop App",
          platform: "darwin",
          arch: "arm64",
          version: "5.5.0",
        },
        host: {
          id: "hst_local-1",
          name: "Marcos MacBook",
          platform: "darwin",
          arch: "arm64",
          version: "14.6",
          mode: "local",
        },
        workspace: {
          id: "wrk_local-1",
          name: "slopcode",
          mode: "local",
          directory: "/Users/marcos/src/slopcode",
        },
        data: {
          action: "attach",
        },
      }),
    )

    expect(value.kind).toBe("request")
    if (value.kind !== "request") throw new Error("expected request")
    expect(value.workspace.mode).toBe("local")
  })

  test("accepts ssh pairing and event envelopes", async () => {
    const pairing = await Effect.runPromise(
      Schema.decodeUnknownEffect(RemotePairing)({
        version: "v1",
        id: "pair_ssh-1",
        code: "AB12CD",
        selection: {
          nonce: "0123456789abcdef",
          deviceID: "dev_phone-1",
          code: "AB12CD",
        },
        device: {
          id: "dev_phone-1",
          name: "Android Remote",
          platform: "android",
          arch: "arm64",
          version: "1.0.0",
        },
        host: {
          id: "hst_linux-1",
          name: "build-box",
          platform: "linux",
          arch: "x64",
          version: "24.04",
          mode: "ssh",
        },
        workspace: {
          id: "wrk_remote-1",
          name: "slopcode-dev",
          mode: "ssh",
          directory: "/Users/marcos/src/slopcode",
          remoteDirectory: "/srv/slopcode",
          ssh: {
            host: "build-box.internal",
            port: 22,
            user: "marcos",
          },
        },
        capability: {
          fs: true,
          command: true,
          pty: true,
          events: true,
          localWorkspace: false,
          sshWorkspace: true,
        },
      }),
    )
    const event = await Effect.runPromise(
      Schema.decodeUnknownEffect(RemoteEnvelope)({
        version: "v1",
        kind: "event",
        cursor: "cur_evt-2",
        type: "workspace.attached",
        requestID: "req_remote-1",
        data: {
          pairingID: pairing.id,
        },
      }),
    )

    expect(pairing.workspace.mode).toBe("ssh")
    expect(event.kind).toBe("event")
    if (event.kind !== "event") throw new Error("expected event")
    expect(String(event.requestID)).toBe("req_remote-1")
  })

  test("requires a bounded device-bound one-time selection", async () => {
    const selection = await Effect.runPromise(
      Schema.decodeUnknownEffect(RemotePairingSelection)({
        nonce: "0123456789abcdef",
        deviceID: "dev_phone-1",
        code: "AB12CD",
      }),
    )
    const input = await Effect.runPromise(
      Schema.decodeUnknownEffect(RemoteWorkspaceSelectInput)({
        pairingID: "pair_ssh-1",
        deviceID: selection.deviceID,
        selectionNonce: selection.nonce,
        selectionCode: selection.code,
      }),
    )

    expect(input.selectionNonce).toBe(selection.nonce)
    expect(input.selectionCode).toBe(selection.code)

    await expect(
      Effect.runPromise(
        Schema.decodeUnknownEffect(RemotePairingSelection)({
          nonce: "too-short",
          deviceID: "dev_phone-1",
          code: "AB12CD",
        }),
      ),
    ).rejects.toThrow()
    await expect(
      Effect.runPromise(
        Schema.decodeUnknownEffect(RemotePairingSelection)({
          nonce: "0123456789abcdef",
          deviceID: "dev_phone-1",
          code: "AB12CD",
          extra: true,
        }),
      ),
    ).rejects.toThrow()
    await expect(
      Effect.runPromise(
        Schema.decodeUnknownEffect(RemoteWorkspaceSelectInput)({
          pairingID: "pair_ssh-1",
          deviceID: "dev_phone-1",
          selectionNonce: "0123456789abcdef",
        }),
      ),
    ).rejects.toThrow()
  })

  test("supports explicit agent modes without breaking legacy ssh workspaces", async () => {
    const openCodeMode = await Effect.runPromise(Schema.decodeUnknownEffect(RemoteAgentMode)("opencode-cli"))
    const claudeCodeMode = await Effect.runPromise(Schema.decodeUnknownEffect(RemoteAgentMode)("claude-code"))

    const legacy = await Effect.runPromise(
      Schema.decodeUnknownEffect(RemoteWorkspace)({
        id: "wrk_legacy-ssh",
        name: "legacy",
        mode: "ssh",
        directory: "/Users/marcos/src/legacy",
        remoteDirectory: "/srv/legacy",
        ssh: {
          host: "build-box.internal",
          port: 22,
          user: "marcos",
        },
      }),
    )
    const local = await Effect.runPromise(
      Schema.decodeUnknownEffect(RemoteWorkspace)({
        id: "wrk_local-agent",
        name: "local agent",
        mode: "ssh",
        agent: "local-slopcode",
        directory: "/Users/marcos/src/local-agent",
        remoteDirectory: "/srv/local-agent",
        ssh: {
          host: "build-box.internal",
          port: 22,
          user: "marcos",
        },
      }),
    )
    const codex = await Effect.runPromise(
      Schema.decodeUnknownEffect(RemoteWorkspace)({
        id: "wrk_codex-agent",
        name: "codex agent",
        mode: "ssh",
        agent: "codex-cli",
        directory: "/Users/marcos/src/codex-agent",
        remoteDirectory: "/srv/codex-agent",
        ssh: {
          host: "build-box.internal",
          port: 22,
          user: "marcos",
        },
      }),
    )

    if (legacy.mode !== "ssh" || local.mode !== "ssh" || codex.mode !== "ssh") {
      throw new Error("expected ssh workspaces")
    }
    expect(legacy.mode).toBe("ssh")
    expect(legacy.agent).toBeUndefined()
    expect(local.agent).toBe("local-slopcode")
    expect(codex.agent).toBe("codex-cli")
    expect(openCodeMode).toBe("opencode-cli")
    expect(claudeCodeMode).toBe("claude-code")

    await expect(Effect.runPromise(Schema.decodeUnknownEffect(RemoteAgentMode)("open-code"))).rejects.toThrow()

    await expect(
      Effect.runPromise(
        Schema.decodeUnknownEffect(RemoteWorkspace)({
          id: "wrk_bad-agent",
          name: "bad agent",
          mode: "ssh",
          agent: "shell",
          directory: "/Users/marcos/src/bad-agent",
          remoteDirectory: "/srv/bad-agent",
          ssh: {
            host: "build-box.internal",
            port: 22,
            user: "marcos",
          },
        }),
      ),
    ).rejects.toThrow()
  })

  test("accepts bounded ssh folder listings and recent folders", async () => {
    const listing = await Effect.runPromise(
      Schema.decodeUnknownEffect(RemoteSshFolderListing)({
        path: "/Users/marcos",
        entries: [
          { name: "src", path: "/Users/marcos/src", kind: "directory" },
          { name: "README.md", path: "/Users/marcos/README.md", kind: "file" },
          { name: "current", path: "/Users/marcos/current", kind: "symlink" },
        ],
        recentFolders: ["/Users/marcos/src", "/srv/slopcode", "/tmp/worktree"],
      }),
    )

    expect(String(listing.path)).toBe("/Users/marcos")
    expect(listing.entries).toHaveLength(3)
    expect(listing.entries[2]?.kind).toBe("symlink")
    expect(listing.recentFolders.map(String)).toEqual(["/Users/marcos/src", "/srv/slopcode", "/tmp/worktree"])
  })

  test("rejects unsafe or unbounded ssh folder data", async () => {
    const decode = (value: unknown) => Effect.runPromise(Schema.decodeUnknownEffect(RemoteSshFolderListing)(value))
    const base = {
      path: "/srv/project",
      entries: [{ name: "src", path: "/srv/project/src", kind: "directory" }],
      recentFolders: ["/srv/project"],
    }

    await expect(decode({ ...base, path: "/srv/project/../secrets" })).rejects.toThrow()
    await expect(
      decode({ ...base, entries: [{ name: "..", path: "/srv/project/..", kind: "directory" }] }),
    ).rejects.toThrow()
    await expect(
      decode({ ...base, entries: [{ name: "src", path: "/srv/project\\src", kind: "directory" }] }),
    ).rejects.toThrow()
    await expect(decode({ ...base, path: `/${"a".repeat(RemoteSshFolderLimits.maxPathLength)}` })).rejects.toThrow()
    await expect(
      decode({
        ...base,
        entries: [{ name: "src", path: "/srv/project/src", kind: "directory", extra: true }],
      }),
    ).rejects.toThrow()
    await expect(
      decode({
        ...base,
        entries: Array.from({ length: RemoteSshFolderLimits.maxEntries + 1 }, (_, index) => ({
          name: `entry-${index}`,
          path: `/srv/project/entry-${index}`,
          kind: "file" as const,
        })),
      }),
    ).rejects.toThrow()
    await expect(
      decode({
        ...base,
        entries: [
          {
            name: "a".repeat(RemoteSshFolderLimits.maxNameLength + 1),
            path: "/srv/project/src",
            kind: "file",
          },
        ],
      }),
    ).rejects.toThrow()
    await expect(
      decode({
        ...base,
        recentFolders: ["/srv/project", "/srv/one", "/srv/two", "/srv/three"],
      }),
    ).rejects.toThrow()
    await expect(decode({ ...base, extra: true })).rejects.toThrow()
  })

  test("accepts bounded Codex CLI requests and result metadata", async () => {
    const request = await Effect.runPromise(
      Schema.decodeUnknownEffect(RemoteCodexCliRequest)({
        prompt: "Inspect the selected remote folder and summarize the failing tests.",
        config: {
          model: "gpt-5.1-codex",
          profile: "remote-safe",
          sandbox: "workspace-write",
          approval: "on-request",
        },
      }),
    )
    const result = await Effect.runPromise(
      Schema.decodeUnknownEffect(RemoteCodexCliResult)({
        output: "The test suite has one failing assertion.",
        metadata: {
          status: "completed",
          exitCode: 0,
          durationMs: 1200,
          model: "gpt-5.1-codex",
          profile: "remote-safe",
          sandbox: "workspace-write",
          approval: "on-request",
        },
      }),
    )

    expect(request.config?.sandbox).toBe("workspace-write")
    expect(result.metadata.status).toBe("completed")
    expect(result.output).toContain("failing assertion")

    const openCodeRequest = await Effect.runPromise(
      Schema.decodeUnknownEffect(RemoteAgentRequest)({
        agent: "opencode-cli",
        prompt: "Summarize the selected remote folder.",
        config: {
          model: "open-model",
          profile: "remote-safe",
          sandbox: "read-only",
          approval: "never",
        },
      }),
    )
    const openCodeResult = await Effect.runPromise(
      Schema.decodeUnknownEffect(RemoteAgentResult)({
        agent: "opencode-cli",
        output: "The folder is clean.",
        metadata: { status: "completed", model: "open-model", sandbox: "read-only", approval: "never" },
      }),
    )

    const claudeCodeRequest = await Effect.runPromise(
      Schema.decodeUnknownEffect(RemoteAgentRequest)({
        agent: "claude-code",
        prompt: "Summarize the selected remote folder.",
        config: { model: "sonnet", permissionMode: "plan" },
      }),
    )

    expect(openCodeRequest.agent).toBe("opencode-cli")
    expect(openCodeResult.agent).toBe("opencode-cli")
    expect(claudeCodeRequest.agent).toBe("claude-code")
  })

  test("rejects unbounded or command-shaped Codex CLI data", async () => {
    await expect(
      Effect.runPromise(
        Schema.decodeUnknownEffect(RemoteCodexCliRequest)({
          prompt: "p".repeat(64 * 1024 + 1),
        }),
      ),
    ).rejects.toThrow()
    await expect(
      Effect.runPromise(
        Schema.decodeUnknownEffect(RemoteCodexCliConfig)({
          executable: "codex",
          argv: ["exec"],
          env: { CODEX_HOME: "/tmp/codex" },
        }),
      ),
    ).rejects.toThrow()
    await expect(
      Effect.runPromise(
        Schema.decodeUnknownEffect(RemoteCodexCliConfig)({
          model: "m".repeat(129),
        }),
      ),
    ).rejects.toThrow()
    await expect(
      Effect.runPromise(
        Schema.decodeUnknownEffect(RemoteCodexCliConfig)({
          sandbox: "shell",
        }),
      ),
    ).rejects.toThrow()
    await expect(
      Effect.runPromise(
        Schema.decodeUnknownEffect(RemoteCodexCliRequest)({
          prompt: "Run the check",
          command: "codex exec",
        }),
      ),
    ).rejects.toThrow()
    await expect(
      Effect.runPromise(
        Schema.decodeUnknownEffect(RemoteCodexCliResult)({
          output: "done",
          metadata: { status: "completed", executable: "codex" },
        }),
      ),
    ).rejects.toThrow()
  })

  test("rejects malformed ssh workspaces and metadata", async () => {
    await expect(
      Effect.runPromise(
        Schema.decodeUnknownEffect(RemoteWorkspace)({
          id: "wrk_remote-1",
          name: "slopcode-dev",
          mode: "ssh",
          directory: "/Users/marcos/src/slopcode",
          ssh: {
            host: "build-box.internal",
            port: 22,
            user: "marcos",
          },
        }),
      ),
    ).rejects.toThrow()

    await expect(
      Effect.runPromise(
        Schema.decodeUnknownEffect(RemoteWorkspace)({
          id: "wrk_local-2",
          name: "slopcode",
          mode: "local",
          directory: "/Users/marcos/src/slopcode",
          remoteDirectory: "/srv/slopcode",
          ssh: {
            host: "build-box.internal",
            port: 22,
            user: "marcos",
          },
        }),
      ),
    ).rejects.toThrow()

    await expect(
      Effect.runPromise(
        Schema.decodeUnknownEffect(RemoteEnvelope)({
          version: "v1",
          kind: "response",
          requestID: "request-1",
          ack: {
            requestID: "request-1",
            idempotencyKey: "x",
          },
          data: {},
        }),
      ),
    ).rejects.toThrow()
  })

  test("round trips workspaces and envelopes through JSON", async () => {
    const workspace = await Effect.runPromise(
      Schema.decodeUnknownEffect(RemoteWorkspace)({
        id: "wrk_remote-2",
        name: "slopcode-dev",
        mode: "ssh",
        directory: "/Users/marcos/src/slopcode",
        remoteDirectory: "/srv/slopcode",
        ssh: {
          host: "build-box.internal",
          port: 2222,
          user: "marcos",
        },
      }),
    )
    const envelope = await Effect.runPromise(
      Schema.decodeUnknownEffect(RemoteEnvelope)({
        version: "v1",
        kind: "response",
        requestID: "req_remote-2",
        ack: {
          requestID: "req_remote-2",
          idempotencyKey: "idem.remote-2",
          cursor: "cur_evt-3",
        },
        data: {
          attached: true,
        },
      }),
    )
    const workspaceJson = Schema.encodeSync(RemoteWorkspaceJson)(workspace)
    const envelopeJson = Schema.encodeSync(RemoteEnvelopeJson)(envelope)

    expect(await Effect.runPromise(Schema.decodeUnknownEffect(RemoteWorkspaceJson)(workspaceJson))).toEqual(workspace)
    expect(await Effect.runPromise(Schema.decodeUnknownEffect(RemoteEnvelopeJson)(envelopeJson))).toEqual(envelope)
  })
})
