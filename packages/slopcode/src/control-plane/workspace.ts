import z from "zod"
import { setTimeout as sleep } from "node:timers/promises"
import { asc, eq } from "drizzle-orm"
import { Identifier } from "@/id/id"
import { fn } from "@/util/fn"
import { Database } from "@/storage/db"
import { Project } from "@/project/project"
import { BusEvent } from "@/bus/bus-event"
import { GlobalBus } from "@/bus/global"
import { Log } from "@/util/log"
import { Filesystem } from "@/util/filesystem"
import { WorkspaceTable } from "./workspace.sql"
import { Config } from "./config"
import { getAdaptor, listAdaptors } from "./adaptors"
import { parseSSE } from "./sse"
import { SyncEvent } from "@/sync"
import { EventTable } from "@/sync/event.sql"

export namespace Workspace {
  export const ConnectionStatus = z
    .object({
      workspaceID: Identifier.schema("workspace"),
      status: z.enum(["connected", "connecting", "disconnected", "error"]),
    })
    .meta({
      ref: "WorkspaceConnectionStatus",
    })
  export type ConnectionStatus = z.infer<typeof ConnectionStatus>

  export const Event = {
    Ready: BusEvent.define(
      "workspace.ready",
      z.object({
        name: z.string(),
      }),
    ),
    Failed: BusEvent.define(
      "workspace.failed",
      z.object({
        message: z.string(),
      }),
    ),
    Restore: BusEvent.define(
      "workspace.restore",
      z.object({
        workspaceID: Identifier.schema("workspace"),
        sessionID: Identifier.schema("session"),
        total: z.number().int().min(0),
        step: z.number().int().min(0),
      }),
    ),
    Status: BusEvent.define("workspace.status", ConnectionStatus),
  }

  export const Info = z
    .object({
      id: Identifier.schema("workspace"),
      branch: z.string().nullable(),
      projectID: z.string(),
      config: Config,
    })
    .meta({
      ref: "Workspace",
    })
  export type Info = z.infer<typeof Info>

  export const AdaptorInfo = z.object({
    type: z.string(),
    name: z.string(),
    description: z.string(),
  })

  export const SessionRestoreInput = z.object({
    workspaceID: Identifier.schema("workspace"),
    sessionID: Identifier.schema("session"),
  })
  export type SessionRestoreInput = z.infer<typeof SessionRestoreInput>

  function fromRow(row: typeof WorkspaceTable.$inferSelect): Info {
    return {
      id: row.id,
      branch: row.branch,
      projectID: row.project_id,
      config: row.config,
    }
  }

  const log = Log.create({ service: "workspace-sync" })
  const connections = new Map<string, ConnectionStatus>()

  const setStatus = (workspaceID: string, status: ConnectionStatus["status"]) => {
    const prev = connections.get(workspaceID)
    if (prev?.status === status) return
    const next = { workspaceID, status }
    connections.set(workspaceID, next)
    GlobalBus.emit("event", {
      directory: "global",
      payload: {
        type: Event.Status.type,
        properties: next,
      },
    })
  }

  export const create = fn(
    z.object({
      id: Identifier.schema("workspace").optional(),
      projectID: Info.shape.projectID,
      branch: Info.shape.branch,
      config: Info.shape.config,
    }),
    async (input) => {
      const id = Identifier.ascending("workspace", input.id)
      const { config, init } = await getAdaptor(input.projectID, input.config.type).create(input.config, input.branch)

      const info: Info = {
        id,
        projectID: input.projectID,
        branch: input.branch,
        config,
      }

      setTimeout(async () => {
        await init()

        Database.use((db) => {
          db.insert(WorkspaceTable)
            .values({
              id: info.id,
              branch: info.branch,
              project_id: info.projectID,
              config: info.config,
            })
            .run()
        })

        GlobalBus.emit("event", {
          directory: id,
          payload: {
            type: Event.Ready.type,
            properties: {
              name: info.id,
            },
          },
        })
      }, 0)

      return info
    },
  )

  export function adaptors(project: Project.Info) {
    return listAdaptors(project.id)
  }

  export function list(project: Project.Info) {
    const rows = Database.use((db) =>
      db.select().from(WorkspaceTable).where(eq(WorkspaceTable.project_id, project.id)).all(),
    )
    return rows.map(fromRow).sort((a, b) => a.id.localeCompare(b.id))
  }

  export const get = fn(Identifier.schema("workspace"), async (id) => {
    const row = Database.use((db) => db.select().from(WorkspaceTable).where(eq(WorkspaceTable.id, id)).get())
    if (!row) return
    return fromRow(row)
  })

