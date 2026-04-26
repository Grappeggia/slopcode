import { Hono } from "hono"
import { describeRoute, resolver, validator } from "hono-openapi"
import z from "zod"
import { Workspace } from "../../control-plane/workspace"
import { Instance } from "../../project/instance"
import { errors } from "../error"
import { lazy } from "../../util/lazy"

const CreateInput = z.object({
  id: Workspace.Info.shape.id.optional(),
  type: z.string(),
  branch: Workspace.Info.shape.branch.optional(),
  extra: z.record(z.string(), z.unknown()).optional(),
})

export const WorkspaceRoutes = lazy(() =>
  new Hono()
    .post(
      "/",
      describeRoute({
        summary: "Create workspace",
        description: "Create a workspace for the current project.",
        operationId: "experimental.workspace.create",
        responses: {
          200: {
            description: "Workspace created",
            content: {
              "application/json": {
                schema: resolver(Workspace.Info),
              },
            },
          },
          ...errors(400),
        },
      }),
      validator("json", CreateInput),
      async (c) => {
        const body = c.req.valid("json")
        const config =
          body.type === "worktree"
            ? { type: "worktree", directory: Instance.directory }
            : { type: body.type, ...(body.extra ?? {}) }
        const workspace = await Workspace.create({
          id: body.id,
          projectID: Instance.project.id,
          branch: body.branch ?? null,
          config,
        })
        return c.json(workspace)
      },
    )
    .post(
      "/:id",
      describeRoute({
        summary: "Create workspace (legacy)",
        description: "Legacy workspace creation endpoint retained for compatibility.",
        operationId: "experimental.workspace.createLegacy",
        responses: {
          200: {
            description: "Workspace created",
            content: {
              "application/json": {
                schema: resolver(Workspace.Info),
              },
            },
          },
          ...errors(400),
        },
      }),
      validator(
        "param",
        z.object({
          id: Workspace.Info.shape.id,
        }),
      ),
      validator(
        "json",
        z.object({
          branch: Workspace.Info.shape.branch,
          config: Workspace.Info.shape.config,
        }),
      ),
      async (c) => {
        const { id } = c.req.valid("param")
        const body = c.req.valid("json")
        const workspace = await Workspace.create({
          id,
          projectID: Instance.project.id,
          branch: body.branch,
          config: body.config,
        })
        return c.json(workspace)
      },
    )
    .get(
      "/adaptor",
      describeRoute({
        summary: "List workspace adaptors",
        description: "List all workspace adaptors available for the current project.",
        operationId: "experimental.workspace.adaptors",
        responses: {
          200: {
            description: "Workspace adaptors",
            content: {
              "application/json": {
                schema: resolver(z.array(Workspace.AdaptorInfo)),
              },
            },
          },
        },
      }),
      async (c) => {
        return c.json(Workspace.adaptors(Instance.project))
      },
    )
    .get(
      "/",
      describeRoute({
        summary: "List workspaces",
        description: "List all workspaces.",
        operationId: "experimental.workspace.list",
        responses: {
          200: {
            description: "Workspaces",
            content: {
              "application/json": {
                schema: resolver(z.array(Workspace.Info)),
              },
            },
          },
        },
      }),
      async (c) => {
        return c.json(Workspace.list(Instance.project))
      },
    )
    .get(
      "/status",
      describeRoute({
        summary: "Workspace status",
        description: "Get connection status for workspaces in the current project.",
        operationId: "experimental.workspace.status",
        responses: {
          200: {
            description: "Workspace status",
            content: {
              "application/json": {
                schema: resolver(z.array(Workspace.ConnectionStatus)),
              },
            },
          },
        },
      }),
      async (c) => {
        return c.json(Workspace.status(Instance.project))
      },
    )
    .delete(
      "/:id",
      describeRoute({
        summary: "Remove workspace",
        description: "Remove an existing workspace.",
        operationId: "experimental.workspace.remove",
        responses: {
          200: {
            description: "Workspace removed",
            content: {
              "application/json": {
                schema: resolver(Workspace.Info.optional()),
              },
            },
          },
          ...errors(400),
        },
      }),
      validator(
        "param",
        z.object({
          id: Workspace.Info.shape.id,
        }),
      ),
      async (c) => {
        const { id } = c.req.valid("param")
        return c.json(await Workspace.remove(id))
      },
    )
    .post(
      "/:id/session-restore",
      describeRoute({
        summary: "Restore session into workspace",
        description: "Replay a session's sync events into the target workspace in batches.",
        operationId: "experimental.workspace.sessionRestore",
        responses: {
          200: {
            description: "Session replay started",
            content: {
              "application/json": {
                schema: resolver(
                  z.object({
                    total: z.number().int().min(0),
                  }),
                ),
              },
            },
          },
          ...errors(400),
        },
      }),
      validator("param", z.object({ id: Workspace.Info.shape.id })),
      validator(
        "json",
        z.object({
          sessionID: Workspace.SessionRestoreInput.shape.sessionID,
        }),
      ),
      async (c) => {
        const { id } = c.req.valid("param")
        const body = c.req.valid("json")
        return c.json(
          await Workspace.sessionRestore({
            workspaceID: id,
            sessionID: body.sessionID,
          }),
        )
      },
    ),
)
