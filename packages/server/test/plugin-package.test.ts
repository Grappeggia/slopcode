import { expect, test } from "bun:test"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { PluginServer } from "../src/plugin"
import { webHandler } from "../src/routes"

test("configured plugins use the in-process server client and register workspaces", async () => {
  const directory = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), "slopcode-server-plugin-")))
  try {
    await fs.mkdir(path.join(directory, "node_modules"))
    await Promise.all([
      Bun.write(path.join(directory, "package.json"), JSON.stringify({ dependencies: {} })),
      Bun.write(path.join(directory, "slopcode.json"), JSON.stringify({ plugins: ["./plugin.ts"] })),
      Bun.write(
        path.join(directory, "plugin.ts"),
        `export default async (input) => {
          const health = await input.client._client.get({ url: "/api/health" })
          input.experimental_workspace.register("server-test", {
            name: "server-test",
            description: "server-test",
            configure: (value) => value,
            create: async () => {},
            remove: async () => {},
            target: async () => ({ type: "local", directory: input.directory })
          })
          globalThis.__h5c3b_server = { health: health.data, url: input.serverUrl.href }
          return {}
        }`,
      ),
    ])
    const app = webHandler({ baseUrl: new URL("http://configured.test:7777") })
    const response = await app.handler(
      new Request(`http://configured.test:7777/api/location?location[directory]=${encodeURIComponent(directory)}`),
      undefined as never,
    )
    expect(response.status).toBe(200)
    const body = (await response.json()) as { project: { id: string } }
    for (let i = 0; i < 100 && !(globalThis as { __h5c3b_server?: unknown }).__h5c3b_server; i++) {
      await Bun.sleep(20)
    }
    expect((globalThis as { __h5c3b_server?: unknown }).__h5c3b_server).toEqual({
      health: { healthy: true },
      url: "http://configured.test:7777/",
    })
    expect(PluginServer.workspace(body.project.id, "server-test")).toBeDefined()
    await app.dispose()
  } finally {
    await fs.rm(directory, { recursive: true, force: true })
  }
})
