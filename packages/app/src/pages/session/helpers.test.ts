import { describe, expect, test } from "bun:test"
import {
  adjacentTab,
  createOpenReviewFile,
  createOpenSessionFileTab,
  focusTerminalById,
  getTabReorderIndex,
  visibleTabs,
} from "./helpers"

describe("createOpenReviewFile", () => {
  test("opens and loads selected review file", () => {
    const calls: string[] = []
    const openReviewFile = createOpenReviewFile({
      showAllFiles: () => calls.push("show"),
      tabForPath: (path) => {
        calls.push(`tab:${path}`)
        return `file://${path}`
      },
      openTab: (tab) => calls.push(`open:${tab}`),
      loadFile: (path) => calls.push(`load:${path}`),
    })

    openReviewFile("src/a.ts")

    expect(calls).toEqual(["show", "load:src/a.ts", "tab:src/a.ts", "open:file://src/a.ts"])
  })
})

describe("createOpenSessionFileTab", () => {
  test("activates the opened file tab", () => {
    const calls: string[] = []
    const openTab = createOpenSessionFileTab({
      normalizeTab: (value) => {
        calls.push(`normalize:${value}`)
        return `file://${value}`
      },
      openTab: (tab) => calls.push(`open:${tab}`),
      pathFromTab: (tab) => {
        calls.push(`path:${tab}`)
        return tab.slice("file://".length)
      },
      loadFile: (path) => calls.push(`load:${path}`),
      openReviewPanel: () => calls.push("review"),
      setActive: (tab) => calls.push(`active:${tab}`),
    })

    openTab("src/a.ts")

    expect(calls).toEqual([
      "normalize:src/a.ts",
      "open:file://src/a.ts",
      "path:file://src/a.ts",
      "load:src/a.ts",
      "review",
      "active:file://src/a.ts",
    ])
  })
})

describe("focusTerminalById", () => {
  test("focuses textarea when present", () => {
    document.body.innerHTML = `<div id="terminal-wrapper-one"><div data-component="terminal"><textarea></textarea></div></div>`

    const focused = focusTerminalById("one")

    expect(focused).toBe(true)
    expect(document.activeElement?.tagName).toBe("TEXTAREA")
  })

  test("falls back to terminal element focus", () => {
    document.body.innerHTML = `<div id="terminal-wrapper-two"><div data-component="terminal" tabindex="0"></div></div>`
    const terminal = document.querySelector('[data-component="terminal"]') as HTMLElement
    let pointerDown = false
    terminal.addEventListener("pointerdown", () => {
      pointerDown = true
    })

    const focused = focusTerminalById("two")

    expect(focused).toBe(true)
    expect(document.activeElement).toBe(terminal)
    expect(pointerDown).toBe(true)
  })
})

describe("getTabReorderIndex", () => {
  test("returns target index for valid drag reorder", () => {
    expect(getTabReorderIndex(["a", "b", "c"], "a", "c")).toBe(2)
  })

  test("returns undefined for unknown droppable id", () => {
    expect(getTabReorderIndex(["a", "b", "c"], "a", "missing")).toBeUndefined()
  })
})

describe("visibleTabs", () => {
  test("includes review first when reviewTab is true", () => {
    expect(visibleTabs({ reviewTab: true, contextOpen: false, openedTabs: ["a"] })).toEqual(["review", "a"])
  })

  test("includes context after review when both open", () => {
    expect(visibleTabs({ reviewTab: true, contextOpen: true, openedTabs: ["a"] })).toEqual(["review", "context", "a"])
  })

  test("omits review when reviewTab is false", () => {
    expect(visibleTabs({ reviewTab: false, contextOpen: true, openedTabs: ["a"] })).toEqual(["context", "a"])
  })

  test("returns only file tabs when review and context are closed", () => {
    expect(visibleTabs({ reviewTab: false, contextOpen: false, openedTabs: ["a", "b"] })).toEqual(["a", "b"])
  })
})

describe("adjacentTab", () => {
  test("returns next tab", () => {
    expect(adjacentTab(["review", "a", "b"], "review", 1)).toBe("a")
  })

  test("returns previous tab", () => {
    expect(adjacentTab(["review", "a", "b"], "a", -1)).toBe("review")
  })

  test("wraps from last to first", () => {
    expect(adjacentTab(["a", "b", "c"], "c", 1)).toBe("a")
  })

  test("wraps from first to last", () => {
    expect(adjacentTab(["a", "b", "c"], "a", -1)).toBe("c")
  })

  test("returns first tab when active is not in list", () => {
    expect(adjacentTab(["a", "b"], "unknown", 1)).toBe("a")
  })

  test("returns undefined for empty list", () => {
    expect(adjacentTab([], "a", 1)).toBeUndefined()
  })
})
