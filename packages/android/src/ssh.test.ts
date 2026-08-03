import { describe, expect, test } from "bun:test"
import {
  normalizeSshTarget,
  parseSshConnectResult,
  parseSshAuthStatus,
  parseSshEventMessage,
  parseSshHome,
  parseSshListing,
  parseSshTarget,
  parseSshPreflight,
  parseSshStart,
  sshSetupRecipe,
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

  test("uses only fixed setup recipes and accepts only bounded setup events", () => {
    expect(sshSetupRecipe("slopcode-cli", "install")).toBe("npm install -g slopcode@latest")
    expect(sshSetupRecipe("slopcode-cli", "login")).toBe("slopcode auth login")
    expect(sshSetupRecipe("codex-cli", "login")).toBe("codex login")
    expect(sshSetupRecipe("opencode-cli", "login")).toBe("opencode auth login")
    expect(sshSetupRecipe("claude-code", "login")).toBe("claude")
    expect(sshSetupRecipe("antigravity-cli", "install")).toBe(
      "curl -fsSL https://antigravity.google/cli/install.sh | bash",
    )
    expect(sshSetupRecipe("antigravity-cli", "login")).toBe("agy")
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
})
