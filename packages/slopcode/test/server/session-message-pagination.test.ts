import { describe, expect, test } from "bun:test"
import { Instance } from "../../src/project/instance"
import { Session } from "../../src/session"
import { MessageTable } from "../../src/session/session.sql"
import { Server } from "../../src/server/server"
import { Database } from "../../src/storage/db"
import { Log } from "../../src/util/log"
import { tmpdir } from "../fixture/fixture"

Log.init({ print: false })

describe("session.messages endpoint", () => {
  test("supports cursor pagination with x-next-cursor header", async () => {
    await using tmp = await tmpdir({ git: true })

    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const session = await Session.create({})
        const start = Date.now()
        const rows = [
          {
            id: "message-1",
            session_id: session.id,
            time_created: start,
            time_updated: start,
            data: {
              role: "user" as const,
              time: { created: start },
              agent: "build",
              model: { providerID: "openai", modelID: "gpt-5" },
            },
          },
          {
            id: "message-2",
            session_id: session.id,
            time_created: start + 10,
            time_updated: start + 10,
            data: {
              role: "user" as const,
              time: { created: start + 10 },
              agent: "build",
              model: { providerID: "openai", modelID: "gpt-5" },
            },
          },
          {
            id: "message-3",
            session_id: session.id,
            time_created: start + 20,
            time_updated: start + 20,
            data: {
              role: "user" as const,
              time: { created: start + 20 },
              agent: "build",
              model: { providerID: "openai", modelID: "gpt-5" },
            },
          },
        ]

        Database.use((db) => {
          rows.forEach((row) => {
            db.insert(MessageTable).values(row).run()
          })
        })

        const app = Server.App()
        const first = await app.request(`/session/${session.id}/message?limit=2`)
        expect(first.status).toBe(200)

        const firstBody = (await first.json()) as Array<{ info: { id: string; time: { created: number } } }>
        expect(firstBody.map((item) => item.info.id)).toEqual(["message-2", "message-3"])
        expect(first.headers.get("x-next-cursor")).toBe(String(start + 10))

        const second = await app.request(
          `/session/${session.id}/message?limit=2&cursor=${encodeURIComponent(String(start + 10))}`,
        )
        expect(second.status).toBe(200)

        const secondBody = (await second.json()) as Array<{ info: { id: string } }>
        expect(secondBody.map((item) => item.info.id)).toEqual(["message-1"])
        expect(second.headers.get("x-next-cursor")).toBeNull()
      },
    })
  })
})
