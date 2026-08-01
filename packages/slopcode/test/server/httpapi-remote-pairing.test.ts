import { afterEach, describe, expect, test } from "bun:test"
import { Flag } from "@slopcode-ai/core/flag/flag"
import { ConfigProvider, Context, Layer } from "effect"
import { mkdir } from "node:fs/promises"
import path from "node:path"
import { HttpRouter } from "effect/unstable/http"
import { HttpApiApp } from "../../src/server/routes/instance/httpapi/server"
import { disposeMiddleware } from "../../src/server/routes/instance/httpapi/lifecycle"
import { WorkspacePaths } from "../../src/server/routes/instance/httpapi/groups/workspace"
import { ServerAuth } from "../../src/server/auth"
import { RemoteTargetCapabilityHeader } from "../../../protocol/src/remote"
import { resetDatabase } from "../fixture/db"
import { disposeAllInstances, tmpdir } from "../fixture/fixture"

const context = Context.empty() as Context.Context<unknown>
const originalWorkspaces = Flag.SLOPCODE_EXPERIMENTAL_WORKSPACES

function auth() {
  return ServerAuth.header({ username: "slopcode", password: "secret" }) ?? ""
}

function handler() {
  return HttpRouter.toWebHandler(
    HttpApiApp.createRoutes().pipe(Layer.provide(ConfigProvider.layer(ConfigProvider.fromEnv()))),
    {
      disableLogger: true,
      memoMap: Layer.makeMemoMapUnsafe(),
      middleware: disposeMiddleware,
    },
  )
}

function requestWith(app: ReturnType<typeof handler>, route: string, directory: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers)
  headers.set("x-slopcode-directory", directory)
  return app.handler(
    new Request(`http://localhost${route}`, {
      ...init,
      headers,
    }),
    context,
  )
}

function request(route: string, directory: string, init: RequestInit = {}) {
  return requestWith(handler(), route, directory, init)
}

async function withAuthEnv<T>(run: () => Promise<T>) {
  const password = process.env.SLOPCODE_SERVER_PASSWORD
  const username = process.env.SLOPCODE_SERVER_USERNAME
  process.env.SLOPCODE_SERVER_PASSWORD = "secret"
  process.env.SLOPCODE_SERVER_USERNAME = "slopcode"
  try {
    return await run()
  } finally {
    if (password === undefined) delete process.env.SLOPCODE_SERVER_PASSWORD
    else process.env.SLOPCODE_SERVER_PASSWORD = password
    if (username === undefined) delete process.env.SLOPCODE_SERVER_USERNAME
    else process.env.SLOPCODE_SERVER_USERNAME = username
  }
}

async function withSupervisorToken<T>(run: () => Promise<T>) {
  const token = process.env.SLOPCODE_REMOTE_SUPERVISOR_TOKEN
  process.env.SLOPCODE_REMOTE_SUPERVISOR_TOKEN = "supervisor-secret"
  try {
    return await run()
  } finally {
    if (token === undefined) delete process.env.SLOPCODE_REMOTE_SUPERVISOR_TOKEN
    else process.env.SLOPCODE_REMOTE_SUPERVISOR_TOKEN = token
  }
}

function selectedWorkspaceID() {
  return "wrk_remote_pairing_selected"
}

function sshWorkspaceID() {
  return "wrk_remote_pairing_ssh"
}

afterEach(async () => {
  Flag.SLOPCODE_EXPERIMENTAL_WORKSPACES = originalWorkspaces
  await disposeAllInstances()
  await resetDatabase()
})

