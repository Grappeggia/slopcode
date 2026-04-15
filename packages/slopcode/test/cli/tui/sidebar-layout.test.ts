import { describe, expect, test } from "bun:test"
import {
  SESSION_SIDEBAR_RAIL_WIDTH,
  SESSION_SIDEBAR_WIDTH,
  sessionSidebarExpanded,
  sessionSidebarHeaderVisible,
  sessionSidebarWidth,
} from "../../../src/cli/cmd/tui/routes/session/sidebar-layout"

describe("session sidebar layout", () => {
  test("uses no width when the sidebar is hidden", () => {
    expect(sessionSidebarWidth({ visible: false, wide: true, collapsed: false })).toBe(0)
  })

  test("uses a rail width when the wide sidebar is collapsed", () => {
    expect(sessionSidebarWidth({ visible: true, wide: true, collapsed: true })).toBe(SESSION_SIDEBAR_RAIL_WIDTH)
  })

  test("keeps the full width for visible narrow overlays", () => {
    expect(sessionSidebarWidth({ visible: true, wide: false, collapsed: true })).toBe(SESSION_SIDEBAR_WIDTH)
  })

  test("only treats wide non-collapsed sidebars as expanded", () => {
    expect(sessionSidebarExpanded({ visible: true, wide: true, collapsed: false })).toBe(true)
    expect(sessionSidebarExpanded({ visible: true, wide: true, collapsed: true })).toBe(false)
    expect(sessionSidebarExpanded({ visible: true, wide: false, collapsed: true })).toBe(true)
    expect(sessionSidebarExpanded({ visible: false, wide: true, collapsed: false })).toBe(false)
  })

  test("shows the header whenever the sidebar is not fully expanded", () => {
    expect(sessionSidebarHeaderVisible({ visible: false, wide: true, collapsed: false })).toBe(true)
    expect(sessionSidebarHeaderVisible({ visible: true, wide: true, collapsed: true })).toBe(true)
    expect(sessionSidebarHeaderVisible({ visible: true, wide: true, collapsed: false })).toBe(false)
    expect(sessionSidebarHeaderVisible({ visible: true, wide: false, collapsed: false })).toBe(false)
  })
})
