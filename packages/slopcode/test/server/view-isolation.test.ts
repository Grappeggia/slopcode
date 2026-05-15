import { expect, test } from "bun:test"
import { Instance } from "../../src/project/instance"
import { Question } from "../../src/question"
import { PermissionNext } from "../../src/permission/next"
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

test("server routes share question state across view id", async () => {
  await using tmp = await tmpdir({ git: true })
  let answer!: Promise<string[][]>

  await Instance.provide({
    directory: tmp.path,
    viewID: "view-a",
    fn: async () => {
      answer = Question.ask({
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

  const app = Server.App()
  const headers = (viewID: string, json = false) => ({
    "x-slopcode-directory": tmp.path,
    "x-slopcode-view-id": viewID,
    ...(json ? { "content-type": "application/json" } : {}),
  })

  const response = await app.request("/question?sessionID=ses_a", { headers: headers("view-b") })
  const list = (await response.json()) as Question.Request[]

  expect(list.map((item: Question.Request) => item.sessionID)).toEqual(["ses_a"])

  await app.request(`/question/${list[0]!.id}/reply?sessionID=ses_a`, {
    method: "POST",
    headers: headers("view-b", true),
    body: JSON.stringify({ answers: [["A"]] }),
  })

  await expect(answer).resolves.toEqual([["A"]])
})

test("server routes share permission state across view id", async () => {
  await using tmp = await tmpdir({ git: true })
  let answer!: Promise<void>

  await Instance.provide({
    directory: tmp.path,
    viewID: "view-a",
    fn: async () => {
      answer = PermissionNext.ask({
        sessionID: "ses_a",
        permission: "bash",
        patterns: ["ls"],
        metadata: {},
        always: [],
        ruleset: [{ permission: "bash", pattern: "*", action: "ask" }],
      })
    },
  })

  const app = Server.App()
  const headers = (viewID: string, json = false) => ({
    "x-slopcode-directory": tmp.path,
    "x-slopcode-view-id": viewID,
    ...(json ? { "content-type": "application/json" } : {}),
  })

  const response = await app.request("/permission?sessionID=ses_a", { headers: headers("view-b") })
  const list = (await response.json()) as PermissionNext.Request[]

  expect(list.map((item: PermissionNext.Request) => item.sessionID)).toEqual(["ses_a"])

  await app.request(`/permission/${list[0]!.id}/reply?sessionID=ses_a`, {
    method: "POST",
    headers: headers("view-b", true),
    body: JSON.stringify({ reply: "once" }),
  })

  await expect(answer).resolves.toBeUndefined()
})

test("server streams blocker requests across view id", async () => {
  await using tmp = await tmpdir({ git: true })
  const app = Server.App()
  const headers = (viewID: string, json = false) => ({
    "x-slopcode-directory": tmp.path,
    "x-slopcode-view-id": viewID,
    ...(json ? { "content-type": "application/json" } : {}),
  })

  const stop = new AbortController()
  const response = await app.request("/event?sessionID=ses_a", { headers: headers("view-b"), signal: stop.signal })
  if (!response.body) throw new Error("missing event stream")
  const reader = response.body.getReader()
  expect((await next(reader, "server.connected")).type).toBe("server.connected")

  let answer!: Promise<string[][]>
  await Instance.provide({
    directory: tmp.path,
    viewID: "view-a",
    fn: async () => {
      answer = Question.ask({
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

  const event = await next(reader, "question.asked")
  expect(event.properties.sessionID).toBe("ses_a")
  expect(event.properties.viewID).toBe("view-a")

  await app.request(`/question/${event.properties.id}/reply?sessionID=ses_a`, {
    method: "POST",
    headers: headers("view-b", true),
    body: JSON.stringify({ answers: [["A"]] }),
  })
  await expect(answer).resolves.toEqual([["A"]])

  stop.abort()
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
