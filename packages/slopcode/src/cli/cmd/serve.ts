import { Server } from "../../server/server"
import { cmd } from "./cmd"
import { withNetworkOptions, resolveNetworkOptions } from "../network"
import { Workspace } from "../../control-plane/workspace"
import { Project } from "../../project/project"
import { Installation } from "../../installation"

export const ServeCommand = cmd({
  command: "serve",
  builder: (yargs) => withNetworkOptions(yargs),
  describe: "starts a headless slopcode server",
  handler: async (args) => {
    const opts = await resolveNetworkOptions(args)
    const server = Server.listen(opts)
    console.log(`slopcode server listening on http://${server.hostname}:${server.port}`)

    let workspaceSync: Array<ReturnType<typeof Workspace.startSyncing>> = []
    // Only available in development right now
    if (Installation.isLocal()) {
      workspaceSync = Project.list().map((project) => Workspace.startSyncing(project))
    }

    await new Promise(() => {})
    await server.stop()
    await Promise.all(workspaceSync.map((item) => item.stop()))
  },
})
