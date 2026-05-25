import { afterEach, describe, expect, test } from "bun:test"
import { DaemonAuth } from "../../src/daemon/auth"
import { DaemonLauncher } from "../../src/daemon/launcher"
import { DaemonRegistry } from "../../src/daemon/registry"
import { Log } from "../../src/util/log"
import { tmpdir } from "../fixture/fixture"

Log.init({ print: false })

async function eventually(check: () => boolean | Promise<boolean>, timeout = 10_000) {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    if (await check()) return
    await Bun.sleep(50)
  }
  throw new Error("condition not met")
}

afterEach(async () => {
  // no-op per test cleanup handles shutdown
})

describe("daemon launcher", () => {
  test("reuses an existing daemon for the same directory", async () => {
    await using tmp = await tmpdir({ git: true })
    const first = await DaemonLauncher.ensure({ directory: tmp.path })
    const one = await fetch(new URL("/daemon/status", first.url), {
      headers: first.headers,
    }).then((x) => x.json() as Promise<{ directory: string; pid: number }>)

    const second = await DaemonLauncher.ensure({ directory: tmp.path })
    const two = await fetch(new URL("/daemon/status", second.url), {
      headers: second.headers,
    }).then((x) => x.json() as Promise<{ pid: number }>)

    expect(DaemonRegistry.normalize(one.directory)).toBe(tmp.path)
    expect(second.url).toBe(first.url)
    expect(second.headers[DaemonAuth.Header]).toBe(first.headers[DaemonAuth.Header])
    expect(two.pid).toBe(one.pid)

    try {
      process.kill(one.pid, "SIGTERM")
    } catch {}

    await eventually(async () => !(await DaemonRegistry.read(tmp.path)))
  }, 20000)

  test("isolates daemons by cli view id", async () => {
    await using tmp = await tmpdir({ git: true })
    const a = await DaemonLauncher.ensure({ directory: tmp.path, viewID: "view-a" })
    const one = await fetch(new URL("/daemon/status", a.url), {
      headers: a.headers,
    }).then((x) => x.json() as Promise<{ pid: number; view_id?: string }>)

    const b = await DaemonLauncher.ensure({ directory: tmp.path, viewID: "view-b" })
    const two = await fetch(new URL("/daemon/status", b.url), {
      headers: b.headers,
    }).then((x) => x.json() as Promise<{ pid: number; view_id?: string }>)

    expect(one.view_id).toBe("view-a")
    expect(two.view_id).toBe("view-b")
    expect(a.url).not.toBe(b.url)
    expect(a.headers[DaemonAuth.Header]).not.toBe(b.headers[DaemonAuth.Header])
    expect(one.pid).not.toBe(two.pid)

    try {
      process.kill(one.pid, "SIGTERM")
    } catch {}
    try {
      process.kill(two.pid, "SIGTERM")
    } catch {}

    await eventually(async () => !(await DaemonRegistry.read(tmp.path, "view-a")))
    await eventually(async () => !(await DaemonRegistry.read(tmp.path, "view-b")))
  }, 20000)
})
