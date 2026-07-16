import { afterAll, describe, expect, mock, test } from "bun:test"
import { TextareaRenderable } from "@opentui/core"
import { createTestRenderer } from "@opentui/core/testing"
import type { TuiPluginApi } from "@slopcode-ai/plugin/tui"
import type { Agent, GlobalEvent, Model, Provider, Session } from "@slopcode-ai/sdk/v2"
import { Effect } from "effect"
import { onMount } from "solid-js"
import { mkdir } from "node:fs/promises"
import path from "node:path"
import { Global } from "@slopcode-ai/core/global"
import { createTuiResolvedConfig } from "./fixture/tui-runtime"
import { createEventSource, createFetch, json } from "./fixture/tui-sdk"
import { tmpdir } from "./fixture/fixture"
import { useHomeSessionDestination } from "../src/routes/home/session-destination"
import type { HostSlots } from "../src/plugin/slots"

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

const workspaceID = "wrk_01J00000000000000000000000"

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
  setup?: (api: TuiPluginApi, slots: HostSlots) => void
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
          input.setup?.(value.api, slots)
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

function SelectNewDestination() {
  const destination = useHomeSessionDestination()
  onMount(() => destination?.setDestination({ type: "new" }))
  return null
}

function fixture(input: {
  root: string
  events: ReturnType<typeof createEventSource>
  sessions?: Session[]
  workspace?: boolean
  commands?: string[]
  create: (request: RequestTrace, count: number) => Promise<Response> | Response
  admit: (request: RequestTrace, sessionID: string, count: number) => Promise<Response> | Response
  handle?: (request: RequestTrace) => Promise<Response | undefined> | Response | undefined
}) {
  const requests: RequestTrace[] = []
  const controls: ControlTrace = { response: [], event: [] }
  const sessions = new Map((input.sessions ?? []).map((item) => [item.id, item]))
  const global = provider("global", "global-model")
  const workspace = provider("workspace", "workspace-model")
  let creates = 0
  let admits = 0

  function response(request: string, data: unknown, status = 200) {
    controls.response.push({ request, status, body: data })
    return json(data, { status })
  }

  function accepted(request: string) {
    controls.response.push({ request, status: 204, body: undefined })
    return new Response(null, { status: 204 })
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
    const handled = await input.handle?.(request)
    if (handled) return handled

    if (url.pathname === "/path")
      return json({
        home: input.root,
        state: path.join(input.root, "state"),
        config: path.join(input.root, "config"),
        worktree: input.root,
        directory: currentWorkspace
          ? path.join(input.root, "workspace")
          : (url.searchParams.get("directory") ?? input.root),
      })
    if (url.pathname === "/project/current") return json({ id: "proj_test", worktree: input.root })
    if (url.pathname === "/project/proj_test/directories") return json([{ directory: input.root, strategy: undefined }])
    if (url.pathname === "/config/providers") {
      const selected = currentWorkspace === workspaceID ? workspace : global
      return json({ providers: [selected], default: { [selected.id]: Object.keys(selected.models)[0] } })
    }
    if (url.pathname === "/provider") {
      const selected = currentWorkspace === workspaceID ? workspace : global
      return json({ all: [selected], default: { [selected.id]: Object.keys(selected.models)[0] }, connected: [] })
    }
    if (url.pathname === "/agent") return json([agent])
    if (url.pathname === "/command")
      return json(
        (input.commands ?? []).map((name) => ({ name, description: name, template: "", hints: [], source: "command" })),
      )
    if (url.pathname === "/config") return json({})
    if (url.pathname === "/experimental/workspace")
      return json(
        input.workspace
          ? [
              {
                id: workspaceID,
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
      return json(input.workspace ? [{ workspaceID, status: "connected" }] : [])
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
    const promptPath = url.pathname.match(/^\/session\/([^/]+)\/prompt_async$/)
    if (promptPath && raw.method === "POST") {
      admits++
      return input.admit(request, promptPath[1], admits)
    }
    if (/^\/session\/[^/]+\/(todo|diff)$/.test(url.pathname)) return json([])
    return undefined
  })

  return { requests, controls, sessions, response, accepted, emit, fetch: calls.fetch }
}

function focused(app: Setup) {
  return app.renderer.currentFocusedEditor instanceof TextareaRenderable ? app.renderer.currentFocusedEditor : undefined
}

function routed(api: TuiPluginApi, sessionID: string) {
  const route = api.route.current
  return route.name === "session" && route.params?.sessionID === sessionID
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
      workspaceID,
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
          workspaceID,
          model: workspaceModel,
        })
        harness.sessions.set(created.id, created)
        queueMicrotask(() => harness.emit(created))
        return harness.response(`${request.method} ${request.path}`, created)
      },
      admit(request) {
        const payload = record(request.body)
        const selected = record(payload?.model)
        const accepted =
          request.query.workspace === workspaceID &&
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
        return harness.accepted(`${request.method} ${request.path}`)
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
          harness.requests.some((item) => item.path === "/config/providers" && item.query.workspace === workspaceID) &&
          focused(app.setup) !== undefined,
      )
      app.api.keymap.dispatchCommand("session.new")
      await wait(() => app.api.route.current.name === "home" && focused(app.setup)?.plainText === "")
      await app.setup.mockInput.typeText("workspace first prompt")
      app.setup.mockInput.pressEnter()
      await wait(() => harness.requests.some((item) => item.path === "/session/ses_workspace_new/prompt_async"))

      const create = harness.requests.find((item) => item.path === "/session" && item.method === "POST")
      const prompt = harness.requests.find((item) => item.path === "/session/ses_workspace_new/prompt_async")
      expect(create).toMatchObject({
        query: { directory: path.join(tmp.path, "workspace"), workspace: workspaceID },
        body: {
          agent: "build",
          model: { providerID: "workspace", id: "workspace-model" },
        },
      })
      expect(prompt).toMatchObject({
        query: { directory: path.join(tmp.path, "workspace"), workspace: workspaceID },
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
      expect(harness.controls.response.at(-1)?.status).toBe(204)
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
      admit(request) {
        return harness.accepted(`${request.method} ${request.path}`)
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
      await wait(() => harness.requests.some((item) => item.path === "/session/ses_old/prompt_async"))
      await Bun.sleep(80)

      expect(
        harness.requests
          .filter((item) => item.method === "POST" && item.path.endsWith("/prompt_async"))
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
      admit(request) {
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
      await wait(() => harness.controls.response.some((item) => item.request.includes("/prompt_async")))
      await Bun.sleep(80)

      expect(app.api.route.current).toEqual({ name: "home" })
      expect(focused(app.setup)?.plainText).toBe("keep this exact prompt")
      expect(harness.controls.response.at(-1)).toMatchObject({ status: 400 })
    } finally {
      await app.close()
    }
  })

  test("an existing session releases admission ownership without clearing later edits", async () => {
    await using tmp = await tmpdir()
    await Promise.all(
      ["data", "cache", "config", "state", "tmp", "bin", "log", "repos"].map((dir) =>
        mkdir(path.join(tmp.path, dir), { recursive: true }),
      ),
    )
    const events = createEventSource()
    const existing = session({ id: "ses_rapid", directory: tmp.path })
    let release!: () => void
    const delayed = new Promise<Response>((resolve) => (release = () => resolve(new Response(null, { status: 204 }))))
    let harness!: ReturnType<typeof fixture>
    harness = fixture({
      root: tmp.path,
      events,
      sessions: [existing],
      create: () => json(session({ id: "ses_unused", directory: tmp.path })),
      admit(request, _, count) {
        if (count === 1) return delayed
        return harness.accepted(`${request.method} ${request.path} #${count}`)
      },
    })
    const app = await mount({
      root: tmp.path,
      args: { sessionID: existing.id },
      fetch: harness.fetch,
      events: events.source,
    })

    try {
      await wait(() => focused(app.setup) !== undefined)
      await app.setup.mockInput.typeText("first prompt")
      app.setup.mockInput.pressEnter()
      await wait(() => harness.requests.some((item) => item.path === "/session/ses_rapid/prompt_async"))
      focused(app.setup)!.setText("second prompt")
      await wait(() => focused(app.setup)?.plainText === "second prompt")
      release()
      await wait(() => focused(app.setup)?.plainText === "second prompt")

      app.setup.mockInput.pressEnter()
      await wait(() => harness.requests.filter((item) => item.path === "/session/ses_rapid/prompt_async").length === 2)
      await wait(() => focused(app.setup)?.plainText === "")
      expect(
        harness.requests
          .filter((item) => item.path === "/session/ses_rapid/prompt_async")
          .map((item) => promptText(item.body)),
      ).toEqual(["first prompt", "second prompt"])
    } finally {
      release()
      await app.close()
    }
  })

  test("Home and session owners retain independent prompt drafts", async () => {
    await using tmp = await tmpdir()
    await Promise.all(
      ["data", "cache", "config", "state", "tmp", "bin", "log", "repos"].map((dir) =>
        mkdir(path.join(tmp.path, dir), { recursive: true }),
      ),
    )
    const events = createEventSource()
    const first = session({ id: "ses_owner_a", directory: tmp.path })
    const second = session({ id: "ses_owner_b", directory: tmp.path })
    let harness!: ReturnType<typeof fixture>
    harness = fixture({
      root: tmp.path,
      events,
      sessions: [first, second],
      create: () => json(session({ id: "ses_unused", directory: tmp.path })),
      admit(request) {
        return harness.accepted(`${request.method} ${request.path}`)
      },
    })
    const app = await mount({
      root: tmp.path,
      args: { sessionID: first.id },
      fetch: harness.fetch,
      events: events.source,
    })

    try {
      await wait(() => routed(app.api, first.id) && focused(app.setup) !== undefined)
      await app.setup.mockInput.typeText("session A draft")
      app.api.route.navigate("session", { sessionID: second.id })
      await wait(() => routed(app.api, second.id) && focused(app.setup)?.plainText === "")
      await app.setup.mockInput.typeText("session B draft")
      app.api.keymap.dispatchCommand("session.new")
      await wait(() => app.api.route.current.name === "home" && focused(app.setup)?.plainText === "")
      await app.setup.mockInput.typeText("Home draft")

      app.api.route.navigate("session", { sessionID: first.id })
      await wait(() => focused(app.setup)?.plainText === "session A draft")
      app.api.route.navigate("session", { sessionID: second.id })
      await wait(() => focused(app.setup)?.plainText === "session B draft")
      app.api.route.navigate("home")
      await wait(() => focused(app.setup)?.plainText === "Home draft")
    } finally {
      await app.close()
    }
  })

  test("a provisional session is reused after first-prompt admission fails", async () => {
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
        const created = session({ id: "ses_provisional", directory: tmp.path })
        harness.sessions.set(created.id, created)
        return harness.response(`${request.method} ${request.path}`, created)
      },
      admit(request, _, count) {
        if (count === 1)
          return harness.response(
            `${request.method} ${request.path} #1`,
            { name: "BadRequest", data: { message: "reject once" } },
            400,
          )
        return harness.accepted(`${request.method} ${request.path} #2`)
      },
    })
    const app = await mount({ root: tmp.path, fetch: harness.fetch, events: events.source })

    try {
      await wait(() => focused(app.setup) !== undefined)
      await app.setup.mockInput.typeText("retry exact provisional prompt")
      app.setup.mockInput.pressEnter()
      await wait(() => harness.controls.response.some((item) => item.status === 400))
      expect(focused(app.setup)?.plainText).toBe("retry exact provisional prompt")

      app.setup.mockInput.pressEnter()
      await wait(() => routed(app.api, "ses_provisional"))
      expect(harness.requests.filter((item) => item.path === "/session" && item.method === "POST")).toHaveLength(1)
      expect(harness.requests.filter((item) => item.path === "/session/ses_provisional/prompt_async")).toHaveLength(2)
    } finally {
      await app.close()
    }
  })

  test("a thrown create releases project-copy progress and retries its prepared directory", async () => {
    await using tmp = await tmpdir()
    const copy = path.join(tmp.path, "copy")
    await Promise.all(
      ["data", "cache", "config", "state", "tmp", "bin", "log", "repos", "copy"].map((dir) =>
        mkdir(path.join(tmp.path, dir), { recursive: true }),
      ),
    )
    const events = createEventSource()
    let harness!: ReturnType<typeof fixture>
    harness = fixture({
      root: tmp.path,
      events,
      create(request, count) {
        if (count === 1) throw new Error("create transport failed")
        const created = session({ id: "ses_copy_retry", directory: copy })
        harness.sessions.set(created.id, created)
        return harness.response(`${request.method} ${request.path} #2`, created)
      },
      admit(request) {
        return harness.accepted(`${request.method} ${request.path}`)
      },
      handle(request) {
        if (request.path.endsWith("/copy/generate-name")) return json({ name: "copy" })
        if (request.path.endsWith("/copy") && request.method === "POST") return json({ directory: copy })
        return undefined
      },
    })
    const app = await mount({
      root: tmp.path,
      fetch: harness.fetch,
      events: events.source,
      setup(_, slots) {
        slots.register({
          id: "test.destination",
          order: -1,
          slots: { home_bottom: () => <SelectNewDestination /> },
        })
      },
    })

    try {
      await wait(() => focused(app.setup) !== undefined)
      await app.setup.mockInput.typeText("retry after thrown create")
      app.setup.mockInput.pressEnter()
      await wait(
        () => harness.requests.filter((item) => item.path === "/session" && item.method === "POST").length === 1,
      )
      await wait(() => focused(app.setup)?.plainText === "retry after thrown create")

      app.setup.mockInput.pressEnter()
      await wait(() => routed(app.api, "ses_copy_retry"))
      expect(
        harness.requests.filter((item) => item.path.endsWith("/copy/generate-name") && item.method === "POST"),
      ).toHaveLength(1)
      expect(harness.requests.filter((item) => item.path.endsWith("/copy") && item.method === "POST")).toHaveLength(1)
      expect(
        harness.requests
          .filter((item) => item.path === "/session" && item.method === "POST")
          .map((item) => item.query.directory),
      ).toEqual([copy, copy])
    } finally {
      await app.close()
    }
  })

  test("detached shell and command failures preserve their exact drafts without blocking prompts", async () => {
    await using tmp = await tmpdir()
    await Promise.all(
      ["data", "cache", "config", "state", "tmp", "bin", "log", "repos"].map((dir) =>
        mkdir(path.join(tmp.path, dir), { recursive: true }),
      ),
    )
    const events = createEventSource()
    const existing = session({ id: "ses_detached", directory: tmp.path })
    let release!: () => void
    const shell = new Promise<Response>(
      (resolve) =>
        (release = () =>
          resolve(
            json({ name: "SessionBusyError", data: { message: "busy", sessionID: existing.id } }, { status: 409 }),
          )),
    )
    let harness!: ReturnType<typeof fixture>
    harness = fixture({
      root: tmp.path,
      events,
      sessions: [existing],
      commands: ["review"],
      create: () => json(session({ id: "ses_unused", directory: tmp.path })),
      admit(request) {
        return harness.accepted(`${request.method} ${request.path}`)
      },
      handle(request) {
        if (request.path === "/session/ses_detached/shell") return shell
        if (request.path === "/session/ses_detached/command")
          return harness.response(
            `${request.method} ${request.path}`,
            { name: "BadRequest", data: { message: "command failed" } },
            400,
          )
        return undefined
      },
    })
    const app = await mount({
      root: tmp.path,
      args: { sessionID: existing.id },
      fetch: harness.fetch,
      events: events.source,
    })

    try {
      await wait(() => focused(app.setup) !== undefined)
      app.setup.mockInput.pressKey("!")
      await app.setup.mockInput.typeText("printf exact-shell")
      app.setup.mockInput.pressEnter()
      await wait(() => harness.requests.some((item) => item.path === "/session/ses_detached/shell"))
      await wait(() => focused(app.setup)?.plainText === "")
      await app.setup.mockInput.typeText("queued while shell runs")
      app.setup.mockInput.pressEnter()
      await wait(() => harness.requests.some((item) => item.path === "/session/ses_detached/prompt_async"))
      release()
      await wait(() => focused(app.setup)?.plainText === "printf exact-shell")

      app.api.keymap.dispatchCommand("prompt.clear")
      await wait(() => focused(app.setup)?.plainText === "")
      await app.setup.mockInput.typeText("/review exact-command")
      app.setup.mockInput.pressEscape()
      app.api.keymap.dispatchCommand("prompt.submit")
      await wait(() => harness.requests.some((item) => item.path === "/session/ses_detached/command"))
      await wait(() => focused(app.setup)?.plainText === "/review exact-command")
      expect(harness.requests.find((item) => item.path === "/session/ses_detached/shell")).toMatchObject({
        query: { directory: tmp.path },
        body: { command: "printf exact-shell" },
      })
      expect(harness.requests.find((item) => item.path === "/session/ses_detached/command")).toMatchObject({
        query: { directory: tmp.path },
        body: { command: "review", arguments: "exact-command" },
      })
    } finally {
      release()
      await app.close()
    }
  })

  test("prompt admission snapshots expanded extmarks and attachments before later edits", async () => {
    await using tmp = await tmpdir()
    await Promise.all(
      ["data", "cache", "config", "state", "tmp", "bin", "log", "repos"].map((dir) =>
        mkdir(path.join(tmp.path, dir), { recursive: true }),
      ),
    )
    const image = path.join(tmp.path, "pixel.png")
    await Bun.write(
      image,
      Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
        "base64",
      ),
    )
    const events = createEventSource()
    const existing = session({ id: "ses_parts", directory: tmp.path })
    let release!: () => void
    const delayed = new Promise<Response>((resolve) => (release = () => resolve(new Response(null, { status: 204 }))))
    let harness!: ReturnType<typeof fixture>
    harness = fixture({
      root: tmp.path,
      events,
      sessions: [existing],
      create: () => json(session({ id: "ses_unused", directory: tmp.path })),
      admit: () => delayed,
    })
    const app = await mount({
      root: tmp.path,
      args: { sessionID: existing.id },
      fetch: harness.fetch,
      events: events.source,
    })
    const pasted = "alpha\nbeta\ngamma"

    try {
      await wait(() => focused(app.setup) !== undefined)
      await app.setup.mockInput.pasteBracketedText(pasted)
      await wait(() => focused(app.setup)?.plainText.includes("[Pasted ~3 lines]") === true)
      await app.setup.mockInput.pasteBracketedText(image)
      await wait(() => focused(app.setup)?.plainText.includes("[Image 1]") === true)
      app.setup.mockInput.pressEnter()
      await wait(() => harness.requests.some((item) => item.path === "/session/ses_parts/prompt_async"))
      focused(app.setup)!.setText("edited after request")
      await wait(() => focused(app.setup)?.plainText === "edited after request")
      release()
      await wait(() => focused(app.setup)?.plainText === "edited after request")

      const payload = record(harness.requests.find((item) => item.path === "/session/ses_parts/prompt_async")?.body)
      const parts = Array.isArray(payload?.parts) ? payload.parts.map(record) : []
      expect(parts[0]?.text).toContain(pasted)
      expect(parts.find((item) => item?.type === "file")).toMatchObject({
        mime: "image/png",
        filename: "pixel.png",
      })
    } finally {
      release()
      await app.close()
    }
  })
})
