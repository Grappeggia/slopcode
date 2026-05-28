import { cmd } from "../cmd"
import { UI } from "@/cli/ui"
import { tui } from "./app"
import { win32DisableProcessedInput, win32InstallCtrlCGuard } from "./win32"
import { android, client, guard } from "./platform"
import { TuiConfig } from "@/config/tui"
import { Instance } from "@/project/instance"
import { randomUUID } from "crypto"
import { existsSync } from "fs"

export const AttachCommand = cmd({
  command: "attach <url>",
  describe: "attach to a running slopcode server",
  builder: (yargs) =>
    yargs
      .positional("url", {
        type: "string",
        describe: "http://localhost:4096",
        demandOption: true,
      })
      .option("dir", {
        type: "string",
        description: "directory to run in",
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
      .option("password", {
        alias: ["p"],
        type: "string",
        describe: "basic auth password (defaults to SLOPCODE_SERVER_PASSWORD)",
      }),
  handler: async (args) => {
    const unguard = win32InstallCtrlCGuard()
    try {
      win32DisableProcessedInput()
      if (!android() && guard()) {
        process.exit(1)
      }

      if (args.fork && !args.continue && !args.session) {
        UI.error("--fork requires --continue or --session")
        process.exitCode = 1
        return
      }

      const directory = (() => {
        if (!args.dir) return undefined
        try {
          process.chdir(args.dir)
          return process.cwd()
        } catch {
          // If the directory doesn't exist locally (remote attach), pass it through.
          return args.dir
        }
      })()
      const headers = (() => {
        const password = args.password ?? process.env.SLOPCODE_SERVER_PASSWORD
        if (!password) return undefined
        const auth = `Basic ${Buffer.from(`slopcode:${password}`).toString("base64")}`
        return { Authorization: auth }
      })()
      const config = await Instance.provide({
        directory: directory && existsSync(directory) ? directory : process.cwd(),
        fn: () => TuiConfig.get(),
      })
      const viewID = randomUUID()
      if (android()) {
        const { androidHostTui } = await import("./android-host")
        if (
          await androidHostTui({
            url: args.url,
            config,
            args: {
              continue: args.continue,
              sessionID: args.session,
              fork: args.fork,
            },
            directory,
            viewID,
            headers,
          })
        ) {
          return
        }
        if (!client()) {
          UI.error("SlopCode Android runtime is missing. Reinstall with: npm install -g slopcode@latest --include=optional")
          process.exit(1)
        }
        UI.error(
          "SlopCode Android now runs only through the bundled Rust runtime. Remove old Android TUI overrides and try again.",
        )
        process.exit(1)
      }
      await tui({
        url: args.url,
        config,
        args: {
          continue: args.continue,
          sessionID: args.session,
          fork: args.fork,
        },
        directory,
        viewID,
        headers,
      })
    } finally {
      unguard?.()
    }
  },
})
