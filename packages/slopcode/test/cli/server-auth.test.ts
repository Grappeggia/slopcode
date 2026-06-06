import { describe, expect, test } from "bun:test"
import { basicAuth } from "../../src/cli/server-auth"

describe("server basic auth", () => {
  test("returns undefined without a password", () => {
    expect(basicAuth({ env: {} })).toBeUndefined()
  })

  test("uses the default slopcode username", () => {
    expect(basicAuth({ password: "secret", env: {} })).toEqual({
      Authorization: `Basic ${Buffer.from("slopcode:secret").toString("base64")}`,
    })
  })

  test("uses explicit username and password before environment values", () => {
    expect(
      basicAuth({
        username: "alice",
        password: "secret",
        env: {
          SLOPCODE_SERVER_USERNAME: "env-user",
          SLOPCODE_SERVER_PASSWORD: "env-secret",
        },
      }),
    ).toEqual({
      Authorization: `Basic ${Buffer.from("alice:secret").toString("base64")}`,
    })
  })

  test("falls back to environment username and password", () => {
    expect(
      basicAuth({
        env: {
          SLOPCODE_SERVER_USERNAME: "env-user",
          SLOPCODE_SERVER_PASSWORD: "env-secret",
        },
      }),
    ).toEqual({
      Authorization: `Basic ${Buffer.from("env-user:env-secret").toString("base64")}`,
    })
  })
})
