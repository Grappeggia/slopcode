import { afterAll, beforeAll, expect, test } from "bun:test"
import { createSlopcodeClient } from "@slopcode-ai/sdk/v2"
import { permissionRespond, permissionScope } from "./session-permission"
import type { PermissionRequest } from "@slopcode-ai/sdk/v2"
import { createServer, type ViteDevServer } from "vite"
import solid from "vite-plugin-solid"
import path from "node:path"

function request(always: string[]): PermissionRequest {
  return {
    id: "per_test",
    sessionID: "ses_test",
    permission: "bash",
    patterns: ["git status"],
    metadata: {},
    always,
  }
}

let server: ViteDevServer

beforeAll(async () => {
  server = await createServer({
    root: process.cwd(),
    configFile: false,
    appType: "custom",
    plugins: [solid({ ssr: true })],
    optimizeDeps: { noDiscovery: true },
    resolve: { alias: { "@": path.join(process.cwd(), "src") } },
    server: { middlewareMode: true },
  })
})

afterAll(async () => {
  await server.close()
})

async function render(input: { request: PermissionRequest; scope: "project" | "folder"; project?: boolean }) {
  const fixture = (await server.ssrLoadModule(
    "/src/pages/session/composer/session-permission.fixture.tsx",
  )) as typeof import("./session-permission.fixture")
  return fixture.renderPermissionDock(input)
}

test("maps Git and non-Git locations to project and folder copy", () => {
  expect(permissionScope("git")).toBe("project")
  expect(permissionScope(undefined)).toBe("folder")
})

test("sends visible session and project decisions unchanged", async () => {
  const bodies: unknown[] = []
  const client = createSlopcodeClient({
    baseUrl: "http://localhost",
    fetch: Object.assign(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        bodies.push(await new Request(input, init).json())
        return new Response(JSON.stringify(true), { headers: { "content-type": "application/json" } })
      },
      { preconnect: () => undefined },
    ),
  })

  await permissionRespond(client, { id: "per_one", sessionID: "ses_one" }, "always", "/work")
  await permissionRespond(client, { id: "per_two", sessionID: "ses_one" }, "project", "/work")

  expect(bodies).toEqual([{ response: "always" }, { response: "project" }])
})

test("renders the four visible choices for persistable requests", async () => {
  const html = await render({ request: request(["git status"]), scope: "project" })

  expect(html).toContain("Allow once")
  expect(html).toContain("Allow for this session")
  expect(html).toContain("Always allow for this project")
  expect(html).toContain("Reject")
  expect(html).not.toContain("Remember globally")
})

test("renders durable confirmation lifetime and exact patterns", async () => {
  const html = await render({ request: request(["git *", "src/**/*.ts"]), scope: "folder", project: true })

  expect(html).toContain("Always allow for this folder?")
  expect(html).toContain("survives restarts")
  expect(html).toContain("until revoked")
  expect(html).toContain("The following exact patterns will always be allowed:")
  expect(html).toContain("git *")
  expect(html).toContain("src/**/*.ts")
})

test("empty always patterns render only once and reject", async () => {
  const html = await render({ request: request([]), scope: "project" })

  expect(html).toContain("Allow once")
  expect(html).toContain("Reject")
  expect(html).not.toContain("Allow for this session")
  expect(html).not.toContain("Always allow for this project")
})
