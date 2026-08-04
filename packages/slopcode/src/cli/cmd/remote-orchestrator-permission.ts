import type { CommandModule } from "yargs"
import { serve } from "@/remote-orchestrator/claude-permission"

export const RemoteOrchestratorPermissionCommand: CommandModule = {
  command: "remote-orchestrator-permission",
  builder: (yargs) =>
    yargs
      .option("socket", { type: "string", demandOption: true })
      .option("token", { type: "string", demandOption: true })
      .strict(),
  async handler(args) {
    if (typeof args.socket !== "string" || typeof args.token !== "string")
      throw new Error("The Claude permission bridge requires a socket and token.")
    await serve({ socket: args.socket, token: args.token })
  },
}
