import { describe, expect, test } from "bun:test"
import type { ServerConnection } from "@/context/server"
import type { SessionTab, Tab } from "@/context/tabs"
import { openHomeSession, shouldOpenSessionInBackground } from "./home-session-open"

const server = "local\nhttp://localhost:4096" as ServerConnection.Key
const session = { id: "ses_home", directory: "/workspace/repo" }

describe("shouldOpenSessionInBackground", () => {
  test("accepts middle-click on every platform", () => {
    expect(
      shouldOpenSessionInBackground({ button: 1, mac: true, meta: false, ctrl: false, shift: false, alt: false }),
    ).toBe(true)
    expect(
      shouldOpenSessionInBackground({ button: 1, mac: false, meta: false, ctrl: false, shift: false, alt: false }),
    ).toBe(true)
    expect(
      shouldOpenSessionInBackground({ button: 2, mac: false, meta: false, ctrl: false, shift: false, alt: false }),
    ).toBe(false)
  })

  test("requires only the platform modifier on an ordinary click", () => {
    expect(
      shouldOpenSessionInBackground({ button: 0, mac: true, meta: true, ctrl: false, shift: false, alt: false }),
    ).toBe(true)
    expect(
      shouldOpenSessionInBackground({ button: 0, mac: false, meta: false, ctrl: true, shift: false, alt: false }),
    ).toBe(true)
    expect(
      shouldOpenSessionInBackground({ button: 0, mac: true, meta: false, ctrl: true, shift: false, alt: false }),
    ).toBe(false)
    expect(
      shouldOpenSessionInBackground({ button: 0, mac: false, meta: true, ctrl: false, shift: false, alt: false }),
    ).toBe(false)
    expect(
      shouldOpenSessionInBackground({ button: 0, mac: true, meta: true, ctrl: false, shift: true, alt: false }),
    ).toBe(false)
    expect(
      shouldOpenSessionInBackground({ button: 0, mac: false, meta: false, ctrl: true, shift: false, alt: true }),
    ).toBe(false)
  })
})

function setup(initial: Tab[] = []) {
  const store = initial.slice()
  const added: SessionTab[] = []
  const selected: Tab[] = []
  const opened: string[] = []
  const touched: string[] = []
  const tabs = {
    store,
    addSessionTab(tab: Omit<SessionTab, "type">) {
      const next = { type: "session" as const, ...tab }
      store.push(next)
      added.push(next)
    },
    select(tab: Tab) {
      selected.push(tab)
    },
  }
  const projects = {
    open: (directory: string) => opened.push(directory),
    touch: (directory: string) => touched.push(directory),
  }
  return { store, added, selected, opened, touched, tabs, projects }
}

describe("openHomeSession", () => {
  test("adds a new session in the background without selecting it", () => {
    const state = setup()

    openHomeSession({ session, server, directory: session.directory, options: { background: true }, ...state })

    expect(state.added).toHaveLength(1)
    expect(state.selected).toEqual([])
    expect(state.opened).toEqual([session.directory])
    expect(state.touched).toEqual([])
  })

  test("selects a new session in the foreground", () => {
    const state = setup()

    openHomeSession({ session, server, directory: session.directory, ...state })

    expect(state.added).toHaveLength(1)
    expect(state.selected).toHaveLength(1)
    expect(state.opened).toEqual([session.directory])
    expect(state.touched).toEqual([session.directory])
  })

  test("does not duplicate or select an existing background tab", () => {
    const first = setup()
    const tab = openHomeSession({ session, server, directory: session.directory, ...first })
    const state = setup([tab])

    openHomeSession({ session, server, directory: session.directory, options: { background: true }, ...state })

    expect(state.store).toEqual([tab])
    expect(state.added).toEqual([])
    expect(state.selected).toEqual([])
  })
})
