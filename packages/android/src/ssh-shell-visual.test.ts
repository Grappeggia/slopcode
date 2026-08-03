import { describe, expect, test } from "bun:test"
import { auditSshShellLayout, sshShellRect, sshShellRectsOverlap, SSH_SHELL_VISUAL_FIXTURES } from "./ssh-shell-visual"

describe("SSH shell visual fixture matrix", () => {
  test("defines the requested emulator coverage matrix", () => {
    expect(SSH_SHELL_VISUAL_FIXTURES).toHaveLength(8)
    expect(new Set(SSH_SHELL_VISUAL_FIXTURES.map((item) => item.scheme))).toEqual(new Set(["light", "dark"]))
    expect(new Set(SSH_SHELL_VISUAL_FIXTURES.map((item) => item.orientation))).toEqual(new Set(["portrait", "landscape"]))
    expect(SSH_SHELL_VISUAL_FIXTURES.some((item) => item.fontScale >= 1.3 && item.keyboard)).toBeTrue()
    expect(new Set(SSH_SHELL_VISUAL_FIXTURES.map((item) => item.insets))).toEqual(new Set(["system", "gesture"]))
    expect(SSH_SHELL_VISUAL_FIXTURES.filter((item) => item.orientation === "landscape").every((item) => item.primaryAction === "flow")).toBeTrue()
  })

  test("audits measured geometry supplied by the emulator checker", () => {
    const audit = auditSshShellLayout({
      menu: sshShellRect(12, 60, 48, 48),
      statusBar: sshShellRect(0, 0, 412, 24),
      addComputer: sshShellRect(24, 560, 364, 48),
      primary: sshShellRect(24, 628, 364, 48),
      controls: [sshShellRect(12, 60, 48, 48), sshShellRect(24, 560, 364, 48), sshShellRect(24, 628, 364, 48)],
    })

    expect(audit).toEqual({
      menuClearsStatusBar: true,
      primaryClearsAddComputer: true,
      controlsMeetTouchTarget: true,
    })

    const landscape = auditSshShellLayout({
      menu: sshShellRect(12, 36, 48, 48),
      statusBar: sshShellRect(0, 0, 915, 24),
      addComputer: sshShellRect(98, 236, 718, 48),
      primary: sshShellRect(98, 300, 718, 48),
      controls: [sshShellRect(12, 36, 48, 48), sshShellRect(98, 236, 718, 48), sshShellRect(98, 300, 718, 48)],
    })
    expect(landscape).toEqual({
      menuClearsStatusBar: true,
      primaryClearsAddComputer: true,
      controlsMeetTouchTarget: true,
    })
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
