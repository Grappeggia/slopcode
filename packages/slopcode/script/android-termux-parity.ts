export const parity = [
  {
    id: "smoke.install",
    phase: 0,
    area: "baseline",
    mode: "smoke",
    active: true,
    expect: ["global launcher resolves", "native sidecar self-test passes"],
  },
  {
    id: "composer.submit",
    phase: 1,
    area: "composer",
    mode: "parity",
    active: true,
    expect: ["prompt_async body uses server-compatible ids", "submitted text is preserved"],
  },
  {
    id: "composer.editing",
    phase: 1,
    area: "composer",
    mode: "parity",
    active: true,
    expect: ["bracketed multiline paste", "prompt history recall", "cursor append after recall"],
  },
  {
    id: "dialogs.question",
    phase: 1,
    area: "dialogs",
    mode: "parity",
    active: true,
    expect: ["question event renders", "numeric selection replies through daemon API"],
  },
  {
    id: "layout.capture",
    phase: 1,
    area: "layout",
    mode: "parity",
    active: true,
    expect: ["ANSI output is captured", "normalized frame contains session chrome"],
  },
  {
    id: "commands.palette",
    phase: 2,
    area: "commands",
    mode: "parity",
    active: true,
    expect: ["command palette panel", "Linux command aliases documented", "help is searchable from Android sidecar"],
  },
  {
    id: "sessions.tabs",
    phase: 2,
    area: "sessions",
    mode: "parity",
    active: true,
    expect: ["session list panel", "tab strip", "tab switching commands"],
  },
  {
    id: "models.panel",
    phase: 2,
    area: "models",
    mode: "parity",
    active: true,
    expect: ["model list panel", "provider/model selection", "prompt_async sends selected model"],
  },
  {
    id: "files.panel",
    phase: 2,
    area: "files",
    mode: "parity",
    active: true,
    expect: ["modified file panel", "file search command", "workspace file rows"],
  },
  {
    id: "render.tools",
    phase: 2,
    area: "rendering",
    mode: "parity",
    active: true,
    expect: ["tool status cards", "tool output preview", "diff preview lines"],
  },
  {
    id: "permissions.preview",
    phase: 2,
    area: "permissions",
    mode: "parity",
    active: true,
    expect: ["permission request panel", "pattern preview", "once/always/reject replies"],
  },
  {
    id: "tabs.rich",
    phase: 3,
    area: "tabs",
    mode: "parity",
    active: false,
    missing: "chat/editor tab strip, dirty markers, close buttons, and persistence need the shared UI renderer",
    expect: ["chat tab", "multiple editor tabs", "inactive/active/last tab close"],
  },
  {
    id: "sidebar.files",
    phase: 3,
    area: "sidebar",
    mode: "parity",
    active: false,
    missing:
      "summary/files sidebar, file explorer rows, modified files, and open files sections need the shared UI renderer",
    expect: ["summary/files modes", "file attach", "open action", "docked and overlay layouts"],
  },
  {
    id: "editor.diff",
    phase: 3,
    area: "editor",
    mode: "parity",
    active: false,
    missing:
      "embedded Neovim snapshots, mouse/input forwarding, save, close guard, diagnostics, and diff dismiss are not in the sidecar",
    expect: ["open real file", "edit/save", "dirty guard", "diagnostics", "diff open/dismiss"],
  },
] as const

export function active(mode = "smoke") {
  return parity.filter((item) => {
    if (!item.active) return false
    if (mode === "parity") return item.mode === "smoke" || item.mode === "parity"
    return item.mode === "smoke"
  })
}
