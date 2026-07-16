import { afterAll, describe, expect, mock, test } from "bun:test"
import { TextareaRenderable } from "@opentui/core"
import { createTestRenderer } from "@opentui/core/testing"
import type { TuiPluginApi } from "@slopcode-ai/plugin/tui"
import type { Agent, GlobalEvent, Model, Provider, Session, UserMessage } from "@slopcode-ai/sdk/v2"
import { Effect } from "effect"
import { mkdir } from "node:fs/promises"
import path from "node:path"
import { Global } from "@slopcode-ai/core/global"
import { createTuiResolvedConfig } from "./fixture/tui-runtime"
import { createEventSource, createFetch, json } from "./fixture/tui-sdk"
import { tmpdir } from "./fixture/fixture"

type Setup = Awaited<ReturnType<typeof createTestRenderer>>
type CreatedEvent = GlobalEvent & {
  payload: Extract<GlobalEvent["payload"], { type: "session.created" }>
}

let target: Setup | undefined
const core = await import("@opentui/core")
void mock.module("@opentui/core", () => ({
  ...core,
  createCliRenderer: async () => {
    if (!target) throw new Error("test renderer is not ready")
    return target.renderer
  },
}))
afterAll(() => mock.restore())

type RequestTrace = {
  method: string
  path: string
  query: Record<string, string>
  body?: unknown
}

type ControlTrace = {
  response: { request: string; status: number; body: unknown }[]
  event: CreatedEvent[]
}

const agent = {
  name: "build",
  mode: "primary",
  permission: [],
  options: {},
} satisfies Agent

function model(providerID: string, id: string) {
  return {
    id,
    providerID,
    api: { id, url: "http://model.test", npm: "@ai-sdk/openai-compatible" },
    name: id,
    capabilities: {
      temperature: true,
      reasoning: false,
      attachment: false,
      toolcall: true,
      input: { text: true, audio: false, image: false, video: false, pdf: false },
      output: { text: true, audio: false, image: false, video: false, pdf: false },
      interleaved: false,
    },
    cost: { input: 0, output: 0, cache: { read: 0, write: 0 } },
    limit: { context: 100_000, output: 4_000 },
    status: "active",
    options: {},
    headers: {},
    release_date: "2026-01-01",
  } satisfies Model
}

function provider(id: string, modelID: string) {
  return {
    id,
    name: id,
    source: "custom",
    env: [],
    options: {},
    models: { [modelID]: model(id, modelID) },
  } satisfies Provider
}

function session(input: { id: string; directory: string; workspaceID?: string; model?: Model }): Session {
  return {
    id: input.id,
    slug: input.id,
    projectID: "proj_test",
    workspaceID: input.workspaceID,
    directory: input.directory,
    title: "New Session",
    agent: "build",
    model: input.model
      ? { providerID: input.model.providerID, id: input.model.id }
      : { providerID: "global", id: "global-model" },
    version: "0.0.0-test",
    time: { created: 1, updated: 1 },
  }
}

function message(sessionID: string, providerID: string, modelID: string, text: string) {
  const info = {
    id: `msg_${sessionID}`,
    sessionID,
    role: "user",
    time: { created: 1 },
    agent: "build",
    model: { providerID, modelID },
  } satisfies UserMessage
  return {
    info,
    parts: [{ id: `part_${sessionID}`, sessionID, messageID: info.id, type: "text", text }],
  }
}

async function body(request: Request) {
  if (request.method === "GET" || request.method === "HEAD") return undefined
  const text = await request.clone().text()
  if (!text) return undefined
  return JSON.parse(text) as unknown
}

function record(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined
  return Object.fromEntries(Object.entries(value))
}

function promptText(value: unknown) {
  const parts = record(value)?.parts
  if (!Array.isArray(parts)) return undefined
  const part = parts.map(record).find((item) => item?.type === "text")
  return typeof part?.text === "string" ? part.text : undefined
}

async function wait(check: () => boolean, timeout = 4_000) {
  const start = Date.now()
  while (!check()) {
    if (Date.now() - start > timeout) throw new Error("timed out waiting for condition")
    await Bun.sleep(10)
  }
}

