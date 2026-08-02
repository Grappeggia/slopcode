import type { CommandModule } from "yargs"
import { run } from "@/remote-orchestrator/bridge"

export const RemoteOrchestratorCommand: CommandModule = {
  command: "remote-orchestrator",
  describe: "start the fixed remote agent orchestration bridge over stdio",
  builder: (yargs) =>
    yargs.option("stdio", { type: "boolean", demandOption: true, describe: "use stdin/stdout JSON lines" }).strict(),
  async handler() {
    await run({ root: process.env.SLOPCODE_REMOTE_ORCHESTRATOR_ROOT ?? process.cwd() })
  },
}
