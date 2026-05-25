import type { Argv } from "yargs"
import { DaemonAuth } from "@/daemon/auth"
import { DaemonRegistry } from "@/daemon/registry"
import { DaemonRuntime } from "@/daemon/runtime"
import { InstanceBootstrap } from "@/project/bootstrap"
import { Instance } from "@/project/instance"
import { Server } from "@/server/server"
import { cmd } from "./cmd"
import { resolveNetworkOptions, withNetworkOptions } from "../network"
import { Installation } from "@/installation"

export const DaemonCommand = cmd({
  command: "daemon",
  describe: "internal daemon commands",
  builder: (yargs: Argv) => yargs.command(DaemonRunCommand).demandCommand(),
  async handler() {},
})

export const DaemonRunCommand = cmd({
  command: "run",
  describe: "run the local daemon",
  builder: (yargs) =>
    withNetworkOptions(yargs)
      .option("directory", {
        type: "string",
        demandOption: true,
        describe: "directory to serve",
      })
      .option("token", {
        type: "string",
        demandOption: true,
        describe: "daemon auth token",
      })
      .option("idle-timeout-ms", {
        type: "number",
        demandOption: true,
        describe: "daemon idle timeout in milliseconds",
      })
      .option("view-id", {
        type: "string",
        describe: "isolated cli view id",
      }),
  handler: async (args) => {
    const directory = DaemonRegistry.normalize(args.directory)
    const idle_timeout_ms = args.idleTimeoutMs
    const token = args.token
    const view_id = args.viewId
    const network = await resolveNetworkOptions(args)
    let done!: () => void
    const wait = new Promise<void>((resolve) => {
      done = resolve
    })
    try {
      process.chdir(directory)
      await Instance.provide({
        directory,
        init: InstanceBootstrap,
        fn: async () => {
          DaemonAuth.set(token)
          const server = Server.listen({
            ...network,
            daemonToken: token,
          })
          const stop = async () => {
            await server.stop(true)
            await DaemonRegistry.remove(directory, view_id)
            done()
          }
          const exit = () => {
            void DaemonRuntime.shutdown()
          }
          process.once("SIGINT", exit)
          process.once("SIGTERM", exit)
          process.once("SIGHUP", exit)
          await DaemonRegistry.write({
            directory,
            view_id,
            pid: process.pid,
            url: server.url.toString(),
            token,
            version: Installation.VERSION,
            protocol: DaemonRuntime.PROTOCOL,
            started_at: Date.now(),
            idle_timeout_ms,
          })
          DaemonRuntime.configure({
            directory,
            view_id,
            idle_timeout_ms,
            stop,
          })
          await wait
          process.off("SIGINT", exit)
          process.off("SIGTERM", exit)
          process.off("SIGHUP", exit)
        },
      })
    } catch (error) {
      await DaemonRegistry.remove(directory, view_id)
      throw error
    }
  },
})
