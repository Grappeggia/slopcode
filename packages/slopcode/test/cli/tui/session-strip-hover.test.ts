import { describe, expect, test } from "bun:test"
import {
  sessionStripTabClose,
  sessionStripTabLabel,
  SessionStripText,
} from "../../../src/cli/cmd/tui/routes/session/session-strip-layout"
import {
  sessionStripActionNeedsSeparator,
  sessionStripShouldShowHidden,
} from "../../../src/cli/cmd/tui/routes/session/session-strip-action"

describe("session strip hover", () => {
  test("hovering a tab reveals the close X in the rendered row text", () => {
    const tab = { id: "right", title: "HoverTarget" }
    const idle = sessionStripTabLabel(tab, true) + " " + sessionStripTabClose(false) + SessionStripText.SEP
    const hovered = sessionStripTabLabel(tab, true) + " " + sessionStripTabClose(true) + SessionStripText.SEP

    expect(SessionStripText.SEP).toBe("│")

    expect(idle).not.toContain("HoverTarget X")
    expect(hovered).toContain("HoverTarget X│")
  })

  test("does not add an extra separator before the explorer after tabs", () => {
    expect(sessionStripActionNeedsSeparator({ hidden: 0 })).toBe(false)
  })

  test("adds a separator before the explorer after hidden counts or next controls", () => {
    expect(sessionStripActionNeedsSeparator({ hidden: 2 })).toBe(true)
    expect(sessionStripActionNeedsSeparator({ hidden: 0, next: "ses_next" })).toBe(true)
  })

  test("hides the hidden-count label when the explorer is the only visible control", () => {
    expect(sessionStripShouldShowHidden({ tabs: 0, hidden: 3, action: true })).toBe(false)
    expect(sessionStripShouldShowHidden({ tabs: 1, hidden: 3, action: true })).toBe(true)
    expect(sessionStripShouldShowHidden({ tabs: 0, hidden: 3, action: false })).toBe(true)
  })
})
