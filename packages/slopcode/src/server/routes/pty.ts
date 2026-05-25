import { Hono } from "hono"
import { describeRoute, validator, resolver } from "hono-openapi"
import { upgradeWebSocket } from "hono/bun"
import z from "zod"
import { Pty } from "@/pty"
import { Shell } from "@/shell/shell"
import { NotFoundError } from "../../storage/db"
import { errors } from "../error"
import { lazy } from "../../util/lazy"

export const PtyRoutes = lazy(() =>
  new Hono()
    .get(
      "/",
      describeRoute({
        summary: "List PTY sessions",
        description: "Get a list of all active pseudo-terminal (PTY) sessions managed by SlopCode.",
        operationId: "pty.list",
        responses: {
          200: {
            description: "List of sessions",
            content: {
              "application/json": {
                schema: resolver(Pty.Info.array()),
              },
            },
          },
        },
      }),
      validator("query", Pty.ScopedInput),
      async (c) => {
        return c.json(Pty.list(c.req.valid("query")))
      },
    )
    .post(
      "/",
      describeRoute({
        summary: "Create PTY session",
        description: "Create a new pseudo-terminal (PTY) session for running shell commands and processes.",
        operationId: "pty.create",
        responses: {
          200: {
            description: "Created session",
            content: {
              "application/json": {
                schema: resolver(Pty.Info),
              },
            },
          },
          ...errors(400),
        },
      }),
      validator("json", Pty.CreateInput),
      async (c) => {
        const info = await Pty.create(c.req.valid("json"))
        return c.json(info)
      },
    )
    .get(
      "/shells",
      describeRoute({
        summary: "List available shells",
        description: "Get the shells that can be used for PTY sessions and shell mode.",
        operationId: "pty.shells",
        responses: {
          200: {
            description: "Available shells",
            content: {
              "application/json": {
                schema: resolver(
                  z.array(
                    z.object({
                      path: z.string(),
                      name: z.string(),
                      acceptable: z.boolean(),
                    }),
                  ),
                ),
              },
            },
          },
        },
      }),
      async (c) => {
        return c.json(await Shell.list())
      },
    )
    .get(
      "/:ptyID",
      describeRoute({
        summary: "Get PTY session",
        description: "Retrieve detailed information about a specific pseudo-terminal (PTY) session.",
        operationId: "pty.get",
        responses: {
          200: {
            description: "Session info",
            content: {
              "application/json": {
                schema: resolver(Pty.Info),
              },
            },
          },
          ...errors(404),
        },
      }),
      validator("param", z.object({ ptyID: z.string() })),
      validator("query", Pty.ScopedInput),
      async (c) => {
        const info = Pty.get(c.req.valid("param").ptyID, c.req.valid("query"))
        if (!info) {
          throw new NotFoundError({ message: "Session not found" })
        }
        return c.json(info)
      },
    )
    .put(
      "/:ptyID",
      describeRoute({
        summary: "Update PTY session",
        description: "Update properties of an existing pseudo-terminal (PTY) session.",
        operationId: "pty.update",
        responses: {
          200: {
            description: "Updated session",
            content: {
              "application/json": {
                schema: resolver(Pty.Info),
              },
            },
          },
          ...errors(400),
        },
      }),
      validator("param", z.object({ ptyID: z.string() })),
      validator("query", Pty.ScopedInput),
      validator("json", Pty.UpdateInput),
      async (c) => {
        const info = await Pty.update(c.req.valid("param").ptyID, c.req.valid("json"), c.req.valid("query"))
        if (!info) {
          throw new NotFoundError({ message: "Session not found" })
        }
        return c.json(info)
      },
    )
    .delete(
      "/:ptyID",
      describeRoute({
        summary: "Remove PTY session",
        description: "Remove and terminate a specific pseudo-terminal (PTY) session.",
        operationId: "pty.remove",
        responses: {
          200: {
            description: "Session removed",
            content: {
              "application/json": {
                schema: resolver(z.boolean()),
              },
            },
          },
          ...errors(404),
        },
      }),
      validator("param", z.object({ ptyID: z.string() })),
      validator("query", Pty.ScopedInput),
      async (c) => {
        const info = Pty.get(c.req.valid("param").ptyID, c.req.valid("query"))
        if (!info) {
          throw new NotFoundError({ message: "Session not found" })
        }
        await Pty.remove(c.req.valid("param").ptyID, c.req.valid("query"))
        return c.json(true)
      },
    )
    .get(
      "/:ptyID/connect",
      describeRoute({
        summary: "Connect to PTY session",
        description: "Establish a WebSocket connection to interact with a pseudo-terminal (PTY) session in real-time.",
        operationId: "pty.connect",
        responses: {
          200: {
            description: "Connected session",
            content: {
              "application/json": {
                schema: resolver(z.boolean()),
              },
            },
          },
          ...errors(404),
        },
      }),
      validator("param", z.object({ ptyID: z.string() })),
      upgradeWebSocket((c) => {
        const id = c.req.param("ptyID")
        const access = Pty.ScopedInput.parse({ sessionID: c.req.query("sessionID") })
        const cursor = (() => {
          const value = c.req.query("cursor")
          if (!value) return
          const parsed = Number(value)
          if (!Number.isSafeInteger(parsed) || parsed < -1) return
          return parsed
        })()
        let handler: ReturnType<typeof Pty.connect>
        if (!Pty.get(id, access)) throw new Error("Session not found")

        type Socket = {
          readyState: number
          send: (data: string | Uint8Array | ArrayBuffer) => void
          close: (code?: number, reason?: string) => void
        }

        const isSocket = (value: unknown): value is Socket => {
          if (!value || typeof value !== "object") return false
          if (!("readyState" in value)) return false
          if (!("send" in value) || typeof (value as { send?: unknown }).send !== "function") return false
          if (!("close" in value) || typeof (value as { close?: unknown }).close !== "function") return false
          return typeof (value as { readyState?: unknown }).readyState === "number"
        }

        return {
          onOpen(_event, ws) {
            const socket = ws.raw
            if (!isSocket(socket)) {
              ws.close()
              return
            }
            handler = Pty.connect(id, socket, cursor, access)
          },
          onMessage(event) {
            if (typeof event.data !== "string") return
            handler?.onMessage(event.data)
          },
          onClose() {
            handler?.onClose()
          },
          onError() {
            handler?.onClose()
          },
        }
      }),
    ),
)
