/** @jsxImportSource @opentui/solid */
import { testRender } from "@opentui/solid"
import { createStore, reconcile } from "solid-js/store"
import { expect, test } from "bun:test"
import { ProjectProvider } from "../src/context/project"
import { RouteProvider, useRoute } from "../src/context/route"
import { SDKProvider } from "../src/context/sdk"
import { SessionTabsProvider, useSessionTabs } from "../src/context/session-tabs"
import { SyncContext, type useSync } from "../src/context/sync"
import { TestTuiContexts } from "./fixture/tui-environment"
import { createEventSource, createFetch, directory } from "./fixture/tui-sdk"
import { createTuiResolvedConfig } from "./fixture/tui-runtime"

test("draft promotion, root visits, workspace refresh, and local close compose through providers", async () => {
  let tabs!: ReturnType<typeof useSessionTabs>
  let route!: ReturnType<typeof useRoute>
  let sessions!: (value: { id: string; title: string; parentID?: string; workspaceID?: string }[]) => void
  let statuses!: (value: Record<string, { type: "idle" | "busy" | "retry" }>) => void
  let permissions!: (value: Record<string, unknown[]>) => void
  let questions!: (value: Record<string, unknown[]>) => void
  let complete!: () => void
  const events = createEventSource()

  function Harness() {
    const [data, setData] = createStore<{
      session: { id: string; title: string; parentID?: string; workspaceID?: string }[]
      status: "partial" | "complete"
      session_status: Record<string, { type: "idle" | "busy" | "retry" }>
      permission: Record<string, unknown[]>
      question: Record<string, unknown[]>
      message: Record<string, never>
    }>({
      session: [
        { id: "ses_1", title: "One", workspaceID: "work_1" },
        { id: "ses_2", title: "Two", workspaceID: "work_2" },
        { id: "ses_child", title: "Child", parentID: "ses_2", workspaceID: "work_2" },
        { id: "ses_3", title: "Three", workspaceID: "work_3" },
      ],
      status: "partial",
      session_status: { ses_1: { type: "busy" } },
      permission: {},
      question: {},
      message: {},
    })
    sessions = (value) => setData("session", value)
    statuses = (value) => setData("session_status", reconcile(value))
    permissions = (value) => setData("permission", value)
    questions = (value) => setData("question", value)
    complete = () => setData("status", "complete")
    const sync = {
      data,
      get status() {
        return data.status
      },
      session: {
        get(id: string) {
          return data.session.find((item) => item.id === id)
        },
        status() {
          return "idle" as const
        },
      },
    } as unknown as ReturnType<typeof useSync>

    return (
      <SyncContext.Provider value={sync}>
        <SessionTabsProvider>
          <Probe />
        </SessionTabsProvider>
      </SyncContext.Provider>
    )
  }

  function Probe() {
    tabs = useSessionTabs()
    route = useRoute()
    return (
      <text>{`${route.data.type}:${tabs
        .tabs()
        .map((tab) => tab.title)
        .join("|")}`}</text>
    )
  }

  const app = await testRender(() => (
    <TestTuiContexts>
      <SDKProvider url="http://test" events={events.source} fetch={createFetch().fetch}>
        <ProjectProvider>
          <RouteProvider>
            <Harness />
          </RouteProvider>
        </ProjectProvider>
      </SDKProvider>
    </TestTuiContexts>
  ))

  try {
    tabs.openDraft()
    await app.renderOnce()
    expect(tabs.tabs().map((tab) => tab.title)).toEqual(["New Session"])

    const draft = tabs.owner()
    const submission = tabs.submission.id(draft, "first prompt")
    tabs.promoteDraft({ id: "ses_1", title: "New Session" })
    expect(tabs.submission.id(tabs.owner("ses_1"), "first prompt")).toBe(submission)
    expect(
      tabs.prompt.save(draft, { prompt: { input: "stale Home", parts: [] }, cursor: 10, mode: "normal" }),
    ).toBeFalse()
    route.navigate({ type: "session", sessionID: "ses_1" })
    await app.renderOnce()
    route.navigate({ type: "session", sessionID: "ses_child" })
    await app.renderOnce()
    expect(tabs.ids()).toEqual(["ses_1", "ses_2"])
    expect(tabs.active()).toBe("ses_2")

    route.navigate({ type: "session", sessionID: "ses_3" })
    await app.renderOnce()
    route.navigate({ type: "session", sessionID: "ses_child" })
    await app.renderOnce()

    sessions([{ id: "ses_2", title: "Two renamed", workspaceID: "work_2" }])
    statuses({ ses_2: { type: "idle" } })
    await app.renderOnce()
    expect(tabs.tabs().map((tab) => [tab.title, tab.status])).toEqual([
      ["One", "working"],
      ["Two renamed", "idle"],
      ["Three", "unknown"],
    ])

    statuses({ ses_1: { type: "retry" }, ses_2: { type: "idle" } })
    await app.renderOnce()
    expect(tabs.tabs().find((tab) => tab.id === "ses_1")?.status).toBe("retrying")

    permissions({ ses_1: [{}] })
    await app.renderOnce()
    expect(tabs.tabs().find((tab) => tab.id === "ses_1")?.status).toBe("waiting")
    permissions({ ses_1: [] })
    await app.renderOnce()
    expect(tabs.tabs().find((tab) => tab.id === "ses_1")?.status).toBe("retrying")

    questions({ ses_1: [{}] })
    await app.renderOnce()
    expect(tabs.tabs().find((tab) => tab.id === "ses_1")?.status).toBe("waiting")
    questions({ ses_1: [] })
    statuses({ ses_2: { type: "idle" } })
    await app.renderOnce()
    expect(tabs.tabs().find((tab) => tab.id === "ses_1")?.status).toBe("retrying")

    sessions([{ id: "ses_1", title: "One local", workspaceID: undefined }])
    statuses({})
    complete()
    await app.renderOnce()
    expect(tabs.tabs().find((tab) => tab.id === "ses_1")).toMatchObject({
      title: "One local",
      status: "idle",
    })

    events.emit({
      directory,
      project: "proj_test",
      payload: {
        id: "evt_workspace_disconnected",
        type: "workspace.status",
        properties: { workspaceID: "work_3", status: "disconnected" },
      },
    })
    await app.renderOnce()
    expect(tabs.tabs().find((tab) => tab.id === "ses_3")?.status).toBe("disconnected")

    tabs.close("ses_3")
    tabs.close("ses_2")
    await app.renderOnce()
    expect(route.data).toEqual({ type: "session", sessionID: "ses_1" })
    tabs.close("ses_1")
    await app.renderOnce()
    expect(route.data).toEqual({ type: "home" })

    const retained = Array.from({ length: 40 }, (_, index) => `ses_retained_${index}`)
    for (const id of retained) {
      route.navigate({ type: "session", sessionID: id })
      await app.renderOnce()
      expect(
        tabs.prompt.save(tabs.owner(id), {
          prompt: { input: id, parts: [] },
          cursor: id.length,
          mode: id === retained[0] ? "shell" : "normal",
        }),
      ).toBeTrue()
    }
    expect(tabs.prompt.take(tabs.owner(retained[0]))).toMatchObject({
      prompt: { input: retained[0] },
      mode: "shell",
    })
    tabs.prompt.save(tabs.owner(retained[0]), {
      prompt: { input: retained[0], parts: [] },
      cursor: retained[0].length,
      mode: "shell",
    })
    tabs.close(retained[0])
    route.navigate({ type: "session", sessionID: retained[0] })
    await app.renderOnce()
    expect(tabs.prompt.take(tabs.owner(retained[0]))).toBeUndefined()
  } finally {
    app.renderer.destroy()
  }
})

test("session tab commands expose configurable bindings", () => {
  const config = createTuiResolvedConfig({
    keybinds: {
      session_tabs_previous: "ctrl+left",
      session_tabs_next: "ctrl+right",
      session_tabs_close: "ctrl+w",
    },
  })

  expect(config.keybinds.get("session.tabs.previous")).toMatchObject([{ key: "ctrl+left" }])
  expect(config.keybinds.get("session.tabs.next")).toMatchObject([{ key: "ctrl+right" }])
  expect(config.keybinds.get("session.tabs.close")).toMatchObject([{ key: "ctrl+w" }])
})
