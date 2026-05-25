import { Hono } from "hono"
import { describeRoute, validator, resolver } from "hono-openapi"
import z from "zod"
import { PermissionNext } from "@/permission/next"
import { errors } from "../error"
import { lazy } from "../../util/lazy"
import { NotFoundError } from "../../storage/db"

export const PermissionRoutes = lazy(() =>
  new Hono()
    .post(
      "/:requestID/reply",
      describeRoute({
        summary: "Respond to permission request",
        description: "Approve or deny a permission request from the AI assistant.",
        operationId: "permission.reply",
        responses: {
          200: {
            description: "Permission processed successfully",
            content: {
              "application/json": {
                schema: resolver(z.boolean()),
              },
            },
          },
          ...errors(400, 404),
        },
      }),
      validator(
        "param",
        z.object({
          requestID: z.string(),
        }),
      ),
      validator(
        "query",
        z.object({
          sessionID: z.string().optional(),
        }),
      ),
      validator("json", z.object({ reply: PermissionNext.Reply, message: z.string().optional() })),
      async (c) => {
        const params = c.req.valid("param")
        const query = c.req.valid("query")
        const json = c.req.valid("json")
        const ok = await PermissionNext.reply({
          requestID: params.requestID,
          reply: json.reply,
          message: json.message,
          sessionID: query.sessionID,
        })
        if (!ok) throw new NotFoundError({ message: "Permission request not found" })
        return c.json(true)
      },
    )

    .get(
      "/approved",
      describeRoute({
        summary: "List approved permissions",
        description: "Get saved Always Allow permission rules for the current project.",
        operationId: "permission.approved.list",
        responses: {
          200: {
            description: "Saved permission rules",
            content: {
              "application/json": {
                schema: resolver(PermissionNext.Ruleset),
              },
            },
          },
        },
      }),
      async (c) => {
        return c.json(await PermissionNext.listApproved())
      },
    )
    .post(
      "/approved/revoke",
      describeRoute({
        summary: "Revoke approved permission",
        description: "Remove a saved Always Allow permission rule for the current project.",
        operationId: "permission.approved.revoke",
        responses: {
          200: {
            description: "Number of removed rules",
            content: {
              "application/json": {
                schema: resolver(z.number()),
              },
            },
          },
        },
      }),
      validator(
        "json",
        z.object({
          permission: z.string(),
          pattern: z.string(),
          action: PermissionNext.Action.optional(),
        }),
      ),
      async (c) => {
        return c.json(await PermissionNext.removeApproved(c.req.valid("json")))
      },
    )
    .post(
      "/approved/clear",
      describeRoute({
        summary: "Clear approved permissions",
        description: "Remove all saved Always Allow permission rules for the current project.",
        operationId: "permission.approved.clear",
        responses: {
          200: {
            description: "Number of removed rules",
            content: {
              "application/json": {
                schema: resolver(z.number()),
              },
            },
          },
        },
      }),
      async (c) => {
        return c.json(await PermissionNext.clearApproved())
      },
    )
    .get(
      "/",
      describeRoute({
        summary: "List pending permissions",
        description: "Get all pending permission requests across all sessions.",
        operationId: "permission.list",
        responses: {
          200: {
            description: "List of pending permissions",
            content: {
              "application/json": {
                schema: resolver(PermissionNext.Request.array()),
              },
            },
          },
        },
      }),
      validator(
        "query",
        z.object({
          sessionID: z.string().optional(),
        }),
      ),
      async (c) => {
        const permissions = await PermissionNext.list(c.req.valid("query"))
        return c.json(permissions)
      },
    ),
)