  export function status(project?: Project.Info) {
    const spaces = project ? list(project) : Database.use((db) => db.select().from(WorkspaceTable).all()).map(fromRow)
    return spaces.map((space) => {
      if (space.config.type === "worktree") {
        const dir = typeof space.config.directory === "string" ? space.config.directory : ""
        const ok = Filesystem.stat(dir)?.isDirectory() ?? false
        return {
          workspaceID: space.id,
          status: ok ? "connected" : "error",
        } satisfies ConnectionStatus
      }

      return (
        connections.get(space.id) ?? {
          workspaceID: space.id,
          status: "disconnected",
        }
      )
    })
  }

  export const remove = fn(Identifier.schema("workspace"), async (id) => {
    const row = Database.use((db) => db.select().from(WorkspaceTable).where(eq(WorkspaceTable.id, id)).get())
    if (!row) return
    const info = fromRow(row)
    await getAdaptor(info.projectID, info.config.type).remove(info.config)
    Database.use((db) => db.delete(WorkspaceTable).where(eq(WorkspaceTable.id, id)).run())
    connections.delete(id)
    return info
  })

  async function workspaceEventLoop(space: Info, stop: AbortSignal) {
    while (!stop.aborted) {
      setStatus(space.id, "connecting")
      const res = await getAdaptor(space.projectID, space.config.type)
        .request(space.config, "GET", "/event", undefined, stop)
        .catch(() => undefined)
      if (!res || !res.ok || !res.body) {
        setStatus(space.id, "error")
        await sleep(1000)
        continue
      }
      setStatus(space.id, "connected")
      await parseSSE(res.body, stop, (event) => {
        GlobalBus.emit("event", {
          directory: space.id,
          payload: event,
        })
      })
      setStatus(space.id, "disconnected")
      await sleep(250)
    }
  }

  export function startSyncing(project: Project.Info) {
    const stop = new AbortController()
    const spaces = list(project).filter((space) => space.config.type !== "worktree")

    spaces.forEach((space) => {
      void workspaceEventLoop(space, stop.signal).catch((error) => {
        setStatus(space.id, "error")
        log.warn("workspace sync listener failed", {
          workspaceID: space.id,
          error,
        })
      })
    })

    return {
      async stop() {
        stop.abort()
      },
    }
  }

  export const sessionRestore = fn(SessionRestoreInput, async (input) => {
    const space = await get(input.workspaceID)
    if (!space) throw new Error(`Workspace not found: ${input.workspaceID}`)

    const rows = Database.use((db) =>
      db
        .select()
        .from(EventTable)
        .where(eq(EventTable.aggregate_id, input.sessionID))
        .orderBy(asc(EventTable.seq))
        .all(),
    )
      .map((row) =>
        SyncEvent.row({
          id: row.id,
          aggregate_id: row.aggregate_id,
          seq: row.seq,
          type: row.type,
          data: row.data,
        }),
      )
      .map((row) => ({
        id: row.id,
        aggregateID: row.aggregate_id,
        seq: row.seq,
        type: row.type,
        data: row.data,
      }))

    if (rows.length === 0) throw new Error(`No events found for session: ${input.sessionID}`)

    const size = 10
    const total = Math.ceil(rows.length / size)

    GlobalBus.emit("event", {
      directory: "global",
      payload: {
        type: Event.Restore.type,
        properties: {
          workspaceID: input.workspaceID,
          sessionID: input.sessionID,
          total,
          step: 0,
        },
      },
    })

    for (let i = 0; i < total; i++) {
      const events = rows.slice(i * size, (i + 1) * size)
      if (space.config.type === "worktree") {
        SyncEvent.replayAll(events)
      } else {
        const res = await getAdaptor(space.projectID, space.config.type)
          .request(
            space.config,
            "POST",
            "/sync/replay",
            JSON.stringify({
              directory: typeof space.config.directory === "string" ? space.config.directory : "",
              events,
            }),
          )
          .catch(() => undefined)
        if (!res?.ok) {
          const body = await res?.text().catch(() => "")
          throw new Error(`Failed to replay session ${input.sessionID}: ${res?.status ?? 0} ${body ?? ""}`)
        }
      }

      GlobalBus.emit("event", {
        directory: "global",
        payload: {
          type: Event.Restore.type,
          properties: {
            workspaceID: input.workspaceID,
            sessionID: input.sessionID,
            total,
            step: i + 1,
          },
        },
      })
    }

    return { total }
  })
}
