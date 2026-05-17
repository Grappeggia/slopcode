import { cmd } from "@/cli/cmd/cmd"
import { resolveNetworkOptions, withNetworkOptions } from "@/cli/network"
import { UI } from "@/cli/ui"
import { upgrade } from "@/cli/upgrade"
import { DaemonAuth } from "@/daemon/auth"
import { DaemonLauncher } from "@/daemon/launcher"
import { TuiConfig } from "@/config/tui"
import { Instance } from "@/project/instance"
import { randomUUID } from "crypto"
import path from "path"
import { spawnSync } from "child_process"

import { android, client, guard } from "./platform"


export const TuiThreadCommand = cmd({
  command: "$0 [project]",
  describe: "start slopcode tui",
  builder: (yargs) =>
    withNetworkOptions(yargs)
      .positional("project", {
        type: "string",
        describe: "path to start slopcode in",
      })
      .option("model", {
        type: "string",
        alias: ["m"],
        describe: "model to use in the format of provider/model",
      })
      .option("continue", {
        alias: ["c"],
        describe: "continue the last session",
        type: "boolean",
      })
      .option("session", {
        alias: ["s"],
        type: "string",
        describe: "session id to continue",
      })
      .option("fork", {
        type: "boolean",
        describe: "fork the session when continuing (use with --continue or --session)",
      })
      .option("prompt", {
        type: "string",
        describe: "prompt to use",
      })
      .option("agent", {
        type: "string",
        describe: "agent to use",
      }),
  handler: async (args) => {
    const termux = android()
    const win32 = termux ? undefined : await import("./win32")
    const unguard = win32?.win32InstallCtrlCGuard()
    try {
      win32?.win32DisableProcessedInput()
      if (!termux && guard()) {
        process.exit(1)
      }

      if (args.fork && !args.continue && !args.session) {
        UI.error("--fork requires --continue or --session")
        process.exitCode = 1
        return
      }

      const base = process.env.PWD ?? process.cwd()
      const cwd = args.project ? path.resolve(base, args.project) : process.cwd()
      try {
        process.chdir(cwd)
      } catch {
        UI.error("Failed to change directory to " + cwd)
        return
      }

      const prompt = await (async () => {
        const piped = !process.stdin.isTTY ? await Bun.stdin.text() : undefined
        if (!args.prompt) return piped
        return piped ? piped + "\n" + args.prompt : args.prompt
      })()

      const config = await Instance.provide({
        directory: cwd,
        fn: () => TuiConfig.get(),
      })

      const network = await resolveNetworkOptions(args)
      const expose =
        process.argv.includes("--port") ||
        process.argv.includes("--hostname") ||
        process.argv.includes("--mdns") ||
        network.mdns ||
        network.port !== 0 ||
        network.hostname !== "127.0.0.1"
      const viewID = randomUUID()

      const daemon = await DaemonLauncher.ensure({
        directory: cwd,
        viewID,
        network: expose ? network : undefined,
      })

      if (termux) {
        const bin = client()
        if (!bin) {
          UI.error("SlopCode Termux client is missing. Reinstall with: npm install -g slopcode@latest")
          process.exit(1)
        }
        const result = spawnSync(
          bin,
          [
            "--url",
            daemon.url,
            "--token",
            daemon.headers[DaemonAuth.Header] ?? "",
            ...(args.continue ? ["--continue"] : []),
            ...(args.session ? ["--session", args.session] : []),
            ...(args.model ? ["--model", args.model] : []),
            ...(args.agent ? ["--agent", args.agent] : []),
            ...(prompt ? ["--prompt", prompt] : []),
          ],
          { cwd, stdio: "inherit" },
        )
        if (result.error) {
          UI.error(result.error.message)
          process.exit(1)
        }
        process.exit(typeof result.status === "number" ? result.status : 1)
      }

      const { tui } = await import("./app")

      const tuiPromise = tui({
        url: daemon.url,
        config,
        directory: cwd,
        viewID,
        headers: daemon.headers,
        args: {
          continue: args.continue,
          sessionID: args.session,
          agent: args.agent,
          model: args.model,
          prompt,
          fork: args.fork,
        },
        onExit: async () => {},
      })

      setTimeout(() => {
        Instance.provide({
          directory: cwd,
          fn: async () => {
            await upgrade().catch(() => {})
          },
        }).catch(() => {})
      }, 1000)

      await tuiPromise
    } finally {
      unguard?.()
    }
    process.exit(0)
  },
})
