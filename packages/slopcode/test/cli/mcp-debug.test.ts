import { expect } from "bun:test"
import { createServer } from "node:http"
import { Effect } from "effect"
import { cliIt } from "../lib/cli-process"

cliIt.live("mcp debug preserves instance context and redacts URL and header secrets", ({ slopcode }) =>
  Effect.gen(function* () {
    const server = yield* Effect.acquireRelease(
      Effect.promise(
        () =>
          new Promise<{ server: ReturnType<typeof createServer>; url: string }>((resolve) => {
            const server = createServer((req, res) => {
              res.statusCode = 500
              res.setHeader(
                "www-authenticate",
                `Bearer authorization=${req.headers.authorization} api_key=${req.headers["x-api-key"]}`,
              )
              res.end(`echo ${req.headers.authorization} ${req.headers["x-api-key"]} query-secret fragment-secret`)
            })
            server.listen(0, "127.0.0.1", () => {
              const address = server.address()
              if (!address || typeof address === "string") throw new Error("missing debug server address")
              resolve({ server, url: `http://127.0.0.1:${address.port}/mcp` })
            })
          }),
      ),
      (entry) =>
        Effect.promise(() => new Promise<void>((resolve) => entry.server.close(() => resolve()))).pipe(Effect.ignore),
    )
    const result = yield* slopcode.spawn(["mcp", "debug", "demo"], {
      env: {
        SLOPCODE_CONFIG_CONTENT: JSON.stringify({
          mcp: {
            demo: {
              type: "remote",
              url: `${server.url}?token=query-secret#fragment-secret`,
              headers: {
                Authorization: "Bearer authorization-secret",
                "X-API-Key": "header-api-secret",
              },
            },
          },
        }),
      },
    })

    slopcode.expectExit(result, 0)
    expect(result.stdout).toContain("MCP OAuth Debug")
    expect(result.stdout).not.toContain("InstanceRef not provided")
    expect(result.stdout).not.toContain("query-secret")
    expect(result.stdout).not.toContain("fragment-secret")
    expect(result.stdout).not.toContain("authorization-secret")
    expect(result.stdout).not.toContain("header-api-secret")
    expect(result.stdout).not.toContain("token=")
  }),
)

cliIt.concurrent("mcp list commands remove URL credentials query and fragment", ({ slopcode }) =>
  Effect.gen(function* () {
    const env = {
      SLOPCODE_CONFIG_CONTENT: JSON.stringify({
        mcp: {
          private: {
            type: "remote",
            url: "http://user:password@127.0.0.1:1/mcp?token=query-secret#fragment-secret",
            enabled: false,
          },
        },
      }),
    }
    const list = yield* slopcode.spawn(["mcp", "list"], { env })
    const auth = yield* slopcode.spawn(["mcp", "auth", "list"], { env })

    slopcode.expectExit(list, 0)
    slopcode.expectExit(auth, 0)
    for (const output of [list.stdout, auth.stdout]) {
      expect(output).not.toContain("user")
      expect(output).not.toContain("password")
      expect(output).not.toContain("token=")
      expect(output).not.toContain("query-secret")
      expect(output).not.toContain("fragment-secret")
    }
  }),
)
