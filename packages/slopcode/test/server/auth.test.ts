import { afterEach, describe, expect, test } from "bun:test"
import { DaemonAuth } from "../../src/daemon/auth"
import { Server } from "../../src/server/server"

const password = process.env.SLOPCODE_SERVER_PASSWORD
const username = process.env.SLOPCODE_SERVER_USERNAME

afterEach(() => {
  if (password === undefined) delete process.env.SLOPCODE_SERVER_PASSWORD
  else process.env.SLOPCODE_SERVER_PASSWORD = password
  if (username === undefined) delete process.env.SLOPCODE_SERVER_USERNAME
  else process.env.SLOPCODE_SERVER_USERNAME = username
})

describe("server auth", () => {
  test("refuses to start without configured auth", () => {
    delete process.env.SLOPCODE_SERVER_PASSWORD
    expect(() => Server.listen({ hostname: "127.0.0.1", port: 0 })).toThrow(
      "SLOPCODE_SERVER_PASSWORD is required to start the slopcode server",
    )
  })

  test("daemon token protects all routes when password is unset", async () => {
    delete process.env.SLOPCODE_SERVER_PASSWORD
    const token = "daemon-test-token"
    const server = Server.listen({ hostname: "127.0.0.1", port: 0, daemonToken: token })
    try {
      const unauthorized = await fetch(new URL("/global/health", server.url))
      expect(unauthorized.status).toBe(401)

      const authorized = await fetch(new URL("/global/health", server.url), {
        headers: {
          [DaemonAuth.Header]: token,
        },
      })
      expect(authorized.status).toBe(200)
    } finally {
      await server.stop(true)
    }
  })

  test("basic auth protects all routes when password is configured", async () => {
    process.env.SLOPCODE_SERVER_PASSWORD = "secret"
    delete process.env.SLOPCODE_SERVER_USERNAME
    const auth = `Basic ${Buffer.from("slopcode:secret").toString("base64")}`
    const server = Server.listen({ hostname: "127.0.0.1", port: 0 })
    try {
      const unauthorized = await fetch(new URL("/global/health", server.url))
      expect(unauthorized.status).toBe(401)

      const authorized = await fetch(new URL("/global/health", server.url), {
        headers: {
          Authorization: auth,
        },
      })
      expect(authorized.status).toBe(200)
    } finally {
      await server.stop(true)
    }
  })
})
