import { describe, expect, test } from "bun:test"
import {
  normalizeSshTarget,
  parseSshConnectResult,
  parseSshAuthStatus,
  parseSshCodexAppServerStatus,
  checkCodexAppServer,
  codexAppServerStatus,
  parseSshEventMessage,
  parseSshHome,
  parseSshListing,
  parseSshTarget,
  parseSshPreflight,
  parseSshUpdateCheck,
  parseSshStart,
  parseSshWorkspaceSelection,
  sshSetupRecipe,
  sshLoginFlow,
  sshLoginGuidance,
  sshProfile,
  validSshPath,
} from "./ssh"

describe("direct SSH boundary parsing", () => {
  test("accepts the supported one-field SSH target forms", () => {
    expect(parseSshTarget("marcos@Mac.Example.com:2222")).toEqual({
      user: "marcos",
      host: "mac.example.com",
      port: 2222,
    })
    expect(parseSshTarget("marcos@[2001:db8::1]:2200")).toEqual({ user: "marcos", host: "2001:db8::1", port: 2200 })
    expect(normalizeSshTarget("marcos@Mac.Example.com")).toBe("marcos@mac.example.com")
    expect(sshProfile("marcos@[2001:db8::1]", 22)).toBe("marcos@[2001:db8::1]:22")
  })

  test("rejects shell syntax, ambiguous IPv6, and invalid ports", () => {
    expect(parseSshTarget("marcos@host;rm -rf /")).toBeUndefined()
    expect(parseSshTarget("marcos@2001:db8::1")).toBeUndefined()
    expect(parseSshTarget("marcos@host:0")).toBeUndefined()
    expect(parseSshTarget("marcos@host:65536")).toBeUndefined()
  })

  test("bounds remote paths and prevents traversal", () => {
    expect(validSshPath("/Users/marcos/Projects/slopcode")).toBe("/Users/marcos/Projects/slopcode")
    expect(validSshPath("/tmp/../etc")).toBeUndefined()
    expect(validSshPath("/tmp/a;echo bad")).toBe("/tmp/a;echo bad")
    expect(validSshPath("/tmp//a")).toBeUndefined()
  })

  test("validates SFTP entries against the requested parent", () => {
    expect(
      parseSshListing({
        path: "/Users/marcos",
        parent: "/Users",
        entries: [{ name: "Projects", path: "/Users/marcos/Projects", type: "directory" }],
      }),
    ).toEqual({
      path: "/Users/marcos",
      parent: "/Users",
      entries: [{ name: "Projects", path: "/Users/marcos/Projects", type: "directory" }],
    })
    expect(
      parseSshListing({ path: "/Users/marcos", entries: [{ name: "Projects", path: "/etc", type: "directory" }] }),
    ).toEqual({ path: "/Users/marcos", entries: [] })
  })

  test("accepts only a validated absolute SFTP home", () => {
    expect(parseSshHome({ path: "/Users/marcos" })).toBe("/Users/marcos")
    expect(parseSshHome({ path: "/" })).toBe("/")
    expect(parseSshHome({ path: "/Users/../etc" })).toBeUndefined()
    expect(parseSshHome({ path: "relative" })).toBeUndefined()
  })

  test("accepts only a specific canonical workspace selection", () => {
    expect(parseSshWorkspaceSelection({ path: "/srv/project" })).toEqual({ path: "/srv/project" })
    expect(parseSshWorkspaceSelection({ path: "/" })).toBeUndefined()
    expect(parseSshWorkspaceSelection({ path: "/srv/../etc" })).toBeUndefined()
  })

  test("accepts only a connected result after native transport verification", () => {
    expect(
      parseSshConnectResult({
        status: "connected",
        profile: "marcos@mac.example.com:22",
        host: "mac.example.com",
        port: 22,
        remoteTransport: true,
      })?.status,
    ).toBe("connected")
    expect(
      parseSshConnectResult({
        status: "connected",
        profile: "marcos@mac.example.com:22",
        host: "mac.example.com",
        port: 22,
        remoteTransport: false,
      }),
    ).toBeUndefined()
    expect(
      parseSshConnectResult({
        status: "host_key_required",
        profile: "marcos@mac.example.com:22",
        host: "mac.example.com",
        port: 22,
        type: "ssh-ed25519",
        fingerprint: "SHA256:abc",
      })?.status,
    ).toBe("host_key_required")
  })

  test("binds PTY events to the current nonce and parses preflight", () => {
    const message = {
      type: "slopcode.ssh",
      channel: "slopcode.android.ssh",
      nonce: "nonce-1",
      event: { type: "output", id: "ssh_1", stream: "stdout", data: "hello" },
    } as const
    expect(parseSshEventMessage(message, "nonce-1")).toEqual(message.event)
    expect(parseSshEventMessage(message, "nonce-2")).toBeUndefined()
    expect(
      parseSshPreflight({ agent: "codex-cli", executable: "codex", exitCode: 0, output: "codex 1", ok: true }),
    ).toEqual({ agent: "codex-cli", executable: "codex", exitCode: 0, output: "codex 1", ok: true })
    expect(
      parseSshPreflight({ agent: "antigravity-cli", executable: "agy", exitCode: 0, output: "1.1.9", ok: true }),
    ).toEqual({ agent: "antigravity-cli", executable: "agy", exitCode: 0, output: "1.1.9", ok: true })
    expect(
      parseSshPreflight({
        agent: "codex-cli",
        executable: "codex",
        exitCode: 127,
        output: "not found",
        ok: false,
        error: "codex is not installed",
      }),
    ).toMatchObject({ exitCode: 127, ok: false })
    expect(
      parseSshAuthStatus({
        agent: "codex-cli",
        executable: "codex",
        exitCode: 0,
        output: "Logged in using ChatGPT",
        ok: true,
        loggedIn: true,
      }),
    ).toMatchObject({ loggedIn: true, ok: true })
    expect(
      parseSshAuthStatus({
        agent: "claude-code",
        executable: "claude",
        exitCode: 1,
        output: '{"loggedIn":false}',
        ok: false,
        loggedIn: false,
      }),
    ).toMatchObject({ loggedIn: false, exitCode: 1 })
    expect(
      parseSshAuthStatus({
        agent: "antigravity-cli",
        executable: "agy",
        exitCode: 0,
        output: "gemini-3.6-flash-high",
        ok: true,
        loggedIn: true,
      }),
    ).toMatchObject({ agent: "antigravity-cli", loggedIn: true })
  })

  test("derives Codex App Server readiness from the allowlisted Codex checks", async () => {
    const preflight = { agent: "codex-cli", executable: "codex", exitCode: 0, output: "codex 1.2.3", ok: true } as const
    expect(
      codexAppServerStatus(preflight, { ...preflight, output: "Logged in", loggedIn: true }, "verified"),
    ).toMatchObject({ state: "ready", ready: true, handshake: "verified", executable: "codex" })
    expect(codexAppServerStatus(preflight, { ...preflight, output: "Not logged in", loggedIn: false })).toMatchObject({
      state: "needs_sign_in",
      ready: false,
    })
    expect(codexAppServerStatus({ ...preflight, exitCode: 127, ok: false })).toMatchObject({
      state: "not_installed",
      ready: false,
    })
    await expect(
      checkCodexAppServer(
        {
          execVersion: async () => preflight,
          execAuthStatus: async () => ({ ...preflight, output: "Logged in", loggedIn: true }),
        },
        "/workspace",
      ),
    ).resolves.toMatchObject({ state: "unavailable", ready: false, handshake: "not_run" })
    expect(
      parseSshCodexAppServerStatus({
        executable: "codex",
        state: "ready",
        ready: true,
        handshake: "verified",
        message: "Ready",
        output: "codex 1.2.3",
        preflight,
        auth: { ...preflight, loggedIn: true },
      }),
    ).toMatchObject({ ready: true, preflight })
    expect(
      parseSshCodexAppServerStatus({
        executable: "codex",
        state: "ready",
        ready: true,
        message: "Ready",
        output: "codex 1.2.3",
        preflight: { ...preflight, agent: "opencode-cli" },
        auth: { ...preflight, loggedIn: true },
      }),
    ).toBeUndefined()
  })

  test("uses only fixed setup recipes and accepts only bounded setup events", () => {
    expect(sshSetupRecipe("codex-cli", "login")).toBe("codex login --device-auth")
    expect(sshSetupRecipe("opencode-cli", "login")).toBe("opencode auth login")
    expect(sshSetupRecipe("claude-code", "login")).toBe("claude")
    expect(sshSetupRecipe("antigravity-cli", "install")).toContain("curl -fsSL https://antigravity.google/cli/install.sh | bash")
    expect(sshSetupRecipe("antigravity-cli", "install")).toContain("apt-get")
    expect(sshSetupRecipe("antigravity-cli", "login")).toBe("agy")
    expect(sshLoginFlow("codex-cli")).toBe("device-code")
    expect(sshLoginFlow("opencode-cli")).toBe("provider-method")
    expect(sshLoginFlow("claude-code")).toBe("ssh-browser-code")
    expect(sshLoginGuidance("antigravity-cli")).toContain("SSH")
    expect(parseSshStart({ id: "ssh_setup1", status: "started", operation: "install" })).toEqual({
      id: "ssh_setup1",
      status: "started",
      operation: "install",
    })
    expect(parseSshStart({ id: "ssh_setup1", status: "started", operation: "bash" })).toBeUndefined()
    expect(
      parseSshEventMessage(
        {
          type: "slopcode.ssh",
          channel: "slopcode.android.ssh",
          nonce: "nonce-1",
          event: { type: "output", id: "ssh_setup1", stream: "stdout", data: "x".repeat(16 * 1024 + 1) },
        },
        "nonce-1",
      ),
    ).toBeUndefined()
  })

  test("parses bounded installed-agent update results", () => {
    expect(
      parseSshUpdateCheck({
        agent: "codex-cli",
        executable: "codex",
        exitCode: 0,
        output: "__SLOPCODE_CURRENT__codex-cli 0.146.0\n__SLOPCODE_LATEST__0.147.0",
        ok: true,
        currentVersion: "0.146.0",
        latestVersion: "0.147.0",
      }),
    ).toEqual({
      agent: "codex-cli",
      executable: "codex",
      exitCode: 0,
      output: "__SLOPCODE_CURRENT__codex-cli 0.146.0\n__SLOPCODE_LATEST__0.147.0",
      ok: true,
      currentVersion: "0.146.0",
      latestVersion: "0.147.0",
    })
    expect(parseSshUpdateCheck({ agent: "bash", currentVersion: "1", output: "", exitCode: 0, ok: true })).toBeUndefined()
  })
})
