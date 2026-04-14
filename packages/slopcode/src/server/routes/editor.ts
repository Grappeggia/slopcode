import { Hono } from "hono"
import { describeRoute, resolver, validator } from "hono-openapi"
import { upgradeWebSocket } from "hono/bun"
import z from "zod"
import { lazy } from "../../util/lazy"
import { EditorSession } from "@/editor"
import { NotFoundError } from "../../storage/db"
import { errors } from "../error"

export const EditorRoutes = lazy(() =>
  new Hono()
    .post(
      "/",
      describeRoute({
        summary: "Open embedded editor",
        description: "Start a built-in embedded editor session for a file.",
        operationId: "editor.open",
        responses: {
          200: {
            description: "Editor session",
            content: {
              "application/json": {
                schema: resolver(EditorSession.Info),
              },
            },
          },
          ...errors(400),
        },
      }),
      validator("json", EditorSession.OpenInput),
      async (c) => {
        return c.json(await EditorSession.open(c.req.valid("json")))
      },
    )
    .get(
      "/:editorID",
      describeRoute({
        summary: "Get embedded editor",
        description: "Get the current state of an embedded editor session.",
        operationId: "editor.get",
        responses: {
          200: {
            description: "Editor session",
            content: {
              "application/json": {
                schema: resolver(EditorSession.Info),
              },
            },
          },
          ...errors(404),
        },
      }),
      validator("param", z.object({ editorID: z.string() })),
      validator("query", EditorSession.ScopedInput),
      async (c) => {
        const info = EditorSession.get(c.req.valid("param").editorID, c.req.valid("query"))
        if (!info) throw new NotFoundError({ message: "Editor session not found" })
        return c.json(info)
      },
    )
    .post(
      "/:editorID/save",
      describeRoute({
        summary: "Save embedded editor",
        description: "Write the active editor buffer to disk.",
        operationId: "editor.save",
        responses: {
          200: {
            description: "Saved editor session",
            content: {
              "application/json": {
                schema: resolver(EditorSession.Info),
              },
            },
          },
          ...errors(404),
        },
      }),
      validator("param", z.object({ editorID: z.string() })),
      validator("query", EditorSession.ScopedInput),
      async (c) => {
        const info = await EditorSession.save(c.req.valid("param").editorID, c.req.valid("query"))
        if (!info) throw new NotFoundError({ message: "Editor session not found" })
        return c.json(info)
      },
    )
    .post(
      "/:editorID/diff/dismiss",
      describeRoute({
        summary: "Dismiss editor diff",
        description: "Collapse the editor back to a single editable buffer.",
        operationId: "editor.dismissDiff",
        responses: {
          200: {
            description: "Updated editor session",
            content: {
              "application/json": {
                schema: resolver(EditorSession.Info),
              },
            },
          },
          ...errors(404),
        },
      }),
      validator("param", z.object({ editorID: z.string() })),
      validator("query", EditorSession.ScopedInput),
      async (c) => {
        const info = await EditorSession.dismiss(c.req.valid("param").editorID, c.req.valid("query"))
        if (!info) throw new NotFoundError({ message: "Editor session not found" })
        return c.json(info)
      },
    )
    .delete(
      "/:editorID",
      describeRoute({
        summary: "Close embedded editor",
        description: "Terminate an embedded editor session.",
        operationId: "editor.close",
        responses: {
          200: {
            description: "Closed editor session",
            content: {
              "application/json": {
                schema: resolver(z.boolean()),
              },
            },
          },
          ...errors(404),
        },
      }),
      validator("param", z.object({ editorID: z.string() })),
      validator("query", EditorSession.ScopedInput),
      async (c) => {
        const ok = await EditorSession.close(c.req.valid("param").editorID, c.req.valid("query"))
        if (!ok) throw new NotFoundError({ message: "Editor session not found" })
        return c.json(true)
      },
    )
    .get(
      "/:editorID/connect",
      describeRoute({
        summary: "Connect embedded editor",
        description: "Open a WebSocket for live editor snapshots and input forwarding.",
        operationId: "editor.connect",
        responses: {
          200: {
            description: "Connected editor",
            content: {
              "application/json": {
                schema: resolver(z.boolean()),
              },
            },
          },
          ...errors(404),
        },
      }),
      validator("param", z.object({ editorID: z.string() })),
      upgradeWebSocket((c) => {
        const id = c.req.param("editorID")
        const input = EditorSession.ScopedInput.parse({ sessionID: c.req.query("sessionID") })
        let handler: ReturnType<typeof EditorSession.connect>
        return {
          onOpen(_event, ws) {
            const socket = ws.raw as {
              readyState: number
              data?: unknown
              send(data: string | Uint8Array | ArrayBuffer): void
              close(code?: number, reason?: string): void
            }
            handler = EditorSession.connect(id, socket, input)
            if (!handler) ws.close()
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
