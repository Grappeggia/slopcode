type Status = "active" | "inactive" | "blocked"
type Phase = 0 | 1 | 2 | 3 | 4 | 5

export const phases = [
  { phase: 0, label: "bootstrap", status: "active" },
  { phase: 1, label: "composer", status: "active" },
  { phase: 2, label: "workspace", status: "active" },
  { phase: 3, label: "rich-ui", status: "blocked" },
  { phase: 4, label: "native-convergence", status: "blocked" },
  { phase: 5, label: "editor-terminal-polish", status: "active" },
] as const satisfies readonly { phase: Phase; label: string; status: Status }[]

export const parity = [
  {
    id: "smoke.install",
    phase: 0,
    area: "baseline",
    mode: "smoke",
    active: true,
    status: "active",
    linux: ["global launcher resolves", "native runtime self-test passes"],
    android: ["global launcher resolves", "native sidecar self-test passes"],
    expect: ["global launcher resolves", "native sidecar self-test passes"],
  },
  {
    id: "composer.submit",
    phase: 1,
    area: "composer",
    mode: "parity",
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
    active: true,
    status: "active",
    linux: ["bracketed multiline paste", "prompt history recall", "cursor append after recall"],
    android: ["bracketed multiline paste", "prompt history recall", "cursor append after recall"],
    expect: ["bracketed multiline paste", "prompt history recall", "cursor append after recall"],
  },
  {
    id: "composer.advanced",
    phase: 1,
    area: "composer",
    mode: "parity",
    active: true,
    status: "active",
    linux: ["autocomplete", "shell mode", "prompt queue status", "stash list and pop", "rich paste replay"],
    android: ["autocomplete", "shell mode", "prompt queue status", "stash list and pop", "rich paste replay"],
    expect: ["autocomplete", "shell mode", "prompt queue status", "stash list and pop", "rich paste replay"],
  },
  {
    id: "dialogs.question",
    phase: 1,
    area: "dialogs",
    mode: "parity",
    active: true,
    status: "active",
    linux: ["question event renders", "numeric selection replies through daemon API"],
    android: ["question event renders", "numeric selection replies through daemon API"],
    expect: ["question event renders", "numeric selection replies through daemon API"],
  },
  {
    id: "layout.capture",
    phase: 1,
    area: "layout",
    mode: "parity",
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
    active: true,
    status: "active",
    linux: ["command palette panel", "Linux command aliases documented", "help is searchable"],
    android: ["command palette panel", "Linux command aliases documented", "help is searchable from Android sidecar"],
    expect: ["command palette panel", "Linux command aliases documented", "help is searchable from Android sidecar"],
  },
  {
    id: "sessions.tabs",
    phase: 2,
    area: "sessions",
    mode: "parity",
    active: true,
    status: "active",
    linux: ["session list panel", "tab strip", "tab switching commands"],
    android: ["session list panel", "tab strip", "tab switching commands"],
    expect: ["session list panel", "tab strip", "tab switching commands"],
  },
  {
    id: "sessions.routes",
    phase: 2,
    area: "sessions",
    mode: "parity",
    active: true,
    status: "active",
    linux: ["children route", "message history", "timeline panel", "revert and unrevert commands"],
    android: ["children route", "message history", "timeline panel", "revert and unrevert commands"],
    expect: ["children route", "message history", "timeline panel", "revert and unrevert commands"],
  },
  {
    id: "models.panel",
    phase: 2,
    area: "models",
    mode: "parity",
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
    active: true,
    status: "active",
    linux: ["tool status cards", "tool output preview", "diff preview lines"],
    android: ["tool status cards", "tool output preview", "diff preview lines"],
    expect: ["tool status cards", "tool output preview", "diff preview lines"],
  },
  {
    id: "permissions.preview",
    phase: 2,
    area: "permissions",
    mode: "parity",
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
    active: false,
    status: "blocked",
    missing: "chat/editor tab strip, dirty markers, close buttons, and persistence need the shared UI renderer",
    linux: ["chat tab", "multiple editor tabs", "inactive/active/last tab close"],
    android: [],
    expect: ["chat tab", "multiple editor tabs", "inactive/active/last tab close"],
  },
  {
    id: "sidebar.files",
    phase: 3,
    area: "sidebar",
    mode: "parity",
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
    active: true,
    status: "active",
    linux: ["open real file", "edit/save", "dirty guard", "diagnostics", "diff open/dismiss"],
    android: ["open real file", "save", "dirty guard", "diagnostics", "diff open/dismiss"],
    expect: ["open real file", "edit/save", "dirty guard", "diagnostics", "diff open/dismiss"],
  },
  {
    id: "terminal.polish",
    phase: 5,
    area: "terminal",
    mode: "parity",
    active: true,
    status: "active",
    linux: ["theme panel", "keybind help", "clipboard guidance", "title updates", "suspend help", "plugin discovery"],
    android: ["theme panel", "keybind help", "clipboard blocker", "title updates", "suspend help", "plugin discovery"],
    expect: ["theme/keybind/clipboard/title/suspend/plugin-adjacent behavior"],
  },
  {
    id: "native.opentui",
    phase: 4,
    area: "native",
    mode: "parity",
    active: false,
    status: "blocked",
    missing: "Bun FFI and OpenTUI native bindings are not reliable on Termux yet",
    linux: ["OpenTUI renderer boots", "keyboard and mouse events stream through native renderer"],
    android: [],
    expect: ["OpenTUI renderer boots", "keyboard and mouse events stream through native renderer"],
  },
  {
    id: "render.parity-gates",
    phase: 4,
    area: "rendering",
    mode: "parity",
    active: true,
    status: "active",
    linux: ["tool cards", "markdown/code clipping", "rich diff previews"],
    android: ["tool cards", "markdown/code clipping", "rich diff previews"],
    expect: ["tool cards", "markdown/code clipping", "rich diff previews"],
  },
  {
    id: "permissions.parity-gates",
    phase: 4,
    area: "permissions",
    mode: "parity",
    active: true,
    status: "active",
    linux: ["grouped forecast requests", "source labels", "custom rejection", "multi-request navigation"],
    android: ["grouped forecast requests", "source labels", "custom rejection", "multi-request navigation"],
    expect: ["grouped forecast requests", "source labels", "custom rejection", "multi-request navigation"],
  },
  {
    id: "release.sidecar-smoke",
    phase: 4,
    area: "release",
    mode: "smoke",
    active: false,
    status: "blocked",
    missing: "release verification must keep both Android runtime archives and the Termux sidecar smoke path explicit",
    linux: ["release artifact smoke runs during verification"],
    android: [],
    expect: ["release artifact smoke runs during verification"],
  },
] as const satisfies readonly {
  id: string
  phase: Phase
  area: string
  mode: "smoke" | "parity"
  active: boolean
  status: Status
  missing?: string
  linux: readonly string[]
  android: readonly string[]
  expect: readonly string[]
}[]

export function active(mode = "smoke") {
  return parity.filter((item) => {
    if (!item.active) return false
    if (mode === "parity") return item.mode === "smoke" || item.mode === "parity"
    return item.mode === "smoke"
  })
}

const state = (item: { status: Status }) => item.status

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
    }
  })
  return {
    phases: rows,
    totals: {
      active: rows.reduce((sum, item) => sum + item.active.length, 0),
      inactive: rows.reduce((sum, item) => sum + item.inactive.length, 0),
      blocked: rows.reduce((sum, item) => sum + item.blocked.length, 0),
    },
  }
}
