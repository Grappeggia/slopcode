import { afterEach, describe, expect, test } from "bun:test"
import { createServer, type Server } from "node:http"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  createBackgroundCli,
  checkBackgroundCliHealth,
  processIdentityStrategy,
  type BackgroundCliLogger,
} from "./background-cli"

const roots: string[] = []
const logger: BackgroundCliLogger = { log() {}, warn() {}, error() {} }

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

describe("background CLI lifecycle", () => {
  test("does not use macOS ps lstart as a recovered-process identity", async () => {
    expect(processIdentityStrategy("darwin")).toBe("authenticated-health-only")
    expect(processIdentityStrategy("linux")).toBe("process-start")
    expect(processIdentityStrategy("win32")).toBe("process-start")
  })

  test("coalesces starts and reuses one healthy process", async () => {
    const fixture = await setup()
    const starts: number[] = []
    const cli = createBackgroundCli(fixture.options, {
      version: async () => "1.2.3",
      fingerprint: async () => "abc123",
      spawn: () => {
        starts.push(101)
        return child(101)
      },
      alive: () => true,
      health: async () => ({ healthy: true, version: "1.2.3" }),
    })

    const [first, second] = await Promise.all([cli.start(), cli.start()])
    expect(first).toEqual(second)
    expect(starts).toEqual([101])
    expect(await cli.start()).toEqual(first)
    expect(starts).toEqual([101])
  })

  test("recovers a healthy persisted service without spawning", async () => {
    const fixture = await setup()
    await fixture.state({ version: "1.2.3", fingerprint: "abc123", pid: 102 })
    let spawned = false
    const cli = createBackgroundCli(fixture.options, {
      version: async () => "1.2.3",
      fingerprint: async () => "abc123",
      alive: () => true,
      health: async () => ({ healthy: true, version: "1.2.3" }),
      identity: async () => "birth-102",
      spawn: () => {
        spawned = true
        return child(103)
      },
    })

    expect(await cli.start()).toMatchObject({
      url: "http://127.0.0.1:1234",
      password: "old-password",
      remoteHostID: "hst_old",
      remoteSupervisorToken: "old-token",
    })
    expect(spawned).toBe(false)
    expect(await cli.status()).toEqual({
      status: "running",
      pid: 102,
      url: "http://127.0.0.1:1234",
      version: "1.2.3",
    })
  })

  test("reports an authenticated healthy recovered macOS service as running", async () => {
    const fixture = await setup()
    await fixture.state({ version: "1.2.3", fingerprint: "abc123", pid: 103 })
    const platform = Object.getOwnPropertyDescriptor(process, "platform")
    Object.defineProperty(process, "platform", { value: "darwin" })
    try {
      const cli = createBackgroundCli(fixture.options, {
        alive: () => true,
        identity: async () => undefined,
        health: async () => ({ healthy: true, version: "1.2.3" }),
      })

      expect(await cli.status()).toEqual({
        status: "running",
        pid: 103,
        url: "http://127.0.0.1:1234",
        version: "1.2.3",
      })
    } finally {
      Object.defineProperty(process, "platform", platform!)
    }
  })

  test("replaces an identified recovered service after its health is lost", async () => {
    const fixture = await setup()
    await fixture.state({ version: "1.2.3", fingerprint: "abc123", pid: 104 })
    const stopped: number[] = []
    const started: number[] = []
    let healthy = true
    const cli = createBackgroundCli(fixture.options, {
      version: async () => "1.2.3",
      fingerprint: async () => "abc123",
      alive: () => true,
      identity: async (pid) => `birth-${pid}`,
      health: async (state) => ({
        healthy: state.pid === 104 ? healthy : true,
        version: state.pid === 104 && !healthy ? undefined : "1.2.3",
      }),
      stop: async (pid) => {
        stopped.push(pid)
      },
      spawn: () => {
        started.push(105)
        return child(105)
      },
    })

    await cli.start()
    healthy = false
    await cli.start()

    expect(stopped).toEqual([104])
    expect(started).toEqual([105])
    expect(JSON.parse(await readFile(fixture.file, "utf8"))).toMatchObject({ pid: 105 })
  })

  test("restarts an authenticated service after a version mismatch", async () => {
    const fixture = await setup()
    await fixture.state({ version: "1.0.0", fingerprint: "old", pid: 41 })
    const stopped: number[] = []
    const started: number[] = []
    const cli = createBackgroundCli(fixture.options, {
      version: async () => "2.0.0",
      fingerprint: async () => "new",
      alive: () => true,
      identity: async () => "birth-41",
      health: async (state) => ({ healthy: true, version: state.password === "old-password" ? "1.0.0" : "2.0.0" }),
      stop: async (pid) => {
        stopped.push(pid)
      },
      spawn: () => {
        started.push(42)
        return child(42)
      },
    })

    await cli.start()
    expect(stopped).toEqual([41])
    expect(started).toEqual([42])
    expect(JSON.parse(await readFile(fixture.file, "utf8"))).toMatchObject({
      version: "2.0.0",
      fingerprint: "new",
      pid: 42,
    })
  })

  test("cleans up a spawned process when health never succeeds", async () => {
    const fixture = await setup()
    const stopped: number[] = []
    const cli = createBackgroundCli(fixture.options, {
      version: async () => "1.2.3",
      fingerprint: async () => "abc123",
      spawn: () =>
        child(77, async () => {
          stopped.push(77)
        }),
      health: async () => ({ healthy: false }),
      wait: async () => undefined,
    })

    await expect(cli.start()).rejects.toThrow("health check timed out")
    expect(stopped).toEqual([77])
    expect(await Bun.file(fixture.file).exists()).toBe(false)
  })

  test("cleans up an identity-matched recovered process when health fails", async () => {
    const fixture = await setup()
    await fixture.state({ version: "1.2.3", fingerprint: "abc123", pid: 78 })
    const stopped: number[] = []
    const cli = createBackgroundCli(fixture.options, {
      version: async () => "1.2.3",
      fingerprint: async () => "abc123",
      alive: () => true,
      identity: async () => "birth-78",
      health: async (state) => ({
        healthy: state.password !== "old-password",
        version: state.password !== "old-password" ? "1.2.3" : undefined,
      }),
      stop: async (pid) => {
        stopped.push(pid)
      },
      spawn: () => child(79),
    })

    await cli.start()
    expect(stopped).toEqual([78])
    expect(JSON.parse(await readFile(fixture.file, "utf8"))).toMatchObject({ pid: 79 })
  })

  test("reports binary inspection errors without spawning", async () => {
    const fixture = await setup()
    let spawned = false
    const cli = createBackgroundCli(fixture.options, {
      version: async () => {
        throw new Error("permission denied")
      },
      spawn: () => {
        spawned = true
        return child(1)
      },
    })

    await expect(cli.start()).rejects.toThrow("Failed to read bundled CLI version: permission denied")
    expect(spawned).toBe(false)
  })

  test("reports spawn failures with lifecycle context", async () => {
    const fixture = await setup()
    const cli = createBackgroundCli(fixture.options, {
      version: async () => "1.2.3",
      fingerprint: async () => "abc123",
      spawn: () => {
        throw new Error("EACCES")
      },
    })

    await expect(cli.start()).rejects.toThrow("Failed to spawn background CLI: EACCES")
    expect(await Bun.file(fixture.file).exists()).toBe(false)
  })

  test("cleans up a process when OS identity inspection fails", async () => {
    const fixture = await setup()
    const stopped: number[] = []
    const cli = createBackgroundCli(fixture.options, {
      version: async () => "1.2.3",
      fingerprint: async () => "abc123",
      spawn: () => ({
        pid: 87,
        identity: Promise.reject(new Error("identity unavailable")),
        exit: new Promise<number | null>(() => {}),
        stop: async () => {
          stopped.push(87)
        },
      }),
    })

    await expect(cli.start()).rejects.toThrow("Failed to identify background CLI: identity unavailable")
    expect(stopped).toEqual([87])
  })

  test("stops an owned process even after its health endpoint fails", async () => {
    const fixture = await setup()
    const stopped: number[] = []
    let healthy = true
    const cli = createBackgroundCli(fixture.options, {
      version: async () => "1.2.3",
      fingerprint: async () => "abc123",
      spawn: () =>
        child(88, async () => {
          stopped.push(88)
        }),
      alive: () => true,
      health: async () => ({ healthy, version: healthy ? "1.2.3" : undefined }),
    })

    await cli.start()
    healthy = false
    await cli.stop()
    expect(stopped).toEqual([88])
    expect(await Bun.file(fixture.file).exists()).toBe(false)
  })

  test("does not signal a recovered PID when its OS identity changes after health", async () => {
    const fixture = await setup()
    await fixture.state({ version: "1.2.3", fingerprint: "abc123", pid: 90 })
    const stopped: number[] = []
    let identity = "birth-90"
    const cli = createBackgroundCli(fixture.options, {
      version: async () => "1.2.3",
      fingerprint: async () => "abc123",
      alive: () => true,
      health: async () => ({ healthy: true, version: "1.2.3" }),
      identity: async () => identity,
      stop: async (pid) => {
        stopped.push(pid)
      },
    })

    await cli.start()
    identity = "reused-90"
    expect(await cli.status()).toMatchObject({ status: "stale", pid: 90 })
    await cli.stop()
    expect(stopped).toEqual([])
  })

  test("forwards desktop environment and remote identity to a new service", async () => {
    const fixture = await setup()
    let env: NodeJS.ProcessEnv | undefined
    const cli = createBackgroundCli(
      { ...fixture.options, env: { SLOPCODE_DISABLE_CHANNEL_DB: "1" } },
      {
        version: async () => "1.2.3",
        fingerprint: async () => "abc123",
        spawn: (_binary, _args, value) => {
          env = value
          return child(91)
        },
        health: async () => ({ healthy: true, version: "1.2.3" }),
      },
    )

    const result = await cli.start()
    expect(env).toMatchObject({
      SLOPCODE_DISABLE_CHANNEL_DB: "1",
      SLOPCODE_REMOTE_HOST_ID: "hst_new",
      SLOPCODE_REMOTE_SUPERVISOR_TOKEN: "new-token",
    })
    expect(result).toMatchObject({ remoteHostID: "hst_new", remoteSupervisorToken: "new-token" })
  })

  test("stops an identity-matched recovered PID after health is lost", async () => {
    const fixture = await setup()
    await fixture.state({ version: "1.2.3", fingerprint: "abc123", pid: 89 })
    const stopped: number[] = []
    let healthy = true
    const cli = createBackgroundCli(fixture.options, {
      version: async () => "1.2.3",
      fingerprint: async () => "abc123",
      alive: () => true,
      health: async () => ({ healthy, version: healthy ? "1.2.3" : undefined }),
      identity: async () => "birth-89",
      stop: async (pid) => {
        stopped.push(pid)
      },
    })

    await cli.start()
    healthy = false
    await cli.stop()
    expect(stopped).toEqual([89])
    expect(await Bun.file(fixture.file).exists()).toBe(false)
  })

  test("waits for shutdown before starting a replacement", async () => {
    const fixture = await setup()
    const gate = Promise.withResolvers<void>()
    const started: number[] = []
    const cli = createBackgroundCli(fixture.options, {
      version: async () => "1.2.3",
      fingerprint: async () => "abc123",
      alive: () => true,
      health: async () => ({ healthy: true, version: "1.2.3" }),
      spawn: () => {
        const pid = 120 + started.length
        started.push(pid)
        return child(pid, async () => gate.promise)
      },
    })

    await cli.start()
    const stopping = cli.stop()
    const restarting = cli.start()
    await Promise.resolve()
    expect(started).toEqual([120])
    gate.resolve()
    await stopping
    await restarting
    expect(started).toEqual([120, 121])
  })

  test("uses authenticated loopback health and rejects non-loopback state", async () => {
    const password = "secret"
    const server = createServer((request, response) => {
      if (request.headers.authorization !== `Basic ${Buffer.from(`slopcode:${password}`).toString("base64")}`) {
        response.writeHead(401).end()
        return
      }
      response
        .writeHead(200, { "content-type": "application/json" })
        .end(JSON.stringify({ healthy: true, version: "3.0.0" }))
    })
    const port = await listen(server)

    expect(await checkBackgroundCliHealth({ url: `http://127.0.0.1:${port}`, username: "slopcode", password })).toEqual(
      { healthy: true, version: "3.0.0" },
    )
    expect(await checkBackgroundCliHealth({ url: "https://example.com:443", username: "slopcode", password })).toEqual({
      healthy: false,
    })
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())))
  })
})