async function mount(input: {
  root: string
  args?: { sessionID?: string }
  fetch: typeof globalThis.fetch
  events: ReturnType<typeof createEventSource>["source"]
}) {
  await Bun.write(path.join(input.root, "state", "kv.json"), "{}")
  const setup = await createTestRenderer({ width: 100, height: 30, useThread: false })
  target = setup
  let api: TuiPluginApi | undefined
  let disposeSlots: (() => void) | undefined
  let started!: () => void
  const ready = new Promise<void>((resolve) => (started = resolve))
  const { run } = await import("../src/app")
  const task = Effect.runPromise(
    run({
      url: "http://test",
      directory: input.root,
      config: createTuiResolvedConfig({ plugin_enabled: {} }),
      fetch: input.fetch,
      events: input.events,
      args: input.args ?? {},
      pluginHost: {
        async start(value) {
          api = value.api
          const slots = value.runtime.setupSlots(value.api)
          disposeSlots = slots.dispose
          started()
        },
        async dispose() {
          disposeSlots?.()
        },
      },
    }).pipe(
      Effect.provide(
        Global.layerWith({
          home: input.root,
          data: path.join(input.root, "data"),
          cache: path.join(input.root, "cache"),
          config: path.join(input.root, "config"),
          state: path.join(input.root, "state"),
          tmp: path.join(input.root, "tmp"),
          bin: path.join(input.root, "bin"),
          log: path.join(input.root, "log"),
          repos: path.join(input.root, "repos"),
        }),
      ),
    ),
  )
  await ready
  let stopped = false
  const paint = (async () => {
    while (!setup.renderer.isDestroyed) {
      if (stopped) break
      await setup.renderOnce()
      await Bun.sleep(5)
    }
  })()
  return {
    setup,
    task,
    get api() {
      if (!api) throw new Error("TUI API is not ready")
      return api
    },
    async close() {
      stopped = true
      if (!setup.renderer.isDestroyed) setup.renderer.destroy()
      await paint
      await task
      target = undefined
    },
  }
}

function fixture(input: {
  root: string
  events: ReturnType<typeof createEventSource>
  sessions?: Session[]
  workspace?: boolean
  create: (request: RequestTrace, count: number) => Promise<Response> | Response
  prompt: (request: RequestTrace, sessionID: string) => Promise<Response> | Response
}) {
  const requests: RequestTrace[] = []
  const controls: ControlTrace = { response: [], event: [] }
  const sessions = new Map((input.sessions ?? []).map((item) => [item.id, item]))
  const global = provider("global", "global-model")
  const workspace = provider("workspace", "workspace-model")
  let creates = 0

  function response(request: string, data: unknown, status = 200) {
    controls.response.push({ request, status, body: data })
    return json(data, { status })
  }

  function emit(info: Session) {
    const event = {
      directory: info.directory,
      workspace: info.workspaceID,
      project: "proj_test",
      payload: {
        id: `evt_${info.id}`,
        type: "session.created",
        properties: { sessionID: info.id, info },
      },
    } satisfies CreatedEvent
    controls.event.push(event)
    input.events.emit(event)
  }

  const calls = createFetch(async (url, raw) => {
    if (!raw) return undefined
    const request = {
      method: raw.method,
      path: url.pathname,
      query: Object.fromEntries(url.searchParams),
      body: await body(raw),
    } satisfies RequestTrace
    requests.push(request)
    const currentWorkspace = url.searchParams.get("workspace")

    if (url.pathname === "/path")
      return json({
        home: input.root,
        state: path.join(input.root, "state"),
        config: path.join(input.root, "config"),
        worktree: input.root,
        directory: currentWorkspace ? path.join(input.root, "workspace") : input.root,
      })
    if (url.pathname === "/project/current") return json({ id: "proj_test", worktree: input.root })
    if (url.pathname === "/project/proj_test/directories") return json([{ directory: input.root, strategy: undefined }])
    if (url.pathname === "/config/providers") {
      const selected = currentWorkspace === "work_1" ? workspace : global
      return json({ providers: [selected], default: { [selected.id]: Object.keys(selected.models)[0] } })
    }
    if (url.pathname === "/provider") {
      const selected = currentWorkspace === "work_1" ? workspace : global
      return json({ all: [selected], default: { [selected.id]: Object.keys(selected.models)[0] }, connected: [] })
    }
    if (url.pathname === "/agent") return json([agent])
    if (url.pathname === "/config") return json({})
    if (url.pathname === "/experimental/workspace")
      return json(
        input.workspace
          ? [
              {
                id: "work_1",
                type: "worktree",
                name: "Workspace One",
                directory: path.join(input.root, "workspace"),
                projectID: "proj_test",
                timeUsed: 1,
              },
            ]
          : [],
      )
    if (url.pathname === "/experimental/workspace/status")
      return json(input.workspace ? [{ workspaceID: "work_1", status: "connected" }] : [])
    if (url.pathname === "/session" && raw.method === "GET") return json([...sessions.values()])
    if (url.pathname === "/session" && raw.method === "POST") {
      creates++
      return input.create(request, creates)
    }

    const match = url.pathname.match(/^\/session\/([^/]+)$/)
    if (match && raw.method === "GET") {
      const info = sessions.get(match[1])
      if (!info) return response(request.path, { name: "NotFoundError", data: { message: "missing" } }, 404)
      return json(info)
    }
    const messagePath = url.pathname.match(/^\/session\/([^/]+)\/message$/)
    if (messagePath && raw.method === "GET") return json([])
    if (messagePath && raw.method === "POST") return input.prompt(request, messagePath[1])
    if (/^\/session\/[^/]+\/(todo|diff)$/.test(url.pathname)) return json([])
    return undefined
  })

  return { requests, controls, sessions, response, emit, fetch: calls.fetch }
}

