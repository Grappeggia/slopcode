import { spawnSync } from "node:child_process"
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
    const guardedStop = buildSshStopScript(first, "secret")

    expect(first.stateKey).not.toBe(second.stateKey)
    expect(bootstrap).toContain(`key='${first.stateKey}'`)
    expect(bootstrap).toContain('state_file="$state_dir/desktop-ssh-server-$key.state"')
    expect(bootstrap).toContain('log_file="$state_dir/desktop-ssh-server-$key.log"')
    expect(stop).toContain(`key='${first.stateKey}'`)
    expect(stop).toContain('state_file="$state_dir/desktop-ssh-server-$key.state"')
    expect(guardedStop).toContain("expected_password='secret'")
    expect(bootstrap).toContain("read_state() {")
    expect(bootstrap).toContain('printf \'%s\\n\' "$$" "$PORT" "$PASSWORD" "$DIR" >"$tmp"')
    expect(bootstrap).not.toContain('. "$state_file"')
    expect(bootstrap).not.toContain('DIRECTORY="$dir"')
    expect(stop).toContain('if ! matches_server "$state_pid" "$state_port"; then')
    expect(stop).toContain('comm="$(ps -p "$pid" -o comm= 2>/dev/null || true)"')
    expect(stop).toContain('cmd="$(ps -p "$pid" -o command= 2>/dev/null || true)"')
    expect(stop).toContain('case "$1" in')
    expect(stop).toContain('slopcode|*/slopcode) ;;')
    expect(stop).not.toContain('. "$state_file"')
    expect(guardedStop).toContain('if [ "$state_password" != "$expected_password" ]; then')
    expect(guardedStop).toContain('while [ ! -f "$state_file" ] && [ "$tries" -gt 0 ]; do')
    expect(guardedStop).toContain('if ! wait_for_server 20; then')
    expect(bootstrap).toContain("cd \"$dir\"")
    expect(stop).not.toContain("/srv/slopcode")
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
    expect(bootstrap).toContain('printf \'%s\\n\' "$$" "$PORT" "$PASSWORD" "$DIR" >"$tmp"')
    expect(bootstrap).not.toContain('. "$state_file"')
    expect(bootstrap).not.toContain("cd /srv/remote dir/$(touch nope)`rm -f nope`")
    expect(stop).not.toContain("/srv/remote dir/$(touch nope)`rm -f nope`")
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
        stop: () => {
          stops += 1
        },
        onExit: () => undefined,
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
        stop: () => {
          stops += 1
        },
        onExit: () => undefined,
      }),
      health: async () => true,
      validateRemoteDirectory: async () => {
        throw new Error("validation failed")
      },
    })

    const target = fixtureTarget()
    const id = normalizeSshTarget(target).id
    await expect(service.ensureWorkspace(target)).rejects.toThrow("validation failed")

    expect(stops).toBe(2)
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
        stop: () => undefined,
        onExit: () => undefined,
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
    expect(remote.runs.at(-1)).toContain('if ! matches_server "$state_pid" "$state_port"; then')
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
          stop: () => undefined,
          onExit: () => undefined,
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

function runMatcher(
  script: string,
  opts: {
    pid?: string
    port?: string
    comm: string
    command: string
  },
) {
  const pid = opts.pid ?? "4321"
  const port = opts.port ?? "4200"
  const fn = match(script, /(^matches_server\(\) \{[\s\S]*?^})/m)
  const input = [
    "set -eu",
    `pid=${shellQuote(pid)}`,
    `port=${shellQuote(port)}`,
    `comm=${shellQuote(opts.comm)}`,
    `command=${shellQuote(opts.command)}`,
    "ps() {",
    '  if [ "$1" = "-p" ] && [ "$2" = "$pid" ] && [ "$3" = "-o" ] && [ "$4" = "comm=" ]; then',
    '    printf \'%s\\n\' "$comm"',
    "    return 0",
    "  fi",
    '  if [ "$1" = "-p" ] && [ "$2" = "$pid" ] && [ "$3" = "-o" ] && [ "$4" = "command=" ]; then',
    '    printf \'%s\\n\' "$command"',
    "    return 0",
    "  fi",
    "  return 1",
    "}",
    fn,
    'matches_server "$pid" "$port"',
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
      if (remote.state && remote.state.server === false && !expected && script.includes('if ! matches_server "$state_pid" "$state_port"; then')) {
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
