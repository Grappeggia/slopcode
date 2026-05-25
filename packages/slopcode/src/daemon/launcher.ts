import type { NetworkOptions } from "@/cli/network"
import { DaemonAuth } from "@/daemon/auth"
import { DaemonRegistry } from "@/daemon/registry"
import { DaemonRuntime } from "@/daemon/runtime"
import { Config } from "@/config/config"
import { Installation } from "@/installation"
import { Instance } from "@/project/instance"
import { randomUUID } from "crypto"
import { spawn } from "child_process"
import { fileURLToPath } from "url"
import z from "zod"

export namespace DaemonLauncher {
  type Status = z.output<typeof DaemonRuntime.Status>

  function headers(token: string) {
    return {
      [DaemonAuth.Header]: token,
    }
  }

  async function status(info: DaemonRegistry.Info) {
    const response = await fetch(new URL("/daemon/status", info.url), {
      headers: headers(info.token),
    }).catch(() => undefined)
    if (!response?.ok) return
    const json = await response.json().catch(() => undefined)
    const parsed = DaemonRuntime.Status.safeParse(json)
    if (!parsed.success) return
    return parsed.data
  }

  async function current(directory: string, viewID?: string) {
    const info = await DaemonRegistry.read(directory, viewID)
    if (!info) return
    const health = await status(info)
    if (!health) return
    if (DaemonRegistry.normalize(health.directory) !== DaemonRegistry.normalize(directory)) return
    if ((health.view_id ?? undefined) !== viewID) return
    return { info, health }
  }

  async function wanted(directory: string) {
    return Instance.provide({
      directory,
      fn: async () => {
        const config = await Config.get()
        return {
          idle_timeout_ms: config.daemon?.idle_timeout_ms ?? 30 * 60 * 1000,
        }
      },
    })
  }

  export function command() {
    if (process.env.SLOPCODE_ENTRYPOINT) {
      return {
        args: [process.execPath, process.env.SLOPCODE_ENTRYPOINT],
        cwd: undefined,
      }
    }

    if (!Installation.isLocal()) {
      return {
        args: [process.execPath],
        cwd: undefined,
      }
    }
    const files = [new URL("../index.ts", import.meta.url), new URL("../index.js", import.meta.url)]
      .map((item) => fileURLToPath(item))
      .filter((item) => Bun.file(item).size > 0)
    if (files[0]) {
      return {
        args: [process.execPath, files[0]],
        cwd: fileURLToPath(new URL("../../", import.meta.url)),
      }
    }
    return {
      args: [process.execPath],
      cwd: undefined,
    }
  }

  function launch(input: {
    directory: string
    viewID?: string
    token: string
    idle_timeout_ms: number
    network?: Partial<NetworkOptions>
  }) {
    const cors = Array.isArray(input.network?.cors)
      ? input.network.cors
      : input.network?.cors
        ? [input.network.cors]
        : []
    const network = {
      hostname: input.network?.hostname ?? "127.0.0.1",
      port: input.network?.port ?? 0,
      mdns: input.network?.mdns ?? false,
      mdnsDomain: input.network?.["mdns-domain"] ?? "slopcode.local",
      cors,
    }
    const cmd = command()
    const args = [
      ...cmd.args,
      "daemon",
      "run",
      "--directory",
      input.directory,
      ...(input.viewID ? ["--view-id", input.viewID] : []),
      "--token",
      input.token,
      "--idle-timeout-ms",
      String(input.idle_timeout_ms),
      "--hostname",
      network.hostname,
      "--port",
      String(network.port),
      "--mdns-domain",
      network.mdnsDomain,
      ...network.cors.flatMap((item) => ["--cors", item]),
    ]
    if (network.mdns) args.push("--mdns")
    const child = spawn(args[0]!, args.slice(1), {
      cwd: cmd.cwd ?? input.directory,
      detached: true,
      stdio: "ignore",
      env: {
        ...process.env,
        SLOPCODE_DAEMON_CHILD: "1",
      },
    })
    child.unref()
  }

  async function wait(directory: string, viewID?: string, timeout = 10_000) {
    const start = Date.now()
    while (Date.now() - start < timeout) {
      const match = await current(directory, viewID)
      if (match) return match
      await Bun.sleep(100)
    }
    throw new Error(`Timed out waiting for daemon for ${directory}`)
  }

  async function shutdown(info: DaemonRegistry.Info) {
    await fetch(new URL("/daemon/shutdown", info.url), {
      method: "POST",
      headers: headers(info.token),
    }).catch(() => undefined)
  }

  function stale(status: Status, input: { idle_timeout_ms: number }) {
    return (
      status.protocol !== DaemonRuntime.PROTOCOL ||
      status.version !== Installation.VERSION ||
      status.idle_timeout_ms !== input.idle_timeout_ms
    )
  }

  function active(status: Status) {
    return status.clients > 0 || status.busy || status.permissions > 0 || status.questions > 0 || status.pty > 0
  }

  export async function ensure(input: { directory: string; network?: Partial<NetworkOptions>; viewID?: string }) {
    const directory = DaemonRegistry.normalize(input.directory)
    const next = await wanted(directory)
    const ready = await current(directory, input.viewID)
    if (ready && (!stale(ready.health, next) || active(ready.health))) {
      return {
        url: ready.info.url,
        headers: headers(ready.info.token),
      }
    }
    if (ready) {
      await shutdown(ready.info)
      await Bun.sleep(150)
    }
    await using _ = await DaemonRegistry.acquire(directory, input.viewID)
    const second = await current(directory, input.viewID)
    if (second && (!stale(second.health, next) || active(second.health))) {
      return {
        url: second.info.url,
        headers: headers(second.info.token),
      }
    }
    if (second) {
      await shutdown(second.info)
      await Bun.sleep(150)
    }
    const token = randomUUID()
    launch({
      directory,
      viewID: input.viewID,
      token,
      idle_timeout_ms: next.idle_timeout_ms,
      network: input.network,
    })
    const started = await wait(directory, input.viewID)
    return {
      url: started.info.url,
      headers: headers(started.info.token),
    }
  }
}