describe.serial("remote pairing HttpApi", () => {
  test.serial("persists pairing lifecycle behind authenticated routes", async () => {
    Flag.SLOPCODE_EXPERIMENTAL_WORKSPACES = true
    await using tmp = await tmpdir({ git: true })

    const unauthorized = await withAuthEnv(() => {
      const app = handler()
      return requestWith(app, WorkspacePaths.remoteHosts, tmp.path)
    })
    expect(unauthorized.status).toBe(401)
    expect(unauthorized.headers.get("www-authenticate") ?? "").toContain("Basic")

    await using remoteTmp = await tmpdir({ git: true })
    const proxied: Array<{
      url: string
      capability: string | null
      authorization: string | null
      cookie: string | null
      supervisor: string | null
    }> = []
    const remote = Bun.serve({
      port: 0,
      fetch(request) {
        proxied.push({
          url: request.url,
          capability: request.headers.get(RemoteTargetCapabilityHeader),
          authorization: request.headers.get("authorization"),
          cookie: request.headers.get("cookie"),
          supervisor: request.headers.get("x-slopcode-remote-supervisor-token"),
        })
        const url = new URL(request.url)
        if (url.pathname === "/bridge/api/location") {
          return Response.json({
            proxied: true,
            path: url.pathname,
          })
        }
        if (url.pathname === "/bridge/config") {
          return Response.json({
            proxied: true,
            path: url.pathname,
          })
        }
        return new Response("missing", { status: 404 })
      },
    })

    try {
      await withSupervisorToken(() =>
        withAuthEnv(async () => {
          const app = handler()
          const pairing = await requestWith(app, WorkspacePaths.remotePairing, remoteTmp.path, {
            method: "POST",
            headers: {
              authorization: auth(),
              "content-type": "application/json",
            },
            body: JSON.stringify({
              device: {
                id: "dev_test_ssh",
                name: "SSH Remote",
                platform: "android",
                arch: "arm64",
                version: "15",
              },
              workspace: {
                id: sshWorkspaceID(),
                name: "Remote SSH",
                mode: "ssh",
                directory: remoteTmp.path,
                remoteDirectory: "/srv/project",
                ssh: {
                  host: "example.test",
                  port: 22,
                  user: "marcos",
                },
              },
            }),
          })
          expect(pairing.status).toBe(200)
          const created = await pairing.json()

          const validateBefore = await requestWith(app, WorkspacePaths.remoteSshValidate, remoteTmp.path, {
            method: "POST",
            headers: {
              authorization: auth(),
              "content-type": "application/json",
            },
            body: JSON.stringify(created.workspace),
          })
          expect(validateBefore.status).toBe(409)

          const targetDenied = await requestWith(app, WorkspacePaths.remoteTarget, remoteTmp.path, {
            method: "POST",
            headers: {
              authorization: auth(),
              "content-type": "application/json",
            },
            body: JSON.stringify({
              pairingID: created.id,
              workspace: created.workspace,
              target: {
                type: "remote",
                url: `http://127.0.0.1:${remote.port}/bridge`,
                headers: { [RemoteTargetCapabilityHeader]: "secret" },
              },
            }),
          })
          expect(targetDenied.status).toBe(403)

          const targetRejectedUrl = await requestWith(app, WorkspacePaths.remoteTarget, remoteTmp.path, {
            method: "POST",
            headers: {
              authorization: auth(),
              "content-type": "application/json",
              "x-slopcode-remote-supervisor-token": "supervisor-secret",
            },
            body: JSON.stringify({
              pairingID: created.id,
              workspace: created.workspace,
              target: {
                type: "remote",
                url: "https://example.com/bridge",
                headers: { [RemoteTargetCapabilityHeader]: "secret" },
              },
            }),
          })
          expect(targetRejectedUrl.status).toBe(400)

          const targetRejectedHeader = await requestWith(app, WorkspacePaths.remoteTarget, remoteTmp.path, {
            method: "POST",
            headers: {
              authorization: auth(),
              "content-type": "application/json",
              "x-slopcode-remote-supervisor-token": "supervisor-secret",
            },
            body: JSON.stringify({
              pairingID: created.id,
              workspace: created.workspace,
              target: {
                type: "remote",
                url: `http://127.0.0.1:${remote.port}/bridge`,
                headers: { authorization: "Bearer nope" },
              },
            }),
          })
          expect(targetRejectedHeader.status).toBe(400)

          const selectBefore = await requestWith(app, WorkspacePaths.remoteSelect, remoteTmp.path, {
            method: "POST",
            headers: {
              authorization: auth(),
              "content-type": "application/json",
            },
            body: JSON.stringify({ pairingID: created.id }),
          })
          expect(selectBefore.status).toBe(409)

          const target = await requestWith(app, WorkspacePaths.remoteTarget, remoteTmp.path, {
            method: "POST",
            headers: {
              authorization: auth(),
              "content-type": "application/json",
              "x-slopcode-remote-supervisor-token": "supervisor-secret",
            },
            body: JSON.stringify({
              pairingID: created.id,
              workspace: created.workspace,
              target: {
                type: "remote",
                url: `http://127.0.0.1:${remote.port}/bridge`,
                headers: { [RemoteTargetCapabilityHeader]: "secret" },
              },
            }),
          })
          expect(target.status).toBe(204)

          const listed = await requestWith(app, WorkspacePaths.remoteHosts, remoteTmp.path, {
            headers: { authorization: auth() },
          })
          expect(listed.status).toBe(200)
          const listedBody = await listed.json()
          const listedJson = JSON.stringify(listedBody)
          expect(listedJson).not.toContain("secret")
          expect(listedJson).not.toContain(`/bridge`)
          expect(listedJson).not.toContain(`"code":`)

          const validateAfter = await requestWith(app, WorkspacePaths.remoteSshValidate, remoteTmp.path, {
            method: "POST",
            headers: {
              authorization: auth(),
              "content-type": "application/json",
            },
            body: JSON.stringify(created.workspace),
          })
          expect(validateAfter.status).toBe(200)

          const selectAfter = await requestWith(app, WorkspacePaths.remoteSelect, remoteTmp.path, {
            method: "POST",
            headers: {
              authorization: auth(),
              "content-type": "application/json",
            },
            body: JSON.stringify({ pairingID: created.id }),
          })
          expect(selectAfter.status).toBe(200)

          const routedV2 = await requestWith(app, `/api/location?workspace=${sshWorkspaceID()}`, remoteTmp.path, {
            headers: {
              authorization: auth(),
              cookie: "session=keep-local",
              [RemoteTargetCapabilityHeader]: "client-forged",
              "x-slopcode-remote-supervisor-token": "client-forged-supervisor",
            },
          })
          expect(routedV2.status).toBe(200)
          expect(await routedV2.json()).toEqual({ proxied: true, path: "/bridge/api/location" })

          const routedV1 = await requestWith(app, `/config?workspace=${sshWorkspaceID()}`, remoteTmp.path, {
            headers: { authorization: auth() },
          })
          expect(routedV1.status).toBe(200)
          expect(await routedV1.json()).toEqual({ proxied: true, path: "/bridge/config" })

          const revoked = await requestWith(
            app,
            WorkspacePaths.remotePairingRemove.replace(":pairingID", created.id),
            remoteTmp.path,
            {
              method: "DELETE",
              headers: { authorization: auth() },
            },
          )
          expect(revoked.status).toBe(204)

          const after = await requestWith(app, WorkspacePaths.remoteHosts, remoteTmp.path, {
            headers: { authorization: auth() },
          })
          expect(after.status).toBe(200)
          expect(await after.json()).toEqual([])

          expect(proxied).toEqual([
            {
              url: `http://127.0.0.1:${remote.port}/bridge/api/location`,
              capability: "secret",
              authorization: null,
              cookie: null,
              supervisor: null,
            },
            {
              url: `http://127.0.0.1:${remote.port}/bridge/config`,
              capability: "secret",
              authorization: null,
              cookie: null,
              supervisor: null,
            },
          ])
        }),
      )
    } finally {
      remote.stop(true)
    }
  })

})
