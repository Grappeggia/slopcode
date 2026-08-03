export type SshShellVisualFixture = {
  id: string
  scheme: "light" | "dark"
  orientation: "portrait" | "landscape"
  fontScale: number
  keyboard: boolean
  insets: "system" | "gesture"
  primaryAction: "sticky" | "flow"
}

export type SshShellRect = {
  left: number
  top: number
  right: number
  bottom: number
  width: number
  height: number
}

export type SshShellLayoutAudit = {
  menuClearsStatusBar: boolean
  primaryClearsAddComputer: boolean
  controlsMeetTouchTarget: boolean
}

export function sshShellRect(left: number, top: number, width: number, height: number): SshShellRect {
  return { left, top, right: left + width, bottom: top + height, width, height }
}

export function sshShellRectsOverlap(first: SshShellRect, second: SshShellRect) {
  return first.left < second.right && first.right > second.left && first.top < second.bottom && first.bottom > second.top
}

export function auditSshShellLayout(input: {
  menu: SshShellRect
  statusBar: SshShellRect
  addComputer?: SshShellRect
  primary?: SshShellRect
  controls: readonly SshShellRect[]
}): SshShellLayoutAudit {
  return {
    menuClearsStatusBar: !sshShellRectsOverlap(input.menu, input.statusBar),
    primaryClearsAddComputer:
      !input.addComputer || !input.primary || !sshShellRectsOverlap(input.addComputer, input.primary),
    controlsMeetTouchTarget: input.controls.every((value) => value.width >= 48 && value.height >= 48),
  }
}

// Stable names for emulator screenshot baselines. Keep this matrix device-agnostic:
// the native test runner supplies its actual inset pixels and viewport dimensions.
export const SSH_SHELL_VISUAL_FIXTURES = [
  { id: "portrait-light-system", scheme: "light", orientation: "portrait", fontScale: 1, keyboard: false, insets: "system", primaryAction: "sticky" },
  { id: "portrait-dark-system", scheme: "dark", orientation: "portrait", fontScale: 1, keyboard: false, insets: "system", primaryAction: "sticky" },
  { id: "portrait-light-large-keyboard", scheme: "light", orientation: "portrait", fontScale: 1.3, keyboard: true, insets: "system", primaryAction: "sticky" },
  { id: "portrait-dark-large-keyboard", scheme: "dark", orientation: "portrait", fontScale: 1.3, keyboard: true, insets: "gesture", primaryAction: "sticky" },
  { id: "landscape-light-system", scheme: "light", orientation: "landscape", fontScale: 1, keyboard: false, insets: "system", primaryAction: "flow" },
  { id: "landscape-dark-system", scheme: "dark", orientation: "landscape", fontScale: 1, keyboard: false, insets: "system", primaryAction: "flow" },
  { id: "landscape-light-large-keyboard", scheme: "light", orientation: "landscape", fontScale: 1.3, keyboard: true, insets: "gesture", primaryAction: "flow" },
  { id: "landscape-dark-large-keyboard", scheme: "dark", orientation: "landscape", fontScale: 1.3, keyboard: true, insets: "gesture", primaryAction: "flow" },
] as const satisfies readonly SshShellVisualFixture[]
