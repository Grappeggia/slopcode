import z from "zod"
import { Hono } from "hono"
import { describeRoute, resolver, validator } from "hono-openapi"
import { Workspace } from "@/control-plane/workspace"
import { Instance } from "@/project/instance"
import { SyncEvent, Serialized } from "@/sync"
import { errors } from "../error"
import { lazy } from "../../util/lazy"

const ReplayEvent = Serialized

const HistoryEvent = z.object({
  id: z.string(),
  aggregate_id: z.string(),
  seq: z.number().int().min(0),
  type: z.string(),
  data: z.record(z.string(), z.unknown()),
})

export const SyncRoutes = lazy(() =>
  new Hono()
    .post(
      "/start",
      describeRoute({
        summary: "Start workspace sync",
        description: "Start sync loops for workspaces in the current project that have active sessions.",
        operationId: "sync.start",
        responses: {
          200: {
            description: "Workspace sync started",
            content: {
              "application/json": {
                schema: resolver(z.boolean()),
              },
            },
          },
        },
      }),
      async (c) => {
        Workspace.startSyncing(Instance.project)
        return c.json(true)
      },
    )
    .post(
      "/replay",
      describeRoute({
        summary: "Replay sync events",
        description: "Validate and replay a complete sync event history.",
        operationId: "sync.replay",
        responses: {
          200: {
            description: "Replayed sync events",
            content: {
              "application/json": {
                schema: resolver(
                  z.object({
                    sessionID: z.string(),
                  }),
                ),
              },
            },
          },
          ...errors(400),
        },
      }),
      validator(
        "json",
        z.object({
          directory: z.string(),
          events: z.array(ReplayEvent).min(1),
        }),
      ),
      async (c) => {
        const body = c.req.valid("json")
        const sessionID = SyncEvent.replayAll(body.events) ?? body.events[0].aggregateID
        return c.json({ sessionID })
      },
    )
    .post(
      "/history",
      describeRoute({
        summary: "List sync events",
        description:
          "List sync events for all aggregates. Keys are aggregate IDs the client already knows about, values are the last known sequence ID. Events with seq > value are returned for those aggregates. Aggregates not listed in the input get their full history.",
        operationId: "sync.history.list",
        responses: {
          200: {
            description: "Sync events",
            content: {
              "application/json": {
                schema: resolver(z.array(HistoryEvent)),
              },
            },
          },
          ...errors(400),
        },
      }),
      validator("json", z.record(z.string(), z.number().int().min(0))),
      async (c) => {
        const body = c.req.valid("json")
        return c.json(
          SyncEvent.history(body).map((item) => ({
            id: item.id,
            aggregate_id: item.aggregateID,
            seq: item.seq,
            type: item.type,
            data: item.data,
          })),
        )
      },
    ),
)
