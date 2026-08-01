import { describe, expect, test } from "bun:test"
import { createSshRemoteHostService, buildSshExecArgs, normalizeSshTarget, workspaceIdentity } from "./ssh"
import { DesktopWorkspaceID, type DesktopSshTarget } from "./contract"

describe("normalizeSshTarget", () => {
  test("normalizes remote directories and ssh authority fields", () => {
    const target = normalizeSshTarget(fixtureTarget({ remoteDirectory: "/srv//slopcode/../slopcode/" }))

    expect(target.hostName).toBe("example.test")
    expect(target.user).toBe("marcos")
    expect(target.remoteDirectory).toBe("/srv/slopcode")
    expect(String(target.id)).toBe("ssh:marcos@example.test:2222\u0000/srv/slopcode")
  })

  test("rejects unsafe ssh values at the boundary", () => {
    expect(() => normalizeSshTarget(fixtureTarget({ sshHost: "-bad-host" }))).toThrow("cannot start with '-'")
    expect(() => normalizeSshTarget(fixtureTarget({ remoteDirectory: "/srv/repo\nx" }))).toThrow("Invalid remote directory")
  })
})

describe("buildSshExecArgs", () => {
  test("constructs ssh args without shell interpolation inputs", () => {
    const target = normalizeSshTarget(fixtureTarget())
    const args = buildSshExecArgs(target, "/tmp/known_hosts")

    expect(args).toEqual([
      "-o",
      "BatchMode=yes",
      "-o",
      "ExitOnForwardFailure=yes",
      "-o",
      "ServerAliveInterval=15",
      "-o",
      "ServerAliveCountMax=3",
      "-o",
      "StrictHostKeyChecking=yes",
      "-o",
      "UserKnownHostsFile=/tmp/known_hosts",
      "-i",
      "/Users/marcos/.ssh/id_slopcode",
      "-o",
      "IdentitiesOnly=yes",
      "-p",
      "2222",
      "-T",
      "marcos@example.test",
      "sh",
      "-se",
    ])
    expect(args.join(" ")).not.toContain("/srv/slopcode")
    expect(args.join(" ")).not.toContain("ssh-ed25519 AAAA")
  })
})

describe("workspaceIdentity", () => {
  test("is stable across equivalent target normalization", () => {
    const first = normalizeSshTarget(fixtureTarget({ remoteDirectory: "/srv/slopcode/" }))
    const second = normalizeSshTarget(fixtureTarget({ remoteDirectory: "/srv//slopcode" }))

    expect(first.id).toBe(second.id)
    expect(first.id).toBe(
      workspaceIdentity({
        hostName: "example.test",
        user: "marcos",
        port: 2222,
        remoteDirectory: "/srv/slopcode",
      }),
    )
  })
})

describe("createSshRemoteHostService", () => {
  test("emits validating, starting, ready, stopped lifecycle states", async () => {
    const exits: Array<(code: number | null, signal: NodeJS.Signals | null) => void> = []
    const events: string[] = []
    const service = createSshRemoteHostService({
      allocatePort: async () => 4100,
      uuid: () => "00000000-0000-4000-8000-000000000001",
      materializeHostKey: async () => ({
        path: "/tmp/known_hosts",
        cleanup: async () => undefined,
      }),
      runSsh: async () => ({
        code: 0,
        signal: null,
        stdout: '{"attached":false,"port":4200,"username":"slopcode","password":"secret"}\n',
        stderr: "",
      }),
      openTunnel: () => ({
        stop: () => undefined,
        onExit: (cb) => exits.push(cb),
      }),
      health: async () => true,
      validateRemoteDirectory: async (url, password, directory) => {
        expect(url).toBe("http://127.0.0.1:4100")
        expect(password).toBe("secret")
        return { directory }
      },
    })

    const stop = service.subscribe((event) => events.push(event.state.kind))
    const ready = await service.ensureWorkspace(fixtureTarget())

    expect(ready.kind).toBe("ready")
    expect(ready.attached).toBe(false)
    await service.stopWorkspace(DesktopWorkspaceID.make(String(ready.id)))
    stop()

    expect(events).toEqual(["validating", "starting", "ready", "stopped"])
    expect(service.getState(ready.id)?.kind).toBe("stopped")
    expect(exits).toHaveLength(1)
  })

  test("surfaces unexpected tunnel exits as failed state", async () => {
    let exit: ((code: number | null, signal: NodeJS.Signals | null) => void) | undefined
    const service = createSshRemoteHostService({
      allocatePort: async () => 4101,
      uuid: () => "00000000-0000-4000-8000-000000000002",
      materializeHostKey: async () => ({
        path: "/tmp/known_hosts",
        cleanup: async () => undefined,
      }),
      runSsh: async () => ({
        code: 0,
        signal: null,
        stdout: '{"attached":true,"port":4201,"username":"slopcode","password":"secret"}\n',
        stderr: "",
      }),
      openTunnel: () => ({
        stop: () => undefined,
        onExit: (cb) => {
          exit = cb
        },
      }),
      health: async () => true,
      validateRemoteDirectory: async (_url, _password, directory) => ({ directory }),
    })

    const ready = await service.ensureWorkspace(fixtureTarget())
    exit?.(255, null)

    expect(service.getState(ready.id)).toEqual({
      kind: "failed",
      id: ready.id,
      host: ready.host,
      workspace: ready.workspace,
      message: "SSH tunnel exited (code=255 signal=null)",
    })
  })
})

function fixtureTarget(
  overrides: {
    remoteDirectory?: string
    sshHost?: string
  } = {},
): DesktopSshTarget {
  return {
    host: {
      id: "hst_build-box",
      name: "build-box",
      platform: "linux",
      arch: "x64",
      version: "24.04",
      mode: "ssh",
    },
    workspace: {
      id: "wrk_remote-1",
      name: "slopcode",
      mode: "ssh",
      directory: "/Users/marcos/src/slopcode",
      remoteDirectory: overrides.remoteDirectory ?? "/srv/slopcode",
      ssh: {
        host: overrides.sshHost ?? "example.test",
        port: 2222,
        user: "marcos",
      },
    },
    security: {
      identityPath: "/Users/marcos/.ssh/id_slopcode",
      hostKey: {
        kind: "pinned",
        value: "example.test ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIExampleHostKey",
      },
    },
  }
}
