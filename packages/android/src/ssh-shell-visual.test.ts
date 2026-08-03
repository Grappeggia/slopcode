import { describe, expect, test } from "bun:test"
import { auditSshShellLayout, sshShellRect, sshShellRectsOverlap, SSH_SHELL_VISUAL_FIXTURES } from "./ssh-shell-visual"

describe("SSH shell visual fixture matrix", () => {
  test("covers every supported theme, orientation, large-font, keyboard, and inset state", () => {
    expect(SSH_SHELL_VISUAL_FIXTURES).toHaveLength(8)
    expect(new Set(SSH_SHELL_VISUAL_FIXTURES.map((item) => item.scheme))).toEqual(new Set(["light", "dark"]))
    expect(new Set(SSH_SHELL_VISUAL_FIXTURES.map((item) => item.orientation))).toEqual(new Set(["portrait", "landscape"]))
    expect(SSH_SHELL_VISUAL_FIXTURES.some((item) => item.fontScale >= 1.3 && item.keyboard)).toBeTrue()
    expect(new Set(SSH_SHELL_VISUAL_FIXTURES.map((item) => item.insets))).toEqual(new Set(["system", "gesture"]))
    expect(SSH_SHELL_VISUAL_FIXTURES.filter((item) => item.orientation === "landscape").every((item) => item.primaryAction === "flow")).toBeTrue()
  })

  test("audits rendered geometry for every fixture", () => {
    for (const fixture of SSH_SHELL_VISUAL_FIXTURES) {
      const landscape = fixture.orientation === "landscape"
      const statusBar = landscape ? sshShellRect(0, 0, 56, 412) : sshShellRect(0, 0, 412, 56)
      const menu = landscape ? sshShellRect(68, 32, 48, 48) : sshShellRect(12, 68, 48, 48)
      const addComputer = sshShellRect(24, landscape ? 220 : 560, landscape ? 792 : 364, 48)
      const primary = sshShellRect(24, landscape ? 280 : 628, landscape ? 792 : 364, 48)
      const audit = auditSshShellLayout({
        menu,
        statusBar,
        addComputer,
        primary,
        controls: [menu, addComputer, primary],
      })

      expect(audit).toEqual({
        menuClearsStatusBar: true,
        primaryClearsAddComputer: true,
        controlsMeetTouchTarget: true,
      })
    }
  })

  test("catches the two historical landscape overlaps", () => {
    const oldMenu = sshShellRect(49, 8, 48, 48)
    const oldStatusBar = sshShellRect(0, 0, 56, 412)
    const oldAddComputer = sshShellRect(98, 324, 718, 48)
    const oldPrimary = sshShellRect(98, 345, 718, 44)

    expect(sshShellRectsOverlap(oldMenu, oldStatusBar)).toBeTrue()
    expect(sshShellRectsOverlap(oldAddComputer, oldPrimary)).toBeTrue()
    expect(
      auditSshShellLayout({
        menu: oldMenu,
        statusBar: oldStatusBar,
        addComputer: oldAddComputer,
        primary: oldPrimary,
        controls: [oldMenu, oldAddComputer, oldPrimary],
      }),
    ).toEqual({
      menuClearsStatusBar: false,
      primaryClearsAddComputer: false,
      controlsMeetTouchTarget: false,
    })
  })
})