async function setup() {
  const root = await mkdtemp(join(tmpdir(), "slopcode-background-cli-"))
  roots.push(root)
  const source = join(root, "source")
  await writeFile(source, "binary")
  const options = {
    source,
    userData: root,
    hostname: "127.0.0.1" as const,
    port: 4321,
    username: "slopcode" as const,
    password: "new-password",
    remote: { hostID: "hst_new", token: "new-token" },
    logger,
  }
  const file = join(root, "background-cli", "service.json")
  return {
    options,
    file,
    state: async (input: { version: string; fingerprint: string; pid: number }) => {
      await Bun.write(
        file,
        JSON.stringify({
          schema: 2,
          ...input,
          identity: `birth-${input.pid}`,
          url: "http://127.0.0.1:1234",
          username: "slopcode",
          password: "old-password",
          remoteHostID: "hst_old",
          remoteSupervisorToken: "old-token",
        }),
      )
    },
  }
}

function listen(server: Server) {
  return new Promise<number>((resolve, reject) => {
    server.once("error", reject)
    server.listen(0, "127.0.0.1", () => {
      const address = server.address()
      if (!address || typeof address === "string") {
        reject(new Error("missing test server address"))
        return
      }
      resolve(address.port)
    })
  })
}

function child(pid: number, stop: () => Promise<void> = async () => undefined) {
  return { pid, stop, identity: Promise.resolve(`birth-${pid}`), exit: new Promise<number | null>(() => {}) }
}
