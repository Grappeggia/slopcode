export type SshShellVisualFixture = {
  id: string
  scheme: "light" | "dark"
  orientation: "portrait" | "landscape"
  fontScale: number
  keyboard: boolean
  insets: "system" | "gesture"
}

// Stable names for emulator screenshot baselines. Keep this matrix device-agnostic:
// the native test runner supplies its actual inset pixels and viewport dimensions.
export const SSH_SHELL_VISUAL_FIXTURES = [
  { id: "portrait-light-system", scheme: "light", orientation: "portrait", fontScale: 1, keyboard: false, insets: "system" },
  { id: "portrait-dark-system", scheme: "dark", orientation: "portrait", fontScale: 1, keyboard: false, insets: "system" },
  { id: "portrait-light-large-keyboard", scheme: "light", orientation: "portrait", fontScale: 1.3, keyboard: true, insets: "system" },
  { id: "portrait-dark-large-keyboard", scheme: "dark", orientation: "portrait", fontScale: 1.3, keyboard: true, insets: "gesture" },
  { id: "landscape-light-system", scheme: "light", orientation: "landscape", fontScale: 1, keyboard: false, insets: "system" },
  { id: "landscape-dark-system", scheme: "dark", orientation: "landscape", fontScale: 1, keyboard: false, insets: "system" },
  { id: "landscape-light-large-keyboard", scheme: "light", orientation: "landscape", fontScale: 1.3, keyboard: true, insets: "gesture" },
  { id: "landscape-dark-large-keyboard", scheme: "dark", orientation: "landscape", fontScale: 1.3, keyboard: true, insets: "gesture" },
] as const satisfies readonly SshShellVisualFixture[]
