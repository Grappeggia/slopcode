type Status = "active" | "inactive" | "blocked"
type Level = "true-parity" | "workflow-parity" | "surface-only" | "blocked"
type Mode = "smoke" | "parity" | "release"
type Phase = 0 | 1 | 2 | 3 | 4 | 5

export const levels = {
  true: "Linux and Android exercise the same observable behavior",
  workflow: "Android completes the workflow through sidecar-specific UI",
  surface: "Android exposes a discoverable surface but not full Linux UX",
  blocked: "Android cannot match Linux until unsupported platform work lands",
} as const

export const phases = [
  { phase: 0, label: "bootstrap", status: "active" },
  { phase: 1, label: "composer", status: "active" },
  { phase: 2, label: "workspace", status: "active" },
  { phase: 3, label: "rich-ui", status: "active" },
  { phase: 4, label: "rust-native-renderer", status: "active" },
  { phase: 5, label: "editor-terminal-polish", status: "active" },
] as const satisfies readonly { phase: Phase; label: string; status: Status }[]

export const parity = [
  {
    id: "smoke.install",
    phase: 0,
    area: "baseline",
    mode: "smoke",
    level: "true-parity",
    active: true,
    status: "active",
    linux: ["global launcher resolves", "native runtime self-test passes"],
    android: ["global launcher resolves", "native sidecar self-test passes", "runtime mode is reported"],
    expect: ["global launcher resolves", "native runtime self-test passes", "runtime mode is reported"],
  },
  {
    id: "home.landing",
    phase: 1,
    area: "home",
    mode: "parity",
    level: "workflow-parity",
    active: true,
    status: "active",
    linux: [
      "home logo",
      "prompt placeholder",
      "compact footer chrome",
      "lazy session creation",
      "typed prompt submits",
    ],
    android: [
      "home logo",
      "prompt placeholder",
      "compact footer chrome",
      "lazy session creation",
      "typed prompt submits",
    ],
    expect: [
      "home logo",
      "prompt placeholder",
      "compact footer chrome",
      "lazy session creation",
      "typed prompt submits",
    ],
  },
  {
    id: "composer.submit",
    phase: 1,
    area: "composer",
    mode: "parity",
    level: "true-parity",
    active: true,
    status: "active",
    linux: ["prompt_async body uses server-compatible ids", "submitted text is preserved"],
    android: ["prompt_async body uses server-compatible ids", "submitted text is preserved"],
    expect: ["prompt_async body uses server-compatible ids", "submitted text is preserved"],
  },
  {
    id: "composer.editing",
    phase: 1,
    area: "composer",
    mode: "parity",
    level: "workflow-parity",
    active: true,
    status: "active",
    linux: ["bracketed multiline paste", "prompt history recall", "cursor append after recall", "full prompt keymap"],
    android: ["bracketed multiline paste", "prompt history recall", "cursor append after recall", "core prompt keymap"],
    expect: ["bracketed multiline paste", "prompt history recall", "cursor append after recall", "core prompt keymap"],
  },
  {
    id: "composer.advanced",
    phase: 1,
    area: "composer",
    mode: "parity",
    level: "workflow-parity",
    active: true,
    status: "active",
    linux: ["autocomplete menu", "shell mode", "prompt queue status", "stash list and pop", "rich paste replay"],
    android: [
      "command autocomplete panel",
      "shell mode",
      "prompt queue status",
      "stash list and pop",
      "bracketed paste replay",
    ],
    expect: [
      "command autocomplete panel",
      "shell mode",
      "prompt queue status",
      "stash list and pop",
      "bracketed paste replay",
    ],
  },
  {
    id: "dialogs.question",
    phase: 1,
    area: "dialogs",
    mode: "parity",
    level: "workflow-parity",
    active: true,
    status: "active",
    linux: ["question dialog renders", "numeric selection replies through daemon API"],
    android: ["question panel renders", "numeric selection replies through daemon API"],
    expect: ["question panel renders", "numeric selection replies through daemon API"],
  },
  {
    id: "layout.capture",
    phase: 1,
    area: "layout",
    mode: "parity",
    level: "true-parity",
    active: true,
    status: "active",
    linux: ["ANSI output is captured", "normalized frame contains session chrome"],
    android: ["ANSI output is captured", "normalized frame contains session chrome"],
    expect: ["ANSI output is captured", "normalized frame contains session chrome"],
  },
  {
    id: "commands.palette",
    phase: 2,
    area: "commands",
    mode: "parity",
    level: "workflow-parity",
    active: true,
    status: "active",
    linux: ["interactive command palette", "searchable aliases", "keybound selection"],
    android: ["command palette panel", "searchable command names", "slash-command completion"],
    expect: ["command palette panel", "searchable command names", "slash-command completion"],
  },
  {
    id: "sessions.tabs",
    phase: 2,
    area: "sessions",
    mode: "parity",
    level: "workflow-parity",
    active: true,
    status: "active",
    linux: ["session list panel", "tab strip", "tab switching commands", "rich close affordances"],
    android: ["session list panel", "tab strip", "tab switching commands", "text close affordances"],
    expect: ["session list panel", "tab strip", "tab switching commands", "text close affordances"],
  },
  {
    id: "sessions.routes",
    phase: 2,
    area: "sessions",
    mode: "parity",
    level: "workflow-parity",
    active: true,
    status: "active",
    linux: ["children route", "message history", "timeline panel", "revert and unrevert commands"],
    android: ["children route", "message history", "timeline panel", "revert and unrevert commands"],
    expect: ["children route", "message history", "timeline panel", "revert and unrevert commands"],
  },
  {
    id: "sessions.controls",
    phase: 2,
    area: "sessions",
    mode: "parity",
    level: "workflow-parity",
    active: true,
    status: "active",
    linux: ["status panel", "share and unshare", "pause and resume", "compact", "interrupt", "fork session"],
    android: ["status panel", "share and unshare", "pause and resume", "compact", "interrupt", "fork session"],
    expect: ["status panel", "share and unshare", "pause and resume", "compact", "interrupt", "fork session"],
  },
  {
    id: "models.panel",
    phase: 2,
    area: "models",
    mode: "parity",
    level: "workflow-parity",
    active: true,
    status: "active",
    linux: ["model list panel", "provider/model selection", "prompt_async sends selected model"],
    android: ["model list panel", "provider/model selection", "prompt_async sends selected model"],
    expect: ["model list panel", "provider/model selection", "prompt_async sends selected model"],
  },
  {
    id: "files.panel",
    phase: 2,
    area: "files",
    mode: "parity",
    level: "workflow-parity",
    active: true,
    status: "active",
    linux: ["modified file panel", "file search command", "workspace file rows"],
    android: ["modified file panel", "file search command", "workspace file rows"],
    expect: ["modified file panel", "file search command", "workspace file rows"],
  },
  {
    id: "render.tools",
    phase: 2,
    area: "rendering",
    mode: "parity",
    level: "workflow-parity",
    active: true,
    status: "active",
    linux: ["tool status cards", "tool output preview", "diff preview lines"],
    android: ["tool status rows", "tool output preview", "diff preview lines"],
    expect: ["tool status rows", "tool output preview", "diff preview lines"],
  },
  {
    id: "permissions.preview",
    phase: 2,
    area: "permissions",
    mode: "parity",
    level: "workflow-parity",
    active: true,
    status: "active",
    linux: ["permission request panel", "pattern preview", "once/always/reject replies"],
    android: ["permission request panel", "pattern preview", "once/always/reject replies"],
    expect: ["permission request panel", "pattern preview", "once/always/reject replies"],
  },
  {
    id: "tabs.rich",
    phase: 3,
    area: "tabs",
    mode: "parity",
    level: "workflow-parity",
    active: true,
    status: "active",
    linux: ["chat tab", "multiple editor tabs", "inactive/active/last tab close"],
    android: ["chat tab", "active tab marker", "dirty marker", "last tab close"],
    expect: ["chat tab", "active tab marker", "dirty marker", "last tab close"],
  },
  {
    id: "sidebar.files",
    phase: 3,
    area: "sidebar",
    mode: "parity",
    level: "workflow-parity",
    active: true,
    status: "active",
    linux: ["summary/files modes", "file attach", "open action", "docked and overlay layouts"],
    android: ["summary/files modes", "file attach", "open action", "docked and overlay layouts"],
    expect: ["summary/files modes", "file attach", "open action", "docked and overlay layouts"],
  },
  {
    id: "editor.diff",
    phase: 5,
    area: "editor",
    mode: "parity",
    level: "workflow-parity",
    active: true,
    status: "active",
    linux: ["open real file", "edit/save", "dirty guard", "diagnostics", "diff open/dismiss"],
    android: [
      "open real file",
      "editor input focus",
      "edit/save",
      "dirty guard",
      "diagnostics",
      "diff open/dismiss",
      "snapshot preview",
    ],
    expect: [
      "open real file",
      "editor input focus",
      "edit/save",
      "dirty guard",
      "diagnostics",
      "diff open/dismiss",
      "snapshot preview",
    ],
  },
  {
    id: "terminal.polish",
    phase: 5,
    area: "terminal",
    mode: "parity",
    level: "workflow-parity",
    active: true,
    status: "active",
    linux: ["theme switcher", "keybind help", "system clipboard", "title updates", "suspend hooks", "plugin UI"],
    android: [
      "ratatui/crossterm chrome",
      "Termux theme guidance",
      "keybind help",
      "Termux:API clipboard detection",
      "title updates",
      "suspend guidance",
      "plugin discovery",
    ],
    expect: [
      "ratatui/crossterm chrome",
      "Termux theme guidance",
      "keybind help",
      "Termux:API clipboard detection",
      "title updates",
      "suspend guidance",
      "plugin discovery",
    ],
  },
  {
    id: "native.rust-tui",
    phase: 4,
    area: "native",
    mode: "parity",
    level: "workflow-parity",
    active: true,
    status: "active",
    linux: ["desktop TUI remains the desktop renderer"],
    android: [
      "Cargo-built ratatui/crossterm renderer boots",
      "keyboard and paste events are handled in Rust",
      "doctor reports the Rust TUI core",
    ],
    expect: [
      "Cargo-built ratatui/crossterm renderer boots",
      "keyboard and paste events are handled in Rust",
      "doctor reports the Rust TUI core",
    ],
  },
  {
    id: "render.parity-gates",
    phase: 4,
    area: "rendering",
    mode: "parity",
    level: "workflow-parity",
    active: true,
    status: "active",
    linux: ["tool cards", "markdown/code clipping", "rich diff previews"],
    android: ["tool rows", "markdown/code clipping", "diff previews"],
    expect: ["tool rows", "markdown/code clipping", "diff previews"],
  },
  {
    id: "permissions.parity-gates",
    phase: 4,
    area: "permissions",
    mode: "parity",
    level: "workflow-parity",
    active: true,
    status: "active",
    linux: ["grouped forecast requests", "source labels", "custom rejection", "multi-request navigation"],
    android: ["grouped request summary", "source labels", "custom rejection", "multi-request navigation"],
    expect: ["grouped request summary", "source labels", "custom rejection", "multi-request navigation"],
  },
  {
    id: "release.rust-tui-smoke",
    phase: 4,
    area: "release",
    mode: "release",
    level: "true-parity",
    active: true,
    status: "active",
    linux: ["release artifact smoke runs during verification"],
    android: [
      "release Android archives include Cargo-built Rust TUI runtime and compatibility host alias",
      "postinstall fallback installs the Rust runtime",
      "Android archives omit Bun",
    ],
    expect: [
      "release Android archives include Cargo-built Rust TUI runtime and compatibility host alias",
      "postinstall fallback installs the Rust runtime",
      "Android archives omit Bun",
    ],
  },
] as const satisfies readonly {
  id: string
  phase: Phase
  area: string
  mode: Mode
  level: Level
  active: boolean
  status: Status
  missing?: string
  linux: readonly string[]
  android: readonly string[]
  expect: readonly string[]
}[]

