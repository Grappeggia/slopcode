/** @jsxImportSource @opentui/solid */
import { testRender } from "@opentui/solid"
import { createStore } from "solid-js/store"
import { expect, test } from "bun:test"
import { ProjectProvider } from "../src/context/project"
import { RouteProvider, useRoute } from "../src/context/route"
import { SDKProvider } from "../src/context/sdk"
import { SessionTabsProvider, useSessionTabs } from "../src/context/session-tabs"
import { SyncContext, type useSync } from "../src/context/sync"
import { TestTuiContexts } from "./fixture/tui-environment"
import { createFetch, eventSource } from "./fixture/tui-sdk"
import { createTuiResolvedConfig } from "./fixture/tui-runtime"

test("draft promotion, root visits, workspace refresh, and local close compose through providers", async () => {
  let tabs!: ReturnType<typeof useSessionTabs>
  let route!: ReturnType<typeof useRoute>
  let sessions!: (value: { id: string; title: string; parentID?: string; workspaceID?: string }[]) => void

  function Harness() {
    const [data, setData] = createStore<{
      session: { id: string; title: string; parentID?: string; workspaceID?: string }[]
      session_status: Record<string, never>
      permission: Record<string, never>
      question: Record<string, never>
      message: Record<string, never>
    }>({
      session: [
        { id: "ses_1", title: "One" },
        { id: "ses_2", title: "Two", workspaceID: "work_2" },
        { id: "ses_child", title: "Child", parentID: "ses_2", workspaceID: "work_2" },
      ],
      session_status: {},
      permission: {},
      question: {},
      message: {},
    })
    sessions = (value) => setData("session", value)
    const sync = {
      data,
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
      <SDKProvider url="http://test" events={eventSource()} fetch={createFetch().fetch}>
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

    tabs.promoteDraft({ id: "ses_1", title: "New Session" })
    route.navigate({ type: "session", sessionID: "ses_1" })
    await app.renderOnce()
    route.navigate({ type: "session", sessionID: "ses_child" })
    await app.renderOnce()
    expect(tabs.ids()).toEqual(["ses_1", "ses_2"])
    expect(tabs.active()).toBe("ses_2")

    sessions([{ id: "ses_2", title: "Two renamed", workspaceID: "work_2" }])
    await app.renderOnce()
    expect(tabs.tabs().map((tab) => tab.title)).toEqual(["One", "Two renamed"])

    tabs.close("ses_2")
    await app.renderOnce()
    expect(route.data).toEqual({ type: "session", sessionID: "ses_1" })
    tabs.close("ses_1")
    await app.renderOnce()
    expect(route.data).toEqual({ type: "home" })
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
