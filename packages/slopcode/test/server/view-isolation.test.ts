import { expect, test } from "bun:test"
import { Instance } from "../../src/project/instance"
import { Question } from "../../src/question"
import { Server } from "../../src/server/server"
import { SessionStatus } from "../../src/session/status"
import { tmpdir } from "../fixture/fixture"

type Event = { type: string; properties: Record<string, unknown> }

async function next(reader: ReadableStreamDefaultReader<Uint8Array>, type: string, timeout = 1_000) {
  const decoder = new TextDecoder()
  let text = ""
  const start = Date.now()
  while (Date.now() - start < timeout) {
    const value = await Promise.race([reader.read(), Bun.sleep(25).then(() => undefined)])
    if (!value) continue
    if (value.done) throw new Error("event stream closed")
    text += decoder.decode(value.value, { stream: true })
    while (true) {
      const end = text.indexOf("\n\n")
      if (end === -1) break
      const chunk = text.slice(0, end)
      text = text.slice(end + 2)
      const line = chunk.split("\n").find((item) => item.startsWith("data: "))
      if (!line) continue
      const event = JSON.parse(line.slice(6)) as Event
      if (event.type === type) return event
    }
  }
  throw new Error(`timed out waiting for ${type}`)
}

test("server routes isolate question state by view id", async () => {
  await using tmp = await tmpdir({ git: true })
  let a!: Promise<string[][]>
  let b!: Promise<string[][]>

  await Instance.provide({
    directory: tmp.path,
    viewID: "view-a",
    fn: async () => {
      a = Question.ask({
        sessionID: "ses_a",
        questions: [
          {
            question: "Question A?",
            header: "A",
            options: [{ label: "A", description: "A" }],
          },
        ],
      })
    },
  })

  await Instance.provide({
    directory: tmp.path,
    viewID: "view-b",
    fn: async () => {
      b = Question.ask({
        sessionID: "ses_b",
        questions: [
          {
            question: "Question B?",
            header: "B",
            options: [{ label: "B", description: "B" }],
          },
        ],
      })
    },
  })

  const app = Server.App()
  const headers = (viewID: string, json = false) => ({
    "x-slopcode-directory": tmp.path,
    "x-slopcode-view-id": viewID,
    ...(json ? { "content-type": "application/json" } : {}),
  })

  const responseA = await app.request("/question", { headers: headers("view-a") })
  const responseB = await app.request("/question", { headers: headers("view-b") })
  const listA = (await responseA.json()) as Question.Request[]
  const listB = (await responseB.json()) as Question.Request[]

  expect(listA.map((item: Question.Request) => item.sessionID)).toEqual(["ses_a"])
  expect(listB.map((item: Question.Request) => item.sessionID)).toEqual(["ses_b"])

  await app.request(`/question/${listA[0]!.id}/reply?sessionID=ses_a`, {
    method: "POST",
    headers: headers("view-a", true),
    body: JSON.stringify({ answers: [["A"]] }),
  })
  await app.request(`/question/${listB[0]!.id}/reply?sessionID=ses_b`, {
    method: "POST",
    headers: headers("view-b", true),
    body: JSON.stringify({ answers: [["B"]] }),
  })

  await expect(a).resolves.toEqual([["A"]])
  await expect(b).resolves.toEqual([["B"]])
})

test("server streams session status across view id", async () => {
  await using tmp = await tmpdir({ git: true })
  const app = Server.App()
  const headers = (viewID: string) => ({
    "x-slopcode-directory": tmp.path,
    "x-slopcode-view-id": viewID,
  })

  const stopA = new AbortController()
  const stopB = new AbortController()
  const responseA = await app.request("/event?sessionID=ses_a", { headers: headers("view-a"), signal: stopA.signal })
  const responseB = await app.request("/event?sessionID=ses_a", { headers: headers("view-b"), signal: stopB.signal })
  if (!responseA.body || !responseB.body) throw new Error("missing event stream")
  const readerA = responseA.body.getReader()
  const readerB = responseB.body.getReader()

  expect((await next(readerA, "server.connected")).type).toBe("server.connected")
  expect((await next(readerB, "server.connected")).type).toBe("server.connected")

  await Instance.provide({
    directory: tmp.path,
    viewID: "view-a",
    fn: async () => {
      SessionStatus.busy("ses_a", "running")
    },
  })

  const eventA = await next(readerA, "session.status")
  const eventB = await next(readerB, "session.status")
  expect(eventA.properties.sessionID).toBe("ses_a")
  expect(eventB.properties.sessionID).toBe("ses_a")
  expect(eventA.properties.viewID).toBe("view-a")
  expect(eventB.properties.viewID).toBe("view-a")

  stopA.abort()
  stopB.abort()
})
