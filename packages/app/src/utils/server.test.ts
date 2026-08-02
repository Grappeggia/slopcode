import { describe, expect, test } from "bun:test"
import { authFromToken, authTokenFromCredentials, createSdkForServer } from "./server"

describe("authFromToken", () => {
  test("decodes basic auth credentials from auth_token", () => {
    expect(authFromToken(btoa("kit:secret"))).toEqual({ username: "kit", password: "secret" })
  })

  test("defaults blank username to slopcode", () => {
    expect(authFromToken(btoa(":secret"))).toEqual({ username: "slopcode", password: "secret" })
  })

  test("ignores malformed tokens", () => {
    expect(authFromToken("not base64")).toBeUndefined()
    expect(authFromToken(btoa("missing-separator"))).toBeUndefined()
  })
})

describe("authTokenFromCredentials", () => {
  test("encodes credentials with the default username", () => {
    expect(authTokenFromCredentials({ password: "secret" })).toBe(btoa("slopcode:secret"))
  })
})

test("adds default remote workspace routing headers without overriding request scope", async () => {
  let request: Request | undefined
  const fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    request = new Request(input, init)
    return new Response(JSON.stringify({ healthy: true, version: "1.0.0" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    })
  }) as typeof globalThis.fetch

  await createSdkForServer({
    server: {
      url: "https://desktop.example.test",
      username: "slopcode",
      password: "secret",
      workspaceID: "ws_remote",
      directory: "/srv/project",
    },
    fetch,
  }).global.health()

  const url = new URL(request?.url ?? "https://invalid")
  expect(url.searchParams.get("workspace")).toBe("ws_remote")
  expect(url.searchParams.get("directory")).toBe("/srv/project")
  expect(request?.headers.get("authorization")).toBe(`Basic ${btoa("slopcode:secret")}`)

  await createSdkForServer({
    server: {
      url: "https://desktop.example.test",
      workspaceID: "ws_default",
      directory: "/srv/default",
    },
    directory: "/srv/override",
    experimental_workspaceID: "ws_override",
    fetch,
  }).global.health()

  const override = new URL(request?.url ?? "https://invalid")
  expect(override.searchParams.get("workspace")).toBe("ws_override")
  expect(override.searchParams.get("directory")).toBe("/srv/override")
})
