import { describe, expect, test } from "bun:test"
import { createWindowRegistry } from "./window-registry"

function setup(initial: unknown = []) {
  const state = { stored: initial }
  const cleaned: string[] = []
  const registry = createWindowRegistry<{ name: string }>({
    read: () => state.stored,
    write: (ids) => {
      state.stored = ids
    },
    cleanup: (id) => cleaned.push(id),
  })
  return { registry, state, cleaned }
}

describe("window registry", () => {
  test("restores valid ids and persists each registration once", () => {
    const app = setup(["a", "a", "", 42, "../escape"])
    expect(app.registry.persisted()).toEqual(["a"])
    expect(app.state.stored).toEqual(["a"])
    app.registry.register("a", { name: "a" })
    app.registry.register("b", { name: "b" })
    expect(app.state.stored).toEqual(["a", "b"])
  })

  test("rejects unsafe ids at registration", () => {
    const app = setup()
    expect(() => app.registry.register("../escape", { name: "escape" })).toThrow("Invalid window id")
  })

  test("forgets a deliberately closed window while another remains", () => {
    const app = setup()
    app.registry.register("a", { name: "a" })
    app.registry.register("b", { name: "b" })
    app.registry.closed("a")
    expect(app.state.stored).toEqual(["b"])
    expect(app.cleaned).toEqual(["a"])
  })

  test("keeps last-window and quitting ids for restore", () => {
    const app = setup()
    app.registry.register("a", { name: "a" })
    app.registry.closed("a")
    expect(app.state.stored).toEqual(["a"])
    expect(app.cleaned).toEqual([])

    app.registry.register("b", { name: "b" })
    app.registry.setQuitting()
    app.registry.closed("b")
    expect(app.state.stored).toEqual(["a", "b"])
  })

  test("tracks the last focused live window", () => {
    const app = setup()
    app.registry.register("a", { name: "a" })
    app.registry.register("b", { name: "b" })
    app.registry.focused("a")
    expect(app.registry.lastFocused()).toEqual({ name: "a" })
    app.registry.closed("a")
    expect(app.registry.lastFocused()).toEqual({ name: "b" })
  })
})