export function active(mode: Mode | "all" = "smoke") {
  return parity.filter((item) => {
    if (!item.active) return false
    if (mode === "all") return true
    if (mode === "parity") return item.mode === "smoke" || item.mode === "parity"
    return item.mode === mode
  })
}

const state = (item: { status: Status }) => item.status
const level = (item: { level: Level }) => item.level

export function report() {
  const rows = phases.map((phase) => {
    const items = parity.filter((item) => item.phase === phase.phase)
    return {
      phase: phase.phase,
      label: phase.label,
      status: phase.status,
      active: items.filter((item) => state(item) === "active").map((item) => item.id),
      inactive: items.filter((item) => state(item) === "inactive").map((item) => item.id),
      blocked: items.filter((item) => state(item) === "blocked").map((item) => item.id),
      trueParity: items.filter((item) => level(item) === "true-parity").map((item) => item.id),
      workflowParity: items.filter((item) => level(item) === "workflow-parity").map((item) => item.id),
      surfaceOnly: items.filter((item) => level(item) === "surface-only").map((item) => item.id),
    }
  })
  return {
    phases: rows,
    totals: {
      active: rows.reduce((sum, item) => sum + item.active.length, 0),
      inactive: rows.reduce((sum, item) => sum + item.inactive.length, 0),
      blocked: rows.reduce((sum, item) => sum + item.blocked.length, 0),
      trueParity: rows.reduce((sum, item) => sum + item.trueParity.length, 0),
      workflowParity: rows.reduce((sum, item) => sum + item.workflowParity.length, 0),
      surfaceOnly: rows.reduce((sum, item) => sum + item.surfaceOnly.length, 0),
    },
    overclaims: parity
      .filter((item) => item.active && item.level !== "true-parity")
      .map((item) => ({ id: item.id, level: item.level, android: item.android, linux: item.linux })),
  }
}
