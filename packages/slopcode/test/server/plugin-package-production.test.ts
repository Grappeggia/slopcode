import { afterEach, expect, test } from "bun:test"
import { Flag } from "@slopcode-ai/core/flag/flag"
import { ProjectV2 } from "@slopcode-ai/core/project"
import fs from "node:fs/promises"
import { getAdapter } from "../../src/control-plane/adapters"
import { Server } from "../../src/server/server"
import { resetDatabase } from "../fixture/db"
import { disposeAllInstances, tmpdir } from "../fixture/fixture"

const original = {
  password: Flag.SLOPCODE_SERVER_PASSWORD,
  username: Flag.SLOPCODE_SERVER_USERNAME,
  envPassword: process.env.SLOPCODE_SERVER_PASSWORD,
  envUsername: process.env.SLOPCODE_SERVER_USERNAME,
}
const auth = { username: "slopcode", password: "plugin-secret" }

afterEach(async () => {
  Flag.SLOPCODE_SERVER_PASSWORD = original.password
  Flag.SLOPCODE_SERVER_USERNAME = original.username
  if (original.envPassword === undefined) delete process.env.SLOPCODE_SERVER_PASSWORD
  else process.env.SLOPCODE_SERVER_PASSWORD = original.envPassword
  if (original.envUsername === undefined) delete process.env.SLOPCODE_SERVER_USERNAME
  else process.env.SLOPCODE_SERVER_USERNAME = original.envUsername
  delete (globalThis as { __production_plugin?: unknown }).__production_plugin
  await disposeAllInstances()
  await resetDatabase()
})

test("Server.listen hosts configured packages with scoped SDK and adapter cleanup", async () => {
  await using tmp = await tmpdir()
  const type = `production-${Math.random().toString(36).slice(2)}`
  await fs.mkdir(`${tmp.path}/node_modules`)
  await Promise.all([
    Bun.write(`${tmp.path}/package.json`, JSON.stringify({ dependencies: {} })),
    Bun.write(`${tmp.path}/slopcode.json`, JSON.stringify({ plugins: ["./plugin.ts"] })),
    Bun.write(
      `${tmp.path}/plugin.ts`,
      `export default async (input) => {
        globalThis.__production_plugin = { started: true, serverUrl: input.serverUrl.href }
        const location = await input.client._client.get({
          url: "/api/location?location[directory]=" + encodeURIComponent(input.directory)
        })
        input.experimental_workspace.register(${JSON.stringify(type)}, {
          name: "production",
          description: "production",
          configure: (value) => value,
          create: async () => {},
          remove: async () => {},
          target: async () => ({ type: "local", directory: input.directory })
        })
        globalThis.__production_plugin = {
          location: location.data,
          serverUrl: input.serverUrl.href
        }
        return {}
      }`,
    ),
  ])
  Flag.SLOPCODE_SERVER_PASSWORD = auth.password
  Flag.SLOPCODE_SERVER_USERNAME = auth.username
  process.env.SLOPCODE_SERVER_PASSWORD = auth.password
  process.env.SLOPCODE_SERVER_USERNAME = auth.username
  const listener = await Server.listen({ hostname: "127.0.0.1", port: 0 })
  let stopped = false
  try {
    const response = await fetch(
      new URL(`/api/location?location[directory]=${encodeURIComponent(tmp.path)}`, listener.url),
      { headers: { authorization: `Basic ${btoa(`${auth.username}:${auth.password}`)}` } },
    )
    expect(response.status).toBe(200)
    const body = (await response.json()) as { project: { id: string } }
    const boot = await fetch(new URL(`/api/agent?location[directory]=${encodeURIComponent(tmp.path)}`, listener.url), {
      headers: { authorization: `Basic ${btoa(`${auth.username}:${auth.password}`)}` },
    })
    expect(boot.status).toBe(200)
    for (let index = 0; index < 100 && !(globalThis as { __production_plugin?: unknown }).__production_plugin; index++)
      await Bun.sleep(20)

    expect((globalThis as { __production_plugin?: unknown }).__production_plugin).toEqual({
      location: expect.objectContaining({ directory: tmp.path }),
      serverUrl: listener.url.href,
    })
    expect(getAdapter(ProjectV2.ID.make(body.project.id), type)).toMatchObject({ name: "production" })

    await listener.stop(true)
    stopped = true
    expect(() => getAdapter(ProjectV2.ID.make(body.project.id), type)).toThrow(`Unknown workspace adapter: ${type}`)
  } finally {
    if (!stopped) await listener.stop(true).catch(() => undefined)
  }
})
