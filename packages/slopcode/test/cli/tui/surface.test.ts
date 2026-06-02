import { describe, expect, test } from "bun:test"
import {
  commandRows,
  commandSlashNames,
  createSurfaceFrame,
  createSurfaceManifest,
  surfaceCommands,
} from "@/cli/cmd/tui/surface"

describe("shared TUI surface", () => {
  test("exposes a shared command and keybind manifest for native renderers", () => {
    const manifest = createSurfaceManifest({
      android: true,
      keybinds: {
        command_list: "ctrl+p",
        session_files: "<leader>f",
        plugin_manager: "none",
      },
    })

    expect(manifest.version).toBe(2)
    expect(manifest.renderer).toEqual({
      linux: "opentui/solid",
      android: "ratatui/crossterm",
      frame: "shared/terminal-frame",
    })
    expect(manifest.capabilities["android.runtime"]).toBe(true)
    expect(manifest.capabilities["terminal.mouse"]).toBe(false)
    expect(manifest.prompt.supportsFileParts).toBe(true)
    expect(commandSlashNames(manifest)).toEqual(expect.arrayContaining(["help", "files", "open", "close-editor"]))
    expect(manifest.commands.map((item) => item.id)).toEqual(
      expect.arrayContaining(["session.tabs", "sidebar.files", "editor.diff", "plugins.list"]),
    )
  })

  test("renders command rows from the same manifest data Android consumes", () => {
    const manifest = createSurfaceManifest({ keybinds: { session_files: "<leader>f" } })
    const rows = commandRows(manifest, "files")

    expect(rows.join("\n")).toContain("/files")
    expect(rows.join("\n")).toContain("Files")
    expect(rows.join("\n")).toContain("<leader> f")
    expect(commandRows(manifest, "missing-command")).toEqual(["No commands match missing-command"])
  })

  test("keeps all core Android slash commands represented in the shared manifest", () => {
    const slash = new Set(commandSlashNames({ commands: [...surfaceCommands] }))
    const androidCore = [
      "help",
      "commands",
      "new",
      "sessions",
      "tabs",
      "session",
      "children",
      "messages",
      "timeline",
      "status",
      "close",
      "model",
      "models",
      "providers",
      "connect",
      "agents",
      "agent",
      "summary",
      "files",
      "open",
      "attach",
      "edit",
      "save",
      "diagnostics",
      "diff",
      "close-editor",
      "close-editor!",
      "share",
      "unshare",
      "pause",
      "resume",
      "interrupt",
      "abort",
      "revert",
      "unrevert",
      "compact",
      "fork",
      "queue",
      "stash",
      "list",
      "pop",
      "shell",
      "doctor",
      "themes",
      "keybinds",
      "clipboard",
      "title",
      "suspend",
      "plugins",
      "mcps",
    ]

    expect(androidCore.filter((item) => !slash.has(item))).toEqual([])
  })

  test("renders a deterministic shared terminal frame for native parity", () => {
    const frame = createSurfaceFrame({
      width: 80,
      height: 16,
      snapshot: {
        version: 2,
        sessionID: "ses_frame",
        title: "Frame Parity",
        status: "idle",
        header: { title: "Frame Parity" },
        footer: {
          directory: "/data/data/com.termux/files/home",
          workspaceID: "wrk_frame",
          lsp: 1,
          mcp: 2,
          mcpFailed: false,
          permissions: 1,
        },
        tabs: [{ id: "ses_frame", title: "Frame Parity", active: true, status: "idle" }],
        transcript: [
          {
            id: "msg_user",
            role: "user",
            text: "hello",
            tools: [],
          },
          {
            id: "msg_assistant",
            role: "assistant",
            text: "hi",
            tools: [
              {
                id: "tool_bash",
                tool: "bash",
                status: "completed",
                preview: ["done"],
                diff: ["+ changed"],
                expandable: true,
              },
            ],
          },
        ],
        sidebar: { mode: "summary", rows: ["modified src/app.ts +2/-1"] },
      },
    })

    expect(frame.version).toBe(2)
    expect(frame.renderer).toBe("shared/terminal-frame")
    expect(frame.lines).toHaveLength(16)
    expect(frame.lines.every((line) => line.length === 80)).toBe(true)
    expect(frame.rows).toHaveLength(16)
    expect(frame.lines.join("\n")).toContain("SlopCode | Frame Parity | idle")
    expect(frame.lines.join("\n")).toContain("tool bash completed")
    expect(frame.lines.join("\n")).toContain("modified src/app.ts")
    expect(frame.lines.at(-1)).toContain("/data/data/com.termux/files/home")
  })

  test("renders the no-session home as Linux-like chrome for Android", () => {
    const frame = createSurfaceFrame({
      width: 90,
      height: 20,
      snapshot: {
        version: 2,
        title: "SlopCode",
        status: "idle",
        header: { title: "SlopCode" },
        footer: {
          directory: "/data/data/com.termux/files/home",
          version: "9.9.9",
          lsp: 0,
          mcp: 0,
          mcpFailed: false,
          permissions: 0,
        },
        tabs: [],
        transcript: [],
        sidebar: { mode: "summary", rows: [] },
      },
    })

    const text = frame.lines.join("\n")
    expect(frame.lines).toHaveLength(20)
    expect(frame.lines.every((line) => line.length > 0 && line.length <= 90)).toBe(true)
    expect(text).toContain("█▀▀ █   █▀█ █▀█")
    expect(text).toContain("> ")
    expect(frame.lines.at(-1)).toContain("/data/data/com.termux/files/home | 9.9.9 | /help")
    expect(text).not.toContain("Rust-native Termux TUI")
    expect(text).not.toContain("Fix a TODO in the codebase")
    expect(text).not.toContain("SlopCode | SlopCode | idle")
  })
})
