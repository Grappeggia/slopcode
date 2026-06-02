import { describe, expect, test } from "bun:test"
import { commandRows, commandSlashNames, createSurfaceManifest, surfaceCommands } from "@/cli/cmd/tui/surface"

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

    expect(manifest.version).toBe(1)
    expect(manifest.renderer).toEqual({
      linux: "opentui/solid",
      android: "ratatui/crossterm",
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
})