function focused(app: Setup) {
  return app.renderer.currentFocusedEditor instanceof TextareaRenderable ? app.renderer.currentFocusedEditor : undefined
}

describe.serial("new prompt integration", () => {
  test("/new keeps a workspace-only model on session create and first prompt", async () => {
    await using tmp = await tmpdir()
    await Promise.all(
      ["data", "cache", "config", "state", "tmp", "bin", "log", "repos", "workspace"].map((dir) =>
        mkdir(path.join(tmp.path, dir), { recursive: true }),
      ),
    )
    const events = createEventSource()
    const workspaceModel = model("workspace", "workspace-model")
    const existing = session({
      id: "ses_existing",
      directory: path.join(tmp.path, "workspace"),
      workspaceID: "work_1",
      model: workspaceModel,
    })
    let harness!: ReturnType<typeof fixture>
    harness = fixture({
      root: tmp.path,
      events,
      sessions: [existing],
      workspace: true,
      create(request) {
        const created = session({
          id: "ses_workspace_new",
          directory: path.join(tmp.path, "workspace"),
          workspaceID: "work_1",
          model: workspaceModel,
        })
        harness.sessions.set(created.id, created)
        queueMicrotask(() => harness.emit(created))
        return harness.response(`${request.method} ${request.path}`, created)
      },
      prompt(request, sessionID) {
        const payload = record(request.body)
        const selected = record(payload?.model)
        const accepted =
          request.query.workspace === "work_1" &&
          request.query.directory === path.join(tmp.path, "workspace") &&
          selected?.providerID === "workspace" &&
          selected.modelID === "workspace-model" &&
          payload?.agent === "build" &&
          promptText(payload) === "workspace first prompt"
        if (!accepted)
          return harness.response(
            `${request.method} ${request.path}`,
            { name: "ProviderNotFoundError", data: { message: "workspace provider unavailable" } },
            400,
          )
        return harness.response(
          `${request.method} ${request.path}`,
          message(sessionID, "workspace", "workspace-model", "workspace first prompt"),
        )
      },
    })
    const app = await mount({
      root: tmp.path,
      args: { sessionID: existing.id },
      fetch: harness.fetch,
      events: events.source,
    })

    try {
      await wait(
        () =>
          app.api.route.current.name === "session" &&
          app.api.route.current.params?.sessionID === existing.id &&
          harness.requests.some((item) => item.path === "/config/providers" && item.query.workspace === "work_1") &&
          focused(app.setup) !== undefined,
      )
      app.api.keymap.dispatchCommand("session.new")
      await wait(() => app.api.route.current.name === "home" && focused(app.setup)?.plainText === "")
      await app.setup.mockInput.typeText("workspace first prompt")
      app.setup.mockInput.pressEnter()
      await wait(() => harness.requests.some((item) => item.path === "/session/ses_workspace_new/message"))

      const create = harness.requests.find((item) => item.path === "/session" && item.method === "POST")
      const prompt = harness.requests.find((item) => item.path === "/session/ses_workspace_new/message")
      expect(create).toMatchObject({
        query: { directory: path.join(tmp.path, "workspace"), workspace: "work_1" },
        body: {
          agent: "build",
          model: { providerID: "workspace", id: "workspace-model" },
        },
      })
      expect(prompt).toMatchObject({
        query: { directory: path.join(tmp.path, "workspace"), workspace: "work_1" },
        body: {
          agent: "build",
          model: { providerID: "workspace", modelID: "workspace-model" },
          parts: [{ type: "text", text: "workspace first prompt" }],
        },
      })
      await wait(
        () =>
          app.api.route.current.name === "session" && app.api.route.current.params?.sessionID === "ses_workspace_new",
      )
      expect(harness.controls.response.at(-1)?.status).toBe(200)
      expect(harness.controls.event.map((item) => item.payload.type)).toEqual(["session.created"])
    } finally {
      await app.close()
    }
  })

  test("/new owns a fresh Home prompt while an older session.create is delayed", async () => {
    await using tmp = await tmpdir()
    await Promise.all(
      ["data", "cache", "config", "state", "tmp", "bin", "log", "repos"].map((dir) =>
        mkdir(path.join(tmp.path, dir), { recursive: true }),
      ),
    )
    const events = createEventSource()
    let release!: (response: Response) => void
    const delayed = new Promise<Response>((resolve) => (release = resolve))
    let harness!: ReturnType<typeof fixture>
    harness = fixture({
      root: tmp.path,
      events,
      create(request, count) {
        const created = session({ id: count === 1 ? "ses_old" : "ses_new", directory: tmp.path })
        harness.sessions.set(created.id, created)
        if (count === 1) return delayed
        queueMicrotask(() => harness.emit(created))
        return harness.response(`${request.method} ${request.path} #${count}`, created)
      },
      prompt(request, sessionID) {
        return harness.response(
          `${request.method} ${request.path}`,
          message(sessionID, "global", "global-model", promptText(request.body) ?? ""),
        )
      },
    })
    const app = await mount({ root: tmp.path, fetch: harness.fetch, events: events.source })

    try {
      await wait(() => app.api.route.current.name === "home" && focused(app.setup) !== undefined)
      await app.setup.mockInput.typeText("older prompt")
      app.setup.mockInput.pressEnter()
      await wait(
        () => harness.requests.filter((item) => item.path === "/session" && item.method === "POST").length === 1,
      )

      app.api.keymap.dispatchCommand("session.new")
      await wait(() => focused(app.setup)?.plainText === "")
      await app.setup.mockInput.typeText("newer prompt")
      app.setup.mockInput.pressEnter()
      await wait(
        () => harness.requests.filter((item) => item.path === "/session" && item.method === "POST").length === 2,
      )
      await wait(
        () => app.api.route.current.name === "session" && app.api.route.current.params?.sessionID === "ses_new",
      )

      const old = harness.sessions.get("ses_old")!
      harness.controls.response.push({ request: "POST /session #1", status: 200, body: old })
      release(json(old))
      queueMicrotask(() => harness.emit(old))
      await wait(() => harness.requests.some((item) => item.path === "/session/ses_old/message"))
      await Bun.sleep(80)

      expect(
        harness.requests
          .filter((item) => item.method === "POST" && item.path.endsWith("/message"))
          .map((item) => ({
            sessionID: item.path.split("/")[2],
            text: promptText(item.body),
          })),
      ).toEqual([
        { sessionID: "ses_new", text: "newer prompt" },
        { sessionID: "ses_old", text: "older prompt" },
      ])
      expect(app.api.route.current).toMatchObject({ name: "session", params: { sessionID: "ses_new" } })
      expect(harness.controls.event.map((item) => item.payload.properties.sessionID)).toEqual(["ses_new", "ses_old"])
    } finally {
      release(json(session({ id: "ses_old", directory: tmp.path })))
      await app.close()
    }
  })

  test("a rejected first prompt stays in its draft without success navigation", async () => {
    await using tmp = await tmpdir()
    await Promise.all(
      ["data", "cache", "config", "state", "tmp", "bin", "log", "repos"].map((dir) =>
        mkdir(path.join(tmp.path, dir), { recursive: true }),
      ),
    )
    const events = createEventSource()
    let harness!: ReturnType<typeof fixture>
    harness = fixture({
      root: tmp.path,
      events,
      create(request) {
        const created = session({ id: "ses_rejected", directory: tmp.path })
        harness.sessions.set(created.id, created)
        queueMicrotask(() => harness.emit(created))
        return harness.response(`${request.method} ${request.path}`, created)
      },
      prompt(request) {
        return harness.response(
          `${request.method} ${request.path}`,
          { name: "ProviderAuthError", data: { providerID: "global", message: "rejected by control" } },
          400,
        )
      },
    })
    const app = await mount({ root: tmp.path, fetch: harness.fetch, events: events.source })

    try {
      await wait(() => app.api.route.current.name === "home" && focused(app.setup) !== undefined)
      await app.setup.mockInput.typeText("keep this exact prompt")
      app.setup.mockInput.pressEnter()
      await wait(() => harness.controls.response.some((item) => item.request.includes("/message")))
      await Bun.sleep(80)

      expect(app.api.route.current).toEqual({ name: "home" })
      expect(focused(app.setup)?.plainText).toBe("keep this exact prompt")
      expect(harness.controls.response.at(-1)).toMatchObject({ status: 400 })
    } finally {
      await app.close()
    }
  })
})
