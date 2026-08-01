import { describe, expect, test } from "bun:test"
import {
  buildSshBootstrapScript,
  buildSshExecArgs,
  buildSshStopScript,
  createSshRemoteHostService,
  normalizeSshTarget,
  workspaceIdentity,
  workspaceStateKey,
} from "./ssh"
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
    expect(first.stateKey).toBe(second.stateKey)
    expect(first.id).toBe(
      workspaceIdentity({
        hostName: "example.test",
        user: "marcos",
        port: 2222,
        remoteDirectory: "/srv/slopcode",
      }),
    )
    expect(first.stateKey).toBe(workspaceStateKey(first.id))
  })
})

describe("SSH workspace scripts", () => {
  test("scope remote state to the normalized remote workspace and launch in that directory", () => {
    const first = normalizeSshTarget(fixtureTarget({ remoteDirectory: "/srv/slopcode/" }))
    const second = normalizeSshTarget(fixtureTarget({ remoteDirectory: "/srv/other" }))
    const bootstrap = buildSshBootstrapScript(first, 4200, "secret")
    const stop = buildSshStopScript(first)

    expect(first.stateKey).not.toBe(second.stateKey)
    expect(bootstrap).toContain(`key='${first.stateKey}'`)
    expect(bootstrap).toContain('state_file="$state_dir/desktop-ssh-server-$key.env"')
    expect(bootstrap).toContain('log_file="$state_dir/desktop-ssh-server-$key.log"')
    expect(stop).toContain(`key='${first.stateKey}'`)
    expect(stop).toContain('state_file="$state_dir/desktop-ssh-server-$key.env"')
    expect(bootstrap).toContain("cd \"$dir\"")
    expect(bootstrap).toContain('DIRECTORY="$dir"')
    expect(stop).not.toContain("/srv/slopcode")
  })

  test("keep selected directory out of raw shell commands", () => {
    const target = normalizeSshTarget(fixtureTarget({ remoteDirectory: "/srv/remote dir/$(touch nope)" }))
    const bootstrap = buildSshBootstrapScript(target, 4200, "secret")
    const stop = buildSshStopScript(target)

    expect(bootstrap).toContain(`dir='/srv/remote dir/$(touch nope)'`)
    expect(bootstrap).toContain("cd \"$dir\"")
    expect(bootstrap).not.toContain("cd /srv/remote dir/$(touch nope)")
    expect(stop).not.toContain("/srv/remote dir/$(touch nope)")
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

  test("cancels a pending startup before it can become ready", async () => {
    const events: string[] = []
    const runs: string[] = []
    const gate = deferred<void>()
    let stops = 0
    let cleanups = 0
    const service = createSshRemoteHostService({
      allocatePort: async () => 4102,
      uuid: () => "00000000-0000-4000-8000-000000000003",
      materializeHostKey: async () => ({
        path: "/tmp/known_hosts",
        cleanup: async () => {
          cleanups += 1
        },
      }),
      runSsh: async (_args, script, _timeoutMs, signal) => {
        runs.push(script)
        if (signal?.aborted) throw signal.reason
        return {
          code: 0,
          signal: null,
          stdout: '{"attached":false,"port":4202,"username":"slopcode","password":"secret"}\n',
          stderr: "",
        }
      },
      openTunnel: () => ({
        stop: () => {
          if (stops) return
          stops += 1
        },
        onExit: () => undefined,
      }),
      health: async (_url, _password, signal) => {
        gate.resolve()
        await new Promise<boolean>((_resolve, reject) => {
          signal?.addEventListener("abort", () => reject(signal.reason), { once: true })
        })
        return false
      },
      validateRemoteDirectory: async () => {
        throw new Error("validation should not run after cancellation")
      },
    })

    const target = fixtureTarget()
    const id = normalizeSshTarget(target).id
    const unsubscribe = service.subscribe((event) => events.push(event.state.kind))
    const pending = service.ensureWorkspace(target)
    await gate.promise
    await service.stopWorkspace(id)
    unsubscribe()

    await expect(pending).rejects.toThrow("aborted")
    expect(events).toEqual(["validating", "starting", "stopped"])
    expect(stops).toBe(1)
    expect(cleanups).toBe(1)
    expect(runs).toHaveLength(2)
    expect(runs[0]).toContain("nohup env")
    expect(runs[1]).toContain(`key='${workspaceStateKey(id)}'`)
    expect(runs[1]).toContain('state_file="$state_dir/desktop-ssh-server-$key.env"')
    expect(service.getState(id)?.kind).toBe("stopped")
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

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}
