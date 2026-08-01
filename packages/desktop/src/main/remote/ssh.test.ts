import { spawn, spawnSync } from "node:child_process"
import { EventEmitter } from "node:events"
import { createConnection, createServer, type Server } from "node:net"
import { PassThrough } from "node:stream"
import { describe, expect, test } from "bun:test"
import {
  buildSshBootstrapScript,
  buildSshExecArgs,
  buildSshTunnelArgs,
  buildSshStopScript,
  createSshRemoteHostService,
  normalizeSshTarget,
  openSshTunnel,
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

describe("buildSshTunnelArgs", () => {
  test("uses app-owned loopback TCP with SSH stdio forwarding", () => {
    const target = normalizeSshTarget(fixtureTarget())
    const args = buildSshTunnelArgs(target, "/tmp/known_hosts", 4310)
    const forward = args[args.indexOf("-W") + 1]

    expect(forward).toBe("127.0.0.1:4310")
    expect(args).not.toContain("-L")
    expect(args).not.toContain("0")
    expect(forward).not.toContain("/")
    expect(args.join(" ")).not.toContain("\\")
  })

  test("rejects invalid forwarding ports before spawning SSH", () => {
    const target = normalizeSshTarget(fixtureTarget())

    expect(() => buildSshTunnelArgs(target, "/tmp/known_hosts", 0)).toThrow("between 1 and 65535")
    expect(() => buildSshTunnelArgs(target, "/tmp/known_hosts", 65_536)).toThrow("between 1 and 65535")
  })
})

describe("openSshTunnel", () => {
  test("binds the app-owned proxy before per-connection SSH stdio forwarding", async () => {
    const remotePort = await allocateTestPort()
    const child = new TunnelChild()
    let spawned: string[] = []

    const tunnel = openSshTunnel(
      ["-W", `127.0.0.1:${remotePort}`],
      remotePort,
      ((_, args) => {
        spawned = args
        return child as unknown as ReturnType<typeof spawn>
      }) as typeof spawn,
    )
    const port = await tunnel.port

    expect(spawned).toHaveLength(0)
    expect(await canBind(port)).toBe(false)

    const client = createConnection(port, "127.0.0.1")
    await onceConnected(client)
    client.write("ping")
    expect(await read(client)).toBe("ping")
    expect(spawned).toEqual(["-W", `127.0.0.1:${remotePort}`])
    expect(spawned).not.toContain("-L")
    expect(spawned.join(" ")).not.toContain(":0")

    const stopping = tunnel.stop()
    const second = tunnel.stop()
    expect(stopping).toBe(second)
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(child.killCalls).toBe(1)
    expect(await canBind(port)).toBe(true)
    let complete = false
    void stopping.then(() => {
      complete = true
    })
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(complete).toBe(false)

    child.finish()
    await stopping
    expect(complete).toBe(true)
  })

  test("keeps the remote target port out of the local listener race", async () => {
    const remotePort = await allocateTestPort()
    let connections = 0
    const attacker = createServer((socket) => {
      connections += 1
      socket.destroy()
    })

    try {
      await listen(attacker, remotePort)
      const tunnel = openSshTunnel(["-W", `127.0.0.1:${remotePort}`], remotePort, (() => {
        throw new Error("SSH should not spawn without an accepted app connection")
      }) as typeof spawn)
      const port = await tunnel.port

      expect(port).not.toBe(remotePort)
      expect(await canBind(remotePort)).toBe(false)
      await tunnel.stop()
      expect(connections).toBe(0)
    } finally {
      await close(attacker)
    }
  })

  test("retries deterministic proxy bind collisions before exposing the port", async () => {
    let attempts = 0
    const tunnel = openSshTunnel(
      ["-W", "127.0.0.1:4312"],
      4312,
      (() => {
        throw new Error("SSH should not spawn before a client connects")
      }) as typeof spawn,
      (handler) => {
        attempts += 1
        if (attempts === 1) return new CollisionServer() as unknown as Server
        return createServer(handler)
      },
    )

    const port = await tunnel.port
    expect(attempts).toBe(2)
    expect(await canBind(port)).toBe(false)
    await tunnel.stop()
  })

  test("does not treat a child error as termination and escalates before resolving", async () => {
    const child = new TunnelChild()
    const tunnel = openSshTunnel(["-W", "127.0.0.1:4310"], 4310, (() => child as unknown as ReturnType<typeof spawn>) as typeof spawn)
    const port = await tunnel.port
    const errors: Error[] = []
    tunnel.onError((error) => errors.push(error))
    const client = createConnection(port, "127.0.0.1")
    await onceConnected(client)
    child.emit("error", new Error("spawn failed"))

    let complete = false
    const stopping = tunnel.stop().then(
      () => {
        complete = true
      },
      () => {
        complete = true
      },
    )
    await new Promise((resolve) => setTimeout(resolve, 300))
    expect(complete).toBe(false)
    expect(child.killSignals).toEqual([undefined, "SIGKILL"])
    expect(errors.at(-1)?.message).toContain("spawn error")
    expect(errors.at(-1)?.message).toContain("spawn failed")

    child.finish()
    await stopping
  })

  test("rejects bounded cleanup when child termination is never confirmed", async () => {
    const child = new TunnelChild()
    child.killError = new Error("permission denied")
    const tunnel = openSshTunnel(["-W", "127.0.0.1:4311"], 4311, (() => child as unknown as ReturnType<typeof spawn>) as typeof spawn)
    const port = await tunnel.port
    const client = createConnection(port, "127.0.0.1")
    await onceConnected(client)

    await expect(tunnel.stop()).rejects.toThrow("kill failed: permission denied")
    expect(child.killSignals).toEqual([undefined, "SIGKILL"])
    child.finish()
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
    const guardedStop = buildSshStopScript(first, "secret")

    expect(first.stateKey).not.toBe(second.stateKey)
    expect(bootstrap).toContain(`key='${first.stateKey}'`)
    expect(bootstrap).toContain('state_file="$state_dir/desktop-ssh-server-$key.state"')
    expect(bootstrap).toContain('log_file="$state_dir/desktop-ssh-server-$key.log"')
    expect(stop).toContain(`key='${first.stateKey}'`)
    expect(stop).toContain('state_file="$state_dir/desktop-ssh-server-$key.state"')
    expect(guardedStop).toContain("expected_password='secret'")
    expect(bootstrap).toContain("read_state() {")
    expect(bootstrap).toContain('printf \'%s\\n\' "$$" "$PORT" "$PASSWORD" "$DIR" "$start" "$EXE" >"$tmp"')
    expect(bootstrap).not.toContain('. "$state_file"')
    expect(bootstrap).not.toContain('DIRECTORY="$dir"')
    expect(stop).toContain('if ! matches_server "$state_pid" "$state_port" "$state_start" "$state_exe"; then')
    expect(stop).toContain('comm="$(ps -p "$pid" -o comm= 2>/dev/null || true)"')
    expect(stop).toContain('cmd="$(ps -p "$pid" -o command= 2>/dev/null || true)"')
    expect(stop).toContain("state_start")
    expect(stop).toContain("state_exe")
    expect(stop).toContain('case "$cmd" in')
    expect(stop).toContain('expected_name="${expected_exe##*/}"')
    expect(stop).not.toContain('set -- $cmd')
    expect(stop).not.toContain('. "$state_file"')
    expect(guardedStop).toContain('if [ "$state_password" != "$expected_password" ]; then')
    expect(guardedStop).toContain('while [ ! -f "$state_file" ] && [ "$tries" -gt 0 ]; do')
    expect(guardedStop).toContain('if ! wait_for_server 20; then')
    expect(bootstrap).toContain("cd \"$dir\"")
    expect(stop).toContain("dir='/srv/slopcode'")
  })

  test("rejects a reused pid with a different process start marker", () => {
    const stop = buildSshStopScript(normalizeSshTarget(fixtureTarget()))

    expect(
      runMatcher(stop, {
        comm: "slopcode",
        command: "slopcode serve --hostname 127.0.0.1 --port 4200",
        stateStart: "old-start",
        processStart: "new-start",
      }),
    ).toBe(1)
  })

  test("generates valid POSIX shell for bootstrap and stop", () => {
    const target = normalizeSshTarget(fixtureTarget())

    for (const script of [buildSshBootstrapScript(target, 4200, "secret"), buildSshStopScript(target)]) {
      const result = spawnSync("sh", ["-n"], { input: script, encoding: "utf8" })
      expect(result.status).toBe(0)
      expect(result.stderr).toBe("")
    }
  })

  test("does not partially apply malformed remote state", () => {
    const script = buildSshStopScript(normalizeSshTarget(fixtureTarget()))
    const readState = script.slice(script.indexOf("read_state() {"), script.indexOf("process_start() {"))
    const result = spawnSync("sh", ["-se"], {
      input: [
        "set -eu",
        'state_file="$(mktemp)"',
        'trap \'rm -f "$state_file"\' EXIT',
        "state_pid=old-pid",
        "state_port=old-port",
        "state_password=old-password",
        "state_workspace=old-workspace",
        "state_start=old-start",
        "state_exe=old-exe",
        'printf \'%s\\n\' new-pid new-port new-password new-workspace new-start >"$state_file"',
        readState,
        "if read_state; then exit 1; fi",
        '[ "$state_pid" = old-pid ]',
        '[ "$state_port" = old-port ]',
        '[ "$state_password" = old-password ]',
        '[ "$state_workspace" = old-workspace ]',
        '[ "$state_start" = old-start ]',
        '[ "$state_exe" = old-exe ]',
      ].join("\n"),
      encoding: "utf8",
    })

    expect(result.status).toBe(0)
    expect(result.stderr).toBe("")
  })

  test("rejects a matching command from a different executable path", () => {
    const stop = buildSshStopScript(normalizeSshTarget(fixtureTarget()))

    expect(
      runMatcher(stop, {
        comm: "slopcode",
        command: "slopcode serve --hostname 127.0.0.1 --port 4200",
        stateExe: "/usr/bin/slopcode",
        processExe: "slopcode-helper",
      }),
    ).toBe(1)
  })

  test("matches an executable path containing spaces without weakening identity checks", () => {
    const stop = buildSshStopScript(normalizeSshTarget(fixtureTarget()))

    expect(
      runMatcher(stop, {
        comm: "slopcode",
        command: "/opt/slopcode builds/slopcode serve --hostname 127.0.0.1 --port 4200",
        stateExe: "/opt/slopcode builds/slopcode",
        processExe: "/opt/slopcode builds/slopcode",
      }),
    ).toBe(0)
  })

  test("matches_server rejects helper commands and accepts exact slopcode paths", () => {
    const stop = buildSshStopScript(normalizeSshTarget(fixtureTarget()))

    expect(runMatcher(stop, { comm: "slopcode", command: "slopcode serve --hostname 127.0.0.1 --port 4200" })).toBe(0)
    expect(runMatcher(stop, { comm: "slopcode", command: "/usr/bin/slopcode serve --hostname 127.0.0.1 --port 4200" })).toBe(0)
    expect(runMatcher(stop, { comm: "slopcode-helper", command: "/usr/bin/slopcode-helper serve --hostname 127.0.0.1 --port 4200" })).toBe(1)
    expect(runMatcher(stop, { comm: "slopcode", command: "/usr/bin/slopcode-helper serve --hostname 127.0.0.1 --port 4200" })).toBe(1)
  })

  test("keep selected directory out of raw shell commands", () => {
    const target = normalizeSshTarget(fixtureTarget({ remoteDirectory: "/srv/remote dir/$(touch nope)`rm -f nope`" }))
    const bootstrap = buildSshBootstrapScript(target, 4200, "secret")
    const stop = buildSshStopScript(target)

    expect(bootstrap).toContain(`dir='/srv/remote dir/$(touch nope)\`rm -f nope\`'`)
    expect(bootstrap).toContain("cd \"$dir\"")
    expect(bootstrap).toContain('printf \'%s\\n\' "$$" "$PORT" "$PASSWORD" "$DIR" "$start" "$EXE" >"$tmp"')
    expect(bootstrap).not.toContain('. "$state_file"')
    expect(bootstrap).not.toContain("cd /srv/remote dir/$(touch nope)`rm -f nope`")
    expect(stop).toContain("dir='/srv/remote dir/$(touch nope)`rm -f nope`'")
    expect(stop).not.toContain("cd /srv/remote dir/$(touch nope)`rm -f nope`")
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
        port: Promise.resolve(4100),
        stop: async () => undefined,
        onExit: (cb) => exits.push(cb),
        onError: () => undefined,
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

  test("waits for tunnel teardown before cleaning the temporary host key", async () => {
    const tunnelStopStarted = deferred<void>()
    const releaseTunnelStop = deferred<void>()
    let tunnelStopped = false
    let hostKeyCleaned = false
    const service = createSshRemoteHostService({
      allocatePort: async () => 4109,
      uuid: () => "00000000-0000-4000-8000-000000000015",
      materializeHostKey: async () => ({
        path: "/tmp/known_hosts",
        cleanup: async () => {
          expect(tunnelStopped).toBe(true)
          hostKeyCleaned = true
        },
      }),
      runSsh: async () => ({
        code: 0,
        signal: null,
        stdout: '{"attached":true,"port":4209,"username":"slopcode","password":"secret"}\n',
        stderr: "",
      }),
      openTunnel: () => ({
        port: Promise.resolve(4109),
        stop: async () => {
          tunnelStopStarted.resolve()
          await releaseTunnelStop.promise
          tunnelStopped = true
        },
        onExit: () => undefined,
        onError: () => undefined,
      }),
      health: async () => true,
      validateRemoteDirectory: async (_url, _password, directory) => ({ directory }),
    })

    const ready = await service.ensureWorkspace(fixtureTarget())
    const stopping = service.stopWorkspace(ready.id)
    await tunnelStopStarted.promise
    expect(hostKeyCleaned).toBe(false)

    releaseTunnelStop.resolve()
    await stopping
    expect(hostKeyCleaned).toBe(true)
  })

  test("uses the proxy-owned loopback port without allocating a fixed local port", async () => {
    const assigned = deferred<number>()
    const opened = deferred<void>()
    let allocations = 0
    let args: string[] = []
    let forwardPort = 0
    let ownedPort: number | undefined
    let ownerClosed = Promise.resolve()
    let healthUrl: string | undefined
    const service = createSshRemoteHostService({
      allocatePort: async () => {
        allocations += 1
        return 4210
      },
      uuid: () => "00000000-0000-4000-8000-000000000010",
      materializeHostKey: async () => ({
        path: "/tmp/known_hosts",
        cleanup: async () => undefined,
      }),
      runSsh: async () => ({
        code: 0,
        signal: null,
        stdout: '{"attached":false,"port":4310,"username":"slopcode","password":"secret"}\n',
        stderr: "",
      }),
      openTunnel: (next, port) => {
        args = next
        forwardPort = port
        const owner = createServer()
        ownerClosed = new Promise((resolve) => owner.once("close", resolve))
        const owned = new Promise<number>((resolve, reject) => {
          owner.once("error", reject)
          owner.listen(0, "127.0.0.1", () => {
            const address = owner.address()
            if (typeof address !== "object" || !address) {
              reject(new Error("proxy did not bind"))
              return
            }
            ownedPort = address.port
            opened.resolve()
            resolve(address.port)
          })
        })
        return {
          port: assigned.promise.then(() => owned),
          stop: () => close(owner),
          onExit: () => undefined,
          onError: () => undefined,
        }
      },
      health: async (url) => {
        healthUrl = url
        expect(ownedPort).toBe(Number(new URL(url).port))
        return true
      },
      validateRemoteDirectory: async (_url, _password, directory) => ({ directory }),
    })

    const pending = service.ensureWorkspace(fixtureTarget())
    await opened.promise

    expect(allocations).toBe(1)
    const forward = args[args.indexOf("-W") + 1]
    expect(forward).toBe("127.0.0.1:4310")
    expect(args).not.toContain("-L")
    expect(forwardPort).toBe(4310)
    expect(ownedPort).toBeGreaterThan(0)
    expect(healthUrl).toBeUndefined()

    assigned.resolve(4321)
    const ready = await pending
    expect(healthUrl).toBe(`http://127.0.0.1:${ownedPort}`)
    await service.stopWorkspace(ready.id)
    await ownerClosed
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
        port: Promise.resolve(4101),
        stop: async () => undefined,
        onExit: (cb) => {
          exit = cb
        },
        onError: () => undefined,
      }),
      health: async () => true,
      validateRemoteDirectory: async (_url, _password, directory) => ({ directory }),
    })

    const ready = await service.ensureWorkspace(fixtureTarget())
    exit?.(255, null)
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(service.getState(ready.id)).toEqual({
      kind: "failed",
      id: ready.id,
      host: ready.host,
      workspace: ready.workspace,
      message: "SSH tunnel exited (code=255 signal=null)",
    })
  })

  test("rejects an early tunnel error, redacts its password, and cleans the owned server", async () => {
    const remote = createRemoteMachine()
    const events: string[] = []
    const secret = "00000000-0000-4000-8000-000000000011"
    const service = createSshRemoteHostService({
      allocatePort: async () => 4111,
      uuid: () => secret,
      materializeHostKey: async () => ({
        path: "/tmp/known_hosts",
        cleanup: async () => undefined,
      }),
      runSsh: remote.runSsh,
      openTunnel: () => ({
        port: new Promise<number>(() => undefined),
        stop: async () => undefined,
        onExit: () => undefined,
        onError: (cb) => queueMicrotask(() => cb(new Error(`spawn ssh ENOENT ${secret}`))),
      }),
      health: async () => {
        throw new Error("health should not run")
      },
      validateRemoteDirectory: async () => {
        throw new Error("validation should not run")
      },
    })
    const unsubscribe = service.subscribe((event) => events.push(event.state.kind))
    const target = fixtureTarget()
    const pending = service.ensureWorkspace(target)

    await expect(pending).rejects.toThrow(secret)
    unsubscribe()

    expect(events).toEqual(["validating", "starting", "failed"])
    expect(service.getState(normalizeSshTarget(target).id)).toMatchObject({
      kind: "failed",
      message: "spawn ssh ENOENT [redacted]",
    })
    expect(remote.remote.state).toBeUndefined()
    expect(remote.remote.stops).toBe(1)
  })

  test("rejects an early tunnel exit and cleans the owned server", async () => {
    const remote = createRemoteMachine()
    let exit: ((code: number | null, signal: NodeJS.Signals | null) => void) | undefined
    let healthCalls = 0
    const service = createSshRemoteHostService({
      allocatePort: async () => 4112,
      uuid: () => "00000000-0000-4000-8000-000000000012",
      materializeHostKey: async () => ({
        path: "/tmp/known_hosts",
        cleanup: async () => undefined,
      }),
      runSsh: remote.runSsh,
      openTunnel: () => ({
        port: new Promise<number>(() => undefined),
        stop: async () => undefined,
        onExit: (cb) => {
          exit = cb
          queueMicrotask(() => exit?.(255, null))
        },
        onError: () => undefined,
      }),
      health: async () => {
        healthCalls += 1
        return true
      },
      validateRemoteDirectory: async (_url, _password, directory) => ({ directory }),
    })

    await expect(service.ensureWorkspace(fixtureTarget())).rejects.toThrow("SSH tunnel exited (code=255 signal=null)")

    expect(healthCalls).toBe(0)
    expect(remote.remote.state).toBeUndefined()
    expect(remote.remote.stops).toBe(1)
  })

  test("cleans remote state when a ready tunnel exits unexpectedly", async () => {
    const remote = createRemoteMachine()
    let exit: ((code: number | null, signal: NodeJS.Signals | null) => void) | undefined
    const service = createSshRemoteHostService({
      allocatePort: async () => 4113,
      uuid: () => "00000000-0000-4000-8000-000000000013",
      materializeHostKey: async () => ({
        path: "/tmp/known_hosts",
        cleanup: async () => undefined,
      }),
      runSsh: remote.runSsh,
      openTunnel: () => ({
        port: Promise.resolve(4213),
        stop: async () => undefined,
        onExit: (cb) => {
          exit = cb
        },
        onError: () => undefined,
      }),
      health: async () => true,
      validateRemoteDirectory: async (_url, _password, directory) => ({ directory }),
    })

    const ready = await service.ensureWorkspace(fixtureTarget())
    exit?.(255, null)
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(service.getState(ready.id)?.kind).toBe("failed")
    expect(remote.remote.state).toBeUndefined()
    expect(remote.remote.stops).toBe(1)
  })

  test("publishes failed before asynchronous tunnel and remote cleanup completes", async () => {
    const remote = createRemoteMachine()
    const cleanupStarted = deferred<void>()
    const cleanupFinished = deferred<void>()
    let exit: ((code: number | null, signal: NodeJS.Signals | null) => void) | undefined
    const service = createSshRemoteHostService({
      allocatePort: async () => 4114,
      uuid: () => "00000000-0000-4000-8000-000000000014",
      materializeHostKey: async () => ({
        path: "/tmp/known_hosts",
        cleanup: async () => undefined,
      }),
      runSsh: async (args, script, timeoutMs, signal) => {
        const stopping = !script.includes("expected_password=") && script.includes("matches_server") && !script.includes("nohup sh -se")
        if (stopping) {
          cleanupStarted.resolve()
          await cleanupFinished.promise
        }
        const result = await remote.runSsh(args, script, timeoutMs, signal)
        if (stopping) cleanupFinished.resolve()
        return result
      },
      openTunnel: () => ({
        port: Promise.resolve(4214),
        stop: async () => undefined,
        onExit: (cb) => {
          exit = cb
        },
        onError: () => undefined,
      }),
      health: async () => true,
      validateRemoteDirectory: async (_url, _password, directory) => ({ directory }),
    })

    const ready = await service.ensureWorkspace(fixtureTarget())
    exit?.(255, null)

    expect(service.getState(ready.id)?.kind).toBe("failed")
    await cleanupStarted.promise
    expect(service.getState(ready.id)?.kind).toBe("failed")

    cleanupFinished.resolve()
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(remote.remote.state).toBeUndefined()
    expect(remote.remote.stops).toBe(1)
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
        port: Promise.resolve(4102),
        stop: async () => {
          if (stops) return
          stops += 1
        },
        onExit: () => undefined,
        onError: () => undefined,
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
    expect(runs[0]).toContain('nohup sh -se <<\'EOF\'')
    expect(runs[1]).toContain("expected_password='00000000-0000-4000-8000-000000000003'")
    expect(runs[1]).toContain(`key='${workspaceStateKey(id)}'`)
    expect(runs[1]).toContain('state_file="$state_dir/desktop-ssh-server-$key.state"')
    expect(service.getState(id)?.kind).toBe("stopped")
  })

  test("stops an attached ready workspace explicitly", async () => {
    const remote = createRemoteMachine({
      state: {
        port: 4204,
        password: "attached-secret",
      },
    })
    let stops = 0
    const service = createSshRemoteHostService({
      allocatePort: async () => 4104,
      uuid: () => "00000000-0000-4000-8000-000000000005",
      materializeHostKey: async () => ({
        path: "/tmp/known_hosts",
        cleanup: async () => undefined,
      }),
      runSsh: remote.runSsh,
      openTunnel: () => ({
        port: Promise.resolve(4105),
        stop: async () => {
          stops += 1
        },
        onExit: () => undefined,
        onError: () => undefined,
      }),
      health: async () => true,
      validateRemoteDirectory: async (_url, _password, directory) => ({ directory }),
    })

    const ready = await service.ensureWorkspace(fixtureTarget())
    await service.stopWorkspace(ready.id)

    expect(ready.attached).toBe(true)
    expect(stops).toBe(1)
    expect(remote.remote.state).toBeUndefined()
    expect(remote.remote.stops).toBe(1)
    expect(remote.runs).toHaveLength(2)
    expect(remote.runs[1]).not.toContain("expected_password=")
    expect(service.getState(ready.id)?.kind).toBe("stopped")
  })

  test("serializes a stop before a new ensure for the same workspace", async () => {
    const remote = createRemoteMachine({
      state: {
        port: 4208,
        password: "attached-secret",
      },
    })
    const stopStarted = deferred<void>()
    const releaseStop = deferred<void>()
    let tunnelCount = 0
    const service = createSshRemoteHostService({
      allocatePort: async () => 4108,
      uuid: () => "00000000-0000-4000-8000-000000000009",
      materializeHostKey: async () => ({
        path: "/tmp/known_hosts",
        cleanup: async () => undefined,
      }),
      runSsh: async (args, script, timeoutMs, signal) => {
        if (!script.includes("nohup sh -se <<'EOF'") && !script.includes("expected_password=")) {
          stopStarted.resolve()
          await releaseStop.promise
        }
        return remote.runSsh(args, script, timeoutMs, signal)
      },
      openTunnel: () => {
        tunnelCount += 1
        return {
          port: Promise.resolve(4108),
          stop: async () => undefined,
          onExit: () => undefined,
          onError: () => undefined,
        }
      },
      health: async () => true,
      validateRemoteDirectory: async (_url, _password, directory) => ({ directory }),
    })

    const first = await service.ensureWorkspace(fixtureTarget())
    const stopping = service.stopWorkspace(first.id)
    await stopStarted.promise

    const second = service.ensureWorkspace(fixtureTarget())
    await new Promise((resolve) => setTimeout(resolve, 10))
    expect(tunnelCount).toBe(1)

    releaseStop.resolve()
    await stopping
    await second

    expect(tunnelCount).toBe(2)
    expect(remote.remote.state).toBeDefined()
    expect(remote.remote.starts).toBe(1)
    expect(remote.remote.stops).toBe(1)
  })

  test("does not stop an attached server when startup fails after attach", async () => {
    const remote = createRemoteMachine({
      state: {
        port: 4205,
        password: "attached-secret",
      },
    })
    let stops = 0
    let cleanups = 0
    const service = createSshRemoteHostService({
      allocatePort: async () => 4105,
      uuid: () => "00000000-0000-4000-8000-000000000006",
      materializeHostKey: async () => ({
        path: "/tmp/known_hosts",
        cleanup: async () => {
          cleanups += 1
        },
      }),
      runSsh: remote.runSsh,
      openTunnel: () => ({
        port: Promise.resolve(4105),
        stop: async () => {
          stops += 1
        },
        onExit: () => undefined,
        onError: () => undefined,
      }),
      health: async () => true,
      validateRemoteDirectory: async () => {
        throw new Error("validation failed")
      },
    })

    const target = fixtureTarget()
    const id = normalizeSshTarget(target).id
    await expect(service.ensureWorkspace(target)).rejects.toThrow("validation failed")

    expect(stops).toBe(1)
    expect(cleanups).toBe(1)
    expect(remote.remote.state).toEqual({
      port: 4205,
      password: "attached-secret",
    })
    expect(remote.remote.stops).toBe(0)
    expect(remote.runs).toHaveLength(2)
    expect(remote.runs[1]).toContain("expected_password='00000000-0000-4000-8000-000000000006'")
    expect(service.getState(id)).toEqual({
      kind: "failed",
      id,
      host: target.host,
      workspace: normalizeSshTarget(target).workspace,
      message: "validation failed",
    })
  })

  test("does not stop an attached server when startup is cancelled during health checks", async () => {
    const events: string[] = []
    const remote = createRemoteMachine({
      state: {
        port: 4203,
        password: "attached-secret",
      },
    })
    const gate = deferred<void>()
    let stops = 0
    let cleanups = 0
    const service = createSshRemoteHostService({
      allocatePort: async () => 4103,
      uuid: () => "00000000-0000-4000-8000-000000000004",
      materializeHostKey: async () => ({
        path: "/tmp/known_hosts",
        cleanup: async () => {
          cleanups += 1
        },
      }),
      runSsh: remote.runSsh,
      openTunnel: () => ({
        port: Promise.resolve(4103),
        stop: async () => {
          if (stops) return
          stops += 1
        },
        onExit: () => undefined,
        onError: () => undefined,
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
    expect(remote.remote.state).toEqual({
      port: 4203,
      password: "attached-secret",
    })
    expect(remote.remote.stops).toBe(0)
    expect(remote.runs).toHaveLength(2)
    expect(remote.runs[0]).toContain(
      'printf \'{"attached":true,"port":%s,"username":"slopcode","password":"%s"}\\n\' "$state_port" "$state_password"',
    )
    expect(remote.runs[1]).toContain("expected_password='00000000-0000-4000-8000-000000000004'")
    expect(service.getState(id)?.kind).toBe("stopped")
  })

  test("removes stale state without killing a reused pid on explicit stop", async () => {
    const remote = createRemoteMachine()
    const service = createSshRemoteHostService({
      allocatePort: async () => 4107,
      uuid: () => "00000000-0000-4000-8000-000000000008",
      materializeHostKey: async () => ({
        path: "/tmp/known_hosts",
        cleanup: async () => undefined,
      }),
      runSsh: remote.runSsh,
      openTunnel: () => ({
        port: Promise.resolve(4107),
        stop: async () => undefined,
        onExit: () => undefined,
        onError: () => undefined,
      }),
      health: async () => true,
      validateRemoteDirectory: async (_url, _password, directory) => ({ directory }),
    })

    const ready = await service.ensureWorkspace(fixtureTarget())
    remote.remote.state = {
      port: remote.remote.state?.port ?? 4207,
      password: ready.password,
      server: false,
    }
    await service.stopWorkspace(ready.id)

    expect(remote.remote.state).toBeUndefined()
    expect(remote.remote.stops).toBe(0)
    expect(remote.runs.at(-1)).toContain('if ! matches_server "$state_pid" "$state_port" "$state_start" "$state_exe"; then')
  })

  test("cleans launched bootstrap state on abort before bootstrap JSON is parsed", async () => {
    const remote = createRemoteMachine({ abortAfterLaunch: true })
    const events: string[] = []
    let cleanups = 0
    let tunnels = 0
    const service = createSshRemoteHostService({
      allocatePort: async () => 4106,
      uuid: () => "00000000-0000-4000-8000-000000000007",
      materializeHostKey: async () => ({
        path: "/tmp/known_hosts",
        cleanup: async () => {
          cleanups += 1
        },
      }),
      runSsh: remote.runSsh,
      openTunnel: () => {
        tunnels += 1
        return {
          port: Promise.resolve(4106),
          stop: async () => undefined,
          onExit: () => undefined,
          onError: () => undefined,
        }
      },
      health: async () => true,
      validateRemoteDirectory: async (_url, _password, directory) => ({ directory }),
    })

    const target = fixtureTarget()
    const id = normalizeSshTarget(target).id
    const unsubscribe = service.subscribe((event) => events.push(event.state.kind))
    const pending = service.ensureWorkspace(target)
    await remote.launched.promise
    await service.stopWorkspace(id)
    unsubscribe()

    await expect(pending).rejects.toThrow("aborted")
    expect(events).toEqual(["validating", "starting", "stopped"])
    expect(cleanups).toBe(1)
    expect(tunnels).toBe(0)
    expect(remote.remote.state).toBeUndefined()
    expect(remote.remote.stops).toBe(1)
    expect(remote.runs).toHaveLength(2)
    expect(remote.runs[1]).toContain("expected_password='00000000-0000-4000-8000-000000000007'")
    expect(remote.runs[1]).toContain('while [ ! -f "$state_file" ] && [ "$tries" -gt 0 ]; do')
    expect(remote.runs[1]).toContain('if ! wait_for_server 20; then')
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

class TunnelChild extends EventEmitter {
  readonly stdin = new PassThrough()
  readonly stdout = new PassThrough()
  readonly stderr = new PassThrough()
  killCalls = 0
  killSignals: Array<NodeJS.Signals | undefined> = []
  killError: Error | undefined
  exited = false

  constructor() {
    super()
    this.stdin.on("data", (chunk: Buffer) => this.stdout.write(chunk))
  }

  kill(signal?: NodeJS.Signals) {
    this.killCalls += 1
    this.killSignals.push(signal)
    if (this.killError) throw this.killError
    return true
  }

  finish(code: number | null = null) {
    if (this.exited) return
    this.exited = true
    this.emit("exit", code, null)
  }
}

class CollisionServer extends EventEmitter {
  listening = false

  listen() {
    queueMicrotask(() => {
      this.emit("error", Object.assign(new Error("proxy busy"), { code: "EADDRINUSE" }))
    })
    return this
  }

  close(callback?: (error?: Error) => void) {
    callback?.()
    return this
  }

  address() {
    return null
  }
}

function listen(server: Server, endpoint: string | number) {
  return new Promise<void>((resolve, reject) => {
    server.once("error", reject)
    server.listen(endpoint, resolve)
  })
}

function close(server: Server) {
  if (!server.listening) return Promise.resolve()
  return new Promise<void>((resolve) => server.close(() => resolve()))
}

function onceConnected(socket: ReturnType<typeof createConnection>) {
  return new Promise<void>((resolve, reject) => {
    socket.once("connect", resolve)
    socket.once("error", reject)
  })
}

function read(socket: ReturnType<typeof createConnection>) {
  socket.setEncoding("utf8")
  return new Promise<string>((resolve, reject) => {
    socket.once("data", resolve)
    socket.once("error", reject)
  })
}

async function canBind(port: number) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const result = await tryBind(port)
    if (result) return true
    await new Promise((resolve) => setTimeout(resolve, 5))
  }
  return false
}

function allocateTestPort() {
  return new Promise<number>((resolve, reject) => {
    const server = createServer()
    server.once("error", reject)
    server.listen(0, "127.0.0.1", () => {
      const address = server.address()
      if (typeof address !== "object" || !address) {
        server.close()
        reject(new Error("test port allocation failed"))
        return
      }
      server.close(() => resolve(address.port))
    })
  })
}

function tryBind(port: number) {
  return new Promise<boolean>((resolve) => {
    const server = createServer()
    server.once("error", () => resolve(false))
    server.listen(port, "127.0.0.1", () => server.close(() => resolve(true)))
  })
}

function runMatcher(
  script: string,
  opts: {
    pid?: string
    port?: string
    stateStart?: string
    processStart?: string
    stateExe?: string
    processExe?: string
    comm: string
    command: string
  },
) {
  const pid = opts.pid ?? "4321"
  const port = opts.port ?? "4200"
  const stateStart = opts.stateStart ?? "start"
  const processStart = opts.processStart ?? stateStart
  const stateExe = opts.stateExe ?? "/usr/bin/slopcode"
  const processExe = opts.processExe ?? opts.comm
  const identity = script.slice(script.indexOf("process_start() {"), script.indexOf("matches_server() {"))
  const fn = match(script, /(^matches_server\(\) \{[\s\S]*?^})/m)
  const input = [
    "set -eu",
    `pid=${shellQuote(pid)}`,
    `port=${shellQuote(port)}`,
    `state_start=${shellQuote(stateStart)}`,
    `state_exe=${shellQuote(stateExe)}`,
    `comm=${shellQuote(opts.comm)}`,
    `command=${shellQuote(opts.command)}`,
    `processStart=${shellQuote(processStart)}`,
    `processExe=${shellQuote(processExe)}`,
    "comm_calls=0",
    "ps() {",
    '  if [ "$1" = "-p" ] && [ "$2" = "$pid" ] && [ "$3" = "-o" ] && [ "$4" = "comm=" ]; then',
    '    comm_calls=$((comm_calls + 1))',
    '    if [ "$comm_calls" -eq 1 ]; then printf \'%s\\n\' "$processExe"; else printf \'%s\\n\' "$comm"; fi',
    "    return 0",
    "  fi",
    '  if [ "$1" = "-p" ] && [ "$2" = "$pid" ] && [ "$3" = "-o" ] && [ "$4" = "lstart=" ]; then',
    '    printf \'%s\\n\' "$processStart"',
    "    return 0",
    "  fi",
    '  if [ "$1" = "-p" ] && [ "$2" = "$pid" ] && [ "$3" = "-o" ] && [ "$4" = "command=" ]; then',
    '    printf \'%s\\n\' "$command"',
    "    return 0",
    "  fi",
    "  return 1",
    "}",
    identity,
    fn,
    'matches_server "$pid" "$port" "$state_start" "$state_exe"',
  ].join("\n")
  const result = spawnSync("sh", ["-se"], {
    input,
    encoding: "utf8",
  })
  return result.status ?? 1
}

function createRemoteMachine(
  opts: {
    state?: {
      port: number
      password: string
      server?: boolean
    }
    abortAfterLaunch?: boolean
  } = {},
) {
  const runs: string[] = []
  const launched = deferred<void>()
  const remote = {
    state: opts.state,
    starts: 0,
    stops: 0,
  }

  return {
    runs,
    launched,
    remote,
    runSsh: async (_args: string[], script: string, _timeoutMs: number, signal?: AbortSignal) => {
      runs.push(script)

      if (script.includes('nohup sh -se <<\'EOF\'')) {
        if (remote.state?.server !== false && remote.state) {
          return {
            code: 0,
            signal: null,
            stdout: `{"attached":true,"port":${remote.state.port},"username":"slopcode","password":"${remote.state.password}"}\n`,
            stderr: "",
          }
        }

        remote.starts += 1
        remote.state = {
          port: Number(match(script, /^PORT=(\d+)$/m)),
          password: match(script, /^PASSWORD='([^']+)'$/m),
          server: true,
        }
        launched.resolve()
        if (opts.abortAfterLaunch) {
          return await new Promise((_, reject) => {
            if (signal?.aborted) {
              reject(testAbortError())
              return
            }
            signal?.addEventListener("abort", () => reject(testAbortError()), { once: true })
          })
        }
        return {
          code: 0,
          signal: null,
          stdout: `{"attached":false,"port":${remote.state.port},"username":"slopcode","password":"${remote.state.password}"}\n`,
          stderr: "",
        }
      }

      const expected = matchOptional(script, /^expected_password='([^']+)'$/m)
      if (remote.state && (!expected || remote.state.password === expected)) {
        if (remote.state.server === false) {
          remote.state = undefined
        } else {
          remote.state = undefined
          remote.stops += 1
        }
      }
      if (
        remote.state &&
        remote.state.server === false &&
        !expected &&
        script.includes('if ! matches_server "$state_pid" "$state_port" "$state_start" "$state_exe"; then')
      ) {
        remote.state = undefined
      }
      if (signal?.aborted) throw signal.reason
      return {
        code: 0,
        signal: null,
        stdout: "",
        stderr: "",
      }
    },
  }
}

function match(value: string, pattern: RegExp) {
  const result = pattern.exec(value)?.[1]
  if (result) return result
  throw new Error(`Missing ${pattern}`)
}

function matchOptional(value: string, pattern: RegExp) {
  return pattern.exec(value)?.[1]
}

function testAbortError() {
  return Object.assign(new Error("SSH workspace start aborted"), { name: "AbortError" })
}

function shellQuote(value: string) {
  return `'${value.replaceAll("'", `'\"'\"'`)}'`
}
