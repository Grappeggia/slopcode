import { describe, expect, test } from "bun:test"
import { focusDebugEnabled, setForceFocus } from "./debug"

function contents(attached = false) {
  const commands: Array<[string, unknown]> = []
  let detach = () => undefined
  const api = {
    attached,
    commands,
    debugger: {
      isAttached: () => api.attached,
      attach: () => {
        api.attached = true
      },
      detach: () => {
        api.attached = false
        detach()
      },
      once: (event: string, listener: () => void) => {
        if (event === "detach") detach = listener
      },
      sendCommand: async (command: string, params?: unknown) => {
        commands.push([command, params])
        if (command === "DOM.getDocument") return { root: { nodeId: 4 } }
        if (command === "DOM.querySelectorAll") return { nodeIds: [8, 9] }
        return {}
      },
    },
  }
  return api
}

describe("focus debug", () => {
  test("is opt-in and never enabled for packaged builds", () => {
    expect(focusDebugEnabled(false, undefined)).toBe(false)
    expect(focusDebugEnabled(false, "0")).toBe(false)
    expect(focusDebugEnabled(false, "1")).toBe(true)
    expect(focusDebugEnabled(false, "true")).toBe(true)
    expect(focusDebugEnabled(true, "1")).toBe(false)
  })

  test("rejects use when disabled without attaching a debugger", async () => {
    const api = contents()
    expect(setForceFocus(api as never, true, false)).rejects.toThrow("Focus debug is disabled")
    expect(api.attached).toBe(false)
    expect(api.commands).toEqual([])
  })

  test("uses only the constrained DOM and CSS commands and cleans up", async () => {
    const api = contents()
    await setForceFocus(api as never, true, true)

    expect(api.attached).toBe(true)
    expect(api.commands.map(([command]) => command)).toEqual([
      "DOM.enable",
      "CSS.enable",
      "DOM.getDocument",
      "DOM.querySelectorAll",
      "CSS.forcePseudoState",
      "CSS.forcePseudoState",
    ])

    await setForceFocus(api as never, false, true)
    expect(api.attached).toBe(false)
    expect(api.commands.slice(-2)).toEqual([
      ["CSS.forcePseudoState", { nodeId: 8, forcedPseudoClasses: [] }],
      ["CSS.forcePseudoState", { nodeId: 9, forcedPseudoClasses: [] }],
    ])
  })

  test("does not take ownership of an existing debugger attachment", async () => {
    const api = contents(true)
    expect(setForceFocus(api as never, true, true)).rejects.toThrow("already attached")
    expect(api.commands).toEqual([])
  })
})
