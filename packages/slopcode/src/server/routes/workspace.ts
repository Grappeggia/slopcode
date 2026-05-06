import { Hono } from "hono"
import { HTTPException } from "hono/http-exception"
import { describeRoute, resolver, validator } from "hono-openapi"
import z from "zod"
import { Workspace } from "../../control-plane/workspace"
import { Instance } from "../../project/instance"
import { Session } from "../../session"
import { errors } from "../error"
import { lazy } from "../../util/lazy"

export const WorkspaceRoutes = lazy(() =>
  new Hono()
    .post(
      "/:id",
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
      "/status",
      describeRoute({
        summary: "List workspace statuses",
        description: "List connection statuses for all workspaces in the current project.",
        operationId: "experimental.workspace.status",
        responses: {
          200: {
            description: "Workspace statuses",
            content: {
              "application/json": {
                schema: resolver(z.array(Workspace.ConnectionStatus)),
              },
            },
          },
        },
      }),
      async (c) => {
        return c.json(await Workspace.status(Instance.project))
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
    .post(
      "/warp",
      describeRoute({
        summary: "Warp session to workspace",
        description: "Move a session between the local project and a workspace.",
        operationId: "experimental.workspace.warp",
        responses: {
          200: {
            description: "Updated session",
            content: {
              "application/json": {
                schema: resolver(Session.Info),
              },
            },
          },
          ...errors(400),
        },
      }),
      validator("json", Workspace.WarpInput),
      async (c) => {
        const body = c.req.valid("json")
        const session = await Session.get(body.sessionID)
        const current = session.workspaceID ? await Workspace.get(session.workspaceID) : undefined
        if (current && current.config.type !== "worktree") {
          throw new HTTPException(400, { message: "Remote workspace sessions cannot be moved yet" })
        }
        if (!body.id) {
          return c.json(
            current ? await Session.setWorkspace({ sessionID: body.sessionID, workspaceID: undefined }) : session,
          )
        }

        const workspace = await Workspace.get(body.id)
        if (!workspace) {
          throw new HTTPException(400, { message: `Workspace not found: ${body.id}` })
        }
        if (workspace.config.type !== "worktree") {
          throw new HTTPException(400, { message: "Remote workspace sessions cannot be moved yet" })
        }
        if (session.workspaceID === workspace.id) return c.json(session)
        return c.json(await Session.setWorkspace({ sessionID: body.sessionID, workspaceID: workspace.id }))
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
    ),
)
