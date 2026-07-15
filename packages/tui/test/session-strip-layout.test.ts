import { describe, expect, test } from "bun:test"
import { layoutSessionStrip, sessionStripTabLabel } from "../src/component/session-strip-layout"

const tabs = Array.from({ length: 7 }, (_, index) => ({
  id: `ses_${index + 1}`,
  title: `Session ${index + 1}`,
  status: "idle" as const,
}))

describe("session strip layout", () => {
  test("shows all tabs when they fit", () => {
    const result = layoutSessionStrip(tabs.slice(0, 3), { active: "ses_2", width: 80 })

    expect(result.tabs.map((tab) => tab.id)).toEqual(["ses_1", "ses_2", "ses_3"])
    expect(result.hidden).toBe(0)
    expect(result.used).toBeLessThanOrEqual(80)
  })

  test("keeps the active tab centered in overflow and exposes hidden neighbors", () => {
    const result = layoutSessionStrip(tabs, { active: "ses_4", width: 32 })

    expect(result.tabs.some((tab) => tab.id === "ses_4")).toBe(true)
    expect(Math.abs(result.before - result.after)).toBeLessThanOrEqual(1)
    expect(result.hidden).toBeGreaterThan(0)
    expect(result.prev).toBeDefined()
    expect(result.next).toBeDefined()
    expect(result.used).toBeLessThanOrEqual(32)
  })

  test("truncates wide Unicode titles by terminal width", () => {
    const result = layoutSessionStrip([{ id: "ses_1", title: "你好世界你好世界你好世界", status: "working" }], {
      active: "ses_1",
      width: 18,
    })

    expect(result.tabs).toHaveLength(1)
    expect(result.tabs[0].title.endsWith("…")).toBe(true)
    expect(Bun.stringWidth(result.tabs[0].title)).toBeLessThan(Bun.stringWidth("你好世界你好世界你好世界"))
    expect(result.used).toBeLessThanOrEqual(18)
  })

  test("includes visible state and active markers in labels", () => {
    expect(sessionStripTabLabel({ id: "ses_1", title: "One", status: "retrying" }, true)).toBe("↻ * One")
    expect(sessionStripTabLabel({ id: "ses_1", title: "One", status: "disconnected" }, false)).toBe("! One")
  })
})
