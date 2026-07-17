import { expect, test } from "bun:test"
import { createSlopcodeClient } from "@slopcode-ai/sdk/v2"
import { permissionRespond, permissionScope } from "./session-permission"

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
